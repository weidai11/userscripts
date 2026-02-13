/**
 * Hover preview system for Power Reader
 * Implements "transparent overlay" logic for previews
 */

import { Logger } from './logger';
import { sanitizeHtml } from './sanitize';
import { queryGraphQL } from '../../../shared/graphql/client';
import { GET_POST, GET_COMMENT, GET_USER, GET_USER_BY_SLUG } from '../../../shared/graphql/queries';
import type { Comment } from '../../../shared/graphql/queries';
import type {
  GetPostQuery,
  GetPostQueryVariables,
  GetCommentQuery,
  GetCommentQueryVariables,
  GetUserQuery,
  GetUserQueryVariables,
  GetUserBySlugQuery,
  GetUserBySlugQueryVariables
} from '../../../generated/graphql';

const HOVER_DELAY = 300; // ms

interface PreviewState {
  activePreview: HTMLElement | null;
  triggerRect: DOMRect | null;
  hoverTimeout: number | null;
  currentTrigger: HTMLElement | null;
}

const state: PreviewState = {
  activePreview: null,
  triggerRect: null,
  hoverTimeout: null,
  currentTrigger: null,
};

let lastScrollTime = 0;
let lastMouseMoveTime = 0;
let lastKnownMousePos = { x: -1, y: -1 };

let listenersAdded = false;

/**
 * Initialize preview system
 */
export function initPreviewSystem(): void {
  if (listenersAdded) return;

  Logger.debug('initPreviewSystem: adding global listeners');

  // Global mouse move listener for "transparent overlay" logic
  document.addEventListener('mousemove', (e) => {
    trackMousePos(e);
    handleGlobalMouseMove(e);
  });
  document.addEventListener('click', handleGlobalClick, true);
  document.addEventListener('mousedown', () => dismissPreview(), true);

  // Track scrolling to ignore scroll-induced hovers
  window.addEventListener('scroll', () => {
    lastScrollTime = Date.now();
    // Dismiss any active or pending preview on scroll
    dismissPreview();
  }, { passive: true });

  listenersAdded = true;
}

/**
 * Track mouse position and timing to distinguish intentional movement from scrolling.
 */
function trackMousePos(e: MouseEvent): void {
  if (e.clientX === lastKnownMousePos.x && e.clientY === lastKnownMousePos.y) return;
  lastKnownMousePos = { x: e.clientX, y: e.clientY };
  lastMouseMoveTime = Date.now();
}

/**
 * Check if the current hover entry is intentional (caused by mouse move)
 * or accidental (caused by scrolling the element under a still mouse)
 */
export function isIntentionalHover(): boolean {
  const now = Date.now();

  // If we scrolled recently, it's NOT intentional (even if mousemove was also recent)
  if (now - lastScrollTime < 300) {
    return false;
  }

  // If we haven't moved the mouse recently, it's NOT intentional
  if (now - lastMouseMoveTime > 500) {
    return false;
  }

  // If we haven't moved since the last scroll started, it's NOT intentional
  if (lastScrollTime > lastMouseMoveTime) {
    return false;
  }

  return true;
}

/**
 * Handle mouse move for transparent overlay logic
 */
function handleGlobalMouseMove(e: MouseEvent): void {
  if (!state.activePreview || !state.triggerRect) return;

  // Check if mouse is within the original trigger bounds
  const inTrigger = isPointInRect(e.clientX, e.clientY, state.triggerRect);

  if (!inTrigger) {
    dismissPreview();
  }
}

/**
 * Handle click - if in trigger area, navigate
 */
function handleGlobalClick(e: MouseEvent): void {
  if (!state.activePreview || !state.triggerRect || !state.currentTrigger) return;

  const inTrigger = isPointInRect(e.clientX, e.clientY, state.triggerRect);

  if (inTrigger) {
    // If it's a middle click, let the browser handle it or use window.open
    const isMiddleClick = e.button === 1;

    // If it's a load-post action, don't intercept - let main.ts handle it
    if (state.currentTrigger.dataset.action === 'load-post') {
      dismissPreview();
      return;
    }

    // Navigate to the link
    const href = state.currentTrigger.getAttribute('href') ||
      state.currentTrigger.dataset.href;
    const target = state.currentTrigger.getAttribute('target');

    if (href) {
      // If it's Ctrl/Meta click OR middle click OR has target='_blank', open in new tab
      if (e.ctrlKey || e.metaKey || isMiddleClick || target === '_blank') {
        // Only prevent default if we're actually doing something different (like window.open)
        // Actually, always prevent if we handle it manually to avoid double opening
        e.preventDefault();
        e.stopPropagation();
        window.open(href, '_blank');
      } else {
        // Normal click on a trigger link: navigate in same tab
        e.preventDefault();
        e.stopPropagation();
        window.location.href = href;
      }

      dismissPreview();
    }
  }
}

