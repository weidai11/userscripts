/**
 * Shared action components (Votes, Reactions)
 */

import { escapeHtml } from '../../utils/rendering';
import { getReactions, DEFAULT_FILTER } from '../../utils/reactions';
import type { NamesAttachedReactionsScore, CurrentUserExtendedVote } from '../../../../shared/graphql/queries';

/**
 * Render vote buttons HTML
 */
export function renderVoteButtons(
    itemId: string,
    karmaScore: number,
    currentKarmaVote: string | number | null,
    currentAgreement: Record<string, any> | null,
    agreementScore: number = 0,
    voteCount: number = 0,
    agreementVoteCount: number = 0,
    showAgreement: boolean = true,
    showButtons: boolean = true
): string {
    const isUpvoted = currentKarmaVote === 'smallUpvote' || currentKarmaVote === 'bigUpvote' || currentKarmaVote === 1;
    const isDownvoted = currentKarmaVote === 'smallDownvote' || currentKarmaVote === 'bigDownvote' || currentKarmaVote === -1;

    // Parse agreement vote from extended vote
    const agreeVote = currentAgreement?.agreement;
    const isAgreed = agreeVote === 'smallUpvote' || agreeVote === 'bigUpvote' || agreeVote === 'agree';
    const isDisagreed = agreeVote === 'smallDownvote' || agreeVote === 'bigDownvote' || agreeVote === 'disagree';

    const agreementHtml = showAgreement ? `
    <span class="pr-vote-controls">
      ${showButtons ? `
      <span class="pr-vote-btn ${isDisagreed ? 'disagree-active' : ''} ${agreeVote === 'bigDownvote' ? 'strong-vote' : ''}" 
            data-action="disagree" 
            data-id="${itemId}"
            title="Disagree">✗</span>
      ` : ''}
      <span class="pr-agreement-score" title="Agreement votes: ${agreementVoteCount}">${agreementScore}</span>
      ${showButtons ? `
      <span class="pr-vote-btn ${isAgreed ? 'agree-active' : ''} ${agreeVote === 'bigUpvote' ? 'strong-vote' : ''}" 
            data-action="agree" 
            data-id="${itemId}"
            title="Agree">✓</span>
      ` : ''}
    </span>` : '';

    return `
    <span class="pr-vote-controls">
      ${showButtons ? `
      <span class="pr-vote-btn ${isDownvoted ? 'active-down' : ''} ${currentKarmaVote === 'bigDownvote' ? 'strong-vote' : ''}" 
            data-action="karma-down" 
            data-id="${itemId}"
            title="Downvote">▼</span>
      ` : ''}
      <span class="pr-karma-score" title="Total votes: ${voteCount}">${karmaScore}</span>
      ${showButtons ? `
      <span class="pr-vote-btn ${isUpvoted ? 'active-up' : ''} ${currentKarmaVote === 'bigUpvote' ? 'strong-vote' : ''}" 
            data-action="karma-up" 
            data-id="${itemId}"
            title="Upvote">▲</span>
      ` : ''}
    </span>
    ${agreementHtml}
    <span class="pr-reactions-container" data-id="${itemId}">
      <!-- Reactions will be injected here during main render or update -->
    </span>
  `;
}

/**
 * Render reaction chips
 */
