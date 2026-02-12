import { queryGraphQL } from './client';
import { GET_ALL_RECENT_COMMENTS, GET_COMMENT } from './queries';
import type { Comment } from './queries';
import type {
    GetAllRecentCommentsQuery,
    GetAllRecentCommentsQueryVariables,
    GetCommentQuery,
    GetCommentQueryVariables
} from '../../generated/graphql';

/**
 * Maximum offset allowed by the LessWrong API.
 * The server throws "Exceeded maximum value for skip" if offset > 2000.
 * @see packages/lesswrong/lib/instanceSettings.ts - maxAllowedApiSkip
 */
export const MAX_API_SKIP = 2000;

/**
 * Finds the offset for a given timestamp using binary search.
 * 
 * NOTE: The LW API has a maximum skip of 2000. If the target timestamp is older
 * than what we can reach at offset=2000, we return 0 (load from most recent).
 * This means very old "load from" dates will effectively show newer comments.
 * 
 * @param targetTimestamp - The timestamp to find the offset for
 * @returns The offset, or 0 if timestamp is too old to reach within API limits
 */
export async function findOffsetForTimestamp(targetTimestamp: number): Promise<number> {
    // First check if the target is reachable at all within API limits
    // by checking the oldest comment we can access
    const maxOffsetCheck = await queryGraphQL<GetAllRecentCommentsQuery, GetAllRecentCommentsQueryVariables>(GET_ALL_RECENT_COMMENTS, {
        limit: 1,
        offset: MAX_API_SKIP
    });

    if (!maxOffsetCheck.comments?.results.length) {
        // No comments at max offset - use 0 (most recent)
        console.log('LW Power Reader: No comments at max offset, loading from most recent');
        return 0;
    }

    const oldestReachableTimestamp = new Date(maxOffsetCheck.comments.results[0].postedAt).getTime();

    if (targetTimestamp <= oldestReachableTimestamp) {
        // Target is older than what we can reach - return 0 to load most recent
        // and warn the user
        console.log(
            `LW Power Reader: Target date is older than ${MAX_API_SKIP} comments ago. ` +
            'Loading from most recent instead. Consider resetting your "load from" date.'
        );
        return 0;
    }

    // Binary search within the valid range [0, MAX_API_SKIP]
    let lo = 0;
    let hi = MAX_API_SKIP;

    while (hi - lo > 100) {
        const mid = Math.floor((lo + hi) / 2);

        const response = await queryGraphQL<GetAllRecentCommentsQuery, GetAllRecentCommentsQueryVariables>(GET_ALL_RECENT_COMMENTS, {
            limit: 1,
            offset: mid
        });

        if (!response.comments?.results.length) {
            hi = mid;
            continue;
        }

        const midTimestamp = new Date(response.comments.results[0].postedAt).getTime();

        if (midTimestamp > targetTimestamp) {
            lo = mid;  // Need older comments (higher offset)
        } else {
            hi = mid;  // Need newer comments (lower offset)
        }
    }

    return lo;
}

/**
 * Loads comments starting from a specific date.
 * 
 * @param targetDate - ISO date string, or null/undefined to load from most recent
 * @param count - Number of comments to load (max 1000 per API limit)
 * @returns Array of comments
 */
export async function loadCommentsFromDate(
    targetDate: string | null | undefined,
    count: number = 800
): Promise<Comment[]> {
    let offset = 0;

    if (targetDate) {
        const targetTimestamp = new Date(targetDate).getTime();
        offset = await findOffsetForTimestamp(targetTimestamp);
    }

    const response = await queryGraphQL<GetAllRecentCommentsQuery, GetAllRecentCommentsQueryVariables>(GET_ALL_RECENT_COMMENTS, {
        limit: Math.min(count, 1000), // API limit is 1000
        offset: offset
    });

    return (response.comments?.results || []) as Comment[];
}

/**
 * Fetches the date of a comment by its ID.
 * @param commentId - The comment ID
 * @returns The ISO date string
 * @throws Error if comment not found
 */
export async function getDateFromCommentId(commentId: string): Promise<string> {
    const response = await queryGraphQL<GetCommentQuery, GetCommentQueryVariables>(GET_COMMENT, { id: commentId });

    if (!response.comment?.result) {
        throw new Error(`Comment ${commentId} not found`);
    }

    return response.comment.result.postedAt;
}
