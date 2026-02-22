/**
 * Shared metadata component (Author, Date, Preferences)
 */

import { escapeHtml } from '../../utils/rendering';
import { getAuthorPreferences } from '../../utils/storage';
import { renderVoteButtons, renderReactions } from './actions';
import { isEAForumLikeHost } from '../../utils/forum';
import type { Post, Comment, NamesAttachedReactionsScore, CurrentUserExtendedVote } from '../../../../shared/graphql/queries';
import type { ReaderState } from '../../state';

export interface MetadataOptions {
  state?: ReaderState;
  isFullPost?: boolean;
  style?: string;
  extraClass?: string;
  children?: string;
}

const slugByAuthorId = new Map<string, string>();

type UserWithOptionalSlug = {
  _id?: string | null;
  username?: string | null;
  slug?: string | null;
};

type UserWithOptionalAfAgreement = {
  agreement?: number | null;
};

const normalizeUsernameToSlugCandidate = (username: string): string => (
  username
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
);

const indexSlugsFromState = (state: ReaderState): void => {
  for (const comment of state.commentById.values()) {
    const authorId = comment.user?._id;
    const slug = comment.user?.slug;
    if (!authorId || typeof slug !== 'string') continue;
    const normalized = slug.trim();
    if (!normalized) continue;
    slugByAuthorId.set(authorId, normalized);
  }

  for (const post of state.postById.values()) {
    const authorId = post.user?._id;
    const slug = post.user?.slug;
    if (!authorId || typeof slug !== 'string') continue;
    const normalized = slug.trim();
    if (!normalized) continue;
    slugByAuthorId.set(authorId, normalized);
  }
};

const resolveSlugFromState = (authorId: string, state?: ReaderState): string | null => {
  if (!authorId || !state) return null;

  const cached = slugByAuthorId.get(authorId);
  if (cached) return cached;

  indexSlugsFromState(state);
  return slugByAuthorId.get(authorId) ?? null;
};

const getAuthorProfileLink = (item: Post | Comment, fallbackHandle: string, state?: ReaderState): string => {
  const user = item.user as unknown as UserWithOptionalSlug | null | undefined;
  const slug = user?.slug;
  if (typeof slug === 'string' && slug.trim().length > 0) {
    return `/users/${encodeURIComponent(slug.trim())}`;
  }

  const authorId = user?._id || '';
  const stateSlug = resolveSlugFromState(authorId, state);
  if (stateSlug) {
    return `/users/${encodeURIComponent(stateSlug)}`;
  }

  const username = user?.username || fallbackHandle;
  if (typeof username === 'string' && username.trim().length > 0) {
    const trimmed = username.trim();
    const candidate = normalizeUsernameToSlugCandidate(trimmed);
    return `/users/${encodeURIComponent(candidate || trimmed)}`;
  }

  return '#';
};

/**
 * Render standardized metadata for a post or comment
 */
export const renderMetadata = (
  item: Post | Comment,
  options: MetadataOptions = {}
): string => {
  const { state, isFullPost = true, style = '', extraClass = '', children = '' } = options;
  const isPost = 'title' in item;

  const authorHandle = item.user?.username || ('author' in item ? item.author : undefined) || 'Unknown Author';
  const authorName = item.user?.displayName || authorHandle;
  const authorId = item.user?._id || '';

  const isEAHost = isEAForumLikeHost();
  const isEASystem = item.votingSystem === 'eaEmojis';

  // EA Forum uses reactions for Agree/Disagree, while LessWrong uses a separate agreement axis.
  // We disable the separate agreement axis for EA Forum content or when on the EAF host to avoid redundancy.
  const showAgreement = !isEAHost && !isEASystem;

  const afExtendedScore = item.afExtendedScore as UserWithOptionalAfAgreement | null | undefined;
  const agreementScore = item.extendedScore?.agreement ?? afExtendedScore?.agreement ?? 0;
  const agreementVoteCount = item.extendedScore?.agreementVoteCount ?? 0;

  const voteButtonsHtml = renderVoteButtons(
    item._id,
    item.baseScore || 0,
    item.currentUserVote ?? null,
    item.currentUserExtendedVote ?? null,
    agreementScore,
    isPost ? (item as Post).voteCount || 0 : 0,
    agreementVoteCount,
    showAgreement,
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

  const authorLink = getAuthorProfileLink(item, authorHandle, state);

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
      <a href="${escapeHtml(authorLink)}" target="_blank" class="pr-author" data-author-id="${authorId}">${escapeHtml(authorName)}</a>
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
