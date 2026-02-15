import { executeTakeover, rebuildDocument, signalReady } from '../takeover';
import { initializeReactions } from '../utils/reactions';
import { Logger } from '../utils/logger';
import { createInitialArchiveState, type ArchiveSortBy, type ArchiveViewMode } from './state';
import { loadArchiveData, saveArchiveData } from './storage';
import { fetchUserId, fetchUserPosts, fetchUserComments } from './loader';
import { escapeHtml } from '../utils/rendering';
import { renderArchiveFeed, updateRenderLimit, incrementRenderLimit } from './render';

const PAGE_SIZE = 50;

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
    `;
    document.head.appendChild(style);

    root.innerHTML = `
    <div class="pr-header">
      <h1>User Archive: ${escapeHtml(username)}</h1>
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
        </div>
    </div>

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

    let activeItems = state.items;

    // Helper to batch updates to map
    const updateItemMap = (items: any[]) => {
      items.forEach(i => state.itemById.set(i._id, i));
    };

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

      // 3. Render
      await renderArchiveFeed(feedEl!, activeItems, state.viewMode, state.itemById);
    };

    // Event Listeners
    searchInput?.addEventListener('input', () => {
      updateRenderLimit(PAGE_SIZE);
      refreshView();
    });

    sortSelect?.addEventListener('change', () => {
      state.sortBy = sortSelect.value as ArchiveSortBy;
      updateRenderLimit(PAGE_SIZE);
      refreshView();
    });

    viewSelect?.addEventListener('change', () => {
      state.viewMode = viewSelect.value as ArchiveViewMode;
      updateRenderLimit(PAGE_SIZE); // Maybe keep scroll, but for now reset is safer
      refreshView();
    });

    // Setup Load More
    loadMoreBtn?.querySelector('button')?.addEventListener('click', () => {
      incrementRenderLimit(PAGE_SIZE);
      renderArchiveFeed(feedEl!, activeItems, state.viewMode, state.itemById);
    });

    // 1. Try loading from IndexedDB
    const cached = await loadArchiveData(username);
    state.items = cached.items;
    updateItemMap(state.items);
    activeItems = state.items;

    if (cached.items.length > 0) {
      statusEl!.textContent = `Loaded ${cached.items.length} items. Checking for updates...`;
      refreshView();
    } else {
      dashboardEl!.style.display = 'block';
      statusEl!.textContent = `No local data. Fetching full history for ${username}...`;
    }

    // 2. Perform Sync (Background or Foreground)
    try {
      await syncArchive(username, state, cached.lastSyncDate, (msg) => {
        if (statusEl) statusEl.textContent = msg;
      });
      // Update active items after successful sync
      updateItemMap(state.items);
      refreshView();
    } catch (e) {
      Logger.error('Background sync failed:', e);
      if (statusEl) statusEl.textContent = `Sync failed. Showing cached data (${cached.items.length} items).`;
    }

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
  onStatus: (msg: string) => void
) => {
  const syncStartTime = new Date().toISOString();
  let userId = state.userId;

  if (!userId) {
    const fetchedId = await fetchUserId(username);
    if (!fetchedId) throw new Error(`User ${username} not found`);
    state.userId = fetchedId;
    userId = fetchedId;
  }

  const minDate = lastSyncDate ? new Date(lastSyncDate) : undefined;
  if (minDate) {
    onStatus(`Fetching items since ${minDate.toLocaleDateString()}...`);
  }

  const posts = await fetchUserPosts(userId, (count) => {
    onStatus(`Fetching posts: ${count} new...`);
  }, minDate);

  const comments = await fetchUserComments(userId, (count) => {
    onStatus(`Fetching comments: ${count} new...`);
  }, minDate);

  const newItems = [...posts, ...comments];

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
    onStatus(`Up to date. (${state.items.length} items)`);
    await saveArchiveData(username, [], syncStartTime);
  }
};
