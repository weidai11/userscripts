/**
 * Data loading service for Power Reader
 * Implements the phased loading strategy from SPEC.md
 */

import { queryGraphQL } from '../../../shared/graphql/client';
import {
  GET_CURRENT_USER,
  GET_SUBSCRIPTIONS,
  GET_ALL_RECENT_COMMENTS_LITE,
  GET_NEW_POSTS_FULL,
  GET_COMMENT_REPLIES,
  GET_THREAD_COMMENTS,
  COMMENT_FIELDS,
} from '../../../shared/graphql/queries';
import type {
  Comment,
  Post,
} from '../../../shared/graphql/queries';
import type {
  GetCurrentUserQuery,
  GetCurrentUserQueryVariables,
  GetAllRecentCommentsQuery,
  GetAllRecentCommentsQueryVariables,
  GetSubscriptionsQuery,
  GetSubscriptionsQueryVariables,
  GetNewPostsFullQuery,
  GetNewPostsFullQueryVariables,
  GetCommentRepliesQuery,
  GetCommentRepliesQueryVariables,
  GetThreadCommentsQuery,
  GetThreadCommentsQueryVariables,
} from '../../../generated/graphql';
import { getLoadFrom, setLoadFrom } from '../utils/storage';
import { CONFIG } from '../config';
import { Logger } from '../utils/logger';
import type { ReaderState } from '../state';
import { rebuildIndexes } from '../state';
import { copyTransientCommentUiFlags, getCommentContextType } from '../types/uiCommentFlags';

export interface InitialLoadResult {
  comments: Comment[];
  posts: Post[];
  currentUsername: string | null;
  currentUserId: string | null;
  currentUserPaletteStyle: 'listView' | 'gridView' | null;
}

const isEAHost = (): boolean => window.location.hostname.includes('effectivealtruism.org');

