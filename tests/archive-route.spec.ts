import { test, expect } from '@playwright/test';
import { getScriptContent, setupMockEnvironment } from './helpers/setup';

test.describe('Power Reader Archive Route', () => {
    let scriptContent: string;

    test.beforeAll(() => {
        scriptContent = getScriptContent();
    });

    test('supports sorting and index view', async ({ page }) => {
        await setupMockEnvironment(page, {
            mockHtml: '<html><head></head><body><div id="app">Original Site Content</div></body></html>',
            testMode: true,
            onGraphQL: `
                const userId = 'u-wei-dai';
                const userObj = { _id: userId, username: 'Wei_Dai', displayName: 'Wei Dai', slug: 'wei-dai', karma: 100 };

                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    return { data: { user: userObj } };
                }
                if (query.includes('GetUserPosts')) {
                    return {
                        data: {
                            posts: {
                                results: [
                                    {
                                        _id: 'p1',
                                        title: 'New Low Score Post',
                                        slug: 'post-1',
                                        pageUrl: 'https://lesswrong.com/posts/p1',
                                        postedAt: '2025-01-02T12:00:00Z',
                                        baseScore: 10,
                                        voteCount: 5,
                                        commentCount: 0,
                                        htmlBody: '<p>Body 1</p>',
                                        contents: { markdown: 'Body 1' },
                                        user: userObj
                                    },
                                    {
                                        _id: 'p2',
                                        title: 'Old High Score Post',
                                        slug: 'post-2',
                                        pageUrl: 'https://lesswrong.com/posts/p2',
                                        postedAt: '2025-01-01T12:00:00Z',
                                        baseScore: 100,
                                        voteCount: 50,
                                        commentCount: 0,
                                        htmlBody: '<p>Body 2</p>',
                                        contents: { markdown: 'Body 2' },
                                        user: userObj
                                    }
                                ]
                            }
                        }
                    };
                }
                if (query.includes('GetUserComments')) {
                    return { data: { comments: { results: [] } } };
                }
                return { data: {} };
            `
        });

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=Wei_Dai', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Verify Default Sort (Date Newest)
        const firstItemTitle = page.locator('.pr-archive-item h3').first();
        await expect(firstItemTitle).toHaveText('New Low Score Post');

        // Test View Mode Switching (To Index)
        await page.locator('#archive-view').selectOption('index');
        await expect(page.locator('.pr-archive-index-item').first()).toBeVisible();
        await expect(page.locator('.pr-archive-index-item')).toHaveCount(2);

        // Test Sorting (To Karma High-Low)
        await page.locator('#archive-sort').selectOption('score');
        await expect(page.locator('.pr-archive-index-item .pr-index-title').first()).toHaveText('Old High Score Post');
    });

    test('supports thread view with context fetching', async ({ page }) => {
        await setupMockEnvironment(page, {
            mockHtml: '<html><head></head><body><div id="app">Original Site Content</div></body></html>',
            testMode: true,
            onGraphQL: `
                const userId = 'u-wei-dai';
                const userObj = { _id: userId, username: 'Wei_Dai', displayName: 'Wei Dai', slug: 'wei-dai', karma: 100 };
                const otherUser = { _id: 'u-other', username: 'OtherUser', displayName: 'Other User', slug: 'other-user', karma: 50 };

                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    return { data: { user: userObj } };
                }
                if (query.includes('GetUserPosts')) {
                    return { data: { posts: { results: [] } } };
                }
                if (query.includes('GetUserComments')) {
                    return {
                        data: {
                            comments: {
                                results: [
                                    {
                                        _id: 'c1',
                                        postedAt: '2025-01-10T12:00:00Z',
                                        baseScore: 5,
                                        htmlBody: '<p>My Reply</p>',
                                        user: userObj,
                                        post: { _id: 'p1', title: 'Context Post', pageUrl: '...', user: otherUser },
                                        parentComment: {
                                            _id: 'c-parent',
                                            user: otherUser,
                                            parentComment: null
                                        },
                                        postId: 'p1'
                                    }
                                ]
                            }
                        }
                    };
                }
                if (query.includes('GetCommentsByIds')) {
                    return {
                        data: {
                            comments: {
                                results: [
                                    {
                                        _id: 'c-parent',
                                        postedAt: '2025-01-09T12:00:00Z',
                                        htmlBody: '<p>Parent Comment Body</p>',
                                        user: otherUser,
                                        parentComment: null
                                    }
                                ]
                            }
                        }
                    };
                }
                return { data: {} };
            `
        });

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=Wei_Dai', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Switch to Thread View
        await page.locator('#archive-view').selectOption('thread');

        // Verify Thread Structure
        const rootPost = page.locator('.pr-thread-root-post');
        await expect(rootPost).toBeVisible();
        await expect(rootPost).toContainText('Context Post');

        const parentComment = page.locator('.pr-thread-parent');
        await expect(parentComment).toBeVisible();
        await expect(parentComment).toContainText('Parent Comment Body');
        await expect(parentComment).toContainText('Replying to Other User');

        const userComment = page.locator('.pr-archive-item');
        await expect(userComment).toBeVisible();
        await expect(userComment).toContainText('My Reply');
    });
});
