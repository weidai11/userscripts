/**
 * Reaction handling for Power Reader
 */

import type { ReaderState } from '../state';
import { ReactionPicker } from '../components/ReactionPicker';
import {
  castReactionVote,
  updateVoteUI,
  type KarmaVote,
  type CurrentUserExtendedVote,
} from '../utils/voting';
import { syncVoteToState } from './votes';
import { Logger } from '../utils/logger';

// ReactionPicker singleton
let reactionPicker: ReactionPicker | null = null;

/**
 * Initialize the reaction picker
 */
export const initReactionPicker = (state: ReaderState): void => {
  reactionPicker = new ReactionPicker(
    () => state.comments,
    state.currentUserPaletteStyle,
    (commentId, response) => syncVoteToState(state, commentId, response),
    state.currentUserId
  );
};

/**
 * Open the reaction picker
 */
export const openReactionPicker = (button: HTMLElement, state: ReaderState, initialSearchText: string = ''): void => {
  if (!reactionPicker) initReactionPicker(state);
  reactionPicker?.setSelection(state.currentSelection);
  reactionPicker?.open(button, initialSearchText);
};

/**
 * Handle reaction vote on a comment
 */
export const handleReactionVote = async (
  commentId: string,
  reactionName: string,
  state: ReaderState
): Promise<void> => {
  Logger.info(`Handling reaction vote: ${reactionName} for ${commentId}`);

  const comment = state.commentById.get(commentId);
  if (!comment) return;

  // Determine quote context
  let quote: string | null = null;
  if (state.currentSelection) {
    const container = state.currentSelection.range.commonAncestorContainer;
    const parentEl = container.nodeType === 3 ? container.parentElement : container as HTMLElement;
    if (parentEl?.closest(`[data-id="${commentId}"]`)) {
      quote = state.currentSelection.text;
    }
  }

  const res = await castReactionVote(
    commentId,
    reactionName,
    !!state.currentUserId,
    comment.currentUserVote as KarmaVote,
    comment.currentUserExtendedVote as CurrentUserExtendedVote,
    quote
  );

  if (res) {
    updateVoteUI(commentId, res);
    syncVoteToState(state, commentId, res);

    // Clear selection & UI
    window.getSelection()?.removeAllRanges();
    state.currentSelection = null;
    document.getElementById('pr-inline-react-btn')?.remove();

    const picker = document.getElementById('pr-global-reaction-picker');
    if (picker) {
      picker.classList.remove('visible');
      setTimeout(() => picker.remove(), 300);
    }
  }
};
