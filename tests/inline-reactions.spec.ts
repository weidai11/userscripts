import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader Inline Reactions', () => {

    test('[PR-REACT-07] Selecting text triggers floating button and reacting attaches quote', async ({ page }) => {
        const comments = [
            {
                _id: 'comment-1',
                postId: 'post-1',
                pageUrl: 'https://example.com/c1',
                htmlBody: '<p id="target-text">This is a quote-able sentence in a comment.</p>',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                extendedScore: { reacts: {} },
                currentUserExtendedVote: { reacts: [] },
                parentCommentId: null,
                user: { _id: 'u2', slug: 'user-2', username: 'OtherUser' },
                post: { _id: 'p1', title: 'Test Post', slug: 'test-post' },
                parentComment: null
            }
        ];

        const onGraphQL = `
            if (query.includes('mutation Vote')) {
                const extendedVote = variables.extendedVote || {};
                const reactsMap = {};

                if (extendedVote.reacts) {
                    extendedVote.reacts.forEach((r) => {
                        reactsMap[r.react] = [{
                            userId: 'u1',
                            reactType: r.vote,
                            quotes: r.quotes ? r.quotes.map((q) => ({ quote: q })) : []
                        }];
                    });
                }

                return {
                    data: {
                        performVoteComment: {
                            document: {
                                _id: variables.documentId,
                                baseScore: 10,
                                voteCount: 1,
                                extendedScore: { reacts: reactsMap },
                                currentUserVote: variables.voteType,
                                currentUserExtendedVote: variables.extendedVote,
                                afExtendedScore: { agreement: 0 }
                            }
                        }
                    }
                };
            }
        `;

        await initPowerReader(page, {
            testMode: true,
            comments,
            onGraphQL,
            scrapedReactions: [
                { name: 'agree', label: 'Agreed', svg: '' },
                { name: 'insightful', label: 'Insightful', svg: '' }
            ]
        });

        const commentBody = page.locator('.pr-comment-body').first();
        const targetText = commentBody.locator('#target-text');

        // 1. Select text
        await targetText.evaluate((el) => {
            const range = document.createRange();
            const textNode = el.firstChild!;
            range.setStart(textNode, 10); // "quote-able"
            range.setEnd(textNode, 20);
            const selection = window.getSelection()!;
            selection.removeAllRanges();
            selection.addRange(range);
            // Trigger selectionchange manually as Playwright's selection APIs are limited
            document.dispatchEvent(new Event('selectionchange'));
        });

        // 2. Verify floating button appears
        const reactBtn = page.locator('#pr-inline-react-btn');
        await expect(reactBtn).toBeVisible();

        // 3. Click React button
        await reactBtn.click();

        // 4. Verify picker opens
        const picker = page.locator('#pr-global-reaction-picker');
        await expect(picker).toBeVisible();

        // 5. Select a reaction (agree)
        const agreeReaction = picker.locator('.pr-reaction-picker-item[data-reaction-name="agree"]');
        await agreeReaction.click();

        // 6. Verify quote is attached and highlighted
        const highlight = commentBody.locator('.pr-highlight');
        await expect(highlight).toBeVisible();
        await expect(highlight).toHaveText('quote-able');
    });
});
