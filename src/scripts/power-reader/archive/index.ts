
import { executeTakeover, rebuildDocument, signalReady } from '../takeover';
import { initializeReactions } from '../utils/reactions';
import { Logger } from '../utils/logger';
import { createInitialArchiveState, type ArchiveSortBy, type ArchiveViewMode, isThreadMode } from './state';
import {
  loadAllContextualItems,
  loadArchiveData,
  saveArchiveBaselineFacets,
  saveArchiveData,
  type ArchiveBaselineFacetSnapshot,
  type ArchiveFacetScope
} from './storage';
import {
  buildArchiveHtmlExport,
  buildArchiveJsExportSource,
  buildArchiveMarkdown,
  createArchiveExportPayload,
  type ArchiveExportSource
} from './export';
import { fetchUserId, fetchUserPosts, fetchUserComments } from './loader';
import { escapeHtml } from '../utils/rendering';
import { renderArchiveFeed, updateRenderLimit, resetRenderLimit, renderCardItem, renderIndexItem } from './render';
import { setUIHost } from '../render/uiHost';
import { ArchiveUIHost } from './uiHost';
import { attachEventListeners } from '../events/index';
import { setupExternalLinks } from '../features/externalLinks';
import { setupInlineReactions } from '../features/inlineReactions';
import { initReactionTooltips } from '../features/reactionTooltips';

import { initPreviewSystem } from '../utils/preview';
import { refreshPostActionButtons } from '../utils/dom';
import { ArchiveSearchManager } from './search';

import { parseArchiveUrlState, writeArchiveUrlState } from './search/urlState';
import { createSearchWorkerClient } from './search/workerFactory';
import { parseStructuredQuery } from './search/parser';
import { isPositiveContentWithoutWildcard } from './search/ast';
import { extractHighlightTerms, highlightTermsInContainer } from './search/highlight';
import {
  computeFacets,
  createFacetAccumulator,
  scanFacetChunk,
  type FacetGroup,
  type FacetResult
} from './search/facets';
import { setupLinkPreviewsDelegated } from '../features/linkPreviews';
import type { SearchWorkerClient } from './search/protocol';
import type {
  ArchiveItem,
  ArchiveSearchScope,
  RelevanceSignals,
  SearchDiagnostics
} from './search/types';
import { getForumMeta } from '../utils/forum';

declare const GM_getValue: (key: string, defaultValue?: any) => any;
declare const GM_setValue: (key: string, value: any) => void;
declare const __APP_VERSION__: string;

// Storage keys for error handling preferences
const AUTO_RETRY_KEY = 'power-reader-archive-auto-retry';
const MAX_AUTO_RETRIES = 50;
const INITIAL_BACKOFF_MS = 2000;

const SEARCH_DEBOUNCE_MS = 180;
const VIEW_MODE_KEYBOARD_DEBOUNCE_MS = 80;
const MAX_ARCHIVE_DOM_RECOVERY_ATTEMPTS = 2;
const MAX_SEARCH_HIGHLIGHT_TARGETS = 1200;
const NETWORK_IDLE_RENDER_MS = 5000;
const NO_QUERY_EXACT_FACET_REFINE_BUDGET_MS = 30;

let activeArchiveInitRunId = 0;
let activeArchiveInitAbortController: AbortController | null = null;

interface SyncErrorState {
  isRetrying: boolean;
  retryCount: number;
  abortController: AbortController | null;
}

/**
 * Initialize the User Archive view
 */
