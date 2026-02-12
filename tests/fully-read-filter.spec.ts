import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Fully Read Filter [PR-POST-12]', () => {
    test('should NOT render posts that are fully read and have no unread comments', async ({ page }) => {
        const now = new Date();
        const posts = [
            { _id: 'p-fully-read', title: 'Fully Read Post', baseScore: 10, postedAt: now.toISOString(), user: { username: 'U1' } },
            { _id: 'p-unread', title: 'Unread Post', baseScore: 10, postedAt: now.toISOString(), user: { username: 'U2' } }
        ];

        const comments = [
            {
                _id: 'c-read',
                postId: 'p-fully-read',
                baseScore: 5,
                postedAt: now.toISOString(),
                parentCommentId: null,
                user: { username: 'U1' },
                post: posts[0]
            },
            {
                _id: 'c-unread',
                postId: 'p-unread',
                baseScore: 5,
                postedAt: now.toISOString(),
                parentCommentId: null,
                user: { username: 'U2' },
                post: posts[1]
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments,
            storage: {
                'power-reader-read': { 'p-fully-read': 1, 'c-read': 1 }
            }
        });

        // Verify only p-unread is rendered
        await expect(page.locator('.pr-post')).toHaveCount(1);
        await expect(page.locator('.pr-post')).toContainText('Unread Post');
        await expect(page.locator('.pr-post')).not.toContainText('Fully Read Post');
    });

    test('should RENDER fully read posts if they have unread comments', async ({ page }) => {
        const now = new Date();
        const posts = [
            { _id: 'p-read-with-unread-comment', title: 'Read Post Unread Comment', baseScore: 10, postedAt: now.toISOString(), user: { username: 'U1' } }
        ];

        const comments = [
            {
                _id: 'c-unread',
                postId: 'p-read-with-unread-comment',
                baseScore: 5,
                postedAt: now.toISOString(),
                parentCommentId: null,
                user: { username: 'U1' },
                post: posts[0]
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments,
            storage: {
                'power-reader-read': { 'p-read-with-unread-comment': 1 }
            }
        });

        // Verify post is rendered because of unread comment
        await expect(page.locator('.pr-post')).toHaveCount(1);
        await expect(page.locator('.pr-post')).toContainText('Read Post Unread Comment');
    });
});
