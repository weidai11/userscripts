/**
 * Data loading logic for User Archive
 */

import { queryGraphQL } from '../../../shared/graphql/client';
import {
    GET_USER_BY_SLUG,
    GET_USER_POSTS,
    GET_USER_COMMENTS,
    GET_COMMENTS_BY_IDS,
    type Post,
    type Comment
} from '../../../shared/graphql/queries';
import { Logger } from '../utils/logger';

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
            });
            const results = (response[key]?.results || []) as T[];
            const duration = Date.now() - startTime;

            if (results.length === 0) {
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
                if (results.length < prevLimit) {
                    hasMore = false;
                } else {
                    // Update cursor to the timestamp of the last item in the batch
                    // The server's $lt filter ensures we don't get duplicates,
                    // and it's safer than risking an infinite loop on identical timestamps.
                    const lastItem = results[results.length - 1];
                    beforeCursor = lastItem.postedAt;
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
export const fetchCommentsByIds = async (commentIds: string[]): Promise<Comment[]> => {
    if (commentIds.length === 0) return [];

    // Dynamically import queries to avoid circular dependencies if any
    // const queries = await import('../../../shared/graphql/queries'); // Not needed if GET_COMMENTS_BY_IDS is directly imported

    // Chunk requests to avoid query size limits (e.g. 50 at a time)
    const chunks = [];
    for (let i = 0; i < commentIds.length; i += 50) {
        chunks.push(commentIds.slice(i, i + 50));
    }

    let allResults: Comment[] = [];

    for (const chunk of chunks) {
        try {
            const response = await queryGraphQL<{ comments: { results: Comment[] } }, any>(
                GET_COMMENTS_BY_IDS,
                { commentIds: chunk }
            );
            if (response.comments?.results) {
                allResults = [...allResults, ...response.comments.results];
            }
        } catch (e) {
            Logger.error('Failed to fetch context comments chunk:', e);
        }
    }

    return allResults;
};
