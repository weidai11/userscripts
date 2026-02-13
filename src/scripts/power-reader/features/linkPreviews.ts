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
  isElementFullyVisible,
} from '../utils/preview';

/**
 * Setup link previews for posts, comments, and wiki links
 */
export const setupLinkPreviews = (comments: Comment[]): void => {
  // Post titles & Headers
  const postHeaders = document.querySelectorAll('.pr-post-header') as NodeListOf<HTMLElement>;
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

            // Only skip preview if the post is COMPELTELY visible
            const body = post.querySelector('.pr-post-body-container') as HTMLElement;
            const collapsed = post.querySelector('.pr-post-body-container.collapsed');

            // If collapsed, it's not "completely visible" in the sense of seeing the content
            if (!body || collapsed) return null;

            // Check if both header and body (and thus the whole post) are fully visible
            // isElementFullyVisible on the post div covers this
            if (isElementFullyVisible(post)) {
              return [post]; // Returns for highlight purposes
            }

            return null; // Show preview
          }
        }
      );
    }
  });

  // Authors
  const authorLinks = document.querySelectorAll('.pr-author') as NodeListOf<HTMLElement>;
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
  const commentLinks = document.querySelectorAll('.pr-comment-body a') as NodeListOf<HTMLAnchorElement>;
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
  const parentLinks = document.querySelectorAll('.pr-find-parent') as NodeListOf<HTMLElement>;
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
              const post = document.querySelector(`.pr-post[data-id="${postId}"]`);
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
  const expandButtons = document.querySelectorAll('.pr-expand') as NodeListOf<HTMLElement>;
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
  const placeholderBars = document.querySelectorAll('.pr-placeholder-bar') as NodeListOf<HTMLElement>;
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
