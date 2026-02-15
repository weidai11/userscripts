/**
 * LW Power Reader - Main Entry Point
 * A userscript that provides an enhanced interface for reading LessWrong comments
 *
 * This is a thin bootstrap that orchestrates the modular components.
 */

import { getRoute, runAIStudioMode } from './router';
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
import { getLoadFrom, setLoadFrom, getReadState } from './utils/storage';
import { clearAllStorage } from './utils/storage';
import { Logger } from './utils/logger';

// Features
import { initAIStudioListener, setupAIStudioKeyboard } from './features/aiStudioPopup';
import { setupHeaderInjection } from './features/headerInjection';
import { setupProfileInjection } from './features/profileInjection';
import { initArchive } from './archive/index';

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
    setupProfileInjection();
    return;
  }

  if (route.type === 'ai-studio') {
    await runAIStudioMode();
    return;
  }

  if (route.type === 'archive') {
    await initArchive(route.username);
    return;
  }

  // Reader mode - execute page takeover
  executeTakeover();

  // Initialize reactions data (needed for render)
  try {
    await initializeReactions();
  } catch (e) {
    Logger.error('Reaction initialization failed:', e);
  }

  // Handle reset route
  if (route.path === 'reset') {
    Logger.info('Resetting storage...');
    clearAllStorage();
    window.location.href = '/reader';
    return;
  }

  // Rebuild DOM
  rebuildDocument();

  // Check if setup is needed
  const loadFrom = getLoadFrom();
  if (!loadFrom) {
    showSetupUI(handleStartReading);
    signalReady();
    return;
  }

  // Load and render
  await loadAndRender();
};

/**
 * Handle starting to read (from setup UI)
 */
const handleStartReading = async (loadFromDate: string | null): Promise<void> => {
  if (loadFromDate) {
    setLoadFrom(loadFromDate);
  } else {
    setLoadFrom('__LOAD_RECENT__');
  }
  await loadAndRender();
};

/**
 * Load all data and render the UI
 */
const loadAndRender = async (): Promise<void> => {
  const root = getRoot();
  if (!root) return;

  const state = getState();

  root.innerHTML = `
    <div class="pr-header">
      <h1>Less Wrong: Power Reader <small style="font-size: 0.6em; color: #888;">v${__APP_VERSION__}</small></h1>
      <div class="pr-status">Fetching comments...</div>
    </div>
  `;

  const setStatus = (text: string) => {
    const el = document.querySelector('.pr-status');
    if (el) el.textContent = text;
  };

  try {
    Logger.info('Loading data...');
    const initialResult = await loadInitial();
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