export const renderReactions = (
    itemId: string,
    extendedScore: NamesAttachedReactionsScore | null,
    currentUserExtendedVote: CurrentUserExtendedVote | null
): string => {
    let html = '<span class="pr-reactions-inner">';
    const reacts = extendedScore?.reacts || {};
    const userReacts = currentUserExtendedVote?.reacts || [];
    const isEAHost = typeof window !== 'undefined' && window.location.hostname.includes('effectivealtruism.org');
    const alwaysVisibleReactions = isEAHost ? new Set(['agree', 'disagree']) : new Set<string>();

    const allReactions = getReactions();

    // Calculate counts for each reaction type
    const reactionCounts: Record<string, number> = {};

    // 1. Add top-level counts (e.g. EA Forum "agree", "disagree")
    if (extendedScore) {
        allReactions.forEach(reaction => {
            const count = (extendedScore as any)[reaction.name];
            if (typeof count === 'number' && count > 0) {
                reactionCounts[reaction.name] = (reactionCounts[reaction.name] || 0) + count;
            }
        });
    }

    // 2. Add counts from reacts array (named reactions)
    Object.entries(reacts).forEach(([reactName, users]) => {
        let score = 0;
        users.forEach(u => {
            if (u.reactType === 'disagreed') score -= 1;
            else score += 1;
        });
        if (score > 0) {
            reactionCounts[reactName] = (reactionCounts[reactName] || 0) + score;
        }
    });

    allReactions.forEach(reaction => {
        const count = reactionCounts[reaction.name] || 0;
        const isAlwaysVisible = alwaysVisibleReactions.has(reaction.name);
        let userVoted = userReacts.some(r => r.react === reaction.name);

        // Also check top-level keys for EA Forum style votes
        if (!userVoted && currentUserExtendedVote && (currentUserExtendedVote as any)[reaction.name]) {
            userVoted = true;
        }

        if (count > 0 || userVoted || isAlwaysVisible) {
            const filter = reaction.filter || DEFAULT_FILTER;
            const opacity = filter.opacity ?? 1;
            const saturate = filter.saturate ?? 1;
            const scale = filter.scale ?? 1;
            const tx = filter.translateX ?? 0;
            const ty = filter.translateY ?? 0;
            const padding = filter.padding ?? 0;

            const imgStyle = `
        filter: opacity(${opacity}) saturate(${saturate});
        transform: scale(${scale}) translate(${tx}px, ${ty}px);
        padding: ${padding}px;
      `;

            const title = `${reaction.label}${reaction.description ? '\\n' + reaction.description : ''}`;

            const countText = count > 0 || isAlwaysVisible ? String(count) : '';

            html += `
        <span class="pr-reaction-chip ${userVoted ? 'voted' : ''}" 
              data-action="reaction-vote" 
              data-id="${itemId}" 
              data-reaction-name="${reaction.name}"
              title="${escapeHtml(title)}">
          <span class="pr-reaction-icon" style="overflow:visible">
             <img src="${reaction.svg}" alt="${reaction.name}" style="${imgStyle}">
          </span>
          <span class="pr-reaction-count">${countText}</span>
        </span>
      `;
        }
    });

    html += `
    <span class="pr-add-reaction-btn" data-action="open-picker" data-id="${itemId}" title="Add reaction">
      <svg height="16" viewBox="0 0 16 16" width="16"><g fill="currentColor"><path d="m13 7c0-3.31371-2.6863-6-6-6-3.31371 0-6 2.68629-6 6 0 3.3137 2.68629 6 6 6 .08516 0 .1699-.0018.25419-.0053-.11154-.3168-.18862-.6499-.22673-.9948l-.02746.0001c-2.76142 0-5-2.23858-5-5s2.23858-5 5-5 5 2.23858 5 5l-.0001.02746c.3449.03811.678.11519.9948.22673.0035-.08429.0053-.16903.0053-.25419z"></path><path d="m7.11191 10.4982c.08367-.368.21246-.71893.38025-1.04657-.15911.03174-.32368.04837-.49216.04837-.74037 0-1.40506-.3212-1.86354-.83346-.18417-.20576-.50026-.22327-.70603-.03911-.20576.18417-.22327.50026-.03911.70603.64016.71524 1.57205 1.16654 2.60868 1.16654.03744 0 .07475-.0006.11191-.0018z"></path><path d="m6 6c0 .41421-.33579.75-.75.75s-.75-.33579-.75-.75.33579-.75.75-.75.75.33579.75.75z"></path><path d="m8.75 6.75c.41421 0 .75-.33579.75-.75s-.33579-.75-.75-.75-.75.33579-.75.75.33579.75.75.75z"></path><path d="m15 11.5c0 1.933-1.567 3.5-3.5 3.5s-3.5-1.567-3.5-3.5 1.567-3.5 3.5-3.5 3.5 1.567 3.5 3.5zm-3-2c0-.27614-.2239-.5-.5-.5s-.5.22386-.5.5v1.5h-1.5c-.27614 0-.5.2239-.5.5s.22386.5.5.5h1.5v1.5c0 .2761.2239.5.5.5s.5-.2239.5-.5v-1.5h1.5c.2761 0 .5-.2239.5-.5s-.2239-.5-.5-.5h-1.5z"></path></g></svg>
    </span>
  `;

    html += '</span>';
    return html;
};
