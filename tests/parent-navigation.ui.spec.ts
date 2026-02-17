import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

async function waitAtLeast(ms: number): Promise<void> {
    const start = Date.now();
    await expect.poll(() => Date.now() - start, { timeout: ms + 1000 }).toBeGreaterThanOrEqual(ms);
}

test.describe('Power Reader Parent Navigation', () => {

    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1200, height: 800 });
    });

    test('[PR-NAV-01][PR-NAV-06][PR-NAV-07] Top-level comment navigates to Post Header', async ({ page }) => {
        const post = { _id: 'p1', title: 'Target Post', htmlBody: '<p>Body</p>', user: { username: 'Author' } };
        const comment = {
            _id: 'c1', postId: 'p1', htmlBody: '<p>Top Level</p>',
            postedAt: new Date().toISOString(), baseScore: 1,
            user: { _id: 'u1', username: 'User' },
            post: { _id: 'p1', title: 'Target Post' }, parentComment: null
        };

        await initPowerReader(page, {
            testMode: true,
            comments: [comment],
            posts: [post]
        });

        // Scroll down so post header is likely off screen or at least we can scroll back to it
        await page.evaluate(() => {
            const spacer = document.createElement('div');
            spacer.style.height = '2000px';
            document.body.appendChild(spacer);
            window.scrollTo(0, 500);
        });

        // Click [^]
        const btn = page.locator('.pr-find-parent').first();
        await btn.scrollIntoViewIfNeeded();
        await btn.click();

        // Expect Post Header to have highlight class
        const header = page.locator('.pr-post-header').first();
        await expect(header).toHaveClass(/pr-highlight-parent/);
    });

    test('[PR-NAV-03] Hover highlights fully visible parent (Post)', async ({ page }) => {
        const post = { _id: 'p1', title: 'Target Post', htmlBody: '<p>Short Body</p>', user: { username: 'Author' } };
        const comment = {
            _id: 'c1', postId: 'p1', htmlBody: '<p>Comment</p>',
            postedAt: new Date().toISOString(), baseScore: 1,
            user: { _id: 'u1', username: 'User' },
            post: { _id: 'p1', title: 'Target Post', htmlBody: '<p>Short Body</p>' }, parentComment: null
        };

        await initPowerReader(page, {
            testMode: true,
            storage: { 'helpCollapsed': true },
            comments: [comment],
            posts: [post]
        });

        const btn = page.locator('.pr-find-parent').first();
        const header = page.locator('.pr-post-header').first();

        // Ensure header is visible
        await expect(header).toBeVisible();

        // Trigger hover robustly
        const box = await btn.boundingBox();
        if (!box) throw new Error('No bounding box');
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await btn.dispatchEvent('mouseenter');

        // Should highlight
        await expect(header).toHaveClass(/pr-parent-hover/);

        // Wait for hover delay to ensure no preview appears
        await waitAtLeast(500);

        // Should NOT show preview popup
        const preview = page.locator('.pr-preview-overlay');
        await expect(preview).not.toBeVisible();
    });

    test('[PR-NAV-09] Parent comment is present and correctly linked', async ({ page }) => {
        const post = { _id: 'p1', title: 'Post', htmlBody: '<p>Body</p>', user: { username: 'Author' } };
        const parentComment = {
            _id: 'c1', postId: 'p1', htmlBody: '<div style="height: 2000px;">Huge Parent Comment</div>',
            postedAt: new Date().toISOString(), baseScore: 5,
            user: { _id: 'u1', username: 'ParentUser' },
            post: { _id: 'p1', title: 'Post' }, parentComment: null
        };
        const childComment = {
            _id: 'c2', postId: 'p1', htmlBody: '<p>Child Comment</p>',
            postedAt: new Date().toISOString(), baseScore: 1,
            user: { _id: 'u2', username: 'ChildUser' },
            post: { _id: 'p1', title: 'Post' }, parentComment: { _id: 'c1' },
            parentCommentId: 'c1'
        };

        await initPowerReader(page, {
            testMode: true,
            comments: [parentComment, childComment],
            posts: [post]
        });

        const btn = page.locator('.pr-comment[data-id="c2"] .pr-find-parent').first();
        await expect(btn).toBeVisible();

        const parentEl = page.locator('.pr-comment[data-id="c1"]').first();
        await expect(parentEl).toBeVisible();
        await expect(parentEl).toContainText('Huge Parent Comment');
    });

    test('[PR-NAV-05] Hover highlights sticky post header even if scrolled', async ({ page }) => {
        const post = { _id: 'p1', title: 'Sticky Post', htmlBody: '<div style="height: 2000px;">Body</div>', user: { username: 'Author' } };
        const longBody = '<div style="height: 2000px;">Body</div>';
        const comment = {
            _id: 'c1', postId: 'p1', htmlBody: '<p>Child content</p>',
            postedAt: new Date().toISOString(), baseScore: 1,
            user: { _id: 'u1', username: 'User' },
            post: { _id: 'p1', title: 'Sticky Post', htmlBody: longBody }, parentComment: null
        };

        await initPowerReader(page, {
            testMode: true,
            comments: [comment],
            posts: [post]
        });

        const headerOrig = page.locator('.pr-post[data-id="p1"] .pr-post-header').first();
        await expect(headerOrig).toBeVisible();

        // Scroll so post header is just off-screen
        await page.evaluate(async () => {
            const body = document.querySelector('.pr-post-body-container') as HTMLElement;
            if (body) {
                body.style.height = '2000px';
                body.style.maxHeight = 'none';
            }
            const footer = document.createElement('div');
            footer.style.height = '5000px';
            document.body.appendChild(footer);

            window.scrollTo(0, 800); // Increased scroll to ensure header is definitely gone
            window.dispatchEvent(new Event('scroll'));
            await new Promise(r => setTimeout(r, 100));
            window.dispatchEvent(new Event('scroll'));
        });

        // Wait for scroll cooldown (300ms) in isIntentionalHover
        await waitAtLeast(400);

        // Debug info from browser
        const debugInfo = await page.evaluate(() => {
            const post = document.querySelector('.pr-post');
            const header = post?.querySelector('.pr-post-header');
            const postRect = post?.getBoundingClientRect();
            const headerRect = header?.getBoundingClientRect();
            const vh = window.innerHeight;
            return {
                postTop: postRect?.top,
                postBottom: postRect?.bottom,
                headerTop: headerRect?.top,
                scrollY: window.scrollY,
                vh
            };
        });
        if (process.env.PW_SINGLE_FILE_RUN === 'true') {
            console.log('DEBUG STICKY:', JSON.stringify(debugInfo, null, 2));
        }

        const sticky = page.locator('#pr-sticky-header');
        // Wait specifically for it to be visible and have the visible class
        await expect(sticky).toHaveClass(/visible/, { timeout: 15000 });

        const btn = page.locator('.pr-find-parent').first();
        const btnBox = await btn.boundingBox();
        if (btnBox) {
            await page.mouse.move(0, 0);
            await page.mouse.move(btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2);
            await btn.dispatchEvent('mouseenter');
        } else {
            await btn.hover();
        }

        const headerInSticky = sticky.locator('.pr-post-header').first();
        await expect(headerInSticky).toHaveClass(/pr-parent-hover/);

        await expect(page.locator('.pr-preview-overlay')).not.toBeVisible();
    });

    test('[PR-NAV-09] Hover shows preview for Post that is completely scrolled off-screen', async ({ page }) => {
        const longBody = '<div style="height: 1500px;">Long Content</div>';
        const post = { _id: 'p1', title: 'Target Post', htmlBody: longBody, user: { username: 'Author' } };
        const comment = {
            _id: 'c1', postId: 'p1', htmlBody: '<div style="margin-top: 3000px;">Bottom Comment</div>',
            postedAt: new Date().toISOString(), baseScore: 1,
            user: { _id: 'u1', username: 'User' },
            post: { _id: 'p1', title: 'Target Post', htmlBody: '<p>Body</p>' }, parentComment: null
        };

        await initPowerReader(page, {
            testMode: true,
            comments: [comment],
            posts: [post]
        });

        const btn = page.locator('.pr-find-parent').first();
        const header = page.locator('.pr-post[data-id="p1"] .pr-post-header').first();

        await btn.scrollIntoViewIfNeeded();
        await waitAtLeast(500);

        await expect.poll(async () => {
            const headerBox = await header.boundingBox();
            return headerBox ? headerBox.y + headerBox.height : Number.POSITIVE_INFINITY;
        }).toBeLessThan(0);

        // Hover
        await btn.hover();

        const preview = page.locator('.pr-preview-overlay');
        await expect(preview).toBeVisible();
        await expect(preview).toContainText('Target Post');
    });
});
