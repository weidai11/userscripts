import { test, expect } from '@playwright/test';
import { getScriptContent, setupMockEnvironment } from './helpers/setup';

test.describe('Power Reader Archive Sync', () => {
    let scriptContent: string;

    test.beforeAll(() => {
        scriptContent = getScriptContent();
    });

    test('[PR-UARCH-03][PR-UARCH-06] cached archive remains visible when background sync throws', async ({ page }) => {
        const username = 'SyncFail_User';
        const userId = 'u-sync-fail-user';

        // Create cached post
        const cachedPost = {
            _id: 'cached-post-1',
            title: 'Cached Post Before Sync Failure',
            slug: 'cached-post',
            pageUrl: 'https://lesswrong.com/posts/cached-post-1/cached-post',
            postedAt: '2024-01-15T12:00:00Z',
            baseScore: 25,
            voteCount: 5,
            commentCount: 0,
            htmlBody: '<p>Cached content that should remain visible</p>',
            contents: { markdown: 'Cached content that should remain visible' },
            user: { _id: userId, username, displayName: 'Sync Fail User', slug: 'sync-fail-user', karma: 100 }
        };

        // 1. First Visit - Seed cache with one post
        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    return { data: { user: { _id: '${userId}', username: '${username}', displayName: 'Sync Fail User' } } };
                }
                if (query.includes('GetUserPosts')) {
                    return { data: { posts: { results: [${JSON.stringify(cachedPost)}] } } };
                }
                if (query.includes('GetUserComments')) {
                    return { data: { comments: { results: [] } } };
                }
            `
        });

        await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Verify cached post is displayed
        await expect(page.locator('.pr-item h2')).toHaveText('Cached Post Before Sync Failure');

        // 2. Second Visit - Simulate sync failure by returning no user (fetchUserId returns null)
        // This causes syncArchive to throw since user won't be found
        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    // Return null user to simulate failure
                    return { data: { user: null } };
                }
                if (query.includes('GetUserPosts') || query.includes('GetUserComments')) {
                    return { data: {} };
                }
            `
        });

        await page.reload();
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Cached post should still be visible
        await expect(page.locator('.pr-item h2')).toHaveText('Cached Post Before Sync Failure');
        
        // Status should indicate some kind of error state (sync failure or user not found)
        const statusText = await page.locator('#archive-status').textContent();
        expect(statusText?.toLowerCase()).toMatch(/fail|error|not found/);
    });

    test('sync watermark uses sync-start and does not skip in-flight items [PR-UARCH-05]', async ({ page }) => {
        const username = `WatermarkUser_${Date.now()}`;
        const userId = 'u-watermark';
        const syncStart = '2025-01-01T00:00:00.000Z';
        const syncEnd = '2025-01-03T00:00:00.000Z';
        const oldPostedAt = '2024-12-10T00:00:00.000Z';
        const inFlightPostedAt = '2025-01-02T00:00:00.000Z';

        // Force deterministic no-arg Date() so we can distinguish sync-start watermark from sync-end watermark.
        await page.addInitScript((startIso: string) => {
            const RealDate = Date;
            (window as any).__FAKE_NOW__ = startIso;
            class FakeDate extends RealDate {
                constructor(...args: any[]) {
                    if (args.length === 0) {
                        super((window as any).__FAKE_NOW__);
                    } else {
                        super(...args);
                    }
                }
                static now() {
                    return new RealDate((window as any).__FAKE_NOW__).getTime();
                }
            }
            (FakeDate as any).parse = RealDate.parse;
            (FakeDate as any).UTC = RealDate.UTC;
            (window as any).__REAL_DATE__ = RealDate;
            (window as any).Date = FakeDate;
        }, syncStart);

        // First visit seeds cache with old item and flips clock forward during sync.
        // If watermark were taken at sync END, it would become syncEnd and skip in-flight item next run.
        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    return { data: { user: { _id: '${userId}', username: '${username}', displayName: 'Watermark Test' } } };
                }
                if (query.includes('GetUserPosts')) {
                    // Advance fake clock after sync started, before saveArchiveData runs.
                    window.__FAKE_NOW__ = '${syncEnd}';
                    return {
                        data: {
                            posts: {
                                results: [{
                                    _id: 'post-old',
                                    title: 'Old Cached Post',
                                    slug: 'old-cached-post',
                                    pageUrl: 'https://lesswrong.com/posts/post-old',
                                    postedAt: '${oldPostedAt}',
                                    baseScore: 10,
                                    voteCount: 5,
                                    commentCount: 0,
                                    htmlBody: '<p>Old</p>',
                                    contents: { markdown: 'Old' },
                                    user: { _id: '${userId}', username: '${username}' }
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

        await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
        await expect(page.locator('.pr-item h2')).toHaveText('Old Cached Post');

        // Second visit includes one in-flight item between syncStart and syncEnd.
        // Correct sync-start watermark should include this item; sync-end watermark would skip it.
        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    return { data: { user: { _id: '${userId}', username: '${username}', displayName: 'Watermark Test' } } };
                }
                if (query.includes('GetUserPosts')) {
                    return {
                        data: {
                            posts: {
                                results: [
                                    {
                                        _id: 'post-in-flight',
                                        title: 'In-Flight Post',
                                        slug: 'in-flight-post',
                                        pageUrl: 'https://lesswrong.com/posts/post-in-flight',
                                        postedAt: '${inFlightPostedAt}',
                                        baseScore: 20,
                                        voteCount: 5,
                                        commentCount: 0,
                                        htmlBody: '<p>In Flight</p>',
                                        contents: { markdown: 'In Flight' },
                                        user: { _id: '${userId}', username: '${username}' }
                                    },
                                    {
                                        _id: 'post-old',
                                        title: 'Old Cached Post',
                                        slug: 'old-cached-post',
                                        pageUrl: 'https://lesswrong.com/posts/post-old',
                                        postedAt: '${oldPostedAt}',
                                        baseScore: 10,
                                        voteCount: 5,
                                        commentCount: 0,
                                        htmlBody: '<p>Old</p>',
                                        contents: { markdown: 'Old' },
                                        user: { _id: '${userId}', username: '${username}' }
                                    }
                                ]
                            }
                        }
                    };
                }
                if (query.includes('GetUserComments')) {
                    return { data: { comments: { results: [] } } };
                }
            `
        });

        await page.reload();
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        await expect(async () => {
            const titles = await page.locator('.pr-item h2').allTextContents();
            expect(titles).toContain('Old Cached Post');
            expect(titles).toContain('In-Flight Post');
            expect(new Set(titles).size).toBe(2);
        }).toPass({ timeout: 10000 });
    });

test('[PR-UARCH-22] canonical state sync preserves fetched context across rerenders', async ({ page }) => {
  const username = 'canonical-sync-test';
  const userId = 'u-canonical-sync';
  const userObj = { _id: userId, username, displayName: 'Canonical Sync Test', slug: 'canonical-sync-test', karma: 100 };
  const otherUser = { _id: 'u-other', username: 'OtherUser', displayName: 'Other User', karma: 50 };

  await setupMockEnvironment(page, {
    mockHtml: '<html><body><div id="app"></div></body></html>',
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
            _id: 'c-child',
            postedAt: '2025-01-10T12:00:00Z',
            baseScore: 5,
            htmlBody: '<p>Child comment</p>',
            user: ${JSON.stringify(userObj)},
            post: { _id: 'p1', title: 'Test Post', pageUrl: '...', user: ${JSON.stringify(otherUser)} },
            parentComment: {
              _id: 'c-parent',
              user: ${JSON.stringify(otherUser)},
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
  // Return parent when fetching context
  return {
    data: {
      comments: {
        results: [
          {
            _id: 'c-parent',
            postedAt: '2025-01-09T12:00:00Z',
            htmlBody: '<p>Parent comment body</p>',
            user: ${JSON.stringify(otherUser)},
            postId: 'p1',
            parentComment: null
          }
        ]
      }
    }
  };
}
`
  });

  await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`);
  await page.evaluate(scriptContent);
  await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

  // Switch to Thread View (triggers context fetch)
  await page.locator('#archive-view').selectOption('thread-full');

  // Wait for thread view to render with parent context
  await expect(page.locator('.pr-comment[data-id="c-parent"]')).toBeVisible();
  await expect(page.locator('.pr-comment[data-id="c-child"]')).toBeVisible();

  // Trigger a rerender by changing sort mode
  await page.locator('#archive-sort').selectOption('score');

  // Wait for rerender
  await page.waitForTimeout(100);

  // [WS1-FIX] Verify both comments are still visible after rerender
  // This tests that canonical state sync preserves fetched context
  const parentAfterRerender = page.locator('.pr-comment[data-id="c-parent"]');
  const childAfterRerender = page.locator('.pr-comment[data-id="c-child"]');

  await expect(parentAfterRerender).toBeVisible();
  await expect(childAfterRerender).toBeVisible();
  await expect(parentAfterRerender).toContainText('Parent comment body');
  await expect(childAfterRerender).toContainText('Child comment');

  // Verify event handlers still work by clicking [t] button on child
  const tButton = childAfterRerender.locator('[data-action="load-parents-and-scroll"]');
  await expect(tButton).toBeVisible();
  await tButton.click();

  // If we get here without errors, the canonical state sync is working
  // and ReaderState identity is preserved
});

test('[PR-UARCH-03][PR-UARCH-04][PR-UARCH-07] incremental sync fetches new items', async ({ page }) => {
  const username = 'Test_User';
  const userId = 'u-test-user';

  // Setup initial mock: 1 older post
  const initialPost = {
    _id: 'p1',
    title: 'Old Post',
    slug: 'old-post',
    pageUrl: 'https://lesswrong.com/posts/p1/old-post',
    postedAt: new Date('2023-01-01').toISOString(),
    baseScore: 10,
    voteCount: 5,
    commentCount: 0,
    htmlBody: '<p>Old Body</p>',
    contents: { markdown: 'Old Body' },
    user: { _id: userId, username, displayName: 'Test User', slug: 'test-user', karma: 100 }
  };

  const newPost = {
    _id: 'p2',
    title: 'New Post',
    slug: 'new-post',
    pageUrl: 'https://lesswrong.com/posts/p2/new-post',
    postedAt: new Date('3000-01-01').toISOString(), // Future date to ensure it's > lastSyncDate
    baseScore: 20,
    voteCount: 10,
    commentCount: 0,
    htmlBody: '<p>New Body</p>',
    contents: { markdown: 'New Body' },
    user: { _id: userId, username, displayName: 'Test User', slug: 'test-user', karma: 100 }
  };

        // 1. First Visit
        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    return { data: { user: { _id: '${userId}', username: '${username}' } } };
                }
                if (query.includes('GetUserPosts')) {
                    // Return only old post initially
                    return { data: { posts: { results: [${JSON.stringify(initialPost)}] } } };
                }
                if (query.includes('GetUserComments')) {
                    return { data: { comments: { results: [] } } };
                }
            `
        });

        await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Verify Old Post is there
        await expect(page.locator('.pr-item h2')).toHaveText('Old Post');
        
        // Verify Status says "Sync complete"
        await expect(page.locator('#archive-status')).toContainText('Sync complete');

        // 2. Second Visit (Reload)
        // We update the mock to return BOTH posts, simulating the API state having changed (or just returning everything)
        // But importantly, the client should validly handle this.
        // Wait, for strict incremental test, we should verify the network request uses minDate logic? 
        // We can't easily spy on network request arguments inside 'onGraphQL' string without console logs or complex setup.
        // But we can check if the UI updates.

        // Update mock to return NEW post as well.
        // IMPORTANT: The loader will fetch ALL posts if we don't implement minDate properly on server side, 
        // but since we are mocking the server response, we can simulate the server returning new posts.
        // If we want to test that the CLIENT filters, we can return both and see if it duplicates?
        // No, we want to test that it fetches and merges.

        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    return { data: { user: { _id: '${userId}', username: '${username}' } } };
                }
                if (query.includes('GetUserPosts')) {
                    // Return both posts (Newest first is standard API behavior)
                    return { data: { posts: { results: [${JSON.stringify(newPost)}, ${JSON.stringify(initialPost)}] } } };
                }
                if (query.includes('GetUserComments')) {
                    return { data: { comments: { results: [] } } };
                }
            `
        });

        // We reload the page. IndexedDB should persist in the same Playwright context.
        await page.reload();
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // It should load cache first (Old Post), then sync and find New Post.
        // We expect eventually both to be visible.
        await expect(page.locator('.pr-item')).toHaveCount(2);
        await expect(page.locator('.pr-item h2').first()).toHaveText('New Post');
        await expect(page.locator('#archive-status')).toContainText('Sync complete');
    });
});