/**
 * Check if point is within rect
 */
function isPointInRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Cancel any pending hover timer
 */
export function cancelHoverTimeout(): void {
  if (state.hoverTimeout) {
    Logger.debug('cancelHoverTimeout: clearing timeout', state.hoverTimeout);
    clearTimeout(state.hoverTimeout);
    state.hoverTimeout = null;
  }
}

/**
 * Dismiss any active preview
 */
export function dismissPreview(): void {
  Logger.debug('dismissPreview called');
  cancelHoverTimeout();

  if (state.activePreview) {
    Logger.debug('dismissPreview: removing active preview');
    state.activePreview.remove();
    state.activePreview = null;
  }

  state.triggerRect = null;
  state.currentTrigger = null;
}

/**
 * Setup hover preview for an element
 */
export function setupHoverPreview(
  trigger: HTMLElement,
  fetchContent: () => Promise<string>,
  options: {
    type: 'post' | 'comment' | 'wiki' | 'author';
    href?: string;
    position?: 'above' | 'below' | 'auto';
    targetGetter?: () => HTMLElement | HTMLElement[] | null; // Function to find the target element (for highlight vs preview)
  }
): void {
  if (trigger.dataset.previewAttached) return;
  trigger.dataset.previewAttached = '1';

  trigger.addEventListener('mouseenter', (e: MouseEvent) => {
    trackMousePos(e);
    Logger.debug('Preview mouseenter: trigger=', trigger.tagName, trigger.className, 'dataset=', JSON.stringify(trigger.dataset));

    if (!isIntentionalHover()) {
      return;
    }
    Logger.debug('setupHoverPreview: clearing pending timeout', state.hoverTimeout);

    // Check visibility for highlight and preview skipping
    if (options.targetGetter) {
      const result = options.targetGetter();
      if (result) {
        const targets = Array.isArray(result) ? result : [result];

        // 1. Highlight matches (always, regardless of visibility)
        if (targets.length > 0) {
          console.info(`[setupHoverPreview] Adding pr-parent-hover to ${targets.length} targets`);
          targets.forEach(t => t.classList.add('pr-parent-hover'));

          const removeHighlight = () => {
            console.info(`[setupHoverPreview] Removing pr-parent-hover from ${targets.length} targets`);
            targets.forEach(t => t.classList.remove('pr-parent-hover'));
            trigger.removeEventListener('mouseleave', removeHighlight);
          };
          trigger.addEventListener('mouseleave', removeHighlight);
        }

        // 2. Skip preview ONLY if fully visible
        // SPECIAL CASE: If the target is a sticky header, we still show the preview 
        // because the sticky header doesn't show the full post body.

        // We check visibility BEFORE adding the highlight class usually, 
        // but since we just added it, we must ensure isElementFullyVisible ignores it.
        const allFullyVisible = targets.every(t => {
          const isSticky = !!t.closest('.pr-sticky-header');
          if (isSticky) return false;
          return isElementFullyVisible(t);
        });

        if (allFullyVisible) {
          return;
        }
      }
    }

    state.hoverTimeout = window.setTimeout(async () => {
      state.hoverTimeout = null;
      Logger.debug('Preview timer triggered for', options.type);
      state.triggerRect = trigger.getBoundingClientRect();
      state.currentTrigger = trigger;

      // Store href for click handling
      if (options.href) {
        trigger.dataset.href = options.href;
      }

      try {
        const content = await fetchContent();

        // Check if we were dismissed while fetching
        if (state.currentTrigger !== trigger) {
          Logger.debug('Preview aborted: trigger changed during fetch');
          return;
        }

        Logger.debug('Preview content fetched', content.length);
        showPreview(content, options.type, options.position || 'auto');
      } catch (e) {
        Logger.error('Preview fetch failed:', e);
      }
    }, HOVER_DELAY);
  });

  trigger.addEventListener('mouseleave', () => {
    Logger.debug('Preview mouseleave: trigger=', trigger.tagName, trigger.className);
    if (state.hoverTimeout) {
      clearTimeout(state.hoverTimeout);
      state.hoverTimeout = null;
    }
  });
}

