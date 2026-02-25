/**
 * Link preview feature for Power Reader
 * Adds hover previews for post titles, comment links, and parent links
 */

import type { Comment } from '../../../shared/graphql/queries';
import {
  setupHoverPreview,
  createPostPreviewFetcher,
  createCommentPreviewFetcher,
  createWikiPreviewFetcher,
  createAuthorPreviewFetcher,
  createAuthorBySlugPreviewFetcher,
  extractCommentIdFromUrl,
  extractPostIdFromUrl,
  extractAuthorSlugFromUrl,
  extractWikiSlugFromUrl,
  isCommentUrl,
  isPostUrl,
  isAuthorUrl,
  isWikiUrl,
  cancelHoverTimeout,
} from '../utils/preview';

/**
 * Setup link previews using event delegation on a container.
 * More efficient for large lists (Archive).
 */
export const setupLinkPreviewsDelegated = (container: HTMLElement, comments: Comment[]): void => {
  if ((container as any).__PR_PREVIEWS_DELEGATED__) return;
  (container as any).__PR_PREVIEWS_DELEGATED__ = true;

  container.addEventListener('mouseover', (e) => {
    const target = e.target as HTMLElement;
    if (!target || target.dataset.previewAttached) return;

    // 1. Post titles
    const postHeader = target.closest('.pr-post-header h2') as HTMLElement;
    if (postHeader) {
      const headerDiv = postHeader.closest('.pr-post-header');
      const postId = headerDiv?.getAttribute('data-post-id');
      if (postId) {
        setupHoverPreview(postHeader, createPostPreviewFetcher(postId), {
          type: 'post',
          targetGetter: () => {
            const post = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement;
            if (!post) return null;
            const body = post.querySelector('.pr-post-body-container') as HTMLElement;
            const collapsed = post.querySelector('.pr-post-body-container.collapsed');
            if (!body || collapsed) return null;
            return [post];
          }
        });
        // Manually trigger the hover logic for the first time since mouseover already happened
        // Note: setupHoverPreview adds its own listeners, so we just need to ensure 
        // the next movement triggers it or wait for the system to catch it.
      }
      return;
    }

    // 2. Authors
    const authorLink = target.closest('.pr-author') as HTMLElement;
    if (authorLink) {
      const userId = authorLink.getAttribute('data-author-id');
      if (userId) {
        setupHoverPreview(authorLink, createAuthorPreviewFetcher(userId), { type: 'author' });
      }
      return;
    }

    // 3. Parent links
    const parentLink = target.closest('.pr-find-parent') as HTMLElement;
    if (parentLink) {
      const comment = parentLink.closest('.pr-comment');
      const parentId = comment?.getAttribute('data-parent-id');
      if (parentId) {
        setupHoverPreview(parentLink, createCommentPreviewFetcher(parentId, comments), {
          type: 'comment',
          targetGetter: () => document.querySelector(`.pr-comment[data-id="${parentId}"]`) as HTMLElement
        });
      } else {
        const postId = comment?.getAttribute('data-post-id');
        if (postId) {
          setupHoverPreview(parentLink, createPostPreviewFetcher(postId), {
            type: 'post',
            targetGetter: () => {
              const post = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement;
              if (!post) return null;
              const header = post.querySelector('.pr-post-header') as HTMLElement;
              const body = post.querySelector('.pr-post-body-container') as HTMLElement;
              const collapsed = post.querySelector('.pr-post-body-container.collapsed');
              const targets: HTMLElement[] = [];

              if (header) targets.push(header);
              if (body && !collapsed) targets.push(body);
              const stickyHeader = document.querySelector(`.pr-sticky-header.visible .pr-post-header[data-post-id="${postId}"]`) as HTMLElement;
              if (stickyHeader) targets.push(stickyHeader);
              
              return targets.length > 0 ? targets : null;
            }
          });
        }
      }
      return;
    }

    // 4. Body links
    const bodyLink = target.closest('.pr-comment-body a, .pr-post-body a') as HTMLAnchorElement;
    if (bodyLink) {
      const href = bodyLink.getAttribute('href');
      if (href) {
        if (isCommentUrl(href)) {
          const id = extractCommentIdFromUrl(href);
          if (id) setupHoverPreview(bodyLink, createCommentPreviewFetcher(id, comments), { type: 'comment' });
        } else if (isPostUrl(href)) {
          const id = extractPostIdFromUrl(href);
          if (id) setupHoverPreview(bodyLink, createPostPreviewFetcher(id), { type: 'post' });
        } else if (isAuthorUrl(href)) {
          const slug = extractAuthorSlugFromUrl(href);
          if (slug) setupHoverPreview(bodyLink, createAuthorBySlugPreviewFetcher(slug), { type: 'author' });
        } else if (isWikiUrl(href)) {
          const slug = extractWikiSlugFromUrl(href);
          if (slug) setupHoverPreview(bodyLink, createWikiPreviewFetcher(slug), { type: 'wiki' });
        }
      }
      return;
    }

    // 5. Expanders and Placeholders
    const expander = target.closest('.pr-expand, .pr-placeholder-bar') as HTMLElement;
    if (expander) {
      const comment = expander.closest('.pr-comment');
      const commentId = comment?.getAttribute('data-id');
      if (commentId) {
        setupHoverPreview(expander, createCommentPreviewFetcher(commentId, comments), {
          type: 'comment',
          targetGetter: () => document.querySelector(`.pr-comment[data-id="${commentId}"]`) as HTMLElement
        });
      }
    }
  });
};

