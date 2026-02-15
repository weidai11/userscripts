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

// Types for response structures
interface UserResponse {
    user: { _id: string } | null;
}
interface PostsResponse {
    posts: { results: Post[] };
}
interface CommentsResponse {
    comments: { results: Comment[] };
}

const PAGE_SIZE = 50;

/**
 * Fetch userId by username (slug)
 */
export const fetchUserId = async (username: string): Promise<string | null> => {
    try {
        const response = await queryGraphQL<UserResponse, any>(GET_USER_BY_SLUG, { slug: username });
        return response.user?._id || null;
    } catch (e) {
        Logger.error(`Failed to fetch userId for ${username}:`, e);
        return null;
    }
};

/**
 * Fetch all posts for a user with pagination
 */
export const fetchUserPosts = async (userId: string, onProgress?: (count: number) => void, minDate?: Date): Promise<Post[]> => {
    let allPosts: Post[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await queryGraphQL<PostsResponse, any>(GET_USER_POSTS, {
                userId,
                limit: PAGE_SIZE,
                offset
            });
            const results = response.posts?.results || [];

            // Check if we've reached past the minDate
            let filteredResults = results;
            if (minDate) {
                const oldestInBatch = results[results.length - 1];
                if (oldestInBatch && new Date(oldestInBatch.postedAt) < minDate) {
                    // Filter out items older than minDate
                    filteredResults = results.filter(p => new Date(p.postedAt) >= minDate);
                    hasMore = false; // Stop fetching
                }
            }

            allPosts = [...allPosts, ...filteredResults];

            if (onProgress) onProgress(allPosts.length);

            // If we didn't stop due to date, check if page is full
            if (hasMore) {
                if (results.length < PAGE_SIZE) {
                    hasMore = false;
                } else {
                    offset += PAGE_SIZE;
                }
            }
        } catch (e) {
            Logger.error(`Error fetching posts at offset ${offset}:`, e);
            hasMore = false;
        }
    }

    return allPosts;
};

/**
 * Fetch all comments for a user with pagination
 */
export const fetchUserComments = async (userId: string, onProgress?: (count: number) => void, minDate?: Date): Promise<Comment[]> => {
    let allComments: Comment[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await queryGraphQL<CommentsResponse, any>(GET_USER_COMMENTS, {
                userId,
                limit: PAGE_SIZE,
                offset
            });
            const results = response.comments?.results || [];

            // Check if we've reached past the minDate
            let filteredResults = results;
            if (minDate) {
                const oldestInBatch = results[results.length - 1];
                if (oldestInBatch && new Date(oldestInBatch.postedAt) < minDate) {
                    // Filter out items older than minDate
                    filteredResults = results.filter(c => new Date(c.postedAt) >= minDate);
                    hasMore = false; // Stop fetching
                }
            }

            allComments = [...allComments, ...filteredResults];

            if (onProgress) onProgress(allComments.length);

            // If we didn't stop due to date, check if page is full
            if (hasMore) {
                if (results.length < PAGE_SIZE) {
                    hasMore = false;
                } else {
                    offset += PAGE_SIZE;
                }
            }
        } catch (e) {
            Logger.error(`Error fetching comments at offset ${offset}:`, e);
            hasMore = false;
        }
    }

    return allComments;
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
