import {
    markAsRead,
    getReadState,
    setReadState,
    getLoadFrom,
    setLoadFrom,
} from '../utils/storage';
import type { AllRecentCommentsResponse } from '../../../shared/graphql/queries';
import { GET_ALL_RECENT_COMMENTS } from '../../../shared/graphql/queries';
import { queryGraphQL } from '../../../shared/graphql/client';
import { Logger } from '../utils/logger';
import { isEAForumHost } from '../utils/forum';

/**
 * Service to track read status via scrolling
 */
export class ReadTracker {
    private static readonly UNREAD_ITEM_SELECTOR = '.pr-item:not(.read):not(.context), .pr-comment:not(.read):not(.context), .pr-post:not(.read):not(.context)';
    private static readonly BOTTOM_MARGIN_PX = 150;

    private scrollMarkDelay: number;
    private commentsDataGetter: () => { postedAt: string, _id: string }[];
    private postsDataGetter: () => { postedAt?: string, _id: string }[];
    private initialBatchNewestDateGetter: () => string | null;
    private pendingReadTimeouts: Record<string, number> = {};
    private scrollTimeout: number | null = null;
    private scrollListenerAdded: boolean = false;
    private isCheckingForMore: boolean = false;
    private lastCheckedIso: string | null = null;
    private recheckTimer: number | null = null;
    private countdownSeconds: number = 0;
    private hasAdvancedThisBatch: boolean = false;
    constructor(
        scrollMarkDelay: number,
        commentsDataGetter: () => { postedAt: string, _id: string }[],
        postsDataGetter: () => { postedAt?: string, _id: string }[] = () => [],
        initialBatchNewestDateGetter: () => string | null = () => null
    ) {
        this.scrollMarkDelay = scrollMarkDelay;
        this.commentsDataGetter = commentsDataGetter;
        this.postsDataGetter = postsDataGetter;
        this.initialBatchNewestDateGetter = initialBatchNewestDateGetter;
    }

    public init() {
        if (this.scrollListenerAdded) return;
        window.addEventListener('scroll', () => this.handleScroll(), { passive: true });
        this.scrollListenerAdded = true;
        this.hasAdvancedThisBatch = false;

        // [PR-READ-02] Initial processing pass: Handle cases where content is 
        // already visible or less than one screen (no scroll event will fire)
        setTimeout(() => this.processScroll(), 500);

        // Initial check for session advancement if all items were already read
        setTimeout(() => this.checkInitialState(), 1000);
    }

    private checkInitialState() {
        const unreadCountEl = document.getElementById('pr-unread-count');
        const unreadCount = parseInt(unreadCountEl?.textContent || '0', 10);

        if (unreadCount === 0) {
            const currentComments = this.commentsDataGetter();
            if (currentComments.length > 0) {
                this.advanceAndCheck(currentComments);
            }
        }
    }

    private handleScroll() {
        if (this.scrollTimeout) {
            return;
        }

        this.scrollTimeout = window.setTimeout(() => {
            this.scrollTimeout = null;
            this.processScroll();
        }, 200) as unknown as number;
    }

    private processScroll() {
        const items = document.querySelectorAll<HTMLElement>(ReadTracker.UNREAD_ITEM_SELECTOR);
        const readThreshold = 0;
        const docHeight = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight
        );
        const viewportHeight = window.innerHeight;
        const isAtBottom = viewportHeight + window.scrollY >= docHeight - ReadTracker.BOTTOM_MARGIN_PX;
        const unreadCountEl = document.getElementById('pr-unread-count');

        Logger.debug(`processScroll: items=${items.length}, isAtBottom=${isAtBottom}, scrollY=${window.scrollY}`);

        // Performance: skip items far BELOW the viewport.
        // Items ABOVE the viewport must be processed to ensure they are marked read.
        const viewportMargin = 2000;

