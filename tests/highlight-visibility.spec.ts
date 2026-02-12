import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader Highlight Visibility', () => {

    test('[PR-NAV-03] Hovering Parent Link [^] highlights parent when fully visible', async ({ page }) => {
        const parent = {
            _id: 'parent1',
            postedAt: new Date().toISOString(),
            user: { username: 'ParentAuthor', karma: 100 },
            baseScore: 50,
            htmlBody: '<p>Parent content here.</p>',
            pageUrl: 'http://localhost:3000/posts/123/slug?commentId=parent1',
            postId: 'post1',
            extendedScore: {},
            voteCount: 1,
        };
        const child = {
            _id: 'child1',
            postedAt: new Date().toISOString(),
            user: { username: 'ChildAuthor', karma: 10 },
            baseScore: 5,
            htmlBody: '<p>Child content here.</p>',
            pageUrl: 'http://localhost:3000/posts/123/slug?commentId=child1',
            postId: 'post1',
            parentCommentId: 'parent1',
            extendedScore: {},
            voteCount: 1,
        };

        await initPowerReader(page, {
            testMode: true,
            comments: [parent, child]
        });

        const findParentBtn = page.locator('.pr-comment[data-id="child1"] .pr-find-parent');
        await findParentBtn.scrollIntoViewIfNeeded();

        await page.evaluate(() => {
            const btn = document.querySelector('.pr-comment[data-id="child1"] .pr-find-parent') as HTMLElement;
            if (btn) {
                btn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            }
        });

        await page.waitForFunction(() => document.querySelector('.pr-comment[data-id="parent1"]')?.classList.contains('pr-parent-hover'), { timeout: 10000 });
    });

    test('[PR-NAV-02][PR-NAV-04] Parent comment is present and correctly linked', async ({ page }) => {
        const parent = {
            _id: 'parent2',
            postedAt: new Date().toISOString(),
            user: { username: 'ParentAuthor', karma: 100 },
            baseScore: 50,
            htmlBody: '<div style="height: 1000px;">Tall parent content.</div>',
            pageUrl: 'http://localhost:3000/posts/123/slug?commentId=parent2',
            postId: 'post2',
            extendedScore: {},
            voteCount: 1,
        };
        const child = {
            _id: 'child2',
            postedAt: new Date().toISOString(),
            user: { username: 'ChildAuthor', karma: 10 },
            baseScore: 5,
            htmlBody: '<p>Child content here.</p>',
            pageUrl: 'http://localhost:3000/posts/123/slug?commentId=child2',
            postId: 'post2',
            parentCommentId: 'parent2',
            extendedScore: {},
            voteCount: 1,
        };

        const posts = [{
            _id: 'post2',
            title: 'Test Post 2',
            slug: 'test-post-2',
            postedAt: new Date().toISOString(),
            user: { username: 'OpUser', karma: 100 },
            baseScore: 10,
            htmlBody: '<p>Post content.</p>',
        }];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments: [parent, child]
        });

        const parentEl = page.locator('.pr-comment[data-id="parent2"]');
        await expect(parentEl).toBeVisible();
        await expect(parentEl).toContainText('Tall parent content');
        
        const findParentBtn = page.locator('.pr-comment[data-id="child2"] .pr-find-parent');
        await expect(findParentBtn).toBeVisible();
    });

    test('[PR-NAV-05] Hovering Parent Link [^] highlights sticky post header', async ({ page }) => {
        const comment = {
            _id: 'child3',
            postedAt: new Date().toISOString(),
            user: { username: 'ChildAuthor', karma: 10 },
            baseScore: 5,
            htmlBody: '<p>Child content here.</p>',
            pageUrl: 'http://localhost:3000/posts/post3/slug?commentId=child3',
            postId: 'post3',
            parentCommentId: null,
            extendedScore: {},
            voteCount: 1,
        };

        const posts = [{
            _id: 'post3',
            title: 'Sticky Post Test',
            slug: 'sticky-post-test',
            postedAt: new Date().toISOString(),
            user: { username: 'OpUser', karma: 100 },
            baseScore: 10,
            htmlBody: '<div style="height: 2000px;">Long post body to trigger sticky header.</div>',
        }];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments: [comment]
        });

        // Expand the post content naturally by clicking "Read More"
        const readMoreBtn = page.locator('.pr-read-more-btn').first();
        if (await readMoreBtn.isVisible()) {
            await readMoreBtn.click();
        }

        // Scroll down to trigger sticky header
        await page.evaluate(() => {
            const header = document.querySelector('.pr-post-header') as HTMLElement | null;
            if (header) {
                header.scrollIntoView({ block: 'start' });
                window.scrollBy(0, 600);
                window.dispatchEvent(new Event('scroll'));
            }
        });

        await page.waitForTimeout(500);

        // Verify sticky header is visible
        const stickyHeader = page.locator('.pr-sticky-header.visible .pr-post-header[data-post-id="post3"]');
        await expect(stickyHeader).toBeVisible();

        const findParentBtn = page.locator('.pr-comment[data-id="child3"] .pr-find-parent');
        await findParentBtn.scrollIntoViewIfNeeded();

        await page.evaluate(() => {
            const btn = document.querySelector('.pr-comment[data-id="child3"] .pr-find-parent') as HTMLElement;
            if (btn) {
                btn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            }
        });

        // Should highlight the sticky header
        await page.waitForFunction(() => document.querySelector('.pr-sticky-header.visible .pr-post-header[data-post-id="post3"]')?.classList.contains('pr-parent-hover'), { timeout: 10000 });
    });
});