/**
 * Setup link previews for posts, comments, and wiki links
 */
export const setupLinkPreviews = (comments: Comment[], container: HTMLElement | Document = document): void => {
  // Post titles & Headers
  const postHeaders = container.querySelectorAll('.pr-post-header') as NodeListOf<HTMLElement>;
  postHeaders.forEach(header => {
    const postId = header.getAttribute('data-post-id');
    if (!postId) return;

    // Trigger on the h2 (which includes title and whitespace to the right)
    const titleH2 = header.querySelector('h2') as HTMLElement;
    if (titleH2) {
        setupHoverPreview(
        titleH2,
        createPostPreviewFetcher(postId),
        {
          type: 'post',
          targetGetter: () => {
            const post = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement;
            if (!post) return null;

            // Only skip preview if the post is COMPLETELY visible
            const body = post.querySelector('.pr-post-body-container') as HTMLElement;
            const collapsed = post.querySelector('.pr-post-body-container.collapsed');

            // If collapsed, it's not "completely visible" in the sense of seeing the content
            if (!body || collapsed) return null;

            return [post];
          }
        }
      );
    }
  });

  // Authors
  const authorLinks = container.querySelectorAll('.pr-author') as NodeListOf<HTMLElement>;
  authorLinks.forEach(link => {
    const userId = link.getAttribute('data-author-id');
    if (userId) {
      setupHoverPreview(
        link,
        createAuthorPreviewFetcher(userId),
        { type: 'author' }
      );
    }
  });

  // Comment links
  const commentLinks = container.querySelectorAll('.pr-comment-body a') as NodeListOf<HTMLAnchorElement>;
  commentLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    // 1. Comment links
    if (isCommentUrl(href)) {
      const commentId = extractCommentIdFromUrl(href);
      if (commentId) {
        setupHoverPreview(
          link,
          createCommentPreviewFetcher(commentId, comments),
          { type: 'comment' }
        );
        return;
      }
    }

    // 2. Post links
    if (isPostUrl(href)) {
      const postId = extractPostIdFromUrl(href);
      if (postId) {
        setupHoverPreview(
          link,
          createPostPreviewFetcher(postId),
          { type: 'post' }
        );
        return;
      }
    }

    // 3. Author links
    if (isAuthorUrl(href)) {
      const authorSlug = extractAuthorSlugFromUrl(href);
      if (authorSlug) {
        setupHoverPreview(
          link,
          createAuthorBySlugPreviewFetcher(authorSlug),
          { type: 'author' }
        );
        return;
      }
    }

    // 4. Wiki links
    if (isWikiUrl(href)) {
      const wikiSlug = extractWikiSlugFromUrl(href);
      if (wikiSlug) {
        setupHoverPreview(
          link,
          createWikiPreviewFetcher(wikiSlug),
          { type: 'wiki' }
        );
      }
    }
  });

  // Parent links
  const parentLinks = container.querySelectorAll('.pr-find-parent') as NodeListOf<HTMLElement>;
  parentLinks.forEach(link => {
    const comment = link.closest('.pr-comment');
    const parentId = comment?.getAttribute('data-parent-id');

    if (parentId) {
      setupHoverPreview(
        link,
        createCommentPreviewFetcher(parentId, comments),
        {
          type: 'comment',
          targetGetter: () => document.querySelector(`.pr-comment[data-id="${parentId}"]`) as HTMLElement
        }
      );
    } else {
      // No parent ID means top-level comment -> parent is Post
      const postId = comment?.getAttribute('data-post-id');
      if (postId) {
          setupHoverPreview(
          link,
          createPostPreviewFetcher(postId),
          {
            type: 'post',
            targetGetter: () => {
              const post = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement;
              if (!post) return null;

              const header = post.querySelector('.pr-post-header') as HTMLElement;
              const body = post.querySelector('.pr-post-body-container') as HTMLElement;
              const collapsed = post.querySelector('.pr-post-body-container.collapsed');

              const targets: HTMLElement[] = [];
              if (header) targets.push(header);

              // Only add body as highlight target if it exists and isn't collapsed
              if (body && !collapsed) {
                targets.push(body);
              }

              // Always try to include the sticky header if it's currently showing this post
              const stickyHeader = document.querySelector(`.pr-sticky-header.visible .pr-post-header[data-post-id="${postId}"]`) as HTMLElement;
              if (stickyHeader) targets.push(stickyHeader);

              return targets.length > 0 ? targets : null;
            }
          }
        );
      }
    }

    // Add click handler to cancel pending preview triggers
    link.addEventListener('click', () => {
      cancelHoverTimeout();
    });
  });

  // Collapsed Comment Expanders
  const expandButtons = container.querySelectorAll('.pr-expand') as NodeListOf<HTMLElement>;
  expandButtons.forEach(btn => {
    const comment = btn.closest('.pr-comment');
    const commentId = comment?.getAttribute('data-id');
    if (commentId) {
      setupHoverPreview(
        btn,
        createCommentPreviewFetcher(commentId, comments),
        { type: 'comment' }
      );
    }
  });

  // Collapsed Placeholder Bars
  const placeholderBars = container.querySelectorAll('.pr-placeholder-bar') as NodeListOf<HTMLElement>;
  placeholderBars.forEach(bar => {
    const comment = bar.closest('.pr-comment');
    const commentId = comment?.getAttribute('data-id');
    if (commentId) {
      setupHoverPreview(
        bar,
        createCommentPreviewFetcher(commentId, comments),
        { type: 'comment' }
      );
    }
  });
};
