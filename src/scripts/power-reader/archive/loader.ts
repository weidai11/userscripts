/**
 * Data loading logic for User Archive
 */

import { queryGraphQL, type GraphQLQueryOptions } from '../../../shared/graphql/client';
import {
    GET_USER_BY_SLUG,
    GET_USER_POSTS,
    GET_USER_COMMENTS,
    GET_COMMENTS_BY_IDS,
    type Post,
    type Comment
} from '../../../shared/graphql/queries';
import { Logger } from '../utils/logger';
import { loadContextualCommentsByIds, saveContextualItems } from './storage';

/**
 * Fetch userId by username (slug)
 */
export const fetchUserId = async (username: string): Promise<string | null> => {
    try {
        const response = await queryGraphQL<{ user: { _id: string } | null }, any>(GET_USER_BY_SLUG, { slug: username });
        return response.user?._id || null;
    } catch (e) {
        Logger.error(`Failed to fetch userId for ${username}:`, e);
        return null;
    }
};

const INITIAL_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 1000;
const TARGET_FETCH_TIME_MS = 2500; // Target ~2.5s per batch
const ARCHIVE_PARTIAL_QUERY_OPTIONS: GraphQLQueryOptions = {
    allowPartialData: true,
    toleratedErrorPatterns: [/Unable to find document/i, /commentGetPageUrl/i],
    operationName: 'archive-sync'
};

const isValidArchiveItem = <T extends { _id: string; postedAt: string }>(
    item: T | null | undefined
): item is T => {
    return !!item
        && typeof item._id === 'string'
        && item._id.length > 0
        && typeof item.postedAt === 'string'
        && item.postedAt.length > 0;
};

const getCursorTimestampFromBatch = <T extends { postedAt: string }>(
    rawItems: Array<T | null | undefined>
): string | null => {
    for (let i = rawItems.length - 1; i >= 0; i--) {
        const item = rawItems[i] as any;
        if (item && typeof item.postedAt === 'string' && item.postedAt.length > 0) {
            return item.postedAt;
        }
    }
    return null;
};

/**
 * Shared adaptive fetcher for posts and comments
 */
async function fetchCollectionAdaptively<T extends { postedAt: string; _id: string }>(
    userId: string,
    query: string,
    key: 'posts' | 'comments',
    onProgress?: (count: number) => void,
    minDate?: Date
): Promise<T[]> {
    let allItems: T[] = [];
    let hasMore = true;
    let currentLimit = INITIAL_PAGE_SIZE;
    let beforeCursor: string | null = null;

    while (hasMore) {
        const startTime = Date.now();
        try {
            const response = await queryGraphQL<any, any>(query, {
                userId,
                limit: currentLimit,
                before: beforeCursor
            }, ARCHIVE_PARTIAL_QUERY_OPTIONS);
            const rawResults = (response[key]?.results || []) as Array<T | null | undefined>;
            const results = rawResults.filter(isValidArchiveItem);
            const duration = Date.now() - startTime;

            if (results.length !== rawResults.length) {
                Logger.warn(`Archive ${key}: dropped ${rawResults.length - results.length} invalid items from partial GraphQL response.`);
            }

            if (rawResults.length === 0) {
                hasMore = false;
                break;
            }

            // Adjust limit for next batch based on timing
            const ratio = TARGET_FETCH_TIME_MS / Math.max(duration, 100);
            const clampedRatio = Math.min(Math.max(ratio, 0.5), 1.5);
            const nextLimit = Math.round(currentLimit * clampedRatio);

            const prevLimit = currentLimit;
            currentLimit = Math.min(Math.max(nextLimit, MIN_PAGE_SIZE), MAX_PAGE_SIZE);

            if (currentLimit !== prevLimit) {
                Logger.debug(`Adaptive batching: ${key} batch took ${duration}ms. Adjusting limit ${prevLimit} -> ${currentLimit}`);
            }

            // Check if we've reached past the minDate
            let filteredResults = results;
            if (minDate) {
                const oldestInBatch = results[results.length - 1];
                if (oldestInBatch && new Date(oldestInBatch.postedAt) < minDate) {
                    filteredResults = results.filter(item => new Date(item.postedAt) >= minDate);
                    hasMore = false;
                }
            }

            allItems = [...allItems, ...filteredResults];

            // Deduplicate by ID just in case
            const uniqueItems = new Map<string, T>();
            allItems.forEach(item => uniqueItems.set(item._id, item));
            allItems = Array.from(uniqueItems.values());

            if (onProgress) onProgress(allItems.length);

            if (hasMore) {
                if (rawResults.length < prevLimit) {
                    hasMore = false;
                } else {
                    // Update cursor to the timestamp of the last item in the batch
                    // The server's $lt filter ensures we don't get duplicates,
                    // and it's safer than risking an infinite loop on identical timestamps.
                    const nextCursor = getCursorTimestampFromBatch(rawResults);
                    if (!nextCursor) {
                        Logger.warn(`Archive ${key}: unable to derive next cursor from batch; stopping pagination to avoid loop.`);
                        hasMore = false;
                    } else {
                        beforeCursor = nextCursor;
                    }
                }
            }
        } catch (e) {
            Logger.error(`Error fetching ${key} with cursor ${beforeCursor}:`, e);
            throw e;
        }
    }

    return allItems;
}

