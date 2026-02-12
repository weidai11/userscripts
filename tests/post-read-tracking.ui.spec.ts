import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Post Read Tracking Bug Reproduction', () => {

    test('post should be marked read after scrolling past its body, even if comments are still below', async ({ page }) => {
        const posts = [
            {
                _id: 'p1',
                title: 'Large Post',
                postedAt: new Date().toISOString(),
                htmlBody: '<div style="height: 1000px">Post Content</div>',
                user: { username: 'Author' }
            }
        ];
        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                htmlBody: '<div style="height: 1000px">Long Comment</div>',
                postedAt: new Date().toISOString(),
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

        // In current bugged version, this will NOT be read because .pr-post.pr-item bottom 
        // includes the comment, and it is at 2000px + some offset.
        // It will only be marked read if we scroll past the whole thing (~2150px)
        
        // Wait for ReadTracker delay (100ms in testMode)
        await page.waitForTimeout(500);
        
        const postClass = await postItem.getAttribute('class');
        console.log('Post classes after scrolling past body but not comments:', postClass);
        
        // This is expected to FAIL in current version if the user is correct
        await expect(postItem).toHaveClass(/read/, { timeout: 2000 });
    });
});