/**
 * Manually trigger a preview (useful for conditional logic)
 */
export function manualPreview(
  trigger: HTMLElement,
  fetchContent: () => Promise<string>,
  options: {
    type: 'post' | 'comment' | 'wiki' | 'author';
    href?: string;
    position?: 'above' | 'below' | 'auto';
  }
): void {
  if (!isIntentionalHover()) return;

  // Clear any existing
  if (state.hoverTimeout) {
    clearTimeout(state.hoverTimeout);
  }

  state.hoverTimeout = window.setTimeout(async () => {
    state.hoverTimeout = null;
    Logger.debug('Manual Preview triggered');
    state.triggerRect = trigger.getBoundingClientRect();
    state.currentTrigger = trigger;

    if (options.href) {
      trigger.dataset.href = options.href;
    }

    try {
      const content = await fetchContent();

      // Check if we were dismissed while fetching
      if (state.currentTrigger !== trigger) {
        Logger.debug('Manual Preview aborted: trigger changed during fetch');
        return;
      }

      Logger.debug('Manual Preview content fetched', content.length);
      showPreview(content, options.type, options.position || 'auto');
    } catch (e) {
      Logger.error('Preview fetch failed:', e);
    }
  }, HOVER_DELAY);
}

/**
 * Show preview overlay
 */
function showPreview(content: string, type: 'post' | 'comment' | 'wiki' | 'author', position: 'above' | 'below' | 'auto'): void {
  Logger.debug('showPreview: start');
  // Save triggerRect and currentTrigger before dismissing, since dismissPreview clears them
  const savedTriggerRect = state.triggerRect;
  const savedCurrentTrigger = state.currentTrigger;

  dismissPreview();

  // Restore the state needed for positioning
  state.triggerRect = savedTriggerRect;
  state.currentTrigger = savedCurrentTrigger;

  const preview = document.createElement('div');
  preview.className = `pr-preview-overlay ${type}-preview`;
  preview.innerHTML = content;

  document.body.appendChild(preview);
  state.activePreview = preview;

  // Position the preview
  positionPreview(preview, position);

  // Adaptive width: expand if content overflows
  adaptPreviewWidth(preview, position);
  Logger.debug('showPreview: end, activePreview visible=', !!document.querySelector('.pr-preview-overlay'));
}

/**
 * Expand preview width if content overflows, up to 90vw
 */
function adaptPreviewWidth(preview: HTMLElement, position: 'above' | 'below' | 'auto'): void {
  const maxWidth = window.innerWidth * 0.9; // 90vw
  let currentWidth = preview.offsetWidth;

  // Check if content has vertical overflow (scrollbar needed)
  // Give it a few iterations to find the right width
  for (let i = 0; i < 10; i++) {
    if (preview.scrollHeight <= preview.clientHeight + 2) {
      // No overflow, we're good
      break;
    }

    // Expand width by 150px each iteration
    currentWidth = Math.min(currentWidth + 150, maxWidth);
    preview.style.width = `${currentWidth}px`;
    preview.style.maxWidth = `${currentWidth}px`;

    // Reposition after width change
    positionPreview(preview, position);

    if (currentWidth >= maxWidth) {
      break; // Can't expand more
    }
  }
}

/**
 * Position preview relative to trigger
 */
