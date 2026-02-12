import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Ancestor Continuity [PR-NEST-06]', () => {
    test('should preserve full ancestor chain in DOM even if read', async ({ page }) => {
        const now = new Date();
        const posts = [{ _id: 'p1', title: 'Post 1', baseScore: 10, postedAt: now.toISOString(), user: { username: 'U1' } }];

        // Chain: c1 (read) -> c2 (read) -> c3 (unread)
        const comments = [
            { _id: 'c1', postId: 'p1', baseScore: 5, postedAt: now.toISOString(), parentCommentId: null, user: { username: 'U1' } },
            { _id: 'c2', postId: 'p1', baseScore: 5, postedAt: now.toISOString(), parentCommentId: 'c1', user: { username: 'U2' } },
            { _id: 'c3', postId: 'p1', baseScore: 5, postedAt: now.toISOString(), parentCommentId: 'c2', user: { username: 'U3' } }
        ];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments,
            storage: {
                'power-reader-read': { 'c1': 1, 'c2': 1 }
            }
        });

        // Verify c3 is visible
        await expect(page.locator('.pr-comment[data-id="c3"]')).toBeVisible();

        // Verify c1 and c2 are also in DOM (as ancestors/placeholders)
        await expect(page.locator('.pr-comment[data-id="c1"]')).toBeAttached();
        await expect(page.locator('.pr-comment[data-id="c2"]')).toBeAttached();

        // Since they are read but have unread descendants, they should be rendered (likely greyed out or placeholders)
        // [PR-READ-05]: read comments with 2+ unread descendants are rendered full; others might be placeholders.
        // Here c1/c2 have 1 unread descendant (c3).

        await expect(page.locator('.pr-comment[data-id="c1"]')).toHaveClass(/read/);
        await expect(page.locator('.pr-comment[data-id="c2"]')).toHaveClass(/read/);
    });
});
