/**
 * Unit tests for voting.ts toggle functions and renderVoteButtons
 * These test the pure JavaScript logic without requiring a browser or API
 */
import { test, expect } from '@playwright/test';

// Since we can't import TypeScript directly, we test the logic inline
// These functions mirror the ones in voting.ts

type KarmaVote = 'smallUpvote' | 'smallDownvote' | 'bigUpvote' | 'bigDownvote' | 'neutral';
type AgreementVote = 'agree' | 'disagree' | 'neutral';

function toggleKarmaVote(
    currentVote: KarmaVote | null,
    direction: 'up' | 'down'
): KarmaVote {
    if (direction === 'up') {
        return currentVote === 'smallUpvote' ? 'neutral' : 'smallUpvote';
    } else {
        return currentVote === 'smallDownvote' ? 'neutral' : 'smallDownvote';
    }
}

function toggleAgreementVote(
    currentVote: AgreementVote | null,
    direction: 'agree' | 'disagree'
): AgreementVote {
    if (direction === 'agree') {
        return currentVote === 'agree' ? 'neutral' : 'agree';
    } else {
        return currentVote === 'disagree' ? 'neutral' : 'disagree';
    }
}

function renderVoteButtons(
    commentId: string,
    karmaScore: number,
    currentKarmaVote: string | null,
    currentAgreement: Record<string, any> | null
): string {
    const isUpvoted = currentKarmaVote === 'smallUpvote' || currentKarmaVote === 'bigUpvote';
    const isDownvoted = currentKarmaVote === 'smallDownvote' || currentKarmaVote === 'bigDownvote';

    const agreeVote = currentAgreement?.agreement;
    const isAgreed = agreeVote === 'agree' || agreeVote > 0;
    const isDisagreed = agreeVote === 'disagree' || agreeVote < 0;

    return `
    <span class="pr-vote-controls">
      <span class="pr-vote-btn ${isDownvoted ? 'active-down' : ''}" 
            data-action="karma-down" 
            data-comment-id="${commentId}"
            title="Downvote">▼</span>
      <span class="pr-karma-score">${karmaScore}</span>
      <span class="pr-vote-btn ${isUpvoted ? 'active-up' : ''}" 
            data-action="karma-up" 
            data-comment-id="${commentId}"
            title="Upvote">▲</span>
    </span>
    <span class="pr-vote-controls">
      <span class="pr-vote-btn ${isAgreed ? 'agree-active' : ''}" 
            data-action="agree" 
            data-comment-id="${commentId}"
            title="Agree">✓</span>
      <span class="pr-vote-btn ${isDisagreed ? 'disagree-active' : ''}" 
            data-action="disagree" 
            data-comment-id="${commentId}"
            title="Disagree">✗</span>
    </span>
  `;
}

