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
 * Optimized batch refresh for all post action buttons in a container.
 * Performs a single DOM scan instead of per-post scans.
 */
export const refreshAllPostActionButtons = (container: HTMLElement | Document = document): void => {
    const posts = container.querySelectorAll('.pr-post');
    const viewportHeight = window.innerHeight;

    // Pre-calculate next sibling links for all posts in this container
    posts.forEach((post, idx) => {
        const header = post.querySelector('.pr-post-header') as HTMLElement;
        const bodyContainer = post.querySelector('.pr-post-body-container') as HTMLElement;
        const eBtn = post.querySelector('[data-action="toggle-post-body"]') as HTMLElement;
        const nBtn = post.querySelector('[data-action="scroll-to-next-post"]') as HTMLElement;

        // 1. Next Post Button logic
        if (nBtn) {
            let nextPost: Element | null = post.nextElementSibling;
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
        }

        // 2. Expand [e] button logic (Truncation)
        if (bodyContainer && eBtn) {
            const isFullPost = bodyContainer.classList.contains('pr-post-body');

            if (bodyContainer.classList.contains('truncated')) {
                if (bodyContainer.classList.contains('collapsed') || bodyContainer.style.display === 'none') {
                    eBtn.classList.remove('disabled');
                    eBtn.title = 'Expand post body';
                } else {
                    const isActuallyTruncated = bodyContainer.scrollHeight > bodyContainer.offsetHeight;
                    if (!isActuallyTruncated) {
                        const overlay = bodyContainer.querySelector('.pr-read-more-overlay') as HTMLElement;
                        if (overlay) overlay.style.display = 'none';
                        eBtn.classList.add('disabled');
                        eBtn.title = 'Post fits within viewport without truncation';
                    } else {
                        eBtn.classList.remove('disabled');
                        eBtn.title = 'Expand post body';
                    }
                }
            } else if (isFullPost) {
                if (bodyContainer.classList.contains('collapsed')) {
                    eBtn.title = 'Expand post body';
                } else {
                    const isSmallContent = bodyContainer.scrollHeight <= (viewportHeight * 0.5);
                    if (isSmallContent) {
                        eBtn.classList.add('disabled');
                        eBtn.title = 'Post body is small and doesn\'t need toggle';
                        const overlay = bodyContainer.querySelector('.pr-read-more-overlay') as HTMLElement;
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
    });

    // Update sticky header specifically if it exists
    const stickyHeader = document.querySelector('.pr-sticky-header .pr-post-header') as HTMLElement;
    if (stickyHeader) {
        const stickyPostId = stickyHeader.getAttribute('data-post-id');
        const nBtn = stickyHeader.querySelector('[data-action="scroll-to-next-post"]') as HTMLElement;
        if (nBtn && stickyPostId) {
            const currentPost = document.querySelector(`.pr-post[data-id="${stickyPostId}"]`);
            let nextPost: Element | null = currentPost ? currentPost.nextElementSibling : null;
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
        }
    }
};

/**
 * Update post action buttons ([e], [a], etc.) based on actual DOM state.
 * For [e], checks if content is truly truncated.
 */
export const refreshPostActionButtons = (target?: string | HTMLElement): void => {
    let posts: NodeListOf<Element> | HTMLElement[];
    
    if (target instanceof HTMLElement) {
        posts = [target];
    } else {
        const selector = target ? `.pr-post[data-id="${target}"]` : '.pr-post';
        posts = document.querySelectorAll(selector);
    }

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

    posts.forEach(postNode => {
        const post = postNode as HTMLElement;
        const container = post.querySelector('.pr-post-body-container') as HTMLElement;
        const eBtn = post.querySelector('[data-action="toggle-post-body"]') as HTMLElement;

        if (container && eBtn) {
            const isFullPost = container.classList.contains('pr-post-body');

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

const forceLayoutCounts = new WeakMap<HTMLElement, number>();

/**
 * Temporarily bypasses content-visibility for precise DOM measurements and layout tests
 */
export async function withForcedLayout<T>(
    element: HTMLElement,
    callback: () => T | Promise<T>
): Promise<T> {
    // 1. Find the highest relevant container (post group) to wake up the whole tree
    const container = (element.closest('.pr-post-group') || element) as HTMLElement;

    // 2. Force layout constraint off (using a reference counter to prevent race conditions)
    const count = (forceLayoutCounts.get(container) || 0) + 1;
    forceLayoutCounts.set(container, count);
    if (count === 1) container.classList.add('pr-force-layout');

    // 3. Force a synchronous browser reflow so dimensions instantly update
    // (reading offsetHeight flushes the layout queue)
    void container.offsetHeight;

    // Wait for the browser to actually paint the new layout, which is required
    // for elementFromPoint to hit the correct elements.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    try {
        if (!container.isConnected) {
            return await callback();
        }
        // 4. Execute our visibility checks and scrolls
        return await callback();
    } finally {
        // 5. Restore content-visibility optimization, but delay it slightly if we 
        // need to hold the layout steady for a smooth scroll animation.
        setTimeout(() => {
            const prevCount = forceLayoutCounts.get(container) || 0;
            if (prevCount <= 1) {
                forceLayoutCounts.delete(container);
                container.classList.remove('pr-force-layout');
            } else {
                forceLayoutCounts.set(container, prevCount - 1);
            }
        }, 500); // 500ms covers the smooth scroll duration
    }
}
