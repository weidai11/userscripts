
/**
 * Post rendering for Power Reader
 */

import type { Comment, Post, NamesAttachedReactionsScore } from '../../../shared/graphql/queries';
import type { ReaderState } from '../state';
import { isRead, getReadTrackingInputs } from '../utils/storage';
import { renderPostHeader, escapeHtml } from '../utils/rendering';
import { buildRenderDescendantMetrics, renderCommentTree } from './comment';
import { calculateTreeKarma } from '../utils/scoring';
import { Logger } from '../utils/logger';
import { renderPostBody as renderSharedPostBody } from './components/body';

export interface PostGroup {
  title: string;
  postId: string;
  comments: Comment[];
  fullPost?: Post;
}

type PlaceholderComment = Comment & { contextType: 'missing' };

const createMissingParentPlaceholder = (parentId: string, child: Comment): PlaceholderComment => {
  const postedAt = child.postedAt || new Date().toISOString();

  return {
    _id: parentId,
    postedAt,
    htmlBody: '',
    contents: { markdown: null },
    baseScore: 0,
    voteCount: 0,
    pageUrl: child.pageUrl || '',
    author: '',
    rejected: false,
    topLevelCommentId: child.topLevelCommentId || parentId,
    user: null,
    postId: child.postId,
    post: child.post ?? null,
    parentCommentId: null,
    parentComment: null,
    extendedScore: null,
    afExtendedScore: null,
    currentUserVote: null,
    currentUserExtendedVote: null,
    contextType: 'missing',
  } as unknown as PlaceholderComment;
};

const extractParentChain = (comment: Comment): Array<{ _id: string; parentCommentId: string | null }> => {
  const chain: Array<{ _id: string; parentCommentId: string | null }> = [];
  let current: any = comment.parentComment;
  while (current && current._id) {
    chain.push({ _id: current._id, parentCommentId: current.parentCommentId || null });
    current = current.parentComment;
  }
  return chain;
};

const withMissingParentPlaceholders = (comments: Comment[], state: ReaderState): Comment[] => {
  if (comments.length === 0) return comments;

  const loadedIds = state.commentById;
  const existingIds = new Set(comments.map(c => c._id));
  const placeholdersToAdd = new Map<string, Comment>();

  comments.forEach(comment => {
    const parentId = comment.parentCommentId;
    if (!parentId) return;
    if (loadedIds.has(parentId) || existingIds.has(parentId) || placeholdersToAdd.has(parentId)) return;

    const chain = extractParentChain(comment);

    let childForPlaceholder = comment;
    for (const ancestor of chain) {
      if (loadedIds.has(ancestor._id) || existingIds.has(ancestor._id) || placeholdersToAdd.has(ancestor._id)) {
        break;
      }
      const placeholder = createMissingParentPlaceholder(ancestor._id, childForPlaceholder);
      placeholder.parentCommentId = ancestor.parentCommentId as any;
      placeholdersToAdd.set(ancestor._id, placeholder);
      childForPlaceholder = placeholder;
    }

    if (!placeholdersToAdd.has(parentId) && !loadedIds.has(parentId) && !existingIds.has(parentId)) {
      placeholdersToAdd.set(parentId, createMissingParentPlaceholder(parentId, comment));
    }
  });

  if (placeholdersToAdd.size === 0) return comments;

  return [...comments, ...placeholdersToAdd.values()];
};

const buildChildrenIndex = (comments: Comment[]): Map<string, Comment[]> => {
  const childrenByParentId = new Map<string, Comment[]>();

  comments.forEach((comment) => {
    const parentId = comment.parentCommentId || '';
    if (!childrenByParentId.has(parentId)) {
      childrenByParentId.set(parentId, []);
    }
    childrenByParentId.get(parentId)!.push(comment);
  });

  childrenByParentId.forEach(children => {
    children.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
  });

  return childrenByParentId;
};


/**
 * Render a post's full content with optional truncation
 */
export const renderPostBody = (post: Post, isTruncated: boolean = true): string => {
  return renderSharedPostBody(
    post.htmlBody || '',
    post.extendedScore as NamesAttachedReactionsScore,
    isTruncated
  );
};


