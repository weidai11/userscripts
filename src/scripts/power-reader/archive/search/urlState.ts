import type { ArchiveSearchScope, ArchiveSearchSortMode } from './types';

const MAX_ENCODED_QUERY_LENGTH = 2000;
const QUERY_POINTER_PARAM = 'qk';
const QUERY_PARAM = 'q';
const SCOPE_PARAM = 'scope';
const SORT_PARAM = 'sort';
const SESSION_KEY_PREFIX = 'pr-archive-search-query:';

const VALID_SORTS: Set<ArchiveSearchSortMode> = new Set([
  'relevance',
  'date',
  'date-asc',
  'score',
  'score-asc',
  'replyTo'
]);

const VALID_SCOPES: Set<ArchiveSearchScope> = new Set(['authored', 'all']);

const canUseSessionStorage = (): boolean => {
  try {
    return typeof sessionStorage !== 'undefined';
  } catch {
    return false;
  }
};

const readSessionQuery = (key: string): string | null => {
  if (!canUseSessionStorage()) return null;
  try {
    return sessionStorage.getItem(`${SESSION_KEY_PREFIX}${key}`);
  } catch {
    return null;
  }
};

const MAX_SESSION_QUERY_ENTRIES = 20;

const evictOldSessionQueries = (): void => {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(SESSION_KEY_PREFIX)) {
        keys.push(k);
      }
    }
    if (keys.length <= MAX_SESSION_QUERY_ENTRIES) return;
    keys.sort();
    const toRemove = keys.slice(0, keys.length - MAX_SESSION_QUERY_ENTRIES);
    for (const k of toRemove) {
      sessionStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
};

const writeSessionQuery = (query: string): string | null => {
  if (!canUseSessionStorage()) return null;
  try {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(`${SESSION_KEY_PREFIX}${key}`, query);
    evictOldSessionQueries();
    return key;
  } catch {
    return null;
  }
};

export type ArchiveUrlState = {
  query: string;
  scope: ArchiveSearchScope;
  sort: ArchiveSearchSortMode;
  scopeFromUrl: boolean;
};

const sanitizeScope = (raw: string | null): ArchiveSearchScope =>
  raw && VALID_SCOPES.has(raw as ArchiveSearchScope) ? (raw as ArchiveSearchScope) : 'authored';

const sanitizeSort = (raw: string | null): ArchiveSearchSortMode =>
  raw && VALID_SORTS.has(raw as ArchiveSearchSortMode) ? (raw as ArchiveSearchSortMode) : 'date';

const sanitizeQuery = (raw: string | null): string =>
  typeof raw === 'string' ? raw : '';

export const parseArchiveUrlState = (): ArchiveUrlState => {
  try {
    const params = new URLSearchParams(window.location.search);
    const scopeRaw = params.get(SCOPE_PARAM);
    const scopeFromUrl = typeof scopeRaw === 'string' && scopeRaw.length > 0;
    const scope = sanitizeScope(scopeRaw);
    const sort = sanitizeSort(params.get(SORT_PARAM));

    let query = sanitizeQuery(params.get(QUERY_PARAM));
    const pointerKey = params.get(QUERY_POINTER_PARAM);
    if (pointerKey) {
      const pointerQuery = readSessionQuery(pointerKey);
      if (pointerQuery !== null) {
        query = pointerQuery;
      }
    }

    return { query, scope, sort, scopeFromUrl };
  } catch {
    return {
      query: '',
      scope: 'authored',
      sort: 'date',
      scopeFromUrl: false
    };
  }
};

export type ArchiveUrlWriteState = {
  query: string;
  scope: ArchiveSearchScope;
  sort: ArchiveSearchSortMode;
};

export const writeArchiveUrlState = (state: ArchiveUrlWriteState): void => {
  const params = new URLSearchParams(window.location.search);
  const query = state.query || '';

  if (query.length === 0) {
    params.delete(QUERY_PARAM);
    params.delete(QUERY_POINTER_PARAM);
  } else if (encodeURIComponent(query).length <= MAX_ENCODED_QUERY_LENGTH) {
    params.set(QUERY_PARAM, query);
    params.delete(QUERY_POINTER_PARAM);
  } else {
    const pointer = writeSessionQuery(query);
    if (pointer) {
      params.delete(QUERY_PARAM);
      params.set(QUERY_POINTER_PARAM, pointer);
    } else {
      params.set(QUERY_PARAM, query.slice(0, 400));
      params.delete(QUERY_POINTER_PARAM);
    }
  }

  if (state.scope === 'authored') {
    params.delete(SCOPE_PARAM);
  } else {
    params.set(SCOPE_PARAM, state.scope);
  }

  params.set(SORT_PARAM, state.sort);

  const next = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', next);
};
