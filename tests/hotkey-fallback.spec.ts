import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Hotkey Fallback: PR-HK-07', () => {
    test('[PR-HK-07] pressing "n" over a comment triggers the [n] action on the parent post', async ({ page }) => {
        const posts = [
            { _id: 'p1', title: 'Post 1', htmlBody: '<div style="height: 2000px">Post 1 Content</div>', postedAt: new Date(Date.now() - 1000).toISOString() },
            { _id: 'p2', title: 'Post 2', htmlBody: '<div style="height: 2000px">Post 2 Content</div>', postedAt: new Date(Date.now() - 2000).toISOString() }
        ];
        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                htmlBody: '<p>Comment over p1</p>',
                postedAt: new Date().toISOString(),
                user: { username: 'Author' },
                post: { _id: 'p1', title: 'Post 1' }
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments
        });

        // Ensure enough scroll space after takeover
        await page.evaluate(() => {
            const style = document.createElement('style');
            style.textContent = 'body { padding-bottom: 5000px !important; }';
            document.head.appendChild(style);
        });

        // 1. Mouse over the comment
        const comment = page.locator('.pr-comment[data-id="c1"]');
        await comment.hover();

        // 2. Mock scroll event or check if we scroll to p2
        // We can check the scroll position or just verify the log if we use verbose
        // Better: verify that window.scrollTo was called with p2's header top.

        // Find p2 header top
        const p2Header = page.locator('.pr-post[data-id="p2"] .pr-post-header');
        const p2Box = await p2Header.boundingBox();
        const expectedTop = p2Box?.y || 0;

        // Press 'n'
        await page.keyboard.press('n');

        // Check scroll position (give it some time for smooth scroll or use instant in test mode)
        await page.waitForTimeout(200);

        // Check if next post header is at the top of the viewport
        const p2HeaderBoxAfter = await p2Header.boundingBox();
        expect(p2HeaderBoxAfter?.y).toBeCloseTo(0, 0);
    });

    test('[PR-HK-07] pressing "e" over a comment toggles parent post body', async ({ page }) => {
        const longContent = '<div style="height: 1000px">Long Content</div>';
        await initPowerReader(page, {
            testMode: true,
            posts: [{ _id: 'p1', title: 'P1', htmlBody: longContent, postedAt: new Date().toISOString() }],
            comments: [{ _id: 'c1', postId: 'p1', htmlBody: 'C1', postedAt: new Date().toISOString(), post: { _id: 'p1', title: 'P1' } }]
        });

        const postBody = page.locator('.pr-post-body-container');
        const comment = page.locator('.pr-comment[data-id="c1"]');

        await comment.hover();

        // Initial state should be truncated because it is long (1000px > 50vh)
        await expect(postBody).toHaveClass(/truncated/);

        // Toggle it (expand)
        await page.keyboard.press('e');
        await expect(postBody).not.toHaveClass(/truncated/);

        // Toggle back (truncate)
        await page.keyboard.press('e');
        await expect(postBody).toHaveClass(/truncated/);
    });
});
