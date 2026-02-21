import { queryGraphQL } from '../../../shared/graphql/client';
import { GET_POST_COMMENTS } from '../../../shared/graphql/queries';
import type { Comment } from '../../../shared/graphql/queries';
import type {
  GetPostCommentsQuery,
  GetPostCommentsQueryVariables
} from '../../../generated/graphql';
import type { ReaderState } from '../state';
import { CONFIG } from '../config';
import { Logger } from '../utils/logger';

const POST_DESC_CACHE_TTL_MS = 10 * 60 * 1000;

const dedupeCommentsById = (comments: Comment[]): Comment[] => {
  const byId = new Map<string, Comment>();
  comments.forEach((comment) => byId.set(comment._id, comment));
  return Array.from(byId.values());
};

export const getPostCommentsFromState = (state: ReaderState, postId: string): Comment[] =>
  state.comments.filter((comment) => comment.postId === postId);

const getFreshPostCacheEntry = (state: ReaderState, postId: string) => {
  const entry = state.postDescendantsCache.get(postId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > POST_DESC_CACHE_TTL_MS) {
    state.postDescendantsCache.delete(postId);
    return null;
  }
  return entry;
};

export const getCachedPostComments = (state: ReaderState, postId: string): Comment[] =>
  getFreshPostCacheEntry(state, postId)?.comments || [];

export const getAvailablePostComments = (state: ReaderState, postId: string): Comment[] =>
  dedupeCommentsById([
    ...getPostCommentsFromState(state, postId),
    ...getCachedPostComments(state, postId)
  ]);

export const isPostCompleteInState = (state: ReaderState, postId: string, totalCount: number): boolean =>
  totalCount >= 0 && getPostCommentsFromState(state, postId).length >= totalCount;

export const isPostComplete = (state: ReaderState, postId: string, totalCount: number): boolean => {
  if (isPostCompleteInState(state, postId, totalCount)) return true;
  const entry = getFreshPostCacheEntry(state, postId);
  if (totalCount >= 0) {
    return !!entry && entry.complete && entry.totalCount >= totalCount;
  }
  return !!entry && entry.complete;
};

const writePostCache = (
  state: ReaderState,
  postId: string,
  comments: Comment[],
  totalCount: number,
  complete: boolean
): void => {
  state.postDescendantsCache.set(postId, {
    comments: dedupeCommentsById(comments),
    totalCount,
    complete,
    fetchedAt: Date.now()
  });
};

export interface PostDescendantsFetchResult {
  comments: Comment[];
  totalCount: number;
  complete: boolean;
  fromCache: boolean;
}

export const fetchAllPostCommentsWithCache = async (
  state: ReaderState,
  postId: string,
  knownTotalCount: number
): Promise<PostDescendantsFetchResult> => {
  const totalCount = knownTotalCount;

  if (isPostCompleteInState(state, postId, totalCount)) {
    const comments = getPostCommentsFromState(state, postId);
    writePostCache(state, postId, comments, totalCount || comments.length, true);
    return {
      comments,
      totalCount: totalCount >= 0 ? totalCount : comments.length,
      complete: true,
      fromCache: true
    };
  }

  const cacheEntry = getFreshPostCacheEntry(state, postId);
  if (cacheEntry && cacheEntry.complete && (totalCount < 0 || cacheEntry.totalCount >= totalCount)) {
    return {
      comments: cacheEntry.comments,
      totalCount: cacheEntry.totalCount,
      complete: true,
      fromCache: true
    };
  }

  const limit = Math.max(CONFIG.loadMax, totalCount > 0 ? totalCount : 0);
  const response = await queryGraphQL<GetPostCommentsQuery, GetPostCommentsQueryVariables>(GET_POST_COMMENTS, {
    postId,
    limit,
  });
  const fetchedComments = (response?.comments?.results || []) as Comment[];
  const comments = dedupeCommentsById(fetchedComments);
  const complete = totalCount >= 0 ? comments.length >= totalCount : comments.length < limit;
  const effectiveTotal = totalCount >= 0 ? totalCount : comments.length;

  writePostCache(state, postId, comments, effectiveTotal, complete);

  Logger.info(`Post descendants cache update for ${postId}: ${comments.length} comments, complete=${complete}`);
  return {
    comments,
    totalCount: effectiveTotal,
    complete,
    fromCache: false
  };
};

export const collectCommentDescendants = (comments: Comment[], rootCommentId: string): Comment[] => {
  const childrenByParent = new Map<string, Comment[]>();
  comments.forEach((comment) => {
    if (!comment.parentCommentId) return;
    if (!childrenByParent.has(comment.parentCommentId)) {
      childrenByParent.set(comment.parentCommentId, []);
    }
    childrenByParent.get(comment.parentCommentId)!.push(comment);
  });

  const result: Comment[] = [];
  const queue: string[] = [rootCommentId];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const children = childrenByParent.get(parentId) || [];
    for (const child of children) {
      if (seen.has(child._id)) continue;
      seen.add(child._id);
      result.push(child);
      queue.push(child._id);
    }
  }

  return result;
};
