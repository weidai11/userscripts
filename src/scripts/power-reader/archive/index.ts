
import { executeTakeover, rebuildDocument, signalReady } from '../takeover';
import { initializeReactions } from '../utils/reactions';
import { Logger } from '../utils/logger';
import { createInitialArchiveState, type ArchiveSortBy, type ArchiveViewMode, isThreadMode } from './state';
import { loadAllContextualItems, loadArchiveData, saveArchiveData } from './storage';
import { fetchUserId, fetchUserPosts, fetchUserComments } from './loader';
import { escapeHtml } from '../utils/rendering';
import { renderArchiveFeed, updateRenderLimit, incrementRenderLimit, resetRenderLimit, renderCardItem, renderIndexItem } from './render';
import { setUIHost } from '../render/uiHost';
import { ArchiveUIHost } from './uiHost';
import { attachEventListeners } from '../events/index';
import { initAIStudioListener } from '../features/aiStudioPopup';
import { setupExternalLinks } from '../features/externalLinks';
import { setupInlineReactions } from '../features/inlineReactions';
import { setupLinkPreviews } from '../features/linkPreviews';
import { initPreviewSystem } from '../utils/preview';
import { refreshPostActionButtons } from '../utils/dom';
import { ArchiveSearchRuntime } from './search/engine';
import { parseArchiveUrlState, writeArchiveUrlState } from './search/urlState';
import type {
  ArchiveItem,
  ArchiveSearchScope,
  ArchiveSearchSortMode,
  SearchDiagnostics
} from './search/types';

declare const GM_getValue: (key: string, defaultValue?: any) => any;
declare const GM_setValue: (key: string, value: any) => void;
declare const __APP_VERSION__: string;

// Storage keys for error handling preferences
const AUTO_RETRY_KEY = 'power-reader-archive-auto-retry';
const MAX_AUTO_RETRIES = 50;
const INITIAL_BACKOFF_MS = 2000;

const PAGE_SIZE = 10000;
const SEARCH_DEBOUNCE_MS = 180;

interface SyncErrorState {
  isRetrying: boolean;
  retryCount: number;
  abortController: AbortController | null;
}

/**
 * Initialize the User Archive view
 */
