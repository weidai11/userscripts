
/**
 * DOM actions for Power Reader navigation
 * Handles pure DOM manipulation without state dependency
 */

import { smartScrollTo, refreshPostActionButtons } from '../utils/dom';

/**
 * Collapse a post's content - shared logic for both regular and sticky headers
 */
export const collapsePost = (post: Element): void => {
    post.querySelector('.pr-post-comments')?.classList.add('collapsed');
    // Hide both the full-body container and pre-load placeholder content.
    post.querySelector('.pr-post-body-container')?.classList.add('collapsed');
    post.querySelector('.pr-post-content')?.classList.add('collapsed');

    syncPostToggleButtons(post, true);
};

/**
 * Expand a post's content - shared logic for both regular and sticky headers
 */
export const expandPost = (post: Element): void => {
    post.querySelector('.pr-post-comments')?.classList.remove('collapsed');
    // Restore both full-body container and pre-load placeholder content.
    post.querySelector('.pr-post-body-container')?.classList.remove('collapsed');
    post.querySelector('.pr-post-content')?.classList.remove('collapsed');

    syncPostToggleButtons(post, false);
};

const syncPostToggleButtons = (post: Element, isCollapsed: boolean): void => {
    const postEl = post as HTMLElement;
    const postId = postEl.getAttribute('data-post-id') || postEl.getAttribute('data-id');

    const headers: HTMLElement[] = [];
    const mainHeader = postEl.querySelector('.pr-post-header') as HTMLElement;
    if (mainHeader) headers.push(mainHeader);

    if (postId) {
        const stickyHeader = document.querySelector(`.pr-sticky-header .pr-post-header[data-post-id="${postId}"]`) as HTMLElement;
        if (stickyHeader) headers.push(stickyHeader);
    }

    headers.forEach(header => {
        const collapseBtn = header.querySelector('[data-action="collapse"]') as HTMLElement;
        const expandBtn = header.querySelector('[data-action="expand"]') as HTMLElement;
        if (collapseBtn) collapseBtn.style.display = isCollapsed ? 'none' : 'inline';
        if (expandBtn) expandBtn.style.display = isCollapsed ? 'inline' : 'none';
    });
};

/**
 * Get Post ID from target element
 */
export const getPostIdFromTarget = (target: HTMLElement): string | null => {
    const post = target.closest('.pr-post') as HTMLElement;
    if (post) return post.dataset.postId || post.dataset.id || null;
    const header = target.closest('.pr-post-header') as HTMLElement;
    return header?.getAttribute('data-post-id') || null;
};

/**
 * Get Comment ID from target element
 */
export const getCommentIdFromTarget = (target: HTMLElement): string | null => {
    const comment = target.closest('.pr-comment') as HTMLElement;
    return comment?.getAttribute('data-id') || null;
};

/**
 * Handle post collapse from click event (finds post from target)
 */
export const handlePostCollapse = (target: HTMLElement): void => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const post = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement;
    if (!post) return;

    const isFromSticky = !!target.closest('.pr-sticky-header');

    // Find the header element before collapsing
    const postHeader = post.querySelector('.pr-post-header') as HTMLElement;

    collapsePost(post);

    if (isFromSticky && postHeader) {
        smartScrollTo(postHeader, true);
    }
};

/**
 * Handle post expand from click event (finds post from target)
 */
export const handlePostExpand = (target: HTMLElement): void => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const post = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement;
    if (!post) return;

    const isFromSticky = !!target.closest('.pr-sticky-header');

    expandPost(post);

    if (isFromSticky) {
        const postHeader = post.querySelector('.pr-post-header') as HTMLElement;
        if (postHeader) {
            smartScrollTo(postHeader, true);
        }
    }
};

/**
 * Handle comment collapse
 */
export const handleCommentCollapse = (target: HTMLElement): void => {
    const comment = target.closest('.pr-comment');
    comment?.classList.add('collapsed');
};

/**
 * Handle comment expand
 */
export const handleCommentExpand = (target: HTMLElement): void => {
    const comment = target.closest('.pr-comment');
    comment?.classList.remove('collapsed');
};

/**
 * Handle comment collapse toggle (used by thread line click)
 */
export const handleCommentCollapseToggle = (replies: HTMLElement): void => {
    const comment = replies.closest('.pr-comment');
    if (comment) {
        if (comment.classList.contains('collapsed')) {
            comment.classList.remove('collapsed');
        } else {
            comment.classList.add('collapsed');
        }
    }
};


/**
 * Handle read more button click
 */
export const handleReadMore = (target: HTMLElement): void => {
    const container = target.closest('.pr-post-body-container') as HTMLElement;
    if (container) {
        container.classList.remove('truncated');
        container.style.maxHeight = 'none';
        const overlay = container.querySelector('.pr-read-more-overlay');
        if (overlay) (overlay as HTMLElement).style.display = 'none';

        const btn = container.querySelector('.pr-post-read-more');
        if (btn) (btn as HTMLElement).style.display = 'none';

        // Refresh [e] button state
        const postEl = container.closest('.pr-post') as HTMLElement;
        if (postEl) {
            const postId = postEl.dataset.id;
            if (postId) refreshPostActionButtons(postId);
        }
    }
};

/**
 * Handle scroll to comments
 */
export const handleScrollToComments = (target: HTMLElement): void => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const postEl = document.querySelector(`.pr-post[data-id="${postId}"]`);
    if (!postEl) return;
    const firstComment = postEl.querySelector('.pr-comment') as HTMLElement;
    if (firstComment) smartScrollTo(firstComment, false);
};

/**
 * Handle scroll to next post
 */
export const handleScrollToNextPost = (target: HTMLElement): void => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const currentPost = document.querySelector(`.pr-post[data-id="${postId}"]`);
    if (!currentPost) return;
    const nextPost = currentPost.nextElementSibling as HTMLElement;
    if (nextPost && nextPost.classList.contains('pr-post')) {
        const header = nextPost.querySelector('.pr-post-header') as HTMLElement;
        if (header) smartScrollTo(header, true);
    }
};

/**
 * Handle scroll to post top (header)
 */
export const handleScrollToPostTop = (target: HTMLElement, _state?: any): void => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const postHeader = document.querySelector(`.pr-post[data-id="${postId}"] .pr-post-header`) as HTMLElement;
    if (postHeader) {
        smartScrollTo(postHeader, true);
    }
};

/**
 * Handle scroll to root
 */
export const handleScrollToRoot = (target: HTMLElement, topLevelId: string | null = null): void => {
    // If topLevelId is provided, use it directly
    if (topLevelId) {
        const rootEl = document.querySelector(`.pr-comment[data-id="${topLevelId}"]`) as HTMLElement;
        if (rootEl) {
            smartScrollTo(rootEl, false);
            rootEl.classList.add('pr-highlight-parent');
            setTimeout(() => rootEl.classList.remove('pr-highlight-parent'), 2000);
            return;
        }
    }

    // Else try to infer from target
    const commentId = getCommentIdFromTarget(target);
    if (!commentId && !topLevelId) return;

    // Fallback: Scroll to post header
    const postId = getPostIdFromTarget(target);
    if (postId) {
        const postHeader = document.querySelector(`.pr-post[data-id="${postId}"] .pr-post-header`) as HTMLElement;
        if (postHeader) {
            smartScrollTo(postHeader, true);
            postHeader.classList.add('pr-highlight-parent');
            setTimeout(() => postHeader.classList.remove('pr-highlight-parent'), 2000);
        }
    }
};
