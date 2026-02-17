
import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Comment Read Tracking', () => {
    test('comment should be marked read after scrolling past its body, even if children are still below', async ({ page }) => {
        const posts = [
            { _id: 'p1', title: 'Post 1', htmlBody: 'Content 1', postedAt: new Date().toISOString() }
        ];
        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                htmlBody: '<div style="height: 100px;">Parent Body</div>',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                user: { _id: 'u1', username: 'Author1' },
                post: { _id: 'p1', title: 'Post 1' }
            },
            {
                _id: 'c2',
                postId: 'p1',
                parentCommentId: 'c1',
                htmlBody: '<div style="height: 2000px;">Very Long Child Body</div>',
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

        // Add some scroll space
        await page.evaluate(() => {
            const style = document.createElement('style');
            style.textContent = 'body { padding-bottom: 5000px !important; }';
            document.head.appendChild(style);
        });

        const parent = page.locator('.pr-comment[data-id="c1"]');
        const parentBody = parent.locator('> .pr-comment-body');
        const child = page.locator('.pr-comment[data-id="c2"]');

        // Initial state: not read
        await expect(parent).not.toHaveClass(/read/);

        // Scroll so that parent body is past top of viewport (bottom < 0)
        // Parent body is at top, height 100.
        // We'll scroll past it.
        const bodyBox = await parentBody.boundingBox();
        if (!bodyBox) throw new Error('Could not get body bounding box');

        // Scroll to just past the parent body
        await page.evaluate((y) => window.scrollTo(0, y + 10), bodyBox.y + bodyBox.height);

        // Check if parent is marked read
        // CURRENT EXPECTATION based on code analysis: This will FAIL because c2 is still visible/below.
        const parentClasses = await parent.getAttribute('class');
        console.log('Parent classes after scrolling past its body:', parentClasses);

        // If it's NOT marked read, then the bug is confirmed.
        // Once fixed, this should have 'read'.
        await expect(parent).toHaveClass(/read/);
    });
});
