import type { ReaderState } from '../state';
import {
  getAuthorPreferences,
  getLoadFrom,
  getReadState,
  onSyncFieldApplied,
  type AuthorPreferences,
  type ReadState,
  type SyncFieldAppliedEvent,
} from '../utils/storage';

const ITEM_SELECTOR = '.pr-item[data-id]';
const AUTHOR_CONTROL_SELECTOR = '[data-action="author-up"][data-author], [data-action="author-down"][data-author]';
const PARSED_POSTED_AT_ATTR = 'prParsedPostedAtMs';
const MAX_PATCH_NODES_PER_FRAME = 50;
const PRUNE_INTERVAL_MS = 1_500;

interface IndexedItemEntry {
  element: HTMLElement;
  postedAtMs: number | null;
}

let installedState: ReaderState | null = null;
let disposeAppliedListener: (() => void) | null = null;
let domObserver: MutationObserver | null = null;
let rootObserver: MutationObserver | null = null;
let pendingAnimationFrame: number | null = null;
let pendingRootCheckFrame: number | null = null;
let observedRoot: HTMLElement | null = null;
let lastPruneAtMs = 0;

const itemIndexById = new Map<string, Set<IndexedItemEntry>>();
let itemEntryByElement = new WeakMap<HTMLElement, IndexedItemEntry>();
const authorControlsByName = new Map<string, Set<HTMLElement>>();
let authorNameByControl = new WeakMap<HTMLElement, string>();

const pendingReadItemIds = new Set<string>();
const pendingReadEntryOffsetById = new Map<string, number>();
const pendingAuthorControls = new Set<HTMLElement>();
let pendingUnreadCounterRefresh = false;

let lastReadSnapshot: ReadState = {};
let lastLoadFromSnapshot = '';
let lastAuthorPrefsSnapshot: AuthorPreferences = {};

const lastAppliedSequenceByField: Record<'read' | 'loadFrom' | 'authorPrefs', number> = {
  read: 0,
  loadFrom: 0,
  authorPrefs: 0,
};

