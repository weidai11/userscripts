import { test, expect } from '@playwright/test';
import { getScriptContent, setupMockEnvironment } from './helpers/setup';

test.describe('Power Reader Archive Route', () => {
    let scriptContent: string;

    test.beforeAll(() => {
        scriptContent = getScriptContent();
    });

    test('visiting /reader?view=archive&username=Wei_Dai triggers archive mode', async ({ page }) => {
        await setupMockEnvironment(page, {
            mockHtml: '<html><head></head><body><div id="app">Original Site Content</div></body></html>',
            testMode: true,
            onGraphQL: `
                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    return { data: { user: { _id: 'u-wei-dai', username: 'Wei_Dai' } } };
                }
                if (query.includes('GetUserPosts')) {
                    return {
                        data: {
                            posts: {
                                results: [{
                                    _id: 'p1',
                                    title: 'Archive Test Post',
                                    slug: 'archive-test-post',
                                    pageUrl: 'https://lesswrong.com/posts/p1/archive-test-post',
                                    postedAt: new Date().toISOString(),
                                    baseScore: 10,
                                    voteCount: 5,
                                    commentCount: 0,
                                    htmlBody: '<p>Body</p>',
                                    contents: { markdown: 'Body' },
                                    user: { _id: 'u-wei-dai', username: 'Wei_Dai', displayName: 'Wei Dai', slug: 'wei-dai', karma: 100 }
                                }]
                            }
                        }
                    };
                }
                if (query.includes('GetUserComments')) {
                    return { data: { comments: { results: [] } } };
                }
            `
        });

        // Navigate to the archive URL
        await page.goto('https://www.lesswrong.com/reader?view=archive&username=Wei_Dai', { waitUntil: 'commit' });

        // Inject the built userscript
        await page.evaluate(scriptContent);

        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Verify that the archive header is rendered
        const header = page.locator('.pr-header h1');
        await expect(header).toBeVisible();
        await expect(header).toHaveText('User Archive: Wei_Dai');

        // Verify the post is rendered (confirms data loading worked)
        const postTitle = page.locator('.pr-archive-item h3');
        await expect(postTitle).toBeVisible();
        await expect(postTitle).toHaveText('Archive Test Post');

        // Ensure "POWER Reader" signal is attached
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
    });
});
