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
    type Comment,
    type ParentCommentRef
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
const CONTEXT_FETCH_CHUNK_MAX_ATTEMPTS = 2;
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
    // For forward sync (oldest to newest), the cursor is the timestamp of the LAST (newest) item in the batch
    for (let i = rawItems.length - 1; i >= 0; i--) {
        const item = rawItems[i] as any;
        if (item && typeof item.postedAt === 'string' && item.postedAt.length > 0) {
            return item.postedAt;
        }
    }
    return null;
};

const parseTimestampMs = (timestamp: string): number | null => {
    const value = Date.parse(timestamp);
    return Number.isFinite(value) ? value : null;
};

const compareTimestamps = (a: string, b: string): number => {
    const aMs = parseTimestampMs(a);
    const bMs = parseTimestampMs(b);
    if (aMs !== null && bMs !== null) return aMs - bMs;
    // Fallback for unexpected non-ISO-but-comparable strings.
    return a.localeCompare(b);
};

const getLatestCursorTimestampFromBatch = <T extends { postedAt: string }>(
    rawItems: Array<T | null | undefined>,
    baselineCursor: string | null
): string | null => {
    let latest: string | null = null;

    for (const item of rawItems) {
        const postedAt = (item as any)?.postedAt;
        if (typeof postedAt !== 'string' || postedAt.length === 0) continue;
        if (baselineCursor && compareTimestamps(postedAt, baselineCursor) <= 0) continue;
        if (!latest || compareTimestamps(postedAt, latest) > 0) {
            latest = postedAt;
        }
    }

    return latest;
};

const summarizeBatchForCursorDebug = <T extends { postedAt: string; _id: string }>(
    rawItems: Array<T | null | undefined>
): {
    firstTimestamp: string | null;
    lastTimestamp: string | null;
    firstId: string | null;
    lastId: string | null;
    uniqueIdCount: number;
    duplicateIdCount: number;
    uniqueTimestampCount: number;
    missingTimestampCount: number;
    headIds: string[];
    tailIds: string[];
} => {
    const seenIds = new Set<string>();
    const duplicateIds = new Set<string>();
    const uniqueTimestamps = new Set<string>();
    const idSequence: string[] = [];
    let missingTimestampCount = 0;
    let firstTimestamp: string | null = null;
    let lastTimestamp: string | null = null;
    let firstId: string | null = null;
    let lastId: string | null = null;

    for (const item of rawItems) {
        const anyItem = item as any;
        const itemId = typeof anyItem?._id === 'string' && anyItem._id.length > 0
            ? anyItem._id
            : '(missing-id)';
        idSequence.push(itemId);

        if (itemId !== '(missing-id)') {
            if (seenIds.has(itemId)) duplicateIds.add(itemId);
            seenIds.add(itemId);
        }

        const postedAt = typeof anyItem?.postedAt === 'string' && anyItem.postedAt.length > 0
            ? anyItem.postedAt
            : null;

        if (!postedAt) {
            missingTimestampCount++;
            continue;
        }

        uniqueTimestamps.add(postedAt);
        if (!firstTimestamp) {
            firstTimestamp = postedAt;
            firstId = itemId;
        }
        lastTimestamp = postedAt;
        lastId = itemId;
    }

    const headIds = idSequence.slice(0, 3);
    const tailIds = idSequence.slice(Math.max(0, idSequence.length - 3));

    return {
        firstTimestamp,
        lastTimestamp,
        firstId,
        lastId,
        uniqueIdCount: seenIds.size,
        duplicateIdCount: duplicateIds.size,
        uniqueTimestampCount: uniqueTimestamps.size,
        missingTimestampCount,
        headIds,
        tailIds
    };
};