const parseLoadFromMs = (value: string): number | null => {
  if (!value || value === '__LOAD_RECENT__' || !value.includes('T')) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parsePostedAtMs = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolvePostedAtMs = (element: HTMLElement): number | null => {
  const dataPostedAtMs = parsePostedAtMs(element.dataset.postedAtMs);
  if (dataPostedAtMs !== null) return dataPostedAtMs;

  const memoizedParsed = parsePostedAtMs(element.dataset[PARSED_POSTED_AT_ATTR]);
  if (memoizedParsed !== null) return memoizedParsed;

  const timeEl = element.querySelector<HTMLTimeElement>('time[datetime]');
  if (!timeEl) return null;
  const parsed = Date.parse(timeEl.getAttribute('datetime') || '');
  if (!Number.isFinite(parsed)) return null;
  const epoch = parsed;
  element.dataset[PARSED_POSTED_AT_ATTR] = String(epoch);
  return epoch;
};

const addItemEntry = (element: HTMLElement): void => {
  const id = element.dataset.id;
  if (!id) return;
  if (itemEntryByElement.has(element)) return;

  const entry: IndexedItemEntry = {
    element,
    postedAtMs: resolvePostedAtMs(element),
  };
  itemEntryByElement.set(element, entry);

  const bucket = itemIndexById.get(id) || new Set<IndexedItemEntry>();
  bucket.add(entry);
  itemIndexById.set(id, bucket);
};

const removeItemEntry = (element: HTMLElement): void => {
  const id = element.dataset.id;
  const entry = itemEntryByElement.get(element);
  if (!id || !entry) return;

  const bucket = itemIndexById.get(id);
  if (bucket) {
    bucket.delete(entry);
    if (bucket.size === 0) {
      itemIndexById.delete(id);
    }
  }
  itemEntryByElement.delete(element);
};

const addAuthorControl = (element: HTMLElement): void => {
  const author = element.dataset.author;
  if (!author) return;
  if (authorNameByControl.has(element)) return;

  authorNameByControl.set(element, author);
  const bucket = authorControlsByName.get(author) || new Set<HTMLElement>();
  bucket.add(element);
  authorControlsByName.set(author, bucket);
};

const removeAuthorControl = (element: HTMLElement): void => {
  const author = authorNameByControl.get(element);
  if (!author) return;
  const bucket = authorControlsByName.get(author);
  if (!bucket) return;
  bucket.delete(element);
  if (bucket.size === 0) {
    authorControlsByName.delete(author);
  }
  authorNameByControl.delete(element);
  pendingAuthorControls.delete(element);
};

const collectMatchingElements = (node: Node, selector: string): HTMLElement[] => {
  const matches: HTMLElement[] = [];
  if (node instanceof HTMLElement && node.matches(selector)) {
    matches.push(node);
  }
  if (node instanceof Element || node instanceof DocumentFragment) {
    matches.push(...Array.from(node.querySelectorAll<HTMLElement>(selector)));
  }
  return matches;
};

const indexNode = (node: Node, queuePatches = false): void => {
  let queuedReadPatch = false;
  const itemEls = collectMatchingElements(node, ITEM_SELECTOR);
  for (const itemEl of itemEls) {
    addItemEntry(itemEl);
    if (queuePatches) {
      const id = itemEl.dataset.id;
      if (id) {
        pendingReadItemIds.add(id);
        queuedReadPatch = true;
      }
    }
  }

  let queuedAuthorPatch = false;
  const authorControls = collectMatchingElements(node, AUTHOR_CONTROL_SELECTOR);
  for (const control of authorControls) {
    addAuthorControl(control);
    if (queuePatches) {
      pendingAuthorControls.add(control);
      queuedAuthorPatch = true;
    }
  }

  if (queuePatches && (queuedReadPatch || queuedAuthorPatch)) {
    if (queuedReadPatch) {
      pendingUnreadCounterRefresh = true;
    }
    schedulePatchFrame();
  }
};

const deindexNode = (node: Node): void => {
  const itemEls = collectMatchingElements(node, ITEM_SELECTOR);
  for (const itemEl of itemEls) {
    removeItemEntry(itemEl);
  }
  const authorControls = collectMatchingElements(node, AUTHOR_CONTROL_SELECTOR);
  for (const control of authorControls) {
    removeAuthorControl(control);
  }
};

const pruneDetachedEntries = (): void => {
  for (const [id, bucket] of itemIndexById.entries()) {
    for (const entry of Array.from(bucket)) {
      if (!entry.element.isConnected) {
        bucket.delete(entry);
        itemEntryByElement.delete(entry.element);
      }
    }
    if (bucket.size === 0) {
      itemIndexById.delete(id);
    }
  }
  for (const [author, bucket] of authorControlsByName.entries()) {
    for (const element of Array.from(bucket)) {
      if (!element.isConnected) {
        bucket.delete(element);
        authorNameByControl.delete(element);
        pendingAuthorControls.delete(element);
      }
    }
    if (bucket.size === 0) {
      authorControlsByName.delete(author);
    }
  }
};

const queueIndexedItemIds = (): void => {
  for (const id of itemIndexById.keys()) {
    pendingReadItemIds.add(id);
  }
};

const queueAllAuthorControls = (): void => {
  for (const controls of authorControlsByName.values()) {
    for (const control of controls) {
      pendingAuthorControls.add(control);
    }
  }
};

const queueReadDelta = (): void => {
  const nextRead = getReadState();
  for (const id of Object.keys(lastReadSnapshot)) {
    if (nextRead[id] !== 1) {
      pendingReadItemIds.add(id);
    }
  }
  for (const id of Object.keys(nextRead)) {
    if (lastReadSnapshot[id] !== 1) {
      pendingReadItemIds.add(id);
    }
  }
  lastReadSnapshot = nextRead;
  pendingUnreadCounterRefresh = true;
};

const queueLoadFromDelta = (): void => {
  const nextLoadFrom = getLoadFrom();
  const prevMs = parseLoadFromMs(lastLoadFromSnapshot);
  const nextMs = parseLoadFromMs(nextLoadFrom);
  lastLoadFromSnapshot = nextLoadFrom;

  if (prevMs === nextMs) return;

  if (prevMs === null || nextMs === null) {
    queueIndexedItemIds();
    pendingUnreadCounterRefresh = true;
    return;
  }

  const lower = Math.min(prevMs, nextMs);
  const upper = Math.max(prevMs, nextMs);
  for (const [id, entries] of itemIndexById.entries()) {
    let inRange = false;
    for (const entry of entries) {
      if (entry.postedAtMs === null && entry.element.isConnected) {
        entry.postedAtMs = resolvePostedAtMs(entry.element);
      }
      const postedAtMs = entry.postedAtMs;
      if (postedAtMs === null) continue;
      if (postedAtMs >= lower && postedAtMs <= upper) {
        inRange = true;
        break;
      }
    }
    if (inRange) {
      pendingReadItemIds.add(id);
    }
  }
  pendingUnreadCounterRefresh = true;
};

const queueAuthorPrefsDelta = (): void => {
  const nextPrefs = getAuthorPreferences();
  const authors = new Set([
    ...Object.keys(lastAuthorPrefsSnapshot),
    ...Object.keys(nextPrefs),
  ]);
  for (const author of authors) {
    const prevValue = lastAuthorPrefsSnapshot[author] ?? 0;
    const nextValue = nextPrefs[author] ?? 0;
    if (prevValue !== nextValue) {
      const controls = authorControlsByName.get(author);
      if (!controls) continue;
      for (const control of controls) {
        pendingAuthorControls.add(control);
      }
    }
  }
  lastAuthorPrefsSnapshot = nextPrefs;
};

const refreshUnreadCounter = (): void => {
  const unreadEl = document.getElementById('pr-unread-count');
  const root = document.getElementById('power-reader-root');
  if (!unreadEl || !root) return;
  const unreadCount = root.querySelectorAll('.pr-item:not(.read):not(.context)').length;
  if (unreadEl.textContent !== String(unreadCount)) {
    unreadEl.textContent = String(unreadCount);
  }
};

const applyReadClassPatch = (
  id: string,
  entry: IndexedItemEntry,
  readState: ReadState,
  loadFromMs: number | null
): void => {
  const { element } = entry;
  if (!element.isConnected) return;

  if (entry.postedAtMs === null) {
    entry.postedAtMs = resolvePostedAtMs(element);
  }

  if (element.classList.contains('context') || element.dataset.placeholder === '1') {
    element.classList.add('read');
    return;
  }

  const explicitRead = readState[id] === 1;
  const implicitRead = loadFromMs !== null && entry.postedAtMs !== null && entry.postedAtMs < loadFromMs;
  const shouldBeRead = explicitRead || implicitRead;

  if (shouldBeRead) {
    element.classList.add('read');
    return;
  }

  // Preserve read-state when timestamps are unavailable to avoid unstable downgrades.
  if (entry.postedAtMs === null) {
    return;
  }
  element.classList.remove('read');
};

const processPendingReadItems = (budget: number): number => {
  if (pendingReadItemIds.size === 0) return budget;

  const readState = getReadState();
  const loadFromMs = parseLoadFromMs(getLoadFrom());

  for (const id of Array.from(pendingReadItemIds)) {
    if (budget <= 0) break;
    const entries = itemIndexById.get(id);
    if (!entries || entries.size === 0) {
      pendingReadItemIds.delete(id);
      pendingReadEntryOffsetById.delete(id);
      continue;
    }

    const entriesArray = Array.from(entries);
    let startIndex = pendingReadEntryOffsetById.get(id) ?? 0;
    if (startIndex >= entriesArray.length) {
      startIndex = 0;
    }

    let index = startIndex;
    for (; index < entriesArray.length; index += 1) {
      if (budget <= 0) break;
      applyReadClassPatch(id, entriesArray[index], readState, loadFromMs);
      budget -= 1;
    }

    if (index >= entriesArray.length) {
      pendingReadItemIds.delete(id);
      pendingReadEntryOffsetById.delete(id);
      continue;
    }

    pendingReadEntryOffsetById.set(id, index);
    // Move partially processed IDs to the end so large buckets don't starve others.
    pendingReadItemIds.delete(id);
    pendingReadItemIds.add(id);
  }

  return budget;
};

const resolveAuthorPreferenceForControl = (
  control: HTMLElement,
  author: string,
  authorPrefs: AuthorPreferences
): number => {
  const explicit = authorPrefs[author];
  if (explicit === -1 || explicit === 1) return explicit;
  if (!installedState) return 0;

  const owner = control.closest('.pr-comment-meta, .pr-post-meta, .pr-post-header, .pr-sticky-header-content, .pr-item');
  const authorLink = owner?.querySelector<HTMLElement>('.pr-author[data-author-id]');
  const authorId = authorLink?.getAttribute('data-author-id') || '';
  if (authorId && installedState.subscribedAuthorIds.has(authorId)) {
    return 1;
  }
  return 0;
};

const processPendingAuthorPatches = (budget: number): number => {
  if (pendingAuthorControls.size === 0) return budget;
  const authorPrefs = getAuthorPreferences();

  for (const control of Array.from(pendingAuthorControls)) {
    if (budget <= 0) break;
    pendingAuthorControls.delete(control);
    if (!control.isConnected) continue;
    const author = authorNameByControl.get(control) || control.dataset.author;
    if (!author) continue;
    const resolvedPreference = resolveAuthorPreferenceForControl(control, author, authorPrefs);
    if (control.dataset.action === 'author-up') {
      control.classList.toggle('active-up', resolvedPreference > 0);
    } else if (control.dataset.action === 'author-down') {
      control.classList.toggle('active-down', resolvedPreference < 0);
    }
    budget -= 1;
  }

  return budget;
};

const flushPatchQueues = (): void => {
  pendingAnimationFrame = null;
  if (Date.now() - lastPruneAtMs >= PRUNE_INTERVAL_MS) {
    pruneDetachedEntries();
    lastPruneAtMs = Date.now();
  }

  let budget = MAX_PATCH_NODES_PER_FRAME;
  budget = processPendingReadItems(budget);
  budget = processPendingAuthorPatches(budget);

  if (pendingUnreadCounterRefresh && pendingReadItemIds.size === 0) {
    refreshUnreadCounter();
    pendingUnreadCounterRefresh = false;
  }

  if (pendingReadItemIds.size > 0 || pendingAuthorControls.size > 0 || pendingUnreadCounterRefresh) {
    schedulePatchFrame();
  }
};

const schedulePatchFrame = (): void => {
  if (pendingAnimationFrame !== null) return;
  pendingAnimationFrame = window.requestAnimationFrame(flushPatchQueues);
};

const handleAppliedSyncField = (event: SyncFieldAppliedEvent): void => {
  const priorSequence = lastAppliedSequenceByField[event.field];
  if (event.sequence <= priorSequence) return;
  lastAppliedSequenceByField[event.field] = event.sequence;

  if (!installedState) return;
  if (installedState.isArchiveMode) return;

  if (event.field === 'read') {
    queueReadDelta();
  } else if (event.field === 'loadFrom') {
    queueLoadFromDelta();
  } else if (event.field === 'authorPrefs') {
    queueAuthorPrefsDelta();
  }
  schedulePatchFrame();
};

const attachDomIndexingToRoot = (root: HTMLElement): void => {
  observedRoot = root;
  resetIndexedDomState();

  indexNode(root);
  queueIndexedItemIds();
  queueAllAuthorControls();
  pendingUnreadCounterRefresh = true;
  schedulePatchFrame();

  if (domObserver) {
    domObserver.disconnect();
  }
  domObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const added of mutation.addedNodes) {
        indexNode(added, true);
      }
      for (const removed of mutation.removedNodes) {
        deindexNode(removed);
      }
    }
  });
  domObserver.observe(root, { childList: true, subtree: true });
};

