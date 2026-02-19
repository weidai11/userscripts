
/**
 * Comment rendering for Power Reader
 */

import type { Comment, NamesAttachedReactionsScore } from '../../../shared/graphql/queries';
import type { ReaderState } from '../state';
import { CONFIG } from '../config';
import { getScoreColor, getRecencyColor } from '../utils/colors';
import { getReadState, isRead, getLoadFrom, getReadTrackingInputs } from '../utils/storage';
import { calculateTreeKarma, getAgeInHours, calculateNormalizedScore, shouldAutoHide, getFontSizePercent, clampScore } from '../utils/scoring';
import { escapeHtml } from '../utils/rendering';
import { sanitizeHtml } from '../utils/sanitize';
import { renderMetadata } from './components/metadata';
import { renderBody } from './components/body';

/**
 * Highlight quotes in the comment body based on reactions
 */
export const highlightQuotes = (html: string, extendedScore: NamesAttachedReactionsScore | null): string => {
  const safeHtml = sanitizeHtml(html);
  if (!extendedScore || !extendedScore.reacts) return safeHtml;

  // Collect all quotes
  const quotesToHighlight: string[] = [];
  Object.values(extendedScore.reacts).forEach(users => {
    users.forEach(u => {
      if (u.quotes) {
        u.quotes.forEach(q => {
          if (q.quote && q.quote.trim().length > 0) {
            quotesToHighlight.push(q.quote);
          }
        });
      }
    });
  });

  if (quotesToHighlight.length === 0) return safeHtml;

  // Sort quotes by length descending to process longest first
  const uniqueQuotes = [...new Set(quotesToHighlight)].sort((a, b) => b.length - a.length);

  const parser = new DOMParser();
  const doc = parser.parseFromString(safeHtml, 'text/html');

  const replaceTextNode = (node: Text, quote: string): void => {
    const text = node.nodeValue || '';
    if (!text.includes(quote)) return;

    const parts = text.split(quote);
    if (parts.length <= 1) return;

    const fragment = doc.createDocumentFragment();
    parts.forEach((part, index) => {
      if (part) {
        fragment.appendChild(doc.createTextNode(part));
      }
      if (index < parts.length - 1) {
        const span = doc.createElement('span');
        span.className = 'pr-highlight';
        span.title = 'Reacted content';
        span.textContent = quote;
        fragment.appendChild(span);
      }
    });

    node.parentNode?.replaceChild(fragment, node);
  };

  uniqueQuotes.forEach((quote) => {
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let node = walker.nextNode();
    while (node) {
      const textNode = node as Text;
      if (!textNode.parentElement?.classList.contains('pr-highlight')) {
        nodes.push(textNode);
      }
      node = walker.nextNode();
    }

    nodes.forEach(textNode => replaceTextNode(textNode, quote));
  });

  return doc.body.innerHTML;
};

const getContextType = (comment: Comment): string | undefined =>
  (comment as any).contextType;

const renderMissingParentPlaceholder = (comment: Comment, repliesHtml: string = '', state?: ReaderState): string => {
  const postId = comment.postId || '';
  const readClass = state?.isArchiveMode ? '' : 'read';

  return `
    <div class="pr-comment pr-item ${readClass} pr-missing-parent"
         data-id="${comment._id}"
         data-post-id="${postId}"
         data-parent-id=""
         data-placeholder="1">${repliesHtml}</div>
  `;
};

/**
 * Render a comment tree recursively
 * Uses indexed children lookup for O(n) instead of O(n²)
 */
