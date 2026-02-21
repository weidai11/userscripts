
/**
 * Server actions for Power Reader
 * Handles data fetching, state updates, and re-rendering
 */

import { queryGraphQL } from '../../../shared/graphql/client';
import {
    GET_POST_BY_ID,
    GET_COMMENT,
    GET_THREAD_COMMENTS,
    GET_COMMENTS_BY_IDS,
} from '../../../shared/graphql/queries';
import type {
    Comment,
    Post,
} from '../../../shared/graphql/queries';
import type {
    GetPostQuery,
    GetPostQueryVariables,
    GetCommentQuery,
    GetCommentQueryVariables,
    GetThreadCommentsQuery,
    GetThreadCommentsQueryVariables,
    GetCommentsByIdsQuery,
    GetCommentsByIdsQueryVariables,
} from '../../../generated/graphql';
import type { ReaderState } from '../state';
import { smartScrollTo, withForcedLayout } from '../utils/dom';
import { CONFIG } from '../config';
import { Logger } from '../utils/logger';
import { toggleAuthorPreference } from '../utils/storage';
import { getCommentVisibilityTarget, getStickyViewportTop } from '../utils/commentVisibility';
import { logFindParentTrace } from '../utils/findParentTrace';
import {
    HIGHLIGHT_DURATION_MS,
    JUST_REVEALED_DURATION_MS,
    VIEWPORT_CORRECTION_EPSILON_PX
} from '../utils/navigationConstants';
import { withOverflowAnchorDisabled } from '../utils/viewTransition';
import { markCommentRevealed, setJustRevealed } from '../types/uiCommentFlags';
import { fetchAllPostCommentsWithCache } from '../services/postDescendantsCache';
import {
    promptLargeDescendantConfirmation,
    shouldPromptForLargeDescendants
} from '../utils/descendantConfirm';

import {
    getPostIdFromTarget,
    getCommentIdFromTarget,
    handleScrollToRoot,
} from './domActions';

import {
    findTopLevelAncestorId,
    markAncestorChainForceVisible,
} from './stateOps';

import { getUIHost } from '../render/uiHost';
import { renderComment } from '../render/comment';
import { setupLinkPreviews } from '../features/linkPreviews';

const findHighestKnownAncestorId = (commentId: string, state: ReaderState): string | null => {
    let current = state.commentById.get(commentId);
    if (!current) return null;

    let highestKnownId = current._id;
    const visited = new Set<string>();

    while (current.parentCommentId) {
        if (visited.has(current._id)) break;
        visited.add(current._id);

        const parent = state.commentById.get(current.parentCommentId);
        if (!parent) break;
        highestKnownId = parent._id;
        current = parent;
    }

    return highestKnownId;
};

const waitForNextPaint = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => resolve()));

const round2 = (n: number): number => Math.round(n * 100) / 100;

const isCommentFullyVisibleForNavigation = (commentEl: HTMLElement, viewportTarget: HTMLElement): boolean => {
    if (commentEl.classList.contains('pr-missing-parent') || commentEl.dataset.placeholder === '1' || commentEl.classList.contains('pr-comment-placeholder')) {
        return false;
    }

    const rect = viewportTarget.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const stickyViewportTop = getStickyViewportTop();
    const inViewport = (
        rect.top >= stickyViewportTop &&
        rect.left >= 0 &&
        rect.bottom <= vh &&
        rect.right <= vw
    );
    if (!inViewport) return false;

    return true;
};

const scrollToCommentIfNeeded = (commentEl: HTMLElement, contextLabel: string): void => {
    const commentId = commentEl.getAttribute('data-id') || '(unknown)';
    const viewportTarget = getCommentVisibilityTarget(commentEl);
    const rect = viewportTarget.getBoundingClientRect();
    const stickyViewportTop = getStickyViewportTop();
    logFindParentTrace('scroll:check', {
        context: contextLabel,
        commentId,
        scrollY: round2(window.scrollY),
        rectTop: round2(rect.top),
        rectBottom: round2(rect.bottom),
        rectHeight: round2(rect.height),
        viewportTargetTag: viewportTarget.tagName.toLowerCase(),
        viewportTargetClass: viewportTarget.className || '',
        stickyViewportTop: round2(stickyViewportTop),
        innerHeight: window.innerHeight,
    });

    const fullyVisible = isCommentFullyVisibleForNavigation(commentEl, viewportTarget);
    if (fullyVisible) {
        Logger.info(`${contextLabel}: Comment ${commentId} already visible enough, skipping scroll.`);
        logFindParentTrace('scroll:skip-visible', {
            context: contextLabel,
            commentId,
            scrollY: round2(window.scrollY),
            skipReason: 'fully-visible',
        });
        return;
    }

    const beforeY = window.scrollY;
    smartScrollTo(commentEl, false);
    logFindParentTrace('scroll:dispatched', {
        context: contextLabel,
        commentId,
        scrollYBefore: round2(beforeY),
        scrollYAfterDispatch: round2(window.scrollY),
    });
    requestAnimationFrame(() => {
        const afterRect = commentEl.getBoundingClientRect();
        logFindParentTrace('scroll:post-frame', {
            context: contextLabel,
            commentId,
            scrollY: round2(window.scrollY),
            rectTop: round2(afterRect.top),
            rectBottom: round2(afterRect.bottom),
        });
    });
};

