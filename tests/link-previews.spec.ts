import { test, expect, type Locator } from '@playwright/test';
import { getScriptContent, initPowerReader, setupMockEnvironment } from './helpers/setup';

async function hoverTrigger(link: Locator): Promise<void> {
    await expect(link).toBeVisible();
    await link.hover();
}

async function waitForNegativePreviewWindow(minDelayMs: number = 700): Promise<void> {
    const startedAt = Date.now();
    await expect.poll(() => Date.now() - startedAt, { timeout: minDelayMs + 1000 }).toBeGreaterThanOrEqual(minDelayMs);
}

test.describe('Link Previews in Comment Bodies', () => {
    test('[PR-PREV-08] Previews post links in comment bodies', async ({ page }) => {
        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                htmlBody: '<p>Check out <a href="/posts/p2/another-post" id="post-link">this other post</a>.</p>',
                user: { username: 'AuthorA' },
                post: { _id: 'p1', title: 'Start Post' }
            }
        ];

        const posts = [
            { _id: 'p1', title: 'Start Post', postedAt: new Date().toISOString(), baseScore: 1, user: { username: 'AuthorA' } },
        ];

        await initPowerReader(page, {
            comments,
            posts,
            testMode: true,
            onGraphQL: `
                if (query.includes('GetPost')) {
                    if (variables.id === 'p2') {
                        return { data: { post: { result: {
                            _id: 'p2',
                            title: 'Target Post',
                            htmlBody: '<p>Target content body</p>',
                            postedAt: new Date().toISOString(),
                            baseScore: 42,
                            user: { username: 'TargetAuthor' }
                        }}}}
                    }
                }
                return null;
            `
        });

        const link = page.locator('#post-link');
        await hoverTrigger(link);

        // Wait for preview delay (300ms) + fetch
        const preview = page.locator('.pr-preview-overlay.post-preview');
        await expect(preview).toBeVisible({ timeout: 10000 });

        await expect(preview).toContainText('Target Post');
        await expect(preview).toContainText('Target content body');
    });

    test('[PR-PREV-09] Previews author links in comment bodies', async ({ page }) => {
        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                htmlBody: '<p>Hey <a href="/users/TargetUser" id="user-link">@TargetUser</a>, look at this.</p>',
                user: { username: 'AuthorA' },
                post: { _id: 'p1', title: 'Start Post' }
            }
        ];

        await initPowerReader(page, {
            comments,
            posts: [{ _id: 'p1', title: 'Start Post', postedAt: new Date().toISOString(), baseScore: 1, user: { username: 'AuthorA' } }],
            testMode: true,
            onGraphQL: `
                if (query.includes('GetUserBySlug')) {
                    if (variables.slug === 'TargetUser') {
                        return { data: { user: {
                            _id: 'u2',
                            username: 'TargetUser',
                            displayName: 'Target Display Name',
                            slug: 'TargetUser',
                            karma: 1234.5,
                            htmlBio: '<p>This is the target bio</p>'
                        }}}
                    }
                }
                return null;
            `
        });

        const link = page.locator('#user-link');
        await hoverTrigger(link);

        const preview = page.locator('.pr-preview-overlay.author-preview');
        await expect(preview).toBeVisible({ timeout: 10000 });

        await expect(preview).toContainText('Target Display Name');
        await expect(preview).toContainText('This is the target bio');
        await expect(preview).toContainText('1235 karma'); // Rounded
    });

    test('[PR-PREV-08] Does not preview external post-like links', async ({ page }) => {
        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                htmlBody: '<p><a href="https://lesswrong.com.evil.tld/posts/p2/fake" id="external-post-link">external post-like link</a></p>',
                user: { username: 'AuthorA' },
                post: { _id: 'p1', title: 'Start Post' }
            }
        ];

        await initPowerReader(page, {
            comments,
            posts: [{ _id: 'p1', title: 'Start Post', postedAt: new Date().toISOString(), baseScore: 1, user: { username: 'AuthorA' } }],
            testMode: true,
            onInit: `window.__GET_POST_CALLS = 0;`,
            onGraphQL: `
                if (query.includes('GetPost')) {
                    window.__GET_POST_CALLS = (window.__GET_POST_CALLS || 0) + 1;
                }
                return null;
            `
        });

        const link = page.locator('#external-post-link');
        await hoverTrigger(link);

        await waitForNegativePreviewWindow();
        await expect(page.locator('.pr-preview-overlay.post-preview')).toHaveCount(0);

        const calls = await page.evaluate(() => (window as any).__GET_POST_CALLS || 0);
        expect(calls).toBe(0);
    });

    test('[PR-PREV-09] Does not preview protocol-relative external author links', async ({ page }) => {
        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                htmlBody: '<p><a href="//evil.tld/users/TargetUser" id="external-user-link">external user-like link</a></p>',
                user: { username: 'AuthorA' },
                post: { _id: 'p1', title: 'Start Post' }
            }
        ];

        await initPowerReader(page, {
            comments,
            posts: [{ _id: 'p1', title: 'Start Post', postedAt: new Date().toISOString(), baseScore: 1, user: { username: 'AuthorA' } }],
            testMode: true,
            onInit: `window.__GET_USER_BY_SLUG_CALLS = 0;`,
            onGraphQL: `
                if (query.includes('GetUserBySlug')) {
                    window.__GET_USER_BY_SLUG_CALLS = (window.__GET_USER_BY_SLUG_CALLS || 0) + 1;
                }
                return null;
            `
        });

        const link = page.locator('#external-user-link');
        await hoverTrigger(link);

        await waitForNegativePreviewWindow();
        await expect(page.locator('.pr-preview-overlay.author-preview')).toHaveCount(0);

        const calls = await page.evaluate(() => (window as any).__GET_USER_BY_SLUG_CALLS || 0);
        expect(calls).toBe(0);
    });

    test('[PR-PREV-10] Wiki preview fetch uses current forum origin', async ({ page }) => {
        const scriptContent = getScriptContent();
        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                pageUrl: 'https://forum.effectivealtruism.org/posts/p1/mock?commentId=c1',
                htmlBody: '<p><a href="/tag/alignment" id="wiki-link">alignment wiki</a></p>',
                user: { username: 'AuthorA' },
                post: { _id: 'p1', title: 'Start Post' }
            }
        ];

        await setupMockEnvironment(page, {
            comments,
            posts: [{ _id: 'p1', title: 'Start Post', postedAt: new Date().toISOString(), baseScore: 1, user: { username: 'AuthorA' } }],
            testMode: true,
            verbose: true,
            appVerbose: true,
            onInit: `
                console.log('POWER READER TEST INIT');
                window.__FETCH_URLS = [];
                window.fetch = (input) => {
                    const url = typeof input === 'string' ? input : (input && input.url) || '';
                    window.__FETCH_URLS.push(url);
                    return Promise.resolve(new Response(
                        '<html><body><h1>Alignment</h1><div class="TagPage-description"><p>Wiki content</p></div></body></html>',
                        { status: 200, headers: { 'Content-Type': 'text/html' } }
                    ));
                };
            `,
        });

        await page.goto('https://forum.effectivealtruism.org/reader', { waitUntil: 'domcontentloaded' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        const link = page.locator('#wiki-link');
        await page.waitForSelector('#wiki-link', { state: 'visible', timeout: 5000 });
        await hoverTrigger(link);

        const preview = page.locator('.pr-preview-overlay.wiki-preview');
        await expect(preview).toBeVisible({ timeout: 10000 });
        await expect(preview).toContainText('Alignment');

        const urls = await page.evaluate(() => (window as any).__FETCH_URLS || []);
        expect(urls.length).toBeGreaterThan(0);
        expect(urls[0]).toContain('https://forum.effectivealtruism.org/tag/alignment');
    });
});