export const renderCommentTree = (
  comment: Comment,
  state: ReaderState,
  allComments: Comment[],
  allCommentIds?: Set<string>,
  childrenByParentId?: Map<string, Comment[]>
): string => {
  const idSet = allCommentIds ?? new Set(allComments.map(c => c._id));
  const childrenIndex = childrenByParentId ?? state.childrenByParentId;
  // Use indexed children lookup
  const replies = childrenIndex.get(comment._id) ?? [];
  // Filter to only include comments that are in the current render set
  const visibleReplies = replies.filter(r => idSet.has(r._id));

  // [PR-READ-07] Check for implicit read based on cutoff
  const { readState, cutoff } = getReadTrackingInputs(state.isArchiveMode);
  
  const isImplicitlyRead = (item: { postedAt?: string }) => {
    return !!(cutoff && cutoff !== '__LOAD_RECENT__' && cutoff.includes('T') && item.postedAt && item.postedAt < cutoff);
  };

  if (visibleReplies.length > 0) {
    visibleReplies.forEach((r: any) => {
      const isItemRead = !state.isArchiveMode && (readState[r._id] === 1 || isImplicitlyRead(r));
      r.treeKarma = calculateTreeKarma(
        r._id,
        r.baseScore || 0,
        isItemRead,
        childrenIndex.get(r._id) || [],
        readState,
        childrenIndex,
        cutoff
      );
    });

    // [PR-SORT-03] Sort by Tree-Karma descending, then by date descending
    visibleReplies.sort((a: any, b: any) => {
      const tkA = a.treeKarma || -Infinity;
      const tkB = b.treeKarma || -Infinity;
      if (tkA !== tkB) return tkB - tkA;
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    });
  }

  const repliesHtml = visibleReplies.length > 0
    ? `<div class="pr-replies">${visibleReplies.map(r => renderCommentTree(r, state, allComments, idSet, childrenIndex)).join('')}</div>`
    : '';

  return renderComment(comment, state, repliesHtml);
};

/**
 * Check if all descendants of a comment are already loaded.
 * Uses an iterative stack-based approach for efficiency.
 */
const hasAllDescendantsLoaded = (commentId: string, state: ReaderState): boolean => {
  const stack = [commentId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const comment = state.commentById.get(id);
    const directChildrenCount = comment ? (comment as any).directChildrenCount || 0 : 0;
    if (directChildrenCount <= 0) continue;
    const loadedChildren = state.childrenByParentId.get(id) || [];
    if (loadedChildren.length < directChildrenCount) return false;
    for (const child of loadedChildren) {
      stack.push(child._id);
    }
  }
  return true;
};

/**
 * Render a single comment
 */
const getUnreadDescendantCount = (commentId: string, state: ReaderState, readState: Record<string, 1>): number => {
  let count = 0;
  const stack = [commentId];

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const children = state.childrenByParentId.get(currentId) || [];

    for (const child of children) {
      if (!isRead(child._id, readState, child.postedAt)) {
        count++;
      }
      stack.push(child._id);
    }
  }

  return count;
};

const renderContextPlaceholder = (
  comment: Comment, state: ReaderState, repliesHtml: string = ''
): string => {
  const metadataHtml = renderMetadata(comment, {
    state,
    style: 'font-size: 80%;',
    isFullPost: false,
  });
  return `
    <div class="pr-comment pr-item context pr-context-placeholder"
         data-id="${comment._id}"
         data-parent-id="${comment.parentCommentId || ''}"
         data-post-id="${comment.postId}">
      ${metadataHtml}
      ${repliesHtml}
    </div>
  `;
};