const ancestorChainNeedsRerender = (commentId: string, state: ReaderState): boolean => {
    let currentId: string | null = commentId;
    const visited = new Set<string>();

    while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);

        const commentEl = document.querySelector(`.pr-comment[data-id="${currentId}"]`) as HTMLElement;
        if (!commentEl) return true;
        if (commentEl.classList.contains('pr-comment-placeholder') || commentEl.classList.contains('pr-missing-parent') || commentEl.dataset.placeholder === '1') {
            return true;
        }

        const comment = state.commentById.get(currentId);
        if (!comment) return true;
        currentId = comment.parentCommentId || null;
    }

    return false;
};

const highlightCleanupTimers = new Map<string, number>();
const highlightCleanupElementTimers = new WeakMap<HTMLElement, number>();

const clearHighlightBySelector = (selector: string): void => {
    document.querySelectorAll(selector).forEach((el) => {
        (el as HTMLElement).classList.remove('pr-highlight-parent');
    });
};

const highlightBySelectorTemporarily = (selector: string, durationMs: number = HIGHLIGHT_DURATION_MS): void => {
    const existingTimer = highlightCleanupTimers.get(selector);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }

    const targets = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
    if (targets.length === 0) return;

    targets.forEach((el) => {
        el.classList.remove('pr-highlight-parent');
        // Force reflow so repeated navigation reliably restarts the animation.
        void el.offsetWidth;
        el.classList.add('pr-highlight-parent');
    });

    const timer = window.setTimeout(() => {
        clearHighlightBySelector(selector);
        if (highlightCleanupTimers.get(selector) === timer) {
            highlightCleanupTimers.delete(selector);
        }
    }, durationMs);

    highlightCleanupTimers.set(selector, timer);
};

const highlightParentTemporarily = (parentEl: HTMLElement): void => {
    const commentId = parentEl.getAttribute('data-id');
    if (commentId && parentEl.classList.contains('pr-comment')) {
        highlightBySelectorTemporarily(`.pr-comment[data-id="${commentId}"]`);
        return;
    }

    const existingTimer = highlightCleanupElementTimers.get(parentEl);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }
    parentEl.classList.remove('pr-highlight-parent');
    void parentEl.offsetWidth;
    parentEl.classList.add('pr-highlight-parent');
    const timer = window.setTimeout(() => {
        parentEl.classList.remove('pr-highlight-parent');
        if (highlightCleanupElementTimers.get(parentEl) === timer) {
            highlightCleanupElementTimers.delete(parentEl);
        }
    }, HIGHLIGHT_DURATION_MS);
    highlightCleanupElementTimers.set(parentEl, timer);
};

const getIdleCommentActionLabel = (action: string | null): string | null => {
    switch (action) {
        case 'find-parent':
            return '[^]';
        case 'load-descendants':
            return '[r]';
        case 'load-parents-and-scroll':
            return '[t]';
        default:
            return null;
    }
};

const rerenderCommentElementInPlace = (commentId: string, state: ReaderState): boolean => {
    const commentEl = document.querySelector(`.pr-comment[data-id="${commentId}"]`) as HTMLElement | null;
    const comment = state.commentById.get(commentId);
    if (!commentEl || !comment) return false;

    // Preserve already-rendered child subtree to avoid tearing down focal descendants.
    const repliesEl = Array.from(commentEl.children).find(
        (child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains('pr-replies')
    );
    const repliesHtml = (() => {
        if (!repliesEl) return '';
        const repliesClone = repliesEl.cloneNode(true) as HTMLElement;
        // Runtime-only marker; cloned markup would otherwise skip reattaching listeners.
        if (repliesClone.hasAttribute('data-preview-attached')) {
            repliesClone.removeAttribute('data-preview-attached');
        }
        repliesClone.querySelectorAll('[data-preview-attached]').forEach((el) => {
            el.removeAttribute('data-preview-attached');
        });

        // Normalize transient loading labels in preserved descendants.
        repliesClone.querySelectorAll('[data-action]').forEach((el) => {
            const action = el.getAttribute('data-action');
            const idleLabel = getIdleCommentActionLabel(action);
            if (idleLabel && (el as HTMLElement).textContent?.trim() === '[...]') {
                (el as HTMLElement).textContent = idleLabel;
            }
        });
        return repliesClone.outerHTML;
    })();

    commentEl.outerHTML = renderComment(comment, state, repliesHtml);
    return true;
};

const setupLinkPreviewsForCommentPost = (commentId: string, state: ReaderState): void => {
    const postId = state.commentById.get(commentId)?.postId;
    const postContainer = postId
        ? document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement | null
        : null;
    setupLinkPreviews(state.comments, postContainer || document);
};

const upgradeAncestorChainInPlace = (startId: string, state: ReaderState): number => {
    let upgraded = 0;
    let currentId: string | null = startId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        if (rerenderCommentElementInPlace(currentId, state)) upgraded += 1;
        const current = state.commentById.get(currentId);
        currentId = current?.parentCommentId || null;
    }

    if (upgraded > 0) {
        setupLinkPreviewsForCommentPost(startId, state);
    }
    return upgraded;
};

const upgradeSingleCommentInPlace = (commentId: string, state: ReaderState): number => {
    const upgraded = rerenderCommentElementInPlace(commentId, state) ? 1 : 0;
    if (upgraded > 0) {
        setupLinkPreviewsForCommentPost(commentId, state);
    }
    return upgraded;
};