export const initArchive = async (username: string): Promise<void> => {
  Logger.info(`Initializing User Archive for: ${username}`);

  try {
    resetRenderLimit();
    executeTakeover();
    await initializeReactions();
    rebuildDocument();
    initPreviewSystem();

    const state = createInitialArchiveState(username);
    const root = document.getElementById('power-reader-root');
    if (!root) return;

    // Inject styles for archive specific layouts - Idempotent check
    if (!document.getElementById('pr-archive-styles')) {
      const style = document.createElement('style');
      style.id = 'pr-archive-styles';
      style.textContent = `
        .pr-archive-toolbar {
            display: flex;
            gap: 10px;
            margin: 10px 0;
            flex-wrap: wrap;
        }
        .pr-archive-toolbar select {
            padding: 8px;
            border-radius: 4px;
            border: 1px solid var(--pr-border-color);
            background: var(--pr-bg-secondary);
            color: var(--pr-text-primary);
        }
        .pr-archive-search-status {
            margin-top: 8px;
            font-size: 0.9em;
            color: var(--pr-text-secondary);
        }
        .pr-archive-search-status.warning {
            color: #f6c453;
        }
        .pr-archive-search-status.error {
            color: #ff6b6b;
        }
        .pr-search-retry-btn {
            margin-left: 8px;
            padding: 2px 8px;
            font-size: 0.85em;
            cursor: pointer;
            background: var(--pr-bg-secondary);
            border: 1px solid var(--pr-border-color);
            border-radius: 4px;
            color: var(--pr-text-primary);
        }
        .pr-search-retry-btn:hover {
            background: var(--pr-bg-hover, #333);
        }
        .pr-archive-index-item {
            display: flex;
            align-items: center;
            padding: 8px;
            border-bottom: 1px solid var(--pr-border-subtle);
            color: var(--pr-text-primary);
            text-decoration: none;
        }
        .pr-archive-index-item:hover {
            background: var(--pr-bg-secondary);
        }
        .pr-index-score {
            width: 50px;
            text-align: right;
            margin-right: 15px;
            font-weight: bold;
            color: var(--pr-text-secondary);
        }
        .pr-index-title {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .pr-index-meta {
            font-size: 0.85em;
            color: var(--pr-text-tertiary);
            margin-left: 10px;
            min-width: 120px;
            text-align: right;
        }
        
        /* Thread View Styles - now handled mostly by PostGroup, but shell styles might remain useful */
        .pr-thread-wrapper {
             background: var(--pr-bg-primary);
        }
        
        .pr-status.status-error {
            color: #ff6b6b;
            font-weight: bold;
        }
        .pr-status.status-syncing::after {
            content: '...';
            display: inline-block;
            width: 12px;
            animation: pr-dots 1.5s steps(4, end) infinite;
        }
        @keyframes pr-dots {
            0%, 20% { content: ''; }
            40% { content: '.'; }
            60% { content: '..'; }
            80% { content: '...'; }
        }
        
        /* Error UI Styles */
        .pr-archive-error {
            background: var(--pr-bg-secondary);
            border: 1px solid #ff6b6b;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .pr-archive-error-title {
            color: #ff6b6b;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .pr-archive-error-message {
            color: var(--pr-text-secondary);
            margin-bottom: 15px;
            font-family: monospace;
            font-size: 0.9em;
        }
        .pr-archive-error-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 15px;
        }
        .pr-archive-error-options {
            border-top: 1px solid var(--pr-border-subtle);
            padding-top: 15px;
            margin-top: 15px;
        }
        .pr-archive-error-options label {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            color: var(--pr-text-secondary);
        }
        .pr-archive-error-options input[type="checkbox"] {
            cursor: pointer;
        }
        .pr-archive-retry-indicator {
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--pr-text-secondary);
            font-size: 0.9em;
        }
        .pr-archive-retry-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid var(--pr-border-color);
            border-top-color: var(--pr-text-primary);
            border-radius: 50%;
            animation: pr-spin 1s linear infinite;
        }
        @keyframes pr-spin {
            to { transform: rotate(360deg); }
        }
        .pr-archive-cancel-btn {
            background: transparent;
            border: 1px solid var(--pr-border-color);
            color: var(--pr-text-secondary);
            padding: 4px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85em;
        }
        .pr-archive-cancel-btn:hover {
            background: var(--pr-bg-secondary);
        }
        
        /* Performance optimization for large lists */
        .pr-archive-item {
            content-visibility: auto;
            contain-intrinsic-size: 0 300px;
        }
        
        .pr-context-placeholder {
            opacity: 0.7;
            border-left: 2px solid #555;
            padding-left: 8px;
        }
        
        /* Render limit dialog */
        .pr-archive-render-dialog {
            background: var(--pr-bg-secondary);
            border: 2px solid var(--pr-border-color);
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            max-width: 500px;
        }
        .pr-archive-render-dialog h3 {
            margin-top: 0;
            color: var(--pr-text-primary);
        }
        .pr-archive-render-dialog p {
            color: var(--pr-text-secondary);
            margin-bottom: 15px;
        }
        .pr-archive-render-dialog input[type="number"] {
            width: 120px;
            padding: 8px;
            border: 1px solid var(--pr-border-color);
            border-radius: 4px;
            background: var(--pr-bg-primary);
            color: var(--pr-text-primary);
            font-size: 1em;
        }
        .pr-archive-render-dialog .pr-dialog-actions {
            margin-top: 15px;
            display: flex;
            gap: 10px;
        }
    `;
      document.head.appendChild(style);
    }

    root.innerHTML = `
    <div class="pr-header">
      <h1>User Archive: ${escapeHtml(username)} <small style="font-size: 0.6em; color: #888;">v${__APP_VERSION__}</small></h1>
      <div class="pr-status" id="archive-status">Checking local database...</div>
    </div>
    
    <div class="pr-archive-container" style="padding: 10px; background: var(--pr-bg-secondary); border-radius: 8px;">
        <div class="pr-archive-toolbar">
            <input type="text" id="archive-search" placeholder="Search archive (structured query: author:, date:, score:, /regex/)" class="pr-input" style="flex: 2; min-width: 260px;">
            <select id="archive-scope">
                <option value="authored">Scope: Authored</option>
                <option value="all">Scope: Authored + Context</option>
            </select>
            <select id="archive-sort">
                <option value="relevance">Relevance</option>
                <option value="date">Date (Newest)</option>
                <option value="date-asc">Date (Oldest)</option>
                <option value="score">Karma (High-Low)</option>
                <option value="score-asc">Karma (Low-High)</option>
                <option value="replyTo">Reply To (Name)</option>
            </select>
             <select id="archive-view">
                <option value="card">Card View</option>
                <option value="index">Index View</option>
                <option value="thread-full">Thread View (Full Context)</option>
                <option value="thread-placeholder">Thread View (Placeholder)</option>
            </select>
            <button id="archive-resync" class="pr-button" title="Force re-download all data">Resync</button>
        </div>
        <div id="archive-search-status" class="pr-archive-search-status">Structured query enabled.</div>
    </div>

    <div id="archive-error-container" style="display: none;"></div>
    
    <div id="archive-dashboard" class="pr-setup" style="max-width: 800px; display: none;">
      Loading archive data...
    </div>
    <div id="archive-feed" style="margin-top: 20px"></div>
    <div id="archive-load-more" style="text-align: center; margin: 20px; display: none;">
        <button class="pr-button">Load More</button>
    </div>
  `;

    const statusEl = document.getElementById('archive-status');
    const dashboardEl = document.getElementById('archive-dashboard');
    const feedEl = document.getElementById('archive-feed');
    const loadMoreBtn = document.getElementById('archive-load-more');
    const searchInput = document.getElementById('archive-search') as HTMLInputElement;
    const scopeSelect = document.getElementById('archive-scope') as HTMLSelectElement;
    const sortSelect = document.getElementById('archive-sort') as HTMLSelectElement;
    const viewSelect = document.getElementById('archive-view') as HTMLSelectElement;
    const resyncBtn = document.getElementById('archive-resync');
    const errorContainer = document.getElementById('archive-error-container');
    const searchStatusEl = document.getElementById('archive-search-status');
    let statusBaseMessage = 'Checking local database...';
    let statusSearchResultCount: number | null = null;

    const renderTopStatusLine = (): void => {
      if (!statusEl) return;

      if (statusSearchResultCount === null) {
        statusEl.textContent = statusBaseMessage;
        return;
      }

      const resultLabel = `${statusSearchResultCount.toLocaleString()} search result${statusSearchResultCount === 1 ? '' : 's'}`;
      statusEl.textContent = statusBaseMessage
        ? `${statusBaseMessage} | ${resultLabel}`
        : resultLabel;
    };

    const setStatusBaseMessage = (msg: string, isError = false, isSyncing = false): void => {
      statusBaseMessage = msg;
      if (!statusEl) return;
      statusEl.classList.toggle('status-error', isError);
      statusEl.classList.toggle('status-syncing', isSyncing);
      renderTopStatusLine();
    };

    const setStatusSearchResultCount = (count: number | null): void => {
      statusSearchResultCount = count;
      renderTopStatusLine();
    };

    renderTopStatusLine();

    let activeItems = state.items;
    const searchRuntime = new ArchiveSearchRuntime();
    const urlState = parseArchiveUrlState();
    let persistedContextItems: ArchiveItem[] = [];
    let useDedicatedScopeParam = urlState.scopeFromUrl;
    let searchDispatchTimer: number | null = null;
    let activeQueryRequestId = 0;
    let activeItemById = new Map<string, ArchiveItem>();
    let authoredIndexItemsRef: readonly ArchiveItem[] | null = null;
    let authoredIndexCanonicalRevision = -1;
    let authoredItemsVersion = 0;
    let contextSearchItemsCache:
      | {
        persistedRef: readonly ArchiveItem[];
        authoredVersion: number;
        readerRevision: number;
        items: ArchiveItem[];
      }
      | null = null;
    const LARGE_DATASET_THRESHOLD = (window as any).__PR_ARCHIVE_LARGE_THRESHOLD || 10000;
    let pendingRenderCount: number | null = null;

    searchInput.value = urlState.query;
    sortSelect.value = urlState.sort;
    if (!sortSelect.value) sortSelect.value = 'date';
    scopeSelect.value = urlState.scope;
    if (!scopeSelect.value) scopeSelect.value = 'authored';
    state.sortBy = sortSelect.value as ArchiveSortBy;

    const runPostRenderHooks = () => {
      setupLinkPreviews(uiHost.getReaderState().comments);

      // Post-action buttons can be introduced by thread renders and index expand-in-place cards.
      const posts = feedEl!.querySelectorAll('.pr-post');
      posts.forEach(p => {
        const pid = p.getAttribute('data-id') || p.getAttribute('data-post-id');
        if (pid) refreshPostActionButtons(pid);
      });
    };

    const syncAuthoredSearchIndex = (): void => {
      const canonicalRevision = uiHost.getCanonicalStateRevision();
      if (authoredIndexItemsRef === state.items && authoredIndexCanonicalRevision === canonicalRevision) return;
      searchRuntime.setAuthoredItems(state.items, canonicalRevision);
      authoredIndexItemsRef = state.items;
      authoredIndexCanonicalRevision = canonicalRevision;
      authoredItemsVersion += 1;
      contextSearchItemsCache = null;
    };

    const collectContextSearchItems = (): ArchiveItem[] => {
      const readerRevision = uiHost.getSearchStateRevision();
      if (
        contextSearchItemsCache &&
        contextSearchItemsCache.persistedRef === persistedContextItems &&
        contextSearchItemsCache.authoredVersion === authoredItemsVersion &&
        contextSearchItemsCache.readerRevision === readerRevision
      ) {
        return contextSearchItemsCache.items;
      }

      const merged = new Map<string, ArchiveItem>();
      for (const item of persistedContextItems) {
        if (state.itemById.has(item._id)) continue;
        merged.set(item._id, item);
      }

      const readerState = uiHost.getReaderState();
      for (const post of readerState.posts) {
        if (state.itemById.has(post._id)) continue;
        merged.set(post._id, post);
      }
      for (const comment of readerState.comments) {
        if (state.itemById.has(comment._id)) continue;
        merged.set(comment._id, comment);
      }

      const items = Array.from(merged.values());
      contextSearchItemsCache = {
        persistedRef: persistedContextItems,
        authoredVersion: authoredItemsVersion,
        readerRevision,
        items
      };
      return items;
    };

    const updateSearchStatus = (
      diagnostics: SearchDiagnostics,
      resolvedScope: ArchiveSearchScope,
      contextItemCount: number,
      sortMode: ArchiveSearchSortMode
    ) => {
      if (!searchStatusEl) return;

      const messages: string[] = [];
      if (resolvedScope === 'all') {
        messages.push(`Searching authored + cached context (${contextItemCount} items)`);
        if (contextItemCount === 0) {
          messages.push('Context cache may be incomplete');
        }
        if (sortMode === 'replyTo') {
          messages.push('replyTo ordering is computed over mixed authored/context semantics');
        }
      }
      if (diagnostics.partialResults) {
        messages.push(`Partial results (${diagnostics.tookMs}ms budget hit)`);
      }
      if (diagnostics.warnings.length > 0) {
        messages.push(diagnostics.warnings[0].message);
      }

      searchStatusEl.textContent = '';
      searchStatusEl.appendChild(document.createTextNode(messages.join(' | ') || 'Structured query enabled.'));

      if (diagnostics.partialResults) {
        const retryBtn = document.createElement('button');
        retryBtn.className = 'pr-search-retry-btn';
        retryBtn.textContent = 'Run without time limit';
        retryBtn.addEventListener('click', () => {
          refreshView(0);
        });
        searchStatusEl.appendChild(retryBtn);
      }

      searchStatusEl.classList.remove('warning', 'error');
      if (diagnostics.parseState === 'invalid') {
        searchStatusEl.classList.add('error');
      } else if (diagnostics.parseState === 'warning' || diagnostics.degradedMode || diagnostics.partialResults) {
        searchStatusEl.classList.add('warning');
      }
    };

    const ensureSearchResultContextLoaded = (items: readonly ArchiveItem[]): void => {
      const contextComments: ArchiveItem[] = [];
      const contextPosts: ArchiveItem[] = [];
      const readerState = uiHost.getReaderState();

      for (const item of items) {
        if (state.itemById.has(item._id)) continue;
        if ('title' in item) {
          if (!readerState.postById.has(item._id)) {
            contextPosts.push(item);
          }
          continue;
        }
        if (!readerState.commentById.has(item._id)) {
          contextComments.push(item);
        }
      }

      if (contextComments.length > 0) {
        uiHost.mergeComments(contextComments as any, true);
      }
      if (contextPosts.length > 0) {
        for (const post of contextPosts) {
          uiHost.upsertPost(post as any, false);
        }
      }
    };

    const refreshView = async (budgetMs?: number) => {
      const requestId = ++activeQueryRequestId;
      const sortMode = sortSelect.value as ArchiveSearchSortMode;

      syncAuthoredSearchIndex();
      const contextItems = collectContextSearchItems();
      searchRuntime.setContextItems(contextItems);
      const scopeParam = useDedicatedScopeParam ? (scopeSelect.value as ArchiveSearchScope) : undefined;
      const result = searchRuntime.runSearch({
        query: searchInput.value,
        scopeParam,
        sortMode,
        limit: state.items.length + contextItems.length + 5,
        ...(budgetMs !== undefined ? { budgetMs } : {})
      });

      if (requestId !== activeQueryRequestId) {
        return;
      }

      activeItems = result.items;
      activeItemById = new Map(activeItems.map(item => [item._id, item]));
      ensureSearchResultContextLoaded(activeItems);
      if (!useDedicatedScopeParam && result.resolvedScope !== 'authored') {
        useDedicatedScopeParam = true;
      }
      scopeSelect.value = result.resolvedScope;
      writeArchiveUrlState({
        query: result.canonicalQuery,
        scope: result.resolvedScope,
        sort: sortMode
      });
      setStatusSearchResultCount(result.total);
      updateSearchStatus(result.diagnostics, result.resolvedScope, contextItems.length, sortMode);

      // 3. Check if we need to ask user about render count for large datasets
      const totalItems = activeItems.length;
      if (totalItems >= LARGE_DATASET_THRESHOLD && pendingRenderCount === null) {
        // Show dialog to ask user how many to render
        showRenderCountDialog(totalItems, async (count: number) => {
          pendingRenderCount = count;
          updateRenderLimit(count);
          // Render!
          await renderArchiveFeed(feedEl!, activeItems, state.viewMode, uiHost.getReaderState(), state.sortBy);
          runPostRenderHooks();
        });
        return;
      }

      // 4. Render
      // Only override render limit for large datasets where user explicitly chose a count
      // For normal datasets, keep the default limit to enable pagination
      if (pendingRenderCount !== null) {
        updateRenderLimit(pendingRenderCount);
      }

      // Use renderArchiveFeed directly with current activeItems (view) and host's readerState (data)
      // [WS3-FIX] Pass sortBy for thread view group-level sorting
      await renderArchiveFeed(feedEl!, activeItems, state.viewMode, uiHost.getReaderState(), state.sortBy);

      runPostRenderHooks();
    };

    const uiHost = new ArchiveUIHost(state, feedEl, refreshView);
    setUIHost(uiHost);

    // Attach standard event listeners using the host's reader state
    attachEventListeners(uiHost.getReaderState());
    initAIStudioListener(uiHost.getReaderState());

    // Sticky header currently depends on main-reader singleton state (`getState()`).
    // Do not enable it in archive mode until it is wired to archive-local ReaderState.
    setupExternalLinks();
    setupInlineReactions(uiHost.getReaderState());

    const syncErrorState: SyncErrorState = {
      isRetrying: false,
      retryCount: 0,
      abortController: null
    };

    // Helper to batch updates to map
    const updateItemMap = (items: ArchiveItem[]) => {
      items.forEach(i => state.itemById.set(i._id, i));
      syncAuthoredSearchIndex();
      contextSearchItemsCache = null;

      // Update UI Host when we have new items
      // We trigger a re-sync of reader state
      // This is a bit brute-force but ensures consistency
      uiHost.rerenderAll(); // This rebuilds ReaderState from ArchiveState (and calls refreshView via callback)
    };

    /**
     * Show dialog asking user how many items to render for large datasets
     */
    const showRenderCountDialog = (totalCount: number, onConfirm: (count: number) => void) => {
      if (!feedEl) return;

      feedEl.innerHTML = `
        <div class="pr-archive-render-dialog">
          <h3>📊 Large Dataset Detected</h3>
          <p>This archive contains <strong>${totalCount.toLocaleString()}</strong> items. Rendering all at once may impact browser performance.</p>
          <p>How many items would you like to render initially?</p>
          <div>
            <input type="number" id="render-count-input" value="${Math.min(1000, totalCount)}" 
                   min="1" max="${totalCount}" step="100">
            <span style="margin-left: 10px; color: var(--pr-text-secondary);">/ ${totalCount.toLocaleString()} total</span>
          </div>
          <div class="pr-dialog-actions">
            <button id="render-confirm-btn" class="pr-button">Render Selected</button>
            <button id="render-all-btn" class="pr-button">Render All (${totalCount.toLocaleString()})</button>
          </div>
          <p style="font-size: 0.85em; color: var(--pr-text-tertiary); margin-top: 10px;">
            💡 Tip: Use the "Load More" button to view additional items after initial render.
          </p>
        </div>
      `;

      const confirmBtn = document.getElementById('render-confirm-btn');
      const renderAllBtn = document.getElementById('render-all-btn');
      const input = document.getElementById('render-count-input') as HTMLInputElement;

      confirmBtn?.addEventListener('click', () => {
        const count = parseInt(input?.value || '1000', 10);
        onConfirm(Math.min(Math.max(1, count), totalCount));
      });

      renderAllBtn?.addEventListener('click', () => {
        onConfirm(totalCount);
      });
    };

    // Event Listeners
    const scheduleSearchRefresh = () => {
      if (searchDispatchTimer) {
        window.clearTimeout(searchDispatchTimer);
      }
      searchDispatchTimer = window.setTimeout(() => {
        void refreshView();
      }, SEARCH_DEBOUNCE_MS);
    };

    searchInput?.addEventListener('input', () => {
      scheduleSearchRefresh();
    });

    searchInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        if (searchDispatchTimer) {
          window.clearTimeout(searchDispatchTimer);
          searchDispatchTimer = null;
        }
        void refreshView();
      }
    });

    scopeSelect?.addEventListener('change', () => {
      useDedicatedScopeParam = true;
      void refreshView();
    });

    sortSelect?.addEventListener('change', () => {
      state.sortBy = sortSelect.value as ArchiveSortBy;
      void refreshView();
    });

    viewSelect?.addEventListener('change', () => {
      state.viewMode = viewSelect.value as ArchiveViewMode;

      // [PR-SORT-04] Disable "Reply To" sort in Thread View as it organizes by Post
      const replyToOption = sortSelect.querySelector('option[value="replyTo"]') as HTMLOptionElement;
      const relevanceOption = sortSelect.querySelector('option[value="relevance"]') as HTMLOptionElement;
      if (replyToOption) {
        if (isThreadMode(state.viewMode)) {
          replyToOption.disabled = true;
          if (relevanceOption) relevanceOption.disabled = true;
          if (state.sortBy === 'replyTo' || state.sortBy === 'relevance') {
            state.sortBy = 'date';
            sortSelect.value = 'date';
          }
        } else {
          replyToOption.disabled = false;
          if (relevanceOption) relevanceOption.disabled = false;
        }
      }

      void refreshView();
    });

    // Setup Load More
    loadMoreBtn?.querySelector('button')?.addEventListener('click', async () => {
      incrementRenderLimit(PAGE_SIZE);
      // [P2-FIX] Pass sortBy to maintain thread sort mode during pagination
      await renderArchiveFeed(feedEl!, activeItems, state.viewMode, uiHost.getReaderState(), state.sortBy);
      runPostRenderHooks();
    });

    // Index view click-to-expand handler
    feedEl?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Expand: index row → card
      const expandTarget = target.closest('[data-action="expand-index-item"]');
      if (expandTarget) {
        const id = expandTarget.getAttribute('data-id');
        const item = id ? (activeItemById.get(id) || state.itemById.get(id)) : null;
        if (!item) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'pr-index-expanded';
        wrapper.setAttribute('data-id', id!);
        wrapper.innerHTML = `
        <button class="pr-button pr-index-collapse-btn"
                data-action="collapse-index-item" data-id="${id}" style="margin-bottom: 8px;">▲ Collapse</button>
        ${renderCardItem(item, uiHost.getReaderState())}
      `;
        expandTarget.replaceWith(wrapper);
        runPostRenderHooks();
        return;
      }

      // Collapse: card → index row
      const collapseTarget = target.closest('[data-action="collapse-index-item"]');
      if (collapseTarget) {
        const id = collapseTarget.getAttribute('data-id');
        const item = id ? (activeItemById.get(id) || state.itemById.get(id)) : null;
        if (!item) return;

        const expanded = collapseTarget.closest('.pr-index-expanded');
        if (expanded) {
          const tmp = document.createElement('div');
          tmp.innerHTML = renderIndexItem(item);
          const collapsedRow = tmp.firstElementChild;
          if (collapsedRow) {
            expanded.replaceWith(collapsedRow);
          }
        }
        return;
      }
    });

    /**
     * Show error UI with retry options
     */
    const showErrorUI = (error: Error, onRetry: (useAutoRetry: boolean) => void, onCancel: () => void) => {
      if (!errorContainer) return;

      const isAutoRetryEnabled = GM_getValue(AUTO_RETRY_KEY, false);
      const errorMessage = error.message || 'Unknown error occurred';

      errorContainer.innerHTML = `
        <div class="pr-archive-error">
          <div class="pr-archive-error-title">⚠️ Sync Failed</div>
          <div class="pr-archive-error-message">${escapeHtml(errorMessage)}</div>
          <div class="pr-archive-error-actions">
            <button id="archive-retry-once" class="pr-button">Retry Once</button>
            <button id="archive-retry-auto" class="pr-button" style="display: ${isAutoRetryEnabled ? 'none' : 'inline-block'}">Auto-Retry with Backoff</button>
            <button id="archive-cancel" class="pr-archive-cancel-btn">Cancel</button>
          </div>
          <div class="pr-archive-error-options">
            <label>
              <input type="checkbox" id="archive-remember-auto-retry" ${isAutoRetryEnabled ? 'checked' : ''}>
              <span>Remember this choice and auto-retry future errors</span>
            </label>
          </div>
        </div>
      `;
      errorContainer.style.display = 'block';

      // Event listeners
      document.getElementById('archive-retry-once')?.addEventListener('click', () => {
        const remember = (document.getElementById('archive-remember-auto-retry') as HTMLInputElement)?.checked;
        if (remember) GM_setValue(AUTO_RETRY_KEY, false);
        errorContainer.style.display = 'none';
        onRetry(false);
      });

      document.getElementById('archive-retry-auto')?.addEventListener('click', () => {
        const remember = (document.getElementById('archive-remember-auto-retry') as HTMLInputElement)?.checked;
        if (remember) GM_setValue(AUTO_RETRY_KEY, true);
        errorContainer.style.display = 'none';
        onRetry(true);
      });

      document.getElementById('archive-cancel')?.addEventListener('click', () => {
        errorContainer.style.display = 'none';
        onCancel();
      });
    };

    /**
     * Show retry progress indicator
     */
    const showRetryProgress = (attempt: number, maxAttempts: number, nextRetryIn?: number) => {
      if (!errorContainer || !statusEl) return;

      setStatusBaseMessage(`Sync failed. Retry ${attempt}/${maxAttempts}...`, true, false);

      errorContainer.innerHTML = `
        <div class="pr-archive-error">
          <div class="pr-archive-retry-indicator">
            <div class="pr-archive-retry-spinner"></div>
            <span>Retrying sync (attempt ${attempt} of ${maxAttempts})...</span>
            ${nextRetryIn ? `<span>Next retry in ${(nextRetryIn / 1000).toFixed(1)}s</span>` : ''}
            <button id="archive-force-retry" class="pr-button" style="margin-left: 10px;">Retry Now</button>
            <button id="archive-cancel-retry" class="pr-archive-cancel-btn">Cancel</button>
          </div>
        </div>
      `;
      errorContainer.style.display = 'block';
    };

    /**
     * Perform sync with error handling and retry logic
     */
    let isSyncInProgress = false;
    let pendingRetryCount = 0;
    const performSync = async (forceFull = false): Promise<void> => {
      // Guard against concurrent syncs
      if (isSyncInProgress) {
        Logger.debug('Sync already in progress, skipping duplicate request');
        return;
      }
      isSyncInProgress = true;
      pendingRetryCount = 0;
      const cached = await loadArchiveData(username);

      const setStatus = (msg: string, isError = false, isSyncing = false) => {
        setStatusBaseMessage(msg, isError, isSyncing);
      };

      const attemptSync = async (useAutoRetry: boolean, attemptNumber: number = 1): Promise<void> => {
        syncErrorState.isRetrying = true;
        syncErrorState.retryCount = attemptNumber;
        syncErrorState.abortController = new AbortController();

        try {
          if (attemptNumber > 1) {
            setStatus(`Retrying sync (attempt ${attemptNumber})`, false, true);
          } else if (forceFull) {
            setStatus(`Starting full resync for ${username}`, false, true);
          } else if (cached.items.length > 0) {
            setStatus(`Loaded ${cached.items.length} items. Checking for updates`, false, true);
          } else {
            setStatus(`No local data. Fetching full history for ${username}`, false, true);
          }

          const lastSyncDate = forceFull ? null : cached.lastSyncDate;
          await syncArchive(
            username,
            state,
            lastSyncDate,
            (msg) => setStatus(msg, false, true),
            syncErrorState.abortController.signal
          );

          // Success - clear error state
          syncErrorState.isRetrying = false;
          syncErrorState.retryCount = 0;
          if (errorContainer) errorContainer.style.display = 'none';

          // Clear syncing state
          setStatus(`Sync complete. ${state.items.length} total items.`, false, false);

          // Update view with new data
          updateItemMap(state.items);

          // If this attempt completed and no retry callbacks are still pending,
          // release the sync lock even when this call originated from a scheduled/manual retry.
          if (pendingRetryCount === 0) {
            isSyncInProgress = false;
          }

        } catch (error) {
          syncErrorState.isRetrying = false;
          const errorMessage = (error as Error).message;
          const displayError = `Sync failed: ${errorMessage}`;

          // Show error in status line
          setStatus(displayError, true, false);

          // Check if aborted
          if (syncErrorState.abortController?.signal.aborted) {
            Logger.info('Sync was cancelled by user');
            setStatus(`Sync cancelled. Showing cached data (${cached.items.length} items).`, false, false);
            pendingRetryCount = 0;
            isSyncInProgress = false;
            return;
          }

          const shouldAutoRetry = useAutoRetry || GM_getValue(AUTO_RETRY_KEY, false);

          if (shouldAutoRetry && attemptNumber < MAX_AUTO_RETRIES) {
            // Calculate exponential backoff
            const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attemptNumber - 1);

            showRetryProgress(attemptNumber, MAX_AUTO_RETRIES, backoffMs);

            // Setup force retry and cancel handlers
            const forceRetryBtn = document.getElementById('archive-force-retry');
            const cancelRetryBtn = document.getElementById('archive-cancel-retry');

            let retryTimeout: number | null = null;

            // Track this pending retry
            pendingRetryCount++;

            const doRetry = () => {
              if (retryTimeout) clearTimeout(retryTimeout);
              pendingRetryCount--;
              attemptSync(true, attemptNumber + 1);
            };

            const doCancel = () => {
              if (retryTimeout) clearTimeout(retryTimeout);
              syncErrorState.abortController?.abort();
              if (errorContainer) errorContainer.style.display = 'none';
              setStatus(`Sync cancelled. Showing cached data (${cached.items.length} items).`, false, false);
              pendingRetryCount = 0;
              isSyncInProgress = false;
            };

            forceRetryBtn?.addEventListener('click', doRetry, { once: true });
            cancelRetryBtn?.addEventListener('click', doCancel, { once: true });

            // Schedule automatic retry - retry handler will decrement counter
            retryTimeout = window.setTimeout(doRetry, backoffMs);
            // Don't clear isSyncInProgress here - retry is still pending
            return;

          } else {
            // Max retries reached or manual retry preferred
            // Wrap callbacks to track retry state
            pendingRetryCount++;
            showErrorUI(error as Error, (retryMode) => {
              pendingRetryCount--;
              attemptSync(retryMode, 1);
            }, () => {
              pendingRetryCount = 0;
              isSyncInProgress = false;
              setStatus(`Sync failed. Showing cached data (${cached.items.length} items).`, true, false);
            });
          }
        }
      };

      // Start sync - check if auto-retry is enabled
      const isAutoRetryEnabled = GM_getValue(AUTO_RETRY_KEY, false);
      try {
        await attemptSync(isAutoRetryEnabled);
      } finally {
        // Only clear isSyncInProgress when no retries are pending
        if (pendingRetryCount === 0) {
          isSyncInProgress = false;
        }
      }
    };

    resyncBtn?.addEventListener('click', () => {
      // Clear current view
      if (confirm('This will re-download the entire archive history. Continue?')) {
        performSync(true);
      }
    });

    // 1. Try loading from IndexedDB
    const cached = await loadArchiveData(username);
    state.items = cached.items;

    // Initial sync of host state
    updateItemMap(state.items);

    try {
      const cachedContext = await loadAllContextualItems(username);
      persistedContextItems = [...cachedContext.posts, ...cachedContext.comments];
      contextSearchItemsCache = null;
      if (persistedContextItems.length > 0 && (scopeSelect.value === 'all' || searchInput.value.trim().length > 0)) {
        await refreshView();
      }
    } catch (e) {
      Logger.warn('Failed to load contextual cache for archive search scope:all', e);
      persistedContextItems = [];
      contextSearchItemsCache = null;
    }

    activeItems = state.items;

    if (cached.items.length > 0) {
      setStatusBaseMessage(`Loaded ${cached.items.length} items from cache.`, false, false);
    } else {
      dashboardEl!.style.display = 'block';
      setStatusBaseMessage(`No local data. Fetching full history for ${username}...`, false, false);
    }

    // 2. Perform Sync with error handling
    await performSync();

    dashboardEl!.style.display = 'none';
    signalReady();

  } catch (err) {
    Logger.error('Failed to initialize archive:', err);
    const root = document.getElementById('power-reader-root');
    if (root) {
      const errorEl = document.createElement('div');
      errorEl.className = 'pr-error';
      const message = err instanceof Error ? err.message : String(err);
      errorEl.textContent = `Failed to load archive: ${message}`;
      root.replaceChildren(errorEl);
    }
  }
};

