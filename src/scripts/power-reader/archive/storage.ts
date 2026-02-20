/**
 * IndexedDB storage for User Archive
 */

import type { Post, Comment } from '../../../shared/graphql/queries';
import { Logger } from '../utils/logger';

const DB_NAME = 'PowerReaderArchive';
const DB_VERSION = 2;
const STORE_ITEMS = 'items';
const STORE_METADATA = 'metadata';
const STORE_CONTEXTUAL = 'contextual_cache';

// Lightweight pruning policy for third-party contextual data.
const CONTEXT_MAX_ENTRIES_PER_USER = 8000;
const CONTEXT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 60; // 60 days

type ContextualItem = Post | Comment;
type ContextualItemType = 'post' | 'comment';

interface ContextualCacheEntry {
  cacheKey: string;
  username: string;
  itemType: ContextualItemType;
  itemId: string;
  payload: ContextualItem;
  completeness: number;
  updatedAt: number;
  lastAccessedAt: number;
}

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionToPromise = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const isPost = (item: ContextualItem): item is Post => 'title' in item;

const contextCacheKey = (username: string, itemType: ContextualItemType, itemId: string): string =>
  `${username}:${itemType}:${itemId}`;

const dedupeById = <T extends { _id: string }>(items: T[]): T[] => {
  const map = new Map<string, T>();
  items.forEach(item => map.set(item._id, item));
  return Array.from(map.values());
};

const mergeContextPayload = <T extends ContextualItem>(existing: T, incoming: T): T => {
  const merged: any = { ...existing, ...incoming };

  if ((existing as any).contents || (incoming as any).contents) {
    merged.contents = { ...(existing as any).contents, ...(incoming as any).contents };
  }
  if ((existing as any).user || (incoming as any).user) {
    merged.user = { ...(existing as any).user, ...(incoming as any).user };
  }
  if ((existing as any).post || (incoming as any).post) {
    merged.post = { ...(existing as any).post, ...(incoming as any).post };
  }

  const existingBody = (existing as any).htmlBody;
  const incomingBody = (incoming as any).htmlBody;
  if ((typeof existingBody === 'string' && existingBody.trim().length > 0) &&
    (!incomingBody || (typeof incomingBody === 'string' && incomingBody.trim().length === 0))) {
    merged.htmlBody = existingBody;
  }

  const existingMarkdown = (existing as any).contents?.markdown;
  const incomingMarkdown = (incoming as any).contents?.markdown;
  if (existingMarkdown && !incomingMarkdown) {
    merged.contents = { ...(merged.contents || {}), markdown: existingMarkdown };
  }

  const existingParent = (existing as any).parentComment;
  const incomingParent = (incoming as any).parentComment;
  if (existingParent && !incomingParent) {
    merged.parentComment = existingParent;
  }

  return merged as T;
};

const getCompletenessScore = (item: ContextualItem): number => {
  let score = 1;
  const body = (item as any).htmlBody;
  const markdown = (item as any).contents?.markdown;

  if (typeof body === 'string' && body.trim().length > 0) score += 4;
  if (typeof markdown === 'string' && markdown.trim().length > 0) score += 3;
  if ((item as any).user) score += 1;

  if (isPost(item)) {
    if (item.title) score += 1;
  } else {
    if ((item as any).parentComment) score += 1;
    if ((item as any).post) score += 1;
    if (Array.isArray((item as any).latestChildren) && (item as any).latestChildren.length > 0) score += 1;
  }

  return score;
};

/**
 * Open the IndexedDB database
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store for authored posts/comments.
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        const itemStore = db.createObjectStore(STORE_ITEMS, { keyPath: '_id' });
        itemStore.createIndex('username', 'username', { unique: false });
        itemStore.createIndex('postedAt', 'postedAt', { unique: false });
        itemStore.createIndex('userId', 'userId', { unique: false });
      }

      // Store for metadata (lastSyncDate).
      if (!db.objectStoreNames.contains(STORE_METADATA)) {
        db.createObjectStore(STORE_METADATA, { keyPath: 'username' });
      }

      // Store for contextual (non-authored) thread reconstruction data.
      if (!db.objectStoreNames.contains(STORE_CONTEXTUAL)) {
        const contextualStore = db.createObjectStore(STORE_CONTEXTUAL, { keyPath: 'cacheKey' });
        contextualStore.createIndex('username', 'username', { unique: false });
        contextualStore.createIndex('itemType', 'itemType', { unique: false });
        contextualStore.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Save authored items and update watermarks for a user.
 */
