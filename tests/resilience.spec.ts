import { test, expect } from '@playwright/test';
import { getScriptContent, setupMockEnvironment } from './helpers/setup';

test.describe('Power Reader Resilience [PR-DATA-03][PR-DATA-03.1][PR-DATA-03.2][PR-DATA-04]', () => {
    let scriptContent: string;

    test.beforeAll(() => {
        scriptContent = getScriptContent();
    });

    test('archive sync accepts tolerated partial GraphQL success [PR-DATA-03.1][PR-DATA-03.2]', async ({ page }) => {
        const username = 'ResilientUser';
        const userId = 'u-resilient';
        const userObj = { _id: userId, username, displayName: 'Resilient User', slug: 'resilient-user', karma: 100 };

        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    return { data: { user: ${JSON.stringify(userObj)} } };
                }
                if (query.includes('GetUserPosts')) {
                    // Return one valid post but also a GraphQL error
                    return {
                        data: {
                            posts: {
                                results: [{
                                    _id: 'p-valid',
                                    title: 'Valid Post',
                                    slug: 'valid-post',
                                    pageUrl: 'https://lesswrong.com/posts/p-valid',
                                    postedAt: '2025-01-01T00:00:00Z',
                                    baseScore: 10,
                                    voteCount: 5,
                                    commentCount: 0,
                                    htmlBody: '<p>Valid content</p>',
                                    contents: { markdown: 'Valid content' },
                                    user: ${JSON.stringify(userObj)}
                                }]
                            }
                        },
                        errors: [{
                            message: "Unable to find document for comment: AHg2XBPhYpL3KWExp",
                            path: ["posts", "results", 0, "pageUrl"]
                        }]
                    };
                }
                if (query.includes('GetUserComments')) {
                    return { data: { comments: { results: [] } } };
                }
            `
        });

        await page.goto('https://www.lesswrong.com/archive?username=' + username);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Verify the valid post is still rendered despite the error
        await expect(page.locator('.pr-item h2')).toHaveText('Valid Post');

        // Verify status shows sync complete (meaning it didn't throw)
        await expect(page.locator('#archive-status')).toContainText('Sync complete');
    });

    test('strict-by-default GraphQL errors block non-opt-in call paths [PR-DATA-03]', async ({ page }) => {
        const username = 'StrictByDefaultUser';
        const userId = 'u-strict-default';
        const userObj = { _id: userId, username, displayName: 'Strict User', slug: 'strict-user', karma: 100 };

        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    // fetchUserId is strict and should reject this response due to errors[].
                    return {
                        data: { user: ${JSON.stringify(userObj)} },
                        errors: [{ message: 'Synthetic strict-path resolver failure', path: ['user'] }]
                    };
                }
                if (query.includes('GetUserPosts')) {
                    return {
                        data: {
                            posts: {
                                results: [{
                                    _id: 'p-should-not-load',
                                    title: 'Should Not Load',
                                    slug: 'should-not-load',
                                    pageUrl: 'https://lesswrong.com/posts/p-should-not-load',
                                    postedAt: '2025-01-01T00:00:00Z',
                                    baseScore: 1,
                                    voteCount: 1,
                                    commentCount: 0,
                                    htmlBody: '<p>Unexpected</p>',
                                    contents: { markdown: 'Unexpected' },
                                    user: ${JSON.stringify(userObj)}
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

        await page.goto('https://www.lesswrong.com/archive?username=' + username);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Non-opt-in strict path should fail sync and prevent successful archive population.
        await expect(page.locator('#archive-status')).toContainText('Sync failed');
        await expect(page.locator('.pr-item')).toHaveCount(0);
    });

    test('handles missing pageUrl gracefully in UI [PR-DATA-04]', async ({ page }) => {
        const username = 'FallbackUser';
        const userId = 'u-fallback';
        const userObj = { _id: userId, username, displayName: 'Fallback User', slug: 'fallback-user', karma: 100 };

        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    return { data: { user: ${JSON.stringify(userObj)} } };
                }
                if (query.includes('GetUserPosts')) {
                    return {
                        data: {
                            posts: {
                                results: [{
                                    _id: 'p-no-url',
                                    title: 'Post Without URL',
                                    slug: 'no-url',
                                    pageUrl: null, // Simulate resolver failure
                                    postedAt: '2025-01-01T00:00:00Z',
                                    baseScore: 10,
                                    voteCount: 5,
                                    commentCount: 0,
                                    htmlBody: '<p>Content</p>',
                                    contents: { markdown: 'Content' },
                                    user: ${JSON.stringify(userObj)}
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

        await page.goto('https://www.lesswrong.com/archive?username=' + username);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Verify the post is rendered
        const post = page.locator('.pr-item');
        await expect(post.locator('h2')).toHaveText('Post Without URL');

        // Check the timestamp link specifically
        const timestampLink = post.locator('.pr-timestamp a');
        await expect(timestampLink).toHaveAttribute('href', '#');
    });
});