const extractImmediateParentWithBody = (comment: Comment): Comment | null => {
    const parent = comment.parentComment as ParentCommentRef | null | undefined;
    if (!parent?._id) return null;

    const body = typeof parent.htmlBody === 'string' ? parent.htmlBody : '';
    if (body.trim().length === 0) return null;

    const postId = (parent as any).postId || comment.postId || '';
    if (!postId) return null;

    return {
        _id: parent._id,
        postedAt: parent.postedAt || comment.postedAt || new Date().toISOString(),
        htmlBody: body,
        baseScore: typeof parent.baseScore === 'number' ? parent.baseScore : 0,
        voteCount: typeof (parent as any).voteCount === 'number' ? (parent as any).voteCount : 0,
        pageUrl: parent.pageUrl || '',
        author: parent.user?.username || '',
        rejected: false,
        topLevelCommentId: comment.topLevelCommentId || parent._id,
        user: parent.user
            ? {
                ...parent.user,
                slug: (parent.user as any).slug || '',
                karma: typeof (parent.user as any).karma === 'number' ? (parent.user as any).karma : 0,
                htmlBio: (parent.user as any).htmlBio || ''
            }
            : null as any,
        postId,
        post: (comment as any).post ?? null,
        parentCommentId: parent.parentCommentId || '',
        parentComment: parent.parentComment ?? null,
        extendedScore: null,
        afExtendedScore: parent.afExtendedScore ?? null,
        currentUserVote: null,
        currentUserExtendedVote: null,
        contents: { markdown: parent.contents?.markdown ?? null },
        descendentCount: 0,
        directChildrenCount: 0,
        contextType: 'fetched'
    } as any as Comment;
};

/**
 * Shared adaptive fetcher for posts and comments
 */
