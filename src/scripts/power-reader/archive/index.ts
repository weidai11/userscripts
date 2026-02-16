import { executeTakeover, rebuildDocument, signalReady } from '../takeover';
import { initializeReactions } from '../utils/reactions';
import { Logger } from '../utils/logger';
import { createInitialArchiveState, type ArchiveSortBy, type ArchiveViewMode } from './state';
import { loadArchiveData, saveArchiveData } from './storage';
import { fetchUserId, fetchUserPosts, fetchUserComments } from './loader';
import { escapeHtml } from '../utils/rendering';
import { renderArchiveFeed, updateRenderLimit, incrementRenderLimit } from './render';

declare const GM_getValue: (key: string, defaultValue?: any) => any;
declare const GM_setValue: (key: string, value: any) => void;
declare const __APP_VERSION__: string;

// Storage keys for error handling preferences
const AUTO_RETRY_KEY = 'power-reader-archive-auto-retry';
const MAX_AUTO_RETRIES = 50;
const INITIAL_BACKOFF_MS = 2000;

const PAGE_SIZE = 10000;

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
    executeTakeover();
    await initializeReactions();
    rebuildDocument();

    const state = createInitialArchiveState(username);
    const root = document.getElementById('power-reader-root');
    if (!root) return;

    // Inject styles for archive specific layouts
    const style = document.createElement('style');
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
        
        /* Thread View Styles */
        .pr-thread-wrapper {
             background: var(--pr-bg-primary);
        }
        .pr-thread-root-post {
            padding: 10px;
            background: var(--pr-bg-secondary);
            border-bottom: 1px solid var(--pr-border-subtle);
            font-size: 0.9em;
        }
        .pr-thread-parent {
            padding: 8px 0;
            border-left: 2px solid var(--pr-border-color);
            padding-left: 10px;
            margin-bottom: 5px;
        }
        .pr-thread-parent-meta {
            font-size: 0.85em;
            color: var(--pr-text-tertiary);
            margin-bottom: 4px;
        }
        .pr-thread-parent-body {
            font-size: 0.9em;
            color: var(--pr-text-secondary);
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

    root.innerHTML = `
    <div class="pr-header">
      <h1>User Archive: ${escapeHtml(username)} <small style="font-size: 0.6em; color: #888;">v${__APP_VERSION__}</small></h1>
      <div class="pr-status" id="archive-status">Checking local database...</div>
    </div>
    
    <div class="pr-archive-container" style="padding: 10px; background: var(--pr-bg-secondary); border-radius: 8px;">
        <div class="pr-archive-toolbar">
            <input type="text" id="archive-search" placeholder="Search archive (Regex supported)..." class="pr-input" style="flex: 2; min-width: 200px;">
            <select id="archive-sort">
                <option value="date">Date (Newest)</option>
                <option value="date-asc">Date (Oldest)</option>
                <option value="score">Karma (High-Low)</option>
                <option value="score-asc">Karma (Low-High)</option>
                <option value="replyTo">Reply To (Name)</option>
            </select>
             <select id="archive-view">
                <option value="card">Card View</option>
                <option value="index">Index View</option>
                <option value="thread">Thread View</option>
            </select>
            <button id="archive-resync" class="pr-button" title="Force re-download all data">Resync</button>
        </div>
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
    const sortSelect = document.getElementById('archive-sort') as HTMLSelectElement;
    const viewSelect = document.getElementById('archive-view') as HTMLSelectElement;
    const resyncBtn = document.getElementById('archive-resync');
    const errorContainer = document.getElementById('archive-error-container');

    let activeItems = state.items;
    const syncErrorState: SyncErrorState = {
      isRetrying: false,
      retryCount: 0,
      abortController: null
    };

    // Helper to batch updates to map
    const updateItemMap = (items: any[]) => {
      items.forEach(i => state.itemById.set(i._id, i));
    };

    const LARGE_DATASET_THRESHOLD = 10000;
    let pendingRenderCount: number | null = null;

    const refreshView = async () => {
      // 1. Filter
      let filtered = state.items;
      const query = searchInput.value;
      if (query) {
        try {
          const regex = new RegExp(query, 'i');
          filtered = state.items.filter((item: any) => {
            // Prefer markdown, fallback to stripped HTML
            const bodyText = item.contents?.markdown || (item.htmlBody || '').replace(/<[^>]+>/g, ' ');
            const text = (item.title || '') + ' ' + bodyText;
            return regex.test(text);
          });
        } catch (e) {
          const lower = query.toLowerCase();
          filtered = state.items.filter((item: any) => {
            const bodyText = item.contents?.markdown || (item.htmlBody || '').replace(/<[^>]+>/g, ' ');
            const text = ((item.title || '') + ' ' + bodyText).toLowerCase();
            return text.includes(lower);
          });
        }
      }

      // 2. Sort
      activeItems = sortItems(filtered, sortSelect.value as string);

      // 3. Check if we need to ask user about render count for large datasets
      const totalItems = activeItems.length;
      if (totalItems >= LARGE_DATASET_THRESHOLD && pendingRenderCount === null) {
        // Show dialog to ask user how many to render
        showRenderCountDialog(totalItems, async (count: number) => {
      pendingRenderCount = count;
      updateRenderLimit(count);
      await renderArchiveFeed(feedEl!, activeItems, state.viewMode, state.itemById);
        });
        return;
      }

    // 4. Render
    // Only override render limit for large datasets where user explicitly chose a count
    // For normal datasets, keep the default limit to enable pagination
    if (pendingRenderCount !== null) {
      updateRenderLimit(pendingRenderCount);
    }
    await renderArchiveFeed(feedEl!, activeItems, state.viewMode, state.itemById);
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
    searchInput?.addEventListener('input', () => {
      refreshView();
    });

    sortSelect?.addEventListener('change', () => {
      state.sortBy = sortSelect.value as ArchiveSortBy;
      refreshView();
    });

    viewSelect?.addEventListener('change', () => {
      state.viewMode = viewSelect.value as ArchiveViewMode;
      refreshView();
    });

    // Setup Load More
    loadMoreBtn?.querySelector('button')?.addEventListener('click', () => {
      incrementRenderLimit(PAGE_SIZE);
      renderArchiveFeed(feedEl!, activeItems, state.viewMode, state.itemById);
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

      statusEl.textContent = `Sync failed. Retry ${attempt}/${maxAttempts}...`;

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
        if (!statusEl) return;
        statusEl.textContent = msg;
        statusEl.classList.toggle('status-error', isError);
        statusEl.classList.toggle('status-syncing', isSyncing);
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
          await refreshView();

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
    updateItemMap(state.items);
    activeItems = state.items;

    if (cached.items.length > 0) {
      statusEl!.textContent = `Loaded ${cached.items.length} items from cache.`;
      refreshView();
    } else {
      dashboardEl!.style.display = 'block';
      statusEl!.textContent = `No local data. Fetching full history for ${username}...`;
    }

    // 2. Perform Sync with error handling
    await performSync();

    dashboardEl!.style.display = 'none';
    signalReady();

  } catch (err) {
    Logger.error('Failed to initialize archive:', err);
    const root = document.getElementById('power-reader-root');
    if (root) {
      root.innerHTML = `<div class="pr-error">Failed to load archive: ${(err as Error).message}</div>`;
    }
  }
};

/**
 * Sort helper
 */
const sortItems = (items: any[], sortMode: string): any[] => {
  const sorted = [...items];
  switch (sortMode) {
    case 'date-asc':
      return sorted.sort((a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime());
    case 'date':
    default:
      return sorted.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
    case 'score':
      return sorted.sort((a, b) => (b.baseScore || 0) - (a.baseScore || 0));
    case 'score-asc':
      return sorted.sort((a, b) => (a.baseScore || 0) - (b.baseScore || 0));
    case 'replyTo':
      return sorted.sort((a, b) => {
        const nameA = getInterlocutorName(a).toLowerCase();
        const nameB = getInterlocutorName(b).toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }
};

const getInterlocutorName = (item: any): string => {
  if (item.title) return " (Original Post)"; // It's a post
  // It's a comment
  if (item.parentComment?.user?.displayName) return item.parentComment.user.displayName;
  if (item.post?.user?.displayName) return item.post.user.displayName;
  return "Unknown";
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

  const posts = await fetchUserPosts(userId, (count) => {
    onStatus(`Fetching posts: ${count} new...`);
  }, minDate);

  // Check for abort after fetching posts
  if (abortSignal?.aborted) {
    throw new Error('Sync aborted');
  }

  const comments = await fetchUserComments(userId, (count) => {
    onStatus(`Fetching comments: ${count} new...`);
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
