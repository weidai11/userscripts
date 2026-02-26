/**
 * Helper: Escape HTML
 */
export const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

import type { Post } from '../../../shared/graphql/queries';
import type { ReaderState } from '../state';
import { renderVoteButtons } from '../render/components/actions';
export { renderVoteButtons };
import { renderMetadata } from '../render/components/metadata';
import { renderReactions } from '../render/components/actions';
export { renderReactions };

import { getPostScoreColor } from './colors';
import { getAgeInHours, calculateNormalizedScore, clampScore, getFontSizePercent } from './scoring';

/**
 * Calculate header style for a post
 */
export const calculatePostHeaderStyle = (post: Post): string => {
  // If post content isn't loaded, stick to baseline styling
  if (!post.htmlBody) return '';

  const authorName = post.user?.username || 'Unknown Author';
  const authorKarma = post.user?.karma || 0;
  const postedAt = post.postedAt || new Date().toISOString();
  const ageHours = getAgeInHours(postedAt);
  const score = post.baseScore || 0;
  const normalized = calculateNormalizedScore(score, ageHours, authorName, authorKarma, true);
  const clampedScore = clampScore(normalized);
  const scoreColor = normalized > 0 ? getPostScoreColor(clampedScore) : '';
  const fontSize = getFontSizePercent(score, true);

  let style = '';
  if (scoreColor) style += `background-color: ${scoreColor};`;
  style += ` font-size: ${fontSize}%;`;
  return style;
};

/**
 * Render a post header (unified for regular and sticky)
 */
export const renderPostHeader = (
  post: Post,
  options: {
    isSticky?: boolean,
    isFullPost?: boolean,
    state?: ReaderState,
  } = {}
): string => {
  const { isSticky = false, isFullPost = false, state } = options;
  const metadataHtml = renderMetadata(post, { state, isFullPost });
  const headerStyle = calculatePostHeaderStyle(post);
  const escapedTitle = escapeHtml(post.title);


  const classes = [
    'pr-post-header',
    !isFullPost ? 'header-clickable' : '',
    isSticky ? 'pr-sticky-header-content' : '', // Internal class for sticky header
  ].filter(Boolean).join(' ');


  // Logic for disabling buttons
  const commentCount = post.commentCount || 0;

  let loadedCount = 0;
  let isLastPost = false;
  if (state) {
    loadedCount = state.comments.filter(c => c.postId === post._id).length;
    isLastPost = state.posts.length > 0 && state.posts[state.posts.length - 1]._id === post._id;
  }

  const eDisabled = false; // Will be refined by DOM check after render
  const eTooltip = isFullPost ? "Collapse post body" : "Expand/load post body";

  const aDisabled = commentCount === 0 || (commentCount > 0 && loadedCount >= commentCount);
  const aTooltip = commentCount === 0
    ? "No comments to load"
    : (aDisabled ? `All ${commentCount} comments already loaded` : `Load all ${commentCount} comments for this post`);

  const cDisabled = commentCount === 0;
  const cTooltip = cDisabled
    ? "No comments to scroll to"
    : "Scroll to first comment";

  const nDisabled = isLastPost;
  const nTooltip = nDisabled
    ? "No more posts in current feed"
    : "Scroll to next post";

  return `
    <div class="${classes}" data-action="scroll-to-post-top" style="${headerStyle}" data-post-id="${post._id}">
      ${metadataHtml}
      <h2><span class="pr-post-title" data-post-id="${post._id}"${!isFullPost ? ' data-action="load-post"' : ''}>${escapedTitle}</span></h2>
      <span class="pr-post-actions">
        <span class="pr-post-action text-btn" data-action="send-to-ai-studio" title="Send thread to AI Studio (Shortkey: g, Shift-G includes descendants and fetches them if needed)">[g]</span>
        <span class="pr-post-action text-btn" data-action="send-to-arena-max" title="Send thread to Arena.ai Max (Shortkey: m, Shift-M includes descendants and fetches them if needed)">[m]</span>
        <span class="pr-post-action text-btn ${eDisabled ? 'disabled' : ''}" data-action="toggle-post-body" title="${eTooltip}">[e]</span>
        <span class="pr-post-action text-btn ${aDisabled ? 'disabled' : ''}" data-action="load-all-comments" title="${aTooltip}">[a]</span>
        <span class="pr-post-action text-btn ${cDisabled ? 'disabled' : ''}" data-action="scroll-to-comments" title="${cTooltip}">[c]</span>
        <span class="pr-post-action text-btn ${nDisabled ? 'disabled' : ''}" data-action="scroll-to-next-post" title="${nTooltip}">[n]</span>
      </span>
      <span class="pr-post-toggle text-btn" data-action="collapse" title="${isSticky ? 'Collapse current threads' : 'Collapse post and comments'}">[−]</span>
      <span class="pr-post-toggle text-btn" data-action="expand" style="display:none" title="${isSticky ? 'Expand current threads' : 'Expand post and comments'}">[+]</span>
    </div>
  `;
};