function positionPreview(preview: HTMLElement, position: 'above' | 'below' | 'auto'): void {
  if (!state.triggerRect) return;

  const previewRect = preview.getBoundingClientRect();
  const h = previewRect.height;
  const w = previewRect.width;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const tr = state.triggerRect;

  let finalTop: number;
  let finalLeft: number;

  // Initial horizontal centering
  finalLeft = tr.left + (tr.width / 2) - (w / 2);
  finalLeft = Math.max(10, Math.min(finalLeft, vw - w - 10));

  // Determine side
  let side = position;
  if (side === 'auto') {
    const spaceAbove = tr.top;
    const spaceBelow = vh - tr.bottom;
    side = spaceAbove > spaceBelow ? 'above' : 'below';
  }

  if (side === 'above') {
    finalTop = tr.top - h - 10;
    if (finalTop < 10) {
      finalTop = 10;
      // If clamped top overlaps the trigger, try flipping to below
      if (finalTop + h > tr.top - 5) {
        const belowTop = tr.bottom + 10;
        if (belowTop + h < vh - 10) {
          finalTop = belowTop;
          side = 'below';
        } else {
          // If both sides are too tight, pick the one with more space
          if (vh - tr.bottom > tr.top) {
            finalTop = Math.max(10, vh - h - 10);
            side = 'below';
          } else {
            finalTop = 10;
            side = 'above';
          }
        }
      }
    }
  } else {
    // side === 'below'
    finalTop = tr.bottom + 10;
    if (finalTop + h > vh - 10) {
      finalTop = Math.max(10, vh - h - 10);
      // If clamped bottom overlaps the trigger, try flipping to above
      if (finalTop < tr.bottom + 5) {
        const aboveTop = tr.top - h - 10;
        if (aboveTop > 10) {
          finalTop = aboveTop;
          side = 'above';
        } else {
          // Both sides tight, pick more space
          if (tr.top > vh - tr.bottom) {
            finalTop = 10;
            side = 'above';
          }
        }
      }
    }
  }

  // OVERLAP ESCAPE: If still overlapping the trigger, shift horizontally 
  // This is especially important at screen edges where centering is limited.
  const verticalOverlap = (finalTop < tr.bottom + 5) && (finalTop + h > tr.top - 5);
  const horizontalOverlap = (finalLeft < tr.right + 5) && (finalLeft + w > tr.left - 5);
  const wasClamped = (finalLeft <= 15) || (finalLeft >= vw - w - 15);

  if ((verticalOverlap && horizontalOverlap) || (wasClamped && horizontalOverlap)) {
    // Shift away horizontally
    if (tr.left > vw / 2) {
      // Trigger is on right half, shift preview left
      finalLeft = tr.left - w - 20;
    } else {
      // Trigger is on left half, shift preview right
      finalLeft = tr.right + 20;
    }
    finalLeft = Math.max(10, Math.min(finalLeft, vw - w - 10));

    // If we shifted horizontally, we can also center vertically for better ergonomics
    if (finalLeft + w < tr.left || finalLeft > tr.right) {
      finalTop = tr.top + (tr.height / 2) - (h / 2);
      finalTop = Math.max(10, Math.min(finalTop, vh - h - 10));
    }
  }

  Logger.debug(`positionPreview: finalTop=${finalTop}, finalLeft=${finalLeft}, vw=${vw}, vh=${vh}`);
  preview.style.left = `${finalLeft}px`;
  preview.style.top = `${finalTop}px`;
}

/**
 * Create post preview content fetcher
 */
export function createPostPreviewFetcher(postId: string): () => Promise<string> {
  return async () => {
    const response = await queryGraphQL<GetPostQuery, GetPostQueryVariables>(GET_POST, { id: postId });
    const post = response.post?.result;

    if (!post) {
      return '<div class="pr-preview-loading">Post not found</div>';
    }

    return `
      <div class="pr-preview-header">
        <strong>${escapeHtml(post.title || '')}</strong>
        <span style="color: #666; margin-left: 10px;">
          by ${escapeHtml(post.user?.username || 'Unknown')} · ${post.baseScore} points
        </span>
      </div>
      <div class="pr-preview-content">
        ${sanitizeHtml(post.htmlBody || '<i>(No content)</i>')}
      </div>
    `;
  };
}

/**
 * Create comment preview content fetcher
 */
export function createCommentPreviewFetcher(
  commentId: string,
  localComments: Comment[]
): () => Promise<string> {
  return async () => {
    // First check if we have it locally
    const local = localComments.find(c => c._id === commentId);

    if (local) {
      return formatCommentPreview(local);
    }

    // Fetch from API
    const response = await queryGraphQL<GetCommentQuery, GetCommentQueryVariables>(GET_COMMENT, { id: commentId });
    const comment = response.comment?.result;

    if (!comment) {
      return '<div class="pr-preview-loading">Comment not found</div>';
    }

    return formatCommentPreview(comment as unknown as Comment);
  };
}

/**
 * Format comment for preview
 */
function formatCommentPreview(comment: Comment): string {
  const date = new Date(comment.postedAt);
  const timeStr = date.toLocaleString().replace(/ ?GMT.*/, '');

  return `
    <div class="pr-preview-header">
      <strong>${escapeHtml(comment.user?.username || 'Unknown')}</strong>
      <span style="color: #666; margin-left: 10px;">
        ${comment.baseScore} points · ${timeStr}
      </span>
    </div>
    <div class="pr-preview-content">
      ${sanitizeHtml(comment.htmlBody || '')}
    </div>
  `;
}

