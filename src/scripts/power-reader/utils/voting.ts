/**
 * Voting functionality for Power Reader
 * Implements karma and agreement voting via GraphQL mutations
 */

import { queryGraphQL } from '../../../shared/graphql/client';
import { VOTE_COMMENT_MUTATION, VOTE_POST_MUTATION } from '../../../shared/graphql/queries';
import type { VoteResponse, UserVoteOnSingleReaction, CurrentUserExtendedVote } from '../../../shared/graphql/queries';
import type { VoteMutation, VoteMutationVariables, VotePostMutation, VotePostMutationVariables } from '../../../generated/graphql';
import { Logger } from './logger';
export type { VoteResponse, UserVoteOnSingleReaction, CurrentUserExtendedVote };

// Vote types
export type KarmaVote = 'smallUpvote' | 'smallDownvote' | 'bigUpvote' | 'bigDownvote' | 'neutral';
export type AgreementVote = 'agree' | 'disagree' | 'neutral';

const LOGIN_URL = `${window.location.origin}/auth/auth0`;

/**
 * Cast a karma vote on a comment
 */
export async function castKarmaVote(
  documentId: string,
  voteType: KarmaVote,
  isLoggedIn: boolean,
  currentAgreement: any = null,
  documentType: 'comment' | 'post' = 'comment'
): Promise<VoteResponse | null> {
  Logger.debug(`castKarmaVote: documentId=${documentId}, type=${documentType}, isLoggedIn=${isLoggedIn}`);
  if (!isLoggedIn) {
    Logger.info('Not logged in, opening auth page');
    window.open(LOGIN_URL, '_blank');
    return null;
  }

  try {
    if (documentType === 'post') {
      const response = await queryGraphQL<VotePostMutation, VotePostMutationVariables>(VOTE_POST_MUTATION, {
        documentId: documentId,
        voteType: voteType,
        extendedVote: currentAgreement,
      });
      return response as unknown as VoteResponse;
    }

    const response = await queryGraphQL<VoteMutation, VoteMutationVariables>(VOTE_COMMENT_MUTATION, {
      documentId: documentId,
      voteType: voteType,
      extendedVote: currentAgreement,
    });

    return response;
  } catch (e) {
    Logger.error('Vote failed:', e);
    return null;
  }
}

/**
 * Cast an agreement vote on a comment
 * Agreement voting uses extended vote types
 */
export async function castAgreementVote(
  documentId: string,
  voteType: AgreementVote,
  isLoggedIn: boolean,
  currentKarma: KarmaVote = 'neutral',
  documentType: 'comment' | 'post' = 'comment'
): Promise<VoteResponse | null> {
  if (!isLoggedIn) {
    window.open(LOGIN_URL, '_blank');
    return null;
  }

  // Agreement votes use the extendedVote argument with standard vote type strings
  const agreementValue = voteType === 'agree' ? 'smallUpvote' :
    voteType === 'disagree' ? 'smallDownvote' :
      'neutral';

  try {
    if (documentType === 'post') {
      const response = await queryGraphQL<VotePostMutation, VotePostMutationVariables>(VOTE_POST_MUTATION, {
        documentId: documentId,
        voteType: currentKarma || 'neutral',
        extendedVote: { agreement: agreementValue },
      });
      return response as unknown as VoteResponse;
    }

    const response = await queryGraphQL<VoteMutation, VoteMutationVariables>(VOTE_COMMENT_MUTATION, {
      documentId: documentId,
      voteType: currentKarma || 'neutral',
      extendedVote: { agreement: agreementValue },
    });

    return response;
  } catch (e) {
    Logger.error('Agreement vote failed:', e);
    return null;
  }
}

/**
 * Cast a reaction vote on a comment
 * Supports both simple reactions and quoted (inline) reactions.
 */
export async function castReactionVote(
  commentId: string,
  reactionName: string,
  isLoggedIn: boolean,
  currentKarma: KarmaVote | null = 'neutral',
  currentExtendedVote: CurrentUserExtendedVote | null = {},
  quote: string | null = null
): Promise<VoteResponse | null> {
  if (!isLoggedIn) {
    window.open(LOGIN_URL, '_blank');
    return null;
  }

  // 1. Get existing reacts list
  const existingReacts = currentExtendedVote?.reacts || [];

  // 2. Clone to avoid mutation
  const newReacts: UserVoteOnSingleReaction[] = JSON.parse(JSON.stringify(existingReacts));

  // 3. Find if we already have this reaction
  const existingReactionIndex = newReacts.findIndex(r => r.react === reactionName);

  if (existingReactionIndex >= 0) {
    // Reaction exists
    const reaction = newReacts[existingReactionIndex];

    if (quote) {
      // Toggle logic for QUOTE
      const quotes = reaction.quotes || [];
      if (quotes.includes(quote)) {
        // Quote already exists -> Remove it
        reaction.quotes = quotes.filter((q: string) => q !== quote);
        // If no quotes left AND it was a quoted reaction, should we remove the reaction entirely?
        // LW logic: If you remove the last quote, the reaction disappears.
        if (reaction.quotes.length === 0) {
          newReacts.splice(existingReactionIndex, 1);
        }
      } else {
        // New quote -> Add it
        reaction.quotes = [...quotes, quote];
      }
    } else {
      // No quote provided -> Toggle entire reaction OFF
      // This is the behavior when clicking the chip in the header
      newReacts.splice(existingReactionIndex, 1);
    }
  } else {
    // Reaction does not exist -> Create it
    const newReaction: UserVoteOnSingleReaction = {
      react: reactionName,
      vote: 'created', // Default vote type
    };

    if (quote) {
      newReaction.quotes = [quote];
    }

    newReacts.push(newReaction);
  }

  // 4. Construct payload, preserving agreement
  const extendedVotePayload = {
    agreement: currentExtendedVote?.agreement,
    reacts: newReacts
  };

  try {
    const response = await queryGraphQL<VoteMutation, VoteMutationVariables>(VOTE_COMMENT_MUTATION, {
      documentId: commentId,
      voteType: currentKarma || 'neutral', // Need to pass current karma to preserve it
      extendedVote: extendedVotePayload,
    });

    return response;
  } catch (e) {
    Logger.error('Reaction vote failed:', e);
    return null;
  }
}