        for (const el of items) {
            const rect = el.getBoundingClientRect();

            if (rect.top > viewportHeight + viewportMargin) {
                continue;
            }

            const id = el.getAttribute('data-id');
            if (!id) continue;

            // For posts and comments, we only care if the BODY is scrolled past, not the children/comments below it.
            let checkRect = rect;
            if (el.classList.contains('pr-post')) {
                const bodyContainer = el.querySelector('.pr-post-body-container');
                if (bodyContainer && !bodyContainer.classList.contains('collapsed')) {
                    checkRect = bodyContainer.getBoundingClientRect();
                } else {
                    const header = el.querySelector('.pr-post-header');
                    if (header) checkRect = header.getBoundingClientRect();
                }
            } else if (el.classList.contains('pr-comment')) {
                const body = el.querySelector('.pr-comment-body');
                if (body && !el.classList.contains('collapsed')) {
                    checkRect = body.getBoundingClientRect();
                } else {
                    const meta = el.querySelector('.pr-comment-meta');
                    if (meta) checkRect = meta.getBoundingClientRect();
                }
            }

            const isVisible = rect.top < viewportHeight && rect.bottom > 0;
            const shouldMark = checkRect.bottom < readThreshold || (isAtBottom && isVisible);

            if (shouldMark) {
                if (!this.pendingReadTimeouts[id]) {
                    const trackedElement = el;
                    this.pendingReadTimeouts[id] = window.setTimeout(() => {
                        delete this.pendingReadTimeouts[id];
                        const currentEl = trackedElement.isConnected
                            ? trackedElement
                            : document.querySelector<HTMLElement>(`.pr-item[data-id="${id}"]`);
                        if (!currentEl || currentEl.classList.contains('read')) {
                            return;
                        }

                        markAsRead({ [id]: 1 });
                        currentEl.classList.add('read');

                        const liveUnreadCountEl = unreadCountEl?.isConnected
                            ? unreadCountEl
                            : document.getElementById('pr-unread-count');
                        if (liveUnreadCountEl) {
                            const parsedCount = Number.parseInt(liveUnreadCountEl.textContent || '', 10);
                            const newCount = Number.isFinite(parsedCount)
                                ? Math.max(0, parsedCount - 1)
                                : document.querySelectorAll(ReadTracker.UNREAD_ITEM_SELECTOR).length;
                            liveUnreadCountEl.textContent = newCount.toString();
                        }

                        // Check if this was the last unread item and trigger advancement if at bottom
                        const remainingUnread = document.querySelectorAll(ReadTracker.UNREAD_ITEM_SELECTOR).length;
                        if (remainingUnread === 0) {
                            const currentDocHeight = Math.max(
                                document.body.scrollHeight,
                                document.documentElement.scrollHeight,
                                document.body.offsetHeight,
                                document.documentElement.offsetHeight
                            );
                            const currentIsAtBottom = window.innerHeight + window.scrollY >= currentDocHeight - ReadTracker.BOTTOM_MARGIN_PX;
                            const currentCommentsData = this.commentsDataGetter();
                            if (currentIsAtBottom && currentCommentsData.length > 0) {
                                this.advanceAndCheck(currentCommentsData);
                            }
                        }
                    }, this.scrollMarkDelay);
                }
            } else {
                if (this.pendingReadTimeouts[id]) {
                    window.clearTimeout(this.pendingReadTimeouts[id]);
                    delete this.pendingReadTimeouts[id];
                }
            }
        }