export const saveArchiveData = async (
  username: string,
  items: (Post | Comment)[],
  watermarks: {
    lastSyncDate?: string | null;
    lastSyncDate_comments?: string | null;
    lastSyncDate_posts?: string | null;
  }
): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction([STORE_ITEMS, STORE_METADATA], 'readwrite');

  const itemStore = tx.objectStore(STORE_ITEMS);
  const metadataStore = tx.objectStore(STORE_METADATA);

  // Add username to each item for indexing.
  items.forEach(item => {
    const itemToSave = { ...item, username };
    itemStore.put(itemToSave);
  });

  // Get current metadata to preserve existing watermarks if not provided in this call
  const existingMetadataRequest = metadataStore.get(username);
  const existingMetadata = await requestToPromise(existingMetadataRequest);

  const updatedMetadata = {
    username,
    lastSyncDate: watermarks.lastSyncDate ?? existingMetadata?.lastSyncDate ?? null,
    lastSyncDate_comments: watermarks.lastSyncDate_comments ?? existingMetadata?.lastSyncDate_comments ?? null,
    lastSyncDate_posts: watermarks.lastSyncDate_posts ?? existingMetadata?.lastSyncDate_posts ?? null
  };

  metadataStore.put(updatedMetadata);
  await transactionToPromise(tx);
};

/**
 * Load authored items and metadata for a user.
 */
export const loadArchiveData = async (username: string): Promise<{
  items: (Post | Comment)[];
  lastSyncDate: string | null;
  lastSyncDate_comments: string | null;
  lastSyncDate_posts: string | null;
}> => {
  const db = await openDB();

  // 1. Get metadata.
  const metadata: any = await new Promise((resolve) => {
    const tx = db.transaction(STORE_METADATA, 'readonly');
    const request = tx.objectStore(STORE_METADATA).get(username);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });

  // 2. Get authored items via username index.
  const items: (Post | Comment)[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ITEMS, 'readonly');
    const index = tx.objectStore(STORE_ITEMS).index('username');
    const request = index.getAll(IDBKeyRange.only(username));

    request.onsuccess = () => {
      const results = request.result;
      // Sort in-memory by postedAt descending by default.
      results.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });

  return {
    items,
    lastSyncDate: metadata?.lastSyncDate || null,
    lastSyncDate_comments: metadata?.lastSyncDate_comments || null,
    lastSyncDate_posts: metadata?.lastSyncDate_posts || null
  };
};

const upsertContextualEntries = async (
  username: string,
  itemType: ContextualItemType,
  items: ContextualItem[]
): Promise<void> => {
  if (items.length === 0) return;

  const db = await openDB();
  const tx = db.transaction(STORE_CONTEXTUAL, 'readwrite');
  const store = tx.objectStore(STORE_CONTEXTUAL);
  const now = Date.now();

  const uniqueItems = dedupeById(items);

  const getPromises = uniqueItems.map(item => {
    const key = contextCacheKey(username, itemType, item._id);
    return requestToPromise(store.get(key) as IDBRequest<ContextualCacheEntry | undefined>)
      .then(existing => ({ item, key, existing }));
  });

  const results = await Promise.all(getPromises);

  for (const { item, key, existing } of results) {
    const payload = existing
      ? mergeContextPayload(existing.payload as any, item as any)
      : item;
    const completeness = Math.max(
      existing?.completeness || 0,
      getCompletenessScore(item),
      getCompletenessScore(payload)
    );

    const entry: ContextualCacheEntry = {
      cacheKey: key,
      username,
      itemType,
      itemId: item._id,
      payload,
      completeness,
      updatedAt: now,
      lastAccessedAt: now
    };
    store.put(entry);
  }

  await transactionToPromise(tx);
};

/**
 * Persist contextual comments/posts for thread reconstruction.
 */
export const saveContextualItems = async (
  username: string,
  comments: Comment[] = [],
  posts: Post[] = []
): Promise<void> => {
  if (comments.length === 0 && posts.length === 0) return;

  await upsertContextualEntries(username, 'comment', comments);
  await upsertContextualEntries(username, 'post', posts);
  await pruneContextualCache(username);
};

/**
 * Resolve contextual comments from cache by IDs.
 * Touches `lastAccessedAt` for LRU pruning.
 */
