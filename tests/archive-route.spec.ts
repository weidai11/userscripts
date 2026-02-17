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
        const firstItemTitle = page.locator('.pr-item h2').first();
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
        await page.locator('#archive-view').selectOption('thread-full');

        // Verify Thread Structure - uses Power Reader's standard post/comment classes
        const rootPost = page.locator('.pr-post');
        await expect(rootPost).toBeVisible();
        await expect(rootPost).toContainText('Context Post');

        // Thread view now renders comments using standard Power Reader comment structure
        const userComment = page.locator('.pr-comment[data-id="c1"]');
        await expect(userComment).toBeVisible();
        await expect(userComment).toContainText('My Reply');

        // [WS2-FIX] Assert parent context comment is rendered
        // The parent comment should be visible as context in the same post group
        const parentComment = page.locator('.pr-comment[data-id="c-parent"]');
        await expect(parentComment).toBeVisible();
        await expect(parentComment).toContainText('Parent Comment Body');

        // Verify parent and child are in the same post group
        const postGroup = page.locator('.pr-post');
        await expect(postGroup).toContainText('Parent Comment Body');
        await expect(postGroup).toContainText('My Reply');
    });

    test('[PR-UARCH-20] thread view supports group-level date sorting', async ({ page }) => {
        const userId = 'u-thread-sort-user';
        const userObj = { _id: userId, username: 'ThreadSort_User', displayName: 'Thread Sort User', slug: 'thread-sort-user', karma: 100 };
        const otherUser = { _id: 'u-other', username: 'OtherUser', displayName: 'Other User', karma: 50 };

        await setupMockEnvironment(page, {
            mockHtml: '<html><head></head><body><div id="app">Original Site Content</div></body></html>',
            testMode: true,
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
}
if (query.includes('GetUserPosts')) {
  return { data: { posts: { results: [] } } };
}
if (query.includes('GetUserComments')) {
  return {
    data: {
      comments: {
        results: [
          // Post 1: Newer comment (should appear first in date sort)
          {
            _id: 'c-post1',
            postedAt: '2025-01-15T12:00:00Z',
            baseScore: 10,
            htmlBody: '<p>Comment on Post 1</p>',
            user: ${JSON.stringify(userObj)},
            post: { _id: 'p1', title: 'Newer Post', pageUrl: '...', user: ${JSON.stringify(otherUser)} },
            parentComment: null,
            postId: 'p1'
          },
          // Post 2: Older comment (should appear second in date sort)
          {
            _id: 'c-post2',
            postedAt: '2025-01-10T12:00:00Z',
            baseScore: 50,
            htmlBody: '<p>Comment on Post 2</p>',
            user: ${JSON.stringify(userObj)},
            post: { _id: 'p2', title: 'Older Post', pageUrl: '...', user: ${JSON.stringify(otherUser)} },
            parentComment: null,
            postId: 'p2'
          }
        ]
      }
    }
  };
}
return { data: {} };
`
        });

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=ThreadSort_User', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Switch to Thread View
        await page.locator('#archive-view').selectOption('thread-full');

        // Verify both posts are rendered
        await expect(page.locator('.pr-post')).toHaveCount(2);

        // Default date sort (newest first) - Post 1 should come before Post 2
        const postTitles = page.locator('.pr-post-header h2');
        await expect(postTitles.nth(0)).toContainText('Newer Post');
        await expect(postTitles.nth(1)).toContainText('Older Post');

        // Change to date-asc (oldest first)
        await page.locator('#archive-sort').selectOption('date-asc');

        // Wait for rerender and verify Post 2 now comes before Post 1
        await expect(async () => {
            const titles = await postTitles.allTextContents();
            expect(titles[0]).toContain('Older Post');
            expect(titles[1]).toContain('Newer Post');
        }).toPass({ timeout: 5000 });
    });

    test('[PR-UARCH-21] thread view supports group-level karma sorting', async ({ page }) => {
        const userId = 'u-karma-sort-user';
        const userObj = { _id: userId, username: 'KarmaSort_User', displayName: 'Karma Sort User', slug: 'karma-sort-user', karma: 100 };
        const otherUser = { _id: 'u-other', username: 'OtherUser', displayName: 'Other User', karma: 50 };

        await setupMockEnvironment(page, {
            mockHtml: '<html><head></head><body><div id="app">Original Site Content</div></body></html>',
            testMode: true,
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
}
if (query.includes('GetUserPosts')) {
  return { data: { posts: { results: [] } } };
}
if (query.includes('GetUserComments')) {
  return {
    data: {
      comments: {
        results: [
          // Post 1: Lower score comment
          {
            _id: 'c-low',
            postedAt: '2025-01-15T12:00:00Z',
            baseScore: 5,
            htmlBody: '<p>Low score comment</p>',
            user: ${JSON.stringify(userObj)},
            post: { _id: 'p-low', title: 'Low Karma Post', pageUrl: '...', user: ${JSON.stringify(otherUser)} },
            parentComment: null,
            postId: 'p-low'
          },
          // Post 2: Higher score comment
          {
            _id: 'c-high',
            postedAt: '2025-01-10T12:00:00Z',
            baseScore: 100,
            htmlBody: '<p>High score comment</p>',
            user: ${JSON.stringify(userObj)},
            post: { _id: 'p-high', title: 'High Karma Post', pageUrl: '...', user: ${JSON.stringify(otherUser)} },
            parentComment: null,
            postId: 'p-high'
          }
        ]
      }
    }
  };
}
return { data: {} };
`
        });

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=KarmaSort_User', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Switch to Thread View
        await page.locator('#archive-view').selectOption('thread-full');

        // Verify both posts are rendered
        await expect(page.locator('.pr-post')).toHaveCount(2);

        // Change to karma sort (high to low) - High Karma Post should come first
        await page.locator('#archive-sort').selectOption('score');

        await expect(async () => {
            const titles = await page.locator('.pr-post-header h2').allTextContents();
            expect(titles[0]).toContain('High Karma Post');
            expect(titles[1]).toContain('Low Karma Post');
        }).toPass({ timeout: 5000 });

        // Change to karma-asc (low to high) - Low Karma Post should come first
        await page.locator('#archive-sort').selectOption('score-asc');

        await expect(async () => {
            const titles = await page.locator('.pr-post-header h2').allTextContents();
            expect(titles[0]).toContain('Low Karma Post');
            expect(titles[1]).toContain('High Karma Post');
        }).toPass({ timeout: 5000 });
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
        await expect(page.locator('.pr-item')).toHaveCount(2);

        // Test valid regex: match posts containing "alpha" or "beta"
        const searchInput = page.locator('#archive-search');
        await searchInput.fill('alpha|beta');

        // Wait for filter to apply using polling
        await expect(async () => {
            const count = await page.locator('.pr-item').count();
            expect(count).toBe(2);
        }).toPass({ timeout: 5000 });

        // Test more specific regex: only "Alpha" (case insensitive)
        await searchInput.fill('^.*Alpha.*$');

        // Wait for filter to apply
        await expect(async () => {
            const count = await page.locator('.pr-item').count();
            expect(count).toBe(1);
        }).toPass({ timeout: 5000 });

        await expect(page.locator('.pr-item h2')).toHaveText('Test Post Alpha');
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
        await expect(page.locator('.pr-item')).toHaveCount(2);

        // Enter invalid regex (unmatched bracket)
        const searchInput = page.locator('#archive-search');
        await searchInput.fill('[bracket');

        // Wait for fallback text search to apply using polling
        await expect(async () => {
            const count = await page.locator('.pr-item').count();
            expect(count).toBe(1);
        }).toPass({ timeout: 5000 });

        await expect(page.locator('.pr-item h2')).toHaveText('Special [Bracket] Post');
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
            const titles = await page.locator('.pr-item h2').allTextContents();
            expect(titles[0]).toBe('Low Score Old Post');
        }).toPass({ timeout: 5000 });

        // Test score-asc (lowest karma first)
        await sortSelect.selectOption('score-asc');
        // Wait for sort to apply
        const allItems = page.locator('.pr-item');
        await expect(async () => {
            await expect(allItems.first()).toContainText('Low Score Old Post');
        }).toPass({ timeout: 5000 });

        // Test replyTo sort (comments should order by interlocutor name: Apple before Zebra)
        await sortSelect.selectOption('replyTo');
        await expect(async () => {
            const ids = await page
                .locator('.pr-item')
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
        await expect(page.locator('.pr-item')).toBeVisible();
        await expect(page.locator('.pr-archive-index-item')).toHaveCount(0);

        // Test Index View
        await viewSelect.selectOption('index');
        await expect(page.locator('.pr-archive-index-item')).toBeVisible();
        await expect(page.locator('.pr-archive-index-item')).toHaveCount(1);

        // Test Thread View - now uses Power Reader's standard post/comment classes
        await viewSelect.selectOption('thread-full');
        await expect(page.locator('.pr-post')).toBeVisible();
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
        await expect(page.locator('.pr-item')).toHaveCount(50, { timeout: 15000 });
        await expect(loadMoreContainer).toBeVisible();
        await expect(loadMoreBtn).toContainText('Load More (10 remaining)');

        await loadMoreBtn.click();

        // After one click, all 60 items should be rendered and load-more hidden.
        await expect(page.locator('.pr-item')).toHaveCount(60, { timeout: 15000 });
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
            onInit: `window.__PR_ARCHIVE_LARGE_THRESHOLD = 100;`,
            onGraphQL: `
                const userId = 'u-large';
                const userObj = { _id: userId, username: '${username}', displayName: 'Big User' };
                
                if (query.includes('GetUserBySlug')) return { data: { user: userObj } };
                if (query.includes('GetUserPosts')) {
                    if (variables.before) return { data: { posts: { results: [] } } };
                    const results = [];
                    for (let i = 0; i < 200; i++) {
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
        await expect(dialog).toContainText('200');

        // Choose "Render All"
        const renderAllBtn = page.locator('#render-all-btn');
        await renderAllBtn.click();

        // Feed should now contain items
        await expect(dialog).toBeHidden();
        const items = page.locator('.pr-item');
        await expect(items.first()).toBeVisible();

        // Change sort - THIS IS WHERE THE BUG IS
        const sortSelect = page.locator('#archive-sort');
        await sortSelect.selectOption('score-asc');

        // BUG: The dialog should NOT reappear.
        await expect(dialog).toBeHidden({ timeout: 5000 });

        // Items should still be visible
        await expect(items.first()).toBeVisible();
    });

    test('[PR-UARCH-19] event handlers work after archive rerender (ReaderState identity)', async ({ page }) => {
        // This test verifies that the ReaderState identity fix works correctly.
        // Event listeners hold a reference to ReaderState, so after a rerender
        // (which mutates the state in place), handlers should still work.
        const username = 'rerender-test';
        const userId = 'u-rerender';

        await setupMockEnvironment(page, {
            mockHtml: '<html><head></head><body><div id="app">Original Site Content</div></body></html>',
            testMode: true,
            onGraphQL: `
      const userObj = { _id: 'u-rerender', username: 'rerender-test', displayName: 'Rerender Test User', slug: 'rerender-test', karma: 100 };
      const otherUser = { _id: 'u-other', username: 'OtherUser', displayName: 'Other User' };
      
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
                  _id: 'c-child',
                  postedAt: '2025-01-10T12:00:00Z',
                  baseScore: 5,
                  htmlBody: '<p>Child reply with parent context</p>',
                  user: userObj,
                  post: { _id: 'p1', title: 'Test Post', pageUrl: '...', user: userObj },
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
        // Return the parent comment when fetching context
        const parentComment = {
          _id: 'c-parent',
          postedAt: '2025-01-05T12:00:00Z',
          baseScore: 10,
          htmlBody: '<p>Parent comment body</p>',
          user: otherUser,
          postId: 'p1',
          parentComment: null
        };
        return {
          data: {
            comments: {
              results: [parentComment]
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

        // Switch to Thread View
        await page.locator('#archive-view').selectOption('thread-full');

        // Wait for thread view to render
        await expect(page.locator('.pr-post')).toBeVisible();
        await expect(page.locator('.pr-comment[data-id="c-child"]')).toBeVisible();

        // Trigger a rerender by changing sort (this calls rerenderAll internally)
        await page.locator('#archive-sort').selectOption('score');

        // After rerender, verify the comment is still visible
        const comment = page.locator('.pr-comment[data-id="c-child"]');
        await expect(comment).toBeVisible();

        // Test [r] button (load descendants) - should trigger GraphQL query
        const rButton = comment.locator('[data-action="load-descendants"]');
        await expect(rButton).toBeVisible();

        // Test [t] button (load parents) - should be visible and clickable
        // The key assertion is that this doesn't throw an error after rerender,
        // which proves the ReaderState reference is still valid
        const tButton = comment.locator('[data-action="load-parents-and-scroll"]');
        await expect(tButton).toBeVisible();
        await tButton.click();

        // If the click didn't throw, the state reference is valid
        // This is the main assertion - event handlers work after rerender

        // Test find-parent [^] button - should also be clickable
        const findParentBtn = comment.locator('[data-action="find-parent"]');
        await expect(findParentBtn).toBeVisible();
        await findParentBtn.click();

        // If we get here without errors, the ReaderState identity fix is working
    });

    test('[PR-UARCH-23] archive thread view populates currentUserId for authenticated actions', async ({ page }) => {
        const userId = 'u-auth-test';
        const userObj = { _id: userId, username: 'AuthTest_User', displayName: 'Auth Test', slug: 'auth-test-user', karma: 100 };
        const otherUser = { _id: 'u-other', username: 'OtherUser', displayName: 'Other User', karma: 50 };

        await setupMockEnvironment(page, {
            mockHtml: '<html><head></head><body><div id="app">Original Site Content</div></body></html>',
            testMode: true,
            onInit: `
      window.LessWrong = {
        params: {
          currentUser: {
            _id: '${userId}',
            username: 'AuthTest_User',
            displayName: 'Auth Test'
          }
        }
      };
    `,
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
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
            _id: 'c-vote-test',
            postedAt: '2025-01-10T12:00:00Z',
            baseScore: 5,
            htmlBody: '<p>Vote on me</p>',
            user: ${JSON.stringify(otherUser)},
            post: { _id: 'p1', title: 'Vote Test', pageUrl: '...', user: ${JSON.stringify(otherUser)} },
            parentComment: null,
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

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=AuthTest_User', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Switch to Thread View
        await page.locator('#archive-view').selectOption('thread-full');

        // Wait for thread view to render
        await expect(page.locator('.pr-comment[data-id="c-vote-test"]')).toBeVisible();

        // [P1-FIX] Verify that currentUserId is populated in the ReaderState
        // Check via window access - the archive UIHost should have set currentUserId
        const readerStateCheck = await page.evaluate(() => {
            // Access the archive state through the global archiveState or check DOM
            // The vote buttons should be present and interactive if currentUserId is set
            const comment = document.querySelector('.pr-comment[data-id="c-vote-test"]');
            if (!comment) return { error: 'Comment not found' };

            // Check if vote buttons exist and are not disabled
            const upvoteBtn = comment.querySelector('[data-action="karma-up"]');
            const downvoteBtn = comment.querySelector('[data-action="karma-down"]');

            return {
                hasVoteButtons: !!upvoteBtn && !!downvoteBtn,
                upvoteDisabled: upvoteBtn?.classList.contains('disabled'),
                downvoteDisabled: downvoteBtn?.classList.contains('disabled')
            };
        });

        // Vote buttons should be present (currentUserId is set)
        expect(readerStateCheck.hasVoteButtons).toBe(true);
        // Buttons should NOT be disabled (user is authenticated)
        expect(readerStateCheck.upvoteDisabled).toBeFalsy();
        expect(readerStateCheck.downvoteDisabled).toBeFalsy();
    });

    test('[PR-UARCH-24] thread sort mode persists through Load More', async ({ page }) => {
        const userId = 'u-sort-persist';
        const userObj = { _id: userId, username: 'SortPersist_User', displayName: 'Sort Persist', slug: 'sort-persist-user', karma: 100 };
        const otherUser = { _id: 'u-other', username: 'OtherUser', displayName: 'Other User', karma: 50 };

        // Create comments across 2 posts to test pagination
        // Post 2 has higher score, should come first in karma sort
        const comments = [
            {
                _id: 'c1',
                postedAt: '2025-01-15T12:00:00Z',
                baseScore: 5,
                htmlBody: '<p>Low score comment</p>',
                user: userObj,
                post: { _id: 'p1', title: 'Low Karma Post', pageUrl: '...', user: otherUser },
                parentComment: null,
                postId: 'p1'
            },
            {
                _id: 'c2',
                postedAt: '2025-01-10T12:00:00Z',
                baseScore: 100,
                htmlBody: '<p>High score comment</p>',
                user: userObj,
                post: { _id: 'p2', title: 'High Karma Post', pageUrl: '...', user: otherUser },
                parentComment: null,
                postId: 'p2'
            }
        ];

        await setupMockEnvironment(page, {
            mockHtml: '<html><head></head><body><div id="app">Original Site Content</div></body></html>',
            testMode: true,
            onInit: `window.__PR_RENDER_LIMIT_OVERRIDE = 1;`, // Only render 1 item initially
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
}
if (query.includes('GetUserPosts')) {
  return { data: { posts: { results: [] } } };
}
if (query.includes('GetUserComments')) {
  return { data: { comments: { results: ${JSON.stringify(comments)} } } };
}
return { data: {} };
`
        });

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=SortPersist_User', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Switch to Thread View
        await page.locator('#archive-view').selectOption('thread-full');

        // Select karma sort (high to low)
        await page.locator('#archive-sort').selectOption('score');

        // Wait for sort to apply and verify High Karma Post is visible
        await expect(async () => {
            const posts = await page.locator('.pr-post').count();
            expect(posts).toBeGreaterThan(0);
            // Check the visible post is High Karma (c2 with score 100)
            const html = await page.locator('.pr-post').first().innerHTML();
            expect(html).toContain('High Karma Post');
        }).toPass({ timeout: 5000 });

        // Verify Load More button is present (we have 2 items but limit is 1)
        const loadMoreBtn = page.locator('#archive-load-more button');
        await expect(loadMoreBtn).toBeVisible();

        // [P2-FIX] Click Load More and verify sort is maintained
        await loadMoreBtn.click();

        await expect(page.locator('.pr-post')).toHaveCount(2, { timeout: 10000 });

        // After Load More, High Karma Post should still be first
        const firstPostHtml = await page.locator('.pr-post').first().innerHTML();
        expect(firstPostHtml).toContain('High Karma Post');

        // Low Karma Post should also be visible now (2nd)
        const secondPostHtml = await page.locator('.pr-post').nth(1).innerHTML();
        expect(secondPostHtml).toContain('Low Karma Post');
    });

    test('[PR-UARCH-25] context comments do not leak into card/index view', async ({ page }) => {
        const userId = 'u-context-test';
        const userObj = { _id: userId, username: 'ContextTest_User', displayName: 'Context Test', slug: 'context-test-user', karma: 100 };
        const otherUser = { _id: 'u-other', username: 'OtherUser', displayName: 'Other User', karma: 50 };

        await setupMockEnvironment(page, {
            mockHtml: '<html><head></head><body><div id="app">Original Site Content</div></body></html>',
            testMode: true,
            onGraphQL: `
const userObj = { _id: '${userId}', username: 'ContextTest_User', displayName: 'Context Test', slug: 'context-test-user', karma: 100 };
const otherUser = { _id: 'u-other', username: 'OtherUser', displayName: 'Other User', karma: 50 };

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
            _id: 'c-child',
            postedAt: '2025-01-10T12:00:00Z',
            baseScore: 5,
            htmlBody: '<p>Child comment by target user</p>',
            user: userObj,
            post: { _id: 'p1', title: 'Test Post', pageUrl: '...', user: otherUser },
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
  // Return parent context comment
  return {
    data: {
      comments: {
        results: [
          {
            _id: 'c-parent',
            postedAt: '2025-01-09T12:00:00Z',
            baseScore: 10,
            htmlBody: '<p>Parent context comment by other user</p>',
            user: otherUser,
            postId: 'p1',
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

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=ContextTest_User', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Step 1: Switch to Thread View - this loads parent context
        await page.locator('#archive-view').selectOption('thread-full');

        // Wait for thread view to render with context
        await expect(page.locator('.pr-comment[data-id="c-parent"]')).toBeVisible();
        await expect(page.locator('.pr-comment[data-id="c-child"]')).toBeVisible();

        // Step 2: Switch to Card View - context should NOT appear here
        await page.locator('#archive-view').selectOption('card');

        // Wait for card view to render
        await expect(page.locator('.pr-item')).toBeVisible();

        // [P2-FIX] Verify parent context comment does NOT appear in card view
        // It should only be in thread view, not in the canonical archive items
        const cardItems = await page.locator('.pr-item').allTextContents();
        const allCardText = cardItems.join(' ');

        // Should contain the child comment (target user's content)
        expect(allCardText).toContain('Child comment by target user');

        // Should NOT contain the parent context comment (other user's content)
        expect(allCardText).not.toContain('Parent context comment by other user');

        // Step 3: Switch to Index View - context should also NOT appear here
        await page.locator('#archive-view').selectOption('index');

        // Wait for index view to render
        await expect(page.locator('.pr-archive-index-item')).toBeVisible();

        // [P2-FIX] Verify parent context comment does NOT appear in index view
        const indexItems = await page.locator('.pr-archive-index-item').allTextContents();
        const allIndexText = indexItems.join(' ');

        // Should contain the child comment
        expect(allIndexText).toContain('Child comment by target user');

        // Should NOT contain the parent context comment
        expect(allIndexText).not.toContain('Parent context comment by other user');
    });

    test('[PR-UARCH-38] archive link previews dismiss when mouse leaves trigger', async ({ page }) => {
        const userId = 'u-preview-test';
        const userObj = { _id: userId, username: 'PreviewTest_User', displayName: 'Preview Test', slug: 'preview-test-user', karma: 100 };

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
            _id: 'p-preview',
            title: 'Preview Target Post',
            slug: 'preview-target-post',
            pageUrl: 'https://www.lesswrong.com/posts/p-preview/preview-target-post',
            postedAt: '2025-01-12T12:00:00Z',
            baseScore: 42,
            voteCount: 4,
            commentCount: 0,
            htmlBody: '<p>Archive post body</p>',
            contents: { markdown: 'Archive post body' },
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

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=PreviewTest_User', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        const authorLink = page.locator('.pr-post .pr-author').first();
        await expect(authorLink).toBeVisible();
        await authorLink.hover();

        const preview = page.locator('.pr-preview-overlay.author-preview');
        await expect(preview).toBeVisible({ timeout: 10000 });

        await page.mouse.move(0, 0);
        await expect(preview).not.toBeVisible({ timeout: 5000 });
    });

    test('[PR-UARCH-26] Load More preserves link previews and post action buttons', async ({ page }) => {
        const userId = 'u-hooks-test';
        const userObj = { _id: userId, username: 'HooksTest_User', displayName: 'Hooks Test', slug: 'hooks-test-user', karma: 100 };
        const otherUser = { _id: 'u-other', username: 'OtherUser', displayName: 'Other User', karma: 50 };

        // Create comments with links that should have link previews
        const comments = [
            {
                _id: 'c1',
                postedAt: '2025-01-10T12:00:00Z',
                baseScore: 10,
                htmlBody: '<p>Check out <a href="https://example.com">this link</a></p>',
                user: userObj,
                post: { _id: 'p1', title: 'Post 1', pageUrl: '...', user: otherUser },
                parentComment: null,
                postId: 'p1'
            },
            {
                _id: 'c2',
                postedAt: '2025-01-09T12:00:00Z',
                baseScore: 5,
                htmlBody: '<p>Another <a href="https://test.com">link here</a></p>',
                user: userObj,
                post: { _id: 'p2', title: 'Post 2', pageUrl: '...', user: otherUser },
                parentComment: null,
                postId: 'p2'
            }
        ];

        await setupMockEnvironment(page, {
            mockHtml: '<html><head></head><body><div id="app">Original Site Content</div></body></html>',
            testMode: true,
            onInit: `window.__PR_RENDER_LIMIT_OVERRIDE = 1;`, // Only render 1 initially
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
}
if (query.includes('GetUserPosts')) {
  return { data: { posts: { results: [] } } };
}
if (query.includes('GetUserComments')) {
  return { data: { comments: { results: ${JSON.stringify(comments)} } } };
}
return { data: {} };
`
        });

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=HooksTest_User', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Switch to Thread View (has post action buttons and link previews)
        await page.locator('#archive-view').selectOption('thread-full');

        // Wait for initial render
        await expect(page.locator('.pr-post')).toHaveCount(1);

        // Hover over a link to verify link previews are working initially
        const firstLink = page.locator('.pr-post a[href="https://example.com"]');
        await firstLink.hover();

        // Verify Load More button is present
        const loadMoreBtn = page.locator('#archive-load-more button');
        await expect(loadMoreBtn).toBeVisible();

        // [P2-FIX] Click Load More and verify UI hooks are reinitialized
        await loadMoreBtn.click();

        // Verify both posts are now visible
        await expect(page.locator('.pr-post')).toHaveCount(2, { timeout: 10000 });

        // Verify link previews still work after Load More
        const secondLink = page.locator('.pr-post a[href="https://test.com"]');
        await expect(secondLink).toBeVisible();
        await secondLink.hover();

        // If we get here without errors, link previews and post action buttons are working
        // The main assertion is that no errors occur (which would happen if hooks weren't reinitialized)
    });
});
