/**
 * DOM and scrolling utilities for Power Reader
 */

/**
 * Smart scroll to an element, accounting for the correct post's header height
 */
export const smartScrollTo = (el: HTMLElement, isPost: boolean): void => {
    const postContainer = el.closest('.pr-post') as HTMLElement;

    if (!postContainer) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }

    // Measure the header of the target post specifically
    const postHeader = postContainer.querySelector('.pr-post-header') as HTMLElement;
    const stickyHeader = document.getElementById('pr-sticky-header');
    const stickyHeight = (stickyHeader && stickyHeader.classList.contains('visible')) ? stickyHeader.offsetHeight : 0;
    const headerHeight = postHeader ? postHeader.offsetHeight : (stickyHeight || 60);

    if (isPost) {
        // Post header should be exactly at the top of viewport
        const headerTop = postHeader
            ? postHeader.getBoundingClientRect().top + window.pageYOffset
            : postContainer.getBoundingClientRect().top + window.pageYOffset;

        window.scrollTo({
            top: headerTop,
            behavior: (window as any).__PR_TEST_MODE__ ? 'instant' : 'smooth' as ScrollBehavior
        });
    } else {
        // Comment should be just below the calculated header height
        const elementTop = el.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({
            top: elementTop - headerHeight - 10, // 10px buffer
            behavior: (window as any).__PR_TEST_MODE__ ? 'instant' : 'smooth' as ScrollBehavior
        });
    }
};

/**
 * Update post action buttons ([e], [a], etc.) based on actual DOM state.
 * For [e], checks if content is truly truncated.
 */
export const refreshPostActionButtons = (postId?: string): void => {
    const selector = postId ? `.pr-post[data-id="${postId}"]` : '.pr-post';
    const posts = document.querySelectorAll(selector);

    const updateNextPostButton = (header: HTMLElement | null, postEl: Element | null): void => {
        if (!header) return;
        const nBtn = header.querySelector('[data-action="scroll-to-next-post"]') as HTMLElement;
        if (!nBtn) return;

        let nextPost: Element | null = postEl ? postEl.nextElementSibling : null;
        while (nextPost && !(nextPost as HTMLElement).classList.contains('pr-post')) {
            nextPost = nextPost.nextElementSibling;
        }

        if (!nextPost) {
            nBtn.classList.add('disabled');
            nBtn.title = 'No more posts in current feed';
        } else {
            nBtn.classList.remove('disabled');
            nBtn.title = 'Scroll to next post';
        }
    };

    posts.forEach(post => {
        const container = post.querySelector('.pr-post-body-container') as HTMLElement;
        const eBtn = post.querySelector('[data-action="toggle-post-body"]') as HTMLElement;

        if (container && eBtn) {
            const isFullPost = !!container.querySelector('.pr-post-body');

            if (container.classList.contains('truncated')) {
                // If it's hidden (collapsed), we can't measure it accurately
                if (container.classList.contains('collapsed') || container.style.display === 'none') {
                    eBtn.classList.remove('disabled');
                    eBtn.title = 'Expand post body';
                } else {
                    const isActuallyTruncated = container.scrollHeight > container.offsetHeight;
                    if (!isActuallyTruncated) {
                        // It fits! Remove the fake "Read More" button and disable [e]
                        const overlay = container.querySelector('.pr-read-more-overlay') as HTMLElement;
                        if (overlay) overlay.style.display = 'none';

                        eBtn.classList.add('disabled');
                        eBtn.title = 'Post fits within viewport without truncation';
                    } else {
                        eBtn.classList.remove('disabled');
                        eBtn.title = 'Expand post body';
                    }
                }
            } else if (isFullPost) {
                // Not truncated (fully expanded), check if it's collapsed
                if (container.classList.contains('collapsed')) {
                    eBtn.title = 'Expand post body';
                } else {
                    // Check if it fits even if expanded
                    const isSmallContent = container.scrollHeight <= (window.innerHeight * 0.5); // Fallback to 50vh estimate
                    if (isSmallContent) {
                        eBtn.classList.add('disabled');
                        eBtn.title = 'Post body is small and doesn\'t need toggle';

                        const overlay = container.querySelector('.pr-read-more-overlay') as HTMLElement;
                        if (overlay) overlay.style.display = 'none';
                    } else {
                        eBtn.title = 'Collapse post body';
                    }
                }
                if (!eBtn.title.includes('small')) {
                    eBtn.classList.remove('disabled');
                }
            }
        }

        const header = post.querySelector('.pr-post-header') as HTMLElement;
        updateNextPostButton(header, post);
    });

    // Update sticky header button state if visible
    const stickyHeader = document.querySelector('.pr-sticky-header .pr-post-header') as HTMLElement;
    if (stickyHeader) {
        const stickyPostId = stickyHeader.getAttribute('data-post-id');
        const stickyPostEl = stickyPostId
            ? document.querySelector(`.pr-post[data-id="${stickyPostId}"]`)
            : null;
        updateNextPostButton(stickyHeader, stickyPostEl);
    }
};
