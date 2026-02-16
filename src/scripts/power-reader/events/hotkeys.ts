
/**
 * Hotkey management for Power Reader
 */

import type { ReaderState } from '../state';
import { Logger } from '../utils/logger';

/**
 * Attach hotkey listeners to the document
 */
export const attachHotkeyListeners = (state: ReaderState, abortSignal?: AbortSignal): void => {
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in an input or textarea or select
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
      return;
    }

    // Ignore if Ctrl, Alt, or Meta keys are pressed (e.g. Ctrl+C should not trigger 'c' hotkey)
    // We allow Shift as some hotkeys like 'G' (Shift+g) might be intentional
    if (e.ctrlKey || e.altKey || e.metaKey) {
      return;
    }

    const key = e.key.toLowerCase();

    // Map keys to data-action values
    const actionMap: Record<string, string> = {
      'a': 'load-all-comments',
      'c': 'scroll-to-comments',
      'n': 'scroll-to-next-post',
      'r': 'load-descendants',
      't': 'load-parents-and-scroll',
      '^': 'find-parent',
      '-': 'collapse',
      '+': 'expand',
      '=': 'expand', // Support = without shift
      'e': 'toggle-post-body',
      'g': 'send-to-ai-studio',
    };

    let action = actionMap[key];

    // Expand logic for comments too
    if (key === '+' || key === '=') {
      // Check if under mouse is a comment
      const elementUnderMouse = document.elementFromPoint(state.lastMousePos.x, state.lastMousePos.y);
      const comment = elementUnderMouse?.closest('.pr-comment');
      if (comment) action = 'expand';
    } else if (key === '-') {
      const elementUnderMouse = document.elementFromPoint(state.lastMousePos.x, state.lastMousePos.y);
      const comment = elementUnderMouse?.closest('.pr-comment');
      if (comment) action = 'collapse';
    }


    if (!action) return;

    // Find the item under the mouse
    const elementUnderMouse = document.elementFromPoint(state.lastMousePos.x, state.lastMousePos.y);
    if (!elementUnderMouse) return;

    const prItem = elementUnderMouse.closest('.pr-item') as HTMLElement;
    if (!prItem) return;

    // Find the button with that action within the item
    // Some buttons might be in .pr-comment-meta or .pr-post-header
    let button = prItem.querySelector(`[data-action="${action}"]`) as HTMLElement;

    // [PR-HK-07] If button not found in current item and we are in a comment, 
    // try finding it in the parent post (falling up for post-level actions like 'n', 'a', 'c', 'e')
    if (!button && prItem.classList.contains('pr-comment')) {
      // Special case for comment collapse/expand which don't have visible buttons sometimes
      if (action === 'collapse' || action === 'expand') {
        // Dispatch directly to the comment element if mapped action matches
        // But wait, the event listener listens on [data-action].
        // We need a target that has the data-action. 
        // Use the collapse/expand toggle if available
        button = prItem.querySelector(`.pr-collapse, .pr-expand`) as HTMLElement;
      }

      if (!button) {
        const postId = prItem.dataset.postId;
        if (postId) {
          const postEl = document.querySelector(`.pr-post[data-id="${postId}"]`);
          if (postEl) {
            button = postEl.querySelector(`[data-action="${action}"]`) as HTMLElement;
          }
        }
      }
    }

    if (button) {
      if (button.classList.contains('disabled')) {
        Logger.debug(`Hotkey '${key}' triggered action '${action}' but button is disabled`);
        return;
      }

      Logger.info(`Hotkey '${key}' triggering action '${action}' on item ${prItem.dataset.id}`);

      // Prevent default browser behavior (e.g. +/- zooming or find)
      e.preventDefault();
      e.stopPropagation();

      // Dispatch events to trigger delegation listeners
      button.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        shiftKey: e.shiftKey
      }));
      button.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        shiftKey: e.shiftKey
      }));
      button.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        shiftKey: e.shiftKey
      }));
    }
  }, { signal: abortSignal });
};
