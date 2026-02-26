
/**
 * LW Power Reader - Main Entry Point
 * A userscript that provides an enhanced interface for reading LessWrong comments
 *
 * This is a thin bootstrap that orchestrates the modular components.
 */

import { getRoute, runAIStudioMode, runArenaMaxMode } from './router';
import { executeTakeover, rebuildDocument, signalReady, getRoot } from './takeover';
import { getState } from './state';
import {
  loadInitial,
  enrichInBackground,
  applyEnrichment,
  applyInitialLoad,
  runSmartLoading,
  applySmartLoad,
} from './services/loader';
import { renderUI, showSetupUI } from './render/index';
import { attachEventListeners } from './events/index';
import { initializeReactions } from './utils/reactions';
import { getLoadFrom, setLoadFromAndClearRead, getReadState } from './utils/storage';
import { clearAllStorage } from './utils/storage';
import { Logger } from './utils/logger';
import { setUIHost } from './render/uiHost';
import { PowerReaderUIHost } from './render/powerReaderHost';
import { initPersistenceSync } from './persistence/persistenceSync';

// Features
import { initAIStudioListener, setupAIStudioKeyboard } from './features/aiStudioPopup';
import { initArenaMaxListener, setupArenaMaxKeyboard } from './features/arenaMaxPopup';
import { setupHeaderInjection } from './features/headerInjection';
import { initArchive } from './archive/index';
import { getForumMeta } from './utils/forum';

declare const __APP_VERSION__: string;

/**
 * Main initialization entry point
 */
const initReader = async (): Promise<void> => {
  const route = getRoute();

  if (route.type === 'skip') {
    return;
  }


  if (route.type === 'forum-injection') {
    setupHeaderInjection();
    return;
  }

  if (route.type === 'ai-studio') {
    await runAIStudioMode();
    return;
  }

  if (route.type === 'arena-max') {
    await runArenaMaxMode();
    return;
  }

  if (route.type === 'archive') {
    await initArchive(route.username);
    return;
  }

  // Reader mode - execute page takeover
  executeTakeover();

  // Initialize UI Host for Power Reader
  setUIHost(new PowerReaderUIHost(getState()));

  // Initialize reactions data before DOM rebuild so script scraping can inspect page bundles.
  try {
    await initializeReactions();
  } catch (e) {
    Logger.error('Reaction initialization failed:', e);
  }

  // Rebuild DOM
  rebuildDocument();

  // Handle sync lifecycle (including reset replay path) before setup gating.
  if (route.path === 'reset') {
    Logger.info('Resetting storage...');
    clearAllStorage({ silent: true });
  }
  const syncInit = await initPersistenceSync({ isResetRoute: route.path === 'reset' });
  if (syncInit.resetHandled) {
    window.location.href = '/reader';
    return;
  }

  // Check if setup is needed
  const loadFrom = getLoadFrom();
  if (!loadFrom) {
    showSetupUI(handleStartReading);
    signalReady();
    return;
  }

  // Load and render
  if (syncInit.currentUserSnapshot === undefined) {
    await loadAndRender();
  } else {
    await loadAndRender(syncInit.currentUserSnapshot as unknown | null);
  }
};

/**
 * Handle starting to read (from setup UI)
 */
const handleStartReading = async (loadFromDate: string | null): Promise<void> => {
  if (loadFromDate) {
    setLoadFromAndClearRead(loadFromDate);
  } else {
    setLoadFromAndClearRead('__LOAD_RECENT__');
  }
  await loadAndRender();
};

/**
 * Load all data and render the UI
 */
const loadAndRender = async (currentUserSnapshot?: unknown | null): Promise<void> => {
  const root = getRoot();
  if (!root) return;

  const state = getState();
  const { forumLabel, forumHomeUrl } = getForumMeta();

  root.innerHTML = `
    <div class="pr-header">
      <h1><a href="${forumHomeUrl}" target="_blank" rel="noopener noreferrer" class="pr-site-home-link">${forumLabel}</a>: Power Reader <small style="font-size: 0.6em; color: #888;">v${__APP_VERSION__}</small></h1>
      <div class="pr-status">Fetching comments...</div>
    </div>
  `;

  const setStatus = (text: string) => {
    const el = document.querySelector('.pr-status');
    if (el) el.textContent = text;
  };

  try {
    Logger.info('Loading data...');
    const initialResult = await loadInitial(currentUserSnapshot as any);
    Logger.info('loadInitial complete');
    applyInitialLoad(state, initialResult);

    if (state.comments.length > 0) {
      state.initialBatchNewestDate = state.comments.reduce((newest, c) => {
        return new Date(c.postedAt) > new Date(newest) ? c.postedAt : newest;
      }, state.comments[0].postedAt);
    }

    setStatus(`${state.comments.length} comments — fetching posts & subscriptions...`);

    Logger.info('Enriching in background...');
    const enrichResult = await enrichInBackground(state);
    Logger.info('enrichInBackground complete');
    applyEnrichment(state, enrichResult);
    setStatus(`${state.comments.length} comments & ${state.primaryPostsCount} posts — loading replies...`);

    const readState = getReadState();
    const smartResult = await runSmartLoading(state, readState);
    if (smartResult) {
      applySmartLoad(state, smartResult);
      Logger.info(`Smart loaded: ${state.comments.length} comments total`);
    }

    Logger.info(`Loaded ${state.comments.length} comments and ${state.posts.length} posts`);

    renderUI(state);
    Logger.info('renderUI complete');

    signalReady();
    Logger.info('signalReady called');

    if (!root.dataset.listenersAttached) {
      initAIStudioListener(state);
      setupAIStudioKeyboard(state);
      initArenaMaxListener(state);
      setupArenaMaxKeyboard(state);
      attachEventListeners(state);
      root.dataset.listenersAttached = 'true';
    }

  } catch (e) {
    Logger.error('Page load failed:', e);
    root.innerHTML = `<div class="pr-error">Error loading reader. Check console.</div>`;
    signalReady();
  }
};

// Start the reader
initReader();

// Export for external access (tests, etc.)
export { getState } from './state';
export { CONFIG } from './config';
