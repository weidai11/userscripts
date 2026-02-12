import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

async function setupDefault(page: any, commentCount: number = 20) {
    const p1PostedAt = new Date(Date.now() - 500000).toISOString();
    const p2PostedAt = new Date(Date.now() - 1000000).toISOString();

    const comments = [];
    for (let i = 0; i < commentCount; i++) {
        comments.push({
            _id: `p1-comment-${i}`,
            postId: 'p1',
            pageUrl: `https://www.lesswrong.com/posts/p1/first-post?commentId=${i}`,
            htmlBody: `<p>Comment ${i + 1} for first post. Lorem ipsum dolor sit amet.</p>`,
            postedAt: new Date(Date.now() - i * 1000).toISOString(),
            baseScore: 10,
            user: { _id: 'u1', slug: 'user-1', username: 'User1', karma: 500 },
            post: { _id: 'p1', title: 'First Post With Many Comments', slug: 'first-post', postedAt: p1PostedAt }
        });
    }
    // Second post (p2)
    for (let i = 0; i < 3; i++) {
        comments.push({
            _id: `p2-comment-${i}`,
            postId: 'p2',
            pageUrl: `https://www.lesswrong.com/posts/p2/second-post?commentId=${i}`,
            htmlBody: `<p>Comment ${i + 1} for second post.</p>`,
            postedAt: new Date(Date.now() - 100000 - i * 1000).toISOString(),
            baseScore: 10,
            user: { _id: 'u2', slug: 'user-2', username: 'User2', karma: 500 },
            post: { _id: 'p2', title: 'Second Post Title', slug: 'second-post', postedAt: p2PostedAt }
        });
    }

    const posts = [
        {
            _id: 'p1',
            title: 'First Post With Many Comments',
            slug: 'first-post',
            pageUrl: 'https://www.lesswrong.com/posts/p1/first-post',
            postedAt: p1PostedAt,
            htmlBody: '<div style="height: 2200px;">Long post body to keep [e] enabled in sticky-header tests.</div>',
            baseScore: 50,
            voteCount: 10,
            commentCount,
            user: { _id: 'u1', slug: 'user-1', username: 'User1', karma: 500 },
        },
        {
            _id: 'p2',
            title: 'Second Post Title',
            slug: 'second-post',
            pageUrl: 'https://www.lesswrong.com/posts/p2/second-post',
            postedAt: p2PostedAt,
            htmlBody: '<p>Second post body.</p>',
            baseScore: 20,
            voteCount: 5,
            commentCount: 3,
            user: { _id: 'u2', slug: 'user-2', username: 'User2', karma: 500 },
        }
    ];

    await initPowerReader(page, {
        testMode: true,
        comments,
        posts
    });
}

