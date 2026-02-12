/**
 * Comment rendering for Power Reader
 */

import type { Comment, NamesAttachedReactionsScore, CurrentUserExtendedVote } from '../../../shared/graphql/queries';
import type { ReaderState } from '../state';
import { CONFIG } from '../config';
import { getScoreColor, getRecencyColor } from '../utils/colors';
import { getReadState, getAuthorPreferences, isRead, getLoadFrom } from '../utils/storage';
import { calculateTreeKarma, getAgeInHours, calculateNormalizedScore, shouldAutoHide, getFontSizePercent, clampScore } from '../utils/scoring';
import { renderVoteButtons, renderReactions, escapeHtml } from '../utils/rendering';
import { Logger } from '../utils/logger';

/**
 * Highlight quotes in the comment body based on reactions
 */
export const highlightQuotes = (html: string, extendedScore: NamesAttachedReactionsScore | null): string => {
  if (!extendedScore || !extendedScore.reacts) return html;

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

  if (quotesToHighlight.length === 0) return html;

  // Sort quotes by length descending to process longest first
  const uniqueQuotes = [...new Set(quotesToHighlight)].sort((a, b) => b.length - a.length);

  let processedHtml = html;

  uniqueQuotes.forEach(quote => {
    const escaped = quote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const regex = new RegExp(`(${escaped})`, 'g');
      processedHtml = processedHtml.replace(regex, (match) => {
        return `<span class="pr-highlight" title="Reacted content">${match}</span>`;
      });
    } catch {
      // Ignore regex errors
    }
  });

  return processedHtml;
};

const isPlaceholderComment = (comment: Comment): boolean => {
  return (comment as unknown as { isPlaceholder?: boolean }).isPlaceholder === true;
};