export const initArchive = async (username: string, recoveryAttempt = 0): Promise<void> => {
  Logger.info(`Initializing User Archive for: ${username}`);
  const runAbortController = new AbortController();
  const previousRunAbortController = activeArchiveInitAbortController;
  activeArchiveInitRunId += 1;
  const runId = activeArchiveInitRunId;
  activeArchiveInitAbortController = runAbortController;

  if (previousRunAbortController && !previousRunAbortController.signal.aborted) {
    previousRunAbortController.abort();
  }

  const isCurrentRun = (): boolean =>
    runId === activeArchiveInitRunId && !runAbortController.signal.aborted;

  let networkIdleRenderTimer: number | null = null;
  const clearNetworkIdleRenderTimer = () => {
    if (networkIdleRenderTimer) {
      window.clearTimeout(networkIdleRenderTimer);
      networkIdleRenderTimer = null;
    }
  };

  try {
    if (!isCurrentRun()) return;
    resetRenderLimit();
    executeTakeover();
    await initializeReactions();
    if (!isCurrentRun()) return;
    rebuildDocument();
    initPreviewSystem();

    const state = createInitialArchiveState(username);
    const root = document.getElementById('power-reader-root');
    if (!root) return;
    const { forumLabel, forumHomeUrl } = getForumMeta();

    // Inject or update styles for archive specific layouts
    let style = document.getElementById('pr-archive-styles') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'pr-archive-styles';
      document.head.appendChild(style);
    }
    style.textContent = `
        .pr-input {
            padding: 8px 12px;
            border: 1px solid var(--pr-border-color, #ddd);
            border-radius: 6px;
            background: var(--pr-bg-primary, #fff);
            color: var(--pr-text-primary, #000);
            font-size: 0.95em;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
            box-sizing: border-box;
        }
        .pr-input:focus {
            border-color: #0078ff;
            box-shadow: 0 0 0 2px rgba(0, 120, 255, 0.15);
        }
        .pr-input::placeholder {
            color: var(--pr-text-tertiary, #999);
        }
        .pr-button {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 8px 16px;
            background: var(--pr-bg-secondary, #f0f0f0);
            color: var(--pr-text-primary, #000);
            border: 1px solid var(--pr-border-color, #ddd);
            border-radius: 6px;
            font-size: 0.9em;
            cursor: pointer;
            transition: background 0.2s;
            white-space: nowrap;
        }
        .pr-button:hover {
            background: var(--pr-bg-hover, #e0e0e0);
        }
        .pr-button:active {
            background: var(--pr-bg-active, #d0d0d0);
        }
        .pr-button.primary {
            background: #0078ff;
            color: #fff;
            border-color: #0078ff;
        }
        .pr-button.primary:hover {
            background: #0056cc;
        }
        .pr-is-hidden {
            display: none !important;
        }
        .pr-archive-container {
            --pr-archive-toolbar-height: 72px;
            padding: 10px;
            background: var(--pr-bg-secondary, #f9f9f9);
            border-radius: 8px;
        }
        .pr-archive-sticky-sentinel {
            height: 1px;
            margin-top: -1px;
        }
        .pr-archive-sticky-header {
            position: sticky;
            top: 0;
            z-index: 1500;
            background: var(--pr-bg-secondary, #f9f9f9);
            overflow: visible;
        }
        .pr-archive-sticky-header.pr-is-scrolled {
            border-bottom: 1px solid var(--pr-border-subtle, #eee);
        }
        .pr-archive-toolbar {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin: 10px 0 0;
            overflow: visible;
        }
        .pr-archive-toolbar-primary {
            display: flex;
            gap: 10px;
            align-items: center;
            position: relative;
            overflow: visible;
        }
        .pr-archive-toolbar-secondary {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
            justify-content: space-between;
        }
        .pr-icon-btn {
            padding: 6px 8px;
            min-width: unset;
            font-size: 1.1em;
            line-height: 1;
        }
        .pr-toolbar-controls {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
        }
        .pr-export-controls {
            display: inline-flex;
            gap: 6px;
            align-items: center;
            margin-left: 4px;
            padding-left: 8px;
            border-left: 1px solid var(--pr-border-subtle, #ddd);
        }
        .pr-export-btn {
            padding: 6px 9px;
            font-size: 0.82em;
            min-width: 46px;
            justify-content: center;
        }
        .pr-export-btn[data-export-kind="html"] {
            border-color: #b06a00;
            color: #b06a00;
            font-weight: 600;
        }
        .pr-export-note {
            font-size: 0.75em;
            color: var(--pr-text-tertiary, #999);
            white-space: nowrap;
        }
        .pr-export-controls.is-busy .pr-export-btn {
            opacity: 0.65;
            pointer-events: none;
        }
        .pr-archive-sort-select {
            margin: 0 8px;
        }
        .pr-toolbar-info {
            display: flex;
            gap: 8px;
            align-items: center;
            margin-left: auto;
            font-size: 0.85em;
            color: var(--pr-text-secondary, #666);
        }
        .pr-result-count {
            white-space: nowrap;
            min-width: 90px;
        }
        .pr-archive-status-badge {
            display: inline-flex;
            align-items: center;
            white-space: nowrap;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 0.8em;
            background: rgba(246, 196, 83, 0.18);
            border: 1px solid rgba(246, 196, 83, 0.45);
            color: #7a4f00;
        }
        .pr-toolbar-reset {
            background: none;
            border: none;
            color: var(--pr-text-tertiary, #999);
            cursor: pointer;
            font-size: 0.85em;
            text-decoration: underline;
            padding: 2px 4px;
            display: none;
        }
        .pr-toolbar-reset:hover {
            color: var(--pr-text-primary, #000);
        }
        .pr-search-container {
            position: relative;
            display: flex;
            align-items: center;
            flex: 1;
            min-width: 260px;
        }
        .pr-search-container .pr-input {
            width: 100%;
            padding-right: 30px;
        }
        .pr-search-clear {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: var(--pr-text-tertiary, #999);
            font-size: 1.2em;
            cursor: pointer;
            padding: 0 4px;
            line-height: 1;
            transition: color 0.2s;
            display: none;
        }
        .pr-search-clear:hover {
            color: var(--pr-text-primary, #000);
        }
        .pr-search-highlight {
            background: rgba(255, 235, 59, 0.4);
            border-radius: 2px;
            padding: 0 1px;
        }
        .pr-debug-explain {
            margin-top: 6px;
            padding-top: 4px;
            border-top: 1px dashed var(--pr-border-subtle, #ddd);
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 0.72em;
            color: var(--pr-text-tertiary, #999);
            line-height: 1.35;
        }
        .pr-toolbar-controls select {
            padding: 8px;
            border-radius: 4px;
            border: 1px solid var(--pr-border-color, #ddd);
            background: var(--pr-bg-secondary, #f9f9f9);
            color: var(--pr-text-primary, #000);
            box-sizing: border-box;
        }
        .pr-segmented-control {
            display: inline-flex;
            border: 1px solid var(--pr-border-color, #ddd);
            border-radius: 6px;
            overflow: hidden;
        }
        .pr-seg-btn {
            padding: 6px 14px;
            border: none;
            background: transparent;
            color: var(--pr-text-secondary, #666);
            cursor: pointer;
            font-size: 0.85em;
            transition: background 0.2s, color 0.2s;
            white-space: nowrap;
        }
        .pr-seg-btn + .pr-seg-btn {
            border-left: 1px solid var(--pr-border-color, #ddd);
        }
        .pr-seg-btn:hover:not(.active) {
            background: var(--pr-bg-hover, #f0f0f0);
        }
        .pr-seg-btn.active {
            background: #0078ff;
            color: #fff;
        }
        .pr-seg-btn:focus-visible {
            outline: 2px solid #0078ff;
            outline-offset: -2px;
        }
        .pr-view-tabs {
            display: inline-flex;
            border: 1px solid var(--pr-border-color, #ddd);
            border-radius: 6px;
            overflow: hidden;
        }
        .pr-view-tab {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 4px;
            padding: 6px 10px;
            border: none;
            background: transparent;
            color: var(--pr-text-secondary, #666);
            cursor: pointer;
            font-size: 0.75em;
            transition: background 0.2s, color 0.2s;
            white-space: nowrap;
        }
        .pr-view-tab + .pr-view-tab {
            border-left: 1px solid var(--pr-border-color, #ddd);
        }
        .pr-view-tab:hover:not(.active) {
            background: var(--pr-bg-hover, #f0f0f0);
        }
        .pr-view-tab.active {
            background: var(--pr-bg-secondary, #f0f0f0);
            color: var(--pr-text-primary, #000);
            font-weight: 600;
        }
        .pr-view-tab:focus-visible {
            outline: 2px solid #0078ff;
            outline-offset: -2px;
        }
        .pr-view-icon {
            font-size: 1.2em;
        }
        .pr-view-label {
            font-size: 0.85em;
        }
        @media (max-width: 800px) {
            .pr-view-label { display: none; }
            .pr-view-tab { padding: 6px 10px; }
        }
        .pr-archive-search-status {
            margin-top: 8px;
            font-size: 0.9em;
            color: var(--pr-text-secondary);
        }
        .pr-status-chip {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 0.8em;
            margin-right: 6px;
            margin-bottom: 4px;
            vertical-align: middle;
        }
        .pr-status-info {
            background: var(--pr-bg-secondary, #f0f0f0);
            color: var(--pr-text-secondary, #666);
        }
        .pr-status-warning {
            background: rgba(246, 196, 83, 0.15);
            color: #b8860b;
        }
        .pr-status-error {
            background: rgba(255, 107, 107, 0.15);
            color: #d32f2f;
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
        .pr-search-help-popover {
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            right: 0;
            margin: 0 auto;
            width: min(95vw, 700px);
            max-height: calc(100vh - var(--pr-archive-toolbar-height, 72px));
            overflow-y: auto;
            z-index: 1600;
            background: var(--pr-bg-secondary, #f9f9f9);
            border: 1px solid var(--pr-border-color, #ddd);
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .pr-search-help-popover .pr-help-content {
            border-top: none;
        }
        .pr-archive-facets {
            margin-top: 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
            max-height: var(--pr-archive-facets-max-height, 120px);
            overflow-y: auto;
        }
        @media (max-height: 760px) {
            .pr-archive-facets {
                max-height: var(--pr-archive-facets-max-height-small, 72px);
            }
        }
        .pr-facet-group {
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .pr-facet-label {
            font-size: 0.8em;
            color: var(--pr-text-tertiary, #999);
            margin-right: 2px;
        }
        .pr-facet-chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 3px 10px;
            border: 1px solid var(--pr-border-color, #ddd);
            border-radius: 14px;
            font-size: 0.8em;
            cursor: pointer;
            background: transparent;
            color: var(--pr-text-secondary, #666);
            transition: background 0.2s, border-color 0.2s;
        }
        .pr-facet-chip:hover {
            background: var(--pr-bg-hover, #f0f0f0);
            border-color: #aaa;
        }
        .pr-facet-chip.active {
            background: rgba(0, 120, 255, 0.1);
            border-color: #0078ff;
            color: #0078ff;
        }
        .pr-facet-count {
            font-size: 0.9em;
            opacity: 0.7;
        }
        .pr-facet-delayed {
            font-size: 0.8em;
            color: var(--pr-text-tertiary, #999);
            font-style: italic;
        }
        .pr-search-example {
            cursor: pointer;
            border: none;
            background: transparent;
            border-radius: 3px;
            padding: 2px 4px;
            font: inherit;
            color: inherit;
        }
        .pr-search-example:hover {
            background: var(--pr-bg-hover, #e0e0e0);
        }
        .pr-search-example:focus-visible {
            outline: 2px solid #0078ff;
            outline-offset: 1px;
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
        .pr-index-linkpost-url {
            margin-left: 6px;
            color: var(--pr-link-color, #0b57d0);
            text-decoration: none;
            font-size: 0.9em;
        }
        .pr-index-linkpost-url:hover {
            text-decoration: underline;
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

    root.innerHTML = `
    <div class="pr-header">
      <h1><a href="${forumHomeUrl}" target="_blank" rel="noopener noreferrer" class="pr-site-home-link">${forumLabel}</a>: User Archive: ${escapeHtml(username)} <small style="font-size: 0.6em; color: #888;">v${__APP_VERSION__}</small></h1>
      <div class="pr-status" id="archive-status">Checking local database...</div>
    </div>
    
    <div class="pr-archive-container">
        <div class="pr-archive-sticky-sentinel" id="archive-sticky-sentinel" aria-hidden="true"></div>
        <div class="pr-archive-sticky-header" id="archive-sticky-header">
            <div class="pr-archive-toolbar">
                <div class="pr-archive-toolbar-primary">
                    <div class="pr-search-container">
                        <input type="text" id="archive-search" placeholder='Search by keyword, "phrase", or operator...' class="pr-input">
                        <button id="archive-search-clear" class="pr-search-clear" type="button" aria-label="Clear search">&times;</button>
                    </div>
                    <button id="archive-search-help-btn" class="pr-button pr-icon-btn" type="button"
                            title="Search syntax help" aria-label="Search help" aria-expanded="false"
                            aria-controls="archive-search-help-popover">?</button>
                    <button id="archive-resync" class="pr-button pr-icon-btn" type="button"
                            title="Force re-download all data" aria-label="Resync">🔄</button>
                    <div id="archive-export-controls" class="pr-export-controls">
                        <button id="archive-export-md" class="pr-button pr-export-btn" type="button"
                                data-export-kind="md"
                                title="Export current results as Markdown (chronological)">
                            MD
                        </button>
                        <button id="archive-export-js" class="pr-button pr-export-btn" type="button"
                                data-export-kind="js"
                                title="Export current results as JavaScript data payload">
                            JS
                        </button>
                        <button id="archive-export-html" class="pr-button pr-export-btn" type="button"
                                data-export-kind="html"
                                title="Export full authored archive as HTML viewer (ignores current filters/scope)">
                            HTML
                        </button>
                        <span class="pr-export-note" title="HTML export always includes full authored archive">
                            HTML=All
                        </span>
                    </div>
                    <div id="archive-search-help-popover" class="pr-search-help-popover pr-help pr-is-hidden"
                         role="region" aria-label="Search syntax reference">
                        <div class="pr-help-content">
                            <div class="pr-help-columns">
                                <div class="pr-help-section">
                                    <h4>Text Search</h4>
                                    <ul>
                                        <li><code>word</code> - plain keyword</li>
                                        <li><code>"exact phrase"</code> - phrase match</li>
                                        <li><code>/regex/i</code> - regex literal</li>
                                        <li><code>*</code> - match all items</li>
                                        <li><code>-term</code> - exclude results matching <code>term</code></li>
                                    </ul>
                                </div>
                                <div class="pr-help-section">
                                    <h4>Field Operators</h4>
                                    <ul>
                                        <li><code>author:name</code> - filter by author</li>
                                        <li><code>replyto:name</code> - filter by parent author</li>
                                        <li><code>type:post</code> or <code>type:comment</code></li>
                                    </ul>
                                </div>
                                <div class="pr-help-section">
                                    <h4>Range Operators</h4>
                                    <ul>
                                        <li><code>score:&gt;10</code> - karma above 10</li>
                                        <li><code>score:5..20</code> - karma 5 to 20</li>
                                        <li><code>date:2025-01-01</code> - exact date</li>
                                        <li><code>date:2025-01..2025-06</code> - date range</li>
                                        <li><code>date:&gt;2025-01-01</code> - after date</li>
                                    </ul>
                                </div>
                                <div class="pr-help-section">
                                    <h4>Examples</h4>
                                    <ul>
                                        <li><button type="button" class="pr-search-example" data-query='author:"Eliezer" score:>50'><code>author:"Eliezer" score:&gt;50</code></button></li>
                                        <li><button type="button" class="pr-search-example" data-query='type:post date:2025-01..2025-06'><code>type:post date:2025-01..2025-06</code></button></li>
                                        <li><button type="button" class="pr-search-example" data-query='"alignment tax" -type:comment'><code>"alignment tax" -type:comment</code></button></li>
                                        <li><button type="button" class="pr-search-example" data-query='* -type:post'><code>* -type:post</code></button> (all comments)</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="pr-archive-toolbar-secondary">
                    <div class="pr-toolbar-controls">
                        <div id="archive-scope" class="pr-segmented-control" role="radiogroup" aria-label="Search scope">
                            <button type="button" data-value="authored" class="pr-seg-btn active" role="radio" aria-checked="true" tabindex="0">Authored</button>
                            <button type="button" data-value="all" class="pr-seg-btn" role="radio" aria-checked="false" tabindex="-1">All</button>
                        </div>
                        <select id="archive-sort" class="pr-archive-sort-select">
                            <option value="date">Date (Newest)</option>
                            <option value="date-asc">Date (Oldest)</option>
                            <option value="score">Karma (High-Low)</option>
                            <option value="score-asc">Karma (Low-High)</option>
                            <option value="replyTo">Reply To (Name)</option>
                            <option value="relevance">Relevance</option>
                        </select>
                        <div id="archive-view" class="pr-view-tabs" role="tablist" aria-label="View mode">
                            <button type="button" data-value="card" class="pr-view-tab active" role="tab"
                                    aria-selected="true" tabindex="0" aria-label="Card view" title="Card View">
                                <span class="pr-view-icon">☰</span>
                                <span class="pr-view-label">Card</span>
                            </button>
                            <button type="button" data-value="index" class="pr-view-tab" role="tab"
                                    aria-selected="false" tabindex="-1" aria-label="Index view" title="Index View">
                                <span class="pr-view-icon">≡</span>
                                <span class="pr-view-label">Index</span>
                            </button>
                            <button type="button" data-value="thread-full" class="pr-view-tab" role="tab"
                                    aria-selected="false" tabindex="-1" aria-label="Thread view full context" title="Thread View (Full Context)">
                                <span class="pr-view-icon">⊞</span>
                                <span class="pr-view-label">Thread</span>
                            </button>
                            <button type="button" data-value="thread-placeholder" class="pr-view-tab" role="tab"
                                    aria-selected="false" tabindex="-1" aria-label="Thread view compact context" title="Thread View (Placeholder Context)">
                                <span class="pr-view-icon">⊟</span>
                                <span class="pr-view-label">Compact</span>
                            </button>
                        </div>
                    </div>
                    <div class="pr-toolbar-info">
                        <span id="archive-status-badge" class="pr-archive-status-badge pr-is-hidden" role="status" aria-live="polite"></span>
                        <span id="archive-result-count" class="pr-result-count"></span>
                        <button id="archive-reset-filters" class="pr-toolbar-reset" type="button">Reset</button>
                    </div>
                </div>
            </div>
            <div id="archive-facets" class="pr-archive-facets" style="display: none;"></div>
        </div>
        <div id="archive-search-status" class="pr-archive-search-status pr-is-hidden"></div>
    </div>

    <div id="archive-error-container" style="display: none;"></div>
    
    <div id="archive-dashboard" class="pr-setup" style="max-width: 800px; display: none;">
      Loading archive data...
    </div>
    <div id="archive-feed" style="margin-top: 20px"></div>
  `;

    const statusEl = document.getElementById('archive-status');
    const dashboardEl = document.getElementById('archive-dashboard');
    const feedEl = document.getElementById('archive-feed');
    const searchInput = document.getElementById('archive-search') as HTMLInputElement;
    const clearBtn = document.getElementById('archive-search-clear') as HTMLButtonElement;
    const scopeContainer = document.getElementById('archive-scope') as HTMLDivElement | null;
    const sortSelect = document.getElementById('archive-sort') as HTMLSelectElement;
    const viewContainer = document.getElementById('archive-view') as HTMLDivElement | null;
    const resultCountEl = document.getElementById('archive-result-count');
    const statusBadgeEl = document.getElementById('archive-status-badge');
    const resetBtn = document.getElementById('archive-reset-filters') as HTMLButtonElement;
    const resyncBtn = document.getElementById('archive-resync');
    const exportControlsEl = document.getElementById('archive-export-controls') as HTMLDivElement | null;
    const exportMdBtn = document.getElementById('archive-export-md') as HTMLButtonElement | null;
    const exportJsBtn = document.getElementById('archive-export-js') as HTMLButtonElement | null;
    const exportHtmlBtn = document.getElementById('archive-export-html') as HTMLButtonElement | null;
    const searchHelpBtn = document.getElementById('archive-search-help-btn') as HTMLButtonElement | null;
    const searchHelpPopoverEl = document.getElementById('archive-search-help-popover');
    const errorContainer = document.getElementById('archive-error-container');
    const searchStatusEl = document.getElementById('archive-search-status');
    const facetsEl = document.getElementById('archive-facets') as HTMLDivElement | null;
    const stickyHeaderEl = document.getElementById('archive-sticky-header');
    const stickySentinelEl = document.getElementById('archive-sticky-sentinel');

    const isArchiveDomDetached = (): boolean => {
      const currentRoot = document.getElementById('power-reader-root');
      const currentFeed = document.getElementById('archive-feed');
      const currentDashboard = document.getElementById('archive-dashboard');
      return !root.isConnected
        || !feedEl?.isConnected
        || !dashboardEl?.isConnected
        || currentRoot !== root
        || currentFeed !== feedEl
        || currentDashboard !== dashboardEl;
    };

    const restartArchiveInitIfDetached = async (phase: string): Promise<boolean> => {
      if (!isArchiveDomDetached()) return false;
      if (recoveryAttempt >= MAX_ARCHIVE_DOM_RECOVERY_ATTEMPTS) {
        throw new Error(`Archive UI was replaced during ${phase}; recovery limit reached.`);
      }
      const nextAttempt = recoveryAttempt + 1;
      Logger.warn(`[Archive Init] DOM detached during ${phase}. Restarting (${nextAttempt}/${MAX_ARCHIVE_DOM_RECOVERY_ATTEMPTS}).`);
      runAbortController.abort();
      await initArchive(username, nextAttempt);
      return true;
    };

    if (searchInput) {
      searchInput.title = [
        'Archive search examples:',
        'author:"wei dai" type:comment score:>20',
        'date:2025-01-01..2025-01-31 "alignment"',
        '/mesa\\s+optimizer/i scope:all'
      ].join('\n');
    }

    const perfMetrics = {
      dbLoadMs: 0,
      networkFetchMs: 0,
      renderMs: 0,
      renderPercent: 0,
      searchMs: 0,
      hooksMs: 0,
      newItems: 0
    };

    let statusBaseMessage = 'Checking local database...';
    let statusSearchResultCount: number | null = null;

    const renderTopStatusLine = (): void => {
      if (!statusEl) return;

      let resultLabel = '';
      if (statusSearchResultCount !== null) {
        resultLabel = `${statusSearchResultCount.toLocaleString()} search results`;
      }

      const metrics: string[] = [];
      if (perfMetrics.dbLoadMs > 0) metrics.push(`DB: ${perfMetrics.dbLoadMs.toFixed(0)}ms`);
      if (perfMetrics.networkFetchMs > 0) metrics.push(`Net: ${perfMetrics.networkFetchMs.toFixed(0)}ms`);
      if (perfMetrics.searchMs > 0) metrics.push(`Search: ${perfMetrics.searchMs.toFixed(0)}ms`);

      if (perfMetrics.renderMs > 0) {
        let renderStr = `Render: ${perfMetrics.renderMs.toFixed(0)}ms`;
        if (perfMetrics.renderPercent > 0 && perfMetrics.renderPercent < 100) {
          renderStr += ` (${perfMetrics.renderPercent}%)`;
        }
        metrics.push(renderStr);
      }

      if (perfMetrics.hooksMs > 0) metrics.push(`Hooks: ${perfMetrics.hooksMs.toFixed(0)}ms`);
      if (perfMetrics.newItems > 0) metrics.push(`+${perfMetrics.newItems} new`);

      const metricsLabel = metrics.length > 0 ? ` [${metrics.join(' | ')}]` : '';

      const parts = [statusBaseMessage];
      if (resultLabel) parts.push(resultLabel);

      statusEl.textContent = parts.join(' | ') + metricsLabel;
    };

    const setArchiveRenderProgress = (percent: number): void => {
      (window as any).__PR_ARCHIVE_RENDER_PROGRESS__ = Math.max(0, Math.min(100, Math.round(percent)));
    };
    setArchiveRenderProgress(0);

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

    const setSearchLoading = (isLoading: boolean): void => {
      resultCountEl?.classList.toggle('is-loading', isLoading);
      feedEl?.classList.toggle('is-loading', isLoading);
    };

    const updateResultCount = (total: number, tookMs: number, canonicalQuery: string): void => {
      if (!resultCountEl) return;
      if (canonicalQuery.trim().length === 0) {
        resultCountEl.textContent = `${total.toLocaleString()} items`;
        return;
      }
      resultCountEl.textContent = `${total.toLocaleString()} result${total === 1 ? '' : 's'} - ${tookMs.toFixed(1)}ms`;
    };

    renderTopStatusLine();

    let activeItems = state.items;
    let lastResolvedScope: ArchiveSearchScope = 'authored';
    let lastCanonicalQuery = searchInput.value;
    let isExportInProgress = false;
    const ILLEGAL_FILENAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);

    const sanitizeFileSegment = (value: string): string => {
      const withNormalizedWhitespace = value.trim().replace(/\s+/g, '_');
      let mapped = '';
      for (const ch of withNormalizedWhitespace) {
        const code = ch.charCodeAt(0);
        mapped += (code < 32 || ILLEGAL_FILENAME_CHARS.has(ch)) ? '-' : ch;
      }
      return mapped
        .replace(/_+/g, '_')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64) || 'archive';
    };

    const createExportFilename = (suffix: string, extension: string): string => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      return `power-reader-archive-${sanitizeFileSegment(username)}-${suffix}-${timestamp}.${extension}`;
    };

    const triggerBlobDownload = (filename: string, mimeType: string, content: string): void => {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.rel = 'noopener';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    };

    const setExportBusyState = (busy: boolean): void => {
      isExportInProgress = busy;
      exportControlsEl?.classList.toggle('is-busy', busy);
      if (exportMdBtn) exportMdBtn.disabled = busy;
      if (exportJsBtn) exportJsBtn.disabled = busy;
      if (exportHtmlBtn) exportHtmlBtn.disabled = busy;
    };

    const buildCurrentViewExportSource = (): ArchiveExportSource => ({
      mode: 'current-view',
      scope: lastResolvedScope,
      sort: state.sortBy,
      query: lastCanonicalQuery
    });

    const runArchiveExport = async (runner: () => Promise<void>): Promise<void> => {
      if (isExportInProgress) return;
      setExportBusyState(true);
      try {
        await runner();
      } catch (error) {
        Logger.error('Archive export failed', error);
        const message = error instanceof Error ? error.message : String(error);
        alert(`Export failed: ${message}`);
      } finally {
        setExportBusyState(false);
      }
    };

    const handleExportMarkdown = async (): Promise<void> => {
      const payload = createArchiveExportPayload(username, activeItems, buildCurrentViewExportSource());
      const markdown = buildArchiveMarkdown(payload);
      triggerBlobDownload(
        createExportFilename('current-view', 'md'),
        'text/markdown;charset=utf-8',
        markdown
      );
    };

    const handleExportJs = async (): Promise<void> => {
      const payload = createArchiveExportPayload(username, activeItems, buildCurrentViewExportSource());
      const jsSource = buildArchiveJsExportSource(payload);
      triggerBlobDownload(
        createExportFilename('current-view', 'js'),
        'text/javascript;charset=utf-8',
        jsSource
      );
    };

    const handleExportHtml = async (): Promise<void> => {
      const stored = await loadArchiveData(username);
      const payload = createArchiveExportPayload(username, stored.items, {
        mode: 'full-archive',
        scope: 'authored',
        sort: 'date',
        query: ''
      });
      const html = buildArchiveHtmlExport(payload);
      triggerBlobDownload(
        createExportFilename('full-archive', 'html'),
        'text/html;charset=utf-8',
        html
      );
    };
    let workerClient: SearchWorkerClient;
    try {
      workerClient = createSearchWorkerClient();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Archive search worker unavailable: ${reason}`, { cause: error });
    }

    const searchManager = new ArchiveSearchManager({
      workerClient
    });

    // Controller to cancel background rendering when new query starts
    let activeRenderController: AbortController | null = null;

    // Observer for lazy post action button refresh
    let postObserver: IntersectionObserver | null = null;
    let stickyObserver: IntersectionObserver | null = null;
    const initPostObserver = () => {
      if (postObserver) postObserver.disconnect();
      postObserver = new IntersectionObserver((entries) => {
        const start = performance.now();
        let refreshCount = 0;
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            refreshPostActionButtons(el);
            refreshCount++;
            postObserver?.unobserve(el); // Only need to refresh once on scroll-in
          }
        });
        if (refreshCount > 0) {
          const duration = performance.now() - start;
          console.log(`[Archive Observer] Refreshed ${refreshCount} posts in ${duration.toFixed(2)}ms`);
        }
      }, { rootMargin: '200px' }); // Refresh slightly before they enter viewport
    };

    const initStickyObserver = (): void => {
      if (!stickyHeaderEl || !stickySentinelEl) return;
      stickyObserver?.disconnect();
      stickyObserver = new IntersectionObserver((entries) => {
        const entry = entries[0];
        stickyHeaderEl.classList.toggle('pr-is-scrolled', !entry?.isIntersecting);
      }, { threshold: [0], rootMargin: '1px 0px 0px 0px' });
      stickyObserver.observe(stickySentinelEl);
    };
    initStickyObserver();
    runAbortController.signal.addEventListener('abort', () => {
      stickyObserver?.disconnect();
      postObserver?.disconnect();
    }, { once: true });

    const urlState = parseArchiveUrlState();
    const isDebugExplainEnabled = (): boolean =>
      new URLSearchParams(window.location.search).get('debug') === '1';
    let persistedContextItems: ArchiveItem[] = [];
    let useDedicatedScopeParam = urlState.scopeFromUrl;
    let searchDispatchTimer: number | null = null;
    let activeQueryRequestId = 0;
    let activeItemById = new Map<string, ArchiveItem>();
    let activeDebugRelevanceSignalsById: Record<string, RelevanceSignals> | null = null;
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
    const DEFAULT_SCOPE: ArchiveSearchScope = 'authored';
    const DEFAULT_SORT: ArchiveSortBy = 'date';
    const DEFAULT_VIEW: ArchiveViewMode = 'card';
    let scopeFallbackValue: ArchiveSearchScope = DEFAULT_SCOPE;
    let viewFallbackValue: ArchiveViewMode = DEFAULT_VIEW;
    let viewModeRefreshTimer: number | null = null;
    let pendingSortResetMessage: string | null = null;
    let facetsRefineTimer: number | null = null;
    let facetsRefineIdleHandle: number | null = null;
    let facetsRefineToken = 0;
    let lastRenderedFacetSignature: string | null = null;
    let baselineFacetSnapshots: Partial<Record<ArchiveFacetScope, ArchiveBaselineFacetSnapshot>> = {};
    const baselineFacetSnapshotSignatures: Partial<Record<ArchiveFacetScope, string>> = {};

    const rebuildCanonicalItemMap = (): void => {
      state.itemById.clear();
      for (const item of state.items) {
        state.itemById.set(item._id, item);
      }
    };

    const invalidateAuthoredSearchIndex = (): void => {
      authoredIndexItemsRef = null;
      authoredIndexCanonicalRevision = -1;
      contextSearchItemsCache = null;
    };

    const markCanonicalItemsMutated = (): void => {
      rebuildCanonicalItemMap();
      state.canonicalVersion += 1;
      invalidateAuthoredSearchIndex();
    };

    const replaceCanonicalItems = (items: ArchiveItem[]): void => {
      state.items = items;
      markCanonicalItemsMutated();
      clearPendingFacetRefine();
    };

    const getScopeButtons = (): HTMLButtonElement[] =>
      scopeContainer
        ? Array.from(scopeContainer.querySelectorAll('.pr-seg-btn')) as HTMLButtonElement[]
        : [];

    const getScopeValue = (): ArchiveSearchScope => {
      if (!scopeContainer) return scopeFallbackValue;
      const active = scopeContainer.querySelector('.pr-seg-btn.active') as HTMLButtonElement | null;
      return (active?.dataset.value as ArchiveSearchScope) || scopeFallbackValue;
    };

    const setScopeValue = (value: ArchiveSearchScope): void => {
      scopeFallbackValue = value;
      for (const button of getScopeButtons()) {
        const isActive = button.dataset.value === value;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-checked', String(isActive));
        button.tabIndex = isActive ? 0 : -1;
      }
    };

    const getViewTabs = (): HTMLButtonElement[] =>
      viewContainer
        ? Array.from(viewContainer.querySelectorAll('.pr-view-tab')) as HTMLButtonElement[]
        : [];

    const getViewValue = (): ArchiveViewMode => {
      if (!viewContainer) return viewFallbackValue;
      const active = viewContainer.querySelector('.pr-view-tab.active') as HTMLButtonElement | null;
      return (active?.dataset.value as ArchiveViewMode) || viewFallbackValue;
    };

    const setViewValue = (value: ArchiveViewMode): void => {
      viewFallbackValue = value;
      for (const tab of getViewTabs()) {
        const isActive = tab.dataset.value === value;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
        tab.tabIndex = isActive ? 0 : -1;
      }
    };

    const updateClearButton = (): void => {
      if (!clearBtn) return;
      clearBtn.style.display = searchInput.value.length > 0 ? 'inline-flex' : 'none';
    };

    const deriveHasContentQuery = (query: string): boolean => {
      const parsed = parseStructuredQuery(query);
      return parsed.clauses.some(isPositiveContentWithoutWildcard);
    };

    const updateSortOptions = (hasContentQuery: boolean, viewMode: ArchiveViewMode): void => {
      const replyToOption = sortSelect.querySelector('option[value="replyTo"]') as HTMLOptionElement | null;
      const relevanceOption = sortSelect.querySelector('option[value="relevance"]') as HTMLOptionElement | null;
      const threadMode = isThreadMode(viewMode);

      if (replyToOption) {
        replyToOption.disabled = threadMode;
        replyToOption.title = threadMode ? 'Not available in thread view' : '';
      }

      const relevanceDisabled = threadMode || !hasContentQuery;
      if (relevanceOption) {
        relevanceOption.disabled = relevanceDisabled;
        relevanceOption.title = threadMode
          ? 'Not available in thread view'
          : (!hasContentQuery ? 'Relevance sorting requires a search query' : '');
      }

      const selectedSort = sortSelect.value as ArchiveSortBy;
      if (threadMode && selectedSort === 'replyTo') {
        sortSelect.value = DEFAULT_SORT;
        state.sortBy = DEFAULT_SORT;
        pendingSortResetMessage = 'Sort reset to Date: Reply To is not available in thread view';
      }

      if (relevanceDisabled && selectedSort === 'relevance') {
        sortSelect.value = DEFAULT_SORT;
        state.sortBy = DEFAULT_SORT;
        pendingSortResetMessage = threadMode
          ? 'Sort reset to Date: Relevance is not available in thread view'
          : 'Sort reset to Date: Relevance requires a search query';
      }
    };

    type ArchiveUiState = {
      query: string;
      scope: ArchiveSearchScope;
      sort: ArchiveSortBy;
      view: ArchiveViewMode;
    };

    const readUiState = (): ArchiveUiState => ({
      query: searchInput.value,
      scope: getScopeValue(),
      sort: sortSelect.value as ArchiveSortBy,
      view: getViewValue()
    });

    const getHighlightTermsFromQuery = (query: string): string[] =>
      extractHighlightTerms(query.trim());

    const getRenderOptionsForQuery = (query: string): { snippetTerms: string[] } => ({
      snippetTerms: getHighlightTermsFromQuery(query)
    });

    const getCurrentRenderOptions = (): { snippetTerms: string[] } =>
      getRenderOptionsForQuery(searchInput.value);

    const normalizeQueryWhitespace = (value: string): string =>
      value.replace(/\s+/g, ' ').trim();

    const escapeRegExp = (value: string): string =>
      value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const getFragmentKind = (fragment: string): string | null => {
      const match = fragment.match(/^([a-z][a-z0-9_-]*):/i);
      return match ? match[1].toLowerCase() : null;
    };

    const removeQueryFragment = (input: HTMLInputElement, fragment: string): boolean => {
      const escaped = escapeRegExp(fragment);
      let removed = false;
      const pattern = new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'gi');
      input.value = normalizeQueryWhitespace(input.value.replace(pattern, () => {
        removed = true;
        return ' ';
      }));
      return removed;
    };

    const removeQueryFragmentsByKind = (input: HTMLInputElement, kind: string): boolean => {
      let removed = false;
      const kindPattern = new RegExp(
        `(^|\\s)-?${escapeRegExp(kind)}:(?:"(?:[^"\\\\]|\\\\.)*"|\\S+)(?=\\s|$)`,
        'gi'
      );
      input.value = normalizeQueryWhitespace(input.value.replace(kindPattern, () => {
        removed = true;
        return ' ';
      }));
      return removed;
    };

    const appendOrReplaceQueryFragment = (input: HTMLInputElement, fragment: string): void => {
      const kind = getFragmentKind(fragment);
      if (kind) {
        removeQueryFragmentsByKind(input, kind);
      }
      input.value = normalizeQueryWhitespace(input.value ? `${input.value} ${fragment}` : fragment);
    };

    const createFacetDelayedMessageEl = (): HTMLSpanElement => {
      const delayedEl = document.createElement('span');
      delayedEl.className = 'pr-facet-delayed';
      delayedEl.textContent = 'Facet counts sampled - calculating exact counts...';
      return delayedEl;
    };

    const toFacetScope = (scope: ArchiveSearchScope): ArchiveFacetScope =>
      scope === 'all' ? 'all' : 'authored';

    const createFacetGroupsSignature = (groups: readonly FacetGroup[]): string =>
      groups.map(group => {
        const itemsSignature = group.items.map(item =>
          `${item.value}\u001F${item.queryFragment}\u001F${item.count}\u001F${item.active ? 1 : 0}`
        ).join('\u001E');
        return `${group.label}\u001D${itemsSignature}`;
      }).join('\u001C');

    const createFacetSnapshotSignature = (snapshot: {
      syncKey: string | null;
      contextCount: number;
      groups: FacetGroup[];
      delayed: boolean;
    }): string =>
      `${snapshot.syncKey ?? ''}\u001B${snapshot.contextCount}\u001B${snapshot.delayed ? 1 : 0}\u001B${createFacetGroupsSignature(snapshot.groups)}`;

    const createFacetResultSignature = (result: Pick<FacetResult, 'groups' | 'delayed'>): string =>
      `${result.delayed ? 1 : 0}\u001B${createFacetGroupsSignature(result.groups)}`;

    const getNoQueryContextCount = (scope: ArchiveSearchScope, contextItemCount: number): number =>
      scope === 'all' ? contextItemCount : 0;

    const isNoQuery = (query: string): boolean =>
      query.trim().length === 0;

    const clearPendingFacetRefine = (): void => {
      facetsRefineToken += 1;
      if (facetsRefineIdleHandle !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(facetsRefineIdleHandle);
        facetsRefineIdleHandle = null;
      }
      if (facetsRefineTimer !== null) {
        window.clearTimeout(facetsRefineTimer);
        facetsRefineTimer = null;
      }
    };
    runAbortController.signal.addEventListener('abort', clearPendingFacetRefine, { once: true });

    const scheduleFacetRefineTask = (task: () => void): void => {
      if (typeof window.requestIdleCallback === 'function') {
        facetsRefineIdleHandle = window.requestIdleCallback(() => {
          facetsRefineIdleHandle = null;
          task();
        }, { timeout: 200 });
        return;
      }

      facetsRefineTimer = window.setTimeout(() => {
        facetsRefineTimer = null;
        task();
      }, 16);
    };

    const persistBaselineFacetSnapshot = (
      scope: ArchiveSearchScope,
      contextItemCount: number,
      result: Pick<FacetResult, 'groups' | 'delayed'>
    ): void => {
      const facetScope = toFacetScope(scope);
      const snapshot: ArchiveBaselineFacetSnapshot = {
        syncKey: state.lastSyncDate,
        contextCount: getNoQueryContextCount(scope, contextItemCount),
        groups: result.groups,
        delayed: result.delayed,
        updatedAt: Date.now()
      };
      const signature = createFacetSnapshotSignature(snapshot);
      if (baselineFacetSnapshotSignatures[facetScope] === signature) return;

      baselineFacetSnapshots[facetScope] = snapshot;
      baselineFacetSnapshotSignatures[facetScope] = signature;
      void saveArchiveBaselineFacets(username, facetScope, {
        syncKey: snapshot.syncKey,
        contextCount: snapshot.contextCount,
        groups: snapshot.groups,
        delayed: snapshot.delayed
      }).catch((error) => {
        Logger.warn('Failed to save archive baseline facets snapshot', error);
      });
    };

    const getValidBaselineFacetSnapshot = (
      scope: ArchiveSearchScope,
      contextItemCount: number
    ): ArchiveBaselineFacetSnapshot | null => {
      const snapshot = baselineFacetSnapshots[toFacetScope(scope)];
      if (!snapshot) return null;
      if (snapshot.syncKey !== state.lastSyncDate) return null;
      if (snapshot.contextCount !== getNoQueryContextCount(scope, contextItemCount)) return null;
      return snapshot;
    };

    const clearFacetUi = (): void => {
      if (!facetsEl) return;
      facetsEl.replaceChildren();
      facetsEl.style.display = 'none';
      lastRenderedFacetSignature = null;
      clearPendingFacetRefine();
    };

    const renderFacetResult = (facetResult: Pick<FacetResult, 'groups' | 'delayed'>): void => {
      if (!facetsEl) return;
      const hasFacetItems = facetResult.groups.some(group => group.items.length > 0);
      if (!hasFacetItems && !facetResult.delayed) {
        clearFacetUi();
        return;
      }
      const signature = createFacetResultSignature(facetResult);
      if (signature === lastRenderedFacetSignature) return;
      lastRenderedFacetSignature = signature;

      const fragment = document.createDocumentFragment();
      for (const group of facetResult.groups) {
        if (group.items.length === 0) continue;
        const groupEl = document.createElement('div');
        groupEl.className = 'pr-facet-group';

        const labelEl = document.createElement('span');
        labelEl.className = 'pr-facet-label';
        labelEl.textContent = `${group.label}:`;
        groupEl.appendChild(labelEl);

        for (const item of group.items) {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = `pr-facet-chip${item.active ? ' active' : ''}`;
          chip.dataset.fragment = item.queryFragment;
          chip.title = `${item.value} (${item.count})`;

          const valueText = document.createTextNode(item.value);
          const countEl = document.createElement('span');
          countEl.className = 'pr-facet-count';
          countEl.textContent = `(${item.count})`;
          chip.append(valueText, countEl);
          groupEl.appendChild(chip);
        }

        fragment.appendChild(groupEl);
      }

      if (facetResult.delayed) {
        fragment.appendChild(createFacetDelayedMessageEl());
      }

      facetsEl.replaceChildren(fragment);
      facetsEl.style.display = '';
    };

    const scheduleExactNoQueryFacetRefine = (
      items: readonly ArchiveItem[],
      scope: ArchiveSearchScope,
      contextItemCount: number,
      requestId: number,
      seed?: { accumulator: ReturnType<typeof createFacetAccumulator>; startIndex: number }
    ): void => {
      clearPendingFacetRefine();
      const refineToken = facetsRefineToken;
      const accumulator = seed?.accumulator ?? createFacetAccumulator();
      let nextIndex = seed?.startIndex ?? 0;

      const runRefineChunk = (): void => {
        if (!isCurrentRun() || refineToken !== facetsRefineToken) return;
        if (requestId !== activeQueryRequestId) return;
        const currentUi = readUiState();
        if (!isNoQuery(currentUi.query) || currentUi.scope !== scope) return;

        const chunkResult = scanFacetChunk(items, currentUi.query, {
          accumulator,
          startIndex: nextIndex,
          budgetMs: NO_QUERY_EXACT_FACET_REFINE_BUDGET_MS
        });
        nextIndex = chunkResult.nextIndex;
        if (!isCurrentRun() || refineToken !== facetsRefineToken) return;
        if (requestId !== activeQueryRequestId) return;
        const latestUi = readUiState();
        if (!isNoQuery(latestUi.query) || latestUi.scope !== scope) return;

        renderFacetResult(chunkResult);

        if (chunkResult.done) {
          persistBaselineFacetSnapshot(scope, contextItemCount, chunkResult);
          return;
        }

        scheduleFacetRefineTask(runRefineChunk);
      };

      scheduleFacetRefineTask(runRefineChunk);
    };

    const renderFacets = (
      items: readonly ArchiveItem[],
      query: string,
      scope: ArchiveSearchScope,
      contextItemCount: number,
      requestId: number
    ): void => {
      if (!isNoQuery(query)) {
        clearPendingFacetRefine();
        renderFacetResult(computeFacets(items, query));
        return;
      }

      const cachedSnapshot = getValidBaselineFacetSnapshot(scope, contextItemCount);
      if (cachedSnapshot) {
        renderFacetResult(cachedSnapshot);
        if (cachedSnapshot.delayed) {
          scheduleExactNoQueryFacetRefine(items, scope, contextItemCount, requestId);
        }
        return;
      }

      const sampledResult = scanFacetChunk(items, query);
      renderFacetResult(sampledResult);
      persistBaselineFacetSnapshot(scope, contextItemCount, sampledResult);
      if (sampledResult.delayed) {
        scheduleExactNoQueryFacetRefine(items, scope, contextItemCount, requestId, {
          accumulator: sampledResult.accumulator,
          startIndex: sampledResult.nextIndex
        });
      } else {
        clearPendingFacetRefine();
      }
    };

    const isNonDefaultState = (): boolean => {
      const current = readUiState();
      return (
        current.query.length > 0 ||
        current.scope !== DEFAULT_SCOPE ||
        current.sort !== DEFAULT_SORT ||
        current.view !== DEFAULT_VIEW
      );
    };

    const updateResetButton = (): void => {
      if (!resetBtn) return;
      resetBtn.style.display = isNonDefaultState() ? 'inline-block' : 'none';
    };

    const applyUiState = (next: Partial<ArchiveUiState>, options: { silent?: boolean } = {}): void => {
      if (next.query !== undefined) searchInput.value = next.query;
      if (next.scope !== undefined) setScopeValue(next.scope);
      if (next.sort !== undefined) {
        sortSelect.value = next.sort;
        state.sortBy = next.sort as ArchiveSortBy;
      }
      if (next.view !== undefined) {
        setViewValue(next.view);
        state.viewMode = next.view;
        updateSortOptions(deriveHasContentQuery(searchInput.value), next.view);
      }

      if (!options.silent) {
        updateClearButton();
        updateResetButton();
      }
    };

    const writeCurrentToolbarUrlState = (query: string): void => {
      const current = readUiState();
      writeArchiveUrlState({
        query,
        scope: current.scope,
        sort: current.sort
      });
    };

    const initialSort = sortSelect.querySelector(`option[value="${urlState.sort}"]`)
      ? urlState.sort
      : DEFAULT_SORT;
    applyUiState({
      query: urlState.query,
      scope: urlState.scope,
      sort: initialSort as ArchiveSortBy,
      view: state.viewMode
    }, { silent: true });
    setScopeValue(getScopeValue());
    setViewValue(getViewValue());
    updateClearButton();
    updateResetButton();
    updateResultCount(state.items.length, 0, '');

    const applySearchHighlight = (): void => {
      if (!feedEl) return;

      const terms = getHighlightTermsFromQuery(searchInput.value);
      const termsKey = Array.from(new Set(terms)).sort((a, b) => a.localeCompare(b)).join('\u001F');
      const highlightTargets = feedEl.querySelectorAll('.pr-comment-body, .pr-post-body, .pr-index-title');
      if (highlightTargets.length > MAX_SEARCH_HIGHLIGHT_TARGETS) return;

      highlightTargets.forEach((el) => {
        const node = el as HTMLElement;
        if (node.getAttribute('data-pr-highlighted-terms') === termsKey) return;
        highlightTermsInContainer(node, terms);
      });
    };

    const computeDebugRelevanceScore = (signals: RelevanceSignals): number =>
      (signals.tokenHits * 10)
      + (signals.phraseHits * 15)
      + (signals.authorHit ? 8 : 0)
      + (signals.replyToHit ? 6 : 0);

    const clearDebugExplainAnnotations = (): void => {
      if (!feedEl) return;
      const existing = feedEl.querySelectorAll('.pr-debug-explain');
      existing.forEach(node => node.remove());
    };

    const applyDebugExplainAnnotations = (): void => {
      clearDebugExplainAnnotations();
      if (!feedEl) return;
      if (!isDebugExplainEnabled()) return;
      if (!activeDebugRelevanceSignalsById) return;

      const appendExplain = (target: HTMLElement, signals: RelevanceSignals | undefined): void => {
        const explainEl = document.createElement('div');
        explainEl.className = 'pr-debug-explain';
        if (!signals) {
          explainEl.textContent = 'debug: relevance=no-signal';
        } else {
          explainEl.textContent = [
            `debug: relevance=${computeDebugRelevanceScore(signals)}`,
            `token=${signals.tokenHits}`,
            `phrase=${signals.phraseHits}`,
            `author=${signals.authorHit ? 1 : 0}`,
            `replyTo=${signals.replyToHit ? 1 : 0}`
          ].join(' ');
        }
        target.appendChild(explainEl);
      };

      // Card rows can contain nested context comments that reuse data-id values.
      // Map annotations by top-level render order to keep each badge attached to its result row.
      if (getViewValue() === 'card') {
        const cardRows = Array.from(feedEl.children).filter((node): node is HTMLElement =>
          node instanceof HTMLElement && node.classList.contains('pr-archive-item')
        );
        const visibleCount = Math.min(cardRows.length, activeItems.length);
        for (let i = 0; i < visibleCount; i++) {
          const item = activeItems[i];
          appendExplain(cardRows[i], activeDebugRelevanceSignalsById[item._id]);
        }
        return;
      }

      const renderedTargets = feedEl.querySelectorAll('[data-id]');
      const seenIds = new Set<string>();
      renderedTargets.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const id = node.dataset.id;
        if (!id || seenIds.has(id)) return;
        seenIds.add(id);
        if (activeDebugRelevanceSignalsById && activeDebugRelevanceSignalsById[id]) {
          appendExplain(node, activeDebugRelevanceSignalsById[id]);
        }
      });

    };

    const runPostRenderHooks = () => {
      const start = performance.now();

      // 1. Delegated link previews (O(1) init)
      setupLinkPreviewsDelegated(feedEl!, uiHost.getReaderState().comments);

      // 2. Lazy post action button refresh via IntersectionObserver
      // This avoids layout thrashing on 8k items at once
      initPostObserver();
      const posts = feedEl!.querySelectorAll('.pr-post');
      posts.forEach(p => postObserver?.observe(p));

      // 3. Highlight and Debug (Only run if active)
      applySearchHighlight();
      applyDebugExplainAnnotations();

      perfMetrics.hooksMs = performance.now() - start;
      renderTopStatusLine();
    };

    const syncAuthoredSearchIndex = (): void => {
      const canonicalRevision = state.canonicalVersion;
      if (authoredIndexItemsRef === state.items && authoredIndexCanonicalRevision === canonicalRevision) return;
      searchManager.setAuthoredItems(state.items, canonicalRevision);
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
      sortMode: ArchiveSortBy
    ) => {
      if (!searchStatusEl) return;

      searchStatusEl.textContent = '';
      if (statusBadgeEl) {
        statusBadgeEl.classList.add('pr-is-hidden');
        statusBadgeEl.textContent = '';
        statusBadgeEl.removeAttribute('title');
      }

      const addChip = (text: string, type: 'info' | 'warning' | 'error' = 'info'): void => {
        const chip = document.createElement('span');
        chip.className = `pr-status-chip pr-status-${type}`;
        chip.textContent = text;
        searchStatusEl.appendChild(chip);
      };

      let hasMessages = false;
      const criticalMessages: string[] = [];

      if (resolvedScope === 'all') {
        addChip(`Scope: authored + ${contextItemCount} context items`, 'info');
        hasMessages = true;
        if (contextItemCount === 0) {
          const contextWarning = 'Context cache may be incomplete';
          addChip(contextWarning, 'warning');
          criticalMessages.push(contextWarning);
          hasMessages = true;
        }
        if (sortMode === 'replyTo') {
          addChip('replyTo ordering uses mixed authored/context semantics', 'info');
          hasMessages = true;
        }
      }

      if (diagnostics.partialResults) {
        const partialLabel = `Partial results (${diagnostics.tookMs}ms budget hit)`;
        addChip(partialLabel, 'warning');
        criticalMessages.push(partialLabel);
        hasMessages = true;

        const retryBtn = document.createElement('button');
        retryBtn.className = 'pr-search-retry-btn';
        retryBtn.textContent = 'Run without time limit';
        retryBtn.addEventListener('click', async () => {
          await refreshView(0);
        });
        searchStatusEl.appendChild(retryBtn);
      }

      for (const warning of diagnostics.warnings) {
        const type = warning.type === 'negation-only' || warning.type === 'invalid-query'
          ? 'error'
          : 'warning';
        addChip(warning.message, type);
        criticalMessages.push(warning.message);
        hasMessages = true;
      }

      if (pendingSortResetMessage) {
        addChip(pendingSortResetMessage, 'info');
        pendingSortResetMessage = null;
        hasMessages = true;
      }

      if (statusBadgeEl) {
        const hasCriticalDiagnostics = criticalMessages.length > 0;
        statusBadgeEl.classList.toggle('pr-is-hidden', !hasCriticalDiagnostics);
        if (hasCriticalDiagnostics) {
          const diagnosticsWarningSummary = diagnostics.partialResults
            ? `Partial results${criticalMessages.length > 1 ? ` (+${criticalMessages.length - 1})` : ''}`
            : `${criticalMessages.length} issue${criticalMessages.length === 1 ? '' : 's'}`;
          statusBadgeEl.textContent = diagnosticsWarningSummary;
          statusBadgeEl.title = criticalMessages.join('\n');
        }
      }

      searchStatusEl.classList.toggle('pr-is-hidden', !hasMessages);
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
      if (!isCurrentRun()) return;
      const requestId = ++activeQueryRequestId;
      if (isArchiveDomDetached()) {
        Logger.debug('Skipping refreshView because archive DOM is detached');
        return;
      }
      const currentUi = readUiState();
      const debugExplain = isDebugExplainEnabled();
      const hasContentQuery = deriveHasContentQuery(currentUi.query);
      updateSortOptions(hasContentQuery, currentUi.view);
      const sortMode = sortSelect.value as ArchiveSortBy;
      setSearchLoading(true);
      document.body.style.cursor = 'wait';
      perfMetrics.searchMs = 0;
      perfMetrics.renderMs = 0;
      perfMetrics.hooksMs = 0;
      perfMetrics.renderPercent = 0;

      try {
        syncAuthoredSearchIndex();
        const contextItems = collectContextSearchItems();
        if (isNoQuery(currentUi.query)) {
          const cachedSnapshot = getValidBaselineFacetSnapshot(currentUi.scope, contextItems.length);
          if (cachedSnapshot) {
            renderFacetResult(cachedSnapshot);
          }
        } else {
          clearPendingFacetRefine();
        }
        searchManager.setContextItems(contextItems);
        const scopeParam = useDedicatedScopeParam ? currentUi.scope : undefined;
        const searchStart = performance.now();
        const result = await searchManager.runSearch({
          query: currentUi.query,
          scopeParam,
          sortMode,
          limit: state.items.length + contextItems.length + 5,
          debugExplain,
          ...(budgetMs !== undefined ? { budgetMs } : {})
        });
        perfMetrics.searchMs = performance.now() - searchStart;

        if (requestId !== activeQueryRequestId) {
          return;
        }

        activeItems = result.items;
        activeItemById = new Map(activeItems.map(item => [item._id, item]));
        lastResolvedScope = result.resolvedScope;
        lastCanonicalQuery = result.canonicalQuery;
        activeDebugRelevanceSignalsById = debugExplain
          ? (result.debugExplain?.relevanceSignalsById || {})
          : null;
        ensureSearchResultContextLoaded(activeItems);
        if (!useDedicatedScopeParam && result.resolvedScope !== 'authored') {
          useDedicatedScopeParam = true;
        }
        setScopeValue(result.resolvedScope);
        writeArchiveUrlState({
          query: result.canonicalQuery,
          scope: result.resolvedScope,
          sort: sortMode
        });
        setStatusSearchResultCount(result.total);
        updateResultCount(result.total, result.diagnostics.tookMs, result.canonicalQuery);
        updateSearchStatus(result.diagnostics, result.resolvedScope, contextItems.length, sortMode);
        renderFacets(result.items, result.canonicalQuery, result.resolvedScope, contextItems.length, requestId);
        updateResetButton();
        const renderOptions = getRenderOptionsForQuery(currentUi.query);

        // 3. Check if we need to ask user about render count for large datasets
        const totalItems = activeItems.length;
        if (totalItems >= LARGE_DATASET_THRESHOLD && pendingRenderCount === null) {
          // Show dialog to ask user how many to render
          showRenderCountDialog(totalItems, async (count: number) => {
            pendingRenderCount = count;
            updateRenderLimit(count);
            // Render!
            let hooksPrimed = false;
            setArchiveRenderProgress(0);
            await renderArchiveFeed(feedEl!, activeItems, state.viewMode, uiHost.getReaderState(), state.sortBy, {
              ...renderOptions,
              onProgress: (percent) => {
                setArchiveRenderProgress(percent);
                if (!hooksPrimed && percent > 0) {
                  hooksPrimed = true;
                  runPostRenderHooks();
                }
              }
            });
            setArchiveRenderProgress(100);
            if (!hooksPrimed) {
              runPostRenderHooks();
            }
          });
          return;
        }

        // 4. Render
        // Abort any existing background rendering
        if (activeRenderController) {
          activeRenderController.abort();
        }
        activeRenderController = new AbortController();

        // Only override render limit for large datasets where user explicitly chose a count.
        // Default render limit stays uncapped unless a test/dev override is provided.
        if (pendingRenderCount !== null) {
          updateRenderLimit(pendingRenderCount);
        }

        // Use renderArchiveFeed directly with current activeItems (view) and host's readerState (data)
        // [WS3-FIX] Pass sortBy for thread view group-level sorting
        const renderStart = performance.now();
        perfMetrics.renderPercent = 0;
        let hooksPrimed = false;
        setArchiveRenderProgress(0);

        await renderArchiveFeed(feedEl!, activeItems, state.viewMode, uiHost.getReaderState(), state.sortBy, {
          ...renderOptions,
          abortSignal: activeRenderController.signal,
          onProgress: (percent) => {
            perfMetrics.renderPercent = percent;
            perfMetrics.renderMs = performance.now() - renderStart;
            setArchiveRenderProgress(percent);
            renderTopStatusLine();
            if (!hooksPrimed && percent > 0) {
              hooksPrimed = true;
              runPostRenderHooks();
            }
          }
        });

        if (activeRenderController.signal.aborted) {
          return;
        }

        perfMetrics.renderMs = performance.now() - renderStart;
        perfMetrics.renderPercent = 100;
        setArchiveRenderProgress(100);
        renderTopStatusLine();

        if (!hooksPrimed) {
          runPostRenderHooks();
        }
      } finally {
        if (requestId === activeQueryRequestId) {
          setSearchLoading(false);
          document.body.style.cursor = '';
        }
      }
    };

    const uiHost = new ArchiveUIHost(state, feedEl, refreshView);
    setUIHost(uiHost);

    // Attach standard event listeners using the host's reader state
    attachEventListeners(uiHost.getReaderState());
    initReactionTooltips();
    setupExternalLinks();
    setupInlineReactions(uiHost.getReaderState());

    const syncErrorState: SyncErrorState = {
      isRetrying: false,
      retryCount: 0,
      abortController: null
    };
    runAbortController.signal.addEventListener('abort', () => {
      syncErrorState.abortController?.abort();
    }, { once: true });

    // Helper to reconcile canonical map/index trackers after direct state mutations
    const updateItemMap = () => {
      if (!isCurrentRun()) return;
      markCanonicalItemsMutated();
      syncAuthoredSearchIndex();

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
            The selected count is your session render cap. Choose "Render All" to avoid truncation.
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
      searchDispatchTimer = window.setTimeout(async () => {
        await refreshView();
      }, SEARCH_DEBOUNCE_MS);
    };

    searchInput?.addEventListener('input', () => {
      updateClearButton();
      updateSortOptions(deriveHasContentQuery(searchInput.value), getViewValue());
      updateResetButton();
      scheduleSearchRefresh();
    });

    clearBtn?.addEventListener('click', async () => {
      if (!searchInput.value) return;
      searchInput.value = '';
      updateClearButton();
      if (searchDispatchTimer) {
        window.clearTimeout(searchDispatchTimer);
        searchDispatchTimer = null;
      }
      updateSortOptions(deriveHasContentQuery(searchInput.value), getViewValue());
      updateResetButton();
      writeCurrentToolbarUrlState('');
      await refreshView();
      searchInput.focus();
    });

    exportMdBtn?.addEventListener('click', () => {
      void runArchiveExport(handleExportMarkdown);
    });

    exportJsBtn?.addEventListener('click', () => {
      void runArchiveExport(handleExportJs);
    });

    exportHtmlBtn?.addEventListener('click', () => {
      void runArchiveExport(handleExportHtml);
    });

    let isSearchHelpPopoverOpen = false;
    const handleSearchHelpDocumentPointerDown = (event: PointerEvent): void => {
      if (!isSearchHelpPopoverOpen || !searchHelpPopoverEl) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (searchHelpPopoverEl.contains(target)) return;
      if (searchHelpBtn?.contains(target)) return;
      setSearchHelpPopoverOpen(false);
    };
    const handleSearchHelpDocumentKeydown = (event: KeyboardEvent): void => {
      if (!isSearchHelpPopoverOpen || event.key !== 'Escape') return;
      const target = event.target as Node | null;
      if (target && (searchHelpPopoverEl?.contains(target) || searchHelpBtn?.contains(target))) {
        event.preventDefault();
        event.stopPropagation();
      }
      setSearchHelpPopoverOpen(false);
      searchHelpBtn?.focus();
    };
    const setSearchHelpPopoverOpen = (open: boolean): void => {
      if (!searchHelpPopoverEl || !searchHelpBtn) return;
      if (isSearchHelpPopoverOpen === open) return;
      isSearchHelpPopoverOpen = open;
      searchHelpPopoverEl.classList.toggle('pr-is-hidden', !open);
      searchHelpBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        document.addEventListener('pointerdown', handleSearchHelpDocumentPointerDown);
        document.addEventListener('keydown', handleSearchHelpDocumentKeydown);
      } else {
        document.removeEventListener('pointerdown', handleSearchHelpDocumentPointerDown);
        document.removeEventListener('keydown', handleSearchHelpDocumentKeydown);
      }
    };
    searchHelpBtn?.addEventListener('click', (event: MouseEvent) => {
      event.preventDefault();
      setSearchHelpPopoverOpen(!isSearchHelpPopoverOpen);
    });

    searchHelpPopoverEl?.addEventListener('click', async (event: Event) => {
      const target = (event.target as HTMLElement).closest('.pr-search-example') as HTMLElement | null;
      if (!target) return;
      const query = target.dataset.query;
      if (!query) return;
      setSearchHelpPopoverOpen(false);
      searchInput.value = query;
      updateClearButton();
      updateSortOptions(deriveHasContentQuery(searchInput.value), getViewValue());
      updateResetButton();
      if (searchDispatchTimer) {
        window.clearTimeout(searchDispatchTimer);
        searchDispatchTimer = null;
      }
      await refreshView();
      searchInput.focus();
    });

    searchInput?.addEventListener('keydown', async (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        if (searchDispatchTimer) {
          window.clearTimeout(searchDispatchTimer);
          searchDispatchTimer = null;
        }
        await refreshView();
        return;
      }

      if (event.key === 'Escape') {
        if (searchInput.value.length > 0) {
          event.preventDefault();
          searchInput.value = '';
          updateClearButton();
          if (searchDispatchTimer) {
            window.clearTimeout(searchDispatchTimer);
            searchDispatchTimer = null;
          }
          updateSortOptions(deriveHasContentQuery(searchInput.value), getViewValue());
          updateResetButton();
          writeCurrentToolbarUrlState('');
          await refreshView();
          return;
        }
        searchInput.blur();
      }
    });

    facetsEl?.addEventListener('click', async (event: Event) => {
      const chip = (event.target as HTMLElement).closest('.pr-facet-chip') as HTMLButtonElement | null;
      if (!chip) return;
      const fragment = chip.dataset.fragment;
      if (!fragment) return;

      if (chip.classList.contains('active')) {
        const removed = removeQueryFragment(searchInput, fragment);
        if (!removed) {
          const kind = getFragmentKind(fragment);
          if (kind) {
            removeQueryFragmentsByKind(searchInput, kind);
          }
        }
      } else {
        appendOrReplaceQueryFragment(searchInput, fragment);
      }

      updateClearButton();
      updateSortOptions(deriveHasContentQuery(searchInput.value), getViewValue());
      updateResetButton();
      if (searchDispatchTimer) {
        window.clearTimeout(searchDispatchTimer);
        searchDispatchTimer = null;
      }
      await refreshView();
      searchInput.focus();
    });

    const isInTextInput = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
    };

    const isElementVisible = (element: HTMLElement | null): boolean => {
      if (!element || !element.isConnected) return false;
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return element.getClientRects().length > 0;
    };

    const isArchiveUiActive = (): boolean =>
      searchInput.isConnected
      && isElementVisible(root as HTMLElement)
      && isElementVisible(document.querySelector('.pr-archive-container'));

    const shortcutWindow = window as Window & {
      __PR_ARCHIVE_SHORTCUT_HANDLER__?: (event: KeyboardEvent) => void;
    };
    const previousArchiveShortcutHandler = shortcutWindow.__PR_ARCHIVE_SHORTCUT_HANDLER__;
    if (previousArchiveShortcutHandler) {
      document.removeEventListener('keydown', previousArchiveShortcutHandler);
    }

    const handleArchiveGlobalKeydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (!searchInput.isConnected) {
        document.removeEventListener('keydown', handleArchiveGlobalKeydown);
        if (shortcutWindow.__PR_ARCHIVE_SHORTCUT_HANDLER__ === handleArchiveGlobalKeydown) {
          delete shortcutWindow.__PR_ARCHIVE_SHORTCUT_HANDLER__;
        }
        return;
      }

      if (!isArchiveUiActive()) return;

      if (event.key === '/' && !isInTextInput(event.target)) {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    };
    shortcutWindow.__PR_ARCHIVE_SHORTCUT_HANDLER__ = handleArchiveGlobalKeydown;
    document.addEventListener('keydown', handleArchiveGlobalKeydown);
    runAbortController.signal.addEventListener('abort', () => {
      setSearchHelpPopoverOpen(false);
      document.removeEventListener('pointerdown', handleSearchHelpDocumentPointerDown);
      document.removeEventListener('keydown', handleSearchHelpDocumentKeydown);
      if (shortcutWindow.__PR_ARCHIVE_SHORTCUT_HANDLER__ === handleArchiveGlobalKeydown) {
        delete shortcutWindow.__PR_ARCHIVE_SHORTCUT_HANDLER__;
      }
      document.removeEventListener('keydown', handleArchiveGlobalKeydown);
    }, { once: true });

    resetBtn?.addEventListener('click', async () => {
      if (searchDispatchTimer) {
        window.clearTimeout(searchDispatchTimer);
        searchDispatchTimer = null;
      }
      if (viewModeRefreshTimer) {
        window.clearTimeout(viewModeRefreshTimer);
        viewModeRefreshTimer = null;
      }

      applyUiState({
        query: '',
        scope: DEFAULT_SCOPE,
        sort: DEFAULT_SORT,
        view: DEFAULT_VIEW
      });
      // Reset should return scope handling to fresh-load behavior:
      // no dedicated URL scope param unless explicitly set by URL or scope control interaction.
      useDedicatedScopeParam = false;
      writeArchiveUrlState({
        query: '',
        scope: DEFAULT_SCOPE,
        sort: DEFAULT_SORT
      });
      await refreshView();
    });

    scopeContainer?.addEventListener('click', async (event: Event) => {
      const button = (event.target as HTMLElement).closest('.pr-seg-btn') as HTMLButtonElement | null;
      if (!button) return;
      const nextValue = button.dataset.value as ArchiveSearchScope | undefined;
      if (!nextValue || nextValue === getScopeValue()) return;
      setScopeValue(nextValue);
      useDedicatedScopeParam = true;
      updateResetButton();
      await refreshView();
    });

    scopeContainer?.addEventListener('keydown', async (event: KeyboardEvent) => {
      const currentButton = (event.target as HTMLElement).closest('.pr-seg-btn') as HTMLButtonElement | null;
      if (!currentButton) return;

      const buttons = getScopeButtons();
      const currentIndex = buttons.indexOf(currentButton);
      if (currentIndex < 0 || buttons.length === 0) return;

      let nextIndex: number | null = null;
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % buttons.length;
      if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = buttons.length - 1;
      if (nextIndex === null) return;

      event.preventDefault();
      const nextButton = buttons[nextIndex];
      const nextValue = nextButton.dataset.value as ArchiveSearchScope | undefined;
      if (!nextValue) return;
      nextButton.focus();
      if (nextValue === getScopeValue()) return;
      setScopeValue(nextValue);
      useDedicatedScopeParam = true;
      updateResetButton();
      await refreshView();
    });

    sortSelect?.addEventListener('change', async () => {
      state.sortBy = sortSelect.value as ArchiveSortBy;
      updateResetButton();
      await refreshView();
    });

    const scheduleViewRefresh = async (source: 'pointer' | 'keyboard') => {
      if (viewModeRefreshTimer) {
        window.clearTimeout(viewModeRefreshTimer);
        viewModeRefreshTimer = null;
      }

      if (source === 'pointer') {
        await refreshView();
        return;
      }

      viewModeRefreshTimer = window.setTimeout(async () => {
        viewModeRefreshTimer = null;
        await refreshView();
      }, VIEW_MODE_KEYBOARD_DEBOUNCE_MS);
    };

    const applyViewModeChange = async (nextView: ArchiveViewMode, source: 'pointer' | 'keyboard') => {
      if (nextView === getViewValue() && state.viewMode === nextView) return;

      state.viewMode = nextView;
      setViewValue(nextView);
      updateSortOptions(deriveHasContentQuery(searchInput.value), nextView);
      updateResetButton();
      await scheduleViewRefresh(source);
    };

    const activateViewTab = async (index: number, source: 'pointer' | 'keyboard' = 'keyboard') => {
      const tabs = getViewTabs();
      if (tabs.length === 0) return;

      const normalizedIndex = (index + tabs.length) % tabs.length;
      const targetTab = tabs[normalizedIndex];
      const nextView = targetTab.dataset.value as ArchiveViewMode | undefined;
      if (!nextView) return;
      targetTab.focus();
      await applyViewModeChange(nextView, source);
    };

    viewContainer?.addEventListener('click', async (event: Event) => {
      const tab = (event.target as HTMLElement).closest('.pr-view-tab') as HTMLButtonElement | null;
      if (!tab) return;
      const nextView = tab.dataset.value as ArchiveViewMode | undefined;
      if (!nextView) return;
      await applyViewModeChange(nextView, 'pointer');
    });

    viewContainer?.addEventListener('keydown', async (event: KeyboardEvent) => {
      const currentTab = (event.target as HTMLElement).closest('.pr-view-tab') as HTMLButtonElement | null;
      if (!currentTab) return;

      const tabs = getViewTabs();
      const currentIndex = tabs.indexOf(currentTab);
      if (currentIndex < 0) return;

      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          await activateViewTab(currentIndex + 1, 'keyboard');
          break;
        case 'ArrowLeft':
          event.preventDefault();
          await activateViewTab(currentIndex - 1, 'keyboard');
          break;
        case 'Home':
          event.preventDefault();
          await activateViewTab(0, 'keyboard');
          break;
        case 'End':
          event.preventDefault();
          await activateViewTab(tabs.length - 1, 'keyboard');
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          await activateViewTab(currentIndex, 'keyboard');
          break;
        default:
          break;
      }
    });

    // Index view click-to-expand handler
    feedEl?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('a[href]')) return;

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
          tmp.innerHTML = renderIndexItem(item, getCurrentRenderOptions());
          const collapsedRow = tmp.firstElementChild;
          if (collapsedRow) {
            expanded.replaceWith(collapsedRow);
            runPostRenderHooks();
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
    let hasInitialRender = false;
    let startedWithEmptyCache = false;
    let syncCompleted = false;
    let shouldShowRefreshRequiredStatus = false;
    let resolveInitialRender: (() => void) | null = null;
    const initialRenderPromise = new Promise<void>((resolve) => {
      resolveInitialRender = resolve;
    });
    runAbortController.signal.addEventListener('abort', () => {
      clearNetworkIdleRenderTimer();
      resolveInitialRender?.();
      resolveInitialRender = null;
    }, { once: true });

    const maybeSetRefreshRequiredStatus = () => {
      if (!hasInitialRender || !syncCompleted || !shouldShowRefreshRequiredStatus) return;
      setStatusBaseMessage('Fetch complete. Please refresh page to view latest content.', false, false);
    };

    const renderInitialSnapshot = () => {
      if (!isCurrentRun() || hasInitialRender) return;
      hasInitialRender = true;
      updateItemMap();
      dashboardEl!.style.display = 'none';
      signalReady();
      resolveInitialRender?.();
      resolveInitialRender = null;
      // Only ask for refresh if rendering happened before sync completed.
      shouldShowRefreshRequiredStatus = !syncCompleted;
      maybeSetRefreshRequiredStatus();
    };

    const scheduleRenderOnNetworkIdle = () => {
      if (startedWithEmptyCache || hasInitialRender || !isCurrentRun()) return;
      clearNetworkIdleRenderTimer();
      networkIdleRenderTimer = window.setTimeout(() => {
        networkIdleRenderTimer = null;
        renderInitialSnapshot();
      }, NETWORK_IDLE_RENDER_MS);
    };

    const markSyncActivity = () => {
      scheduleRenderOnNetworkIdle();
    };

    const performSync = async (forceFull = false): Promise<void> => {
      if (!isCurrentRun()) return;
      // Guard against concurrent syncs
      if (isSyncInProgress) {
        Logger.debug('Sync already in progress, skipping duplicate request');
        return;
      }
      isSyncInProgress = true;
      pendingRetryCount = 0;
      if (forceFull) {
        // A full resync can significantly change corpus size; discard prior
        // render-count choice so the large-dataset guard can re-evaluate.
        pendingRenderCount = null;
        resetRenderLimit();
      }
      const dbStart = performance.now();
      const cached = await loadArchiveData(username);
      if (!isCurrentRun()) return;
      state.lastSyncDate = cached.lastSyncDate;
      perfMetrics.dbLoadMs = performance.now() - dbStart;
      renderTopStatusLine();

      const setStatus = (msg: string, isError = false, isSyncing = false) => {
        if (!isCurrentRun()) return;
        markSyncActivity();
        if (isSyncing && hasInitialRender) {
          shouldShowRefreshRequiredStatus = true;
        }
        setStatusBaseMessage(msg, isError, isSyncing);
      };

      const attemptSync = async (useAutoRetry: boolean, attemptNumber: number = 1): Promise<void> => {
        if (!isCurrentRun()) return;
        syncErrorState.isRetrying = true;
        syncErrorState.retryCount = attemptNumber;
        syncErrorState.abortController = new AbortController();

        try {
          // Re-load fresh data from DB to get updated watermarks from any previous partial success
          const [currentCached, cachedContext] = await Promise.all([
            loadArchiveData(username),
            loadAllContextualItems(username).catch(e => {
              Logger.warn('Failed to load contextual cache during reload', e);
              return { posts: [], comments: [] };
            })
          ]);
          if (!isCurrentRun()) return;

          // Update in-memory canonical state to include items saved by previous failed attempts
          replaceCanonicalItems(currentCached.items);
          persistedContextItems = [...cachedContext.posts, ...cachedContext.comments];
          state.lastSyncDate = currentCached.lastSyncDate;

          if (attemptNumber > 1) {
            setStatus(`Retrying sync (attempt ${attemptNumber})`, false, true);
          } else if (forceFull) {
            setStatus(`Starting full resync for ${username}`, false, true);
          } else if (currentCached.items.length > 0) {
            setStatus(`Loaded ${currentCached.items.length} items. Checking for updates`, false, true);
          } else {
            setStatus(`No local data. Fetching full history for ${username}`, false, true);
          }

          const watermarks = {
            lastSyncDate: forceFull ? null : currentCached.lastSyncDate,
            lastSyncDate_comments: forceFull ? null : currentCached.lastSyncDate_comments,
            lastSyncDate_posts: forceFull ? null : currentCached.lastSyncDate_posts
          };
          const netStart = performance.now();
          const initialCount = state.items.length;
          const syncAbortController = new AbortController();
          const abortSyncAttempt = () => syncAbortController.abort();
          syncErrorState.abortController.signal.addEventListener('abort', abortSyncAttempt);
          runAbortController.signal.addEventListener('abort', abortSyncAttempt);
          try {
            await syncArchive(
              username,
              state,
              watermarks,
              (msg) => setStatus(msg, false, true),
              syncAbortController.signal,
              markCanonicalItemsMutated
            );
          } finally {
            syncErrorState.abortController.signal.removeEventListener('abort', abortSyncAttempt);
            runAbortController.signal.removeEventListener('abort', abortSyncAttempt);
          }
          if (!isCurrentRun()) return;
          perfMetrics.networkFetchMs = performance.now() - netStart;
          perfMetrics.newItems = state.items.length - initialCount;
          renderTopStatusLine();

          // Success - clear error state
          syncErrorState.isRetrying = false;
          syncErrorState.retryCount = 0;
          if (errorContainer) errorContainer.style.display = 'none';

          // Clear syncing state
          setStatus(`Sync complete. ${state.items.length} total items.`, false, false);
          syncCompleted = true;
          maybeSetRefreshRequiredStatus();

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
            setStatus(`Sync cancelled. Showing cached data (${state.items.length} items).`, false, false);
            pendingRetryCount = 0;
            isSyncInProgress = false;
            return;
          }
          if (!isCurrentRun()) {
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
              if (!isCurrentRun()) return;
              if (retryTimeout) clearTimeout(retryTimeout);
              pendingRetryCount--;
              attemptSync(true, attemptNumber + 1);
            };

            const doCancel = () => {
              if (!isCurrentRun()) return;
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
              if (!isCurrentRun()) return;
              pendingRetryCount--;
              attemptSync(retryMode, 1);
            }, () => {
              if (!isCurrentRun()) return;
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
      if (!isCurrentRun()) return;
      // Clear current view
      if (confirm('This will re-download the entire archive history. Continue?')) {
        performSync(true);
      }
    });

    // 1. Try loading from IndexedDB (Main + Context)
    const [cached, cachedContext] = await Promise.all([
      loadArchiveData(username),
      loadAllContextualItems(username).catch(e => {
        Logger.warn('Failed to load contextual cache', e);
        return { posts: [], comments: [] };
      })
    ]);

    replaceCanonicalItems(cached.items);
    persistedContextItems = [...cachedContext.posts, ...cachedContext.comments];
    state.lastSyncDate = cached.lastSyncDate;
    baselineFacetSnapshots = cached.baselineFacets;
    for (const scope of ['authored', 'all'] as const) {
      const snapshot = baselineFacetSnapshots[scope];
      baselineFacetSnapshotSignatures[scope] = snapshot
        ? createFacetSnapshotSignature(snapshot)
        : undefined;
    }
    if (!isCurrentRun()) return;
    startedWithEmptyCache = cached.items.length === 0;

    if (isNoQuery(searchInput.value)) {
      const initialScope = getScopeValue();
      const initialContextCount = getNoQueryContextCount(initialScope, persistedContextItems.length);
      const cachedSnapshot = getValidBaselineFacetSnapshot(initialScope, initialContextCount);
      if (cachedSnapshot) {
        renderFacetResult(cachedSnapshot);
      }
    }

    if (cached.items.length > 0) {
      setStatusBaseMessage(`Loaded ${cached.items.length} items from cache. Checking for updates...`, false, false);
    } else {
      dashboardEl!.style.display = 'block';
      setStatusBaseMessage(`No local data. Fetching full history for ${username}...`, false, false);
    }
    markSyncActivity();

    // 2. Perform sync in background.
    // - If startup cache was non-empty: render once when network has been idle for a short window.
    // - If startup cache was empty: defer first render until sync attempt completes.
    const syncPromise = performSync();
    scheduleRenderOnNetworkIdle();
    if (!isCurrentRun()) return;

    // Wait for background sync completion (no automatic rerender afterward).
    await syncPromise;
    if (!isCurrentRun()) return;
    if (await restartArchiveInitIfDetached('sync completion')) return;
    if (!hasInitialRender) {
      if (startedWithEmptyCache) {
        renderInitialSnapshot();
      } else {
        // Keep waiting on the existing idle timer scheduled from sync activity.
        await initialRenderPromise;
        if (!isCurrentRun()) return;
      }
    }
    maybeSetRefreshRequiredStatus();

  } catch (err) {
    if (!isCurrentRun()) {
      Logger.debug('Archive init run superseded by a newer run; skipping stale error handling.');
      return;
    }
    Logger.error('Failed to initialize archive:', err);
    const root = document.getElementById('power-reader-root');
    if (root) {
      const errorEl = document.createElement('div');
      errorEl.className = 'pr-error';
      const message = err instanceof Error ? err.message : String(err);
      errorEl.textContent = `Failed to load archive: ${message}`;
      root.replaceChildren(errorEl);
    }
  } finally {
    clearNetworkIdleRenderTimer();
    if (runId === activeArchiveInitRunId && activeArchiveInitAbortController === runAbortController) {
      activeArchiveInitAbortController = null;
    }
  }
};