async function fetchCollectionAdaptively<T extends { postedAt: string; _id: string }>(
    userId: string,
    query: string,
    key: 'posts' | 'comments',
    onProgress?: (count: number) => void,
    afterDate?: Date,
    onBatch?: (items: T[]) => Promise<void>,
    archiveUsername?: string
): Promise<T[]> {
    let allItems: T[] = [];
    const itemIndexById = new Map<string, number>();
    let hasMore = true;
    let currentLimit = INITIAL_PAGE_SIZE;
    let afterCursor: string | null = afterDate ? afterDate.toISOString() : null;
    let batchNumber = 0;
    let previousBatchTail: { id: string | null; postedAt: string | null } | null = null;

    while (hasMore) {
        const startTime = Date.now();
        batchNumber++;
        try {
            console.log(`[Archive ${key}] Fetching batch: limit=${currentLimit}, after=${afterCursor}`);
            const requestBatch = async (limit: number): Promise<Array<T | null | undefined>> => {
                const response = await queryGraphQL<any, any>(query, {
                    userId,
                    limit,
                    after: afterCursor
                }, ARCHIVE_PARTIAL_QUERY_OPTIONS);
                return (response[key]?.results || []) as Array<T | null | undefined>;
            };

            let fetchLimitUsed = currentLimit;
            let rawResults = await requestBatch(fetchLimitUsed);

            // If the batch ends on a duplicated timestamp boundary, expand the page size and retry
            // from the same cursor to reduce risk of skipping records with identical postedAt values.
            while (rawResults.length === fetchLimitUsed) {
                const boundaryTimestamp = getCursorTimestampFromBatch(rawResults);
                if (!boundaryTimestamp) break;

                let boundaryCount = 0;
                for (let i = rawResults.length - 1; i >= 0; i--) {
                    const row = rawResults[i] as any;
                    if (!row || row.postedAt !== boundaryTimestamp) break;
                    boundaryCount++;
                }

                if (boundaryCount <= 1) break;
                if (fetchLimitUsed >= MAX_PAGE_SIZE) {
                    Logger.warn(
                        `Archive ${key}: unresolved timestamp boundary (${boundaryCount} rows at ${boundaryTimestamp}) at max limit ${MAX_PAGE_SIZE}; pagination may still miss rows with identical postedAt.`
                    );
                    break;
                }

                const expandedLimit = Math.min(
                    MAX_PAGE_SIZE,
                    Math.max(fetchLimitUsed + boundaryCount, Math.round(fetchLimitUsed * 1.5))
                );
                Logger.debug(
                    `Archive ${key}: expanding batch limit ${fetchLimitUsed} -> ${expandedLimit} to reduce timestamp boundary truncation risk.`
                );
                fetchLimitUsed = expandedLimit;
                rawResults = await requestBatch(fetchLimitUsed);
            }

            const results = rawResults.filter(isValidArchiveItem);
            const duration = Date.now() - startTime;

            console.log(`[Archive ${key}] Received ${rawResults.length} items (${results.length} valid) in ${duration}ms`);

            if (results.length !== rawResults.length) {
                Logger.warn(`Archive ${key}: dropped ${rawResults.length - results.length} invalid items from partial GraphQL response.`);
            }

            if (rawResults.length === 0) {
                console.log(`[Archive ${key}] End of collection reached (empty batch).`);
                hasMore = false;
                break;
            }

            // [NEW] Incremental saving
            if (onBatch && results.length > 0) {
                if (key === 'comments') {
                    // Extract immediate parents that were fetched with body
                    const extractedParentsById = new Map<string, Comment>();
                    for (const item of results) {
                        const parent = extractImmediateParentWithBody(item as any as Comment);
                        if (parent) extractedParentsById.set(parent._id, parent);
                    }
                    const extractedParents = Array.from(extractedParentsById.values());
                    if (extractedParents.length > 0) {
                        try {
                            const cacheOwner = archiveUsername || userId;
                            await saveContextualItems(cacheOwner, extractedParents, extractPostsFromComments(extractedParents));
                        } catch (e) {
                            Logger.warn('Failed to persist extracted immediate parent comments.', e);
                        }
                    }
                }
                await onBatch(results);
            }

            // Adjust limit for next batch based on timing
            const ratio = TARGET_FETCH_TIME_MS / Math.max(duration, 100);
            const clampedRatio = Math.min(Math.max(ratio, 0.5), 1.5);
            const nextLimit = Math.round(fetchLimitUsed * clampedRatio);

            const prevLimit = fetchLimitUsed;
            currentLimit = Math.min(Math.max(nextLimit, MIN_PAGE_SIZE), MAX_PAGE_SIZE);

            if (currentLimit !== prevLimit) {
                Logger.debug(`Adaptive batching: ${key} batch took ${duration}ms. Adjusting limit ${prevLimit} -> ${currentLimit}`);
            }

            for (const item of results) {
                const existingIndex = itemIndexById.get(item._id);
                if (existingIndex === undefined) {
                    itemIndexById.set(item._id, allItems.length);
                    allItems.push(item);
                } else {
                    // Keep latest payload for duplicate IDs without rebuilding the full collection.
                    allItems[existingIndex] = item;
                }
            }

            if (onProgress) onProgress(allItems.length);

            if (hasMore) {
                // Update cursor to the latest timestamp in the batch that is
                // strictly newer than the current cursor.
                // We intentionally avoid stopping early on short non-empty batches.
                // Some partial-response paths may return fewer items than requested
                // before the true end of collection.
                const batchSummary = summarizeBatchForCursorDebug(rawResults);
                const nextCursorTail = getCursorTimestampFromBatch(rawResults);
                const nextCursorLatest = getLatestCursorTimestampFromBatch(rawResults, afterCursor);
                if (nextCursorLatest && nextCursorTail && nextCursorLatest !== nextCursorTail) {
                    Logger.debug(
                        `Archive ${key}: cursor candidates differ (tail=${nextCursorTail}, latest=${nextCursorLatest}); using latest cursor.`
                    );
                }
                const nextCursor = nextCursorLatest;
                if (!nextCursor) {
                    const stopReason = 'cursor_not_advancing';
                    const hint = !nextCursorTail
                        ? (batchSummary.missingTimestampCount === rawResults.length
                            ? 'all_raw_items_missing_postedAt'
                            : 'tail_item_missing_or_invalid_postedAt')
                        : (batchSummary.uniqueTimestampCount <= 1
                            ? 'batch_collapsed_to_single_timestamp'
                            : 'server_returned_non_advancing_page');
                    Logger.warn(`Archive ${key}: pagination guard stop (${stopReason}); stopping pagination.`, {
                        key,
                        batchNumber,
                        hint,
                        request: {
                            userId,
                            currentLimit,
                            fetchLimitUsed: fetchLimitUsed
                        },
                        cursor: {
                            afterCursor,
                            nextCursor,
                            nextCursorTail,
                            nextCursorLatest
                        },
                        counts: {
                            raw: rawResults.length,
                            valid: results.length,
                            invalid: rawResults.length - results.length,
                            accumulatedUniqueItems: allItems.length,
                            uniqueIdsInRawBatch: batchSummary.uniqueIdCount,
                            duplicateIdsInRawBatch: batchSummary.duplicateIdCount,
                            uniqueTimestampsInRawBatch: batchSummary.uniqueTimestampCount,
                            missingTimestampsInRawBatch: batchSummary.missingTimestampCount
                        },
                        batchEdges: {
                            first: { id: batchSummary.firstId, postedAt: batchSummary.firstTimestamp },
                            last: { id: batchSummary.lastId, postedAt: batchSummary.lastTimestamp },
                            headIds: batchSummary.headIds,
                            tailIds: batchSummary.tailIds
                        },
                        previousBatchTail
                    });
                    hasMore = false;
                } else {
                    afterCursor = nextCursor;
                }
                previousBatchTail = {
                    id: batchSummary.lastId,
                    postedAt: batchSummary.lastTimestamp
                };
            }
        } catch (e) {
            Logger.error(`Error fetching ${key} with cursor ${afterCursor}:`, e);
            throw e;
        }
    }

    return allItems;
}

