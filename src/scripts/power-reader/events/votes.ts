/**
 * Vote interaction handling for Power Reader
 * Unified handling for karma and agreement voting with click/hold differentiation
 */

import type { ReaderState } from '../state';
import { syncCommentInState, syncPostInState } from '../state';
import {
  castKarmaVote,
  castAgreementVote,
  calculateNextVoteState,
  updateVoteUI,
  type KarmaVote,
  type AgreementVote,
  type VoteResponse,
} from '../utils/voting';
import type { Comment, Post } from '../../../shared/graphql/queries';
import { renderComment, highlightQuotes } from '../render/comment';
import { renderReactions } from '../utils/rendering';
import { Logger } from '../utils/logger';

type VoteKind = 'karma' | 'agreement';
type VoteDir = 'up' | 'down';

interface VoteActionConfig {
  kind: VoteKind;
  dir: VoteDir;
}

const ACTION_TO_VOTE: Record<string, VoteActionConfig> = {
  'karma-up': { kind: 'karma', dir: 'up' },
  'karma-down': { kind: 'karma', dir: 'down' },
  'agree': { kind: 'agreement', dir: 'up' },
  'disagree': { kind: 'agreement', dir: 'down' },
};

/**
 * Handle vote interaction with click/hold differentiation
 */
export const handleVoteInteraction = (
  target: HTMLElement,
  action: string,
  state: ReaderState
): void => {
  const config = ACTION_TO_VOTE[action];
  if (!config) return;

  // data-comment-id attribute carries the document ID for both comments and posts
  const documentId = target.dataset.commentId;
  if (!documentId) return;

  const comment = state.commentById.get(documentId);
  const post = state.postById.get(documentId);
  const targetDoc = comment ?? post;
  if (!targetDoc) return;

  // Determine current vote state
  const currentVote = config.kind === 'karma'
    ? (targetDoc.currentUserVote || 'neutral')
    : (targetDoc.currentUserExtendedVote?.agreement || 'neutral');

  // Map direction for state calculation
  const direction = config.kind === 'karma'
    ? config.dir
    : (config.dir === 'up' ? 'agree' : 'disagree');

  // Calculate targets
  const currentVoteStr = String(currentVote ?? 'neutral');
  const clickTargetState = calculateNextVoteState(currentVoteStr, direction, false);
  const holdTargetState = calculateNextVoteState(currentVoteStr, direction, true);

  // Optimistic UI Update (immediate mousedown state)
  applyOptimisticVoteUI(target, currentVoteStr, config.dir);

  let committed = false;

  const cleanup = () => {
    target.removeEventListener('mouseup', mouseUpHandler);
    target.removeEventListener('mouseleave', mouseLeaveHandler);
  };

  // Timer for hold (500ms)
  const timer = window.setTimeout(async () => {
    committed = true;
    cleanup();

    // Apply hold visual state
    if (holdTargetState.startsWith('big')) {
      target.classList.add('strong-vote');
    } else if (holdTargetState === 'neutral') {
      clearVoteClasses(target);
    }

    // Execute hold vote
    const res = await executeVote(documentId, holdTargetState, config.kind, state, targetDoc);
    if (res) {
      syncVoteToState(state, documentId, res);
    }
  }, 500);

  const mouseUpHandler = async () => {
    if (committed) return;
    clearTimeout(timer);
    cleanup();

    // Reset optimistic styles
    clearVoteClasses(target);

    // Execute click vote
    const res = await executeVote(documentId, clickTargetState, config.kind, state, targetDoc);
    if (res) {
      syncVoteToState(state, documentId, res);
    }
  };

  const mouseLeaveHandler = () => {
    if (committed) return;
    clearTimeout(timer);
    cleanup();

    // Revert optimistic styles - just clear classes, original state is preserved in DOM
    clearVoteClasses(target);
  };

  target.addEventListener('mouseup', mouseUpHandler);
  target.addEventListener('mouseleave', mouseLeaveHandler);
};

/**
 * Apply optimistic vote UI during mousedown
 */
const applyOptimisticVoteUI = (target: HTMLElement, currentVote: string, dir: VoteDir): void => {
  if (currentVote?.startsWith('big')) {
    target.classList.remove('strong-vote');
  } else {
    if (dir === 'up') {
      target.classList.add('active-up');
      target.classList.add('agree-active');
    } else {
      target.classList.add('active-down');
      target.classList.add('disagree-active');
    }
  }
};

/**
 * Clear all vote-related classes from target
 */
