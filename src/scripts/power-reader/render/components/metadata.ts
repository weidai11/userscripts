/**
 * Shared metadata component (Author, Date, Preferences)
 */

import { escapeHtml } from '../../utils/rendering';
import { getAuthorPreferences } from '../../utils/storage';
import { renderVoteButtons, renderReactions } from './actions';
import type { Post, Comment, NamesAttachedReactionsScore, CurrentUserExtendedVote } from '../../../../shared/graphql/queries';
import type { ReaderState } from '../../state';

export interface MetadataOptions {
  state?: ReaderState;
  isFullPost?: boolean;
  style?: string;
  extraClass?: string;
  children?: string;
}

/**
 * Render standardized metadata for a post or comment
 */
export const renderMetadata = (
  item: Post | Comment,
  options: MetadataOptions = {}
): string => {
  const { state, isFullPost = true, style = '', extraClass = '', children = '' } = options;
  const isPost = 'title' in item;

  const authorHandle = item.user?.username || (item as any).author || 'Unknown Author';
  const authorName = item.user?.displayName || authorHandle;
  const authorId = item.user?._id || '';

  const voteButtonsHtml = renderVoteButtons(
    item._id,
    item.baseScore || 0,
    item.currentUserVote ?? null,
    item.currentUserExtendedVote ?? null,
    (item.afExtendedScore as any)?.agreement ?? 0,
    isPost ? (item as Post).voteCount || 0 : 0,
    0, // agreementVoteCount
    isPost ? window.location.hostname.includes('effectivealtruism.org') || window.location.hostname === 'localhost' : true, // showAgreement: Posts (EAF only), Comments (All)
    isFullPost // showButtons
  );

  const reactionsHtml = renderReactions(
    item._id,
    item.extendedScore as NamesAttachedReactionsScore,
    item.currentUserExtendedVote as CurrentUserExtendedVote
  );

  // Author preferences
  const authorPrefs = getAuthorPreferences();
  let authorPref = authorPrefs[authorHandle];

  // Default to +1 if subscribed and no manual override
  if (authorPref === undefined && authorId && state?.subscribedAuthorIds.has(authorId)) {
    authorPref = 1;
  }
  authorPref = authorPref || 0;

  // Format timestamp
  const postedAt = item.postedAt || new Date().toISOString();
  const date = new Date(postedAt);
  const timeStr = date.toLocaleString().replace(/ ?GMT.*/, '');

  const authorSlug = item.user?.slug;
  const authorLink = authorSlug ? `/users/${authorSlug}` : '#';

  let containerClass = isPost ? 'pr-comment-meta pr-post-meta' : 'pr-comment-meta';
  if (extraClass) containerClass += ` ${extraClass}`;

  return `
    <div class="${containerClass}" style="${style}">
      ${voteButtonsHtml}
      ${reactionsHtml}
      <span class="pr-author-controls">
        <span class="pr-author-down ${authorPref < 0 ? 'active-down' : ''}" 
              data-action="author-down" 
              data-author="${escapeHtml(authorHandle)}"
              title="Mark author as disliked (auto-hide their future comments)">↓</span>
      </span>
      <a href="${authorLink}" target="_blank" class="pr-author" data-author-id="${authorId}">${escapeHtml(authorName)}</a>
      <span class="pr-author-controls">
        <span class="pr-author-up ${authorPref > 0 ? 'active-up' : ''}" 
              data-action="author-up" 
              data-author="${escapeHtml(authorHandle)}"
              title="Mark author as preferred (highlight their future comments)">↑</span>
      </span>
      <span class="pr-timestamp">
        <a href="${item.pageUrl || '#'}" target="_blank">${timeStr}</a>
      </span>
      ${children}
    </div>
  `;
};