/**
 * Render a post group with its comments
 */
export const renderPostGroup = (group: PostGroup, state: ReaderState): string => {
  const commentsWithPlaceholders = withMissingParentPlaceholders(group.comments, state);
  const visibleChildrenByParentId = buildChildrenIndex(commentsWithPlaceholders);

  const { readState, cutoff } = getReadTrackingInputs(state.isArchiveMode);
  const commentSet = new Set(commentsWithPlaceholders.map(c => c._id));
  const rootComments = (commentsWithPlaceholders as Comment[]).filter(c =>
    !c.parentCommentId || !commentSet.has(c.parentCommentId)
  );

  const isImplicitlyRead = (item: { postedAt?: string }) => {
    return !!(cutoff && cutoff !== '__LOAD_RECENT__' && cutoff.includes('T') && item.postedAt && item.postedAt < cutoff);
  };

  const treeKarmaCache = new Map<string, number>();
  const treeKarmaById = new Map<string, number>();
  rootComments.forEach(c => {
    const isItemRead = !state.isArchiveMode && (readState[c._id] === 1 || isImplicitlyRead(c));
    const treeKarma = calculateTreeKarma(
      c._id,
      c.baseScore || 0,
      isItemRead,
      visibleChildrenByParentId.get(c._id) || [],
      readState,
      visibleChildrenByParentId,
      cutoff,
      treeKarmaCache
    );
    treeKarmaById.set(c._id, treeKarma);
  });

  // Sort root comments by Tree-Karma descending, then by date descending
  rootComments.sort((a, b) => {
    const tkA = treeKarmaById.get(a._id) ?? -Infinity;
    const tkB = treeKarmaById.get(b._id) ?? -Infinity;
    if (tkA !== tkB) return tkB - tkA;
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
  });

  const descendantMetrics = buildRenderDescendantMetrics(state, commentSet, readState, !state.isArchiveMode);
  const readTracking = { readState, cutoff };

  const commentsHtml = rootComments.map(c =>
    renderCommentTree(c, state, commentsWithPlaceholders, commentSet, visibleChildrenByParentId, descendantMetrics, readTracking, treeKarmaCache)
  ).join('');

  const isFullPost = !!(group.fullPost && group.fullPost.htmlBody);
  const postToRender = group.fullPost || {
    _id: group.postId,
    title: group.title,
    slug: '',
    pageUrl: `${window.location.origin}/posts/${group.postId}`,
    postedAt: cutoff || new Date().toISOString(), // Use cutoff as fallback so it's considered read
    baseScore: 0,
    voteCount: 0,
    user: null,
    extendedScore: null,
    afExtendedScore: null,
    currentUserVote: null,
    currentUserExtendedVote: null,
    contents: { markdown: null },
    commentCount: 0,
    wordCount: 0,
  } as unknown as Post;

  if (!group.fullPost) {
    Logger.warn(`renderPostGroup: fullPost missing for ${group.postId}, using fallback`);
  }

  const isReadPost = !state.isArchiveMode && isRead(group.postId, readState, postToRender.postedAt);

  // Detect current expansion state if element already exists in DOM
  const existingEl = document.querySelector(`.pr-post[data-id="${group.postId}"]`);
  const currentlyTruncated = existingEl ? existingEl.querySelector('.pr-post-body-container')?.classList.contains('truncated') : true;

  const headerHtml = renderPostHeader(postToRender, {
    isFullPost: isFullPost,
    state: state
  });

  const postBodyHtml = isFullPost ? renderPostBody(group.fullPost!, currentlyTruncated !== false) : '';

  const authorHandle = postToRender.user?.username || '';

  return `
    <div class="pr-post pr-item ${isReadPost ? 'read' : ''}" 
         data-post-id="${group.postId}" 
         data-id="${group.postId}"
         data-author="${escapeHtml(authorHandle)}">
      ${headerHtml}
      ${postBodyHtml}
      <div class="pr-post-comments">
        ${commentsHtml}
      </div>
    </div>
  `;
};
