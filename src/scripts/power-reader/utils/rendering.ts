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

import { renderVoteButtons } from './voting';
export { renderVoteButtons };
import { getReactions, DEFAULT_FILTER } from './reactions';
import type { Post, NamesAttachedReactionsScore, CurrentUserExtendedVote } from '../../../shared/graphql/queries';
import type { ReaderState } from '../state';
import { getAuthorPreferences } from './storage';

/**
 * Render reaction chips
 * Shared between comments and posts
 */
export const renderReactions = (
  commentId: string,
  extendedScore: NamesAttachedReactionsScore | null,
  currentUserExtendedVote: CurrentUserExtendedVote | null
): string => {
  let html = '<span class="pr-reactions-inner">';
  const reacts = extendedScore?.reacts || {};
  const userReacts = currentUserExtendedVote?.reacts || [];

  const allReactions = getReactions();

  // Calculate counts for each reaction type
  const reactionCounts: Record<string, number> = {};

  Object.entries(reacts).forEach(([reactName, users]) => {
    let score = 0;
    users.forEach(u => {
      if (u.reactType === 'disagreed') score -= 1;
      else score += 1;
    });
    if (score > 0) {
      reactionCounts[reactName] = score;
    }
  });

  allReactions.forEach(reaction => {
    const count = reactionCounts[reaction.name] || 0;
    const userVoted = userReacts.some(r => r.react === reaction.name);

    if (count > 0 || userVoted) {
      const filter = reaction.filter || DEFAULT_FILTER;
      const opacity = filter.opacity ?? 1;
      const saturate = filter.saturate ?? 1;
      const scale = filter.scale ?? 1;
      const tx = filter.translateX ?? 0;
      const ty = filter.translateY ?? 0;
      const padding = filter.padding ?? 0;

      const imgStyle = `
        filter: opacity(${opacity}) saturate(${saturate});
        transform: scale(${scale}) translate(${tx}px, ${ty}px);
        padding: ${padding}px;
      `;

      const title = `${reaction.label}${reaction.description ? '\\n' + reaction.description : ''}`;

      html += `
        <span class="pr-reaction-chip ${userVoted ? 'voted' : ''}" 
              data-action="reaction-vote" 
              data-comment-id="${commentId}" 
              data-reaction-name="${reaction.name}"
              title="${escapeHtml(title)}">
          <span class="pr-reaction-icon" style="overflow:visible">
             <img src="${reaction.svg}" alt="${reaction.name}" style="${imgStyle}">
          </span>
          <span class="pr-reaction-count">${count > 0 ? count : ''}</span>
        </span>
      `;
    }
  });

  html += `
    <span class="pr-add-reaction-btn" data-action="open-picker" data-comment-id="${commentId}" title="Add reaction">
      <svg height="16" viewBox="0 0 16 16" width="16"><g fill="currentColor"><path d="m13 7c0-3.31371-2.6863-6-6-6-3.31371 0-6 2.68629-6 6 0 3.3137 2.68629 6 6 6 .08516 0 .1699-.0018.25419-.0053-.11154-.3168-.18862-.6499-.22673-.9948l-.02746.0001c-2.76142 0-5-2.23858-5-5s2.23858-5 5-5 5 2.23858 5 5l-.0001.02746c.3449.03811.678.11519.9948.22673.0035-.08429.0053-.16903.0053-.25419z"></path><path d="m7.11191 10.4982c.08367-.368.21246-.71893.38025-1.04657-.15911.03174-.32368.04837-.49216.04837-.74037 0-1.40506-.3212-1.86354-.83346-.18417-.20576-.50026-.22327-.70603-.03911-.20576.18417-.22327.50026-.03911.70603.64016.71524 1.57205 1.16654 2.60868 1.16654.03744 0 .07475-.0006.11191-.0018z"></path><path d="m6 6c0 .41421-.33579.75-.75.75s-.75-.33579-.75-.75.33579-.75.75-.75.75.33579.75.75z"></path><path d="m8.75 6.75c.41421 0 .75-.33579.75-.75s-.33579-.75-.75-.75-.75.33579-.75.75.33579.75.75.75z"></path><path d="m15 11.5c0 1.933-1.567 3.5-3.5 3.5s-3.5-1.567-3.5-3.5 1.567-3.5 3.5-3.5 3.5 1.567 3.5 3.5zm-3-2c0-.27614-.2239-.5-.5-.5s-.5.22386-.5.5v1.5h-1.5c-.27614 0-.5.2239-.5.5s.22386.5.5.5h1.5v1.5c0 .2761.2239.5.5.5s.5-.2239.5-.5v-1.5h1.5c.2761 0 .5-.2239.5-.5s-.2239-.5-.5-.5h-1.5z"></path></g></svg>
    </span>
  `;

  html += '</span>';
  return html;
};

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
 * Render a post's metadata line (unified style)
 */
export const renderPostMetadata = (post: Post, state?: ReaderState, isFullPost: boolean = true): string => {
  const authorHandle = post.user?.username || 'Unknown Author';
  const authorName = post.user?.displayName || authorHandle;

  const voteButtonsHtml = renderVoteButtons(
    post._id,
    post.baseScore || 0,
    post.currentUserVote ?? null,
    post.currentUserExtendedVote ?? null,
    (post.afExtendedScore as any)?.agreement ?? 0,
    post.voteCount || 0,
    0,
    window.location.hostname.includes("effectivealtruism.org"),
    isFullPost
  );

  const reactionsHtml = renderReactions(
    post._id,
    post.extendedScore as NamesAttachedReactionsScore,
    post.currentUserExtendedVote as CurrentUserExtendedVote
  );

  // Author preferences
  const authorPrefs = getAuthorPreferences();
  let authorPref = authorPrefs[authorHandle];

  // Default to +1 if subscribed and no manual override
  if (authorPref === undefined && post.user?._id && state?.subscribedAuthorIds.has(post.user._id)) {
    authorPref = 1;
  }
  authorPref = authorPref || 0;

  // Format timestamp
  const postedAt = post.postedAt || new Date().toISOString();
  const date = new Date(postedAt);
  const timeStr = date.toLocaleString().replace(/ ?GMT.*/, '');

  const authorSlug = post.user?.slug;
  const authorLink = authorSlug ? `/users/${authorSlug}` : '#';

  return `
    <div class="pr-comment-meta pr-post-meta">
      ${voteButtonsHtml}
      ${reactionsHtml}
      <span class="pr-author-controls">
        <span class="pr-author-down ${authorPref < 0 ? 'active-down' : ''}" data-action="author-down" title="Mark author as disliked (auto-hide their future comments)">↓</span>
      </span>
      <a href="${authorLink}" target="_blank" class="pr-author" data-author-id="${post.user?._id || ''}">${escapeHtml(authorName)}</a>
      <span class="pr-author-controls">
        <span class="pr-author-up ${authorPref > 0 ? 'active-up' : ''}" data-action="author-up" title="Mark author as preferred (highlight their future comments)">↑</span>
      </span>
      <span class="pr-timestamp">
        <a href="${post.pageUrl}" target="_blank">${timeStr}</a>
      </span>
    </div>
  `;
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
  const metadataHtml = renderPostMetadata(post, state, isFullPost);
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
        <span class="pr-post-action text-btn" data-action="send-to-ai-studio" title="Send thread to AI Studio (Shortkey: g, Shift-G to include descendants)">[g]</span>
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