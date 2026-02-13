/**
 * IndexedDB storage for User Archive
 */

import type { Post, Comment } from '../../../shared/graphql/queries';
import { Logger } from '../utils/logger';

const DB_NAME = 'PowerReaderArchive';
const DB_VERSION = 1;
const STORE_ITEMS = 'items';
const STORE_METADATA = 'metadata';

/**
 * Open the IndexedDB database
 */
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Store for Posts and Comments
            if (!db.objectStoreNames.contains(STORE_ITEMS)) {
                const itemStore = db.createObjectStore(STORE_ITEMS, { keyPath: '_id' });
                itemStore.createIndex('username', 'username', { unique: false });
                itemStore.createIndex('postedAt', 'postedAt', { unique: false });
                itemStore.createIndex('userId', 'userId', { unique: false });
            }

            // Store for metadata (lastSyncDate)
            if (!db.objectStoreNames.contains(STORE_METADATA)) {
                db.createObjectStore(STORE_METADATA, { keyPath: 'username' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Save items and update lastSyncDate for a user
 */
export const saveArchiveData = async (
    username: string,
    items: (Post | Comment)[],
    lastSyncDate: string
): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction([STORE_ITEMS, STORE_METADATA], 'readwrite');

    const itemStore = tx.objectStore(STORE_ITEMS);
    const metadataStore = tx.objectStore(STORE_METADATA);

    // Add username to each item for indexing
    items.forEach(item => {
        const itemToSave = { ...item, username };
        itemStore.put(itemToSave);
    });

    metadataStore.put({ username, lastSyncDate });

    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

/**
 * Load all items and metadata for a user
 */
export const loadArchiveData = async (username: string): Promise<{
    items: (Post | Comment)[],
    lastSyncDate: string | null
}> => {
    const db = await openDB();

    // 1. Get metadata
    const metadata: any = await new Promise((resolve) => {
        const tx = db.transaction(STORE_METADATA, 'readonly');
        const request = tx.objectStore(STORE_METADATA).get(username);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });

    // 2. Get items via username index
    const items: (Post | Comment)[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_ITEMS, 'readonly');
        const index = tx.objectStore(STORE_ITEMS).index('username');
        const request = index.getAll(IDBKeyRange.only(username));

        request.onsuccess = () => {
            const results = request.result;
            // Sort in-memory by postedAt descending by default
            results.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
            resolve(results);
        };
        request.onerror = () => reject(request.error);
    });

    return {
        items,
        lastSyncDate: metadata?.lastSyncDate || null
    };
};

/**
 * Clear archive data for a user
 */
export const clearArchiveData = async (username: string): Promise<void> => {
    Logger.info(`Clearing archive storage for user: ${username}`);
    const db = await openDB();
    const tx = db.transaction([STORE_ITEMS, STORE_METADATA], 'readwrite');

    // Delete from metadata
    tx.objectStore(STORE_METADATA).delete(username);

    // Delete from items (requires cursor since we index by username but primary key is _id)
    const itemStore = tx.objectStore(STORE_ITEMS);
    const index = itemStore.index('username');
    const request = index.openCursor(IDBKeyRange.only(username));

    request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
            cursor.delete();
            cursor.continue();
        }
    };

    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};
