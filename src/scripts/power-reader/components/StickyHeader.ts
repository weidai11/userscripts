import {
    setupHoverPreview,
    createPostPreviewFetcher,
    createAuthorPreviewFetcher
} from '../utils/preview';
import { renderPostHeader } from '../utils/rendering';
import { getState } from '../state';

/**
 * Encapsulated Sticky Header Component
 */
export class StickyHeader {
    private container: HTMLElement | null = null;
    private lastPostId: string | null = null;
    private isVisible: boolean = false;

    constructor() {
        this.container = document.getElementById('pr-sticky-header');
    }

    /**
     * Initialize the scroll listener for sticky header behavior
     */
    public init() {
        if (!this.container) {
            console.warn('[StickyHeader] Container not found');
            return;
        }

        window.addEventListener('scroll', () => this.handleScroll(), { passive: true });
    }

    /**
     * Force a re-render of the current sticky header content (e.g. after preference change)
     */
    public refresh() {
        if (!this.container || !this.lastPostId || !this.isVisible) return;
        this.render(this.lastPostId, null as any); // Render will fetch from state
    }

    private handleScroll() {
        if (!this.container) return;

        // Optimization: Use elementFromPoint to find the post at the top of viewport
        // instead of querySelectorAll + looping through thousands of items.
        // We check a point slightly below the top (e.g. 80px) to account for header areas.
        const viewportWidth = window.innerWidth;
        const checkY = 80;
        const elementAtPoint = document.elementFromPoint(viewportWidth / 2, checkY);
        
        if (!elementAtPoint) {
            this.hide();
            return;
        }

        const currentPost = elementAtPoint.closest('.pr-post') as HTMLElement;

        if (currentPost) {
            // Only activate sticky if the regular header is actually off-screen (scrolled past)
            const header = currentPost.querySelector('.pr-post-header') as HTMLElement;
            if (header) {
                const headerRect = header.getBoundingClientRect();
                if (headerRect.top < -1) {
                    this.updateHeaderContent(currentPost);
                    return;
                }
            }
        }
        
        this.hide();
    }

    private updateHeaderContent(currentPost: HTMLElement) {
        if (!this.container) return;

        const postId = currentPost.getAttribute('data-post-id') || '';

        // If post ID changed or not visible, update
        if (postId !== this.lastPostId || !this.isVisible) {
            this.lastPostId = postId;
            this.render(postId, currentPost);
            this.show();
        }
    }

    private render(postId: string, currentPost: HTMLElement) {
        if (!this.container) return;

        const state = getState();
        const post = state.postById.get(postId);
        if (!post) return;

        const isFullPost = !!(post.htmlBody);

        this.container.innerHTML = renderPostHeader(post, {
            isSticky: true,
            isFullPost: isFullPost,
            state: state
        });

        this.container.setAttribute('data-author', post.user?.username || '');

        const newHeader = this.container.querySelector('.pr-post-header') as HTMLElement;
        const titleH2 = newHeader.querySelector('h2') as HTMLElement;
        const authorLink = newHeader.querySelector('.pr-author') as HTMLElement;

        // Sync toggle buttons to match the main post's collapsed state
        const postEl = currentPost || (document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement | null);
        const isCollapsed = !!postEl?.querySelector('.pr-post-comments.collapsed, .pr-post-content.collapsed');
        if (newHeader) {
            const collapseBtn = newHeader.querySelector('[data-action="collapse"]') as HTMLElement;
            const expandBtn = newHeader.querySelector('[data-action="expand"]') as HTMLElement;
            if (collapseBtn) collapseBtn.style.display = isCollapsed ? 'none' : 'inline';
            if (expandBtn) expandBtn.style.display = isCollapsed ? 'inline' : 'none';

            const nBtn = newHeader.querySelector('[data-action="scroll-to-next-post"]') as HTMLElement;
            if (nBtn) {
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
            }
        }

        // Add hover preview to sticky header title (and whitespace)
        if (titleH2 && postId) {
            setupHoverPreview(
                titleH2,
                createPostPreviewFetcher(postId),
                { type: 'post' }
            );
        }

        // Hover preview for author in sticky header
        if (authorLink) {
            const userId = authorLink.getAttribute('data-author-id');
            if (userId) {
                setupHoverPreview(
                    authorLink,
                    createAuthorPreviewFetcher(userId),
                    { type: 'author' }
                );
            }
        }
    }

    private show() {
        if (this.container) {
            this.container.classList.add('visible');
            this.isVisible = true;
        }
    }

    private hide() {
        if (this.container && this.isVisible) {
            this.lastPostId = null;
            this.container.classList.remove('visible');
            this.isVisible = false;
        }
    }
}