const resetIndexedDomState = (): void => {
  itemIndexById.clear();
  pendingReadItemIds.clear();
  pendingReadEntryOffsetById.clear();
  itemEntryByElement = new WeakMap<HTMLElement, IndexedItemEntry>();
  authorControlsByName.clear();
  pendingAuthorControls.clear();
  authorNameByControl = new WeakMap<HTMLElement, string>();
  pendingUnreadCounterRefresh = false;
  if (pendingRootCheckFrame !== null) {
    window.cancelAnimationFrame(pendingRootCheckFrame);
    pendingRootCheckFrame = null;
  }
  if (pendingAnimationFrame !== null) {
    window.cancelAnimationFrame(pendingAnimationFrame);
    pendingAnimationFrame = null;
  }
};

const scheduleRootAttachCheck = (): void => {
  if (pendingRootCheckFrame !== null) return;
  pendingRootCheckFrame = window.requestAnimationFrame(() => {
    pendingRootCheckFrame = null;
    const root = document.getElementById('power-reader-root');
    if (root === observedRoot) return;
    if (!root) {
      observedRoot = null;
      if (domObserver) {
        domObserver.disconnect();
        domObserver = null;
      }
      resetIndexedDomState();
      return;
    }
    attachDomIndexingToRoot(root);
  });
};

