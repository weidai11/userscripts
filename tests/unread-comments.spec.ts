import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test('[PR-READ-01][PR-READ-02][PR-READ-04][PR-LOAD-05][PR-LOAD-10] Power Reader fetches recent comments and marks them as read locally', async ({ page }) => {
    const comments = [
        {
            _id: 'unread-1',
            postId: 'p1',
            pageUrl: 'https://www.lesswrong.com/posts/p1/active-thread-1?commentId=unread-1',
            htmlBody: '<p>Unread comment body 1.</p>',
            postedAt: new Date().toISOString(),
            baseScore: 5,
            parentCommentId: null,
            user: { _id: 'u1', slug: 'user-1', username: 'UnreadUser1', karma: 100 },
            post: { _id: 'p1', title: 'Active Thread 1', slug: 'active-thread-1' },
            parentComment: null
        },
        {
            _id: 'unread-2',
            postId: 'p1',
            pageUrl: 'https://www.lesswrong.com/posts/p1/active-thread-1?commentId=unread-2',
            htmlBody: '<p>Unread comment body 2.</p>',
            postedAt: new Date().toISOString(),
            baseScore: 3,
            parentCommentId: null,
            user: { _id: 'u2', slug: 'user-2', username: 'UnreadUser2', karma: 50 },
            post: { _id: 'p1', title: 'Active Thread 1', slug: 'active-thread-1' },
            parentComment: null
        }
    ];

    await initPowerReader(page, {
        verbose: true,
        testMode: true,
        comments,
        storage: {
            'power-reader-read-from': '__LOAD_RECENT__',
            'power-reader-read': '{}'
        }
    });

    // 4. Verify comments loaded
    await expect(page.locator('.pr-comment')).toHaveCount(2);
    await expect(page.locator('.pr-comment').first()).not.toHaveClass(/read/);

    // 5. Scroll partially (comments still visible)
    await page.evaluate(() => {
        const spacer = document.createElement('div');
        spacer.id = 'test-spacer';
        spacer.style.height = '5000px';
        document.body.appendChild(spacer);
    });

    await page.evaluate(() => window.scrollTo(0, 100));
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));

    // In test mode, scrollMarkDelay is 100ms (configured in setup.ts)
    // Wait for scroll mark delay (partial scroll)
    await page.waitForTimeout(500);

    // Verify comments still NOT marked as read (visible in viewport)
    await expect(page.locator('.pr-comment').first()).not.toHaveClass(/read/);
    await expect(page.locator('#pr-unread-count')).toHaveText('3');

    // 6. Scroll past (comments off-screen)
    await page.evaluate(() => window.scrollTo(0, 2500));
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));

    // Wait for scroll mark delay (full scroll)
    await page.waitForTimeout(500);

    // 7. Verify at-bottom logic
    await page.evaluate(() => {
        // Add a new comment to the DOM manually
        const post = document.querySelector('.pr-post-comments');
        if (post) {
            const newComment = document.createElement('div');
            newComment.className = 'pr-comment';
            newComment.dataset.id = 'unread-3';
            newComment.innerHTML = '<div class="pr-comment-body">Unread at bottom</div><div class="pr-comment-meta"></div>';
            post.appendChild(newComment);
        }
        // Move spacer to before the new comment to ensure it's at the very bottom
        const spacer = document.getElementById('test-spacer');
        if (spacer) spacer.remove();

        const bottomSpacer = document.createElement('div');
        bottomSpacer.id = 'bottom-spacer';
        bottomSpacer.style.height = '100px';
        document.body.appendChild(bottomSpacer);
    });

    // Scroll to the very bottom.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));

    // Wait for scroll mark delay (at bottom)
    await page.waitForTimeout(500);

    // Verify unread-3 is marked as read even if it's visible (because we are at bottom)
    await expect(page.locator('[data-id="unread-3"]')).toHaveClass(/read/);
    await expect(page.locator('#pr-unread-count')).toHaveText('0');
});
