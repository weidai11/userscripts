import { executeTakeover, rebuildDocument, signalReady } from '../takeover';
import { initializeReactions } from '../utils/reactions';
import { Logger } from '../utils/logger';
import { createInitialArchiveState } from './state';
import { loadArchiveData, saveArchiveData } from './storage';
import { fetchUserId, fetchUserPosts, fetchUserComments } from './loader';
import { renderMetadata } from '../render/components/metadata';
import { renderBody } from '../render/components/body';
import { escapeHtml } from '../utils/rendering';

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

    root.innerHTML = `
    <div class="pr-header">
      <h1>User Archive: ${escapeHtml(username)}</h1>
      <div class="pr-status" id="archive-status">Checking local database...</div>
    </div>
    <div id="archive-dashboard" class="pr-setup" style="max-width: 800px">
      Loading archive data...
    </div>
    <div id="archive-feed" style="margin-top: 20px"></div>
  `;

    const statusEl = document.getElementById('archive-status');
    const dashboardEl = document.getElementById('archive-dashboard');
    const feedEl = document.getElementById('archive-feed');

    // 1. Try loading from IndexedDB
    const cached = await loadArchiveData(username);
    if (cached.items.length > 0) {
      statusEl!.textContent = `Loaded ${cached.items.length} items from local database. Last sync: ${cached.lastSyncDate || 'Unknown'}`;
      state.items = cached.items;
      renderArchiveFeed(feedEl!, state.items);
    } else {
      // 2. Load from API if no cache
      statusEl!.textContent = `No local data found. Fetching full history for ${username}...`;

      const userId = await fetchUserId(username);
      if (!userId) {
        dashboardEl!.innerHTML = `<div class="pr-error">Could not find user: ${escapeHtml(username)}</div>`;
        return;
      }
      state.userId = userId;

      const posts = await fetchUserPosts(userId, (count) => {
        statusEl!.textContent = `Fetching posts: ${count} loaded...`;
      });

      const comments = await fetchUserComments(userId, (count) => {
        statusEl!.textContent = `Fetching comments: ${count} loaded...`;
      });

      const allItems = [...posts, ...comments];
      // Sort by date descending
      allItems.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

      state.items = allItems;
      statusEl!.textContent = `Sync complete! ${allItems.length} items loaded.`;

      // Save to cache
      await saveArchiveData(username, allItems, new Date().toISOString());

      renderArchiveFeed(feedEl!, state.items);
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

const renderArchiveFeed = (container: HTMLElement, items: any[]): void => {
  if (items.length === 0) {
    container.innerHTML = '<div class="pr-status">No items found for this user.</div>';
    return;
  }

  container.innerHTML = items.map(item => {
    const isPost = 'title' in item;
    const classes = `pr-archive-item pr-item ${isPost ? 'pr-post' : 'pr-comment'}`;
    const metadataHtml = renderMetadata(item);

    let contentHtml = '';
    if (isPost) {
      contentHtml = `<h3>${escapeHtml(item.title)}</h3>` + renderBody(item.htmlBody || '', item.extendedScore);
    } else {
      contentHtml = renderBody(item.htmlBody || '', item.extendedScore);
    }

    return `
      <div class="${classes}" data-id="${item._id}">
        <div class="pr-archive-item-header">
           ${metadataHtml}
        </div>
        <div class="pr-archive-item-body">
          ${contentHtml}
        </div>
      </div>
    `;
  }).join('');
};