test.describe('Sticky Header Feature', () => {

    test('[PR-STICKY-01][PR-STICKY-02][PR-STICKY-03] sticky header appears when scrolling past post header', async ({ page }) => {
        await setupDefault(page, 20);

        const stickyHeader = page.locator('#pr-sticky-header');
        await expect(stickyHeader).not.toHaveClass(/visible/);

        const postHeader = page.locator('.pr-post-header').first();
        await expect(postHeader).toBeVisible();

        await page.evaluate(() => {
            const header = document.querySelector('.pr-post-header') as HTMLElement;
            header.scrollIntoView({ block: 'start' });
            window.scrollBy(0, 500);
            window.dispatchEvent(new Event('scroll'));
        });

        await expect(stickyHeader).toHaveClass(/visible/, { timeout: 10000 });
        await expect(stickyHeader.locator('h2')).toContainText('First Post With Many Comments');
    });

    test('[PR-STICKY-01] sticky header disappears when scrolling back to top', async ({ page }) => {
        await setupDefault(page, 20);

        const stickyHeader = page.locator('#pr-sticky-header');

        await page.evaluate(() => {
            const header = document.querySelector('.pr-post-header') as HTMLElement;
            header.scrollIntoView({ block: 'start' });
            window.scrollBy(0, 500);
            window.dispatchEvent(new Event('scroll'));
        });

        await expect(stickyHeader).toHaveClass(/visible/, { timeout: 10000 });

        await page.evaluate(() => {
            window.scrollTo(0, 0);
            window.dispatchEvent(new Event('scroll'));
        });

        await expect(stickyHeader).not.toHaveClass(/visible/, { timeout: 5000 });
    });

    test('[PR-STICKY-06] clicking sticky header scrolls back to original header and disappears', async ({ page }) => {
        await setupDefault(page, 20);

        const stickyHeader = page.locator('#pr-sticky-header');

        await page.evaluate(() => {
            const header = document.querySelector('.pr-post-header') as HTMLElement;
            header.scrollIntoView({ block: 'start' });
            window.scrollBy(0, 500);
            window.dispatchEvent(new Event('scroll'));
        });

        await expect(stickyHeader).toHaveClass(/visible/, { timeout: 10000 });

        await stickyHeader.locator('.pr-post-header').click({ position: { x: 10, y: 10 } });

        // Wait for it to disappear
        await expect(stickyHeader).not.toHaveClass(/visible/, { timeout: 5000 });

        const top = await page.evaluate(() => {
            const header = document.querySelector('.pr-post-header') as HTMLElement;
            return Math.abs(header.getBoundingClientRect().top);
        });
        expect(top).toBeLessThan(110); // Higher tolerance for sticky header height
    });

    test('[PR-STICKY-04] date link in sticky header has target="_blank"', async ({ page }) => {
        await setupDefault(page, 20);

        const stickyHeader = page.locator('#pr-sticky-header');

        await page.evaluate(() => {
            const header = document.querySelector('.pr-post-header') as HTMLElement;
            header.scrollIntoView({ block: 'start' });
            window.scrollBy(0, 500);
            window.dispatchEvent(new Event('scroll'));
        });

        await expect(stickyHeader).toHaveClass(/visible/, { timeout: 10000 });

        const dateLink = stickyHeader.locator('.pr-timestamp a');
        await expect(dateLink).toHaveAttribute('target', '_blank');
    });

    test('[PR-STICKY-07] collapse button in sticky header collapses post content', async ({ page }) => {
        await setupDefault(page, 20);

        const stickyHeader = page.locator('#pr-sticky-header');

        await page.evaluate(() => {
            const header = document.querySelector('.pr-post-header') as HTMLElement;
            header.scrollIntoView({ block: 'start' });
            window.scrollBy(0, 500);
            window.dispatchEvent(new Event('scroll'));
        });

        await expect(stickyHeader).toHaveClass(/visible/, { timeout: 10000 });

        await stickyHeader.locator('[data-action="collapse"]').click();

        // Wait for click handler to run
        await page.waitForTimeout(500);

        // The post comments should be collapsed
        const firstPost = page.locator('.pr-post').first();
        await expect(firstPost.locator('.pr-post-comments')).toHaveClass(/collapsed/, { timeout: 5000 });
    });

    test('[PR-POSTBTN-01] [e] button in sticky header scrolls to original post', async ({ page }) => {
        await setupDefault(page, 20);

        const stickyHeader = page.locator('#pr-sticky-header');

        // Scroll down to show sticky header
        await page.evaluate(() => {
            const header = document.querySelector('.pr-post-header') as HTMLElement;
            header.scrollIntoView({ block: 'start' });
            window.scrollBy(0, 1000); // 1000px past header
            window.dispatchEvent(new Event('scroll'));
        });

        await expect(stickyHeader).toHaveClass(/visible/, { timeout: 10000 });

        // Click the [e] button in the sticky header
        const expandBtn = stickyHeader.locator('[data-action="toggle-post-body"]');
        await expect(expandBtn).toBeVisible();
        await expandBtn.click();

        // Verify we scrolled back to top
        const top = await page.evaluate(() => {
            const header = document.querySelector('.pr-post-header') as HTMLElement;
            return Math.abs(header.getBoundingClientRect().top);
        });
        expect(top).toBeLessThan(110);
    });

    test('[PR-POSTBTN-01] [e] button in regular header DOES NOT scroll', async ({ page }) => {
        await setupDefault(page, 20);

        // Get initial scroll position
        const initialScrollY = await page.evaluate(() => window.scrollY);

        // Click the [e] button in the regular header
        const expandBtn = page.locator('.pr-post .pr-post-header [data-action="toggle-post-body"]').first();
        await expect(expandBtn).toBeVisible();
        await expandBtn.click();

        // Verify scroll position hasn't changed much
        const newScrollY = await page.evaluate(() => window.scrollY);
        expect(Math.abs(newScrollY - initialScrollY)).toBeLessThan(5);
    });

    test('[PR-STICKY-08] interactive elements in sticky header work normally without scrolling', async ({ page }) => {
        await setupDefault(page, 20);

        const stickyHeader = page.locator('#pr-sticky-header');

        // Scroll down to show sticky header
        await page.evaluate(() => {
            const header = document.querySelector('.pr-post-header') as HTMLElement;
            header.scrollIntoView({ block: 'start' });
            window.scrollBy(0, 500); // 500px past header
            window.dispatchEvent(new Event('scroll'));
        });

        await expect(stickyHeader).toHaveClass(/visible/, { timeout: 10000 });

        // Get initial scroll position
        const initialScrollY = await page.evaluate(() => window.scrollY);

        // Click the "Add Reaction" button in the sticky header
        const addReactionBtn = stickyHeader.locator('.pr-add-reaction-btn').first();
        await expect(addReactionBtn).toBeVisible();
        await addReactionBtn.click();

        // Verify the reaction picker opened
        const reactionPicker = page.locator('#pr-global-reaction-picker');
        await expect(reactionPicker).toHaveClass(/visible/);

        // Verify we DID NOT scroll back to top (scroll position should be roughly same)
        const newScrollY = await page.evaluate(() => window.scrollY);
        expect(Math.abs(newScrollY - initialScrollY)).toBeLessThan(10); // allow tiny variations
    });
});

test.describe('External Links Feature', () => {

    test('timestamp links open in new tab', async ({ page }) => {
        await setupDefault(page);
        const timestampLink = page.locator('.pr-post-header .pr-timestamp a').first();
        await expect(timestampLink).toHaveAttribute('target', '_blank');
    });

    test('comment links to lesswrong.com open in new tab', async ({ page }) => {
        await setupDefault(page);
        const contextLink = page.locator('.pr-timestamp a').first();
        await expect(contextLink).toHaveAttribute('target', '_blank');
    });
});
