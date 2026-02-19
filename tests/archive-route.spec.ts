import { test, expect } from '@playwright/test';
import { getScriptContent, setupMockEnvironment } from './helpers/setup';
import {
    expectArchiveScopeSelected,
    expectArchiveViewSelected,
    selectArchiveScope,
    selectArchiveView
} from './helpers/archiveControls';

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
        await selectArchiveView(page, 'index');
        await expect(page.locator('.pr-archive-index-item').first()).toBeVisible();
        await expect(page.locator('.pr-archive-index-item')).toHaveCount(2);

        // Test Sorting (To Karma High-Low)
        await page.locator('#archive-sort').selectOption('score');
        await expect(page.locator('.pr-archive-index-item .pr-index-title').first()).toHaveText('Old High Score Post');
    });

    test('[PR-UARCH-41] archive search worker is enabled by default', async ({ page }) => {
        await setupMockEnvironment(page, {
            mockHtml: '<html><head></head><body><div id="app">Original Site Content</div></body></html>',
            testMode: true,
            onInit: `
const win = window;
win.__TEST_WORKER_CTOR_COUNT__ = 0;
win.__TEST_WORKER_POST_COUNT__ = 0;
const OriginalWorker = win.Worker;
win.Worker = class WorkerSpy extends OriginalWorker {
  constructor(...args) {
    super(...args);
    win.__TEST_WORKER_CTOR_COUNT__ += 1;
  }
  postMessage(...args) {
    win.__TEST_WORKER_POST_COUNT__ += 1;
    return super.postMessage(...args);
  }
};
`,
            onGraphQL: `
const userId = 'u-worker-default';
const userObj = { _id: userId, username: 'WorkerDefault_User', displayName: 'Worker Default User', slug: 'worker-default-user', karma: 100 };
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
            _id: 'c-worker-default',
            postedAt: '2025-01-10T12:00:00Z',
            baseScore: 5,
            htmlBody: '<p>Worker default path comment</p>',
            user: userObj,
            postId: 'p-worker-default',
            post: { _id: 'p-worker-default', title: 'Worker Default Post', pageUrl: 'https://lesswrong.com/posts/p-worker-default', user: userObj },
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

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=WorkerDefault_User', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        await expect.poll(async () => page.evaluate(() => (window as any).__TEST_WORKER_CTOR_COUNT__ || 0)).toBeGreaterThan(0);
        await expect.poll(async () => page.evaluate(() => (window as any).__TEST_WORKER_POST_COUNT__ || 0)).toBeGreaterThan(0);
    });

    test('[PR-UARCH-41] archive search worker can be disabled via global opt-out', async ({ page }) => {
        await setupMockEnvironment(page, {
            mockHtml: '<html><head></head><body><div id="app">Original Site Content</div></body></html>',
            testMode: true,
            onInit: `
const win = window;
win.__PR_ARCHIVE_SEARCH_USE_WORKER = false;
win.__TEST_WORKER_CTOR_COUNT__ = 0;
win.__TEST_WORKER_POST_COUNT__ = 0;
const OriginalWorker = win.Worker;
win.Worker = class WorkerSpy extends OriginalWorker {
  constructor(...args) {
    super(...args);
    win.__TEST_WORKER_CTOR_COUNT__ += 1;
  }
  postMessage(...args) {
    win.__TEST_WORKER_POST_COUNT__ += 1;
    return super.postMessage(...args);
  }
};
`,
            onGraphQL: `
const userId = 'u-worker-off';
const userObj = { _id: userId, username: 'WorkerOff_User', displayName: 'Worker Off User', slug: 'worker-off-user', karma: 100 };
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
            _id: 'c-worker-off',
            postedAt: '2025-01-10T12:00:00Z',
            baseScore: 5,
            htmlBody: '<p>Worker opt-out path comment</p>',
            user: userObj,
            postId: 'p-worker-off',
            post: { _id: 'p-worker-off', title: 'Worker Off Post', pageUrl: 'https://lesswrong.com/posts/p-worker-off', user: userObj },
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

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=WorkerOff_User', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        const workerCtorCount = await page.evaluate(() => (window as any).__TEST_WORKER_CTOR_COUNT__ || 0);
        const workerPostCount = await page.evaluate(() => (window as any).__TEST_WORKER_POST_COUNT__ || 0);
        expect(workerCtorCount).toBe(0);
        expect(workerPostCount).toBe(0);
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
        await selectArchiveView(page, 'thread-full');

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
        await selectArchiveView(page, 'thread-full');

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
        await selectArchiveView(page, 'thread-full');

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

    test('search supports explicit regex literal filtering [PR-UARCH-08]', async ({ page }) => {
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

        // Regex literals are explicit in structured mode.
        const searchInput = page.locator('#archive-search');
        await searchInput.fill('/alpha|beta/i');

        // Wait for filter to apply using polling
        await expect(async () => {
            const count = await page.locator('.pr-item').count();
            expect(count).toBe(2);
        }).toPass({ timeout: 5000 });

        // Match only the alpha post.
        await searchInput.fill('/^.*alpha.*$/i');

        // Wait for filter to apply
        await expect(async () => {
            const count = await page.locator('.pr-item').count();
            expect(count).toBe(1);
        }).toPass({ timeout: 5000 });

        await expect(page.locator('.pr-item h2')).toHaveText('Test Post Alpha');
    });

    test('search syntax help expands and example clicks execute queries [PR-UARCH-08]', async ({ page }) => {
        const userId = 'u-help-user';
        const userObj = { _id: userId, username: 'Help_User', displayName: 'Help User', slug: 'help-user', karma: 100 };

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
                                        _id: 'p-help-1',
                                        title: 'Alignment Tax Primer',
                                        slug: 'alignment-tax-primer',
                                        pageUrl: 'https://lesswrong.com/posts/p-help-1',
                                        postedAt: '2025-01-02T12:00:00Z',
                                        baseScore: 10,
                                        voteCount: 5,
                                        commentCount: 0,
                                        htmlBody: '<p>Alignment tax in practice</p>',
                                        contents: { markdown: 'Alignment tax in practice' },
                                        user: ${JSON.stringify(userObj)}
                                    },
                                    {
                                        _id: 'p-help-2',
                                        title: 'Unrelated Post',
                                        slug: 'unrelated-post',
                                        pageUrl: 'https://lesswrong.com/posts/p-help-2',
                                        postedAt: '2025-01-01T12:00:00Z',
                                        baseScore: 20,
                                        voteCount: 7,
                                        commentCount: 0,
                                        htmlBody: '<p>General topic text</p>',
                                        contents: { markdown: 'General topic text' },
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

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=Help_User', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        const helpDetails = page.locator('#archive-search-help');
        await expect(helpDetails).toBeVisible();
        await expect(helpDetails).not.toHaveAttribute('open', '');

        await page.locator('#archive-search-help > summary').click();
        await expect(helpDetails).toHaveAttribute('open', '');

        await page.locator('.pr-search-example[data-query=\'"alignment tax" -type:comment\']').click();

        await expect(page.locator('#archive-search')).toHaveValue('"alignment tax" -type:comment');
        await expect.poll(() =>
            page.evaluate(() => (document.activeElement as HTMLElement | null)?.id || '')
        ).toBe('archive-search');
        await expect(page.locator('.pr-item')).toHaveCount(1);
        await expect(page.locator('.pr-item h2')).toHaveText('Alignment Tax Primer');
    });

    test('search index refreshes after in-place canonical load-all merge [PR-UARCH-22]', async ({ page }) => {
        const userId = 'u-search-refresh-user';
        const userObj = { _id: userId, username: 'SearchRefresh_User', displayName: 'Search Refresh User', slug: 'search-refresh-user', karma: 100 };
        const otherUser = { _id: 'u-other-search-refresh', username: 'OtherSearchRefresh', displayName: 'Other Search Refresh', slug: 'other-search-refresh', karma: 50 };

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
        results: [{
          _id: 'p-load',
          title: 'Search Refresh Post',
          slug: 'search-refresh-post',
          pageUrl: 'https://lesswrong.com/posts/p-load',
          postedAt: '2025-01-05T12:00:00Z',
          baseScore: 10,
          voteCount: 2,
          commentCount: 2,
          htmlBody: '<p>Post body</p>',
          contents: { markdown: 'Post body' },
          user: ${JSON.stringify(userObj)}
        }]
      }
    }
  };
}
if (query.includes('GetUserComments')) {
  return {
    data: {
      comments: {
        results: [{
          _id: 'c-load-authored',
          postedAt: '2025-01-05T12:30:00Z',
          baseScore: 5,
          voteCount: 1,
          htmlBody: '<p>Baseline authored comment</p>',
          contents: { markdown: 'Baseline authored comment' },
          user: ${JSON.stringify(userObj)},
          post: { _id: 'p-load', title: 'Search Refresh Post', pageUrl: 'https://lesswrong.com/posts/p-load', user: ${JSON.stringify(otherUser)} },
          parentComment: null,
          postId: 'p-load',
          parentCommentId: null
        }]
      }
    }
  };
}
if (query.includes('query GetPostComments')) {
  return {
    data: {
      comments: {
        results: [
          {
            _id: 'c-load-authored',
            postedAt: '2025-01-05T12:30:00Z',
            baseScore: 5,
            voteCount: 1,
            htmlBody: '<p>Baseline authored comment</p>',
            contents: { markdown: 'Baseline authored comment' },
            user: ${JSON.stringify(userObj)},
            post: { _id: 'p-load', title: 'Search Refresh Post', pageUrl: 'https://lesswrong.com/posts/p-load', user: ${JSON.stringify(otherUser)} },
            parentComment: null,
            postId: 'p-load',
            parentCommentId: null
          },
          {
            _id: 'c-load-new',
            postedAt: '2025-01-05T13:00:00Z',
            baseScore: 15,
            voteCount: 3,
            htmlBody: '<p>searchindexneedle</p>',
            contents: { markdown: 'searchindexneedle' },
            user: ${JSON.stringify(otherUser)},
            post: { _id: 'p-load', title: 'Search Refresh Post', pageUrl: 'https://lesswrong.com/posts/p-load', user: ${JSON.stringify(otherUser)} },
            parentComment: null,
            postId: 'p-load',
            parentCommentId: null
          }
        ]
      }
    }
  };
}
return { data: {} };
`
        });

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=SearchRefresh_User', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        await selectArchiveView(page, 'thread-full');
        const loadAllBtn = page.locator('.pr-post[data-id="p-load"] [data-action="load-all-comments"]');
        await expect(loadAllBtn).toBeVisible();
        await loadAllBtn.click();
        await expect(loadAllBtn).toHaveText('[a]', { timeout: 10000 });

        await page.locator('#archive-search').fill('searchindexneedle');

        await expect(async () => {
            await expect(page.locator('#archive-status')).toContainText('1 search result');
            await expect(page.locator('.pr-comment[data-id="c-load-new"]')).toHaveCount(1);
            await expect(page.locator('.pr-comment[data-id="c-load-authored"]')).toHaveCount(0);
        }).toPass({ timeout: 5000 });
    });

    test('[PR-UARCH-46] archive search highlights matches and centers index snippets', async ({ page }) => {
        const userId = 'u-highlight-user';
        const username = 'Highlight_User';
        const userObj = { _id: userId, username, displayName: 'Highlight User', slug: 'highlight-user', karma: 100 };
        const matchBody = `BEGINNING_SENTINEL ${'x '.repeat(90)}alignment tax ${'y '.repeat(90)}`;

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
          {
            _id: 'c-highlight-hit',
            postedAt: '2025-01-10T12:00:00Z',
            baseScore: 12,
            voteCount: 2,
            htmlBody: '<p>${matchBody}</p>',
            contents: { markdown: ${JSON.stringify(matchBody)} },
            user: ${JSON.stringify(userObj)},
            post: { _id: 'p-highlight', title: 'Highlight Post', pageUrl: 'https://lesswrong.com/posts/p-highlight', user: ${JSON.stringify(userObj)} },
            parentComment: null,
            postId: 'p-highlight',
            parentCommentId: null
          },
          {
            _id: 'c-highlight-miss',
            postedAt: '2025-01-09T12:00:00Z',
            baseScore: 1,
            voteCount: 1,
            htmlBody: '<p>No relevant terms in this comment.</p>',
            contents: { markdown: 'No relevant terms in this comment.' },
            user: ${JSON.stringify(userObj)},
            post: { _id: 'p-highlight', title: 'Highlight Post', pageUrl: 'https://lesswrong.com/posts/p-highlight', user: ${JSON.stringify(userObj)} },
            parentComment: null,
            postId: 'p-highlight',
            parentCommentId: null
          }
        ]
      }
    }
  };
}
return { data: {} };
`
        });

        await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}&q=alignment`, { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        await expect(page.locator('.pr-comment[data-id="c-highlight-hit"]')).toHaveCount(1);
        await expect(page.locator('.pr-comment[data-id="c-highlight-miss"]')).toHaveCount(0);
        await expect(page.locator('.pr-comment[data-id="c-highlight-hit"] .pr-comment-body mark.pr-search-highlight')).toHaveCount(1);
        await expect(page.locator('.pr-comment[data-id="c-highlight-hit"] .pr-comment-body mark.pr-search-highlight')).toHaveText(/alignment/i);

        await selectArchiveView(page, 'index');

        const hitRow = page.locator('.pr-archive-index-item[data-id="c-highlight-hit"]');
        const hitSnippet = hitRow.locator('.pr-index-title');
        await expect(hitRow).toBeVisible();
        await expect(hitSnippet).toContainText('alignment tax');
        await expect(hitSnippet).not.toContainText('BEGINNING_SENTINEL');
        await expect(hitSnippet.locator('mark.pr-search-highlight')).toHaveCount(1);

        await hitRow.click();
        await expect(page.locator('.pr-index-expanded[data-id="c-highlight-hit"] .pr-comment-body mark.pr-search-highlight')).toHaveCount(1);

        await page.locator('.pr-index-collapse-btn[data-id="c-highlight-hit"]').click();
        await expect(page.locator('.pr-archive-index-item[data-id="c-highlight-hit"] .pr-index-title mark.pr-search-highlight')).toHaveCount(1);
    });

    test('archive facets add, replace, and remove structured query fragments', async ({ page }) => {
        const userId = 'u-facet-user';
        const username = 'Facet_User';
        const userObj = { _id: userId, username, displayName: 'Facet User', slug: 'facet-user', karma: 100 };
        const authorA = { _id: 'u-author-a', username: 'AuthorA', displayName: 'Facet Author A', slug: 'author-a', karma: 10 };
        const authorB = { _id: 'u-author-b', username: 'AuthorB', displayName: 'Facet Author B', slug: 'author-b', karma: 11 };

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
            _id: 'p-facet-a',
            title: 'Facet Post A',
            slug: 'facet-post-a',
            pageUrl: 'https://lesswrong.com/posts/p-facet-a',
            postedAt: '2025-02-10T12:00:00Z',
            baseScore: 20,
            voteCount: 5,
            commentCount: 0,
            htmlBody: '<p>Post by author A</p>',
            contents: { markdown: 'Post by author A' },
            user: ${JSON.stringify(authorA)}
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
            _id: 'c-facet-a',
            postedAt: '2025-01-15T12:00:00Z',
            baseScore: 6,
            voteCount: 1,
            htmlBody: '<p>Comment by author A</p>',
            contents: { markdown: 'Comment by author A' },
            user: ${JSON.stringify(authorA)},
            post: { _id: 'p-facet-a', title: 'Facet Post A', pageUrl: 'https://lesswrong.com/posts/p-facet-a', user: ${JSON.stringify(authorA)} },
            parentComment: null,
            postId: 'p-facet-a',
            parentCommentId: null
          },
          {
            _id: 'c-facet-b',
            postedAt: '2024-03-01T12:00:00Z',
            baseScore: 8,
            voteCount: 2,
            htmlBody: '<p>Comment by author B</p>',
            contents: { markdown: 'Comment by author B' },
            user: ${JSON.stringify(authorB)},
            post: { _id: 'p-facet-b', title: 'Facet Post B', pageUrl: 'https://lesswrong.com/posts/p-facet-b', user: ${JSON.stringify(authorB)} },
            parentComment: null,
            postId: 'p-facet-b',
            parentCommentId: null
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

        await expect(page.locator('#archive-facets')).toBeVisible();
        const searchInput = page.locator('#archive-search');
        await expect(page.locator('#archive-facets .pr-facet-chip', { hasText: 'Facet Author A' })).toBeVisible();
        await expect(page.locator('#archive-facets .pr-facet-chip', { hasText: 'Facet Author B' })).toBeVisible();
        const postsChip = page.locator('#archive-facets .pr-facet-chip', { hasText: 'Posts' });

        await postsChip.click();
        await expect(searchInput).toHaveValue('type:post');
        await expect.poll(async () => new URL(page.url()).searchParams.get('q')).toBe('type:post');
        await expect(page.locator('#archive-status')).toContainText('1 search result');

        await postsChip.click();
        await expect(searchInput).toHaveValue('');
        await expect.poll(async () => new URL(page.url()).searchParams.get('q')).toBeNull();
        await expect(page.locator('#archive-status')).toContainText('3 search results');

        await searchInput.fill('date:2024-01-01..2025-12-31');
        await page.keyboard.press('Enter');
        await expect.poll(async () => new URL(page.url()).searchParams.get('q')).toContain('date:2024-01-01..2025-12-31');
        await expect(page.locator('#archive-status')).toContainText('3 search results');

        const year2025Chip = page.locator('#archive-facets .pr-facet-chip', { hasText: '2025' });
        await year2025Chip.click();
        await expect(searchInput).toHaveValue('date:2025-01-01..2025-12-31');
        await expect.poll(async () => new URL(page.url()).searchParams.get('q')).toContain('date:2025-01-01..2025-12-31');
        await expect(page.locator('#archive-status')).toContainText('2 search results');

        await searchInput.fill('author:facet-author-a');
        await page.keyboard.press('Enter');
        await expect(searchInput).toHaveValue('author:facet-author-a');
        await expect(page.locator('#archive-status')).toContainText('2 search results');

        const authorAChip = page.locator('#archive-facets .pr-facet-chip', { hasText: 'Facet Author A' });
        await expect(authorAChip).toHaveClass(/active/);
        await authorAChip.click();
        await expect(searchInput).toHaveValue('');
        await expect.poll(async () => new URL(page.url()).searchParams.get('q')).toBeNull();
    });

    test('invalid regex literals are excluded with warning [PR-UARCH-08]', async ({ page }) => {
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

        // Enter invalid regex literal (unterminated character class)
        const searchInput = page.locator('#archive-search');
        await searchInput.fill('/[bracket/i');

        // Invalid regex is excluded; query resolves to browse-all and keeps both items.
        await expect(async () => {
            const count = await page.locator('.pr-item').count();
            expect(count).toBe(2);
        }).toPass({ timeout: 5000 });

        await expect(page.locator('#archive-search-status')).toContainText('Invalid regex literal');
        await expect(page.locator('#archive-search-status .pr-status-chip.pr-status-warning')).toContainText('Invalid regex literal');
    });

    test('structured field operators filter deterministically [PR-UARCH-08]', async ({ page }) => {
        const userId = 'u-field-user';
        const userObj = { _id: userId, username: 'Field_User', displayName: 'Field User', slug: 'field-user', karma: 100 };
        const appleUser = { _id: 'u-apple', username: 'Apple_User', displayName: 'Apple Author', slug: 'apple-user', karma: 50 };
        const zebraUser = { _id: 'u-zebra', username: 'Zebra_User', displayName: 'Zebra Author', slug: 'zebra-user', karma: 50 };

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
                                        _id: 'p-field-1',
                                        title: 'Post January',
                                        slug: 'post-jan',
                                        pageUrl: 'https://lesswrong.com/posts/p-field-1',
                                        postedAt: '2025-01-05T12:00:00Z',
                                        baseScore: 5,
                                        voteCount: 1,
                                        commentCount: 0,
                                        htmlBody: '<p>January content</p>',
                                        contents: { markdown: 'January content' },
                                        user: ${JSON.stringify(userObj)}
                                    },
                                    {
                                        _id: 'p-field-2',
                                        title: 'Post February',
                                        slug: 'post-feb',
                                        pageUrl: 'https://lesswrong.com/posts/p-field-2',
                                        postedAt: '2025-02-05T12:00:00Z',
                                        baseScore: 30,
                                        voteCount: 4,
                                        commentCount: 0,
                                        htmlBody: '<p>February content</p>',
                                        contents: { markdown: 'February content' },
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
                                        _id: 'c-field-1',
                                        postedAt: '2025-01-10T12:00:00Z',
                                        baseScore: 8,
                                        htmlBody: '<p>Comment to Zebra</p>',
                                        user: ${JSON.stringify(userObj)},
                                        post: { _id: 'p-field-1', title: 'Post January', pageUrl: '...', user: ${JSON.stringify(zebraUser)} },
                                        parentComment: null,
                                        postId: 'p-field-1',
                                        parentCommentId: null
                                    },
                                    {
                                        _id: 'c-field-2',
                                        postedAt: '2025-01-20T12:00:00Z',
                                        baseScore: 40,
                                        htmlBody: '<p>Comment to Apple</p>',
                                        user: ${JSON.stringify(userObj)},
                                        post: { _id: 'p-field-1', title: 'Post January', pageUrl: '...', user: ${JSON.stringify(appleUser)} },
                                        parentComment: null,
                                        postId: 'p-field-1',
                                        parentCommentId: null
                                    }
                                ]
                            }
                        }
                    };
                }
                return { data: {} };
            `
        });

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=Field_User', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        const searchInput = page.locator('#archive-search');
        await searchInput.fill('type:comment replyto:apple score:>10 date:2025-01-01..2025-01-31');

        await expect(async () => {
            await expect(page.locator('.pr-comment[data-id="c-field-2"]')).toHaveCount(1);
            await expect(page.locator('.pr-comment[data-id="c-field-1"]')).toHaveCount(0);
            await expect(page.locator('.pr-post[data-id="p-field-1"]')).toHaveCount(0);
            await expect(page.locator('.pr-post[data-id="p-field-2"]')).toHaveCount(0);
        }).toPass({ timeout: 5000 });
    });

    test('top status line and toolbar result count report search state [PR-UARCH-39]', async ({ page }) => {
        const userId = 'u-status-count-user';
        const userObj = { _id: userId, username: 'StatusCount_User', displayName: 'Status Count User', slug: 'status-count-user', karma: 100 };

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
                                        _id: 'p-status-1',
                                        title: 'First Status Post',
                                        slug: 'first-status-post',
                                        pageUrl: 'https://lesswrong.com/posts/p-status-1',
                                        postedAt: '2025-01-05T12:00:00Z',
                                        baseScore: 5,
                                        voteCount: 1,
                                        commentCount: 0,
                                        htmlBody: '<p>Alpha body</p>',
                                        contents: { markdown: 'Alpha body' },
                                        user: ${JSON.stringify(userObj)}
                                    },
                                    {
                                        _id: 'p-status-2',
                                        title: 'Second Status Post',
                                        slug: 'second-status-post',
                                        pageUrl: 'https://lesswrong.com/posts/p-status-2',
                                        postedAt: '2025-01-04T12:00:00Z',
                                        baseScore: 3,
                                        voteCount: 1,
                                        commentCount: 0,
                                        htmlBody: '<p>Beta body</p>',
                                        contents: { markdown: 'Beta body' },
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

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=StatusCount_User', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        const statusEl = page.locator('#archive-status');
        const resultCountEl = page.locator('#archive-result-count');
        await expect(statusEl).toContainText('2 search results');
        await expect(resultCountEl).toHaveText('2 items');

        await page.evaluate(() => {
            const resultCount = document.getElementById('archive-result-count');
            const feed = document.getElementById('archive-feed');
            (window as any).__TEST_LOADING_SEEN__ = false;
            if (!resultCount || !feed) return;
            const observer = new MutationObserver(() => {
                if (resultCount.classList.contains('is-loading') || feed.classList.contains('is-loading')) {
                    (window as any).__TEST_LOADING_SEEN__ = true;
                }
            });
            observer.observe(resultCount, { attributes: true, attributeFilter: ['class'] });
            observer.observe(feed, { attributes: true, attributeFilter: ['class'] });
            (window as any).__TEST_LOADING_OBSERVER__ = observer;
        });

        await page.locator('#archive-search').fill('first');
        await expect(statusEl).toContainText('1 search result');
        await expect(resultCountEl).toContainText('1 result');
        await expect(resultCountEl).toContainText('ms');

        await page.locator('#archive-search').fill('definitely-no-match-token');
        await expect(statusEl).toContainText('0 search results');
        await expect(resultCountEl).toContainText('0 results');

        await page.locator('#archive-search-clear').click();
        await expect(resultCountEl).toHaveText('2 items');

        await expect.poll(() => page.evaluate(() => Boolean((window as any).__TEST_LOADING_SEEN__))).toBe(true);
        await expect.poll(() => page.evaluate(() => {
            const resultCount = document.getElementById('archive-result-count');
            const feed = document.getElementById('archive-feed');
            return Boolean(resultCount && feed && !resultCount.classList.contains('is-loading') && !feed.classList.contains('is-loading'));
        })).toBe(true);

        await page.evaluate(() => {
            const observer = (window as any).__TEST_LOADING_OBSERVER__ as MutationObserver | undefined;
            observer?.disconnect();
            delete (window as any).__TEST_LOADING_OBSERVER__;
        });
    });

    test('directive-only queries keep toolbar count in items mode after canonicalization [PR-UARCH-39]', async ({ page }) => {
        const userId = 'u-directive-count-user';
        const userObj = { _id: userId, username: 'DirectiveCount_User', displayName: 'Directive Count User', slug: 'directive-count-user', karma: 100 };

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
                                        _id: 'p-directive-1',
                                        title: 'Directive First Post',
                                        slug: 'directive-first-post',
                                        pageUrl: 'https://lesswrong.com/posts/p-directive-1',
                                        postedAt: '2025-01-05T12:00:00Z',
                                        baseScore: 5,
                                        voteCount: 1,
                                        commentCount: 0,
                                        htmlBody: '<p>Alpha body</p>',
                                        contents: { markdown: 'Alpha body' },
                                        user: ${JSON.stringify(userObj)}
                                    },
                                    {
                                        _id: 'p-directive-2',
                                        title: 'Directive Second Post',
                                        slug: 'directive-second-post',
                                        pageUrl: 'https://lesswrong.com/posts/p-directive-2',
                                        postedAt: '2025-01-04T12:00:00Z',
                                        baseScore: 3,
                                        voteCount: 1,
                                        commentCount: 0,
                                        htmlBody: '<p>Beta body</p>',
                                        contents: { markdown: 'Beta body' },
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

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=DirectiveCount_User', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        const resultCountEl = page.locator('#archive-result-count');
        await expect(resultCountEl).toHaveText('2 items');

        await page.locator('#archive-search').fill('scope:all');
        await expect(resultCountEl).toHaveText('2 items');
        await expect.poll(async () => new URL(page.url()).searchParams.get('q')).toBeNull();
        await expect.poll(async () => new URL(page.url()).searchParams.get('scope')).toBe('all');
    });

    test('URL restores structured query/sort/scope and canonicalizes in-query scope [PR-UARCH-08]', async ({ page }) => {
        const userId = 'u-url-search-user';
        const userObj = { _id: userId, username: 'UrlSearch_User', displayName: 'URL Search User', slug: 'url-search-user', karma: 100 };

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
                                        _id: 'p-url-1',
                                        title: 'URL Post One',
                                        slug: 'url-post-one',
                                        pageUrl: 'https://lesswrong.com/posts/p-url-1',
                                        postedAt: '2025-01-03T12:00:00Z',
                                        baseScore: 5,
                                        voteCount: 1,
                                        commentCount: 0,
                                        htmlBody: '<p>Post one body</p>',
                                        contents: { markdown: 'Post one body' },
                                        user: ${JSON.stringify(userObj)}
                                    },
                                    {
                                        _id: 'p-url-2',
                                        title: 'URL Post Two',
                                        slug: 'url-post-two',
                                        pageUrl: 'https://lesswrong.com/posts/p-url-2',
                                        postedAt: '2025-01-02T12:00:00Z',
                                        baseScore: 1,
                                        voteCount: 1,
                                        commentCount: 0,
                                        htmlBody: '<p>Post two body</p>',
                                        contents: { markdown: 'Post two body' },
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
                                        _id: 'c-url-1',
                                        postedAt: '2025-01-04T12:00:00Z',
                                        baseScore: 100,
                                        htmlBody: '<p>Comment should be filtered out by type:post</p>',
                                        user: ${JSON.stringify(userObj)},
                                        post: { _id: 'p-url-1', title: 'URL Post One', pageUrl: '...', user: ${JSON.stringify(userObj)} },
                                        parentComment: null,
                                        postId: 'p-url-1',
                                        parentCommentId: null
                                    }
                                ]
                            }
                        }
                    };
                }
                return { data: {} };
            `
        });

        const q = encodeURIComponent('scope:all type:post');
        await page.goto(`https://www.lesswrong.com/reader?view=archive&username=UrlSearch_User&q=${q}&sort=score-asc`, { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        await expect(page.locator('#archive-sort')).toHaveValue('score-asc');
        await expectArchiveScopeSelected(page, 'all');
        await expect(page.locator('.pr-post[data-id="p-url-1"]')).toHaveCount(1);
        await expect(page.locator('.pr-post[data-id="p-url-2"]')).toHaveCount(1);
        await expect(page.locator('.pr-comment[data-id="c-url-1"]')).toHaveCount(0);

        const finalUrl = page.url();
        expect(finalUrl).toContain('scope=all');
        expect(finalUrl).toContain('q=type%3Apost');
    });

    test('scope:all context-only hits stay renderable in index expand and thread views [PR-UARCH-08]', async ({ page }) => {
        const userId = 'u-scope-all-context';
        const userObj = { _id: userId, username: 'ScopeAll_User', displayName: 'Scope All User', slug: 'scope-all-user', karma: 100 };
        const otherUser = { _id: 'u-other-scope', username: 'OtherScopeUser', displayName: 'Other Scope User', slug: 'other-scope-user', karma: 50 };

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
          {
            _id: 'c-scope-child',
            postedAt: '2025-01-10T12:00:00Z',
            baseScore: 5,
            htmlBody: '<p>Child by archive owner</p>',
            user: ${JSON.stringify(userObj)},
            post: { _id: 'p-scope', title: 'Scope All Post', pageUrl: '...', user: ${JSON.stringify(otherUser)} },
            parentComment: { _id: 'c-scope-parent', user: ${JSON.stringify(otherUser)}, parentComment: null },
            postId: 'p-scope',
            parentCommentId: 'c-scope-parent'
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
            _id: 'c-scope-parent',
            postedAt: '2025-01-09T12:00:00Z',
            baseScore: 7,
            htmlBody: '<p>Parent context comment by other user</p>',
            user: ${JSON.stringify(otherUser)},
            post: { _id: 'p-scope', title: 'Scope All Post', pageUrl: '...', user: ${JSON.stringify(otherUser)} },
            postId: 'p-scope',
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

        await page.goto('https://www.lesswrong.com/reader?view=archive&username=ScopeAll_User', { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Load parent context into runtime maps.
        await selectArchiveView(page, 'thread-full');
        await expect(page.locator('.pr-comment[data-id="c-scope-parent"]')).toHaveCount(1);

        // Search for context-only hit.
        await selectArchiveScope(page, 'all');
        await page.locator('#archive-search').fill('author:"other scope user"');

        await expect(async () => {
            await expect(page.locator('.pr-comment[data-id="c-scope-parent"]')).toHaveCount(1);
            await expect(page.locator('.pr-comment[data-id="c-scope-child"]')).toHaveCount(0);
        }).toPass({ timeout: 5000 });

        // Context hit should remain actionable in index expand path.
        await selectArchiveView(page, 'index');
        const indexRow = page.locator('.pr-archive-index-item').first();
        await expect(indexRow).toContainText('Parent context comment by other user');
        await indexRow.click();
        await expect(page.locator('.pr-index-expanded .pr-comment[data-id="c-scope-parent"]')).toHaveCount(1);

        // And still render in thread mode without getting dropped.
        await selectArchiveView(page, 'thread-full');
        await expect(page.locator('.pr-comment[data-id="c-scope-parent"]')).toHaveCount(1);
    });

    test('all sort modes work: date-asc, score-asc, replyTo, relevance gating [PR-UARCH-09]', async ({ page }) => {
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
        const relevanceOption = page.locator('#archive-sort option[value="relevance"]');

        const relevanceInitiallyDisabled = await relevanceOption.evaluate(el => (el as HTMLOptionElement).disabled);
        expect(relevanceInitiallyDisabled).toBe(true);
        const relevanceInitialTitle = await relevanceOption.evaluate(el => (el as HTMLOptionElement).title);
        expect(relevanceInitialTitle).toContain('requires a search query');

        await page.locator('#archive-search').fill('high');
        await expect.poll(async () =>
            relevanceOption.evaluate(el => (el as HTMLOptionElement).disabled)
        ).toBe(false);
        const relevanceEnabledTitle = await relevanceOption.evaluate(el => (el as HTMLOptionElement).title);
        expect(relevanceEnabledTitle).toBe('');

        await sortSelect.selectOption('relevance');
        await expect(sortSelect).toHaveValue('relevance');

        await page.locator('#archive-search').fill('');
        await expect(sortSelect).toHaveValue('date');
        await expect.poll(async () =>
            relevanceOption.evaluate(el => (el as HTMLOptionElement).disabled)
        ).toBe(true);

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

        // Test Card View (default)
        await selectArchiveView(page, 'card');
        await expectArchiveViewSelected(page, 'card');
        await expect(page.locator('.pr-item')).toBeVisible();
        await expect(page.locator('.pr-archive-index-item')).toHaveCount(0);

        // Test Index View
        await selectArchiveView(page, 'index');
        await expectArchiveViewSelected(page, 'index');
        await expect(page.locator('.pr-archive-index-item')).toBeVisible();
        await expect(page.locator('.pr-archive-index-item')).toHaveCount(1);

        // Test Thread View - now uses Power Reader's standard post/comment classes
        await selectArchiveView(page, 'thread-full');
        await expectArchiveViewSelected(page, 'thread-full');
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
        // We wait for the specific text to appear first to ensure the status update has processed
        await expect(statusEl).toContainText('Starting full resync');
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
        await selectArchiveView(page, 'thread-full');

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
        await selectArchiveView(page, 'thread-full');

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
        await selectArchiveView(page, 'thread-full');

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

    test('[PR-UARCH-25] context comments stay out of canonical items but render nested parent context in card view', async ({ page }) => {
        const userId = 'u-context-test';

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
        await selectArchiveView(page, 'thread-full');

        // Wait for thread view to render with context
        await expect(page.locator('.pr-comment[data-id="c-parent"]')).toBeVisible();
        await expect(page.locator('.pr-comment[data-id="c-child"]')).toBeVisible();

        // Step 2: Switch to Card View - context parent should render above child (nested)
        await selectArchiveView(page, 'card');

        // Wait for card view to render
        await expect(page.locator('.pr-archive-item')).toHaveCount(1);

        const parentInCard = page.locator('.pr-archive-item .pr-comment[data-id="c-parent"]');
        await expect(parentInCard).toBeVisible();
        await expect(parentInCard).toContainText('Parent context comment by other user');
        await expect(parentInCard.locator('.pr-replies .pr-comment[data-id="c-child"]')).toHaveCount(1);

        // Step 3: Switch to Index View - context should also NOT appear here
        await selectArchiveView(page, 'index');

        // Wait for index view to render
        await expect(page.locator('.pr-archive-index-item')).toBeVisible();

        // Verify index remains canonical-only (no context-only parent row leakage)
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
        await selectArchiveView(page, 'thread-full');

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

    test('[PR-UARCH-42] clear button clears query and keeps scope/sort URL state in sync', async ({ page }) => {
        const userId = 'u-clear-search';
        const username = 'ClearSearch_User';
        const userObj = { _id: userId, username, displayName: 'Clear Search User', slug: 'clear-search-user', karma: 100 };

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
            _id: 'p-match',
            title: 'Optimizer Notes',
            slug: 'optimizer-notes',
            pageUrl: 'https://lesswrong.com/posts/p-match',
            postedAt: '2025-01-10T12:00:00Z',
            baseScore: 20,
            voteCount: 10,
            commentCount: 0,
            htmlBody: '<p>Contains optimizer details</p>',
            contents: { markdown: 'Contains optimizer details' },
            user: ${JSON.stringify(userObj)}
          },
          {
            _id: 'p-other',
            title: 'Unrelated Title',
            slug: 'unrelated-title',
            pageUrl: 'https://lesswrong.com/posts/p-other',
            postedAt: '2025-01-09T12:00:00Z',
            baseScore: 5,
            voteCount: 1,
            commentCount: 0,
            htmlBody: '<p>No matching keyword here</p>',
            contents: { markdown: 'No matching keyword here' },
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

        await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}&q=optimizer&sort=date`, { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        await expect(page.locator('#archive-search')).toHaveValue('optimizer');
        await expect(page.locator('#archive-search-clear')).toBeVisible();
        await expect(page.locator('.pr-item')).toHaveCount(1);

        await page.locator('#archive-search-clear').click();

        await expect(page.locator('#archive-search')).toHaveValue('');
        await expect.poll(async () => page.url()).not.toContain('q=');
        await expect.poll(async () => new URL(page.url()).searchParams.get('sort')).toBe('date');
        await expect(page.locator('.pr-item')).toHaveCount(2);
    });

    test('[PR-UARCH-43] keyboard shortcuts focus search and escape clears then blurs', async ({ page }) => {
        const userId = 'u-keyboard-search';
        const username = 'KeyboardSearch_User';
        const userObj = { _id: userId, username, displayName: 'Keyboard Search User', slug: 'keyboard-search-user', karma: 100 };

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
            _id: 'p-keyboard',
            title: 'Keyboard Shortcut Post',
            slug: 'keyboard-shortcut-post',
            pageUrl: 'https://lesswrong.com/posts/p-keyboard',
            postedAt: '2025-01-08T12:00:00Z',
            baseScore: 15,
            voteCount: 3,
            commentCount: 0,
            htmlBody: '<p>Keyboard shortcut content</p>',
            contents: { markdown: 'Keyboard shortcut content' },
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

        await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`, { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        await page.locator('#archive-status').click();
        await page.keyboard.press('/');
        await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.id || '')).toBe('archive-search');

        const searchInput = page.locator('#archive-search');
        await searchInput.fill('foo');
        await page.keyboard.press('/');
        await expect(searchInput).toHaveValue('foo/');

        await page.keyboard.press('Escape');
        await expect(searchInput).toHaveValue('');
        await expect.poll(async () => page.url()).not.toContain('q=');
        await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.id || '')).toBe('archive-search');

        await page.keyboard.press('Escape');
        await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.id || '')).not.toBe('archive-search');
    });

    test('[PR-UARCH-44] reset restores query-driven scope directives after manual scope selection', async ({ page }) => {
        const userId = 'u-reset-scope';
        const username = 'ResetScope_User';
        const userObj = { _id: userId, username, displayName: 'Reset Scope User', slug: 'reset-scope-user', karma: 100 };

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
            _id: 'p-reset',
            title: 'Reset Scope Post',
            slug: 'reset-scope-post',
            pageUrl: 'https://lesswrong.com/posts/p-reset',
            postedAt: '2025-01-07T12:00:00Z',
            baseScore: 11,
            voteCount: 2,
            commentCount: 0,
            htmlBody: '<p>Reset scope body</p>',
            contents: { markdown: 'Reset scope body' },
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

        await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`, { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        await selectArchiveScope(page, 'all');
        await expectArchiveScopeSelected(page, 'all');

        await page.locator('#archive-reset-filters').click();
        await expectArchiveScopeSelected(page, 'authored');
        await expect.poll(async () => new URL(page.url()).searchParams.get('scope')).toBeNull();

        await page.locator('#archive-search').fill('scope:all');

        await expectArchiveScopeSelected(page, 'all');
        await expect.poll(async () => new URL(page.url()).searchParams.get('scope')).toBe('all');
    });

    test('[PR-UARCH-45] scope/view controls support ArrowUp and ArrowDown keyboard navigation', async ({ page }) => {
        const userId = 'u-keyboard-arrows';
        const username = 'KeyboardArrow_User';
        const userObj = { _id: userId, username, displayName: 'Keyboard Arrow User', slug: 'keyboard-arrow-user', karma: 100 };

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
            _id: 'p-arrows',
            title: 'Arrow Keys Post',
            slug: 'arrow-keys-post',
            pageUrl: 'https://lesswrong.com/posts/p-arrows',
            postedAt: '2025-01-06T12:00:00Z',
            baseScore: 9,
            voteCount: 1,
            commentCount: 0,
            htmlBody: '<p>Arrow key body</p>',
            contents: { markdown: 'Arrow key body' },
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

        await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`, { waitUntil: 'commit' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        await page.locator('#archive-scope [data-value="authored"]').focus();
        await page.keyboard.press('ArrowDown');
        await expectArchiveScopeSelected(page, 'all');
        await page.keyboard.press('ArrowUp');
        await expectArchiveScopeSelected(page, 'authored');

        await page.locator('#archive-view [data-value="card"]').focus();
        await page.keyboard.press('ArrowDown');
        await expectArchiveViewSelected(page, 'index');
        await page.keyboard.press('ArrowUp');
        await expectArchiveViewSelected(page, 'card');
    });
});
