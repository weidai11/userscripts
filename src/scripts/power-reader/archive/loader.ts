/**
 * Data loading logic for User Archive
 */

import { queryGraphQL } from '../../../shared/graphql/client';
import {
    GET_USER_BY_SLUG,
    GET_USER_POSTS,
    GET_USER_COMMENTS,
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
export const fetchUserPosts = async (userId: string, onProgress?: (count: number) => void): Promise<Post[]> => {
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
            allPosts = [...allPosts, ...results];

            if (onProgress) onProgress(allPosts.length);

            if (results.length < PAGE_SIZE) {
                hasMore = false;
            } else {
                offset += PAGE_SIZE;
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
export const fetchUserComments = async (userId: string, onProgress?: (count: number) => void): Promise<Comment[]> => {
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
            allComments = [...allComments, ...results];

            if (onProgress) onProgress(allComments.length);

            if (results.length < PAGE_SIZE) {
                hasMore = false;
            } else {
                offset += PAGE_SIZE;
            }
        } catch (e) {
            Logger.error(`Error fetching comments at offset ${offset}:`, e);
            hasMore = false;
        }
    }

    return allComments;
};