/**
 * Fetch all posts for a user with adaptive pagination
 */
export const fetchUserPosts = (userId: string, onProgress?: (count: number) => void, minDate?: Date): Promise<Post[]> => {
    return fetchCollectionAdaptively<Post>(userId, GET_USER_POSTS, 'posts', onProgress, minDate);
};

/**
 * Fetch all comments for a user with adaptive pagination
 */
export const fetchUserComments = (userId: string, onProgress?: (count: number) => void, minDate?: Date): Promise<Comment[]> => {
    return fetchCollectionAdaptively<Comment>(userId, GET_USER_COMMENTS, 'comments', onProgress, minDate);
};

/**
 * Fetch comments by IDs (for thread context)
 */
const extractPostsFromComments = (comments: Comment[]): Post[] => {
    const postMap = new Map<string, Post>();
    comments.forEach(comment => {
        const post = (comment as any).post as Post | null | undefined;
        if (post?._id) {
            postMap.set(post._id, post);
        }
    });
    return Array.from(postMap.values());
};

export const fetchCommentsByIds = async (commentIds: string[], username?: string): Promise<Comment[]> => {
    if (commentIds.length === 0) return [];

    const uniqueIds = Array.from(new Set(commentIds));
    let cachedComments: Comment[] = [];
    let missingIds = uniqueIds;

    // Cache-first: contextual cache (owned comments are already in ReaderState/commentById upstream)
    if (username) {
        try {
            const cached = await loadContextualCommentsByIds(username, uniqueIds);
            cachedComments = cached.comments;
            missingIds = cached.missingIds;
            if (cachedComments.length > 0) {
                Logger.info(`Context cache hit: ${cachedComments.length} comments (${missingIds.length} misses)`);
            }
        } catch (e) {
            Logger.warn('Context cache lookup failed; falling back to network only.', e);
        }
    }

    // Dynamically import queries to avoid circular dependencies if any
    // const queries = await import('../../../shared/graphql/queries'); // Not needed if GET_COMMENTS_BY_IDS is directly imported

    // Chunk requests to avoid query size limits (e.g. 50 at a time)
    const chunks = [];
    for (let i = 0; i < missingIds.length; i += 50) {
        chunks.push(missingIds.slice(i, i + 50));
    }

    let networkResults: Comment[] = [];

    for (const chunk of chunks) {
        try {
            const response = await queryGraphQL<{ comments: { results: Comment[] } }, any>(
                GET_COMMENTS_BY_IDS,
                { commentIds: chunk },
                ARCHIVE_PARTIAL_QUERY_OPTIONS
            );
            if (response.comments?.results) {
                const valid = response.comments.results.filter(isValidArchiveItem);
                if (valid.length !== response.comments.results.length) {
                    Logger.warn(`Context fetch: dropped ${response.comments.results.length - valid.length} invalid comments from partial GraphQL response.`);
                }
                networkResults = [...networkResults, ...valid];
            }
        } catch (e) {
            Logger.error('Failed to fetch context comments chunk:', e);
        }
    }

    // Persist fetched context for future sessions.
    if (username && networkResults.length > 0) {
        try {
            await saveContextualItems(username, networkResults, extractPostsFromComments(networkResults));
        } catch (e) {
            Logger.warn('Failed to persist contextual cache entries.', e);
        }
    }

    // Merge cache + network results by ID (network wins for same ID if present).
    const mergedById = new Map<string, Comment>();
    cachedComments.forEach(c => mergedById.set(c._id, c));
    networkResults.forEach(c => mergedById.set(c._id, c));
    return Array.from(mergedById.values());
};
