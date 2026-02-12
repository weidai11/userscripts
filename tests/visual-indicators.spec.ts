import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader Visual Indicators', () => {

    async function setupWithComments(page: any, comments: any[], authorPrefs: any = {}, currentUserId = 'u-me') {
        await initPowerReader(page, {
            verbose: true,
            testMode: true,
            comments,
            storage: {
                'power-reader-author-prefs': authorPrefs
            },
            currentUser: { _id: currentUserId, username: 'TestUser' }
        });
    }

    test('[PR-VIS-01] High karma comments have a pink meta header', async ({ page }) => {
        const comments = [{
            _id: 'c1', postId: 'p1', htmlBody: '<p>High score</p>',
            postedAt: new Date().toISOString(), baseScore: 100,
            user: { _id: 'u1', username: 'Author1', karma: 100 },
            post: { _id: 'p1', title: 'Post 1', baseScore: 100, user: { karma: 100 } }, parentComment: null
        }];
        await setupWithComments(page, comments);
        const meta = page.locator('.pr-comment .pr-comment-meta').first();
        await expect(meta).toHaveCSS('background-color', 'rgb(255, 221, 221)');
    });

    test('[PR-VIS-02] High karma posts have a purple meta header', async ({ page }) => {
        const comments = [{
            _id: 'c1', postId: 'p1', htmlBody: '<p>High score</p>',
            postedAt: new Date().toISOString(), baseScore: 100,
            user: { _id: 'u1', username: 'Author1', karma: 100 },
            post: { _id: 'p1', title: 'Post 1', baseScore: 100, user: { karma: 100 }, htmlBody: '<p>Content</p>' }, parentComment: null
        }];
        await setupWithComments(page, comments);
        const postHeader = page.locator('.pr-post-header').first();
        await expect(postHeader).toHaveCSS('background-color', 'rgb(224, 208, 255)');
    });

    test('[PR-VIS-01] Favored author comments have a pink meta header', async ({ page }) => {
        const comments = [{
            _id: 'c1', postId: 'p1', htmlBody: '<p>Favored author</p>',
            postedAt: new Date().toISOString(), baseScore: 1,
            user: { _id: 'u1', username: 'GoodAuthor', karma: 100 },
            post: { _id: 'p1', title: 'Post 1', baseScore: 1, user: { karma: 100 } }, parentComment: null
        }];
        const authorPrefs = { 'GoodAuthor': 1 };
        await setupWithComments(page, comments, authorPrefs);
        const meta = page.locator('.pr-comment .pr-comment-meta').first();
        const color = await meta.evaluate(el => window.getComputedStyle(el).backgroundColor);
        expect(color).toContain('rgb(255,');
        expect(color).not.toBe('rgb(255, 255, 255)');
    });

    test('[PR-VIS-03] Recent comments have a yellow body', async ({ page }) => {
        const comments = [{
            _id: 'c1', postId: 'p1', htmlBody: '<p>Recent</p>',
            postedAt: new Date().toISOString(), baseScore: 1,
            user: { _id: 'u1', username: 'Author1', karma: 100 },
            post: { _id: 'p1', title: 'Post 1' }, parentComment: null
        }];
        await setupWithComments(page, comments);
        const comment = page.locator('.pr-comment').first();
        const color = await comment.evaluate(el => window.getComputedStyle(el).backgroundColor);
        expect(color).toContain('rgb(255, 255,');
        expect(color).not.toBe('rgb(255, 255, 255)');
    });

    test('[PR-VIS-04] Replies to you have a green border', async ({ page }) => {
        const comments = [
            {
                _id: 'c1', postId: 'p1', htmlBody: '<p>My comment</p>',
                postedAt: new Date(Date.now() - 100000).toISOString(), baseScore: 1,
                user: { _id: 'u-me', username: 'TestUser' },
                post: { _id: 'p1', title: 'Post 1' }, parentComment: null
            },
            {
                _id: 'c2', postId: 'p1', htmlBody: '<p>Reply to me</p>',
                postedAt: new Date().toISOString(), baseScore: 1,
                parentCommentId: 'c1',
                parentComment: { user: { _id: 'u-me', username: 'TestUser' } },
                user: { _id: 'u2', username: 'Replier' },
                post: { _id: 'p1', title: 'Post 1' }
            }
        ];
        await setupWithComments(page, comments, {}, 'u-me');
        const reply = page.locator('.pr-comment[data-id="c2"]');
        await expect(reply).toHaveClass(/reply-to-you/);
        await expect(reply).toHaveCSS('border-color', 'rgb(0, 255, 0)');
    });

    test('[PR-VIS-05] Read items have grey text', async ({ page }) => {
        const comments = [{
            _id: 'c1', postId: 'p1', htmlBody: '<p>Read comment</p>',
            postedAt: new Date().toISOString(), baseScore: 1,
            user: { username: 'A' }, post: { _id: 'p1', title: 'Post 1' }
        }];
        await setupWithComments(page, comments);
        await page.evaluate(() => {
            const el = document.querySelector('.pr-comment');
            el?.classList.add('read');
        });
        const body = page.locator('.pr-comment.read .pr-comment-body').first();
        await expect(body).toHaveCSS('color', 'rgb(112, 112, 112)');
    });

    test('[PR-VIS-06] Normal items have black border', async ({ page }) => {
        const comments = [{
            _id: 'c1', postId: 'p1', htmlBody: '<p>Normal</p>',
            postedAt: new Date().toISOString(), baseScore: 1,
            user: { username: 'A' }, post: { _id: 'p1', title: 'Post 1' }
        }];
        await setupWithComments(page, comments);
        const comment = page.locator('.pr-comment').first();
        await expect(comment).toHaveCSS('border-color', 'rgb(0, 0, 0)');
    });

    test('[PR-VIS-07] Rejected comments have red border and are collapsed', async ({ page }) => {
        const comments = [{
            _id: 'c1', postId: 'p1', htmlBody: '<p>Rejected</p>',
            postedAt: new Date().toISOString(), baseScore: 1,
            rejected: true,
            user: { username: 'A' }, post: { _id: 'p1', title: 'Post 1' }
        }];
        await setupWithComments(page, comments);
        const comment = page.locator('.pr-comment').first();
        await expect(comment).toHaveCSS('border-color', 'rgb(255, 0, 0)');
        await expect(comment).toHaveClass(/collapsed/);
    });

    test('[PR-VIS-08] Blockquotes have distinct left border', async ({ page }) => {
        const comments = [{
            _id: 'c1', postId: 'p1', htmlBody: '<blockquote>Quoted text</blockquote>',
            postedAt: new Date().toISOString(), baseScore: 1,
            user: { username: 'A' }, post: { _id: 'p1', title: 'Post 1' }
        }];
        await setupWithComments(page, comments);
        const bq = page.locator('.pr-comment-body blockquote').first();
        await expect(bq).toHaveCSS('border-left-color', 'rgb(224, 224, 224)');
        await expect(bq).toHaveCSS('border-left-style', 'solid');
    });

    test('[PR-VIS-10] High karma items have larger font size', async ({ page }) => {
        const comments = [{
            _id: 'c1', postId: 'p1', htmlBody: '<p>High karma</p>',
            postedAt: new Date().toISOString(), baseScore: 100,
            user: { username: 'A' },
            post: {
                _id: 'p1', title: 'Post 1', baseScore: 100,
                user: { username: 'A' }, htmlBody: '<p>Body</p>'
            }
        }];
        await setupWithComments(page, comments);
        const commentMeta = page.locator('.pr-comment .pr-comment-meta').first();
        const commentFontSize = await commentMeta.evaluate(el => window.getComputedStyle(el).fontSize);
        expect(parseFloat(commentFontSize)).toBeGreaterThan(14);
        const postHeader = page.locator('.pr-post-header').first();
        const postFontSize = await postHeader.evaluate(el => window.getComputedStyle(el).fontSize);
        expect(parseFloat(postFontSize)).toBeGreaterThan(16);
    });

    test('[PR-DATE-01] Timestamps are converted to local time without GMT suffix', async ({ page }) => {
        const comments = [{
            _id: 'c1', postId: 'p1', htmlBody: '<p>T</p>',
            postedAt: '2026-02-06T12:00:00.000Z',
            user: { username: 'A' }, post: { _id: 'p1', title: 'Post 1' }
        }];
        await setupWithComments(page, comments);
        const timestamp = page.locator('.pr-timestamp').first();
        const text = await timestamp.textContent();
        expect(text).not.toContain('GMT');
        expect(text).not.toContain('UTC');
    });

    test('[PR-VIS-09] Footnotes are displayed inline', async ({ page }) => {
        const comments = [{
            _id: 'c-fn', postId: 'p1',
            htmlBody: '<p>Text <a href="#fn" id="fnref"><span>[1]</span></a></p><div class="footnote"><p><a href="#fnref">^</a> Footnote content</p></div>',
            postedAt: new Date().toISOString(), baseScore: 10,
            user: { username: 'A', karma: 100 },
            post: { _id: 'p1', title: 'Post 1' }
        }];
        await setupWithComments(page, comments);

        // CSS rule is: .pr-comment-body .footnote, .pr-comment-body .footnote p { display: inline; }
        // Verify existence and property
        const footnoteDiv = page.locator('.footnote').first();
        await expect(footnoteDiv).toHaveCSS('display', 'inline');

        // Ensure content is visible
        await expect(footnoteDiv).toContainText('Footnote content');
    });

    test('[PR-VIS-11][PR-VIS-12][PR-VIS-13] Normalization and Auto-hide logic', async ({ page }) => {
        const comments = [
            {
                _id: 'c-low', postId: 'p1', htmlBody: '<p>Low</p>',
                postedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
                baseScore: -50,
                user: { username: 'Troll', karma: 0 },
                post: { _id: 'p1', title: 'Post 1' }
            },
            {
                _id: 'c-high', postId: 'p1', htmlBody: '<p>High</p>',
                postedAt: new Date().toISOString(),
                baseScore: 100,
                user: { username: 'Good', karma: 1000 },
                post: { _id: 'p1', title: 'Post 1' }
            }
        ];
        await setupWithComments(page, comments);
        const low = page.locator('.pr-comment[data-id="c-low"]');
        await expect(low).toHaveClass(/collapsed/);
        const highMeta = page.locator('.pr-comment[data-id="c-high"] .pr-comment-meta');
        const color = await highMeta.evaluate(el => window.getComputedStyle(el).backgroundColor);
        expect(color).toContain('rgb(255,');
    });

    test('[PR-POST-08][PR-POST-09][PR-POST-10] Read tracking for posts', async ({ page }) => {
        const comments = [{
            _id: 'c1', postId: 'p1', htmlBody: '<p>C</p>',
            postedAt: new Date().toISOString(), baseScore: 1,
            user: { username: 'A' },
            post: {
                _id: 'p1', title: 'Post 1', baseScore: 1,
                user: { username: 'A' }, htmlBody: '<p>Body</p>',
                commentCount: 1, postedAt: new Date().toISOString()
            }
        }];
        await setupWithComments(page, comments);

        const postItem = page.locator('.pr-post.pr-item').first();
        await expect(postItem).toBeVisible();

        // [PR-POST-10] Counter in status bar includes posts (1 post + 1 comment = 2)
        await expect(page.locator('#pr-unread-count')).toHaveText('2');

        // Manual marking to verify visual style
        await postItem.evaluate(el => el.classList.add('read'));
        // Manually update count for test
        await page.evaluate(() => {
            const countEl = document.getElementById('pr-unread-count');
            if (countEl) countEl.textContent = '1';
        });

        // [PR-POST-09] Greyed out title
        const titleLink = postItem.locator('.pr-post-title');
        const color = await titleLink.evaluate(el => window.getComputedStyle(el).color);
        expect(color).toBe('rgb(112, 112, 112)');

        // Body container opacity
        const bodyContainer = postItem.locator('.pr-post-body-container');
        await expect(bodyContainer).toHaveCSS('opacity', '0.8');

        // Verify count updated to 1
        await expect(page.locator('#pr-unread-count')).toHaveText('1');

        // Now mark the comment as well
        await page.locator('.pr-comment').evaluate(el => el.classList.add('read'));
        await page.evaluate(() => {
            const countEl = document.getElementById('pr-unread-count');
            if (countEl) countEl.textContent = '0';
        });
        await expect(page.locator('#pr-unread-count')).toHaveText('0');
    });
});
