import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Automatic Expansion on Navigation [PR-NAV-11]', () => {
    test('should expand read placeholders when navigating to parent', async ({ page }) => {
        const now = new Date();
        const posts = [{ _id: 'p1', title: 'Post 1', baseScore: 10, postedAt: now.toISOString(), user: { username: 'U1' } }];

        // Chain: c1 (read) -> c2 (unread)
        // c1 will be a placeholder initially because it's read and only has 1 unread descendant (and we haven't reached it yet?)
        // Wait, [PR-READ-05] says read comments with < 2 unread descendants are collapsed.
        const comments = [
            { _id: 'c1', postId: 'p1', baseScore: 5, postedAt: now.toISOString(), parentCommentId: null, user: { username: 'U1' }, htmlBody: 'Parent Content' },
            { _id: 'c2', postId: 'p1', baseScore: 50, postedAt: now.toISOString(), parentCommentId: 'c1', user: { username: 'U2' }, htmlBody: 'Child Content' }
        ];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments,
            storage: {
                'power-reader-read': { 'c1': 1 }
            }
        });

        // Verify c1 is a placeholder initially
        const c1 = page.locator('.pr-comment[data-id="c1"]');
        await expect(c1).toHaveClass(/pr-comment-placeholder/);

        // Click [^] on c2
        const upBtn = page.locator('.pr-comment[data-id="c2"] [data-action="find-parent"]');
        await upBtn.click();

        // Verify c1 is now expanded (not a placeholder anymore)
        await expect(c1).not.toHaveClass(/pr-comment-placeholder/);
        await expect(c1).toContainText('Parent Content');
    });

    test('should expand ALL ancestors when tracing to root [t]', async ({ page }) => {
        const now = new Date();
        const posts = [{ _id: 'p1', title: 'Post 1', baseScore: 10, postedAt: now.toISOString(), user: { username: 'U1' } }];

        // Chain: c1 (read) -> c2 (read) -> c3 (unread)
        // Both c1 and c2 should be placeholders
        const comments = [
            { _id: 'c1', postId: 'p1', baseScore: 5, postedAt: now.toISOString(), parentCommentId: null, user: { username: 'U1' }, htmlBody: 'Root Content' },
            { _id: 'c2', postId: 'p1', baseScore: 5, postedAt: now.toISOString(), parentCommentId: 'c1', user: { username: 'U2' }, htmlBody: 'Middle Content' },
            { _id: 'c3', postId: 'p1', baseScore: 50, postedAt: now.toISOString(), parentCommentId: 'c2', user: { username: 'U3' }, htmlBody: 'Leaf Content' }
        ];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments,
            storage: {
                'power-reader-read': { 'c1': 1, 'c2': 1 }
            }
        });

        const c1 = page.locator('.pr-comment[data-id="c1"]');
        const c2 = page.locator('.pr-comment[data-id="c2"]');
        await expect(c1).toHaveClass(/pr-comment-placeholder/);
        await expect(c2).toHaveClass(/pr-comment-placeholder/);

        // Click [t] on c3
        const traceBtn = page.locator('.pr-comment[data-id="c3"] [data-action="load-parents-and-scroll"]');
        await traceBtn.click();

        // Verify both are expanded
        await expect(c1).not.toHaveClass(/pr-comment-placeholder/);
        await expect(c2).not.toHaveClass(/pr-comment-placeholder/);
        await expect(c1).toContainText('Root Content');
        await expect(c2).toContainText('Middle Content');
    });
});
