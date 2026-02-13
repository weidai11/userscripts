
import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Voting Bug: Descendants Disappearing', () => {
    test('voting on a comment should NOT cause its descendants to disappear', async ({ page }) => {
        const posts = [
            { _id: 'p1', title: 'Post 1', htmlBody: 'Content 1', postedAt: new Date().toISOString() }
        ];
        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                htmlBody: 'Parent Comment',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                user: { _id: 'u1', username: 'Author1' },
                post: { _id: 'p1', title: 'Post 1' }
            },
            {
                _id: 'c2',
                postId: 'p1',
                parentCommentId: 'c1',
                htmlBody: 'Child Comment',
                postedAt: new Date().toISOString(),
                baseScore: 5,
                user: { _id: 'u2', username: 'Author2' },
                post: { _id: 'p1', title: 'Post 1' }
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments
        });

        // 1. Verify descendant exists initially
        const childComment = page.locator('.pr-comment[data-id="c2"]');
        await expect(childComment).toBeVisible();

        // 2. Mock the vote response
        // Setup mock response for karma-up on c1
        await page.evaluate(() => {
            (window as any).__VOTE_RESPONSE = {
                performVoteComment: {
                    document: {
                        _id: 'c1',
                        baseScore: 11,
                        currentUserVote: 'up'
                    }
                }
            };
        });

        // 3. Perform vote on c1
        const voteUp = page.locator('[data-action="karma-up"][data-id="c1"]');
        await voteUp.click();

        // 4. Verify descendant still exists
        await expect(childComment).toBeVisible();

        const parentEl = page.locator('.pr-comment[data-id="c1"]').first();
        const hasRepliesDiv = await parentEl.locator('.pr-replies').first().count();
        expect(hasRepliesDiv).toBe(1);

        const childText = await childComment.locator('.pr-comment-body').innerText();
        expect(childText).toContain('Child Comment');
    });
});