/**
 * Check if element is in viewport
 */
export function isElementInViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  );
}

/**
 * Check if element is visible enough to highlight instead of showing a preview.
 * Threshold: at least some part is visible, and it's not mostly covered by sticky header.
 */
export function isElementVisibleEnough(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const vw = window.innerWidth;

  // Is within viewport bounds?
  const inViewport = (
    rect.bottom > 0 &&
    rect.top < vh &&
    rect.right > 0 &&
    rect.left < vw
  );

  if (!inViewport) return false;

  // Is obscured by floating UI?
  // We sample a few points (corners and center)
  const points = [
    { x: rect.left + 5, y: rect.top + 5 },
    { x: rect.right - 5, y: rect.bottom - 5 },
    { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  ];

  const visiblePoints = points.filter(p => {
    if (p.x < 0 || p.x > vw || p.y < 0 || p.y > vh) return false;
    const found = document.elementFromPoint(p.x, p.y);
    // We allow .pr-preview-overlay because it might be the "Ghost of Tooltips Past"
    return !!found && (el === found || el.contains(found) || found.closest('.pr-preview-overlay'));
  });

  return visiblePoints.length > 0;
}

/**
 * Check if element is FULLY visible in viewport (all corners visible)
 * Kept for other uses, but we'll use VisibleEnough for hover highlights.
 */
export function isElementFullyVisible(el: HTMLElement): boolean {
  // Sticky header elements are partial by definition (no body)
  if (el.closest('.pr-sticky-header')) return false;

  if (el.classList.contains('pr-missing-parent') || el.dataset.placeholder === '1') return false;

  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const vw = window.innerWidth;

  // 1. Basic viewport check
  const inViewport = (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= vh &&
    rect.right <= vw
  );

  if (!inViewport) return false;

  // 2. Obscuration check (are the corners actually visible to the user?)
  // We sample 4 corners (slightly inset to avoid border issues)
  const points = [
    { x: rect.left + 2, y: rect.top + 2 },
    { x: rect.right - 2, y: rect.top + 2 },
    { x: rect.left + 2, y: rect.bottom - 2 },
    { x: rect.right - 2, y: rect.bottom - 2 }
  ];

  for (const p of points) {
    const found = document.elementFromPoint(p.x, p.y);
    // If it's obscured by something that isn't the element or its children, it's not fully visible
    // We allow .pr-preview-overlay because it might be the "Ghost of Tooltips Past"
    if (!found || !(el === found || el.contains(found) || found.closest('.pr-preview-overlay'))) {
      Logger.debug(`isElementFullyVisible: obscured at (${p.x}, ${p.y}) by`, found);
      return false;
    }
  }

  return true;
}

/**
 * Escape HTML
 */
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Parse URL safely with current origin as base.
 */
function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw, window.location.origin);
  } catch {
    return null;
  }
}

/**
 * True if hostname belongs to supported forum domains.
 */
function isAllowedForumHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'lesswrong.com' ||
    host.endsWith('.lesswrong.com') ||
    host === 'forum.effectivealtruism.org' ||
    host.endsWith('.forum.effectivealtruism.org') ||
    host === 'greaterwrong.com' ||
    host.endsWith('.greaterwrong.com')
  );
}

/**
 * Parse and validate URL for forum-domain + http(s) protocol.
 */
function parseForumUrl(raw: string): URL | null {
  const u = parseUrl(raw);
  if (!u) return null;
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!isAllowedForumHostname(u.hostname)) return null;
  return u;
}

/**
 * Extract comment ID from a URL
 */
export function extractCommentIdFromUrl(url: string): string | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;

  const queryId = parsed.searchParams.get('commentId');
  if (queryId && /^[a-zA-Z0-9_-]+$/.test(queryId)) return queryId;

  const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
  if (hash && /^[a-zA-Z0-9_-]+$/.test(hash)) return hash;

  return null;
}

/**
 * Check if URL is a LessWrong/EA Forum comment link
 */
export function isCommentUrl(url: string): boolean {
  const parsed = parseForumUrl(url);
  if (!parsed) return false;

  const hasCommentParam = parsed.searchParams.has('commentId');
  const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
  const hasCommentHash = /^[a-zA-Z0-9_-]{10,}$/.test(hash);
  return hasCommentParam || hasCommentHash;
}

