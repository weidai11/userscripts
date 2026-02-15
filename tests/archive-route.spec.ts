import { test, expect } from '@playwright/test';
import { getScriptContent, setupMockEnvironment } from './helpers/setup';

test.describe('Power Reader Archive Route', () => {
    let scriptContent: string;

    test.beforeAll(() => {
        scriptContent = getScriptContent();
    });

    test('falls back to main reader when archive view missing username [PR-UARCH-02]', async ({ page }) => {
        await setupMockEnvironment(page, {
            mockHtml: '<html><head></head><body><div id="app">Original Site Content</div></body></html>',
            testMode: true,
            currentUser: { _id: 'u-test', username: 'TestUser', slug: 'test-user' }
        });

        // Navigate to archive view WITHOUT username parameter
        await page.goto('https://www.lesswrong.com/reader?view=archive', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Should NOT show archive header (should be main reader)
        await expect(page.locator('text=User Archive:')).toHaveCount(0);
        
        // Should show main reader content instead
        await expect(page.locator('#power-reader-root')).toBeVisible();
        await expect(page.locator('.pr-header')).toContainText('Power Reader');
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

    test('search supports valid regex filtering [PR-UARCH-08]', async ({ page }) => {
        const userId = 'u-search-user';
        const userObj = { _id: userId, username: 'Search_User', displayName: 'Search User', slug: 'search-user', karma: 100 };

        await setupMockEnvironment(page, {
            mockHtml: '<html><head></head><body><div id="app">Original Site Content</div></body></html>',
            testMode: true,
            onGraphQL: `
                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    return { data: { user: ${JSON.stringify(userObj)} } };
                }
                if (query.includes('GetUserPosts')) {
                    return {
                        data: {
                            posts: {
                                results: [
                                    {
                                        _id: 'p-regex-1',
                                        title: 'Test Post Alpha',
                                        slug: 'post-alpha',
                                        pageUrl: 'https://lesswrong.com/posts/p-regex-1',
                                        postedAt: '2025-01-02T12:00:00Z',
                                        baseScore: 10,
                                        voteCount: 5,
                                        commentCount: 0,
                                        htmlBody: '<p>Content with alpha keyword</p>',
                                        contents: { markdown: 'Content with alpha keyword' },
                                        user: ${JSON.stringify(userObj)}
                                    },
                                    {
                                        _id: 'p-regex-2',
                                        title: 'Another Beta Post',
                                        slug: 'post-beta',
                                        pageUrl: 'https://lesswrong.com/posts/p-regex-2',
                                        postedAt: '2025-01-01T12:00:00Z',
                                        baseScore: 20,
                                        voteCount: 5,
                                        commentCount: 0,
                                        htmlBody: '<p>Different beta content here</p>',
                                        contents: { markdown: 'Different beta content here' },
                                        user: ${JSON.stringify(userObj)}
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

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=Search_User', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Both items should be visible initially
        await expect(page.locator('.pr-archive-item')).toHaveCount(2);

        // Test valid regex: match posts containing "alpha" or "beta"
        const searchInput = page.locator('#archive-search');
        await searchInput.fill('alpha|beta');
        
        // Wait for filter to apply using polling
        await expect(async () => {
            const count = await page.locator('.pr-archive-item').count();
            expect(count).toBe(2);
        }).toPass({ timeout: 5000 });

        // Test more specific regex: only "Alpha" (case insensitive)
        await searchInput.fill('^.*Alpha.*$');
        
        // Wait for filter to apply
        await expect(async () => {
            const count = await page.locator('.pr-archive-item').count();
            expect(count).toBe(1);
        }).toPass({ timeout: 5000 });
        
        await expect(page.locator('.pr-archive-item h3')).toHaveText('Test Post Alpha');
    });

    test('invalid regex falls back to case-insensitive text search [PR-UARCH-08]', async ({ page }) => {
        const userId = 'u-regex-fail-user';
        const userObj = { _id: userId, username: 'RegexFail_User', displayName: 'Regex Fail User', slug: 'regex-fail-user', karma: 100 };

        await setupMockEnvironment(page, {
            mockHtml: '<html><head></head><body><div id="app">Original Site Content</div></body></html>',
            testMode: true,
            onGraphQL: `
                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    return { data: { user: ${JSON.stringify(userObj)} } };
                }
                if (query.includes('GetUserPosts')) {
                    return {
                        data: {
                            posts: {
                                results: [
                                    {
                                        _id: 'p-fail-1',
                                        title: 'Special [Bracket] Post',
                                        slug: 'bracket-post',
                                        pageUrl: 'https://lesswrong.com/posts/p-fail-1',
                                        postedAt: '2025-01-02T12:00:00Z',
                                        baseScore: 10,
                                        voteCount: 5,
                                        commentCount: 0,
                                        htmlBody: '<p>Content with [brackets]</p>',
                                        contents: { markdown: 'Content with [brackets]' },
                                        user: ${JSON.stringify(userObj)}
                                    },
                                    {
                                        _id: 'p-fail-2',
                                        title: 'Normal Post',
                                        slug: 'normal-post',
                                        pageUrl: 'https://lesswrong.com/posts/p-fail-2',
                                        postedAt: '2025-01-01T12:00:00Z',
                                        baseScore: 20,
                                        voteCount: 5,
                                        commentCount: 0,
                                        htmlBody: '<p>Regular content here</p>',
                                        contents: { markdown: 'Regular content here' },
                                        user: ${JSON.stringify(userObj)}
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

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=RegexFail_User', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Both items should be visible initially
        await expect(page.locator('.pr-archive-item')).toHaveCount(2);

        // Enter invalid regex (unmatched bracket)
        const searchInput = page.locator('#archive-search');
        await searchInput.fill('[bracket');
        
        // Wait for fallback text search to apply using polling
        await expect(async () => {
            const count = await page.locator('.pr-archive-item').count();
            expect(count).toBe(1);
        }).toPass({ timeout: 5000 });
        
        await expect(page.locator('.pr-archive-item h3')).toHaveText('Special [Bracket] Post');
    });

    test('all sort modes work: date-asc, score-asc, replyTo [PR-UARCH-09]', async ({ page }) => {
        const userId = 'u-sort-user';
        const username = `Sort_User_${Date.now()}`;
        const userObj = { _id: userId, username, displayName: 'Sort User', slug: 'sort-user', karma: 100 };
        const otherUser = { _id: 'u-other', username: 'OtherUser', displayName: 'Zebra Author', slug: 'other-user', karma: 50 };
        const anotherUser = { _id: 'u-another', username: 'AnotherUser', displayName: 'Apple Author', slug: 'another-user', karma: 50 };

        await setupMockEnvironment(page, {
            mockHtml: '<html><head></head><body><div id="app">Original Site Content</div></body></html>',
            testMode: true,
            onGraphQL: `
                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    return { data: { user: ${JSON.stringify(userObj)} } };
                }
                if (query.includes('GetUserPosts')) {
                    return {
                        data: {
                            posts: {
                                results: [
                                    {
                                        _id: 'p-sort-1',
                                        title: 'High Score Post',
                                        slug: 'high-post',
                                        pageUrl: 'https://lesswrong.com/posts/p-sort-1',
                                        postedAt: '2025-01-02T12:00:00Z',
                                        baseScore: 100,
                                        voteCount: 50,
                                        commentCount: 0,
                                        htmlBody: '<p>Newer high score content</p>',
                                        contents: { markdown: 'Newer high score content' },
                                        user: ${JSON.stringify(userObj)}
                                    },
                                    {
                                        _id: 'p-sort-2',
                                        title: 'Low Score Old Post',
                                        slug: 'low-post',
                                        pageUrl: 'https://lesswrong.com/posts/p-sort-2',
                                        postedAt: '2025-01-01T12:00:00Z',
                                        baseScore: 5,
                                        voteCount: 2,
                                        commentCount: 0,
                                        htmlBody: '<p>Older low score content</p>',
                                        contents: { markdown: 'Older low score content' },
                                        user: ${JSON.stringify(userObj)}
                                    }
                                ]
                            }
                        }
                    };
                }
                if (query.includes('GetUserComments')) {
                    return {
                        data: {
                            comments: {
                                results: [
                                    {
                                        _id: 'c-sort-1',
                                        postedAt: '2025-01-03T12:00:00Z',
                                        baseScore: 50,
                                        htmlBody: '<p>Reply to Zebra</p>',
                                        user: ${JSON.stringify(userObj)},
                                        post: { _id: 'p1', title: 'Test Post', pageUrl: '...', user: ${JSON.stringify(otherUser)} },
                                        parentComment: { _id: 'pc1', user: ${JSON.stringify(otherUser)}, parentComment: null },
                                        postId: 'p1'
                                    },
                                    {
                                        _id: 'c-sort-2',
                                        postedAt: '2025-01-04T12:00:00Z',
                                        baseScore: 30,
                                        htmlBody: '<p>Reply to Apple</p>',
                                        user: ${JSON.stringify(userObj)},
                                        post: { _id: 'p1', title: 'Test Post', pageUrl: '...', user: ${JSON.stringify(anotherUser)} },
                                        parentComment: { _id: 'pc2', user: ${JSON.stringify(anotherUser)}, parentComment: null },
                                        postId: 'p1'
                                    }
                                ]
                            }
                        }
                    };
                }
                return { data: {} };
            `
        });

        await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`, { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        const sortSelect = page.locator('#archive-sort');

        // Test date-asc (oldest first)
        await sortSelect.selectOption('date-asc');
        // Wait for sort to apply using polling
        await expect(async () => {
            const titles = await page.locator('.pr-archive-item h3').allTextContents();
            expect(titles[0]).toBe('Low Score Old Post');
        }).toPass({ timeout: 5000 });

        // Test score-asc (lowest karma first)
        await sortSelect.selectOption('score-asc');
        // Wait for sort to apply
        const allItems = page.locator('.pr-archive-item');
        await expect(async () => {
            await expect(allItems.first()).toContainText('Low Score Old Post');
        }).toPass({ timeout: 5000 });

        // Test replyTo sort (comments should order by interlocutor name: Apple before Zebra)
        await sortSelect.selectOption('replyTo');
        await expect(async () => {
            const ids = await page
                .locator('.pr-archive-item')
                .evaluateAll(nodes => nodes.map(n => n.getAttribute('data-id') || ''));
            const appleIdx = ids.indexOf('c-sort-2');
            const zebraIdx = ids.indexOf('c-sort-1');
            expect(appleIdx).toBeGreaterThan(-1);
            expect(zebraIdx).toBeGreaterThan(-1);
            expect(appleIdx).toBeLessThan(zebraIdx);
        }).toPass({ timeout: 5000 });
        await expect(sortSelect).toHaveValue('replyTo');
    });

    test('all view modes work including explicit card mode [PR-UARCH-10]', async ({ page }) => {
        const userId = 'u-view-user';
        const userObj = { _id: userId, username: 'View_User', displayName: 'View User', slug: 'view-user', karma: 100 };

        await setupMockEnvironment(page, {
            mockHtml: '<html><head></head><body><div id="app">Original Site Content</div></body></html>',
            testMode: true,
            onGraphQL: `
                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    return { data: { user: ${JSON.stringify(userObj)} } };
                }
                if (query.includes('GetUserPosts')) {
                    return {
                        data: {
                            posts: {
                                results: [
                                    {
                                        _id: 'p-view-1',
                                        title: 'Test Post for Views',
                                        slug: 'view-post',
                                        pageUrl: 'https://lesswrong.com/posts/p-view-1',
                                        postedAt: '2025-01-01T12:00:00Z',
                                        baseScore: 50,
                                        voteCount: 10,
                                        commentCount: 0,
                                        htmlBody: '<p>Content for view testing</p>',
                                        contents: { markdown: 'Content for view testing' },
                                        user: ${JSON.stringify(userObj)}
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

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=View_User', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        const viewSelect = page.locator('#archive-view');

        // Test Card View (default)
        await viewSelect.selectOption('card');
        await expect(page.locator('.pr-archive-item')).toBeVisible();
        await expect(page.locator('.pr-archive-index-item')).toHaveCount(0);

        // Test Index View
        await viewSelect.selectOption('index');
        await expect(page.locator('.pr-archive-index-item')).toBeVisible();
        await expect(page.locator('.pr-archive-index-item')).toHaveCount(1);

        // Test Thread View
        await viewSelect.selectOption('thread');
        await expect(page.locator('.pr-archive-item')).toBeVisible();
    });

    test('load-more expands rendered items and hides when exhausted [PR-UARCH-12]', async ({ page }) => {
        const username = `LoadMoreUser_${Date.now()}`;
        const userObj = { _id: 'u-loadmore', username, displayName: 'Load More Test', slug: 'loadmore-user', karma: 100 };

        await setupMockEnvironment(page, {
            mockHtml: '<html><head></head><body><div id="app">Original Site Content</div></body></html>',
            testMode: true,
            onGraphQL: `
                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    return { data: { user: { _id: 'u-loadmore', username: '${username}', displayName: 'Load More Test', slug: 'loadmore-user', karma: 100 } } };
                }
                if (query.includes('GetUserPosts')) {
                    const allResults = [];
                    for (let i = 0; i < 60; i++) {
                        allResults.push({
                            _id: 'p-loadmore-' + i,
                            title: 'Load More Post ' + i,
                            slug: 'load-more-post-' + i,
                            pageUrl: 'https://lesswrong.com/posts/p-loadmore-' + i,
                            postedAt: new Date(Date.UTC(2025, 0, 20 - i)).toISOString(),
                            baseScore: 100 - i,
                            voteCount: 5,
                            commentCount: 0,
                            htmlBody: '<p>Load more content ' + i + '</p>',
                            contents: { markdown: 'Load more content ' + i },
                            user: { _id: 'u-loadmore', username: '${username}', displayName: 'Load More Test', slug: 'loadmore-user', karma: 100 }
                        });
                    }
                    const offset = variables.offset || 0;
                    const limit = variables.limit || 50;
                    const results = allResults.slice(offset, offset + limit);
                    return { 
                        data: { 
                            posts: { 
                                results
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

        await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`, { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        const loadMoreContainer = page.locator('#archive-load-more');
        const loadMoreBtn = loadMoreContainer.locator('button');

        // Initial render limit is 50.
        await expect(page.locator('.pr-archive-item')).toHaveCount(50, { timeout: 10000 });
        await expect(loadMoreContainer).toBeVisible();
        await expect(loadMoreBtn).toContainText('Load More (10 remaining)');

        await loadMoreBtn.click();

        // After one click, all 60 items should be rendered and load-more hidden.
        await expect(page.locator('.pr-archive-item')).toHaveCount(60, { timeout: 10000 });
        await expect(loadMoreContainer).toBeHidden();
    });
});