const clearVoteClasses = (target: HTMLElement): void => {
  target.classList.remove('active-up', 'active-down', 'agree-active', 'disagree-active', 'strong-vote');
};

/**
 * Execute the appropriate vote mutation
 */
const executeVote = async (
  documentId: string,
  targetState: string,
  kind: VoteKind,
  state: ReaderState,
  document: any
): Promise<VoteResponse | null> => {
  const isLoggedIn = !!state.currentUserId;
  const documentType: 'comment' | 'post' = state.commentById.has(documentId) ? 'comment' : 'post';
  Logger.debug(`executeVote: type=${documentType}, kind=${kind}, targetState=${targetState}, id=${documentId}`);

  if (kind === 'karma') {
    return castKarmaVote(
      documentId,
      targetState as KarmaVote,
      isLoggedIn,
      document.currentUserExtendedVote,
      documentType
    );
  } else {
    return castAgreementVote(
      documentId,
      targetState as AgreementVote,
      isLoggedIn,
      document.currentUserVote as KarmaVote,
      documentType
    );
  }
};

/**
 * Sync vote response to state, update DOM, and re-render reactions/highlights.
 * This is the single place that calls updateVoteUI — callers should NOT call it separately.
 */
export const syncVoteToState = (
  state: ReaderState,
  documentId: string,
  response: VoteResponse
): void => {
  const comment = state.commentById.get(documentId);
  const post = state.postById.get(documentId);
  const doc = response.performVoteComment?.document ?? response.performVotePost?.document;
  if (doc) {
    if (comment) {
      syncCommentInState(state, documentId, {
        baseScore: doc.baseScore ?? 0,
        voteCount: doc.voteCount ?? 0,
        currentUserVote: doc.currentUserVote,
        extendedScore: doc.extendedScore,
        afExtendedScore: doc.afExtendedScore,
        currentUserExtendedVote: doc.currentUserExtendedVote,
      } as Partial<Comment>);
    }

    if (post) {
      syncPostInState(state, documentId, {
        baseScore: doc.baseScore ?? 0,
        voteCount: doc.voteCount ?? 0,
        currentUserVote: doc.currentUserVote,
        extendedScore: doc.extendedScore,
        afExtendedScore: doc.afExtendedScore,
        currentUserExtendedVote: doc.currentUserExtendedVote,
      } as Partial<Post>);
    }

    // Use updateVoteUI for fine-grained DOM changes to preserve children
    updateVoteUI(documentId, response);

    // Re-render reactions if they might have changed (comment-only; posts don't have inline reactions yet)
    refreshReactions(documentId, state);

    // Refresh body to show highlighted quotes (comment-only; post bodies are in a separate container)
    refreshCommentBody(documentId, state);
  }
};

/**
 * Re-render comment body to show highlights.
 * Intentionally comment-only — post bodies live in a separate `.pr-post-content` container.
 */
export const refreshCommentBody = (commentId: string, state: ReaderState): void => {
  const comment = state.commentById.get(commentId);
  if (!comment) return;

  const el = document.querySelector(`.pr-comment[data-id="${commentId}"]`);
  if (!el) return;

  const bodyEl = el.querySelector('.pr-comment-body');
  if (bodyEl && comment.htmlBody) {
    bodyEl.innerHTML = highlightQuotes(
      comment.htmlBody,
      comment.extendedScore as any
    );
  }
};

/**
 * Re-render reactions for a single comment.
 * Intentionally comment-only — post-level reactions are not yet supported inline.
 */
export const refreshReactions = (commentId: string, state: ReaderState): void => {
  const comment = state.commentById.get(commentId);
  if (!comment) return;

  const el = document.querySelector(`.pr-comment[data-id="${commentId}"]`);
  if (!el) return;

  const container = el.querySelector('.pr-reactions-container');
  if (container) {
    container.innerHTML = renderReactions(
      comment._id,
      comment.extendedScore as any,
      comment.currentUserExtendedVote as any
    );
  }
};

/**
 * Re-render a single comment in place - DEPRECATED
 * Use updateVoteUI or specific sub-renders to preserve DOM children
 */
export const restyleComment = (commentId: string, state: ReaderState): void => {
  Logger.warn(`restyleComment called for ${commentId} - this replaces outerHTML and kills children!`);
  const comment = state.commentById.get(commentId);
  if (!comment) return;

  const el = document.querySelector(`.pr-comment[data-id="${commentId}"]`);
  if (!el) return;

  el.outerHTML = renderComment(comment, state);
};