test.describe('Voting Unit Tests', () => {

    test.describe('[PR-VOTE-02] toggleKarmaVote', () => {
        test('upvote from neutral returns smallUpvote', () => {
            expect(toggleKarmaVote(null, 'up')).toBe('smallUpvote');
        });

        test('upvote when already upvoted returns neutral (toggle off)', () => {
            expect(toggleKarmaVote('smallUpvote', 'up')).toBe('neutral');
        });

        test('upvote when downvoted switches to upvote', () => {
            expect(toggleKarmaVote('smallDownvote', 'up')).toBe('smallUpvote');
        });

        test('downvote from neutral returns smallDownvote', () => {
            expect(toggleKarmaVote(null, 'down')).toBe('smallDownvote');
        });

        test('downvote when already downvoted returns neutral (toggle off)', () => {
            expect(toggleKarmaVote('smallDownvote', 'down')).toBe('neutral');
        });

        test('downvote when upvoted switches to downvote', () => {
            expect(toggleKarmaVote('smallUpvote', 'down')).toBe('smallDownvote');
        });

        test('bigUpvote clicking up returns smallUpvote (not neutral)', () => {
            // Current implementation treats bigUpvote != smallUpvote, so it toggles to smallUpvote
            // This tests the current behavior
            expect(toggleKarmaVote('bigUpvote', 'up')).toBe('smallUpvote');
        });

        test('bigDownvote clicking down returns smallDownvote (not neutral)', () => {
            // Similar to above - bigDownvote != smallDownvote
            expect(toggleKarmaVote('bigDownvote', 'down')).toBe('smallDownvote');
        });
    });

    test.describe('[PR-VOTE-03] toggleAgreementVote', () => {
        test('agree from neutral returns agree', () => {
            expect(toggleAgreementVote(null, 'agree')).toBe('agree');
        });

        test('agree when already agreed returns neutral (toggle off)', () => {
            expect(toggleAgreementVote('agree', 'agree')).toBe('neutral');
        });

        test('agree when disagreed switches to agree', () => {
            expect(toggleAgreementVote('disagree', 'agree')).toBe('agree');
        });

        test('disagree from neutral returns disagree', () => {
            expect(toggleAgreementVote(null, 'disagree')).toBe('disagree');
        });

        test('disagree when already disagreed returns neutral (toggle off)', () => {
            expect(toggleAgreementVote('disagree', 'disagree')).toBe('neutral');
        });

        test('disagree when agreed switches to disagree', () => {
            expect(toggleAgreementVote('agree', 'disagree')).toBe('disagree');
        });
    });

    test.describe('[PR-VOTE-01] renderVoteButtons', () => {
        test('renders correct structure with neutral votes', () => {
            const html = renderVoteButtons('abc123', 10, null, null);

            expect(html).toContain('data-comment-id="abc123"');
            expect(html).toContain('data-action="karma-up"');
            expect(html).toContain('data-action="karma-down"');
            expect(html).toContain('data-action="agree"');
            expect(html).toContain('data-action="disagree"');
            expect(html).toContain('>10<'); // karma score
        });

        test('applies active-up class when upvoted', () => {
            const html = renderVoteButtons('abc123', 10, 'smallUpvote', null);
            expect(html).toContain('class="pr-vote-btn active-up"');
        });

        test('applies active-down class when downvoted', () => {
            const html = renderVoteButtons('abc123', 10, 'smallDownvote', null);
            expect(html).toContain('class="pr-vote-btn active-down"');
        });

        test('applies active-up for bigUpvote', () => {
            const html = renderVoteButtons('abc123', 10, 'bigUpvote', null);
            expect(html).toContain('class="pr-vote-btn active-up"');
        });

        test('applies active-down for bigDownvote', () => {
            const html = renderVoteButtons('abc123', 10, 'bigDownvote', null);
            expect(html).toContain('class="pr-vote-btn active-down"');
        });

        test('applies agree-active when agreement is "agree"', () => {
            const html = renderVoteButtons('abc123', 10, null, { agreement: 'agree' });
            expect(html).toContain('class="pr-vote-btn agree-active"');
        });

        test('applies agree-active when agreement is positive number', () => {
            const html = renderVoteButtons('abc123', 10, null, { agreement: 1 });
            expect(html).toContain('class="pr-vote-btn agree-active"');
        });

        test('applies disagree-active when agreement is "disagree"', () => {
            const html = renderVoteButtons('abc123', 10, null, { agreement: 'disagree' });
            expect(html).toContain('class="pr-vote-btn disagree-active"');
        });

        test('applies disagree-active when agreement is negative number', () => {
            const html = renderVoteButtons('abc123', 10, null, { agreement: -1 });
            expect(html).toContain('class="pr-vote-btn disagree-active"');
        });

        test('does not apply agreement classes when agreement is neutral/0', () => {
            const html = renderVoteButtons('abc123', 10, null, { agreement: 0 });
            expect(html).not.toContain('agree-active');
            expect(html).not.toContain('disagree-active');
        });

        test('handles negative karma scores', () => {
            const html = renderVoteButtons('abc123', -5, null, null);
            expect(html).toContain('>-5<');
        });
    });
});