export const renderComment = (comment: Comment, state: ReaderState, repliesHtml: string = ''): string => {
  const ct = getContextType(comment);
  if (ct === 'missing') return renderMissingParentPlaceholder(comment, repliesHtml, state);
  if (ct === 'stub') return renderContextPlaceholder(comment, state, repliesHtml);

  const { readState } = getReadTrackingInputs(state.isArchiveMode);
  // In archive mode, we ignore the local read state entirely to prevent collapsing context or greying out text
  const isLocallyRead = !state.isArchiveMode && isRead(comment._id, readState, comment.postedAt);
  const commentIsRead = !state.isArchiveMode && (ct === 'fetched' || isLocallyRead);
  const unreadDescendantCount = state.isArchiveMode ? Infinity : getUnreadDescendantCount(comment._id, state, readState);

  // Placeholder Logic: If actually read and low activity in subtree, show blank placeholder
  // Exception: Never collapse if forceVisible is set (e.g. via Trace to Root)
  const showAsPlaceholder = isLocallyRead && unreadDescendantCount < 2 && !(comment as any).forceVisible;

  if (showAsPlaceholder) {
    // Render blank stub
    return `
      <div class="pr-comment pr-item read pr-comment-placeholder" 
           data-id="${comment._id}" 
           data-parent-id="${comment.parentCommentId || ''}"
           data-post-id="${comment.postId}">
        <div class="pr-placeholder-bar" title="Ancestor Context (Click to expand)" data-action="expand-placeholder"></div>
        <div class="pr-replies-placeholder"></div> 
        ${repliesHtml}
      </div>
    `;
  }

  const authorHandle = comment.user?.username || (comment as any).author || 'Unknown Author';
  const postedAt = comment.postedAt || new Date().toISOString();
  const ageHours = getAgeInHours(postedAt);
  const score = comment.baseScore || 0;
  const authorKarma = comment.user?.karma || 0;
  const normalized = calculateNormalizedScore(score, ageHours, authorHandle, authorKarma, false);
  const order = (comment as any)._order || 0;
  const isContext = ct === 'fetched';

  // Check if reply to current user
  const isReplyToYou = !!(state.currentUsername &&
    comment.parentComment?.user?.username === state.currentUsername);

  // Should auto-hide?
  const autoHide = !state.isArchiveMode && shouldAutoHide(normalized) && !commentIsRead && !isContext;

  // Calculate styles
  const clampedScore = clampScore(normalized);
  const scoreColor = normalized > 0 ? getScoreColor(clampedScore) : '';
  const recencyColor = order > 0 ? getRecencyColor(order, CONFIG.highlightLastN) : '';
  const fontSize = getFontSizePercent(score, false);

  // CSS classes
  const classes = [
    'pr-comment',
    'pr-item',
    commentIsRead ? 'read' : '',
    comment.rejected ? 'rejected' : '',
    isContext ? 'context' : '',
    isReplyToYou ? 'reply-to-you' : '',
    (autoHide || comment.rejected) ? 'collapsed' : '',
    (comment as any).justRevealed ? 'pr-just-revealed' : '',
  ].filter(Boolean).join(' ');

  // Inline styles
  const metaStyle = scoreColor ? `background-color: ${scoreColor};` : '';
  const bodyStyle = recencyColor ? `--pr-recency-color: ${recencyColor};` : '';
  const fontStyle = `font-size: ${fontSize}%;`;

  const hasParent = !!comment.parentCommentId;
  const totalChildren = (comment as any).directChildrenCount || 0;

  let rDisabled: boolean;
  let rTooltip: string;
  if (totalChildren <= 0) {
    rDisabled = true;
    rTooltip = 'No replies to load';
  } else if (hasAllDescendantsLoaded(comment._id, state)) {
    rDisabled = true;
    rTooltip = 'All replies already loaded in current feed';
  } else {
    rDisabled = false;
    rTooltip = 'Load all replies from server (Shortkey: r)';
  }

  const tDisabled = !hasParent;
  const tTooltip = tDisabled ? 'Already at top level' : 'Load parents and scroll to root (Shortkey: t)';

  const controlsHtml = `
    <span class="pr-comment-controls">
      <span class="pr-comment-action text-btn" data-action="send-to-ai-studio" title="Send thread to AI Studio (Shortkey: g, Shift-G to include descendants)">[g]</span>
      <span class="pr-comment-action text-btn ${rDisabled ? 'disabled' : ''}" data-action="load-descendants" title="${rTooltip}">[r]</span>
      <span class="pr-comment-action text-btn ${tDisabled ? 'disabled' : ''}" data-action="load-parents-and-scroll" title="${tTooltip}">[t]</span>
      <span class="pr-find-parent text-btn" data-action="find-parent" title="Scroll to parent comment">[^]</span>
      <span class="pr-collapse text-btn" data-action="collapse" title="Collapse comment and its replies">[−]</span>
      <span class="pr-expand text-btn" data-action="expand" title="Expand comment">[+]</span>
    </span>
  `;

  const metadataHtml = renderMetadata(comment, {
    state,
    style: `${metaStyle} ${fontStyle}`,
    extraClass: 'pr-comment-meta-wrapper',
    children: controlsHtml
  });
  const bodyContent = renderBody(comment.htmlBody || '', comment.extendedScore as NamesAttachedReactionsScore);

  return `
    <div class="${classes}" 
         data-id="${comment._id}" 
         data-author="${escapeHtml(authorHandle)}"
         data-parent-id="${comment.parentCommentId || ''}"
         data-post-id="${comment.postId}"
         style="${bodyStyle}">
      ${metadataHtml}
      <div class="pr-comment-body">
        ${bodyContent}
      </div>
      ${repliesHtml}
    </div>
  `;
};
