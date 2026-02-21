/**
 * Main UI rendering for Power Reader
 */

import type { Comment, Post } from '../../../shared/graphql/queries';
import type { ReaderState } from '../state';
import { CONFIG } from '../config';
import { getReadState, clearAllStorage, exportState, getAIStudioPrefix, setAIStudioPrefix, getLoadFrom, isRead, setLoadFrom } from '../utils/storage';
import { AI_STUDIO_PROMPT_PREFIX } from '../utils/ai-studio-prompt';
import { initResizeHandles } from '../utils/resize';
import { initPreviewSystem, manualPreview } from '../utils/preview';
import { Logger } from '../utils/logger';
import { renderPostGroup } from './post';
import { calculateTreeKarma } from '../utils/scoring';
import type { PostGroup } from './post';

// Feature setups
import { setupLinkPreviews } from '../features/linkPreviews';
import { setupStickyHeader, getStickyHeader } from '../features/stickyHeader';
import { setupInlineReactions } from '../features/inlineReactions';
import { setupExternalLinks } from '../features/externalLinks';
import { setupScrollTracking } from '../features/scrollTracking';
import { refreshPostActionButtons } from '../utils/dom';
import { getCommentContextType } from '../types/uiCommentFlags';

declare const GM_getValue: (key: string, defaultValue?: any) => any;
declare const GM_setValue: (key: string, value: any) => void;
declare const __APP_VERSION__: string;

/**
 * Stats returned by buildPostGroups for the status line
 */
export interface StatusStats {
  totalComments: number;
  unreadComments: number;
  contextComments: number;
  hiddenComments: number;
  totalPosts: number;
  visiblePosts: number;
  hiddenPosts: number;
}

/**
 * Format an ISO date string for the status line (e.g. "Jan 10 08:30")
 */
