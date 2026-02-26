
/**
 * Storage utilities for Power Reader
 * Wraps GM_setValue/GM_getValue with type safety
 */

import { Logger } from './logger';
import { isEAForumHostname } from './forum';

declare const GM_setValue: (key: string, value: string) => void;
declare const GM_getValue: (key: string, defaultValue: string) => string;

const STORAGE_KEYS = {
  READ: 'power-reader-read',
  READ_FROM: 'power-reader-read-from',
  AUTHOR_PREFS: 'power-reader-author-prefs',
  VIEW_WIDTH: 'power-reader-view-width',
  AI_STUDIO_PREFIX: 'power-reader-ai-studio-prefix',
  SYNC_META: 'power-reader-sync-meta',
  SYNC_ENABLED: 'power-reader-sync-enabled',
  DEVICE_ID: 'power-reader-device-id',
  SYNC_QUOTA_META: 'power-reader-sync-quota-meta',
} as const;

const DEVICE_ID_MIN_LENGTH = 8;
const DEVICE_ID_MAX_LENGTH = 96;

export type SyncableField = 'read' | 'loadFrom' | 'authorPrefs';

interface StorageWriteOptions {
  silent?: boolean;
}

/**
 * Get domain-specific storage key prefix
 * Preserves legacy (no-prefix) for LessWrong to maintain user data.
 * Adds 'ea-' for EA Forum.
 */
export function getKey(baseKey: string): string {
  const hostname = window.location.hostname;
  if (isEAForumHostname(hostname)) {
    return `ea-${baseKey}`;
  }
  return baseKey;
}

export interface ReadState {
  [commentId: string]: 1;
}

export interface AuthorPreferences {
  [authorName: string]: -1 | 0 | 1;
}

let cachedReadState: ReadState | null = null;
let lastReadStateFetch: number = 0;
let cachedLoadFrom: string | null = null;
let lastLoadFromFetch: number = 0;
const syncFieldListeners = new Set<(field: SyncableField) => void>();

const notifySyncFieldChanged = (field: SyncableField, options?: StorageWriteOptions): void => {
  if (options?.silent) return;
  for (const listener of syncFieldListeners) {
    try {
      listener(field);
    } catch (error) {
      Logger.warn(`sync field listener failed for ${field}`, error);
    }
  }
};

export const onSyncFieldChanged = (listener: (field: SyncableField) => void): (() => void) => {
  syncFieldListeners.add(listener);
  return () => syncFieldListeners.delete(listener);
};

export const STORAGE_KEY_NAMES = STORAGE_KEYS;

// Clear caches on module load if in test mode to prevent cross-test pollution
if (typeof window !== 'undefined' && (window as any).__PR_TEST_MODE__) {
  cachedLoadFrom = null;
  lastLoadFromFetch = 0;
  cachedReadState = null;
  lastReadStateFetch = 0;
}

/**
 * Get read comment IDs
 */
export function getReadState(): ReadState {
  // Simple cache for 100ms to prevent redundant parsing during a single render pass
  const now = Date.now();
  if (cachedReadState && (now - lastReadStateFetch < 100)) {
    return cachedReadState;
  }

  try {
    const raw = GM_getValue(getKey(STORAGE_KEYS.READ), '{}');
    cachedReadState = JSON.parse(raw);
    lastReadStateFetch = now;
    return cachedReadState!;
  } catch {
    return {};
  }
}

/**
 * Save read comment IDs
 */
export function setReadState(state: ReadState, options: StorageWriteOptions = {}): void {
  cachedReadState = state;
  lastReadStateFetch = Date.now();
  GM_setValue(getKey(STORAGE_KEYS.READ), JSON.stringify(state));
  notifySyncFieldChanged('read', options);
}

/**
 * Check if a comment is read
 */