const preserveFocalViewportAcrossDomMutation = async <T>(
    focalCommentId: string | null,
    mutation: () => T,
    tracePrefix: string
): Promise<T> => {
    if (!focalCommentId) return mutation();

    const beforeEl = document.querySelector(`.pr-comment[data-id="${focalCommentId}"]`) as HTMLElement | null;
    const beforeTop = beforeEl ? beforeEl.getBoundingClientRect().top : null;
    const beforeScrollY = window.scrollY;
    logFindParentTrace(`${tracePrefix}:anchor-start`, {
        focalCommentId,
        beforeTop: beforeTop === null ? null : round2(beforeTop),
        beforeScrollY: round2(beforeScrollY),
    });

    const restoreOverflowAnchor = withOverflowAnchorDisabled();
    let result: T;

    const applyCorrection = (pass: 'pass1' | 'pass2'): void => {
        if (beforeTop === null) return;
        const focalEl = document.querySelector(`.pr-comment[data-id="${focalCommentId}"]`) as HTMLElement | null;
        if (!focalEl) {
            logFindParentTrace(`${tracePrefix}:anchor-${pass}-missing`, { focalCommentId });
            return;
        }

        const currentTop = focalEl.getBoundingClientRect().top;
        const delta = currentTop - beforeTop;
        logFindParentTrace(`${tracePrefix}:anchor-${pass}-check`, {
            focalCommentId,
            currentTop: round2(currentTop),
            targetTop: round2(beforeTop),
            delta: round2(delta),
            scrollY: round2(window.scrollY),
        });

        if (Math.abs(delta) < VIEWPORT_CORRECTION_EPSILON_PX) return;

        const fromY = window.scrollY;
        const targetY = Math.max(0, fromY + delta);
        window.scrollTo(0, targetY);
        logFindParentTrace(`${tracePrefix}:anchor-${pass}-applied`, {
            focalCommentId,
            fromY: round2(fromY),
            targetY: round2(targetY),
            delta: round2(delta),
        });
    };

    try {
        result = mutation();
        applyCorrection('pass1');
        await waitForNextPaint();
        applyCorrection('pass2');
        await waitForNextPaint();
    } finally {
        restoreOverflowAnchor();
    }

    const endEl = document.querySelector(`.pr-comment[data-id="${focalCommentId}"]`) as HTMLElement | null;
    const endScrollY = window.scrollY;
    logFindParentTrace(`${tracePrefix}:anchor-end`, {
        focalCommentId,
        endTop: endEl ? round2(endEl.getBoundingClientRect().top) : null,
        endScrollY: round2(endScrollY),
        scrollDelta: round2(endScrollY - beforeScrollY),
    });

    return result!;
};

const collectMissingAncestorDomIds = (startId: string, state: ReaderState): string[] => {
    const missing: string[] = [];
    let currentId: string | null = startId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const inState = state.commentById.get(currentId);
        if (inState) {
            const inDom = !!document.querySelector(`.pr-comment[data-id="${currentId}"]`);
            if (!inDom) missing.push(currentId);
        }
        currentId = inState?.parentCommentId || null;
    }

    return missing;
};

type LoadParentsResult = {
    commentId: string;
    fetchedCount: number;
    added: number;
    inPlaceUpgraded: number;
    usedFallbackRerender: boolean;
    missingDomAncestorIds: string[];
};

type LoadParentsOptions = {
    preferInPlace?: boolean;
    anchorCommentId?: string;
    traceContext?: string;
};

/**
 * Handle expanding a read placeholder comment
 */
export const handleExpandPlaceholder = (target: HTMLElement, state: ReaderState): void => {
    const commentEl = target.closest('.pr-comment') as HTMLElement;
    if (!commentEl) return;

    const commentId = commentEl.getAttribute('data-id');
    const postId = commentEl.getAttribute('data-post-id');
    if (!commentId || !postId) return;

    const comment = state.commentById.get(commentId);
    if (!comment) return;

    markCommentRevealed(comment);

    getUIHost().rerenderPostGroup(postId, commentId);

    // Clear justRevealed after animation
    setTimeout(() => {
        if (comment) setJustRevealed(comment, false);
    }, JUST_REVEALED_DURATION_MS);
};

/**
 * Handle find parent navigation
 */
