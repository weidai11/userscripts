/**
 * Inline reactions feature for Power Reader
 * Allows users to select text and add reactions to specific quotes
 */

import type { ReaderState } from '../state';

/**
 * Setup inline reactions on text selection
 */
export const setupInlineReactions = (state: ReaderState): void => {
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    const existingBtn = document.getElementById('pr-inline-react-btn');

    // Validate selection
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      if (existingBtn && !document.getElementById('pr-global-reaction-picker')?.classList.contains('visible')) {
        existingBtn.remove();
        state.currentSelection = null;
      }
      return;
    }

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;

    // Ensure selection is inside a comment body
    const commentBody = (container.nodeType === 3 ? container.parentElement : container as HTMLElement)?.closest('.pr-comment-body');
    if (!commentBody) {
      if (existingBtn) existingBtn.remove();
      return;
    }

    // Store selection
    const text = selection.toString().slice(0, 500);
    state.currentSelection = { text, range };

    // Show floating button
    if (!existingBtn) {
      const btn = document.createElement('div');
      btn.id = 'pr-inline-react-btn';
      btn.className = 'pr-inline-react-btn';
      btn.textContent = 'React';
      btn.dataset.commentId = commentBody.closest('.pr-comment')?.getAttribute('data-id') || '';
      document.body.appendChild(btn);

      const rect = range.getBoundingClientRect();
      btn.style.top = `${rect.top - 30 + window.scrollY}px`;
      btn.style.left = `${rect.left + (rect.width / 2)}px`;
    } else {
      const rect = range.getBoundingClientRect();
      existingBtn.style.top = `${rect.top - 30 + window.scrollY}px`;
      existingBtn.style.left = `${rect.left + (rect.width / 2)}px`;
      existingBtn.dataset.commentId = commentBody.closest('.pr-comment')?.getAttribute('data-id') || '';
    }
  });
};
