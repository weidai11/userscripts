import { test, expect } from '@playwright/test';
import { setupMockEnvironment, initPowerReader } from './helpers/setup';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Power Reader Hover Previews', () => {
    let scriptContent: string;

    test.beforeEach(async ({ page }) => {
        // Use setupMockEnvironment via initPowerReader
    });

    async function setupDefault(page: any) {
        await initPowerReader(page, {
            testMode: true,
            appDebugMode: true,
            verbose: true,
            comments: [
                {
                    _id: 'c1',
                    postId: 'p1',
                    pageUrl: 'https://www.lesswrong.com/posts/p1/mock-post?commentId=c1',
                    htmlBody: '<p>Replier comment.</p>',
                    postedAt: new Date().toISOString(),
                    baseScore: 10,
                    parentCommentId: 'parent-id',
                    user: { _id: 'u2', slug: 'replier', username: 'Replier', karma: 100 },
                    post: { _id: 'p1', title: 'Mock Post Title', slug: 'mock-post' },
                    parentComment: null
                }
            ],
            onMutation: `
                if (query.includes('GetPost')) {
                    const post = variables.id === 'p1' ? {
                        _id: 'p1', title: 'Mock Post Title', slug: 'mock-post',
                        htmlBody: '<p>This is the full post content preview.</p>',
                        postedAt: new Date().toISOString(), baseScore: 100,
                        user: { _id: 'u1', username: 'PostAuthor' }
                    } : null;
                    return { data: { post: { result: post } } };
                }
                if (query.includes('GetComment')) {
                    const comment = variables.id === 'parent-id' ? {
                        _id: 'parent-id', postId: 'p1', 
                        pageUrl: 'https://www.lesswrong.com/posts/p1/slug?commentId=parent-id',
                        htmlBody: '<p>This is the parent comment content.</p>',
                        postedAt: new Date(Date.now() - 100000).toISOString(), baseScore: 25,
                        user: { _id: 'u3', username: 'ParentAuthor' },
                        post: { _id: 'p1', title: 'Mock Post Title' }
                    } : null;
                    return { data: { comment: { result: comment } } };
                }
                return null;
            `
        });
    }

    test('[PR-PREV-01][PR-PREV-06] Hovering Post Title shows preview', async ({ page }) => {
        await setupDefault(page);
        const postTitle = page.locator('.pr-post-title').first();
        await postTitle.hover();
        const preview = page.locator('.pr-preview-overlay.post-preview');
        await expect(preview).toBeVisible({ timeout: 15000 });
        await expect(preview).toContainText('This is the full post content preview');
    });

    test('Hovering post metadata DOES NOT trigger preview', async ({ page }) => {
        await setupDefault(page);

        // Hover over metadata (karma/agreement buttons)
        const metadata = page.locator('.pr-post-meta').first();
        await metadata.hover();

        const preview = page.locator('.pr-preview-overlay.post-preview');
        await expect(preview).not.toBeVisible({ timeout: 2000 });
    });

    test('Hovering whitespace to the right of title triggers preview', async ({ page }) => {
        await setupDefault(page);
        const h2 = page.locator('.pr-post-header h2').first();
        // Hover at the right side of the H2 (whitespace)
        await h2.hover({ position: { x: 500, y: 10 } });

        const preview = page.locator('.pr-preview-overlay.post-preview');
        await expect(preview).toBeVisible({ timeout: 15000 });
    });

    test('[PR-NAV-09] Hovering Parent Link [^] shows preview (First Intent)', async ({ page }) => {
        await setupDefault(page);
        const parentLink = page.locator('[data-action="find-parent"]');
        await parentLink.hover();
        const preview = page.locator('.pr-preview-overlay.comment-preview');
        await expect(preview).toBeVisible({ timeout: 15000 });
        await expect(preview).toContainText('This is the parent comment content');
    });

    test('[PR-PREV-01] Clicking Parent Link [^] cancels pending preview', async ({ page }) => {
        await setupDefault(page);
        const parentLink = page.locator('[data-action="find-parent"]');

        // Hover to start the timer but not finish it (DELAY is 300ms)
        await parentLink.hover();
        await page.waitForTimeout(100);

        // Click should dismiss/cancel
        await parentLink.click();

        // Short wait to see if it pops up later
        await page.waitForTimeout(500);
        const preview = page.locator('.pr-preview-overlay');
        await expect(preview).not.toBeVisible();
    });

    test('[PR-PREV-02] Scroll-induced hover is suppressed', async ({ page }) => {
        await setupDefault(page);
        const parentLink = page.locator('[data-action="find-parent"]');
        const box = await parentLink.boundingBox();
        if (box) {
            await page.mouse.move(0, 0);
            await page.waitForTimeout(100);
            await page.evaluate(() => window.scrollTo(0, 100));
            await page.dispatchEvent('body', 'scroll');
            // Element moves under still mouse
            await parentLink.dispatchEvent('mouseenter');
        }
        const preview = page.locator('.pr-preview-overlay');
        await page.waitForTimeout(600);
        await expect(preview).not.toBeVisible();

        // Now move the mouse (intentional)
        await parentLink.hover();
        await expect(preview).toBeVisible({ timeout: 2000 });
    });

    test('[PR-PREV-04] Mouse leave dismisses preview', async ({ page }) => {
        await setupDefault(page);
        const postTitle = page.locator('.pr-post-title').first();
        await postTitle.hover();
        const preview = page.locator('.pr-preview-overlay');
        await expect(preview).toBeVisible();
        await page.mouse.move(0, 0);
        await expect(preview).not.toBeVisible();
    });

    test('[PR-PREV-03] Scrolling dismisses active preview', async ({ page }) => {
        await setupDefault(page);
        const postTitle = page.locator('.pr-post-title').first();
        await postTitle.hover();
        const preview = page.locator('.pr-preview-overlay');
        await expect(preview).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, 100));
        await page.dispatchEvent('body', 'scroll');
        await expect(preview).not.toBeVisible();
    });

    test('[PR-PREV-05] Clicking preview navigates and dismisses', async ({ page }) => {
        await setupDefault(page);
        await page.setViewportSize({ width: 1280, height: 1000 });
        const postTitle = page.locator('.pr-post-title').first();
        await postTitle.hover();
        const preview = page.locator('.pr-preview-overlay');
        await expect(preview).toBeVisible();
        await preview.click({ force: true });
        await expect(preview).not.toBeVisible();
    });

    test('[PR-PREV-07] Hovering comment link shows preview', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            comments: [{
                _id: 'c1', postId: 'p1', postedAt: new Date().toISOString(),
                user: { username: 'U', karma: 100 }, post: { _id: 'p1', title: 'P' },
                htmlBody: '<p>Link to <a href="https://www.lesswrong.com/posts/p1/slug?commentId=parent-id">comment</a></p>'
            }],
            onMutation: `
                if (query.includes('GetComment')) {
                    return { data: { comment: { result: {
                        _id: 'parent-id', 
                        htmlBody: '<p>Target Comment</p>', 
                        user: {username:'T', karma: 100}, 
                        post: { _id:'p1', title:'P' },
                        postedAt: new Date().toISOString(),
                        baseScore: 10
                    } } } };
                }
                return null;
            `
        });

        const link = page.locator('.pr-comment-body a').first();
        await link.hover();
        const preview = page.locator('.pr-preview-overlay.comment-preview');
        await expect(preview).toBeVisible({ timeout: 15000 });
        await expect(preview).toContainText('Target Comment');
    });
});