/**
 * Sync logic: Fetch new items, merge, and save.
 */
const newestBatchTimestamp = (
  items: Array<Record<string, unknown>>,
  primaryField: 'lastEditedAt' | 'modifiedAt'
): string | null => {
  let newest: string | null = null;
  for (const item of items) {
    const candidate = (typeof item[primaryField] === 'string' && (item[primaryField] as string).length > 0)
      ? item[primaryField] as string
      : (typeof item.postedAt === 'string' ? item.postedAt : null);
    if (!candidate) continue;
    if (!newest) {
      newest = candidate;
      continue;
    }
    const candidateMs = Date.parse(candidate);
    const newestMs = Date.parse(newest);
    const candidateIsValid = Number.isFinite(candidateMs);
    const newestIsValid = Number.isFinite(newestMs);
    if ((candidateIsValid && newestIsValid && candidateMs > newestMs)
      || (!candidateIsValid || !newestIsValid) && candidate.localeCompare(newest) > 0) {
      newest = candidate;
    }
  }
  return newest;
};

const syncArchive = async (
  username: string,
  state: any,
  watermarks: {
    lastSyncDate: string | null;
    lastSyncDate_comments: string | null;
    lastSyncDate_posts: string | null;
  },
  onStatus: (msg: string) => void,
  abortSignal?: AbortSignal,
  onCanonicalMutated?: () => void
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

  // Resumable independent watermarks
  const afterDateComments = watermarks.lastSyncDate_comments ? new Date(watermarks.lastSyncDate_comments) : undefined;
  const afterDatePosts = watermarks.lastSyncDate_posts ? new Date(watermarks.lastSyncDate_posts) : undefined;

  if (afterDateComments || afterDatePosts) {
    const cStr = afterDateComments ? afterDateComments.toLocaleDateString() : 'start';
    const pStr = afterDatePosts ? afterDatePosts.toLocaleDateString() : 'start';
    onStatus(`Resuming: Comments from ${cStr}, Posts from ${pStr}...`);
  }

  const comments = await fetchUserComments(userId, (count) => {
    onStatus(`Fetching comments: ${count} new...`);
  }, afterDateComments, async (batch) => {
    // Incremental save for comments
    const newestInBatch = newestBatchTimestamp(batch as unknown as Array<Record<string, unknown>>, 'lastEditedAt');
    await saveArchiveData(username, batch, newestInBatch ? { lastSyncDate_comments: newestInBatch } : {});
    console.log(`[Archive Sync] Incremental save: ${batch.length} comments, watermark=${newestInBatch ?? 'n/a'}`);
  }, username);

  // Check for abort after fetching comments
  if (abortSignal?.aborted) {
    throw new Error('Sync aborted');
  }

  const posts = await fetchUserPosts(userId, (count) => {
    onStatus(`Fetching posts: ${count} new...`);
  }, afterDatePosts, async (batch) => {
    // Incremental save for posts
    const newestInBatch = newestBatchTimestamp(batch as unknown as Array<Record<string, unknown>>, 'modifiedAt');
    await saveArchiveData(username, batch, newestInBatch ? { lastSyncDate_posts: newestInBatch } : {});
    console.log(`[Archive Sync] Incremental save: ${batch.length} posts, watermark=${newestInBatch ?? 'n/a'}`);
  });

  // Check for abort after fetching posts
  if (abortSignal?.aborted) {
    throw new Error('Sync aborted');
  }

  const newItems = [...posts, ...comments];

  // Check for abort before final updates
  if (abortSignal?.aborted) {
    throw new Error('Sync aborted');
  }

  if (newItems.length > 0) {
    onStatus(`Found ${newItems.length} new items. Merging...`);

    // Merge strategy: upsert by ID so edited items replace stale cache rows.
    const existingIndexById = new Map<string, number>();
    state.items.forEach((item: any, index: number) => existingIndexById.set(item._id, index));
    for (const item of newItems) {
      const existingIndex = existingIndexById.get(item._id);
      if (existingIndex === undefined) {
        existingIndexById.set(item._id, state.items.length);
        state.items.push(item);
      } else {
        state.items[existingIndex] = item;
      }
    }

    // Re-sort (Default to date for the background state)
    state.items.sort((a: any, b: any) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
    onCanonicalMutated?.();

    // Final watermark update to sync start time to cover any items created during sync
    await saveArchiveData(username, [], {
      lastSyncDate: syncStartTime,
      lastSyncDate_comments: syncStartTime,
      lastSyncDate_posts: syncStartTime
    });
    state.lastSyncDate = syncStartTime;

    onStatus(`Sync complete. ${state.items.length} total items.`);
  } else {
    const statusMsg = watermarks.lastSyncDate ? `Up to date. (${state.items.length} items)` : `No history found for ${username}.`;
    onStatus(statusMsg);
    await saveArchiveData(username, [], {
      lastSyncDate: syncStartTime,
      lastSyncDate_comments: syncStartTime,
      lastSyncDate_posts: syncStartTime
    });
    state.lastSyncDate = syncStartTime;
  }
};