export const loadContextualCommentsByIds = async (
  username: string,
  commentIds: string[]
): Promise<{ comments: Comment[]; missingIds: string[] }> => {
  const ids = Array.from(new Set(commentIds.filter(Boolean)));
  if (ids.length === 0) return { comments: [], missingIds: [] };

  const db = await openDB();
  const tx = db.transaction(STORE_CONTEXTUAL, 'readwrite');
  const store = tx.objectStore(STORE_CONTEXTUAL);
  const now = Date.now();

  const comments: Comment[] = [];
  const missingIds: string[] = [];

  const getPromises = ids.map(id => {
    const key = contextCacheKey(username, 'comment', id);
    return requestToPromise(store.get(key) as IDBRequest<ContextualCacheEntry | undefined>)
      .then(entry => ({ id, entry }));
  });

  const results = await Promise.all(getPromises);

  for (const { id, entry } of results) {
    const isExpired = !!entry && (now - entry.updatedAt > CONTEXT_MAX_AGE_MS);

    if (!entry || entry.itemType !== 'comment' || isExpired) {
      if (entry && isExpired) {
        store.delete(entry.cacheKey);
      }
      missingIds.push(id);
      continue;
    }

    entry.lastAccessedAt = now;
    store.put(entry);

    const comment = { ...(entry.payload as Comment) } as Comment;
    if (!comment.post && comment.postId) {
      const postEntry = await requestToPromise(
        store.get(contextCacheKey(username, 'post', comment.postId)) as IDBRequest<ContextualCacheEntry | undefined>
      );
      const postExpired = !!postEntry && (now - postEntry.updatedAt > CONTEXT_MAX_AGE_MS);
      if (postEntry && postExpired) {
        store.delete(postEntry.cacheKey);
      } else if (postEntry && postEntry.itemType === 'post') {
        postEntry.lastAccessedAt = now;
        store.put(postEntry);
        (comment as any).post = postEntry.payload as Post;
      }
    }
    comments.push(comment);
  }

  await transactionToPromise(tx);
  return { comments: dedupeById(comments), missingIds };
};

/**
 * Load all fresh contextual items for a username.
 * Used for archive search scope:all to include cached thread context.
 */
export const loadAllContextualItems = async (
  username: string
): Promise<{ comments: Comment[]; posts: Post[] }> => {
  const db = await openDB();
  const tx = db.transaction(STORE_CONTEXTUAL, 'readonly');
  const store = tx.objectStore(STORE_CONTEXTUAL);
  const index = store.index('username');
  const entries = await requestToPromise(index.getAll(IDBKeyRange.only(username)) as IDBRequest<ContextualCacheEntry[]>);
  const now = Date.now();

  const comments: Comment[] = [];
  const posts: Post[] = [];

  for (const entry of entries) {
    if (now - entry.updatedAt > CONTEXT_MAX_AGE_MS) {
      continue;
    }

    if (entry.itemType === 'comment') {
      comments.push(entry.payload as Comment);
    } else if (entry.itemType === 'post') {
      posts.push(entry.payload as Post);
    }
  }

  return {
    comments: dedupeById(comments),
    posts: dedupeById(posts)
  };
};

/**
 * Prune contextual cache for a user via age + LRU cap.
 */
export const pruneContextualCache = async (username: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_CONTEXTUAL, 'readwrite');
  const store = tx.objectStore(STORE_CONTEXTUAL);
  const index = store.index('username');
  const entries = await requestToPromise(index.getAll(IDBKeyRange.only(username)) as IDBRequest<ContextualCacheEntry[]>);
  const now = Date.now();

  let removed = 0;

  const freshEntries = entries.filter(entry => {
    const isExpired = now - entry.updatedAt > CONTEXT_MAX_AGE_MS;
    if (isExpired) {
      store.delete(entry.cacheKey);
      removed++;
    }
    return !isExpired;
  });

  if (freshEntries.length > CONTEXT_MAX_ENTRIES_PER_USER) {
    const overflow = freshEntries.length - CONTEXT_MAX_ENTRIES_PER_USER;
    const toEvict = [...freshEntries]
      .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)
      .slice(0, overflow);

    toEvict.forEach(entry => {
      store.delete(entry.cacheKey);
      removed++;
    });
  }

  await transactionToPromise(tx);

  if (removed > 0) {
    Logger.info(`Pruned ${removed} contextual cache records for ${username}`);
  }
};

/**
 * Clear archive data for a user.
 */
export const clearArchiveData = async (username: string): Promise<void> => {
  Logger.info(`Clearing archive storage for user: ${username}`);
  const db = await openDB();
  const tx = db.transaction([STORE_ITEMS, STORE_METADATA, STORE_CONTEXTUAL], 'readwrite');

  // Delete metadata.
  tx.objectStore(STORE_METADATA).delete(username);

  // Delete authored items.
  const itemStore = tx.objectStore(STORE_ITEMS);
  const itemsIndex = itemStore.index('username');
  const authoredCursor = itemsIndex.openCursor(IDBKeyRange.only(username));
  authoredCursor.onsuccess = (event) => {
    const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };

  // Delete contextual cache entries.
  const contextualStore = tx.objectStore(STORE_CONTEXTUAL);
  const contextualIndex = contextualStore.index('username');
  const contextualCursor = contextualIndex.openCursor(IDBKeyRange.only(username));
  contextualCursor.onsuccess = (event) => {
    const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };

  await transactionToPromise(tx);
};
