import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Reproduction: [a] hotkey placeholder issue', () => {
    test('Comments loaded via [a] hotkey should be visible even if they are old/read', async ({ page }) => {
        const posts = [{
            _id: 'p1',
            title: 'Post with many comments',
            commentCount: 5,
            wordCount: 100,
            htmlBody: '<p>Content</p>',
            postedAt: '2025-01-01T00:00:00.000Z'
        }];

        // Comments are from 2025 (old)
        const allComments = Array.from({ length: 5 }, (_, i) => ({
            _id: `c${i}`,
            postId: 'p1',
            htmlBody: `Comment ${i} content`,
            postedAt: '2025-01-01T00:01:00.000Z',
            user: { _id: `u${i}`, username: `User${i}`, displayName: `User ${i}` },
            baseScore: 10,
            directChildrenCount: 0
        }));

        const unreadComment = {
            _id: 'c-unread',
            postId: 'p1',
            htmlBody: 'Unread comment content',
            postedAt: '2026-02-01T00:00:00.000Z', // After cutoff
            user: { _id: 'u-new', username: 'NewUser', displayName: 'New User' },
            baseScore: 10,
            directChildrenCount: 0
        };

        // Initial state: Post loaded, with one unread comment
        await initPowerReader(page, { 
            posts, 
            comments: [unreadComment], 
            testMode: true,
            storage: {
                'power-reader-read-from': '2026-01-01T00:00:00.000Z'
            },
            // Mock GraphQL for [a]
            onGraphQL: `
                if (query.includes('query GetPostComments')) {
                    return { data: { comments: { results: ${JSON.stringify([...allComments, unreadComment])} } } };
                }
            `
        });

        const post = page.locator('.pr-post[data-id="p1"]');
        await expect(post).toBeVisible({ timeout: 10000 });

        const btnA = post.locator('[data-action="load-all-comments"]');
        await expect(btnA).toBeVisible();
        await expect(btnA).not.toHaveClass(/disabled/);

        console.log('Clicking [a] button...');
        await btnA.click();

        // Wait for loading to finish (text changes back to [a])
        // We skip waiting for [...] because it might be too fast in some environments
        await expect(page.locator('.pr-comment')).toHaveCount(6, { timeout: 10000 });
        console.log('Comments count reached 6');

        await expect(btnA).toHaveText('[a]', { timeout: 10000 });
        console.log('Button text returned to [a]');

        // If they are placeholders, they won't show content
        const firstOldComment = page.locator('.pr-comment[data-id="c0"]');
        await expect(firstOldComment).toBeVisible();
        
        // Check for content
        const body = firstOldComment.locator('.pr-comment-body');

        // The bug is that they should NOT be placeholders if we just explicitly loaded them via [a]
        await expect(body).toBeVisible();
    });
});