export const handleFindParent = async (target: HTMLElement, state: ReaderState): Promise<void> => {
    const commentEl = target.closest('.pr-comment');
    const focalCommentId = commentEl?.getAttribute('data-id') || null;
    const parentId = commentEl?.getAttribute('data-parent-id');
    const postId = commentEl?.getAttribute('data-post-id');
    logFindParentTrace('start', {
        focalCommentId,
        parentId,
        postId,
        scrollY: round2(window.scrollY),
        href: location.href,
    });

    // Case 1: Top-level comment -> Navigate to Post
    if (!parentId) {
        if (!postId) return;
        logFindParentTrace('branch:top-level-post', { focalCommentId, postId, scrollY: round2(window.scrollY) });
        const postEl = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement;
        if (postEl) {
            const postHeader = postEl.querySelector('.pr-post-header') as HTMLElement;
            if (postHeader) smartScrollTo(postHeader, true);

            highlightBySelectorTemporarily(
                `.pr-post[data-id="${postId}"] .pr-post-header, ` +
                `.pr-post[data-id="${postId}"] .pr-post-body-container, ` +
                `.pr-sticky-header .pr-post-header[data-post-id="${postId}"]`
            );
        }
        return;
    }

    // Case 2: Parent in DOM (normal)
    const parentEl = document.querySelector(`.pr-comment[data-id="${parentId}"]`) as HTMLElement;
    const isReadPlaceholder = parentEl?.classList.contains('pr-comment-placeholder');
    const parentIsPlaceholder = !!parentEl?.dataset.placeholder || parentEl?.classList.contains('pr-missing-parent') || isReadPlaceholder;
    logFindParentTrace('parent:lookup', {
        focalCommentId,
        parentId,
        hasParentEl: !!parentEl,
        isReadPlaceholder,
        parentIsPlaceholder,
        scrollY: round2(window.scrollY),
    });

    if (parentEl && !parentIsPlaceholder) {
        logFindParentTrace('branch:parent-visible', { parentId, scrollY: round2(window.scrollY) });
        scrollToCommentIfNeeded(parentEl, 'Find Parent');
        highlightParentTemporarily(parentEl);
        return;
    }

    // Case 3: Parent in DOM but minimized (read placeholder)
    if (parentEl && isReadPlaceholder) {
        if (postId) {
            logFindParentTrace('branch:parent-read-placeholder', { focalCommentId, parentId, postId, scrollY: round2(window.scrollY) });
            const directParent = state.commentById.get(parentId);
            if (directParent) {
                markCommentRevealed(directParent);
            }
            const anchorCommentId = focalCommentId || parentId;
            const upgraded = await preserveFocalViewportAcrossDomMutation(
                anchorCommentId,
                () => upgradeSingleCommentInPlace(parentId, state),
                'find-parent:read-placeholder'
            );
            logFindParentTrace('inplace:read-placeholder-upgrade', {
                focalCommentId,
                parentId,
                anchorCommentId,
                postId,
                upgraded,
                usedFallbackRerender: upgraded === 0,
                revealMode: 'direct-parent-only',
            });
            if (upgraded === 0) {
                // Fallback if the expected placeholder subtree was not found.
                getUIHost().rerenderPostGroup(postId, anchorCommentId || parentId);
            }
            setupLinkPreviews(state.comments);

            let newParentEl = document.querySelector(`.pr-comment[data-id="${parentId}"]`) as HTMLElement;
            if (!newParentEl) {
                await waitForNextPaint();
                newParentEl = document.querySelector(`.pr-comment[data-id="${parentId}"]`) as HTMLElement;
            }
            if (newParentEl) {
                logFindParentTrace('parent:after-rerender', {
                    focalCommentId,
                    parentId,
                    scrollY: round2(window.scrollY),
                });
                scrollToCommentIfNeeded(newParentEl, 'Find Parent');
                highlightParentTemporarily(newParentEl);
            }
        }
        return;
    }

    // Case 4: Parent not in DOM, must fetch
    const originalText = target.textContent;
    target.textContent = '[...]';

    try {
        Logger.info(`Find Parent: Fetching missing parent ${parentId} from server...`);
        logFindParentTrace('branch:fetch-missing-parent', { focalCommentId, parentId, scrollY: round2(window.scrollY) });
        const res = await queryGraphQL<GetCommentQuery, GetCommentQueryVariables>(GET_COMMENT, { id: parentId });
        const parentComment = res?.comment?.result as unknown as Comment;

        if (parentComment) {
            // Add to state if not present
            if (!state.commentById.has(parentComment._id)) {
                markCommentRevealed(parentComment); // Ensure it renders full

                getUIHost().mergeComments([parentComment], true);

                // Find the post group container to re-render it
                if (parentComment.postId) {
                    const upgraded = await preserveFocalViewportAcrossDomMutation(
                        focalCommentId,
                        () => upgradeSingleCommentInPlace(parentId, state),
                        'find-parent:deep-load'
                    );
                    logFindParentTrace('inplace:deep-load-upgrade', {
                        focalCommentId,
                        parentId,
                        parentPostId: parentComment.postId,
                        upgraded,
                        usedFallbackRerender: upgraded === 0,
                        revealMode: 'direct-parent-only',
                        scrollY: round2(window.scrollY),
                    });
                    if (upgraded === 0) {
                        // Fallback when there is no placeholder slot to upgrade in-place.
                        getUIHost().rerenderPostGroup(parentComment.postId, focalCommentId || parentId);
                    }
                    setupLinkPreviews(state.comments);

                    let newParentEl = document.querySelector(`.pr-comment[data-id="${parentId}"]`) as HTMLElement;
                    if (!newParentEl) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                        newParentEl = document.querySelector(`.pr-comment[data-id="${parentId}"]`) as HTMLElement;
                    }

                    if (newParentEl) {
                        logFindParentTrace('parent:after-deep-load-rerender', {
                            focalCommentId,
                            parentId,
                            scrollY: round2(window.scrollY),
                        });
                        scrollToCommentIfNeeded(newParentEl, 'Find Parent');
                        highlightParentTemporarily(newParentEl);
                    }
                }
            }
        } else {
            alert('Parent comment could not be found on the server.');
        }
    } catch (err) {
        Logger.error('Failed to fetch parent comment', err);
        alert('Error fetching parent comment.');
    } finally {
        target.textContent = originalText;
        if (focalCommentId) {
            const liveFindParentBtn = document.querySelector(
                `.pr-comment[data-id="${focalCommentId}"] .pr-find-parent`
            ) as HTMLElement | null;
            if (liveFindParentBtn) liveFindParentBtn.textContent = originalText;
        }
    }
};