const renderMissingParentPlaceholder = (comment: Comment, repliesHtml: string = ''): string => {
  const postId = comment.postId || '';

  return `
    <div class="pr-comment pr-item read pr-missing-parent"
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
  const cutoff = getLoadFrom();
  const isImplicitlyRead = (item: { postedAt?: string }) => {
    return !!(cutoff && cutoff !== '__LOAD_RECENT__' && cutoff.includes('T') && item.postedAt && item.postedAt < cutoff);
  };

  if (visibleReplies.length > 0) {
    const readState = getReadState();
    visibleReplies.forEach((r: any) => {
      r.treeKarma = calculateTreeKarma(
        r._id,
        r.baseScore || 0,
        readState[r._id] === 1 || isImplicitlyRead(r),
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

export const renderComment = (comment: Comment, state: ReaderState, repliesHtml: string = ''): string => {
  if (isPlaceholderComment(comment)) {
    return renderMissingParentPlaceholder(comment, repliesHtml);
  }

  const readState = getReadState();
  const isLocallyRead = isRead(comment._id, readState, comment.postedAt);
  const commentIsRead = (comment as any).isContext || isLocallyRead;
  const unreadDescendantCount = getUnreadDescendantCount(comment._id, state, readState);

  // Placeholder Logic: If actually read and low activity in subtree, show blank placeholder
  // Exception: Never collapse if forceVisible is set (e.g. via Trace to Root)
  const showAsPlaceholder = isLocallyRead && unreadDescendantCount < 2 && !(comment as any).forceVisible;

  if (showAsPlaceholder) {
    // Render blank stub
    // We keep data attributes for functionality (like finding parent)
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
    // Note: Including repliesHtml ensures children remain in the DOM even if the parent is minimized.
  }

  const authorHandle = comment.user?.username || (comment as any).author || 'Unknown Author';
  const authorName = comment.user?.displayName || authorHandle;
  const authorKarma = comment.user?.karma || 0;
  const postedAt = comment.postedAt || new Date().toISOString();
  const ageHours = getAgeInHours(postedAt);
  const score = comment.baseScore || 0;
  const normalized = calculateNormalizedScore(score, ageHours, authorHandle, authorKarma, false);
  const order = (comment as any)._order || 0;
  const isContext = (comment as any).isContext;
  // const commentIsRead = isContext || isRead(comment._id); // Moved to top for placeholder check

  // Check if reply to current user
  const isReplyToYou = !!(state.currentUsername &&
    comment.parentComment?.user?.username === state.currentUsername);

  // Should auto-hide?
  const autoHide = shouldAutoHide(normalized) && !commentIsRead && !isContext;

  if (autoHide) {
    Logger.debug(`Auto-hiding comment ${comment._id} (score=${normalized.toFixed(2)})`);
  }

  // Calculate styles
  const clampedScore = clampScore(normalized);
  const scoreColor = normalized > 0 ? getScoreColor(clampedScore) : '';
  const recencyColor = order > 0 ? getRecencyColor(order, CONFIG.highlightLastN) : '';
  const fontSize = getFontSizePercent(score, false);

  // Author preferences
  const authorPrefs = getAuthorPreferences();
  let authorPref = authorPrefs[authorHandle];

  // Default to +1 if subscribed and no manual override
  if (authorPref === undefined && comment.user?._id && state.subscribedAuthorIds.has(comment.user._id)) {
    authorPref = 1;
  }
  authorPref = authorPref || 0;

  // Format timestamp
  const date = new Date(comment.postedAt);
  const timeStr = date.toLocaleString().replace(/ ?GMT.*/, '');

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

  // Vote buttons
  const voteButtonsHtml = renderVoteButtons(
    comment._id,
    comment.baseScore || 0,
    comment.currentUserVote ?? null,
    comment.currentUserExtendedVote ?? null,
    (comment.afExtendedScore as any)?.agreement ?? 0,
    0, // voteCount (comments don't display total vote count in button usually, or passed as 0)
    0, // agreementVoteCount
    true // showAgreement (always true for comments)
  );

  const reactionsHtml = renderReactions(
    comment._id,
    comment.extendedScore as NamesAttachedReactionsScore,
    comment.currentUserExtendedVote as CurrentUserExtendedVote
  );

  // Prepare HTML content with highlights
  let bodyContent = comment.htmlBody || '<i>(No content)</i>';
  bodyContent = highlightQuotes(bodyContent, comment.extendedScore as NamesAttachedReactionsScore);

  const authorSlug = comment.user?.slug;
  const authorLink = authorSlug ? `/users/${authorSlug}` : '#';

  const hasParent = !!comment.parentCommentId;
  const totalChildren = (comment as any).directChildrenCount || 0;
  // [r] button: always rendered, disabled when no replies or all loaded
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

  // [t] button: always rendered, disabled when already at top level
  const tDisabled = !hasParent;
  const tTooltip = tDisabled ? 'Already at top level' : 'Load parents and scroll to root (Shortkey: t)';

  return `
    <div class="${classes}" 
         data-id="${comment._id}" 
         data-author="${escapeHtml(authorHandle)}"
         data-parent-id="${comment.parentCommentId || ''}"
         data-post-id="${comment.postId}"
         style="${bodyStyle}">
      <div class="pr-comment-meta" style="${metaStyle} ${fontStyle}">
        ${voteButtonsHtml}
        ${reactionsHtml}
        <span class="pr-author-controls">
          <span class="pr-author-down ${authorPref < 0 ? 'active-down' : ''}" data-action="author-down" title="Mark author as disliked (auto-hide their future comments)">↓</span>
        </span>
        <a href="${authorLink}" target="_blank" class="pr-author" data-author-id="${comment.user?._id || ''}">${escapeHtml(authorName)}</a>
        <span class="pr-author-controls">
          <span class="pr-author-up ${authorPref > 0 ? 'active-up' : ''}" data-action="author-up" title="Mark author as preferred (highlight their future comments)">↑</span>
        </span>
        <span class="pr-timestamp">
          <a href="${comment.pageUrl}" target="_blank">${timeStr}</a>
        </span>
        <span class="pr-comment-controls">
          <span class="pr-comment-action text-btn" data-action="send-to-ai-studio" title="Send thread to AI Studio (Shortkey: g, Shift-G to include descendants)">[g]</span>
          <span class="pr-comment-action text-btn ${rDisabled ? 'disabled' : ''}" data-action="load-descendants" title="${rTooltip}">[r]</span>
          <span class="pr-comment-action text-btn ${tDisabled ? 'disabled' : ''}" data-action="load-parents-and-scroll" title="${tTooltip}">[t]</span>
          <span class="pr-find-parent text-btn" data-action="find-parent" title="Scroll to parent comment">[^]</span>
          <span class="pr-collapse text-btn" data-action="collapse" title="Collapse comment and its replies">[−]</span>
          <span class="pr-expand text-btn" data-action="expand" title="Expand comment">[+]</span>
        </span>
      </div>
      <div class="pr-comment-body">
        ${bodyContent}
      </div>
      ${repliesHtml}
    </div>
  `;
};