const nodeAddsPowerReaderRoot = (node: Node): boolean =>
  node instanceof Element &&
  (node.id === 'power-reader-root' || node.querySelector('#power-reader-root') !== null);

const mutationAddsPowerReaderRoot = (mutation: MutationRecord): boolean =>
  Array.from(mutation.addedNodes).some(nodeAddsPowerReaderRoot);

const mutationRemovesObservedRoot = (mutation: MutationRecord): boolean => {
  if (!observedRoot) return false;
  return Array.from(mutation.removedNodes).some(
    (node) => node === observedRoot || (node instanceof Element && node.contains(observedRoot))
  );
};

const ensureRootObserver = (): void => {
  if (rootObserver) return;
  rootObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (observedRoot && mutation.target instanceof Node && observedRoot.contains(mutation.target)) {
        continue;
      }
      if ((observedRoot && !observedRoot.isConnected) || mutationRemovesObservedRoot(mutation) || mutationAddsPowerReaderRoot(mutation)) {
        scheduleRootAttachCheck();
        return;
      }
    }
  });
  rootObserver.observe(document.documentElement, { childList: true, subtree: true });
};

const startDomIndexing = (): void => {
  ensureRootObserver();
  const root = document.getElementById('power-reader-root');
  if (!root) return;
  attachDomIndexingToRoot(root);
};