const fetchRecentCommentsForEAF = async (afterDate: string): Promise<Comment[]> => {
  const cutoffMs = new Date(afterDate).getTime();
  if (!Number.isFinite(cutoffMs)) {
    Logger.warn(`EAF fallback skipped due to invalid after date: ${afterDate}`);
    return [];
  }

  const pageSize = Math.min(CONFIG.loadMax, 200);
  const maxPages = Math.max(1, Math.ceil(CONFIG.loadMax / pageSize));
  const seen = new Set<string>();
  const filtered: Comment[] = [];
  let pagesFetched = 0;

  for (let page = 0; page < maxPages; page++) {
    const offset = page * pageSize;
    const res = await queryGraphQL<GetAllRecentCommentsQuery, GetAllRecentCommentsQueryVariables>(
      GET_ALL_RECENT_COMMENTS_LITE,
      {
        limit: pageSize,
        offset,
        sortBy: 'newest',
      }
    );
    pagesFetched++;

    const batch = (res?.comments?.results || []) as Comment[];
    if (batch.length === 0) break;

    for (const comment of batch) {
      if (!comment?._id || seen.has(comment._id)) continue;
      seen.add(comment._id);
      const postedAtMs = comment.postedAt ? new Date(comment.postedAt).getTime() : NaN;
      if (Number.isFinite(postedAtMs) && postedAtMs >= cutoffMs) {
        filtered.push(comment);
      }
    }

    const oldestPostedAt = batch[batch.length - 1]?.postedAt;
    const oldestMs = oldestPostedAt ? new Date(oldestPostedAt).getTime() : NaN;
    const crossedCutoff = Number.isFinite(oldestMs) && oldestMs < cutoffMs;
    if (crossedCutoff || filtered.length >= CONFIG.loadMax) break;
  }

  filtered.sort((a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime());
  const limited = filtered.slice(0, CONFIG.loadMax);
  Logger.info(`EAF recent-comments fallback fetched ${pagesFetched} page(s), retained ${limited.length} comments after ${afterDate}`);
  return limited;
};

/**
 * Phase 1: Initial fast fetch - User + Comments
 * Returns sparse post data extracted from comments
 */
export const loadInitial = async (): Promise<InitialLoadResult & { lastInitialCommentDate?: string }> => {
  const injection = (window as any).__PR_TEST_STATE_INJECTION__;
  if (injection) {
    Logger.info('Using injected test state');
    return {
      comments: injection.comments || [],
      posts: injection.posts || [],
      currentUsername: injection.currentUsername || null,
      currentUserId: injection.currentUserId || null,
      currentUserPaletteStyle: injection.currentUserPaletteStyle || null
    };
  }

  const loadFrom = getLoadFrom();
  const afterDate = loadFrom === '__LOAD_RECENT__' ? undefined : loadFrom;

  Logger.info(`Initial fetch: after=${afterDate}`);
  const start = performance.now();

  const userPromise = queryGraphQL<GetCurrentUserQuery, GetCurrentUserQueryVariables>(GET_CURRENT_USER);
  const commentsPromise = (isEAHost() && !!afterDate)
    ? fetchRecentCommentsForEAF(afterDate)
    : queryGraphQL<GetAllRecentCommentsQuery, GetAllRecentCommentsQueryVariables>(GET_ALL_RECENT_COMMENTS_LITE, {
      after: afterDate,
      limit: CONFIG.loadMax,
      sortBy: afterDate ? 'oldest' : 'newest'
    }).then(res => (res?.comments?.results || []) as Comment[]);

  const [userRes, comments] = await Promise.all([
    userPromise,
    commentsPromise,
  ]);
  const networkTime = performance.now() - start;
  Logger.info(`Initial fetch network request took ${networkTime.toFixed(2)}ms`);

  // Extract user info
  let currentUsername: string | null = null;
  let currentUserId: string | null = null;
  let currentUserPaletteStyle: 'listView' | 'gridView' | null = null;

  if (userRes?.currentUser) {
    currentUsername = userRes.currentUser.username || '';
    currentUserId = userRes.currentUser._id;
    currentUserPaletteStyle = userRes.currentUser.reactPaletteStyle || null;
  }

  // Extract sparse posts from comments (just headers)
  const posts: Post[] = [];
  const seenPostIds = new Set<string>();
  comments.forEach(c => {
    if (c && c.post) {
      const postId = (c.post as Post)._id;
      if (!seenPostIds.has(postId)) {
        seenPostIds.add(postId);
        posts.push(c.post as Post);
      }
    }
  });

  const result = {
    comments,
    posts,
    currentUsername,
    currentUserId,
    currentUserPaletteStyle,
    lastInitialCommentDate: comments.length > 0 ? comments[comments.length - 1].postedAt : undefined
  };
  const totalTime = performance.now() - start;
  Logger.info(`Initial load completed in ${totalTime.toFixed(2)}ms (processing: ${(totalTime - networkTime).toFixed(2)}ms)`);
  return result;
};

/**
 * Batched fetch for comment replies using GraphQL aliasing
 */
export const fetchRepliesBatch = async (parentIds: string[]): Promise<Comment[]> => {
  const start = performance.now();
  if (parentIds.length === 0) return [];
  const isEAHost = window.location.hostname.includes('effectivealtruism.org');
  const CHUNK_SIZE = 30;
  const allResults: Comment[] = [];
  if (isEAHost) {
    for (const parentId of parentIds) {
      try {
        const res = await queryGraphQL<GetCommentRepliesQuery, GetCommentRepliesQueryVariables>(
          GET_COMMENT_REPLIES,
          { parentCommentId: parentId }
        );
        const results = (res?.comments?.results || []) as unknown as Comment[];
        allResults.push(...results);
      } catch (e) {
        Logger.error(`Reply fetch failed for parent ${parentId}`, e);
      }
    }
    Logger.info(`EA fallback reply fetch for ${parentIds.length} parents took ${(performance.now() - start).toFixed(2)}ms`);
    return allResults;
  }

  for (let i = 0; i < parentIds.length; i += CHUNK_SIZE) {
    const chunk = parentIds.slice(i, i + CHUNK_SIZE);
    const query = `
      query GetRepliesBatch(${chunk.map((_, j) => `$id${j}: String!`).join(', ')}) {
        ${chunk.map((_, j) => `
          r${j}: comments(selector: { commentReplies: { parentCommentId: $id${j} } }) {
            results {
              ...CommentFieldsFull
            }
          }
        `).join('\n')}
      }
      ${COMMENT_FIELDS}
    `;
    const variables: Record<string, string> = {};
    chunk.forEach((id, j) => variables[`id${j}`] = id);
    try {
      const res = await queryGraphQL(query, variables) as any;
      if (!res) continue;
      chunk.forEach((_, j) => {
        const results = res[`r${j}`]?.results || [];
        allResults.push(...(results as Comment[]));
      });
    } catch (e) {
      Logger.error(`Batch reply fetch failed for chunk starting at ${i}`, e);
    }
  }
  Logger.info(`Batch reply fetch for ${parentIds.length} parents took ${(performance.now() - start).toFixed(2)}ms`);
  return allResults;
};

/**
 * Batched fetch for full comment threads using GraphQL aliasing
 */
export const fetchThreadsBatch = async (threadIds: string[]): Promise<Comment[]> => {
  const start = performance.now();
  if (threadIds.length === 0) return [];
  const isEAHost = window.location.hostname.includes('effectivealtruism.org');
  const CHUNK_SIZE = 15; // Smaller chunk for threads as they return more data
  const allResults: Comment[] = [];
  if (isEAHost) {
    for (const threadId of threadIds) {
      try {
        const res = await queryGraphQL<GetThreadCommentsQuery, GetThreadCommentsQueryVariables>(
          GET_THREAD_COMMENTS,
          { topLevelCommentId: threadId, limit: 100 }
        );
        const results = (res?.comments?.results || []) as unknown as Comment[];
        allResults.push(...results);
      } catch (e) {
        Logger.error(`Thread fetch failed for root ${threadId}`, e);
      }
    }
    Logger.info(`EA fallback thread fetch for ${threadIds.length} threads took ${(performance.now() - start).toFixed(2)}ms`);
    return allResults;
  }

  for (let i = 0; i < threadIds.length; i += CHUNK_SIZE) {
    const chunk = threadIds.slice(i, i + CHUNK_SIZE);
    const query = `
      query GetThreadsBatch(${chunk.map((_, j) => `$id${j}: String!`).join(', ')}) {
        ${chunk.map((_, j) => `
          t${j}: comments(selector: { repliesToCommentThreadIncludingRoot: { topLevelCommentId: $id${j} } }, limit: 100) {
            results {
              ...CommentFieldsFull
            }
          }
        `).join('\n')}
      }
      ${COMMENT_FIELDS}
    `;
    const variables: Record<string, string> = {};
    chunk.forEach((id, j) => variables[`id${j}`] = id);
    try {
      const res = await queryGraphQL(query, variables) as any;
      if (!res) continue;
      chunk.forEach((_, j) => {
        const results = res[`t${j}`]?.results || [];
        allResults.push(...(results as Comment[]));
      });
    } catch (e) {
      Logger.error(`Batch thread fetch failed for chunk starting at ${i}`, e);
    }
  }
  Logger.info(`Batch thread fetch for ${threadIds.length} threads took ${(performance.now() - start).toFixed(2)}ms`);
  return allResults;
};

/**
 * Clean up read state to only include current IDs
 */
export const cleanupReadState = (_comments: Comment[], _posts: Post[]): void => {
  // Logic moved to ReadTracker for smarter cleanup
};

export interface EnrichmentResult {
  posts: Post[];
  comments: Comment[];
  subscribedAuthorIds: Set<string>;
  moreCommentsAvailable: boolean;
  primaryPostsCount: number;
}

/**
 * Phase 2: Background enrichment - posts + subscriptions
 * Fast phase that fetches post list and user subscriptions.
 */
export const enrichInBackground = async (
  state: ReaderState,
): Promise<EnrichmentResult> => {
  const start = performance.now();
  const injection = (window as any).__PR_TEST_STATE_INJECTION__;
  if (injection && injection.posts) {
    return {
      posts: injection.posts,
      comments: injection.comments || state.comments,
      subscribedAuthorIds: new Set(),
      moreCommentsAvailable: false,
      primaryPostsCount: injection.posts.length
    };
  }

  const currentUserId = state.currentUserId;
  const allComments = [...state.comments];

  const subsPromise = currentUserId
    ? queryGraphQL<GetSubscriptionsQuery, GetSubscriptionsQueryVariables>(GET_SUBSCRIPTIONS, { userId: currentUserId })
    : Promise.resolve(null);

  const loadFrom = getLoadFrom();
  const isLoadRecent = loadFrom === '__LOAD_RECENT__';
  const afterDate = isLoadRecent ? undefined : loadFrom;
  let startDate = afterDate;
  let endDate: string | undefined = undefined;

  if (allComments.length > 0) {
    const commentDates = allComments
      .map(c => c && c.postedAt)
      .filter((d): d is string => !!d)
      .sort();
    const oldestCommentDate = commentDates[0];
    const newestCommentDate = commentDates[commentDates.length - 1];

    if (isLoadRecent) {
      startDate = oldestCommentDate;
    } else if (allComments.length >= CONFIG.loadMax) {
      endDate = newestCommentDate;
    }
  }

  const [postsRes, subsRes] = await Promise.all([
    queryGraphQL<GetNewPostsFullQuery, GetNewPostsFullQueryVariables>(GET_NEW_POSTS_FULL, {
      after: startDate,
      before: endDate,
      limit: CONFIG.loadMax,
    }),
    subsPromise
  ]);
  const fetchTime = performance.now() - start;
  Logger.info(`Enrichment posts/subs fetch took ${fetchTime.toFixed(2)}ms`);

  const batchPosts = (postsRes?.posts?.results || []) as unknown as Post[];
  const primaryPostsCount = batchPosts.length;

  const subscribedAuthorIds = new Set<string>();
  if (subsRes?.subscriptions?.results) {
    (subsRes.subscriptions.results as any[]).forEach(r => {
      if (r.documentId) subscribedAuthorIds.add(r.documentId);
    });
  }

  const updatedPosts = [...batchPosts];
  const postIdSet = new Set(batchPosts.map(p => p._id));
  allComments.forEach(c => {
    if (c && c.post) {
      const postId = (c.post as Post)._id;
      if (!postIdSet.has(postId)) {
        postIdSet.add(postId);
        updatedPosts.push(c.post as Post);
      }
    }
  });

  const loadFromValue = getLoadFrom();
  const moreCommentsAvailable = loadFromValue !== '__LOAD_RECENT__' && allComments.length >= CONFIG.loadMax;

  const result = {
    posts: updatedPosts,
    comments: allComments,
    subscribedAuthorIds,
    moreCommentsAvailable,
    primaryPostsCount,
  };
  Logger.info(`Enrichment completed in ${(performance.now() - start).toFixed(2)}ms`);
  return result;
};

export interface SmartLoadResult {
  comments: Comment[];
}

/**
 * Phase 3: Deferred smart loading - fetch replies and ancestors for unread comments.
 * Reply-focused strategy: only fetches direct replies per unread comment and
 * missing ancestors for context. Full thread fetch reserved for very high activity (3+).
 */
export const runSmartLoading = async (
  state: ReaderState,
  readState: Record<string, 1>
): Promise<SmartLoadResult | null> => {
  const allComments = [...state.comments];
  const moreCommentsAvailable = state.moreCommentsAvailable;
  const forceSmartLoading = (window as any).PR_TEST_FORCE_SMART_LOADING === true;

  const unreadComments = allComments.filter(c => !readState[c._id]);

  // Only run smart loading if we are in "Update" mode (more comments available) 
  // or if forced by a test. This avoids unnecessary background fetching on small threads.
  if ((!moreCommentsAvailable && !forceSmartLoading) || unreadComments.length === 0) {
    return null;
  }

  const start = performance.now();
  Logger.info(`Smart Loading: Processing ${unreadComments.length} unread comments...`);

  // Map for O(1) existence checks and updates
  const commentMap = new Map<string, Comment>();
  allComments.forEach(c => commentMap.set(c._id, c));

  // Step 1: Group unread comments by thread.
  // We process threads as units to decide between "Fetch Whole Thread" vs "Fetch Specific Replies".
  const unreadByThread = new Map<string, Comment[]>();
  unreadComments.forEach(c => {
    const threadId = c.topLevelCommentId || c.postId || c._id;
    if (!unreadByThread.has(threadId)) {
      unreadByThread.set(threadId, []);
    }
    unreadByThread.get(threadId)!.push(c);
  });

  // Helper to merge new comments into our local list, respecting placeholders
  // Returns true if a new comment was added or a placeholder was replaced.
  const mergeComment = (comment: Comment): boolean => {
    if (!commentMap.has(comment._id)) {
      allComments.push(comment);
      commentMap.set(comment._id, comment);
      return true;
    } else {
      const existing = commentMap.get(comment._id);
      const existingType = existing ? getCommentContextType(existing) : undefined;
      const incomingType = getCommentContextType(comment);
      const existingHasBody = !!(existing?.htmlBody && existing.htmlBody.trim().length > 0);
      const incomingHasBody = !!(comment.htmlBody && comment.htmlBody.trim().length > 0);
      const shouldUpgrade = !!existing && (
        ((existingType === 'stub' || existingType === 'missing') && incomingType !== 'stub' && incomingType !== 'missing') ||
        (!existingHasBody && incomingHasBody)
      );
      if (shouldUpgrade) {
        copyTransientCommentUiFlags(existing, comment);
        const idx = allComments.indexOf(existing);
        if (idx !== -1) {
          allComments[idx] = comment;
          commentMap.set(comment._id, comment);
          return true;
        }
      }
    }
    return false;
  };

  const threadIdsToFetchFull = new Set<string>();
  const commentIdsToFetchReplies = new Set<string>();

  const childrenByParent = state.childrenByParentId;

  // Helper to detect if a comment has children we haven't loaded yet based on the API's count
  const hasMissingChildren = (commentId: string, directChildrenCount: number): boolean => {
    if (directChildrenCount <= 0) return false;
    const loadedChildren = childrenByParent.get(commentId);
    return !loadedChildren || loadedChildren.length < directChildrenCount;
  };

  // Step 2: Analyze each thread to build our fetch batches.
  unreadByThread.forEach((threadUnread, threadId) => {
    const commentsWithMissingChildren = threadUnread.filter(c => {
      const directCount = (c as any).directChildrenCount ?? 0;
      return hasMissingChildren(c._id, directCount);
    });

    // CASE A: HIGH ACTIVITY THREAD
    // If a single thread has 3+ unread comments with missing children,
    // it's more efficient to just fetch the whole thread (limit 100).
    if (commentsWithMissingChildren.length >= 3) {
      threadIdsToFetchFull.add(threadId);
      return;
    }

    // CASE B: LOW ACTIVITY THREAD
    // Fetch only the direct replies for the unread comments.
    commentsWithMissingChildren.forEach(target => {
      commentIdsToFetchReplies.add(target._id);
    });

    // Note: We NO LONGER do a background "Ancestor Walk-Up" here.
    // Per [PR-NEST-04], missing parents are rendered as empty placeholders.
    // This keeps the feed focused on NEW comments.
    // Full context is fetched on-demand when the user clicks [t] or [^].
  });

  const fetchPromises: Promise<void>[] = [];

  // PHASE 1: Fetch full threads for high-activity clusters using aliased batching.
  if (threadIdsToFetchFull.size > 0) {
    Logger.info(`Smart Loading: Fetching ${threadIdsToFetchFull.size} full threads in batch...`);
    fetchPromises.push(
      fetchThreadsBatch(Array.from(threadIdsToFetchFull)).then(results => {
        results.forEach(mergeComment);
      })
    );
  }

  // PHASE 3: Fetch specific replies for low-activity comments.
  // This also handles the "Dynamic Switch" if a parent turns out to have more children than expected.
  if (commentIdsToFetchReplies.size > 0) {
    Logger.info(`Smart Loading: Fetching replies for ${commentIdsToFetchReplies.size} comments in batch...`);
    fetchPromises.push(
      fetchRepliesBatch(Array.from(commentIdsToFetchReplies)).then(async (replyResults) => {
        const newThreadIdsToFetch = new Set<string>();
        const parentToChildrenCount = new Map<string, number>();
        let anyNewData = false;

        replyResults.forEach(c => {
          if (mergeComment(c)) anyNewData = true;
          if (c.parentCommentId) {
            parentToChildrenCount.set(c.parentCommentId, (parentToChildrenCount.get(c.parentCommentId) || 0) + 1);
          }
        });

        // Optimization: If the batch returned nothing new, don't trigger switches
        if (!anyNewData && replyResults.length > 0) return;

        // DYNAMIC SWITCH: If the reply fetch reveals branching (multiple children for one parent)
        // that we didn't expect, upgrade that thread to a full fetch to avoid missing "cousin" comments.
        parentToChildrenCount.forEach((count, parentId) => {
          if (count > 1) {
            const parent = commentMap.get(parentId);
            const threadId = parent?.topLevelCommentId || parent?.postId || parentId;
            if (!threadIdsToFetchFull.has(threadId)) {
              newThreadIdsToFetch.add(threadId);
            }
          }
        });

        if (newThreadIdsToFetch.size > 0) {
          Logger.info(`Smart Loading: Dynamic Switch triggered for ${newThreadIdsToFetch.size} threads`);
          const extraResults = await fetchThreadsBatch(Array.from(newThreadIdsToFetch));
          extraResults.forEach(mergeComment);
        }
      })
    );
  }

  // PHASE 4: Wait for all enrichment tasks to complete.
  await Promise.all(fetchPromises);

  const newCount = allComments.length - state.comments.length;
  Logger.info(`Smart Loading completed in ${(performance.now() - start).toFixed(2)}ms (${newCount} new comments)`);
  return { comments: allComments };
};

/**
 * Apply enrichment result to state
 */
export const applyEnrichment = (state: ReaderState, result: EnrichmentResult): void => {
  state.posts = result.posts;
  state.comments = result.comments;
  state.subscribedAuthorIds = result.subscribedAuthorIds;
  state.moreCommentsAvailable = result.moreCommentsAvailable;
  state.primaryPostsCount = result.primaryPostsCount;
  rebuildIndexes(state);
};

/**
 * Apply smart loading result to state
 */
export const applySmartLoad = (state: ReaderState, result: SmartLoadResult): void => {
  state.comments = result.comments;
  rebuildIndexes(state);
};

/**
 * Apply initial load result to state
 */
export const applyInitialLoad = (state: ReaderState, result: InitialLoadResult): void => {
  state.comments = result.comments;
  state.posts = result.posts;
  state.currentUsername = result.currentUsername;
  state.currentUserId = result.currentUserId;
  state.currentUserPaletteStyle = result.currentUserPaletteStyle;
  state.primaryPostsCount = 0;
  rebuildIndexes(state);

  // [PR-LOAD-01.1] Initial loadFrom Snapshot
  if (state.comments.length > 0) {
    const validComments = state.comments.filter(c => c.postedAt && !isNaN(new Date(c.postedAt).getTime()));
    if (validComments.length > 0) {
      const sorted = [...validComments].sort((a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime());
      const oldestDate = sorted[0].postedAt;
      setLoadFrom(oldestDate);
      Logger.info(`loader: Initial loadFrom snapshot set to ${oldestDate}`);
    }
  }
};
