import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test('[PR-READ-02] Comments are marked read automatically when content is less than one screen (no scrolling required)', async ({ page }) => {
    const comments = [
        {
            _id: 'short-1',
            postId: 'p1',
            pageUrl: 'https://www.lesswrong.com/posts/p1/active-thread-1?commentId=short-1',
            htmlBody: '<div style="height: 50px;">Short comment body 1.</div>',
            postedAt: new Date().toISOString(),
            baseScore: 5,
            parentCommentId: null,
            user: { _id: 'u1', slug: 'user-1', username: 'ShortUser1', karma: 100 },
            post: { _id: 'p1', title: 'Short Thread', slug: 'short-thread' },
            parentComment: null
        }
    ];

    // Initialize with a short delay (shorter than the tracker's checkInitialState timeout)
    await page.setViewportSize({ width: 1280, height: 1000 });
    await initPowerReader(page, {
        verbose: true,
        testMode: true, // Use instant scrollMarkDelay
        comments,
        storage: {
            'power-reader-read-from': '__LOAD_RECENT__',
            'power-reader-read': '{}',
            'power-reader-helpCollapsed': true
        }
    });

    // 1. Verify comment loaded
    const comment = page.locator('.pr-comment').first();
    await expect(comment).toBeVisible();
    await expect(comment).not.toHaveClass(/read/);

    // 2. Wait for the ReadTracker's initial check and the 5s mark delay (or test-mode instant mark)
    // The tracker has a 1000ms delay before initial check, and then a scrollMarkDelay.
    // In testMode: true, the delay should be 0 or very small.

    // Check if it gets marked read WITHOUT ANY scroll events
    await expect(comment).toHaveClass(/read/, { timeout: 10000 });
    await expect(page.locator('#pr-unread-count')).toHaveText('0');
});
