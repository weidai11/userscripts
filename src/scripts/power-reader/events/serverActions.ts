
/**
 * Server actions for Power Reader
 * Handles data fetching, state updates, and re-rendering
 */

import { queryGraphQL } from '../../../shared/graphql/client';
import {
    GET_POST_BY_ID,
    GET_COMMENT,
    GET_POST_COMMENTS,
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
    GetPostCommentsQuery,
    GetPostCommentsQueryVariables,
    GetThreadCommentsQuery,
    GetThreadCommentsQueryVariables,
    GetCommentsByIdsQuery,
    GetCommentsByIdsQueryVariables,
} from '../../../generated/graphql';
import type { ReaderState } from '../state';
import { smartScrollTo } from '../utils/dom';
import { CONFIG } from '../config';
import { isElementFullyVisible } from '../utils/preview';
import { Logger } from '../utils/logger';
import { toggleAuthorPreference } from '../utils/storage';

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

    (comment as any).forceVisible = true;
    (comment as any).justRevealed = true;

    getUIHost().rerenderPostGroup(postId, commentId);

    // Clear justRevealed after animation
    setTimeout(() => {
        if (comment) (comment as any).justRevealed = false;
    }, 2000);
};

/**
 * Handle find parent navigation
 */
export const handleFindParent = async (target: HTMLElement, state: ReaderState): Promise<void> => {
    const commentEl = target.closest('.pr-comment');
    const parentId = commentEl?.getAttribute('data-parent-id');
    const postId = commentEl?.getAttribute('data-post-id');

    // Case 1: Top-level comment -> Navigate to Post
    if (!parentId) {
        if (!postId) return;
        const postEl = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement;
        if (postEl) {
            const postHeader = postEl.querySelector('.pr-post-header') as HTMLElement;
            if (postHeader) smartScrollTo(postHeader, true);

            const stickyHeader = document.querySelector(`.pr-sticky-header .pr-post-header[data-post-id="${postId}"]`) as HTMLElement;
            const targets = [postHeader, postEl.querySelector('.pr-post-body-container'), stickyHeader].filter(Boolean) as HTMLElement[];

            targets.forEach(t => t.classList.add('pr-highlight-parent'));
            setTimeout(() => targets.forEach(t => t.classList.remove('pr-highlight-parent')), 2000);
        }
        return;
    }

    // Case 2: Parent in DOM (normal)
    let parentEl = document.querySelector(`.pr-comment[data-id="${parentId}"]`) as HTMLElement;
    const isReadPlaceholder = parentEl?.classList.contains('pr-comment-placeholder');
    const parentIsPlaceholder = !!parentEl?.dataset.placeholder || parentEl?.classList.contains('pr-missing-parent') || isReadPlaceholder;

    if (parentEl && !parentIsPlaceholder) {
        smartScrollTo(parentEl, false);
        parentEl.classList.add('pr-highlight-parent');
        setTimeout(() => parentEl.classList.remove('pr-highlight-parent'), 2000);
        return;
    }

    // Case 3: Parent in DOM but minimized (read placeholder)
    if (parentEl && isReadPlaceholder) {
        if (postId) {
            markAncestorChainForceVisible(parentId, state);
            getUIHost().rerenderPostGroup(postId, parentId);

            const newParentEl = document.querySelector(`.pr-comment[data-id="${parentId}"]`) as HTMLElement;
            if (newParentEl) {
                smartScrollTo(newParentEl, false);
                newParentEl.classList.add('pr-highlight-parent');
                setTimeout(() => newParentEl.classList.remove('pr-highlight-parent'), 2000);
            }
        }
        return;
    }

    // Case 4: Parent not in DOM, must fetch
    const originalText = target.textContent;
    target.textContent = '[...]';

    try {
        Logger.info(`Find Parent: Fetching missing parent ${parentId} from server...`);
        const res = await queryGraphQL<GetCommentQuery, GetCommentQueryVariables>(GET_COMMENT, { id: parentId });
        const parentComment = res?.comment?.result as unknown as Comment;

        if (parentComment) {
            // Add to state if not present
            if (!state.commentById.has(parentComment._id)) {
                (parentComment as any).justRevealed = true;
                (parentComment as any).forceVisible = true; // Ensure it renders full

                getUIHost().mergeComments([parentComment], true);

                // Find the post group container to re-render it
                if (parentComment.postId) {
                    getUIHost().rerenderPostGroup(parentComment.postId, parentId);

                    // After re-render, scroll to the parent
                    setTimeout(() => {
                        const newParentEl = document.querySelector(`.pr-comment[data-id="${parentId}"]`) as HTMLElement;
                        if (newParentEl) {
                            smartScrollTo(newParentEl, false);
                            newParentEl.classList.add('pr-highlight-parent');
                            setTimeout(() => newParentEl.classList.remove('pr-highlight-parent'), 2000);
                        }
                    }, 50);
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
            // Remove data-action to prevent re-loading
            titleLink.removeAttribute('data-action');
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
    let container = postEl.querySelector('.pr-post-body-container') as HTMLElement;

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
                    const newHeaderTop = postHeader.getBoundingClientRect().top + window.pageYOffset;
                    window.scrollTo({
                        top: newHeaderTop,
                        behavior: (window as any).__PR_TEST_MODE__ ? 'instant' : 'smooth' as ScrollBehavior
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
    }

    if (isFromSticky) {
        const postHeader = postEl.querySelector('.pr-post-header') as HTMLElement;
        if (postHeader) {
            const newHeaderTop = postHeader.getBoundingClientRect().top + window.pageYOffset;
            window.scrollTo({
                top: newHeaderTop,
                behavior: (window as any).__PR_TEST_MODE__ ? 'instant' : 'smooth' as ScrollBehavior
            });
        }
    }
};

export const handleLoadAllComments = async (target: HTMLElement, state: ReaderState): Promise<void> => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;

    const originalText = target.textContent;
    target.textContent = '[...]';

    try {
        const res = await queryGraphQL<GetPostCommentsQuery, GetPostCommentsQueryVariables>(GET_POST_COMMENTS, {
            postId,
            limit: CONFIG.loadMax,
        });
        const comments = (res?.comments?.results || []) as Comment[];

        // [PR-POSTBTN-02] Mark all comments in this post as forceVisible
        comments.forEach(c => {
            (c as any).forceVisible = true;
            (c as any).justRevealed = true;
        });

        // Also existing state
        state.comments.filter(c => c.postId === postId).forEach(c => {
            (c as any).forceVisible = true;
            (c as any).justRevealed = true;
        });

        const added = getUIHost().mergeComments(comments, false); // Load all should show them full
        Logger.info(`Load all comments for post ${postId}: ${comments.length} fetched, ${added} new`);


        setTimeout(() => {
            state.comments.filter(c => c.postId === postId).forEach(c => {
                (c as any).justRevealed = false;
            });
        }, 2000);

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
        topLevelId = commentId;
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

export const handleLoadParents = async (target: HTMLElement, state: ReaderState): Promise<void> => {
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
            return;
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
            (f as any).forceVisible = true;
            (f as any).justRevealed = true;
        }
        const added = getUIHost().mergeComments(fetched, true);

        Logger.info(`Load parents for ${commentId}: ${fetched.length} fetched, ${added} new`);

        if (comment) {
            (comment as any).forceVisible = true;
            (comment as any).justRevealed = true;
        }

        if (added > 0 && comment.postId) {
            getUIHost().rerenderPostGroup(comment.postId, commentId);
        }

        setTimeout(() => {
            for (const f of fetched) (f as any).justRevealed = false;
            if (comment) (comment as any).justRevealed = false;
        }, 2000);
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

        if (!topLevelId) topLevelId = commentId;

        const res = await queryGraphQL<GetThreadCommentsQuery, GetThreadCommentsQueryVariables>(GET_THREAD_COMMENTS, {
            topLevelCommentId: topLevelId,
            limit: CONFIG.loadMax,
        });
        const fetchedComments = (res?.comments?.results || []) as Comment[];

        const added = getUIHost().mergeComments(fetchedComments, true);

        // Update all comments (newly added and existing) in state to ensure they are visible
        fetchedComments.forEach((c) => {
            const inState = state.commentById.get(c._id);
            if (inState) {
                (inState as any).forceVisible = true;
                (inState as any).justRevealed = true;
            }
        });

        Logger.info(`Load descendants for ${commentId}: ${fetchedComments.length} fetched, ${added} new`);
        if ((added > 0 || fetchedComments.length > 0) && comment.postId) {
            getUIHost().rerenderPostGroup(comment.postId, commentId);
        }

        setTimeout(() => {
            fetchedComments.forEach((c) => {
                const inState = state.commentById.get(c._id);
                if (inState) (inState as any).justRevealed = false;
            });
        }, 2000);
    } catch (err) {
        Logger.error('Failed to load descendants', err);
    } finally {
        target.textContent = originalText;
    }
};

export const handleLoadParentsAndScroll = async (target: HTMLElement, state: ReaderState): Promise<void> => {
    const commentId = getCommentIdFromTarget(target);
    if (!commentId) return;
    // First, check if root is already loaded
    let topLevelId = findTopLevelAncestorId(commentId, state);
    const alreadyLoaded = !!topLevelId;

    // Ensure ALL ancestors are marked as forceVisible
    markAncestorChainForceVisible(commentId, state);

    if (!alreadyLoaded) {
        // If root not found (broken chain), load parents
        // handleLoadParents re-renders and preserves current comment's viewport top
        await handleLoadParents(target, state);
        // Re-check root
        topLevelId = findTopLevelAncestorId(commentId, state);
    }

    if (topLevelId) {
        let rootEl = document.querySelector(`.pr-comment[data-id="${topLevelId}"]`) as HTMLElement;
        if (rootEl) {
            const comment = state.commentById.get(commentId);
            if (comment?.postId) {
                getUIHost().rerenderPostGroup(comment.postId, commentId);
                rootEl = document.querySelector(`.pr-comment[data-id="${topLevelId}"]`) as HTMLElement;
            }

            if (!rootEl) return;

            await new Promise(resolve => requestAnimationFrame(resolve));

            const isVisible = isElementFullyVisible(rootEl);

            if (!isVisible) {
                smartScrollTo(rootEl, false);
            } else {
                Logger.info(`Trace to Root: Root ${topLevelId} already visible, skipping scroll.`);
            }

            rootEl.classList.add('pr-highlight-parent');
            setTimeout(() => rootEl.classList.remove('pr-highlight-parent'), 2000);
            return;
        }
    }

    // Fallback to post header specific scrolling logic
    handleScrollToRoot(target, topLevelId);
};
