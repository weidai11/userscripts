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

    test('[PR-UARCH-01] supports sorting and index view', async ({ page }) => {
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

    test('[PR-UARCH-11] supports thread view with context fetching', async ({ page }) => {
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
        const username = 'load-more-test';
        await setupMockEnvironment(page, {
            onInit: `window.__PR_RENDER_LIMIT_OVERRIDE = 50;`,
            onGraphQL: `
                const userId = 'u-load-more';
                const userObj = { _id: userId, username: '${username}', displayName: 'Load More User' };
                if (query.includes('GetUserBySlug')) return { data: { user: userObj } };
                if (query.includes('GetUserPosts')) {
                    if (variables.before) return { data: { posts: { results: [] } } };
                    
                    // Generate 60 posts to test limit (50)
                    const results = [];
                    for (let i = 0; i < 60; i++) {
                        results.push({
                            _id: 'p' + i,
                            title: 'Post ' + i,
                            postedAt: new Date(2020, 0, 1, 0, 0, i).toISOString(),
                            user: userObj
                        });
                    }
                    return { data: { posts: { results } } };
                }
                if (query.includes('GetUserComments')) return { data: { comments: { results: [] } } };
            `
        });

        await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`, { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        const loadMoreContainer = page.locator('#archive-load-more');
        const loadMoreBtn = loadMoreContainer.locator('button');

        // Initial render limit is 50.
        await expect(page.locator('.pr-archive-item')).toHaveCount(50, { timeout: 15000 });
        await expect(loadMoreContainer).toBeVisible();
        await expect(loadMoreBtn).toContainText('Load More (10 remaining)');

        await loadMoreBtn.click();

        // After one click, all 60 items should be rendered and load-more hidden.
        await expect(page.locator('.pr-archive-item')).toHaveCount(60, { timeout: 15000 });
        await expect(loadMoreContainer).toBeHidden();
    });

    /**
     * [PR-UARCH-14] Manual Resync Recovery
     * [PR-UARCH-15] Adaptive Batching
     * [PR-UARCH-16] Status Line Indicators
     * [PR-UARCH-17] Payload Optimization (implicitly verified by successful completion of fetches)
     */
    test('supports resync, adaptive batching and shows sync status [PR-UARCH-14][PR-UARCH-15][PR-UARCH-16][PR-UARCH-17]', async ({ page }) => {
        const username = 'resync-test';
        let syncCount = 0;

        await setupMockEnvironment(page, {
            onInit: `window.__syncCount = 0; console.log('Mock init');`,
            onGraphQL: `
                console.log('Mock GraphQL Query:', query.substring(0, 50), 'SyncCount:', window.__syncCount, 'Variables:', JSON.stringify(variables));
                // [PR-UARCH-17] Payload Optimization check (lite post fields in comment fetches)
                if (query.includes('GetUserComments') && query.includes('...CommentFieldsFull')) {
                    throw new Error('Detected unoptimized comment fields in archive query');
                }
                
                if (query.includes('GetUserBySlug')) {
                    return { data: { user: { _id: 'u-resync', username: '${username}' } } };
                }
                if (query.includes('GetUserPosts')) {
                    window.__syncCount++;
                    // In cursor pagination, window.__syncCount > 1 is the resync attempt.
                    // The first page of resync has variables.before === null.
                    const results = (window.__syncCount > 1 && !variables.before) ? [{ _id: 'post-new', postedAt: new Date().toISOString(), title: 'New Post', user: { displayName: 'Tester' } }] : [];
                    console.log('Returning GetUserPosts results. Count:', results.length, 'Global SyncCount:', window.__syncCount);
                    return { data: { posts: { results } } };
                }
                if (query.includes('GetUserComments')) {
                    return { data: { comments: { results: [] } } };
                }
            `
        });

        await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`, { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        const statusEl = page.locator('#archive-status');
        const resyncBtn = page.locator('#archive-resync');

        // Check initial status - it might already be "Sync complete" or "Up to date"
        await expect(statusEl).not.toHaveClass(/status-error/);
        await expect(statusEl).toHaveText(/Up to date|Sync complete|Checking|Fetching|Loaded/);

        // Trigger Resync
        page.on('dialog', dialog => dialog.accept()); // Handle the confirmation dialog
        await resyncBtn.click();

        // Should briefly show syncing status or starting resync
        // We wait for the syncing indicator to be added, then for it to be removed
        await expect(statusEl).toHaveClass(/status-syncing/);
        await expect(statusEl).not.toHaveClass(/status-syncing/, { timeout: 20000 });

        // Final state after resync should have 1 item
        await expect(statusEl).toContainText('Sync complete');
        await expect(statusEl).toContainText('1 total items');
    });

    /**
     * [PR-UARCH-18] Large Dataset Dialog Persistence
     * Verifies that the "Large Dataset" dialog correctly triggers and that the choice
     * persists across sorting/filtering changes.
     */
    test('Large Dataset dialog persists choice across sort changes [PR-UARCH-18]', async ({ page }) => {
        const username = 'large-dataset-test';

        await setupMockEnvironment(page, {
            onGraphQL: `
                const userId = 'u-large';
                const userObj = { _id: userId, username: '${username}', displayName: 'Big User' };
                
                if (query.includes('GetUserBySlug')) return { data: { user: userObj } };
                if (query.includes('GetUserPosts')) {
                    if (variables.before) return { data: { posts: { results: [] } } };
                    const results = [];
                    for (let i = 0; i < 11000; i++) {
                        results.push({
                            _id: 'p' + i,
                            title: 'Post ' + i,
                            postedAt: new Date(2020, 0, 1, 0, 0, i).toISOString(),
                            baseScore: i,
                            user: userObj
                        });
                    }
                    return { data: { posts: { results } } };
                }
                if (query.includes('GetUserComments')) return { data: { comments: { results: [] } } };
            `
        });

        await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`, { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Dialog should be visible
        const dialog = page.locator('.pr-archive-render-dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText('Large Dataset Detected');
        await expect(dialog).toContainText('11,000');

        // Choose "Render All"
        const renderAllBtn = page.locator('#render-all-btn');
        await renderAllBtn.click();

        // Feed should now contain items
        await expect(dialog).toBeHidden();
        const items = page.locator('.pr-archive-item');
        await expect(items.first()).toBeVisible();

        // Change sort - THIS IS WHERE THE BUG IS
        const sortSelect = page.locator('#archive-sort');
        await sortSelect.selectOption('score-asc');

        // BUG: The dialog should NOT reappear.
        await expect(dialog).toBeHidden({ timeout: 5000 });

        // Items should still be visible
        await expect(items.first()).toBeVisible();
    });
});