/**
 * Check if URL is a LessWrong/EA Forum post link (not a comment)
 */
export function isPostUrl(url: string): boolean {
  const parsed = parseForumUrl(url);
  if (!parsed) return false;
  const hasPostPath = /\/posts\/[a-zA-Z0-9_-]+(?:\/|$)/.test(parsed.pathname);
  if (!hasPostPath) return false;
  return !isCommentUrl(url);
}

/**
 * Check if URL is a LessWrong/EA Forum wiki/tag link
 */
export function isWikiUrl(url: string): boolean {
  const parsed = parseForumUrl(url);
  if (!parsed) return false;
  const hasWikiPath = /\/(tag|wiki)\/[a-zA-Z0-9-]+(?:\/|$)/.test(parsed.pathname);
  if (!hasWikiPath) return false;
  return true;
}

/**
 * Check if URL is a LessWrong/EA Forum author profile link
 */
export function isAuthorUrl(url: string): boolean {
  const parsed = parseForumUrl(url);
  if (!parsed) return false;
  const hasUserPath = /\/users\/[a-zA-Z0-9_-]+(?:\/|$)/.test(parsed.pathname);
  if (!hasUserPath) return false;
  return true;
}

/**
 * Extract post ID from a URL
 */
export function extractPostIdFromUrl(url: string): string | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;
  const match = parsed.pathname.match(/\/posts\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Extract author slug from a URL
 */
export function extractAuthorSlugFromUrl(url: string): string | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;
  const match = parsed.pathname.match(/\/users\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Extract wiki/tag slug from a URL
 */
export function extractWikiSlugFromUrl(url: string): string | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;
  const match = parsed.pathname.match(/\/(tag|wiki)\/([a-zA-Z0-9-]+)/);
  return match ? match[2] : null;
}

/**
 * Create wiki preview fetcher (fetches HTML content from wiki page)
 */
export function createWikiPreviewFetcher(slug: string): () => Promise<string> {
  return async () => {
    const forumOrigin = parseForumUrl(window.location.href)?.origin || 'https://www.lesswrong.com';
    const url = new URL(`/tag/${slug}`, forumOrigin).toString();
    try {
      const response = await fetch(url);
      const html = await response.text();

      // Extract the main content from the wiki page
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Try to find the tag description content
      const contentEl = doc.querySelector('.TagPage-description, .ContentStyles-base, .tagDescription');
      const titleEl = doc.querySelector('h1, .TagPage-title');

      const title = titleEl?.textContent || slug;
      const content = contentEl?.innerHTML || '<i>(Unable to load wiki content)</i>';

      return `
        <div class="pr-preview-header">
          <strong>Wiki: ${escapeHtml(title)}</strong>
        </div>
        <div class="pr-preview-content">
          ${content}
        </div>
      `;
    } catch (e) {
      Logger.error('Wiki fetch failed:', e);
      return `<i>Failed to load wiki page for: ${escapeHtml(slug)}</i>`;
    }
  };
}

/**
 * Create author preview fetcher
 */
export function createAuthorPreviewFetcher(userId: string): () => Promise<string> {
  return async () => {
    const response = await queryGraphQL<GetUserQuery, GetUserQueryVariables>(GET_USER, { id: userId });
    const user = response.user?.result;

    if (!user) {
      return '<div class="pr-preview-loading">User not found</div>';
    }

    return renderUserPreview(user);
  };
}

/**
 * Create author preview fetcher by slug
 */
export function createAuthorBySlugPreviewFetcher(slug: string): () => Promise<string> {
  return async () => {
    const response = await queryGraphQL<GetUserBySlugQuery, GetUserBySlugQueryVariables>(GET_USER_BY_SLUG, { slug });
    const user = response.user;

    if (!user) {
      return '<div class="pr-preview-loading">User not found</div>';
    }

    return renderUserPreview(user);
  };
}

/**
 * Helper to render user preview html
 */
function renderUserPreview(user: any): string {
  return `
    <div class="pr-preview-header">
      <strong>${escapeHtml(user.displayName || user.username || 'Unknown')}</strong>
      <span style="color: #666; margin-left: 10px;">
        ${Math.round(user.karma)} karma · @${escapeHtml(user.username || '')}
      </span>
    </div>
    <div class="pr-preview-content">
      ${user.htmlBio || '<i>(No bio provided)</i>'}
    </div>
  `;
}