/**
 * Handle author preference up/down
 */
export const handleAuthorUp = (target: HTMLElement, _state: ReaderState): void => {
    const item = target.closest('.pr-item');
    let author = item?.getAttribute('data-author');

    if (!author) {
        const sticky = target.closest('.pr-sticky-header');
        author = sticky?.getAttribute('data-author');
    }

    if (author) {
        toggleAuthorPreference(author, 'up');
        getUIHost().rerenderAll();
    }
};

export const handleAuthorDown = (target: HTMLElement, _state: ReaderState): void => {
    const item = target.closest('.pr-item');
    let author = item?.getAttribute('data-author');

    if (!author) {
        const sticky = target.closest('.pr-sticky-header');
        author = sticky?.getAttribute('data-author');
    }

    if (author) {
        toggleAuthorPreference(author, 'down');
        getUIHost().rerenderAll();
    }
};

/**
 * Shared helper to fetch, upsert, and re-render a post
 */
const fetchAndRenderPost = async (
    postId: string,
    _state: ReaderState
): Promise<Post | null> => {
    const res = await queryGraphQL<GetPostQuery, GetPostQueryVariables>(
        GET_POST_BY_ID, { id: postId }
    );
    const post = res?.post?.result as unknown as Post;
    if (!post) return null;

    getUIHost().upsertPost(post);
    getUIHost().rerenderPostGroup(postId);
    return post;
};


/**
 * Handle loading a post's content inline
 */
export const handleLoadPost = async (
    postId: string,
    titleLink: HTMLElement,
    state: ReaderState
): Promise<void> => {
    const postContainer = titleLink.closest('.pr-post') as HTMLElement;
    if (!postContainer) return;

    let contentEl = postContainer.querySelector('.pr-post-content') as HTMLElement;
    if (!contentEl) {
        // For header-only posts, create a placeholder for the loading message
        contentEl = document.createElement('div');
        contentEl.className = 'pr-post-content';
        const header = postContainer.querySelector('.pr-post-header');
        if (header) {
            header.after(contentEl);
        } else {
            postContainer.prepend(contentEl);
        }
    }

    // Show loading state
    contentEl.innerHTML = '<div class="pr-info">Loading post content...</div>';

    try {
        const post = await fetchAndRenderPost(postId, state);
        if (post) {
            // Rerender usually drops load-post automatically for full posts;
            // keep a defensive cleanup in case a custom render path leaves it behind.
            const updatedTitleLink = document.querySelector(`.pr-post[data-id="${postId}"] .pr-post-title[data-action="load-post"]`) as HTMLElement;
            if (updatedTitleLink) updatedTitleLink.removeAttribute('data-action');
        } else {
            contentEl.innerHTML = '<div class="pr-info" style="color: red;">Failed to load post content.</div>';
        }
    } catch (err) {
        Logger.error('Failed to load post', err);
        contentEl.innerHTML = '<div class="pr-info" style="color: red;">Error loading post.</div>';
    }
};