        // Auto-advance session if at bottom AND everything is read
        const currentComments = this.commentsDataGetter();
        if (isAtBottom && items.length === 0 && currentComments.length > 0) {
            Logger.debug('processScroll: at bottom and all read, advancing');
            this.advanceAndCheck(currentComments);
        }
    }

    private advanceAndCheck(currentComments: { postedAt: string, _id: string }[]) {
        if (this.hasAdvancedThisBatch) return;

        const initialNewest = this.initialBatchNewestDateGetter();
        let newestDateStr: string;
        if (initialNewest) {
            newestDateStr = initialNewest;
        } else {
            const newestComment = currentComments.reduce((prev, current) => {
                return (new Date(current.postedAt) > new Date(prev.postedAt)) ? current : prev;
            });
            newestDateStr = newestComment.postedAt;
        }

        const date = new Date(newestDateStr);
        date.setMilliseconds(date.getMilliseconds() + 1);
        const nextLoadFrom = date.toISOString();

        const currentLoadFrom = getLoadFrom();
        if (nextLoadFrom !== currentLoadFrom) {
            Logger.info(`Advancing session start to ${nextLoadFrom}`);
            setLoadFrom(nextLoadFrom);
            this.hasAdvancedThisBatch = true;

            // [PR-READ-06] Cleanup: remove read IDs older than the new loadFrom.
            // Items older than loadFrom will never appear again, so their read marks are stale.
            const readState = getReadState();
            const dateByItemId = new Map<string, string | undefined>();
            currentComments.forEach(c => dateByItemId.set(c._id, c.postedAt));
            this.postsDataGetter().forEach(p => dateByItemId.set(p._id, p.postedAt));

            const cleanupCutoffTime = new Date(nextLoadFrom).getTime();
            let removedCount = 0;

            for (const id of Object.keys(readState)) {
                if (dateByItemId.has(id)) continue; // Keep if in current batch regardless of date

                const postedAt = dateByItemId.get(id);
                // remove if:
                // 1. item is unknown in the current loaded set (orphaned), OR
                // 2. item timestamp is older than the NEW loadFrom cutoff
                const itemTime = postedAt ? new Date(postedAt).getTime() : NaN;
                if (!postedAt || !Number.isFinite(itemTime) || itemTime < cleanupCutoffTime) {
                    delete readState[id];
                    removedCount++;
                }
            }

            if (removedCount > 0) {
                setReadState(readState);
                Logger.info(`Cleaned up read state: removed ${removedCount} items older than ${nextLoadFrom}`);
            }
        }

        this.checkServerForMore(nextLoadFrom);
    }

    private startRecheckTimer(afterIso: string) {
        if (this.recheckTimer) clearInterval(this.recheckTimer);

        this.countdownSeconds = 60;
        this.updateCountdownMessage(afterIso);

        this.recheckTimer = window.setInterval(() => {
            this.countdownSeconds--;
            if (this.countdownSeconds <= 0) {
                clearInterval(this.recheckTimer!);
                this.recheckTimer = null;
                this.checkServerForMore(afterIso, true);
            } else {
                this.updateCountdownMessage(afterIso);
            }
        }, 1000) as unknown as number;
    }

    private updateCountdownMessage(afterIso: string) {
        const msgEl = document.getElementById('pr-bottom-message');
        if (!msgEl) return;
        msgEl.style.display = 'block';
        msgEl.textContent = `All comments have been marked read. No more comments on server. Waiting ${this.countdownSeconds}s for next check, or click here to check again.`;
        msgEl.onclick = () => {
            if (this.recheckTimer) clearInterval(this.recheckTimer);
            this.recheckTimer = null;
            this.checkServerForMore(afterIso, true);
        };
    }

    private async checkServerForMore(afterIso: string, force: boolean = false) {
        if (this.isCheckingForMore && !force) return;
        if (this.lastCheckedIso === afterIso && !force) return;

        if (this.recheckTimer && !force) return;

        this.isCheckingForMore = true;
        this.lastCheckedIso = afterIso;

        const msgEl = document.getElementById('pr-bottom-message');
        if (!msgEl) return;

        msgEl.style.display = 'block';
        msgEl.textContent = 'Checking for more comments...';
        msgEl.className = 'pr-bottom-message';
        msgEl.onclick = null;

        try {
            const isEAHost = isEAForumHost();
            let hasMore = false;
            if (isEAHost) {
                // EAF legacy `comments(input.terms)` ignores `after`, so compare newest postedAt client-side.
                const res = await queryGraphQL(GET_ALL_RECENT_COMMENTS, {
                    limit: 1,
                    sortBy: 'newest'
                }) as AllRecentCommentsResponse;
                const newestPostedAt = res?.comments?.results?.[0]?.postedAt;
                const newestMs = newestPostedAt ? new Date(newestPostedAt).getTime() : NaN;
                const afterMs = new Date(afterIso).getTime();
                hasMore = Number.isFinite(newestMs) && Number.isFinite(afterMs) && newestMs > afterMs;
            } else {
                const res = await queryGraphQL(GET_ALL_RECENT_COMMENTS, {
                    after: afterIso,
                    limit: 1,
                    sortBy: 'oldest'
                }) as AllRecentCommentsResponse;
                hasMore = (res?.comments?.results?.length || 0) > 0;
            }

            if (hasMore) {
                msgEl.textContent = 'New comments available! Click here to reload.';
                msgEl.classList.add('has-more');
                msgEl.onclick = () => window.location.reload();
                if (this.recheckTimer) clearInterval(this.recheckTimer);
                this.recheckTimer = null;
            } else {
                this.startRecheckTimer(afterIso);
            }
        } catch (e) {
            Logger.error('Failed to check for more comments:', e);
            msgEl.textContent = 'Failed to check server. Click to retry.';
            msgEl.onclick = () => this.checkServerForMore(afterIso, true);
        } finally {
            this.isCheckingForMore = false;
        }
    }
}
