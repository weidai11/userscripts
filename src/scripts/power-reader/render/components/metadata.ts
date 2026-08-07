/**
 * Shared metadata component (Author, Date, Preferences)
 */

import { escapeHtml } from '../../utils/rendering';
import { getAuthorPreferences } from '../../utils/storage';
import { renderVoteButtons, renderReactions } from './actions';
import { isEAForumLikeHost } from '../../utils/forum';
import { getAuthorHandle } from '../../utils/author';
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
  displayName?: string | null;
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

    const coauthors = (post.coauthors || []) as Array<UserWithOptionalSlug | null>;
    for (const coauthor of coauthors) {
      const coauthorId = coauthor?._id;
      const coauthorSlug = coauthor?.slug;
      if (!coauthorId || typeof coauthorSlug !== 'string') continue;
      const normalizedCoauthorSlug = coauthorSlug.trim();
      if (!normalizedCoauthorSlug) continue;
      slugByAuthorId.set(coauthorId, normalizedCoauthorSlug);
    }
  }

};

const resolveSlugFromState = (authorId: string, state?: ReaderState): string | null => {
  if (!authorId || !state) return null;

  const cached = slugByAuthorId.get(authorId);
  if (cached) return cached;

  indexSlugsFromState(state);
  return slugByAuthorId.get(authorId) ?? null;
};

const getAuthorProfileLinkForUser = (
  user: UserWithOptionalSlug | null | undefined,
  fallbackHandle: string,
  state?: ReaderState
): string => {
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

const getAuthorProfileLink = (item: Post | Comment, fallbackHandle: string, state?: ReaderState): string => {
  const user = item.user as unknown as UserWithOptionalSlug | null | undefined;
  return getAuthorProfileLinkForUser(user, fallbackHandle, state);
};

type RenderableAuthor = {
  _id: string;
  displayName: string;
  profileLink: string;
};

const buildPostAuthors = (post: Post, state?: ReaderState): RenderableAuthor[] => {
  const primaryUser = post.user as unknown as UserWithOptionalSlug | null | undefined;
  const coauthors = (post.coauthors || []) as Array<UserWithOptionalSlug | null>;
  const candidates = [primaryUser, ...coauthors];
  const fallbackPrimaryHandle = getAuthorHandle(post);
  const seen = new Set<string>();
  const authors: RenderableAuthor[] = [];

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (!candidate) continue;

    const id = typeof candidate._id === 'string' ? candidate._id : '';
    const username = typeof candidate.username === 'string' ? candidate.username.trim() : '';
    const displayName = typeof candidate.displayName === 'string' ? candidate.displayName.trim() : '';
    const fallbackHandle = i === 0 ? fallbackPrimaryHandle : '';
    const handle = username || fallbackHandle || displayName;
    const visibleName = displayName || username || fallbackHandle;
    if (!handle || !visibleName) continue;

    const dedupeKey = id
      ? `id:${id}`
      : username
        ? `username:${username.toLowerCase()}`
        : `name:${visibleName.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    authors.push({
      _id: id,
      displayName: visibleName,
      profileLink: getAuthorProfileLinkForUser(candidate, handle, state),
    });
  }

  if (authors.length > 0) return authors;

  return [{
    _id: primaryUser?._id || '',
    displayName: fallbackPrimaryHandle,
    profileLink: getAuthorProfileLink(post, fallbackPrimaryHandle, state),
  }];
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

  const authorHandle = getAuthorHandle(item);
  const authorName = item.user?.displayName || authorHandle;
  const authorId = item.user?._id || '';

  const isEAHost = isEAForumLikeHost();
  const isEASystem = item.votingSystem === 'eaEmojis';

  // Post-level agreement axis is not supported on LW. EAF uses reaction chips instead.
  // Keep the separate agreement axis only for comments on LW-style voting systems.
  const showAgreement = !isPost && !isEAHost && !isEASystem;

  const afExtendedScore = item.afExtendedScore as UserWithOptionalAfAgreement | null | undefined;
  const agreementScore = item.extendedScore?.agreement ?? afExtendedScore?.agreement ?? 0;
  const agreementVoteCount = item.extendedScore?.agreementVoteCount ?? 0;
  const voteCount = item.extendedScore?.approvalVoteCount ?? item.voteCount ?? 0;

  const reactionsHtml = renderReactions(
    item._id,
    item.extendedScore as NamesAttachedReactionsScore,
    item.currentUserExtendedVote as CurrentUserExtendedVote
  );

  const voteButtonsHtml = renderVoteButtons(
    item._id,
    item.baseScore || 0,
    item.currentUserVote ?? null,
    item.currentUserExtendedVote ?? null,
    agreementScore,
    voteCount,
    agreementVoteCount,
    showAgreement,
    isFullPost, // showButtons
    reactionsHtml,
    item.extendedScore as NamesAttachedReactionsScore
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
  const authorsHtml = isPost
    ? buildPostAuthors(item as Post, state)
      .map(author =>
        `<a href="${escapeHtml(author.profileLink)}" target="_blank" class="pr-author" data-author-id="${escapeHtml(author._id)}">${escapeHtml(author.displayName)}</a>`
      )
      .join(', ')
    : `<a href="${escapeHtml(authorLink)}" target="_blank" class="pr-author" data-author-id="${escapeHtml(authorId)}">${escapeHtml(authorName)}</a>`;
  const hasCoauthors = isPost && (((item as Post).coauthors?.length || 0) > 0);
  const authorRole = hasCoauthors ? 'primary author' : 'author';
  const authorDownTitle = `Mark ${authorRole} as disliked (auto-hide their future comments)`;
  const authorUpTitle = `Mark ${authorRole} as preferred (highlight their future comments)`;

  let containerClass = isPost ? 'pr-comment-meta pr-post-meta' : 'pr-comment-meta';
  if (extraClass) containerClass += ` ${extraClass}`;

  return `
    <div class="${containerClass}" style="${style}">
      ${voteButtonsHtml}
      <span class="pr-author-controls">
        <span class="pr-author-down ${authorPref < 0 ? 'active-down' : ''}" 
              data-action="author-down" 
              data-author="${escapeHtml(authorHandle)}"
              title="${authorDownTitle}">&#8595;</span>
      </span>
      ${authorsHtml}
      <span class="pr-author-controls">
        <span class="pr-author-up ${authorPref > 0 ? 'active-up' : ''}" 
              data-action="author-up" 
              data-author="${escapeHtml(authorHandle)}"
              title="${authorUpTitle}">&#8593;</span>
      </span>
      <span class="pr-timestamp">
        <a href="${item.pageUrl || '#'}" target="_blank"><time datetime="${escapeHtml(postedAt)}">${timeStr}</time></a>
      </span>
      ${children}
    </div>
  `;
};