export const handleTogglePostBody = async (target: HTMLElement, state: ReaderState): Promise<void> => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const postEl = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement;
    if (!postEl) return;

    const eBtn = postEl.querySelector('[data-action="toggle-post-body"]') as HTMLElement;
    const isFromSticky = !!target.closest('.pr-sticky-header');
    const container = postEl.querySelector('.pr-post-body-container') as HTMLElement;
    const scrollBehavior: ScrollBehavior = (window as any).__PR_TEST_MODE__ ? 'auto' : 'smooth';

    const getVisibleViewportTop = (): number => {
        const stickyHeader = document.getElementById('pr-sticky-header');
        if (!stickyHeader || !stickyHeader.classList.contains('visible')) return 0;
        return Math.max(0, stickyHeader.getBoundingClientRect().bottom);
    };

    const alignCollapsedBodyBottomToVisibleTop = (postBodyContainer: HTMLElement): void => {
        const visibleTop = getVisibleViewportTop();
        const bottom = postBodyContainer.getBoundingClientRect().bottom;
        // If collapse pulled the body entirely above the user-visible viewport,
        // scroll so the body's bottom edge aligns with the visible top edge.
        if (bottom >= visibleTop) return;

        const targetTop = window.scrollY + bottom - visibleTop;
        window.scrollTo({
            top: Math.max(0, targetTop),
            behavior: scrollBehavior
        });
    };

    // If container doesn't exist, we need to load the post body first
    if (!container) {
        if (eBtn) eBtn.textContent = '[...]';
        try {
            const post = await fetchAndRenderPost(postId, state);
            if (!post || !post.htmlBody) {
                Logger.warn(`Post ${postId} has no body content`);
                if (eBtn) eBtn.textContent = '[e]';
                return;
            }

            // First [e] click should load and expand the body immediately.
            const newContainer = document.querySelector(`.pr-post[data-id="${postId}"] .pr-post-body-container`) as HTMLElement;
            if (newContainer) {
                newContainer.classList.remove('truncated');
                newContainer.style.maxHeight = 'none';

                const overlay = newContainer.querySelector('.pr-read-more-overlay') as HTMLElement;
                if (overlay) overlay.style.display = 'none';
                const readMoreBtn = newContainer.querySelector('.pr-post-read-more') as HTMLElement;
                if (readMoreBtn) readMoreBtn.style.display = 'none';
            }

            // Update button state (requires querying again after re-render)
            const newBtn = document.querySelector(`.pr-post[data-id="${postId}"] [data-action="toggle-post-body"]`) as HTMLElement;
            if (newBtn) {
                newBtn.textContent = '[e]';
                newBtn.title = 'Collapse post body';
            }

            if (isFromSticky) {
                const freshPostEl = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement;
                const postHeader = freshPostEl?.querySelector('.pr-post-header') as HTMLElement;
                if (postHeader) {
                    const newHeaderTop = postHeader.getBoundingClientRect().top + window.scrollY;
                    window.scrollTo({
                        top: newHeaderTop,
                        behavior: scrollBehavior
                    });
                }
            }

            Logger.info(`Loaded and expanded post body for ${postId}`);
            return;
        } catch (err) {
            Logger.error(`Failed to load post body for ${postId}`, err);
            if (eBtn) eBtn.textContent = '[e]';
            return;
        }
    }

    // Toggle existing container
    if (container.classList.contains('truncated')) {
        container.classList.remove('truncated');
        container.style.maxHeight = 'none';

        const overlay = container.querySelector('.pr-read-more-overlay') as HTMLElement;
        if (overlay) overlay.style.display = 'none';
        const readMoreBtn = container.querySelector('.pr-post-read-more') as HTMLElement;
        if (readMoreBtn) readMoreBtn.style.display = 'none';

        if (eBtn) eBtn.title = 'Collapse post body';
    } else {
        container.classList.add('truncated');
        container.style.maxHeight = CONFIG.maxPostHeight;

        const overlay = container.querySelector('.pr-read-more-overlay') as HTMLElement;
        if (overlay) overlay.style.display = 'flex';
        const readMoreBtn = container.querySelector('.pr-post-read-more') as HTMLElement;
        if (readMoreBtn) readMoreBtn.style.display = 'block';

        if (eBtn) eBtn.title = 'Expand post body';

        if (!isFromSticky) {
            alignCollapsedBodyBottomToVisibleTop(container);
        }
    }

    if (isFromSticky) {
        const postHeader = postEl.querySelector('.pr-post-header') as HTMLElement;
        if (postHeader) {
            const newHeaderTop = postHeader.getBoundingClientRect().top + window.scrollY;
            window.scrollTo({
                top: newHeaderTop,
                behavior: scrollBehavior
            });
        }
    }
};

export const handleLoadAllComments = async (target: HTMLElement, state: ReaderState): Promise<void> => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const post = state.postById.get(postId);
    const totalCount = post?.commentCount ?? -1;

    if (totalCount >= 0 && shouldPromptForLargeDescendants(totalCount)) {
        const decision = await promptLargeDescendantConfirmation({
            descendantCount: totalCount,
            subjectLabel: 'post'
        });
        if (decision === 'cancel' || decision === 'continue_without_loading') {
            return;
        }
    }

    const originalText = target.textContent;
    target.textContent = '[...]';

    try {
        const { comments } = await fetchAllPostCommentsWithCache(state, postId, totalCount);

        // [PR-POSTBTN-02] Mark all comments in this post as forceVisible
        comments.forEach(c => {
            markCommentRevealed(c);
        });

        // Also existing state
        state.comments.filter(c => c.postId === postId).forEach(c => {
            markCommentRevealed(c);
        });

        const added = getUIHost().mergeComments(comments, false); // Load all should show them full
        Logger.info(`Load all comments for post ${postId}: ${comments.length} fetched, ${added} new`);


        setTimeout(() => {
            state.comments.filter(c => c.postId === postId).forEach(c => {
                setJustRevealed(c, false);
            });
        }, JUST_REVEALED_DURATION_MS);

        getUIHost().rerenderPostGroup(postId);

        if (added === 0) {
            Logger.info(`No new comments found for post ${postId}`);
        }
    } catch (err) {
        Logger.error('Failed to load all comments', err);
    } finally {
        target.textContent = originalText;
    }
};

export const handleLoadThread = async (target: HTMLElement, state: ReaderState): Promise<void> => {
    const commentId = getCommentIdFromTarget(target);
    if (!commentId) return;
    const comment = state.commentById.get(commentId);
    if (!comment) return;

    let topLevelId = findTopLevelAncestorId(commentId, state);

    if (!topLevelId && comment.parentCommentId) {
        const originalText = target.textContent;
        target.textContent = '[...]';
        try {
            let currentParentId: string | null = comment.parentCommentId;
            const visited = new Set<string>();
            while (currentParentId && !visited.has(currentParentId)) {
                visited.add(currentParentId);
                const existing = state.commentById.get(currentParentId);
                if (existing) {
                    currentParentId = existing.parentCommentId || null;
                    continue;
                }
                const res = await queryGraphQL<GetCommentQuery, GetCommentQueryVariables>(GET_COMMENT, { id: currentParentId });
                const parent = res?.comment?.result as unknown as Comment;
                if (!parent) break;
                getUIHost().mergeComments([parent], true);
                currentParentId = parent.parentCommentId || null;
            }
            topLevelId = findTopLevelAncestorId(commentId, state);
        } catch (err) {
            Logger.error('Failed to walk parent chain for thread load', err);
            target.textContent = originalText;
            return;
        }
    }

    if (!topLevelId) {
        topLevelId = findHighestKnownAncestorId(commentId, state) || commentId;
    }

    const originalText = target.textContent;
    target.textContent = '[...]';

    try {
        const res = await queryGraphQL<GetThreadCommentsQuery, GetThreadCommentsQueryVariables>(GET_THREAD_COMMENTS, {
            topLevelCommentId: topLevelId,
            limit: CONFIG.loadMax,
        });
        const comments = res?.comments?.results || [];
        const added = getUIHost().mergeComments(comments as Comment[], true);
        Logger.info(`Load thread ${topLevelId}: ${comments.length} fetched, ${added} new`);
        if (added > 0 && comment.postId) {
            getUIHost().rerenderPostGroup(comment.postId, commentId);
        }
    } catch (err) {
        Logger.error('Failed to load thread', err);
    } finally {
        target.textContent = originalText;
    }
};

