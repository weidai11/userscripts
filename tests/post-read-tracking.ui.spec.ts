import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Post Read Tracking', () => {

    test('post should be marked read after scrolling past its body, even if comments are still below', async ({ page }) => {
        // Keep post/comment timestamps identical so initial implicit-read cutoff is deterministic.
        const postedAt = new Date(Date.now() + 10000).toISOString();
        const posts = [
            {
                _id: 'p1',
                title: 'Large Post',
                postedAt,
                htmlBody: '<div style="height: 1000px">Post Content</div>',
                user: { username: 'Author' }
            }
        ];
        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                htmlBody: '<div style="height: 1000px">Long Comment</div>',
                postedAt,
                user: { username: 'Commenter' }
            }
        ];

        await initPowerReader(page, { posts, comments, testMode: true });
        await page.setViewportSize({ width: 1280, height: 800 });

        const postItem = page.locator('.pr-post.pr-item');
        await expect(postItem).toBeVisible();
        await expect(postItem).not.toHaveClass(/read/);

        // Scroll so that post header and body are passed, but comment is still partly visible
        // Post body is 1000px, header ~50px, help section ~100px.
        // Scroll to 1200px should pass the post body (1150px approx)
        await page.evaluate(() => window.scrollTo(0, 1200));

        // ReadTracker correctly isolates the post body from comments when checking visibility.
        // The post should be marked as read once its body scrolls past, even though
        // comments below it are still visible.

        const postClass = await postItem.getAttribute('class');
        console.log('Post classes after scrolling past body but not comments:', postClass);

        // Post should now be marked as read
        await expect(postItem).toHaveClass(/read/, { timeout: 2000 });
    });
});
