import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader Reply-to-You', () => {

    test('highlights comments replying to current user', async ({ page }) => {
        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                htmlBody: 'Reply to me',
                postedAt: new Date().toISOString(),
                baseScore: 1,
                voteCount: 1,
                user: { _id: 'other-id', username: 'OtherUser' },
                post: { _id: 'p1', title: 'Post' },
                parentCommentId: 'parent-id',
                parentComment: {
                    user: { _id: 'my-id', username: 'MyUser' }
                }
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            comments,
            currentUser: { _id: 'my-id', username: 'MyUser', slug: 'my-user' }
        });

        // Verify class .reply-to-you
        const comment = page.locator('.pr-comment[data-id="c1"]');
        await expect(comment).toHaveClass(/reply-to-you/);

        // Verify style (bright green border)
        await expect(comment).toHaveCSS('border-color', 'rgb(0, 255, 0)');
        await expect(comment).toHaveCSS('border-width', '2px');
    });
});