export const handleLoadParents = async (
    target: HTMLElement,
    state: ReaderState,
    options: LoadParentsOptions = {}
): Promise<LoadParentsResult | void> => {
    const preferInPlace = options.preferInPlace ?? true;
    const traceContext = options.traceContext || 'load-parents';
    const commentId = getCommentIdFromTarget(target);
    if (!commentId) return;
    const comment = state.commentById.get(commentId);
    if (!comment) return;

    const originalText = target.textContent;
    target.textContent = '[...]';

    try {
        const missingIds: string[] = [];
        let currentId: string | null = comment.parentCommentId || null;
        const visited = new Set<string>();

        while (currentId) {
            if (visited.has(currentId)) break;
            visited.add(currentId);
            const existing = state.commentById.get(currentId);
            if (existing) {
                currentId = existing.parentCommentId || null;
                continue;
            }
            missingIds.push(currentId);
            currentId = null;
        }

        if (missingIds.length === 0) {
            target.textContent = originalText;
            const result: LoadParentsResult = {
                commentId,
                fetchedCount: 0,
                added: 0,
                inPlaceUpgraded: 0,
                usedFallbackRerender: false,
                missingDomAncestorIds: [],
            };
            logFindParentTrace('trace:load-parents-noop', { traceContext, ...result });
            return result;
        }

        const fetched: Comment[] = [];
        while (missingIds.length > 0) {
            const batch = missingIds.splice(0, 50);
            const res = await queryGraphQL<GetCommentsByIdsQuery, GetCommentsByIdsQueryVariables>(GET_COMMENTS_BY_IDS, { commentIds: batch });
            const results = (res?.comments?.results || []) as Comment[];
            fetched.push(...results);

            for (const r of results) {
                if (r.parentCommentId && !state.commentById.has(r.parentCommentId) && !missingIds.includes(r.parentCommentId)) {
                    missingIds.push(r.parentCommentId);
                }
            }
        }

        // Mark fetched parents as forceVisible
        for (const f of fetched) {
            markCommentRevealed(f);
        }
        const added = getUIHost().mergeComments(fetched, true);

        Logger.info(`Load parents for ${commentId}: ${fetched.length} fetched, ${added} new`);

        if (comment) {
            markCommentRevealed(comment);
        }

        let inPlaceUpgraded = 0;
        let usedFallbackRerender = false;
        let missingDomAncestorIds: string[] = [];
        if (added > 0 && comment.postId) {
            if (preferInPlace) {
                inPlaceUpgraded = await preserveFocalViewportAcrossDomMutation(
                    options.anchorCommentId || commentId,
                    () => upgradeAncestorChainInPlace(commentId, state),
                    `${traceContext}:inplace`
                );
                missingDomAncestorIds = collectMissingAncestorDomIds(commentId, state);
                usedFallbackRerender = missingDomAncestorIds.length > 0;
                logFindParentTrace('trace:load-parents-inplace', {
                    traceContext,
                    commentId,
                    inPlaceUpgraded,
                    missingDomAncestorIds,
                    usedFallbackRerender,
                });
                if (usedFallbackRerender) {
                    getUIHost().rerenderPostGroup(comment.postId, options.anchorCommentId || commentId);
                }
            } else {
                usedFallbackRerender = true;
                getUIHost().rerenderPostGroup(comment.postId, options.anchorCommentId || commentId);
            }
        }

        setTimeout(() => {
            for (const f of fetched) setJustRevealed(f, false);
            if (comment) setJustRevealed(comment, false);
        }, JUST_REVEALED_DURATION_MS);
        const result: LoadParentsResult = {
            commentId,
            fetchedCount: fetched.length,
            added,
            inPlaceUpgraded,
            usedFallbackRerender,
            missingDomAncestorIds,
        };
        logFindParentTrace('trace:load-parents-done', { traceContext, ...result });
        return result;
    } catch (err) {
        Logger.error('Failed to load parents', err);
    } finally {
        target.textContent = originalText;
    }
};