/**
 * Calculate the next vote state based on current state and interaction type
 */
export function calculateNextVoteState(
  currentVote: string | null,
  direction: 'up' | 'down' | 'agree' | 'disagree',
  isHold: boolean
): string {
  const isUp = direction === 'up' || direction === 'agree';
  const small = isUp ? (direction === 'agree' ? 'agree' : 'smallUpvote') : (direction === 'disagree' ? 'disagree' : 'smallDownvote');
  const big = isUp ? 'bigUpvote' : 'bigDownvote';
  const neutral = 'neutral';

  // Specific Logic for Agreement "agree" string vs "smallUpvote" mapping
  // "agree" and "disagree" are the small variants for agreement axis

  // Normalize current vote to check against our targets
  const currentIsBig = currentVote === big;

  // Agreement votes can be 'agree' or 'smallUpvote'
  const currentIsSmall = currentVote === small ||
    (direction === 'agree' && currentVote === 'smallUpvote') ||
    (direction === 'disagree' && currentVote === 'smallDownvote');

  if (isHold) {
    // Hold Logic
    if (currentIsBig) return neutral; // Big -(hold)-> Neutral
    return big; // Neutral/Small -(hold)-> Big
  } else {
    // Click Logic
    if (currentIsBig) return small; // Big -(click)-> Small
    if (currentIsSmall) return neutral; // Small -(click)-> Neutral
    return small; // Neutral -(click)-> Small
  }
}

/**
 * Toggle karma vote (click same button again to remove)
 * @deprecated Use calculateNextVoteState
 */
export function toggleKarmaVote(
  currentVote: KarmaVote | null,
  direction: 'up' | 'down'
): KarmaVote {
  return calculateNextVoteState(currentVote, direction, false) as KarmaVote;
}

/**
 * Toggle agreement vote
 * @deprecated Use calculateNextVoteState
 */
export function toggleAgreementVote(
  currentVote: AgreementVote | null,
  direction: 'agree' | 'disagree'
): AgreementVote {
  return calculateNextVoteState(currentVote, direction, false) as AgreementVote;
}



/**
 * Update vote UI after a vote is cast
 */
export function updateVoteUI(
  documentId: string,
  response: VoteResponse
): void {
  const isPostVote = !!response.performVotePost?.document;
  const targets = isPostVote
    ? Array.from(document.querySelectorAll<HTMLElement>(`.pr-post-header[data-post-id="${documentId}"]`))
    : Array.from(document.querySelectorAll<HTMLElement>(`.pr-comment[data-id="${documentId}"]`));
  const doc = response.performVoteComment?.document ?? response.performVotePost?.document;
  if (!doc || targets.length === 0) return;

  targets.forEach(target => {
    // Update karma score
    const scoreEl = target.querySelector('.pr-karma-score');
    if (scoreEl) {
      scoreEl.textContent = String(doc.baseScore);
    }

    // Update agreement score
    const agreeScoreEl = target.querySelector('.pr-agreement-score');
    if (agreeScoreEl && doc.afExtendedScore?.agreement !== undefined) {
      agreeScoreEl.textContent = String(doc.afExtendedScore.agreement);
    }

    // Update karma button states
    const upBtn = target.querySelector('[data-action="karma-up"]');
    const downBtn = target.querySelector('[data-action="karma-down"]');

    const vote = doc.currentUserVote;

    upBtn?.classList.toggle('active-up', vote === 'smallUpvote' || vote === 'bigUpvote');
    upBtn?.classList.toggle('strong-vote', vote === 'bigUpvote');

    downBtn?.classList.toggle('active-down', vote === 'smallDownvote' || vote === 'bigDownvote');
    downBtn?.classList.toggle('strong-vote', vote === 'bigDownvote');

    // Update agreement button states
    const agreeBtn = target.querySelector('[data-action="agree"]');
    const disagreeBtn = target.querySelector('[data-action="disagree"]');

    const extVote = doc.currentUserExtendedVote;
    const agreeState = extVote?.agreement;

    agreeBtn?.classList.toggle('agree-active', agreeState === 'smallUpvote' || agreeState === 'bigUpvote' || agreeState === 'agree');
    agreeBtn?.classList.toggle('strong-vote', agreeState === 'bigUpvote');

    disagreeBtn?.classList.toggle('disagree-active', agreeState === 'smallDownvote' || agreeState === 'bigDownvote' || agreeState === 'disagree');
    disagreeBtn?.classList.toggle('strong-vote', agreeState === 'bigDownvote');
  });
}
