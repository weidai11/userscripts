/**
 * Data loading logic for User Archive
 */

import { queryGraphQL, type GraphQLQueryOptions } from '../../../shared/graphql/client';
import { MAX_API_SKIP } from '../../../shared/graphql/pagination';
import {
    GET_USER_BY_SLUG,
    GET_USER_POSTS,
    GET_USER_POSTS_INCREMENTAL,
    GET_USER_COMMENTS,
    GET_USER_COMMENTS_FALLBACK,
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
};
type CursorField = 'postedAt' | 'lastEditedAt' | 'modifiedAt';

interface TimeFieldFallbackConfig {
    query: string;
    cursorField: CursorField;
}

const CURSOR_FALLBACK_ORDER: CursorField[] = ['postedAt', 'lastEditedAt', 'modifiedAt'];

const getCursorTimestampValue = (item: unknown, cursorField: CursorField): string | null => {
    const source = item as any;
    const orderedFields: CursorField[] = [cursorField];
    for (const fallback of CURSOR_FALLBACK_ORDER) {
        if (fallback !== cursorField) {
            orderedFields.push(fallback);
        }
    }
    for (const field of orderedFields) {
        const value = source?.[field];
        if (typeof value === 'string' && value.length > 0 && parseTimestampMs(value) !== null) {
            return value;
        }
    }
    return null;
};

const normalizeArchiveItem = <T extends { _id: string; postedAt: string }>(
    item: unknown,
    cursorField: CursorField
): T | null => {
    const source = item as any;
    if (!source || typeof source._id !== 'string' || source._id.length === 0) return null;
    const timestamp = getCursorTimestampValue(source, cursorField);
    if (!timestamp) return null;
    if (typeof source.postedAt === 'string' && source.postedAt.length > 0 && parseTimestampMs(source.postedAt) !== null) {
        return source as T;
    }
    return { ...source, postedAt: timestamp } as T;
};

const getCursorTimestampFromBatch = <T extends { postedAt: string }>(
    rawItems: Array<T | null | undefined>,
    cursorField: CursorField
): string | null => {
    // For forward sync (oldest to newest), the cursor is the timestamp of the LAST (newest) item in the batch
    for (let i = rawItems.length - 1; i >= 0; i--) {
        const item = rawItems[i];
        const timestamp = getCursorTimestampValue(item, cursorField);
        if (timestamp) return timestamp;
    }
    return null;
};

const parseTimestampMs = (timestamp: string): number | null => {
    const value = Date.parse(timestamp);
    return Number.isFinite(value) ? value : null;
};

const isUnsupportedTimeFieldError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (!/timefield/i.test(message)) return false;
    return /unknown argument|doesn['’]?t accept argument|cannot query field|not defined by type/i.test(message);
};

const isTransientErrorMessage = (message: string): boolean =>
    /(?:timed out|timeout|network|HTTP \d)/i.test(message);

const isOffsetCapError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error ?? '');
    // A transient failure (network/timeout) is never a cap rejection.
    if (isTransientErrorMessage(message)) return false;
    // The documented server rejection family ("Exceeded maximum value for
    // skip") plus near-miss bound wordings. A "skip"-worded bound is enough
    // on its own; an "offset"-worded bound additionally requires a numeric
    // cap so unrelated validation errors that merely mention "offset" or
    // "limit" are not misclassified as cap rejections.
    if (/skip/i.test(message)) {
        return /(?:limit|maximum|max|exceed(?:ed|ing|s)?|too (?:large|big)|out of range|reach(?:ed)?)/i.test(message);
    }
    return /offset/i.test(message) && /\d{3,}/.test(message)
        && /(?:limit|maximum|max|exceed(?:ed|ing|s)?|too (?:large|big)|out of range|reach(?:ed)?|past)/i.test(message);
};