const formatStatusDate = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[d.getMonth()];
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${mon} ${day} ${hh}:${mm}`;
};

/**
 * Build post groups from comments and posts
 * Groups comments by their parent post
 */
export const buildPostGroups = (
  comments: Comment[],
  posts: Post[],
  state: ReaderState
): { groups: Map<string, PostGroup>; unreadItemCount: number; stats: StatusStats } => {
  const readState = getReadState();

  // Sort comments newest first
  const sortedComments = [...comments].sort((a, b) =>
    new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  );

  // Determine which comments to show
  const unreadIds = new Set<string>();
  const parentIds = new Set<string>();

  const cutoff = getLoadFrom();
  const isImplicitlyRead = (item: { postedAt?: string }) => {
    return !!(cutoff && cutoff !== '__LOAD_RECENT__' && cutoff.includes('T') && item.postedAt && item.postedAt < cutoff);
  };

  sortedComments.forEach(c => {
    const ct = getCommentContextType(c);
    const isContext = ct === 'fetched' || ct === 'stub';
    const isLocallyRead = isRead(c._id, readState, c.postedAt);
    const implicit = isImplicitlyRead(c);
    const commentIsRead = isLocallyRead || implicit;

    if (isContext || !commentIsRead) {
      if (!isContext) unreadIds.add(c._id);

      // Keep entire ancestor chain for context
      let currentId: string | null = c._id;
      const visited = new Set<string>();
      while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);

        parentIds.add(currentId);
        const currentComment = state.commentById.get(currentId);
        currentId = currentComment?.parentCommentId || null;
      }
    }
  });

  // Include read parents for context
  const idsToShow = new Set([...unreadIds, ...parentIds]);

  // Track unread posts (we'll refine this count after filtering groups)
  const unreadPostIds = new Set<string>();
  posts.forEach(p => {
    const readStatus = isRead(p._id, readState, p.postedAt) || isImplicitlyRead(p);
    if (!readStatus) {
      unreadPostIds.add(p._id);
    }
  });

  // Build groups
  const postGroups = new Map<string, PostGroup>();

  // Add all posts from the current batch
  posts.forEach(post => {
    if (!post) return;

    if (!postGroups.has(post._id)) {
      postGroups.set(post._id, { title: post.title, postId: post._id, comments: [], fullPost: post });
    } else {
      postGroups.get(post._id)!.fullPost = post;
    }
  });

  // Add comments to their post groups
  sortedComments.forEach((comment, index) => {
    if (!idsToShow.has(comment._id) && !parentIds.has(comment._id)) return;

    const postId = comment.postId;
    if (!postId) return;

    if (!postGroups.has(postId)) {
      const postTitle = comment.post?.title || 'Unknown Post';
      const fullerPost = state.postById.get(postId) || comment.post;
      postGroups.set(postId, {
        title: postTitle,
        postId,
        comments: [],
        fullPost: fullerPost as Post
      });
    }

    // Add order for recency highlighting
    (comment as any)._order = index < CONFIG.highlightLastN ? index + 1 : 0;
    postGroups.get(postId)!.comments.push(comment);
  });

  // [PR-SORT-02] Top-Level Sorting
  let groupsList = Array.from(postGroups.values());
  const treeKarmaCache = new Map<string, number>();

  // Calculate Tree-Karma for all groups BEFORE filtering.
  // This provides a definitive "has unread content" signal.
  groupsList.forEach((g: PostGroup) => {
    const postRecord = state.postById.get(g.postId);
    const post = postRecord || g.fullPost || { _id: g.postId, baseScore: 0 } as Post;
    const isPostRead = isRead(g.postId, readState, post.postedAt) || isImplicitlyRead(post);

    // rootCommentsOfPost should include ANY comment whose parent is not in the batch.
    // This ensures we find unread comments even if their parents are missing.
    const rootCommentsOfPost = g.comments.filter((c: Comment) => !c.parentCommentId || !state.commentById.has(c.parentCommentId));

    (g as any).treeKarma = calculateTreeKarma(
      g.postId,
      post.baseScore || 0,
      isPostRead,
      rootCommentsOfPost,
      readState,
      state.childrenByParentId,
      cutoff,
      treeKarmaCache
    );
    (g as any).postedAt = post.postedAt || new Date().toISOString();

    if ((g as any).treeKarma === -Infinity) {
      Logger.warn(`Post group ${g.postId} has Tree-Karma -Infinity (no unread items found in its tree).`);
    }
  });

  // [PR-FILTER-01] Filter out "Fully Read" posts:
  // - A post is fully read if its Tree-Karma is -Infinity (no unread items in tree)
  const totalGroupsBeforeFilter = groupsList.length;
  groupsList = groupsList.filter(g => (g as any).treeKarma !== -Infinity);
  const hiddenPosts = totalGroupsBeforeFilter - groupsList.length;

  // Final unread post count based on visible groups
  const visiblePostIds = new Set(groupsList.map(g => g.postId));
  const finalUnreadPostIds = new Set([...unreadPostIds].filter(id => visiblePostIds.has(id)));

  // Sort by Tree-Karma descending, then by date descending
  groupsList.sort((a, b) => {
    const tkA = (a as any).treeKarma;
    const tkB = (b as any).treeKarma;
    if (tkA !== tkB) return tkB - tkA;
    return new Date((b as any).postedAt).getTime() - new Date((a as any).postedAt).getTime();
  });

  // Re-build Map to preserve the sorted order
  const sortedGroups = new Map<string, PostGroup>();
  groupsList.forEach(g => sortedGroups.set(g.postId, g));

  // Compute detailed stats - strictly within the current comments batch
  const batchCommentIds = new Set(comments.map(c => c._id));
  const batchUnreadCount = Array.from(unreadIds).filter(id => batchCommentIds.has(id)).length;
  const batchContextCount = Array.from(parentIds).filter(id => batchCommentIds.has(id) && !unreadIds.has(id)).length;
  const batchHiddenCount = comments.length - batchUnreadCount - batchContextCount;

  const stats: StatusStats = {
    totalComments: comments.length,
    unreadComments: batchUnreadCount,
    contextComments: batchContextCount,
    hiddenComments: batchHiddenCount,
    totalPosts: posts.length,
    visiblePosts: groupsList.length,
    hiddenPosts,
  };

  return {
    groups: sortedGroups,
    unreadItemCount: unreadIds.size + finalUnreadPostIds.size,
    stats,
  };
};

/**
 * Render the help section HTML
 */
const renderHelpSection = (showHelp: boolean): string => {
  return `
    <details class="pr-help" ${showHelp ? 'open' : ''} id="pr-help-section">
      <summary class="pr-help-header">
        <strong>📖 Power Reader Guide</strong>
      </summary>
      <div class="pr-help-content pr-help-columns">
        <div class="pr-help-section">
          <h4>🗳️ Voting & Reactions</h4>
          <ul>
            <li><strong>▲/▼</strong> Karma vote · <strong>✓/✗</strong> Agreement vote</li>
            <li>Select text → inline react to specific parts</li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>👤 Authors</h4>
          <ul>
            <li><strong>[↑]/[↓]</strong> Favor/disfavor author</li>
            <li>Hover name for profile preview</li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>🎨 Colors</h4>
          <ul>
            <li><strong>Pink</strong> High karma · <strong>Yellow</strong> Recent</li>
            <li><strong>Green border</strong> Reply to you · <strong>Grey</strong> Read</li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>📦 Post Buttons (Hover + Key)</h4>
          <ul>
            <li><strong>[e]</strong> Expand/load body · <strong>[a]</strong> Load all comments</li>
            <li><strong>[c]</strong> Scroll to comments · <strong>[n]</strong> Scroll to next post</li>
            <li><strong>[g]</strong> AI Studio · <strong>[m]</strong> Arena.ai Max</li>
            <li><strong>[−]/[+]</strong> Collapse/expand post + comments</li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>💬 Comment Buttons (Hover + Key)</h4>
          <ul>
            <li><strong>[r]</strong> Load replies · <strong>[t]</strong> Trace to root (load parents)</li>
            <li><strong>[^]</strong> Find parent (<strong>p</strong> or <strong>^</strong>) · <strong>[g]</strong> AI Studio · <strong>[m]</strong> Arena.ai Max</li>
            <li><strong>[−]/[+]</strong> Collapse/expand comment</li>
            <li><strong>[↑]/[↓]</strong> Mark author as preferred/disliked</li>
            <li style="font-size: 0.9em; color: #888; margin-top: 4px;"><i>Note: Buttons show disabled with a tooltip when not applicable.</i></li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>🔍 Previews & Navigation</h4>
          <ul>
            <li>Hover post titles or comment links for preview</li>
            <li>Click to navigate · Ctrl+click for new tab</li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>📖 Read Tracking</h4>
          <ul>
            <li>Scrolled past → marked read (grey) · Refresh shows unread only</li>
            <li>Click timestamp for permalink</li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>↔️ Layout · AI: <strong>g</strong> / <strong>⇧G</strong></h4>
          <ul>
            <li><strong>g</strong>: Thread to AI Studio · <strong>⇧G</strong>: + Descendants</li>
            <li><strong>m</strong>: Thread to Arena Max · <strong>⇧M</strong>: + Descendants</li>
            <li>Drag edges to resize · Width saved across sessions</li>
          </ul>
        </div>

        <h4>🤖 AI Studio Settings</h4>
        <div class="pr-settings-group">
          <label for="pr-ai-prefix-input"><strong>AI Studio Prompt Prefix:</strong></label>
          <p style="font-size: 0.8em; color: #888; margin-top: 5px;">This text is sent to AI Studio before the thread content. Leave blank to use the default.</p>
          <textarea id="pr-ai-prefix-input" class="pr-setting-textarea" rows="4" style="width: 100%; margin-top: 10px; font-family: monospace; font-size: 0.9em; padding: 5px; border: 1px solid #ccc; border-radius: 4px;"></textarea>
          <div style="margin-top: 5px;">
            <button id="pr-save-ai-prefix-btn" class="pr-debug-btn">Save Prefix</button>
            <button id="pr-reset-ai-prefix-btn" class="pr-debug-btn">Reset to Default</button>
          </div>
        </div>

        <h4>🛠 Debug</h4>
        <p>
          <button id="pr-export-state-btn" class="pr-debug-btn">Export State (Clipboard)</button>
          <button id="pr-reset-state-btn" class="pr-debug-btn">Reset State</button>
        </p>
      </div>
    </details>
  `;
};

/**
 * Render the main UI
 */
export const renderUI = (state: ReaderState): void => {
  const root = document.getElementById('power-reader-root');
  if (!root) return;

  const { groups: postGroups, unreadItemCount, stats } = buildPostGroups(
    state.comments,
    state.posts,
    state
  );

  // Help section state
  const helpCollapsed = GM_getValue('helpCollapsed', false);
  const showHelp = !helpCollapsed;

  // Format date range
  const loadFrom = getLoadFrom();
  const startDate = loadFrom && loadFrom !== '__LOAD_RECENT__' ? formatStatusDate(loadFrom) : '?';
  const endDate = state.initialBatchNewestDate ? formatStatusDate(state.initialBatchNewestDate) : 'now';
  const userLabel = state.currentUsername ? `👤 ${state.currentUsername}` : '👤 not logged in';

  // Build HTML
  let html = `
    <div class="pr-header">
      <h1>Less Wrong: Power Reader <small style="font-size: 0.6em; color: #888;">v${__APP_VERSION__}</small></h1>
      <div class="pr-status">
        📆 ${startDate} → ${endDate}
        · 🔴 <span id="pr-unread-count">${unreadItemCount}</span> unread
        · 💬 ${stats.totalComments} comments (${stats.unreadComments} new · ${stats.contextComments} context · ${stats.hiddenComments} hidden)
        · 📄 ${stats.visiblePosts} posts${stats.hiddenPosts > 0 ? ` (${stats.hiddenPosts} filtered)` : ''}
        · ${userLabel}
      </div>
    </div>
    ${renderHelpSection(showHelp)}
  `;

  // Warning if more comments available
  if (state.moreCommentsAvailable) {
    html += `
      <div class="pr-warning">
        There are more comments available. Please reload after reading current comments to continue.
      </div>
    `;
  }

  if (postGroups.size === 0) {
    html += `
      <div class="pr-info">
        No content found. 
        <div style="margin-top: 10px;">
          <button id="pr-check-now-btn" class="pr-btn">Check Server Again</button>
          <button id="pr-change-date-btn" class="pr-btn">Change Starting Date</button>
        </div>
        <p style="font-size: 0.8em; margin-top: 15px;">
          Alternatively, you can <a href="/reader/reset">Reset all storage</a> to start fresh.
        </p>
      </div>
    `;
  }

  postGroups.forEach((group) => {
    html += renderPostGroup(group, state);
  });

  // Footer / Bottom message space
  html += `
    <div class="pr-footer-space" style="height: 100px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 20px;">
      <div id="pr-bottom-message" class="pr-bottom-message" style="display: none;"></div>
    </div>
  `;

  root.innerHTML = html;

  // Create sticky AI status bar if needed
  if (!document.querySelector('.pr-sticky-ai-status')) {
    const stickyStatus = document.createElement('div');
    stickyStatus.className = 'pr-sticky-ai-status';
    stickyStatus.id = 'pr-sticky-ai-status';
    document.body.appendChild(stickyStatus);
  }

  // Initialize resize handles (only once)
  if (!document.querySelector('.pr-resize-handle')) {
    initResizeHandles();
  }

  // Initialize preview system
  initPreviewSystem();

  // Setup help toggle
  setupHelpToggle();

  // Setup debug buttons
  setupDebugButtons();

  // Setup AI settings
  setupAISettings();

  // Setup features
  setupScrollTracking(() => state.comments, () => state.posts, () => state.initialBatchNewestDate);
  setupLinkPreviews(state.comments);
  (window as any).setupLinkPreviews = setupLinkPreviews; // For tests
  (window as any).renderUI = renderUI; // For tests
  setupStickyHeader();
  const sticky = getStickyHeader();
  if (sticky) sticky.refresh();

  setupInlineReactions(state);
  setupExternalLinks();

  refreshPostActionButtons();



  (window as any).getState = () => state;

  (window as any).manualPreview = manualPreview;



  Logger.info('UI Rendered');
};

/**
 * Setup help section toggle persistence
 */
const setupHelpToggle = (): void => {
  const helpSection = document.getElementById('pr-help-section') as HTMLDetailsElement;
  const helpSummary = helpSection?.querySelector('summary');
  if (helpSection && helpSummary) {
    helpSummary.addEventListener('click', () => {
      const willBeOpen = !helpSection.open;
      Logger.debug(`Help will be open: ${willBeOpen}`);
      GM_setValue('helpCollapsed', !willBeOpen);
    });
  }
};

/**
 * Setup debug buttons (export/reset state)
 */
const setupDebugButtons = (): void => {
  const exportBtn = document.getElementById('pr-export-state-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      exportState();
    });
  }

  const resetBtn = document.getElementById('pr-reset-state-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (confirm('Are you sure you want to reset all state (read status, author preferences)? This will reload the page.')) {
        clearAllStorage();
        window.location.href = '/reader';
      }
    });
  }

  const checkBtn = document.getElementById('pr-check-now-btn');
  if (checkBtn) {
    checkBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.reload();
    });
  }

  const changeBtn = document.getElementById('pr-change-date-btn');
  if (changeBtn) {
    changeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      setLoadFrom('');
      window.location.reload();
    });
  }
};

/**
 * Setup AI settings (prompt prefix)
 */
const setupAISettings = (): void => {
  const saveBtn = document.getElementById('pr-save-ai-prefix-btn');
  const resetBtn = document.getElementById('pr-reset-ai-prefix-btn');
  const input = document.getElementById('pr-ai-prefix-input') as HTMLTextAreaElement;

  if (input) {
    input.value = getAIStudioPrefix() || AI_STUDIO_PROMPT_PREFIX;
  }

  if (saveBtn && input) {
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const val = input.value.trim();
      setAIStudioPrefix(val);
      alert('AI Studio prompt prefix saved!');
    });
  }

  if (resetBtn && input) {
    resetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Reset to default prompt?')) {
        setAIStudioPrefix('');
        input.value = AI_STUDIO_PROMPT_PREFIX;
        alert('Reset to default!');
      }
    });
  }
};

/**
 * Show first-time setup UI with calendar picker
 */
export const showSetupUI = (
  onStart: (loadFrom: string | null) => Promise<void>
): void => {
  const root = document.getElementById('power-reader-root');
  if (!root) return;

  root.innerHTML = `
    <div class="pr-header">
      <h1>Welcome to Power Reader! <small style="font-size: 0.6em; color: #888;">v${__APP_VERSION__}</small></h1>
    </div>
    <div class="pr-setup">
      <p>Select a starting date to load comments from, or leave blank to load the most recent ${CONFIG.loadMax} comments.</p>
      <div class="pr-setup-form">
        <label for="loadFromDate">Load comments after:</label>
        <input type="date" id="loadFromDate" />
      </div>
      <button id="startReading" class="pr-btn">Start Reading</button>
    </div>
  `;

  const startBtn = document.getElementById('startReading');
  const dateInput = document.getElementById('loadFromDate') as HTMLInputElement;

  startBtn?.addEventListener('click', async () => {
    const dateValue = dateInput?.value;
    if (dateValue) {
      const date = new Date(dateValue + 'T00:00:00');
      await onStart(date.toISOString());
    } else {
      await onStart(null);
    }
  });
};
