
import { executeTakeover, rebuildDocument, signalReady } from '../takeover';
import { initializeReactions } from '../utils/reactions';
import { Logger } from '../utils/logger';
import { createInitialArchiveState, type ArchiveSortBy, type ArchiveViewMode, isThreadMode } from './state';
import { loadAllContextualItems, loadArchiveData, saveArchiveData } from './storage';
import { fetchUserId, fetchUserPosts, fetchUserComments } from './loader';
import { escapeHtml } from '../utils/rendering';
import { renderArchiveFeed, updateRenderLimit, resetRenderLimit, renderCardItem, renderIndexItem } from './render';
import { setUIHost } from '../render/uiHost';
import { ArchiveUIHost } from './uiHost';
import { attachEventListeners } from '../events/index';
import { initAIStudioListener } from '../features/aiStudioPopup';
import { initArenaMaxListener } from '../features/arenaMaxPopup';
import { setupExternalLinks } from '../features/externalLinks';
import { setupInlineReactions } from '../features/inlineReactions';

import { initPreviewSystem } from '../utils/preview';
import { refreshPostActionButtons } from '../utils/dom';
import { ArchiveSearchManager } from './search';

import { parseArchiveUrlState, writeArchiveUrlState } from './search/urlState';
import { createSearchWorkerClient } from './search/workerFactory';
import { parseStructuredQuery } from './search/parser';
import { isPositiveContentWithoutWildcard } from './search/ast';
import { extractHighlightTerms, highlightTermsInContainer } from './search/highlight';
import { computeFacets } from './search/facets';
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
        .pr-archive-container {
            padding: 10px;
            background: var(--pr-bg-secondary, #f9f9f9);
            border-radius: 8px;
        }
        .pr-archive-toolbar {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin: 10px 0;
        }
        .pr-archive-toolbar-primary {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .pr-archive-toolbar-secondary {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
            justify-content: space-between;
        }
        .pr-toolbar-controls {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
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
            flex-direction: column;
            align-items: center;
            gap: 2px;
            padding: 4px 12px;
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
        .pr-search-help {
            margin-top: 8px;
        }
        .pr-archive-facets {
            margin-top: 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
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

    root.innerHTML = `
    <div class="pr-header">
      <h1><a href="${forumHomeUrl}" target="_blank" rel="noopener noreferrer" class="pr-site-home-link">${forumLabel}</a>: User Archive: ${escapeHtml(username)} <small style="font-size: 0.6em; color: #888;">v${__APP_VERSION__}</small></h1>
      <div class="pr-status" id="archive-status">Checking local database...</div>
    </div>
    
    <div class="pr-archive-container">
        <div class="pr-archive-toolbar">
            <div class="pr-archive-toolbar-primary">
                <div class="pr-search-container">
                    <input type="text" id="archive-search" placeholder='Search by keyword, "phrase", or operator...' class="pr-input">
                    <button id="archive-search-clear" class="pr-search-clear" type="button" aria-label="Clear search">&times;</button>
                </div>
                <button id="archive-resync" class="pr-button" title="Force re-download all data">Resync</button>
            </div>
            <div class="pr-archive-toolbar-secondary">
                <div class="pr-toolbar-controls">
                    <div id="archive-scope" class="pr-segmented-control" role="radiogroup" aria-label="Search scope">
                        <button type="button" data-value="authored" class="pr-seg-btn active" role="radio" aria-checked="true" tabindex="0">Authored</button>
                        <button type="button" data-value="all" class="pr-seg-btn" role="radio" aria-checked="false" tabindex="-1">All</button>
                    </div>
                    <select id="archive-sort">
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
                    <span id="archive-result-count" class="pr-result-count"></span>
                    <button id="archive-reset-filters" class="pr-toolbar-reset" type="button">Reset</button>
                </div>
            </div>
        </div>
        <div id="archive-search-status" class="pr-archive-search-status">Ready</div>
        <details class="pr-help pr-search-help" id="archive-search-help">
            <summary>Search syntax reference</summary>
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
        </details>
        <div id="archive-facets" class="pr-archive-facets" style="display: none;"></div>
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
    const resetBtn = document.getElementById('archive-reset-filters') as HTMLButtonElement;
    const resyncBtn = document.getElementById('archive-resync');
    const errorContainer = document.getElementById('archive-error-container');
    const searchStatusEl = document.getElementById('archive-search-status');
    const searchHelpEl = document.getElementById('archive-search-help');
    const facetsEl = document.getElementById('archive-facets') as HTMLDivElement | null;

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
    let workerClient: SearchWorkerClient;
    try {
      workerClient = createSearchWorkerClient();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Archive search worker unavailable: ${reason}`);
    }

    const searchManager = new ArchiveSearchManager({
      workerClient
    });

    // Controller to cancel background rendering when new query starts
    let activeRenderController: AbortController | null = null;

    // Observer for lazy post action button refresh
    let postObserver: IntersectionObserver | null = null;
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
      delayedEl.textContent = 'Facets delayed - refine query';
      return delayedEl;
    };

    const clearFacetUi = (): void => {
      if (!facetsEl) return;
      facetsEl.replaceChildren();
      facetsEl.style.display = 'none';
    };

    const renderFacets = (items: readonly ArchiveItem[], query: string): void => {
      if (!facetsEl) return;

      const facetResult = computeFacets(items, query);
      const hasFacetItems = facetResult.groups.some(group => group.items.length > 0);
      if (!hasFacetItems && !facetResult.delayed) {
        clearFacetUi();
        return;
      }

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
      const canonicalRevision = uiHost.getCanonicalStateRevision();
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
      searchStatusEl.classList.remove('warning', 'error');

      const addChip = (text: string, type: 'info' | 'warning' | 'error' = 'info'): void => {
        const chip = document.createElement('span');
        chip.className = `pr-status-chip pr-status-${type}`;
        chip.textContent = text;
        searchStatusEl.appendChild(chip);
      };

      let hasMessages = false;

      if (resolvedScope === 'all') {
        addChip(`Scope: authored + ${contextItemCount} context items`, 'info');
        hasMessages = true;
        if (contextItemCount === 0) {
          addChip('Context cache may be incomplete', 'warning');
          hasMessages = true;
        }
        if (sortMode === 'replyTo') {
          addChip('replyTo ordering uses mixed authored/context semantics', 'info');
          hasMessages = true;
        }
      }

      if (diagnostics.partialResults) {
        addChip(`Partial results (${diagnostics.tookMs}ms budget hit)`, 'warning');
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
        hasMessages = true;
      }

      if (pendingSortResetMessage) {
        addChip(pendingSortResetMessage, 'info');
        pendingSortResetMessage = null;
        hasMessages = true;
      }

      if (!hasMessages) {
        searchStatusEl.textContent = 'Ready';
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
        renderFacets(result.items, result.canonicalQuery);
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
    initAIStudioListener(uiHost.getReaderState());
    initArenaMaxListener(uiHost.getReaderState());

    // Sticky header currently depends on main-reader singleton state (`getState()`).
    // Do not enable it in archive mode until it is wired to archive-local ReaderState.
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

    // Helper to batch updates to map
    const updateItemMap = (items: ArchiveItem[]) => {
      if (!isCurrentRun()) return;
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

    searchHelpEl?.addEventListener('click', async (event: Event) => {
      const target = (event.target as HTMLElement).closest('.pr-search-example') as HTMLElement | null;
      if (!target) return;
      const query = target.dataset.query;
      if (!query) return;
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
      perfMetrics.dbLoadMs = performance.now() - dbStart;
      renderTopStatusLine();

      const setStatus = (msg: string, isError = false, isSyncing = false) => {
        if (!isCurrentRun()) return;
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

          // Update in-memory state to include items saved by previous failed attempts
          state.items = currentCached.items;
          persistedContextItems = [...cachedContext.posts, ...cachedContext.comments];
          contextSearchItemsCache = null;

          state.itemById.clear();
          state.items.forEach((item: any) => state.itemById.set(item._id, item));

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
              syncAbortController.signal
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

          // Only trigger a rerender if we actually found new data.
          // refreshView (called via updateItemMap) will abort any in-progress "cached only" render.
          if (perfMetrics.newItems > 0) {
            updateItemMap(state.items);
          }

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

    state.items = cached.items;
    persistedContextItems = [...cachedContext.posts, ...cachedContext.comments];
    contextSearchItemsCache = null;
    if (!isCurrentRun()) return;

    // We no longer trigger an initial render from cache here.
    // Instead, we wait for sync to finish (or fail) and then render once.
    // updateItemMap(state.items);

    if (cached.items.length > 0) {
      setStatusBaseMessage(`Loaded ${cached.items.length} items from cache. Checking for updates...`, false, false);
    } else {
      dashboardEl!.style.display = 'block';
      setStatusBaseMessage(`No local data. Fetching full history for ${username}...`, false, false);
    }

    // 2. Perform Sync with error handling
    // Start sync but don't wait indefinitely if it's slow
    const syncPromise = performSync();
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 2000));

    const raceResult = await Promise.race([syncPromise, timeoutPromise]);

    if (raceResult === 'timeout') {
      console.log('[Archive Init] Sync taking > 2s, rendering cache first.');
      if (cached.items.length > 0) {
        setStatusBaseMessage(`Sync in progress... Showing cached data.`, false, true);
        updateItemMap(state.items);
      }
    }
    if (!isCurrentRun()) return;

    // Wait for the sync to eventually finish (it will call updateItemMap itself if new items found)
    await syncPromise;
    if (!isCurrentRun()) return;
    if (await restartArchiveInitIfDetached('sync completion')) return;

    // 3. Final render check
    // If we haven't rendered yet (e.g. sync was fast but found no new items), do it now.
    const isRendered = !!feedEl!.querySelector('.pr-archive-item, .pr-archive-index-item, .pr-post');
    if (!isRendered) {
      console.log(`[Archive Init] Final render check: currentItems=${state.items.length}, newItems=${perfMetrics.newItems}`);
      updateItemMap(state.items);
    }

    await refreshView();
    if (!isCurrentRun()) return;
    if (await restartArchiveInitIfDetached('final refresh')) return;

    dashboardEl!.style.display = 'none';
    signalReady();

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
    if (runId === activeArchiveInitRunId && activeArchiveInitAbortController === runAbortController) {
      activeArchiveInitAbortController = null;
    }
  }
};

/**
 * Sync logic: Fetch new items, merge, and save.
 */
const syncArchive = async (
  username: string,
  state: any,
  watermarks: {
    lastSyncDate: string | null;
    lastSyncDate_comments: string | null;
    lastSyncDate_posts: string | null;
  },
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
    const newestInBatch = batch[batch.length - 1].postedAt;
    await saveArchiveData(username, batch, { lastSyncDate_comments: newestInBatch });
    console.log(`[Archive Sync] Incremental save: ${batch.length} comments, watermark=${newestInBatch}`);
  }, username);

  // Check for abort after fetching comments
  if (abortSignal?.aborted) {
    throw new Error('Sync aborted');
  }

  const posts = await fetchUserPosts(userId, (count) => {
    onStatus(`Fetching posts: ${count} new...`);
  }, afterDatePosts, async (batch) => {
    // Incremental save for posts
    const newestInBatch = batch[batch.length - 1].postedAt;
    await saveArchiveData(username, batch, { lastSyncDate_posts: newestInBatch });
    console.log(`[Archive Sync] Incremental save: ${batch.length} posts, watermark=${newestInBatch}`);
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

    // Merge strategy: Add new items to state.items, avoiding duplicates by ID
    const existingIds = new Set(state.items.map((i: any) => i._id));
    const uniqueNewItems = newItems.filter(i => !existingIds.has(i._id));

    state.items = [...uniqueNewItems, ...state.items];

    // Re-sort (Default to date for the background state)
    state.items.sort((a: any, b: any) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

    // Final watermark update to sync start time to cover any items created during sync
    await saveArchiveData(username, [], {
      lastSyncDate: syncStartTime,
      lastSyncDate_comments: syncStartTime,
      lastSyncDate_posts: syncStartTime
    });

    onStatus(`Sync complete. ${state.items.length} total items.`);
  } else {
    const statusMsg = watermarks.lastSyncDate ? `Up to date. (${state.items.length} items)` : `No history found for ${username}.`;
    onStatus(statusMsg);
    await saveArchiveData(username, [], {
      lastSyncDate: syncStartTime,
      lastSyncDate_comments: syncStartTime,
      lastSyncDate_posts: syncStartTime
    });
  }
};
