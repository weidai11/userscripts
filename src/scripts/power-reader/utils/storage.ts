/**
 * Storage utilities for Power Reader
 * Wraps GM_setValue/GM_getValue with type safety
 */

declare const GM_setValue: (key: string, value: string) => void;
declare const GM_getValue: (key: string, defaultValue: string) => string;

const STORAGE_KEYS = {
  READ: 'power-reader-read',
  READ_FROM: 'power-reader-read-from',
  AUTHOR_PREFS: 'power-reader-author-prefs',
  VIEW_WIDTH: 'power-reader-view-width',
  AI_STUDIO_PREFIX: 'power-reader-ai-studio-prefix',
} as const;

/**
 * Get domain-specific storage key prefix
 * Preserves legacy (no-prefix) for LessWrong to maintain user data.
 * Adds 'ea-' for EA Forum.
 */
export function getKey(baseKey: string): string {
  const hostname = window.location.hostname;
  if (hostname.includes('effectivealtruism.org')) {
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
export function setReadState(state: ReadState): void {
  cachedReadState = state;
  lastReadStateFetch = Date.now();
  GM_setValue(getKey(STORAGE_KEYS.READ), JSON.stringify(state));
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
export function setLoadFrom(isoDatetime: string): void {
  cachedLoadFrom = isoDatetime;
  lastLoadFromFetch = Date.now();
  GM_setValue(getKey(STORAGE_KEYS.READ_FROM), isoDatetime);
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
export function setAuthorPreferences(prefs: AuthorPreferences): void {
  GM_setValue(getKey(STORAGE_KEYS.AUTHOR_PREFS), JSON.stringify(prefs));
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
 * Clear all read state
 */
export function clearReadState(): void {
  setReadState({});
  setLoadFrom('');
}

/**
 * Clear ALL storage (factory reset)
 */
export function clearAllStorage(): void {
  GM_setValue(getKey(STORAGE_KEYS.READ), '{}');
  GM_setValue(getKey(STORAGE_KEYS.READ_FROM), '');
  GM_setValue(getKey(STORAGE_KEYS.AUTHOR_PREFS), '{}');
  GM_setValue(getKey(STORAGE_KEYS.VIEW_WIDTH), '0');
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
import { Logger } from './logger';

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
