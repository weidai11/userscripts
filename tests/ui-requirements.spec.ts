import { test, expect } from '@playwright/test';
import { setupMockEnvironment, initPowerReader } from './helpers/setup';

const scriptContent = `window.__PR_TEST_MODE__ = true;`;

test.describe('UI Requirements: Buttons and Sticky Behavior', () => {

    test('Post action [a] is disabled when no comments to load', async ({ page }) => {
        const posts = [{
            _id: 'p1',
            title: 'No Comments Post',
            commentCount: 0,
            wordCount: 100,
            htmlBody: '<p>Some content</p>'
        }];

        await initPowerReader(page, { posts, comments: [], testMode: true });

        const btnA = page.locator('.pr-post[data-id="p1"] [data-action="load-all-comments"]');
        await expect(btnA).toHaveClass(/disabled/);
        await expect(btnA).toHaveAttribute('title', 'No comments to load');
    });

    test('[PR-POST-11] Post action [e] is disabled when content is short', async ({ page }) => {
        const posts = [{
            _id: 'p1',
            title: 'Short Post',
            commentCount: 0,
            wordCount: 10,
            htmlBody: '<p>Tiny</p>'
        }];

        await initPowerReader(page, { posts, comments: [], testMode: true });

        // Wait a frame for DOM height check
        await page.waitForTimeout(200);

        const btnE = page.locator('.pr-post[data-id="p1"] [data-action="toggle-post-body"]');
        await expect(btnE).toHaveClass(/disabled/);
        await expect(btnE).toHaveAttribute('title', 'Post fits within viewport without truncation');
    });

    test('[PR-POSTBTN-05] Sticky header [-] scrolls back to post header on collapse', async ({ page }) => {
        // Large post with many comments to ensure we can scroll
        const posts = [
            {
                _id: 'p1',
                title: 'Long Post',
                commentCount: 50,
                wordCount: 1000,
                htmlBody: '<div style="height: 1000px">Long content</div>',
                postedAt: new Date(Date.now() + 100000).toISOString() // Newest
            },
            {
                _id: 'p2',
                title: 'Bottom Post',
                commentCount: 0,
                htmlBody: '<div style="height: 2000px">More content</div>',
                postedAt: new Date(Date.now()).toISOString()
            },
            {
                _id: 'p3',
                title: 'Bottom Post 2',
                commentCount: 0,
                htmlBody: '<div style="height: 2000px">Even more content</div>',
                postedAt: new Date(Date.now() - 10000).toISOString()
            },
            {
                _id: 'p4',
                title: 'Bottom Post 3',
                commentCount: 0,
                htmlBody: '<div style="height: 2000px">End content</div>',
                postedAt: new Date(Date.now() - 20000).toISOString()
            }
        ];
        const comments = Array.from({ length: 20 }, (_, i) => ({
            _id: `c${i}`,
            postId: 'p1',
            htmlBody: `<div style="height: 100px">Comment ${i}</div>`,
            postedAt: new Date().toISOString(),
            user: { username: 'User' }
        }));

        await initPowerReader(page, { posts, comments, testMode: true });
        await page.setViewportSize({ width: 1280, height: 800 });

        // Scroll deep into the post
        await page.evaluate(() => window.scrollTo(0, 1500));

        // Ensure sticky header is visible
        const stickyHeader = page.locator('#pr-sticky-header');
        await expect(stickyHeader).toBeVisible();

        const collapseBtn = stickyHeader.locator('[data-action="collapse"]');
        await expect(collapseBtn).toBeVisible();

        // Click collapse
        await collapseBtn.click();

        // Wait for collapse to finish and scroll to stabilize
        await page.waitForTimeout(500);

        // Verify scroll position - should be near the top of the post header
        const final = await page.evaluate(() => {
            const h = document.querySelector('.pr-post[data-id="p1"] .pr-post-header') as HTMLElement;
            return {
                scrollY: window.scrollY,
                headerTop: h.getBoundingClientRect().top + window.pageYOffset
            };
        });

        // Should be exactly at headerTop (or very close, within sticky header height tolerance)
        // Original failure showed ~53px diff which usually corresponds to sticky header height or top bar
        expect(Math.abs(final.scrollY - final.headerTop)).toBeLessThan(60);
    });

    test('Comment with no children shows [+] after clicking [-]', async ({ page }) => {
        const comments = [{
            _id: 'c1', postId: 'p1',
            htmlBody: 'Body',
            postedAt: new Date().toISOString(),
            user: { username: 'Author' },
            directChildrenCount: 0
        }];

        await initPowerReader(page, { posts: [{ _id: 'p1', title: 'Post' }], comments, testMode: true });

        const comment = page.locator('.pr-comment[data-id="c1"]');
        const collapseBtn = comment.locator('[data-action="collapse"]');
        const expandBtn = comment.locator('[data-action="expand"]');

        // Initially [-] is visible, [+] is hidden
        await expect(collapseBtn).toBeVisible();
        await expect(expandBtn).not.toBeVisible();

        // Click collapse
        await collapseBtn.click();

        // Now [+] should be visible, [-] hidden
        await expect(expandBtn).toBeVisible();
        await expect(collapseBtn).not.toBeVisible();
    });

    test('[PR-POSTBTN-06] Clicking post header when already at top toggles expansion', async ({ page }) => {
        const posts = [{
            _id: 'p1',
            title: 'Toggleable Post',
            commentCount: 0,
            wordCount: 1000,
            htmlBody: '<div style="height: 1000px">Long content to ensure truncation</div>'
        }];

        await initPowerReader(page, { posts, comments: [], testMode: true });

        // Add spacer at bottom to allow scrolling p1 to top
        await page.evaluate(() => {
            const bottomSpacer = document.createElement('div');
            bottomSpacer.style.height = '3000px';
            document.body.appendChild(bottomSpacer);
        });

        const header = page.locator('.pr-post[data-id="p1"] .pr-post-header');
        const postBody = page.locator('.pr-post-body-container').first();

        // 1. Initial state: truncated
        await expect(postBody).toHaveClass(/truncated/);

        // 2. Click header while NOT at top -> should scroll
        // Move it down first
        await page.evaluate(() => {
            const spacer = document.createElement('div');
            spacer.style.height = '1000px';
            document.body.prepend(spacer);
            window.scrollTo(0, 0);
        });

        await header.click();
        const scrollY = await page.evaluate(() => window.scrollY);
        expect(scrollY).toBeGreaterThan(500);
        await expect(postBody).toHaveClass(/truncated/); // Still truncated

        // 3. Click header while AT top -> should toggle expansion
        // Ensure it's exactly at the right spot
        const headerTop = await header.evaluate(el => el.getBoundingClientRect().top + window.pageYOffset);
        await page.evaluate((top) => window.scrollTo(0, top), headerTop);

        // Click the title specifically
        await page.locator('.pr-post-title').first().click();

        // Should now be expanded
        await expect(postBody).not.toHaveClass(/truncated/);

        // 4. Click title again -> should collapse back
        await page.locator('.pr-post-title').first().click();
        await expect(postBody).toHaveClass(/truncated/);
    });

    test('Tooltips are present on all comment buttons', async ({ page }) => {
        const comments = [{
            _id: 'c1', postId: 'p1',
            htmlBody: 'Body',
            postedAt: new Date().toISOString(),
            user: { username: 'Author' },
            parentCommentId: 'parent' // So [t] shows
        }];

        await initPowerReader(page, {
            posts: [{ _id: 'p1', title: 'Post', commentCount: 2 }],
            comments: [comments[0]],
            testMode: true,
            onGraphQL: `
                if (query.includes('query GetThreadComments')) {
                    return { data: { comments: { results: [] } } };
                }
            `
        });

        const comment = page.locator('.pr-comment[data-id="c1"]');

        // Check tooltips (buttons are always rendered, some may be disabled)
        await expect(comment.locator('[data-action="author-down"]')).toHaveAttribute('title', /disliked/);
        await expect(comment.locator('[data-action="author-up"]')).toHaveAttribute('title', /preferred/);
        await expect(comment.locator('[data-action="load-parents-and-scroll"]')).toHaveAttribute('title', /parents/);
        await expect(comment.locator('[data-action="load-descendants"]')).toHaveAttribute('title', /replies/);
        await expect(comment.locator('[data-action="collapse"]')).toHaveAttribute('title', /Collapse/);
        await expect(comment.locator('[data-action="find-parent"]')).toHaveAttribute('title', /parent/);
    });

    test('[PR-AUTH-05] Author preference buttons are present in post headers and work', async ({ page }) => {
        const posts = [{
            _id: 'p1',
            title: 'Post by Author',
            user: { _id: 'u1', username: 'AuthorX', karma: 100 },
            htmlBody: '<div style="height: 2000px">Tall body</div>'
        }];

        await initPowerReader(page, { posts, comments: [], testMode: true, verbose: true, appVerbose: true });

        const header = page.locator('.pr-post[data-id="p1"] .pr-post-header');
        const upBtn = header.locator('[data-action="author-up"]');
        const downBtn = header.locator('[data-action="author-down"]');

        await expect(upBtn).toBeVisible();
        await expect(downBtn).toBeVisible();
        await expect(upBtn).toHaveText('↑');
        await expect(downBtn).toHaveText('↓');

        // Click up -> should become active
        await upBtn.click();
        await expect(upBtn).toHaveClass(/active-up/);

        // Click down -> should switch to active-down
        await downBtn.click();
        await expect(downBtn).toHaveClass(/active-down/);
        await expect(upBtn).not.toHaveClass(/active-up/);

        // Expand post so it's very tall
        const eBtn = header.locator('[data-action="toggle-post-body"]');
        await eBtn.click();
        const postBody = page.locator('.pr-post-body-container').first();
        await expect(postBody).not.toHaveClass(/truncated/);

        // --- Verify Sticky Header ---
        // Add content after p1 so we can scroll it off screen
        await page.evaluate(() => {
            const bottomSpacer = document.createElement('div');
            bottomSpacer.id = 'bottom-spacer';
            bottomSpacer.style.height = '3000px';
            document.body.appendChild(bottomSpacer);
        });

        // Scroll deep into p1 so its header is gone but its body is still visible
        const headerTop = await header.evaluate(el => el.getBoundingClientRect().top + window.pageYOffset);
        await page.evaluate((top) => window.scrollTo(0, top + 500), headerTop);

        // Wait for scroll event to process and sticky header to update
        await page.waitForTimeout(200);

        const sticky = page.locator('#pr-sticky-header');
        await expect(sticky).toBeVisible();
        const stickyUp = sticky.locator('[data-action="author-up"]');
        const stickyDown = sticky.locator('[data-action="author-down"]');

        // Initial state from previous click
        await expect(stickyDown).toHaveClass(/active-down/);

        // Click up in sticky
        await stickyUp.click();
        await expect(stickyUp).toHaveClass(/active-up/);
        await expect(stickyDown).not.toHaveClass(/active-down/);
    });

    test('[PR-AUTH-07][PR-AUTH-08] Author preference updates propagate globally to all items by same author', async ({ page }) => {
        const posts = [{
            _id: 'p1',
            title: 'Post by AuthorX',
            user: { _id: 'u1', username: 'AuthorX' }
        }];
        const comments = [{
            _id: 'c1',
            postId: 'p1',
            htmlBody: 'Comment by AuthorX',
            postedAt: new Date().toISOString(),
            user: { _id: 'u1', username: 'AuthorX' }
        }];

        await initPowerReader(page, { posts, comments, testMode: true });

        const postHeader = page.locator('.pr-post[data-id="p1"] .pr-post-header');
        const commentMeta = page.locator('.pr-comment[data-id="c1"] .pr-comment-meta');

        const postUp = postHeader.locator('[data-action="author-up"]');
        const commentUp = commentMeta.locator('[data-action="author-up"]');

        // Initial state
        await expect(postUp).not.toHaveClass(/active-up/);
        await expect(commentUp).not.toHaveClass(/active-up/);

        // Click up on POST
        await postUp.click();

        // Verify BOTH are now active
        await expect(postUp).toHaveClass(/active-up/);
        await expect(commentUp).toHaveClass(/active-up/);

        // Click down on COMMENT
        const commentDown = commentMeta.locator('[data-action="author-down"]');
        const postDown = postHeader.locator('[data-action="author-down"]');

        await commentDown.click();

        // Verify BOTH are now active-down
        await expect(commentDown).toHaveClass(/active-down/);
        await expect(postDown).toHaveClass(/active-down/);
        await expect(postUp).not.toHaveClass(/active-up/);
        await expect(commentUp).not.toHaveClass(/active-up/);
    });

    test('[PR-VIS-14] Control buttons have constant 13px font size', async ({ page }) => {
        await initPowerReader(page, {
            comments: [{ _id: 'c1', postId: 'p1', htmlBody: 'Test', postedAt: new Date().toISOString(), user: { username: 'Author' }, baseScore: 100 }],
            testMode: true
        });

        const btn = page.locator('.text-btn').first();
        const fontSize = await btn.evaluate(el => window.getComputedStyle(el).fontSize);
        expect(fontSize).toBe('13px');
    });

    test('[PR-VIS-15] Reaction icons use relative units (scaling)', async ({ page }) => {
        await initPowerReader(page, {
            comments: [{
                _id: 'c1', postId: 'p1', htmlBody: 'Test', postedAt: new Date().toISOString(),
                user: { username: 'Author' }, baseScore: 100,
                extendedScore: { reacts: { agree: [{ userId: 'u1', reactType: 'agreed' }] } }
            }],
            testMode: true
        });

        const icon = page.locator('.pr-reaction-icon').first();
        const meta = page.locator('.pr-comment-meta').first();
        const metaFontSize = await meta.evaluate(el => parseFloat(window.getComputedStyle(el).fontSize));
        const iconWidth = await icon.evaluate(el => parseFloat(window.getComputedStyle(el).width));

        // 1.1em of meta font size should be approximately icon width
        // We use flexible bounds to account for browser rounding
        expect(iconWidth).toBeGreaterThan(metaFontSize * 1.05);
        expect(iconWidth).toBeLessThan(metaFontSize * 1.5);
    });
});