// Validation/schema rejections of the incremental query. These are permanent
// for a given server (no retry will help) and must trigger the full-scan
// fallback even when they surface after the first request — a server that
// accepts page 1 can still reject the after+offset+timeField combination on a
// later page, and combo checks typically echo only the offending argument.
// Transient failures (network/timeout) that merely echo the query arguments
// are excluded so they never trigger the fallback.
const isValidationShapeError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (isTransientErrorMessage(message)) return false;
    return /(?:timefield|after|offset|skip)/i.test(message)
        && /(?:unknown argument|doesn['’]?t accept|cannot query field|not defined by type|invalid|cannot (?:be )?(?:used|combine)|not (?:allowed|supported)|combination)/i.test(message);
};

const compareTimestamps = (a: string, b: string): number => {
    const aMs = parseTimestampMs(a);
    const bMs = parseTimestampMs(b);
    if (aMs !== null && bMs !== null) return aMs - bMs;
    // Fallback for unexpected non-ISO-but-comparable strings.
    return a.localeCompare(b);
};

const getAdvancingCursorBoundsFromBatch = <T extends { postedAt: string }>(
    rawItems: Array<T | null | undefined>,
    baselineCursor: string | null,
    cursorField: CursorField
): { earliest: string | null; latest: string | null } => {
    let earliest: string | null = null;
    let latest: string | null = null;

    for (const item of rawItems) {
        const timestamp = getCursorTimestampValue(item, cursorField);
        if (!timestamp) continue;
        if (baselineCursor && compareTimestamps(timestamp, baselineCursor) <= 0) continue;
        if (!earliest || compareTimestamps(timestamp, earliest) < 0) {
            earliest = timestamp;
        }
        if (!latest || compareTimestamps(timestamp, latest) > 0) {
            latest = timestamp;
        }
    }

    return { earliest, latest };
};

const summarizeBatchForCursorDebug = <T extends { postedAt: string; _id: string }>(
    rawItems: Array<T | null | undefined>,
    cursorField: CursorField
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

        const timestamp = getCursorTimestampValue(anyItem, cursorField);

        if (!timestamp) {
            missingTimestampCount++;
            continue;
        }

        uniqueTimestamps.add(timestamp);
        if (!firstTimestamp) {
            firstTimestamp = timestamp;
            firstId = itemId;
        }
        lastTimestamp = timestamp;
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
 * Adaptive cursor-based fetcher for a user's comments.
 *
 * Posts use a separate offset-based fetcher (fetchUserPosts); this helper and
 * its fallback config exist only for comments.
 */
async function fetchCollectionAdaptively<T extends { postedAt: string; _id: string }>(
    userId: string,
    query: string,
    cursorField: CursorField,
    onProgress?: (count: number) => void,
    afterDate?: Date,
    onBatch?: (items: T[]) => Promise<void>,
    archiveUsername?: string,
    timeFieldFallback?: TimeFieldFallbackConfig
): Promise<T[]> {
    const allItems: T[] = [];
    const itemIndexById = new Map<string, number>();
    let hasMore = true;
    let currentLimit = INITIAL_PAGE_SIZE;
    let afterCursor: string | null = afterDate ? afterDate.toISOString() : null;
    let activeQuery = query;
    let activeCursorField = cursorField;
    let fallbackActivated = false;
    let batchNumber = 0;
    let nonAdvancingCursorRetries = 0;
    let previousBatchTail: { id: string | null; timestamp: string | null } | null = null;

    while (hasMore) {
        const startTime = Date.now();
        batchNumber++;
        try {
            Logger.debug(`[Archive comments] Fetching batch: limit=${currentLimit}, after=${afterCursor}, cursorField=${activeCursorField}`);
            const requestBatch = async (limit: number): Promise<Array<T | null | undefined>> => {
                const operationName = fallbackActivated ? 'GetUserCommentsFallback' : 'GetUserComments';
                const response = await queryGraphQL<any, any>(activeQuery, {
                    userId,
                    limit,
                    after: afterCursor
                }, { ...ARCHIVE_PARTIAL_QUERY_OPTIONS, operationName });
                return (response.comments?.results || []) as Array<T | null | undefined>;
            };

            let fetchLimitUsed = currentLimit;
            let rawResults: Array<T | null | undefined>;
            try {
                rawResults = await requestBatch(fetchLimitUsed);
            } catch (e) {
                if (!fallbackActivated && timeFieldFallback && isUnsupportedTimeFieldError(e)) {
                    fallbackActivated = true;
                    activeQuery = timeFieldFallback.query;
                    activeCursorField = timeFieldFallback.cursorField;
                    // Watermarks from edit-time fields are not directly comparable to postedAt cursors.
                    // Restart this collection scan in compatibility mode to avoid skipping items.
                    afterCursor = null;
                    Logger.warn(
                        `Archive comments: server rejected timeField; retrying with fallback query/cursor (${activeCursorField}).`
                    );
                    rawResults = await requestBatch(fetchLimitUsed);
                } else {
                    throw e;
                }
            }

            // If the batch ends on a duplicated timestamp boundary, expand the page size and retry
            // from the same cursor to reduce risk of skipping records with identical postedAt values.
            while (rawResults.length === fetchLimitUsed) {
                const boundaryTimestamp = getCursorTimestampFromBatch(rawResults, activeCursorField);
                if (!boundaryTimestamp) break;

                let boundaryCount = 0;
                for (let i = rawResults.length - 1; i >= 0; i--) {
                    const rowTimestamp = getCursorTimestampValue(rawResults[i], activeCursorField);
                    if (!rowTimestamp || rowTimestamp !== boundaryTimestamp) break;
                    boundaryCount++;
                }

                if (boundaryCount <= 1) break;
                if (fetchLimitUsed >= MAX_PAGE_SIZE) {
                    Logger.warn(
                        `Archive comments: unresolved timestamp boundary (${boundaryCount} rows at ${boundaryTimestamp}) at max limit ${MAX_PAGE_SIZE}; pagination may still miss rows with identical ${activeCursorField} values.`
                    );
                    break;
                }

                const expandedLimit = Math.min(
                    MAX_PAGE_SIZE,
                    Math.max(fetchLimitUsed + boundaryCount, Math.round(fetchLimitUsed * 1.5))
                );
                Logger.debug(
                    `Archive comments: expanding batch limit ${fetchLimitUsed} -> ${expandedLimit} to reduce ${activeCursorField} boundary truncation risk.`
                );
                fetchLimitUsed = expandedLimit;
                rawResults = await requestBatch(fetchLimitUsed);
            }

            const results = rawResults
                .map(item => normalizeArchiveItem<T>(item, activeCursorField))
                .filter((item): item is T => item !== null);
            const duration = Date.now() - startTime;

            Logger.debug(`[Archive comments] Received ${rawResults.length} items (${results.length} valid) in ${duration}ms`);

            if (results.length !== rawResults.length) {
                Logger.warn(`Archive comments: dropped ${rawResults.length - results.length} invalid items from partial GraphQL response.`);
            }

            if (rawResults.length === 0) {
                Logger.debug(`[Archive comments] End of collection reached (empty batch).`);
                hasMore = false;
                break;
            }

            // [NEW] Incremental saving
            if (onBatch && results.length > 0) {
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
                await onBatch(results);
            }

            // Adjust limit for next batch based on timing
            const ratio = TARGET_FETCH_TIME_MS / Math.max(duration, 100);
            const clampedRatio = Math.min(Math.max(ratio, 0.5), 1.5);
            const nextLimit = Math.round(fetchLimitUsed * clampedRatio);

            const prevLimit = fetchLimitUsed;
            currentLimit = Math.min(Math.max(nextLimit, MIN_PAGE_SIZE), MAX_PAGE_SIZE);

            if (currentLimit !== prevLimit) {
                Logger.debug(`Adaptive batching: comments batch took ${duration}ms. Adjusting limit ${prevLimit} -> ${currentLimit}`);
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
                // Update cursor conservatively to avoid skipping unseen records when
                // pages include out-of-order timestamps.
                // We intentionally avoid stopping early on short non-empty batches.
                // Some partial-response paths may return fewer items than requested
                // before the true end of collection.
                const batchSummary = summarizeBatchForCursorDebug(rawResults, activeCursorField);
                const nextCursorTail = batchSummary.lastTimestamp;
                const tailAdvances = Boolean(
                    nextCursorTail && (!afterCursor || compareTimestamps(nextCursorTail, afterCursor) > 0)
                );
                const cursorBounds = getAdvancingCursorBoundsFromBatch(
                    rawResults,
                    afterCursor,
                    activeCursorField
                );
                const nextCursorEarliest = cursorBounds.earliest;
                const nextCursorLatest = cursorBounds.latest;
                if (nextCursorLatest && nextCursorTail && nextCursorLatest !== nextCursorTail) {
                    Logger.debug(
                        `Archive comments: cursor candidates differ (tail=${nextCursorTail}, latest=${nextCursorLatest}); preferring boundary-safe cursor.`
                    );
                }
                let nextCursor: string | null = null;
                if (tailAdvances) {
                    nextCursor = nextCursorTail;
                } else if (nextCursorEarliest) {
                    nextCursor = nextCursorEarliest;
                    Logger.warn(
                        `Archive comments: tail cursor did not advance (tail=${nextCursorTail}, after=${afterCursor}); using earliest advancing cursor (${nextCursorEarliest}).`
                    );
                }
                if (!nextCursor) {
                    const tailDidNotAdvance = Boolean(
                        batchSummary.lastId &&
                        batchSummary.lastTimestamp &&
                        previousBatchTail?.id &&
                        previousBatchTail?.timestamp &&
                        batchSummary.lastId === previousBatchTail.id &&
                        batchSummary.lastTimestamp === previousBatchTail.timestamp
                    );

                    if (rawResults.length > 0 && nonAdvancingCursorRetries < 2 && !tailDidNotAdvance) {
                        nonAdvancingCursorRetries += 1;
                        const retriedLimit = Math.min(
                            MAX_PAGE_SIZE,
                            Math.max(currentLimit, Math.round(fetchLimitUsed * 1.5))
                        );
                        Logger.warn(
                            `Archive comments: non-advancing cursor detected (attempt ${nonAdvancingCursorRetries}/2); retrying same cursor with limit ${retriedLimit}.`
                        );
                        currentLimit = retriedLimit;
                        previousBatchTail = {
                            id: batchSummary.lastId,
                            timestamp: batchSummary.lastTimestamp
                        };
                        continue;
                    }
                    const stopReason = 'cursor_not_advancing';
                    const hint = !nextCursorTail
                        ? (tailDidNotAdvance
                            ? 'tail_unchanged_after_retry'
                            : (batchSummary.missingTimestampCount === rawResults.length
                                ? `all_raw_items_missing_${activeCursorField}`
                                : `tail_item_missing_or_invalid_${activeCursorField}`))
                        : (batchSummary.uniqueTimestampCount <= 1
                            ? 'batch_collapsed_to_single_timestamp'
                            : 'server_returned_non_advancing_page');
                    Logger.warn(`Archive comments: pagination guard stop (${stopReason}); stopping pagination.`, {
                        cursorField: activeCursorField,
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
                            first: { id: batchSummary.firstId, timestamp: batchSummary.firstTimestamp },
                            last: { id: batchSummary.lastId, timestamp: batchSummary.lastTimestamp },
                            headIds: batchSummary.headIds,
                            tailIds: batchSummary.tailIds
                        },
                        previousBatchTail
                    });
                    hasMore = false;
                } else {
                    afterCursor = nextCursor;
                    nonAdvancingCursorRetries = 0;
                }
                previousBatchTail = {
                    id: batchSummary.lastId,
                    timestamp: batchSummary.lastTimestamp
                };
            }
        } catch (e) {
            Logger.error(`Error fetching comments with cursor ${afterCursor}:`, e);
            throw e;
        }
    }

    return allItems;
}

/**
 * Fetch all posts for a user using offset-based pagination.
 *
 * The modern selector API `after` cursor is broken (overlapping pages,
 * missing records), but the `offset` argument in the same query works
 * correctly. For incremental sync (afterDate), we use `timeField:
 * "modifiedAt"` with `after` as a server-side filter to avoid fetching
 * the entire archive; the `after` timing issue only affects cursor
 * advancement, not filtering.
 *
 * If the incremental query fails (e.g., the server rejects `timeField` —
 * older deployments / EAF legacy API), we fall back to the full offset scan
 * and apply the cutoff filter client-side. In that mode the cutoff
 * (`modifiedAt`) is not monotonic in the scan order (`postedAt`
 * descending), so pagination continues until the scan is exhausted rather
 * than stopping on pages with no new items.
 *
 * Termination: an empty batch ends the scan; a page containing only items
 * already seen in earlier pages means the server clamped/cycled the
 * offset; the API offset limit (MAX_API_SKIP) bounds the scan (a
 * "skip limit reached" rejection also stops gracefully). When the scan is
 * truncated by the offset limit, `truncated` is set so the caller can
 * avoid advancing the posts watermark and surface the truncation.
 */
export type PostsTruncationReason = 'offset-limit' | 'clamp';

// Keep items with a valid _id and at least one valid date; when postedAt is
// missing or unparseable, synthesize it from modifiedAt so canonical
// sorting/rendering still works.
const sanitizeRawPosts = (results: Array<Post | null | undefined>): Post[] => {
    const raw: Post[] = [];
    for (const item of results) {
        const candidate = item as any;
        if (!candidate || typeof candidate._id !== 'string' || candidate._id.length === 0) continue;
        const postedAt = typeof candidate.postedAt === 'string' ? candidate.postedAt : null;
        const modifiedAt = typeof candidate.modifiedAt === 'string' ? candidate.modifiedAt : null;
        const postedAtValid = postedAt !== null && !isNaN(Date.parse(postedAt));
        const date = postedAtValid ? postedAt : modifiedAt;
        if (!date || isNaN(Date.parse(date))) continue;
        if (!postedAtValid) {
            raw.push({ ...candidate, postedAt: date });
        } else {
            raw.push(candidate);
        }
    }
    return raw;
};

// Client-side cutoff: when afterDate is set, enforce modifiedAt > cutoffMs.
// The server handles this via timeField (when honored), and the check drives
// the fallback path. It only guards against extra items returned by the
// server; it cannot recover items the server silently omitted.
const applyClientCutoff = (raw: Post[], afterDate?: Date): Post[] => {
    if (!afterDate) return raw;
    const cutoffMs = afterDate.getTime();
    return raw.filter((item: any) => {
        // Prefer a parseable modifiedAt; fall back to postedAt, mirroring the
        // raw-item date validation.
        const modifiedMs = typeof item.modifiedAt === 'string' ? Date.parse(item.modifiedAt) : NaN;
        const postedMs = typeof item.postedAt === 'string' ? Date.parse(item.postedAt) : NaN;
        const dateMs = Number.isFinite(modifiedMs) ? modifiedMs : postedMs;
        return Number.isFinite(dateMs) && dateMs > cutoffMs;
    });
};

export const fetchUserPosts = async (
    userId: string,
    onProgress?: (count: number) => void,
    afterDate?: Date,
    onBatch?: (posts: Post[]) => Promise<void>,
    abortSignal?: AbortSignal
): Promise<{ posts: Post[]; truncated: boolean; truncationReason?: PostsTruncationReason }> => {
    const BATCH_SIZE = 100;
    let totalRequests = 0;
    // Persistence-side failures are not query failures; the flag blocks the
    // query fallback (a full re-scan would just re-fail identically). A
    // boolean covers both object and non-object throws.
    let persistenceFailed = false;

    const runFetch = async (query: string, serverFilter: boolean): Promise<{ posts: Post[]; truncated: boolean; truncationReason?: PostsTruncationReason; emptyFirstPage?: boolean }> => {
        const allPosts: Post[] = [];
        const idIndexByPost = new Map<string, number>();
        const pageSeenIds = new Set<string>();
        let truncated = false;
        let truncationReason: PostsTruncationReason | undefined;
        let allSeenStreak = 0;
        let ghostPageStreak = 0;
        let lastRawLength = 0;
        let rawFetchedTotal = 0;
        let emptyFirstPage = false;
        let offset = 0;

        const variables: Record<string, unknown> = { userId, limit: BATCH_SIZE, offset };
        if (afterDate && serverFilter) {
            variables.after = afterDate.toISOString();
        }

        while (true) {
            totalRequests++;

            if (abortSignal?.aborted) {
                throw new Error('Sync aborted');
            }

            if (offset > MAX_API_SKIP) {
                // A short final batch means the scan ended at the offset limit;
                // only a full final batch leaves the tail unknowable.
                if (lastRawLength >= BATCH_SIZE) {
                    truncated = true;
                    truncationReason = 'offset-limit';
                    Logger.warn(
                        `[Archive posts] offset=${offset}: API offset limit (${MAX_API_SKIP}) reached; stopping with ${allPosts.length} posts fetched so far.`
                    );
                } else {
                    Logger.debug(`[Archive posts] offset=${offset}: reached API offset limit after a short batch; scan complete.`);
                }
                break;
            }

            let response: { posts: { results: Post[] } };
            try {
                response = await queryGraphQL<{ posts: { results: Post[] } }, any>(
                    query,
                    variables,
                    ARCHIVE_PARTIAL_QUERY_OPTIONS
                );
            } catch (error) {
                // Validation rejections take precedence over the cap pattern:
                // a message can plausibly mention both "offset/skip" and a cap
                // word while really rejecting the query schema (e.g. the
                // after+offset+timeField combo). Such rejections must surface
                // to the outer fallback logic, not end the scan as truncated.
                // A cap rejection on the FIRST request (offset 0) is surfaced
                // as a sync error instead: nothing has been fetched to keep,
                // and rejecting offset 0 indicates server misbehavior worth
                // showing to the user. The validation-precedence guard applies
                // only to the incremental query (serverFilter), whose combo
                // rejections are the false-positive risk; a cap error in the
                // full offset scan cannot be a combo rejection, so it always
                // ends the scan gracefully.
                if (offset > 0 && isOffsetCapError(error) && (!isValidationShapeError(error) || !serverFilter)) {
                    if (lastRawLength >= BATCH_SIZE) {
                        truncated = true;
                        truncationReason = 'offset-limit';
                        Logger.warn(
                            `[Archive posts] offset=${offset}: API offset limit reached; stopping with ${allPosts.length} posts fetched so far.`
                        );
                    } else {
                        Logger.debug(`[Archive posts] offset=${offset}: API rejected the offset after a short batch; scan complete.`);
                    }
                    break;
                }
                throw error;
            }

            const results = response.posts?.results || [];

            // A page with zero rows is the true end of the collection. A page
            // whose rows are all invalid (ghost/dropped rows) must NOT end the
            // scan — later pages may still hold real items.
            if (results.length === 0) {
                emptyFirstPage = offset === 0;
                break;
            }

            const raw = sanitizeRawPosts(results);

            // Offset-clamp guard: a buggy server may repeat or cycle pages
            // instead of returning empty results past the end. Two consecutive
            // pages with no items beyond those seen in earlier pages mean the
            // server is not advancing; a single such page can occur transiently
            // when items are edited mid-scan (offset pages shift), so it must
            // not stop the scan. Only a FULL repeated page is flagged as
            // truncation — a short repeated page means the collection ended.
            // Note: the full/short distinction uses the raw row count
            // (results.length), which includes ghost/dropped rows; a repeated
            // page of 100 raw rows with only a few valid items is therefore
            // treated as truncation — conservative (an extra re-scan), never
            // data loss. Pages whose rows are ALL invalid have no IDs to
            // compare, so they get their own streak: two consecutive
            // all-invalid pages likewise mean the server is not advancing and
            // stop the scan as a clamp (flagged as truncation so the watermark
            // is preserved and a transient ghost-storm self-heals next sync).
            if (raw.length > 0 && raw.every((item: any) => pageSeenIds.has(item._id))) {
                allSeenStreak++;
                ghostPageStreak = 0;
                if (allSeenStreak >= 2) {
                    if (results.length >= BATCH_SIZE) {
                        truncated = true;
                        truncationReason = 'clamp';
                        Logger.warn(`[Archive posts] offset=${offset}: server repeated full pages; stopping pagination.`);
                    } else {
                        Logger.debug(`[Archive posts] offset=${offset}: server repeated the final short page; scan complete.`);
                    }
                    break;
                }
            } else if (raw.length === 0) {
                ghostPageStreak++;
                allSeenStreak = 0;
                if (ghostPageStreak >= 2) {
                    truncated = true;
                    truncationReason = 'clamp';
                    Logger.warn(`[Archive posts] offset=${offset}: server served two consecutive pages of invalid rows; stopping pagination.`);
                    break;
                }
            } else {
                allSeenStreak = 0;
                ghostPageStreak = 0;
            }
            for (const item of raw) {
                pageSeenIds.add(item._id);
            }

            // Client-side cutoff (see applyClientCutoff); it cannot recover
            // items the server silently omitted — including an incremental
            // first page wrongly filtered to empty, which is probed below.
            const batch = applyClientCutoff(raw, afterDate);

            let newCount = 0;
            for (const item of batch) {
                const existingIndex = idIndexByPost.get(item._id);
                if (existingIndex === undefined) {
                    idIndexByPost.set(item._id, allPosts.length);
                    allPosts.push(item);
                    newCount++;
                } else {
                    // Offset pages can overlap when items change mid-sync;
                    // keep the latest payload for duplicate IDs.
                    allPosts[existingIndex] = item;
                }
            }

            Logger.debug(`[Archive posts] offset=${offset}: ${raw.length} fetched (${batch.length} after filter), ${newCount} new (total: ${allPosts.length})`);
            rawFetchedTotal += raw.length;
            // Report the raw fetched count on the fallback full scan (whose
            // below-watermark pages yield zero new items and would otherwise
            // read as a stalled counter); the incremental scan reports the
            // count of new items as before.
            onProgress?.(serverFilter ? allPosts.length : rawFetchedTotal);

            if (onBatch && batch.length > 0) {
                try {
                    await onBatch(batch);
                } catch (error) {
                    // Persistence-side failures are not query failures; the
                    // flag blocks the query fallback so the failure surfaces
                    // to the caller's own retry/error handling.
                    persistenceFailed = true;
                    throw error;
                }
            }

            lastRawLength = results.length;
            offset += BATCH_SIZE;
            variables.offset = offset;
        }

        return { posts: allPosts, truncated, truncationReason, emptyFirstPage };
    };

    try {
        // Use incremental query when afterDate is set to avoid fetching
        // the entire archive on every background sync.
        const incrementalResult = await runFetch(afterDate ? GET_USER_POSTS_INCREMENTAL : GET_USER_POSTS, Boolean(afterDate));

        // An empty FIRST page in incremental mode is the one failure the
        // client-side cutoff cannot defend: the server accepted the `after`
        // filter but may have applied it wrongly, silently hiding items
        // without an error. Probe once before concluding "up to date",
        // using the query that should have worked — the modifiedAt-ordered
        // incremental query WITHOUT the after filter — so its first page is
        // exactly the set the misapplied filter hid (a postedAt-ordered
        // probe would miss old-but-recently-edited posts). If the probe
        // query itself is rejected, the throw falls into the catch below
        // and triggers the full-scan fallback.
        if (afterDate && incrementalResult.emptyFirstPage) {
            if (abortSignal?.aborted) {
                throw new Error('Sync aborted');
            }
            const probeResponse = await queryGraphQL<{ posts: { results: Post[] } }, any>(
                GET_USER_POSTS_INCREMENTAL,
                { userId, limit: BATCH_SIZE, offset: 0 },
                ARCHIVE_PARTIAL_QUERY_OPTIONS
            );
            const probeHasNewerItems = applyClientCutoff(sanitizeRawPosts(probeResponse.posts?.results || []), afterDate).length > 0;
            if (probeHasNewerItems) {
                Logger.warn('Archive posts: incremental query returned an empty first page but newer items exist; retrying with the full offset scan and client-side cutoff.');
                return await runFetch(GET_USER_POSTS, false);
            }
        }

        return incrementalResult;
    } catch (error) {
        // The incremental query can fail for reasons beyond a timeField
        // rejection (older deployments, EAF legacy validation wording,
        // unsupported after+offset combos); the full scan is always a safe
        // retry since the client-side cutoff enforces the watermark.
        //
        // Fall back on: validation/schema rejections at ANY request index (a
        // server can accept page 1 and reject the combo on a later page), and
        // on any first-request failure (where validation errors surface). Do
        // NOT fall back on: abort, offset-cap errors, persistence failures, or
        // transient mid-scan failures (a later-page transient error does not
        // invalidate the query; retrying it is cheaper than a full re-scan).
        // No recursion guard is needed: the fallback run executes inside this
        // catch, so its own failures propagate to the caller directly and
        // never re-enter this condition.
        if (!afterDate || abortSignal?.aborted || persistenceFailed
            || (isOffsetCapError(error) && !isValidationShapeError(error))
            || (!isValidationShapeError(error) && totalRequests > 1)) {
            throw error;
        }
        Logger.warn('Archive posts: incremental query failed; retrying with full offset scan and client-side cutoff.', error);
        return await runFetch(GET_USER_POSTS, false);
    }
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
    return fetchCollectionAdaptively<Comment>(
        userId,
        GET_USER_COMMENTS,
        'lastEditedAt',
        onProgress,
        afterDate,
        onBatch,
        archiveUsername,
        { query: GET_USER_COMMENTS_FALLBACK, cursorField: 'postedAt' }
    );
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
                    { ...ARCHIVE_PARTIAL_QUERY_OPTIONS, operationName: 'GetCommentsByIds' }
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
            const valid = response.comments.results
                .map(item => normalizeArchiveItem<Comment>(item, 'lastEditedAt'))
                .filter((item): item is Comment => item !== null);
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