export function isRead(id: string, state?: ReadState, postedAt?: string | null): boolean {
  // 1. Explicitly marked read in storage
  const readMap = state || getReadState();
  if (readMap[id] === 1) return true;

  // 2. Implicitly read (older than session loadFrom boundary)
  if (postedAt) {
    const cutoff = getLoadFrom();
    if (cutoff && cutoff.includes('T')) {
      const postTime = new Date(postedAt).getTime();
      const cutoffTime = new Date(cutoff).getTime();
      if (!isNaN(postTime) && !isNaN(cutoffTime) && postTime < cutoffTime) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Mark a comment as read
 */
export function markAsRead(target: string | Record<string, 1>): void {
  const state = getReadState();
  if (typeof target === 'string') {
    state[target] = 1;
  } else {
    Object.assign(state, target);
  }
  setReadState(state);
}

/**
 * Get the starting datetime for continuation (ISO 8601 string)
 */
export function getLoadFrom(): string {
  const now = Date.now();
  if (cachedLoadFrom && (now - lastLoadFromFetch < 100)) {
    return cachedLoadFrom;
  }

  const raw = GM_getValue(getKey(STORAGE_KEYS.READ_FROM), '');
  cachedLoadFrom = raw;
  lastLoadFromFetch = now;
  return raw;
}

/**
 * Set the starting datetime for continuation (ISO 8601 string)
 */
export function setLoadFrom(isoDatetime: string, options: StorageWriteOptions = {}): void {
  cachedLoadFrom = isoDatetime;
  lastLoadFromFetch = Date.now();
  GM_setValue(getKey(STORAGE_KEYS.READ_FROM), isoDatetime);
  notifySyncFieldChanged('loadFrom', options);
}

/**
 * Explicit reset/setup helper: set loadFrom and clear read state together.
 * setLoadFrom() intentionally remains pure and does not clear read state.
 */
export function setLoadFromAndClearRead(
  isoDatetime: string,
  options: StorageWriteOptions = {}
): void {
  setReadState({}, options);
  setLoadFrom(isoDatetime, options);
}

/**
 * Get author preferences
 */
export function getAuthorPreferences(): AuthorPreferences {
  try {
    const raw = GM_getValue(getKey(STORAGE_KEYS.AUTHOR_PREFS), '{}');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Save author preferences
 */
export function setAuthorPreferences(
  prefs: AuthorPreferences,
  options: StorageWriteOptions = {}
): void {
  GM_setValue(getKey(STORAGE_KEYS.AUTHOR_PREFS), JSON.stringify(prefs));
  notifySyncFieldChanged('authorPrefs', options);
}

/**
 * Toggle author preference (cycle: 0 -> 1 -> 0 or 0 -> -1 -> 0)
 */
export function toggleAuthorPreference(
  author: string,
  direction: 'up' | 'down'
): -1 | 0 | 1 {
  const prefs = getAuthorPreferences();
  const current = prefs[author] || 0;

  let newValue: -1 | 0 | 1;
  if (direction === 'up') {
    newValue = current > 0 ? 0 : 1;
  } else {
    newValue = current < 0 ? 0 : -1;
  }

  prefs[author] = newValue;
  setAuthorPreferences(prefs);
  return newValue;
}

/**
 * Get sanitized read tracking inputs based on archive mode
 */
export interface ReadTrackingInputs {
  readState: Record<string, 1>;
  cutoff: string | undefined;
}

export function getReadTrackingInputs(isArchiveMode: boolean): ReadTrackingInputs {
  if (isArchiveMode) {
    return { readState: {}, cutoff: undefined };
  }
  return { readState: getReadState(), cutoff: getLoadFrom() || undefined };
}

/**
 * Clear all read state
 */
export function clearReadState(): void {
  setReadState({});
  setLoadFrom('');
}

/**
 * Clear reader-only storage (read/loadFrom/authorPrefs/view width).
 */
export function clearReaderStorage(options: StorageWriteOptions = {}): void {
  cachedReadState = null;
  lastReadStateFetch = 0;
  cachedLoadFrom = null;
  lastLoadFromFetch = 0;
  GM_setValue(getKey(STORAGE_KEYS.READ), '{}');
  GM_setValue(getKey(STORAGE_KEYS.READ_FROM), '');
  GM_setValue(getKey(STORAGE_KEYS.AUTHOR_PREFS), '{}');
  GM_setValue(getKey(STORAGE_KEYS.VIEW_WIDTH), '0');
  notifySyncFieldChanged('read', options);
  notifySyncFieldChanged('loadFrom', options);
  notifySyncFieldChanged('authorPrefs', options);
}

/**
 * Clear ALL storage (factory reset)
 */
export function clearAllStorage(options: StorageWriteOptions = {}): void {
  clearReaderStorage(options);
  GM_setValue(getKey(STORAGE_KEYS.AI_STUDIO_PREFIX), '');
  GM_setValue(getKey(STORAGE_KEYS.SYNC_META), '');
  GM_setValue(getKey(STORAGE_KEYS.SYNC_ENABLED), '');
  GM_setValue(getKey(STORAGE_KEYS.DEVICE_ID), '');
  GM_setValue(getKey(STORAGE_KEYS.SYNC_QUOTA_META), '');
}

/**
 * Get saved view width (0 = full width)
 */
export function getViewWidth(): number {
  const raw = GM_getValue(getKey(STORAGE_KEYS.VIEW_WIDTH), '0');
  return parseInt(raw, 10) || 0;
}

/**
 * Save view width
 */
export function setViewWidth(width: number): void {
  GM_setValue(getKey(STORAGE_KEYS.VIEW_WIDTH), String(width));
}

/**
 * Get AI Studio prompt prefix
 */
export function getAIStudioPrefix(): string {
  return GM_getValue(getKey(STORAGE_KEYS.AI_STUDIO_PREFIX), '');
}

/**
 * Set AI Studio prompt prefix
 */
export function setAIStudioPrefix(prefix: string): void {
  GM_setValue(getKey(STORAGE_KEYS.AI_STUDIO_PREFIX), prefix);
}

export function getSyncMeta<T = unknown>(): T | null {
  const raw = GM_getValue(getKey(STORAGE_KEYS.SYNC_META), '');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setSyncMeta(value: unknown): void {
  GM_setValue(getKey(STORAGE_KEYS.SYNC_META), JSON.stringify(value));
}

export function getSyncEnabled(): boolean {
  const raw = GM_getValue(getKey(STORAGE_KEYS.SYNC_ENABLED), '');
  if (raw === '') return true;
  return raw === '1';
}

export function setSyncEnabled(enabled: boolean): void {
  GM_setValue(getKey(STORAGE_KEYS.SYNC_ENABLED), enabled ? '1' : '0');
}

export function getSyncQuotaMeta<T = unknown>(): T | null {
  const raw = GM_getValue(getKey(STORAGE_KEYS.SYNC_QUOTA_META), '');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setSyncQuotaMeta(value: unknown): void {
  GM_setValue(getKey(STORAGE_KEYS.SYNC_QUOTA_META), JSON.stringify(value));
}

export function getDeviceId(): string {
  const key = getKey(STORAGE_KEYS.DEVICE_ID);
  const existing = GM_getValue(key, '');
  if (existing && typeof existing === 'string') {
    const normalized = existing.trim();
    if (normalized.length >= DEVICE_ID_MIN_LENGTH && normalized.length <= DEVICE_ID_MAX_LENGTH) {
      return normalized;
    }
  }
  const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  GM_setValue(key, generated);
  return generated;
}

export async function exportState(): Promise<void> {
  const exportData: Record<string, string> = {};
  for (const key of Object.values(STORAGE_KEYS)) {
    const namespacedKey = getKey(key);
    exportData[namespacedKey] = GM_getValue(namespacedKey, '');
  }

  const json = JSON.stringify(exportData, null, 2);

  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(json);
      alert('Power Reader state copied to clipboard!');
    } catch (e) {
      Logger.error('Clipboard write failed:', e);
      alert('Failed to write to clipboard. Check console.');
    }
  } else {
    Logger.info('Exported State:', json);
    alert('Clipboard API not available. State logged to console.');
  }
}