/**
 * Sync logic: Fetch new items, merge, and save.
 */
const syncArchive = async (
  username: string,
  state: any,
  lastSyncDate: string | null,
  onStatus: (msg: string) => void,
  abortSignal?: AbortSignal
) => {
  // Check for abort before starting
  if (abortSignal?.aborted) {
    throw new Error('Sync aborted');
  }

  const syncStartTime = new Date().toISOString();
  let userId = state.userId;

  if (!userId) {
    const fetchedId = await fetchUserId(username);
    if (!fetchedId) throw new Error(`User ${username} not found`);
    state.userId = fetchedId;
    userId = fetchedId;
  }

  // Check for abort after fetching userId
  if (abortSignal?.aborted) {
    throw new Error('Sync aborted');
  }

  const minDate = lastSyncDate ? new Date(lastSyncDate) : undefined;
  if (minDate) {
    onStatus(`Fetching items since ${minDate.toLocaleDateString()}...`);
  }

  const comments = await fetchUserComments(userId, (count) => {
    onStatus(`Fetching comments: ${count} new...`);
  }, minDate);

  // Check for abort after fetching comments
  if (abortSignal?.aborted) {
    throw new Error('Sync aborted');
  }

  const posts = await fetchUserPosts(userId, (count) => {
    onStatus(`Fetching posts: ${count} new...`);
  }, minDate);

  // Check for abort after fetching comments
  if (abortSignal?.aborted) {
    throw new Error('Sync aborted');
  }

  const newItems = [...posts, ...comments];

  // Check for abort before expensive merge/save operations
  if (abortSignal?.aborted) {
    throw new Error('Sync aborted');
  }

  if (newItems.length > 0) {
    onStatus(`Found ${newItems.length} new items. Merging...`);

    // Merge strategy: Add new items to state.items, avoiding duplicates by ID
    const existingIds = new Set(state.items.map((i: any) => i._id));
    const uniqueNewItems = newItems.filter(i => !existingIds.has(i._id));

    state.items = [...uniqueNewItems, ...state.items];

    // Re-sort (Default to date for the background state)
    state.items.sort((a: any, b: any) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

    await saveArchiveData(username, uniqueNewItems, syncStartTime);

    onStatus(`Sync complete. ${state.items.length} total items.`);
  } else {
    const statusMsg = lastSyncDate ? `Up to date. (${state.items.length} items)` : `No history found for ${username}.`;
    onStatus(statusMsg);
    await saveArchiveData(username, [], syncStartTime);
  }
};