export const handleLoadDescendants = async (target: HTMLElement, state: ReaderState): Promise<void> => {
    const commentId = getCommentIdFromTarget(target);
    if (!commentId) return;
    const comment = state.commentById.get(commentId);
    if (!comment) return;

    const originalText = target.textContent;
    target.textContent = '[...]';

    try {
        let topLevelId = findTopLevelAncestorId(commentId, state);

        if (!topLevelId && comment.parentCommentId) {
            let currentParentId: string | null = comment.parentCommentId;
            const visited = new Set<string>();
            while (currentParentId && !visited.has(currentParentId)) {
                visited.add(currentParentId);
                const existing = state.commentById.get(currentParentId);
                if (existing) {
                    currentParentId = existing.parentCommentId || null;
                    continue;
                }
                const parentRes = await queryGraphQL<GetCommentQuery, GetCommentQueryVariables>(GET_COMMENT, { id: currentParentId });
                const parent = parentRes?.comment?.result as unknown as Comment;
                if (!parent) break;

                getUIHost().mergeComments([parent], true);
                currentParentId = parent.parentCommentId || null;
            }
            topLevelId = findTopLevelAncestorId(commentId, state);
        }

        if (!topLevelId) topLevelId = findHighestKnownAncestorId(commentId, state) || commentId;

        const res = await queryGraphQL<GetThreadCommentsQuery, GetThreadCommentsQueryVariables>(GET_THREAD_COMMENTS, {
            topLevelCommentId: topLevelId,
            limit: CONFIG.loadMax,
        });
        const fetchedComments = (res?.comments?.results || []) as Comment[];

        const added = getUIHost().mergeComments(fetchedComments, true);

        // Only reveal the requested comment and its descendants; do not uncollapse unrelated sibling subtrees.
        const fetchedById = new Map<string, Comment>();
        fetchedComments.forEach(c => fetchedById.set(c._id, c));
        const resolveComment = (id: string): Comment | undefined =>
            state.commentById.get(id) || fetchedById.get(id);
        const isTargetSubtreeComment = (id: string): boolean => {
            if (id === commentId) return true;

            let current = resolveComment(id);
            const visited = new Set<string>();
            while (current?.parentCommentId) {
                if (visited.has(current._id)) break;
                visited.add(current._id);

                if (current.parentCommentId === commentId) return true;
                current = resolveComment(current.parentCommentId);
            }
            return false;
        };

        const revealedIds: string[] = [];
        fetchedComments.forEach((c) => {
            if (!isTargetSubtreeComment(c._id)) return;
            const inState = state.commentById.get(c._id);
            if (inState) {
                markCommentRevealed(inState);
                revealedIds.push(inState._id);
            }
        });

        Logger.info(`Load descendants for ${commentId}: ${fetchedComments.length} fetched, ${added} new`);
        if ((added > 0 || fetchedComments.length > 0) && comment.postId) {
            getUIHost().rerenderPostGroup(comment.postId, commentId);
        }

        setTimeout(() => {
            revealedIds.forEach((id) => {
                const inState = state.commentById.get(id);
                if (inState) {
                    setJustRevealed(inState, false);
                }
            });
        }, JUST_REVEALED_DURATION_MS);
    } catch (err) {
        Logger.error('Failed to load descendants', err);
    } finally {
        target.textContent = originalText;
    }
};

export const handleLoadParentsAndScroll = async (target: HTMLElement, state: ReaderState): Promise<void> => {
    const commentId = getCommentIdFromTarget(target);
    if (!commentId) return;
    logFindParentTrace('trace:start', {
        commentId,
        scrollY: round2(window.scrollY),
    });

    // First, check if root is already loaded
    let topLevelId = findTopLevelAncestorId(commentId, state);
    const alreadyLoaded = !!topLevelId;

    // Ensure ALL ancestors are marked as forceVisible
    markAncestorChainForceVisible(commentId, state);

    if (!alreadyLoaded) {
        // If root not found (broken chain), load parents
        await handleLoadParents(target, state, {
            preferInPlace: true,
            anchorCommentId: commentId,
            traceContext: 'trace-to-root',
        });
        // Re-check root
        topLevelId = findTopLevelAncestorId(commentId, state);
        logFindParentTrace('trace:after-load-parents', {
            commentId,
            topLevelId: topLevelId || null,
            scrollY: round2(window.scrollY),
        });
    }

    if (topLevelId) {
        let rootEl = document.querySelector(`.pr-comment[data-id="${topLevelId}"]`) as HTMLElement;
        if (rootEl) {
            const comment = state.commentById.get(commentId);
            const needsRerender = !!comment?.postId && ancestorChainNeedsRerender(commentId, state);
            if (needsRerender && comment?.postId) {
                const inPlaceUpgraded = await preserveFocalViewportAcrossDomMutation(
                    commentId,
                    () => upgradeAncestorChainInPlace(commentId, state),
                    'trace-to-root:ancestor-upgrade'
                );
                const missingDomAncestorIds = collectMissingAncestorDomIds(commentId, state);
                const usedFallbackRerender = missingDomAncestorIds.length > 0;
                logFindParentTrace('trace:ancestor-upgrade', {
                    commentId,
                    topLevelId,
                    inPlaceUpgraded,
                    missingDomAncestorIds,
                    usedFallbackRerender,
                });
                if (usedFallbackRerender) {
                    getUIHost().rerenderPostGroup(comment.postId, commentId);
                }
                rootEl = document.querySelector(`.pr-comment[data-id="${topLevelId}"]`) as HTMLElement;
            }

            if (!rootEl) return;

            await new Promise(resolve => requestAnimationFrame(resolve));

            await withForcedLayout(rootEl, async () => {
                if (!rootEl.isConnected) return;

                scrollToCommentIfNeeded(rootEl, 'Trace to Root');
                highlightParentTemporarily(rootEl);
            });
            return;
        }
    }

    // Fallback to post header specific scrolling logic
    handleScrollToRoot(target, topLevelId);
};
