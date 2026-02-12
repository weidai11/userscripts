import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader Parent Highlighting', () => {

    test('[PR-NAV-02.1] Parent highlight activates correctly for COMMENTS', async ({ page }) => {
        // Setup with a parent comment and a child comment
        await initPowerReader(page, {
            testMode: true,
            comments: [
                {
                    _id: 'parent-1',
                    postId: 'p1',
                    htmlBody: '<p>Parent content</p>',
                    postedAt: new Date().toISOString(),
                    user: { _id: 'u1', username: 'ParentAuthor' },
                    post: { _id: 'p1', title: 'Post' }
                },
                {
                    _id: 'child-1',
                    postId: 'p1',
                    htmlBody: '<p>Child content</p>',
                    postedAt: new Date().toISOString(),
                    parentCommentId: 'parent-1',
                    user: { _id: 'u2', username: 'ChildAuthor' },
                    post: { _id: 'p1', title: 'Post' }
                }
            ]
        });

        // 1. Locate the parent and child elements
        const parentComment = page.locator('.pr-comment[data-id="parent-1"]');
        const childComment = page.locator('.pr-comment[data-id="child-1"]');
        const findParentBtn = childComment.locator('.pr-find-parent');

        await expect(parentComment).toBeVisible();
        await expect(childComment).toBeVisible();

        // 2. Ensure parent is visible in viewport so highlighting logic activates (instead of preview)
        // (default viewport should show both given how short they are)

        // 3. Hover over the [^] find parent button
        // 3. Disable animations/transitions to ensure instant style application
        await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });

        // 4. Hover over the [^] find parent button
        await findParentBtn.hover();

        // 5. Verify the background color is actually yellow (computed style check)
        // #ffe066 is rgb(255, 224, 102)
        await expect(parentComment).toHaveCSS('background-color', 'rgb(255, 224, 102)');
    });


    test('[PR-NAV-02.2] Parent highlight activates correctly for POSTS', async ({ page }) => {
        // Setup with a parent POST and a child comment
        await initPowerReader(page, {
            testMode: true,
            comments: [
                {
                    _id: 'top-level-1',
                    postId: 'p1',
                    htmlBody: '<p>Top level content</p>',
                    postedAt: new Date().toISOString(),
                    user: { _id: 'u2', username: 'CommentAuthor' },
                    post: { _id: 'p1', title: 'Parent Post Title' }
                }
            ],
            posts: [
                {
                    _id: 'p1',
                    title: 'Parent Post Title',
                    htmlBody: '<p>Full Post Body Content</p>',
                    postedAt: new Date().toISOString(),
                    user: { _id: 'u2', username: 'CommentAuthor' }
                }
            ]
        });

        // 1. Locate the post header and comment
        const postHeader = page.locator('.pr-post[data-post-id="p1"] .pr-post-header');
        const comment = page.locator('.pr-comment[data-id="top-level-1"]');
        const findParentBtn = comment.locator('.pr-find-parent');

        await expect(postHeader).toBeVisible();
        await expect(comment).toBeVisible();

        // 3. Disable animations/transitions to ensure instant style application
        await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });

        // 4. Hover over the [^] find parent button
        await findParentBtn.hover();

        // 5. Verify the background color is actually yellow (computed style check)
        // Check class first to narrow down the issue
        await expect(postHeader).toHaveClass(/pr-parent-hover/);
        // #ffe066 is rgb(255, 224, 102)
        await expect(postHeader).toHaveCSS('background-color', 'rgb(255, 224, 102)');
    });

    test('[PR-NAV-02.2][PR-NAV-02.3] Parent highlight syncs correctly for sticky header AND post body', async ({ page }) => {
        // Setup with a long post so sticky header activates
        await initPowerReader(page, {
            testMode: true,
            comments: [
                {
                    _id: 'c1',
                    postId: 'p1',
                    htmlBody: '<p>Comment far down</p>',
                    postedAt: new Date().toISOString(),
                    user: { _id: 'u2', username: 'CommentAuthor' },
                    post: { _id: 'p1', title: 'Parent Post Title' }
                }
            ],
            posts: [
                {
                    _id: 'p1',
                    title: 'Parent Post Title',
                    // Very tall content to force scrolling
                    htmlBody: `<div style="height: 2000px;">Tall content</div>`,
                    postedAt: new Date().toISOString(),
                    user: { _id: 'u2', username: 'CommentAuthor' }
                }
            ]
        });

        const stickyHeader = page.locator('.pr-sticky-header');
        const postBody = page.locator('.pr-post-body-container');
        const comment = page.locator('.pr-comment[data-id="c1"]');
        const findParentBtn = comment.locator('.pr-find-parent');

        // Expand the post content naturally by clicking "Read More"
        const readMoreBtn = page.locator('.pr-read-more-btn').first();
        if (await readMoreBtn.isVisible()) {
            await readMoreBtn.click();
        }

        // Scroll down to activate sticky header
        await page.evaluate(() => {
            const header = document.querySelector('.pr-post-header') as HTMLElement | null;
            if (header) {
                header.scrollIntoView({ block: 'start' });
                window.scrollBy(0, 600);
                window.dispatchEvent(new Event('scroll'));
            }
        });
        await page.waitForTimeout(500); // Scroll cooldown for intentionality

        // Wait for sticky header to appear
        await expect(stickyHeader).toHaveClass(/visible/);

        // Disable animations
        await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });

        // Hover over [^]
        await page.mouse.move(0, 0); // Ground zero
        await page.mouse.move(50, 50); // Move enough to trigger intentionality
        await findParentBtn.hover();
        await findParentBtn.dispatchEvent('mouseenter');

        // Expect sticky header to be highlighted inside
        const stickyPostHeader = stickyHeader.locator('.pr-post-header');
        await expect(stickyPostHeader).toHaveClass(/pr-parent-hover/);
        await expect(stickyPostHeader).toHaveCSS('background-color', 'rgb(255, 224, 102)');

        // Expect post body to ALSO be highlighted
        await expect(postBody).toHaveClass(/pr-parent-hover/);
        await expect(postBody).toHaveCSS('background-color', 'rgb(255, 224, 102)');
    });
});