export const setupSyncUiConsistencyLayer = (state: ReaderState): void => {
  if (installedState === state && disposeAppliedListener) {
    return;
  }
  teardownSyncUiConsistencyLayer();

  installedState = state;
  lastReadSnapshot = getReadState();
  lastLoadFromSnapshot = getLoadFrom();
  lastAuthorPrefsSnapshot = getAuthorPreferences();
  lastAppliedSequenceByField.read = 0;
  lastAppliedSequenceByField.loadFrom = 0;
  lastAppliedSequenceByField.authorPrefs = 0;
  lastPruneAtMs = Date.now();

  startDomIndexing();
  disposeAppliedListener = onSyncFieldApplied(handleAppliedSyncField);
};

export const teardownSyncUiConsistencyLayer = (): void => {
  if (disposeAppliedListener) {
    disposeAppliedListener();
    disposeAppliedListener = null;
  }
  if (domObserver) {
    domObserver.disconnect();
    domObserver = null;
  }
  if (rootObserver) {
    rootObserver.disconnect();
    rootObserver = null;
  }
  if (pendingRootCheckFrame !== null) {
    window.cancelAnimationFrame(pendingRootCheckFrame);
    pendingRootCheckFrame = null;
  }
  if (pendingAnimationFrame !== null) {
    window.cancelAnimationFrame(pendingAnimationFrame);
    pendingAnimationFrame = null;
  }
  resetIndexedDomState();
  observedRoot = null;
  lastPruneAtMs = 0;
  installedState = null;
};
