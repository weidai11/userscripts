/**
 * Event delegation for Power Reader
 * Centralizes all event handling with a single delegation strategy
 */

import type { ReaderState } from '../state';
import { handleVoteInteraction } from './votes';
import { handleReactionVote, openReactionPicker } from './reactions';
import { attachHotkeyListeners } from './hotkeys';
import { handlePostCollapse,
  handlePostExpand,
  handleCommentCollapse,
  handleCommentExpand,
  handleCommentCollapseToggle,
  handleExpandPlaceholder,
  handleFindParent,
  handleAuthorUp,
  handleAuthorDown,
  handleReadMore,
  handleLoadPost,
  handleTogglePostBody,
  handleLoadAllComments,
  handleScrollToPostTop,
  handleScrollToComments,
  handleScrollToNextPost,
  handleLoadThread,
  handleLoadParents,
  handleLoadDescendants,
  handleScrollToRoot,
  handleLoadParentsAndScroll,
} from './navigation';
import { handleSendToAIStudio } from '../features/aiStudioPopup';
import { Logger } from '../utils/logger';


/**
 * Attach all event listeners using delegation
 */
export const attachEventListeners = (state: ReaderState): void => {
  const isHeaderInteractive = (el: HTMLElement): boolean => {
    return !!el.closest(
      '.pr-post-header a, .pr-author, .pr-vote-controls, .pr-reactions-container, .pr-reaction-chip, .pr-add-reaction-btn, .pr-vote-btn, .pr-author-controls, .pr-post-action'
    );
  };

  // Mousedown for vote interactions (need to track hold duration)
  document.addEventListener('mousedown', (e) => {
    Logger.debug(`document.mousedown: target=${(e.target as HTMLElement).tagName}.${(e.target as HTMLElement).className}`);
    const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement;
    if (!target) return;

    const action = target.dataset.action;
    if (!action) return;

    if (target.classList.contains('disabled')) {
      Logger.debug(`action ${action} is disabled, ignoring`);
      return;
    }

    Logger.debug(`Event: mousedown, action=${action}`);

    // Vote actions
    if (action === 'karma-up' || action === 'karma-down' || action === 'agree' || action === 'disagree') {
      handleVoteInteraction(target, action, state);
    }
    // Placeholder Logic (from SPEC.md)
    // - [PR-NEST-04] Missing Parent Placeholders: If a loaded comment references a parent comment that is not loaded, render an empty placeholder comment (no header or body) with a read-style border. This check must be re-applied any time comments are loaded or re-rendered.
    // - Thread Integrity With Placeholders: Thread structure must remain correct whether or not placeholders exist. Replies should nest under their true parent if loaded, or under the placeholder if the parent is missing.
    // Reaction vote
    else if (action === 'reaction-vote') {
      const commentId = target.dataset.commentId;
      const reactName = target.dataset.reactionName;
      if (commentId && reactName) {
        handleReactionVote(commentId, reactName, state);
      }
    }
    // Open reaction picker
    else if (action === 'open-picker') {
      e.stopPropagation();
      openReactionPicker(target, state);
    }
    // Post collapse/expand
    else if (action === 'collapse' && target.classList.contains('pr-post-toggle')) {
      e.stopPropagation();
      handlePostCollapse(target, state);
    }
    else if (action === 'expand' && target.classList.contains('pr-post-toggle')) {
      e.stopPropagation();
      handlePostExpand(target, state);
    }

    // Author preferences
    else if (action === 'author-up') {
      e.stopPropagation();
      handleAuthorUp(target, state);
    }
    else if (action === 'author-down') {
      e.stopPropagation();
      handleAuthorDown(target, state);
    }
    // Read more
    else if (action === 'read-more') {
      e.stopPropagation();
      handleReadMore(target);
    }
    // Load post
    else if (action === 'load-post') {
      e.preventDefault();
      e.stopPropagation();
      const post = target.closest('.pr-post') as HTMLElement;
      // Also check if we're in the sticky header
      const postId = post?.dataset.postId || target.closest('.pr-post-header')?.getAttribute('data-post-id');
      if (postId) {
        handleLoadPost(postId, target, state);
      }
    }
    // Post action buttons
    else if (action === 'toggle-post-body') {
      e.stopPropagation();
      handleTogglePostBody(target, state);
    }
    else if (action === 'load-all-comments') {
      e.stopPropagation();
      handleLoadAllComments(target, state);
    }
    else if (action === 'scroll-to-post-top') {
      e.stopPropagation();
      const rawTarget = e.target;
      if (rawTarget instanceof Element && isHeaderInteractive(rawTarget as HTMLElement)) return;
      handleScrollToPostTop(target, state);
    }
    else if (action === 'scroll-to-comments') {
      e.stopPropagation();
      handleScrollToComments(target);
    }
    else if (action === 'scroll-to-next-post') {
      e.stopPropagation();
      handleScrollToNextPost(target);
    }
    else if (action === 'send-to-ai-studio') {
      e.stopPropagation();
      handleSendToAIStudio(state, e.shiftKey);
    }
  });

  // Click for general interactions
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle thread line click (left border of replies)
    const replies = target.closest('.pr-replies');
    if (replies && target === replies) {
      e.stopPropagation();
      handleCommentCollapseToggle(replies as HTMLElement);
      return;
    }

    const actionTarget = target.closest('[data-action]') as HTMLElement;
    if (!actionTarget) return;

    const action = actionTarget.dataset.action;
    if (actionTarget.classList.contains('disabled')) return;

    if (action === 'collapse' && target.classList.contains('pr-collapse')) {
      handleCommentCollapse(target);
    } else if (action === 'expand' && target.classList.contains('pr-expand')) {
      handleCommentExpand(target);
    }
    else if (action === 'expand-placeholder') {
      e.preventDefault();
      e.stopPropagation();
      handleExpandPlaceholder(target, state);
    }
    // Find parent
    else if (action === 'find-parent') {
      e.preventDefault();
      e.stopPropagation();
      handleFindParent(target, state);
    }
    // Comment action buttons
    else if (action === 'load-thread') {
      e.preventDefault();
      e.stopPropagation();
      handleLoadThread(target, state);
    }
    else if (action === 'load-parents') {
      e.preventDefault();
      e.stopPropagation();
      handleLoadParents(target, state);
    }
    else if (action === 'load-descendants') {
      e.preventDefault();
      e.stopPropagation();
      handleLoadDescendants(target, state);
    }
    else if (action === 'scroll-to-root') {
      e.preventDefault();
      e.stopPropagation();
      handleScrollToRoot(target, state);
    }
    else if (action === 'load-parents-and-scroll') {
      e.preventDefault();
      e.stopPropagation();
      handleLoadParentsAndScroll(target, state);
    }
  });

  // Global inline reaction button click
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.id === 'pr-inline-react-btn') {
      if (state.currentSelection) {
        openReactionPicker(target, state, '');
      }
    }
  });

  // Track mouse position for AI Studio target identification
  document.addEventListener('mousemove', (e) => {
    state.lastMousePos.x = e.clientX;
    state.lastMousePos.y = e.clientY;
  }, { passive: true });

  attachHotkeyListeners(state);
};