/**
 * Fetch all posts for a user with adaptive pagination
 */
export const fetchUserPosts = (
    userId: string,
    onProgress?: (count: number) => void,
    afterDate?: Date,
    onBatch?: (posts: Post[]) => Promise<void>
): Promise<Post[]> => {
    return fetchCollectionAdaptively<Post>(userId, GET_USER_POSTS, 'posts', onProgress, afterDate, onBatch);
};

/**
 * Fetch all comments for a user with adaptive pagination
 */
export const fetchUserComments = (
    userId: string,
    onProgress?: (count: number) => void,
    afterDate?: Date,
    onBatch?: (comments: Comment[]) => Promise<void>,
    archiveUsername?: string
): Promise<Comment[]> => {
    return fetchCollectionAdaptively<Comment>(userId, GET_USER_COMMENTS, 'comments', onProgress, afterDate, onBatch, archiveUsername);
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
    const failedIds = new Set<string>();

    for (const chunk of chunks) {
        let response: { comments: { results: Comment[] } } | null = null;
        let lastError: unknown = null;

        for (let attempt = 1; attempt <= CONTEXT_FETCH_CHUNK_MAX_ATTEMPTS; attempt++) {
            try {
                response = await queryGraphQL<{ comments: { results: Comment[] } }, any>(
                    GET_COMMENTS_BY_IDS,
                    { commentIds: chunk },
                    ARCHIVE_PARTIAL_QUERY_OPTIONS
                );
                break;
            } catch (e) {
                lastError = e;
                if (attempt < CONTEXT_FETCH_CHUNK_MAX_ATTEMPTS) {
                    const retryDelayMs = attempt * 500;
                    Logger.warn(
                        `Context fetch chunk failed (attempt ${attempt}/${CONTEXT_FETCH_CHUNK_MAX_ATTEMPTS}); retrying in ${retryDelayMs}ms.`,
                        e
                    );
                    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                }
            }
        }

        if (!response) {
            chunk.forEach(id => failedIds.add(id));
            Logger.error('Failed to fetch context comments chunk after retries:', lastError);
            continue;
        }

        if (response.comments?.results) {
            const valid = response.comments.results.filter(isValidArchiveItem);
            if (valid.length !== response.comments.results.length) {
                Logger.warn(`Context fetch: dropped ${response.comments.results.length - valid.length} invalid comments from partial GraphQL response.`);
            }
            networkResults = [...networkResults, ...valid];
        }
    }

    if (failedIds.size > 0) {
        Logger.warn(`Context fetch: ${failedIds.size} IDs failed to load after retries and were skipped.`);
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
