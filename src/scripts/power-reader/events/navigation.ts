/**
 * Navigation event handlers for Power Reader
 * Handles collapse/expand, find parent, read more, load post
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
import { rebuildIndexes } from '../state';
import { toggleAuthorPreference } from '../utils/storage';
import { renderPostGroup } from '../render/post';
import { renderUI } from '../render/index';
import { setupLinkPreviews } from '../features/linkPreviews';
import { Logger } from '../utils/logger';
import { smartScrollTo, refreshPostActionButtons } from '../utils/dom';
import { CONFIG } from '../config';
import { isElementFullyVisible } from '../utils/preview';

/**
 * Collapse a post's content - shared logic for both regular and sticky headers
 */
export const collapsePost = (post: Element): void => {
  post.querySelector('.pr-post-comments')?.classList.add('collapsed');
  post.querySelector('.pr-post-content')?.classList.add('collapsed');

  syncPostToggleButtons(post, true);
};

/**
 * Expand a post's content - shared logic for both regular and sticky headers
 */
export const expandPost = (post: Element): void => {
  post.querySelector('.pr-post-comments')?.classList.remove('collapsed');
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
 * Handle post collapse from click event (finds post from target)
 */
export const handlePostCollapse = (target: HTMLElement, _state: ReaderState): void => {
  const postId = getPostIdFromTarget(target);
  if (!postId) return;
  const post = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement;
  if (!post) return;

  const isFromSticky = !!target.closest('.pr-sticky-header');
  let headerTop: number | null = null;

  if (isFromSticky) {
    const postHeader = post.querySelector('.pr-post-header') as HTMLElement;
    if (postHeader) {
      headerTop = postHeader.getBoundingClientRect().top + window.pageYOffset;
    }
  }

  collapsePost(post);

  if (headerTop !== null) {
    window.scrollTo({
      top: headerTop,
      behavior: (window as any).__PR_TEST_MODE__ ? 'instant' : 'smooth' as ScrollBehavior
    });
  }
};

/**
 * Handle post expand from click event (finds post from target)
 */
export const handlePostExpand = (target: HTMLElement, _state: ReaderState): void => {
  const postId = getPostIdFromTarget(target);
  if (!postId) return;
  const post = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement;
  if (!post) return;

  const isFromSticky = !!target.closest('.pr-sticky-header');

  expandPost(post);

  if (isFromSticky) {
    const postHeader = post.querySelector('.pr-post-header') as HTMLElement;
    if (postHeader) {
      const headerTop = postHeader.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: headerTop,
        behavior: (window as any).__PR_TEST_MODE__ ? 'instant' : 'smooth' as ScrollBehavior
      });
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

  reRenderPostGroup(postId, state, commentId);

  // Clear justRevealed after animation
  setTimeout(() => {
    if (comment) (comment as any).justRevealed = false;
  }, 2000);
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
 * Handle find parent navigation
 */
export const handleFindParent = async (target: HTMLElement, state: ReaderState): Promise<void> => {
  const commentEl = target.closest('.pr-comment');
  const parentId = commentEl?.getAttribute('data-parent-id');

  // Case 1: Top-level comment -> Navigate to Post
  if (!parentId) {
    const postId = commentEl?.getAttribute('data-post-id');
    if (!postId) return;

    const postEl = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement;
    if (postEl) {
      const postHeader = postEl.querySelector('.pr-post-header') as HTMLElement;
      const postBody = postEl.querySelector('.pr-post-body-container') as HTMLElement;
      const stickyHeader = document.querySelector(`.pr-sticky-header .pr-post-header[data-post-id="${postId}"]`) as HTMLElement;

      if (postHeader) smartScrollTo(postHeader, true);

      const targets = [postHeader, postBody, stickyHeader].filter(Boolean) as HTMLElement[];
      targets.forEach(t => t.classList.add('pr-highlight-parent'));
      setTimeout(() => targets.forEach(t => t.classList.remove('pr-highlight-parent')), 2000);
    }
    return;
  }

  // Case 2: Nested comment -> Existing logic
  const parentEl = document.querySelector(`.pr-comment[data-id="${parentId}"]`) as HTMLElement;
  const isReadPlaceholder = parentEl?.classList.contains('pr-comment-placeholder');
  const parentIsPlaceholder = !!parentEl?.dataset.placeholder || parentEl?.classList.contains('pr-missing-parent') || isReadPlaceholder;

  if (parentEl && !parentIsPlaceholder) {
    smartScrollTo(parentEl, false);
    parentEl.classList.add('pr-highlight-parent');
    setTimeout(() => parentEl.classList.remove('pr-highlight-parent'), 2000);
  } else if (parentEl && isReadPlaceholder) {
    // Parent is in DOM but minimized as a read placeholder - expand it!
    const postId = commentEl?.getAttribute('data-post-id');
    const comment = state.commentById.get(parentId);
    if (comment && postId) {
      markAncestorChainForceVisible(parentId, state);
      reRenderPostGroup(postId, state, parentId);

      const newParentEl = document.querySelector(`.pr-comment[data-id="${parentId}"]`) as HTMLElement;
      if (newParentEl) {
        smartScrollTo(newParentEl, false);
        newParentEl.classList.add('pr-highlight-parent');
        setTimeout(() => newParentEl.classList.remove('pr-highlight-parent'), 2000);
      }
    }
  } else {
    // Parent not in DOM, try to fetch and inject
    const originalText = target.textContent;
    target.textContent = '[...]';

    try {
      Logger.info(`Find Parent: Fetching missing parent ${parentId} from server...`);
      const res = await queryGraphQL<GetCommentQuery, GetCommentQueryVariables>(GET_COMMENT, { id: parentId });
      const parentComment = res?.comment?.result as unknown as Comment;

      if (parentComment) {
        // Add to state if not present
        if (!state.commentById.has(parentComment._id)) {
          (parentComment as any).isContext = true;
          (parentComment as any).forceVisible = true;
          (parentComment as any).justRevealed = true;
          state.comments.push(parentComment);
          rebuildIndexes(state);

          // Find the post group container to re-render it
          const postId = parentComment.postId;
          if (postId) {
            const postContainer = document.querySelector(`.pr-post[data-id="${postId}"]`);

            if (postContainer) {
              Logger.info(`Re-rendering post group ${postId}. Parent ${parentComment._id} present in state? ${state.commentById.has(parentComment._id)}`);
              const group = {
                postId: postId,
                title: parentComment.post?.title || 'Unknown Post',
                comments: state.comments.filter(c => c.postId === postId),
                fullPost: state.postById.get(postId)
              };
              postContainer.outerHTML = renderPostGroup(group, state);

              // Re-attach hover previews on the new DOM elements
              setupLinkPreviews(state.comments);

              // After re-render, scroll to the parent
              setTimeout(() => {
                const newParentEl = document.querySelector(`.pr-comment[data-id="${parentId}"]`) as HTMLElement;
                if (newParentEl) {
                  smartScrollTo(newParentEl, false);
                  newParentEl.classList.add('pr-highlight-parent');
                  setTimeout(() => newParentEl.classList.remove('pr-highlight-parent'), 2000);
                }
              }, 50);
            } else {
              // Post group not found? This shouldn't happen if child is visible,
              // but fallback to full UI render if it does.
              renderUI(state);
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
    }
  }
};

/**
 * Handle author preference up
 */
export const handleAuthorUp = (target: HTMLElement, state: ReaderState): void => {
  const item = target.closest('.pr-item');
  let author = item?.getAttribute('data-author');

  if (!author) {
    const sticky = target.closest('.pr-sticky-header');
    author = sticky?.getAttribute('data-author');
  }

  if (author) {
    toggleAuthorPreference(author, 'up');
    renderUI(state);
  }
};

/**
 * Handle author preference down
 */
export const handleAuthorDown = (target: HTMLElement, state: ReaderState): void => {
  const item = target.closest('.pr-item');
  let author = item?.getAttribute('data-author');

  if (!author) {
    const sticky = target.closest('.pr-sticky-header');
    author = sticky?.getAttribute('data-author');
  }

  if (author) {
    toggleAuthorPreference(author, 'down');
    renderUI(state);
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
  }
};

const reRenderPostGroup = (
  postId: string,
  state: ReaderState,
  anchorCommentId?: string
): void => {
  const postContainer = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement;
  if (!postContainer) {
    Logger.warn(`reRenderPostGroup: Container for post ${postId} not found`);
    return;
  }

  let beforeTop: number | null = null;
  if (anchorCommentId) {
    const anchorEl = postContainer.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`) as HTMLElement;
    if (anchorEl) beforeTop = anchorEl.getBoundingClientRect().top;
  }

  const post = state.postById.get(postId);
  const postComments = state.comments.filter(c => c.postId === postId);
  Logger.info(`reRenderPostGroup: p=${postId}, comments=${postComments.length}`);

  const group = {
    postId,
    title: post?.title || postComments.find(c => c.post?.title)?.post?.title || 'Unknown Post',
    comments: postComments,
    fullPost: post,
  };
  postContainer.outerHTML = renderPostGroup(group, state);
  setupLinkPreviews(state.comments);
  refreshPostActionButtons(postId);

  if (anchorCommentId && beforeTop !== null) {
    const newAnchor = document.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`) as HTMLElement;
    if (newAnchor) {
      const afterTop = newAnchor.getBoundingClientRect().top;
      const delta = afterTop - beforeTop;
      const oldScrollY = window.scrollY;
      Logger.info(`Viewport Preservation [${anchorCommentId}]: beforeTop=${beforeTop.toFixed(2)}, afterTop=${afterTop.toFixed(2)}, delta=${delta.toFixed(2)}, oldScrollY=${oldScrollY.toFixed(2)}`);
      window.scrollTo(0, Math.max(0, oldScrollY + delta));
      Logger.info(`New ScrollY: ${window.scrollY.toFixed(2)}`);
    }
  }
};

const mergeComments = (newComments: Comment[], state: ReaderState, markAsContext: boolean = true): number => {
  let added = 0;
  for (const c of newComments) {
    if (!state.commentById.has(c._id)) {
      if (markAsContext) (c as any).isContext = true;
      state.comments.push(c);
      added++;
    }
  }
  if (added > 0) rebuildIndexes(state);
  return added;
};

const getPostIdFromTarget = (target: HTMLElement): string | null => {
  const post = target.closest('.pr-post') as HTMLElement;
  if (post) return post.dataset.postId || null;
  const header = target.closest('.pr-post-header') as HTMLElement;
  return header?.getAttribute('data-post-id') || null;
};

const getCommentIdFromTarget = (target: HTMLElement): string | null => {
  const comment = target.closest('.pr-comment') as HTMLElement;
  return comment?.getAttribute('data-id') || null;
};

const findTopLevelAncestorId = (commentId: string, state: ReaderState): string | null => {
  let current = state.commentById.get(commentId);
  if (!current) return null;

  const visited = new Set<string>();
  while (current) {
    if (visited.has(current._id)) break;
    visited.add(current._id);
    if (!current.parentCommentId) return current._id;
    const parent = state.commentById.get(current.parentCommentId);
    if (!parent) return null; // Chain is broken in local state
    current = parent;
  }
  return null;
};

const markAncestorChainForceVisible = (commentId: string, state: ReaderState): void => {
  let currentId: string | null = commentId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const comment = state.commentById.get(currentId);
    if (!comment) break;

    (comment as any).forceVisible = true;
    (comment as any).justRevealed = true;

    currentId = comment.parentCommentId || null;
  }
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
    const res = await queryGraphQL<GetPostQuery, GetPostQueryVariables>(GET_POST_BY_ID, { id: postId });
    const post = res?.post?.result as unknown as Post;

    if (post) {
      // Update state (avoid duplicate)
      if (!state.postById.has(post._id)) {
        state.posts.push(post);
      } else {
        // Replace existing sparse post with full post
        const idx = state.posts.findIndex(p => p._id === post._id);
        if (idx >= 0) state.posts[idx] = post;
      }
      rebuildIndexes(state);

      // Remove data-action to prevent re-loading
      titleLink.removeAttribute('data-action');

      // Re-render the whole post group
      const group = {
        postId: post._id,
        title: post.title,
        comments: state.comments.filter(c => c.postId === post._id),
        fullPost: post
      };

      postContainer.outerHTML = renderPostGroup(group, state);

      // Re-attach hover previews on the new DOM elements
      setupLinkPreviews(state.comments);
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

  // Find the actual button to update its text/title
  const eBtn = postEl.querySelector('[data-action="toggle-post-body"]') as HTMLElement;

  // Sticky Header Logic: If clicked from sticky header, also scroll back to post
  const isFromSticky = !!target.closest('.pr-sticky-header');

  let container = postEl.querySelector('.pr-post-body-container') as HTMLElement;

  // If container doesn't exist, we need to load the post body first
  if (!container) {
    if (eBtn) eBtn.textContent = '[...]';
    try {
      const res = await queryGraphQL<GetPostQuery, GetPostQueryVariables>(GET_POST_BY_ID, { id: postId });
      const post = res?.post?.result;
      if (!post || !post.htmlBody) {
        Logger.warn(`Post ${postId} has no body content`);
        if (eBtn) eBtn.textContent = '[e]';
        return;
      }

      // Update state with full post data
      state.postById.set(postId, post as Post);
      // Also update posts array if the post exists there
      const postIdx = state.posts.findIndex((p: Post) => p._id === postId);
      if (postIdx >= 0) {
        state.posts[postIdx] = post as Post;
      } else {
        state.posts.push(post as Post);
      }

      // Re-render just this post group
      reRenderPostGroup(postId, state);

      // Get the newly rendered container
      container = document.querySelector(`.pr-post[data-id="${postId}"] .pr-post-body-container`) as HTMLElement;
      if (container) {
        // Expand it immediately
        container.classList.remove('truncated');
        container.style.maxHeight = 'none';
        const overlay = container.querySelector('.pr-read-more-overlay') as HTMLElement;
        if (overlay) overlay.style.display = 'none';
      }

      // Update button state
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
    if (eBtn) eBtn.title = 'Collapse post body';
  } else {
    container.classList.add('truncated');
    container.style.maxHeight = CONFIG.maxPostHeight;
    const overlay = container.querySelector('.pr-read-more-overlay') as HTMLElement;
    if (overlay) overlay.style.display = 'flex';
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
    const comments = res?.comments?.results || [];
    const added = mergeComments(comments as Comment[], state, false); // Load all should show them full
    Logger.info(`Load all comments for post ${postId}: ${comments.length} fetched, ${added} new`);

    // Always re-render or at least refresh buttons to clear loading state
    reRenderPostGroup(postId, state);

    if (added === 0) {
      Logger.info(`No new comments found for post ${postId}`);
    }
  } catch (err) {
    Logger.error('Failed to load all comments', err);
  } finally {
    target.textContent = originalText;
  }
};

export const handleScrollToPostTop = (target: HTMLElement, state: ReaderState): void => {
  const postId = getPostIdFromTarget(target);
  if (!postId) return;
  const postHeader = document.querySelector(`.pr-post[data-id="${postId}"] .pr-post-header`) as HTMLElement;
  if (postHeader) {
    const headerTop = postHeader.getBoundingClientRect().top + window.pageYOffset;
    const currentScroll = window.pageYOffset;

    // If already at the top (within 5px tolerance), toggle expansion
    if (Math.abs(headerTop - currentScroll) < 5) {
      // Find the [e] button and trigger it if it exists and isn't disabled
      const eBtn = postHeader.querySelector('[data-action="toggle-post-body"]') as HTMLElement;
      if (eBtn && !eBtn.classList.contains('disabled')) {
        handleTogglePostBody(eBtn, state).then(() => {
          // Re-scroll to ensure we are still at the top after expansion/load
          const refreshedTop = postHeader.getBoundingClientRect().top + window.pageYOffset;
          window.scrollTo({
            top: refreshedTop,
            behavior: (window as any).__PR_TEST_MODE__ ? 'instant' : 'smooth' as ScrollBehavior
          });
        });
        return;
      }
    }

    // Otherwise, scroll to top
    window.scrollTo({
      top: headerTop,
      behavior: (window as any).__PR_TEST_MODE__ ? 'instant' : 'smooth' as ScrollBehavior
    });
  }
};

export const handleScrollToComments = (target: HTMLElement): void => {
  const postId = getPostIdFromTarget(target);
  if (!postId) return;
  const postEl = document.querySelector(`.pr-post[data-id="${postId}"]`);
  if (!postEl) return;
  const firstComment = postEl.querySelector('.pr-comment') as HTMLElement;
  if (firstComment) smartScrollTo(firstComment, false);
};

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
          // Already loaded — keep walking up to find more gaps
          currentParentId = existing.parentCommentId || null;
          continue;
        }
        const res = await queryGraphQL<GetCommentQuery, GetCommentQueryVariables>(GET_COMMENT, { id: currentParentId });
        const parent = res?.comment?.result as unknown as Comment;
        if (!parent) break;
        (parent as any).isContext = true;
        state.comments.push(parent);
        rebuildIndexes(state);
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
    const added = mergeComments(comments as Comment[], state);
    Logger.info(`Load thread ${topLevelId}: ${comments.length} fetched, ${added} new`);
    if (added > 0 && comment.postId) {
      reRenderPostGroup(comment.postId, state, commentId);
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

    const added = mergeComments(fetched, state);
    Logger.info(`Load parents for ${commentId}: ${fetched.length} fetched, ${added} new`);

    // Mark all fetched parents as forceVisible to prevent placeholder collapse
    for (const f of fetched) {
      (f as any).forceVisible = true;
      (f as any).justRevealed = true;
    }
    if (comment) {
      (comment as any).forceVisible = true;
      (comment as any).justRevealed = true;
    }

    if (added > 0 && comment.postId) {
      reRenderPostGroup(comment.postId, state, commentId);
    }

    // Clear justRevealed after animation
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

    // If ancestry is incomplete locally, walk up via GetComment first so thread load uses true root.
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
        (parent as any).isContext = true;
        state.comments.push(parent);
        rebuildIndexes(state);
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

    // [r] is an explicit "show me replies" action; keep fetched thread comments expanded.
    fetchedComments.forEach((c) => {
      (c as any).forceVisible = true;
      (c as any).justRevealed = true;
    });

    const added = mergeComments(fetchedComments, state);

    fetchedComments.forEach((c) => {
      const inState = state.commentById.get(c._id);
      if (inState) {
        (inState as any).forceVisible = true;
        (inState as any).justRevealed = true;
      }
    });

    Logger.info(`Load descendants for ${commentId}: ${fetchedComments.length} fetched, ${added} new`);
    if ((added > 0 || fetchedComments.length > 0) && comment.postId) {
      reRenderPostGroup(comment.postId, state, commentId);
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

export const handleScrollToRoot = (target: HTMLElement, state: ReaderState): void => {
  const commentId = getCommentIdFromTarget(target);
  if (!commentId) return;

  const topLevelId = findTopLevelAncestorId(commentId, state);

  if (topLevelId) {
    const rootEl = document.querySelector(`.pr-comment[data-id="${topLevelId}"]`) as HTMLElement;
    if (rootEl) {
      smartScrollTo(rootEl, false);
      rootEl.classList.add('pr-highlight-parent');
      setTimeout(() => rootEl.classList.remove('pr-highlight-parent'), 2000);
      return;
    }
  }

  const comment = state.commentById.get(commentId);
  if (comment?.postId) {
    const postHeader = document.querySelector(`.pr-post[data-id="${comment.postId}"] .pr-post-header`) as HTMLElement;
    if (postHeader) {
      smartScrollTo(postHeader, true);
      postHeader.classList.add('pr-highlight-parent');
      setTimeout(() => postHeader.classList.remove('pr-highlight-parent'), 2000);
    }
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
      // Re-render once if root was a placeholder or intermediate parents were placeholders
      // (Since we marked all ancestors as forceVisible above, we need at least one re-render)
      const comment = state.commentById.get(commentId);
      if (comment?.postId) {
        reRenderPostGroup(comment.postId, state, commentId);
        rootEl = document.querySelector(`.pr-comment[data-id="${topLevelId}"]`) as HTMLElement;
      }

      if (!rootEl) return;

      // Wait one animation frame so the browser paints the freshly-inserted DOM.
      // Without this, elementFromPoint (used by isElementFullyVisible) can report
      // newly-inserted elements as obscured because the layout hasn't been flushed.
      await new Promise(resolve => requestAnimationFrame(resolve));

      const isVisible = isElementFullyVisible(rootEl);

      if (!isVisible) {
        // Not visible or was just loaded and preserved current comment off-screen from root
        smartScrollTo(rootEl, false);
      } else {
        // Root is visible! No need to scroll, just highlight.
        Logger.info(`Trace to Root: Root ${topLevelId} already visible, skipping scroll.`);
      }

      rootEl.classList.add('pr-highlight-parent');
      setTimeout(() => rootEl.classList.remove('pr-highlight-parent'), 2000);
      return;
    }
  }

  // Fallback to post header if root still missing or is the post itself
  handleScrollToRoot(target, state);
};
