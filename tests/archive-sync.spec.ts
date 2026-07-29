import { test, expect } from '@playwright/test';
import { getScriptContent, setupMockEnvironment } from './helpers/setup';
import { selectArchiveView, waitForArchiveRenderComplete } from './helpers/archiveControls';

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

        await page.goto(`https://www.lesswrong.com/archive?username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
    await waitForArchiveRenderComplete(page);

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
    await waitForArchiveRenderComplete(page);

        // Cached post should still be visible
        await expect(page.locator('.pr-item h2')).toHaveText('Cached Post Before Sync Failure');
        
        // Status should indicate some kind of error state (sync failure or user not found)
        const statusText = await page.locator('#archive-status').textContent();
        expect(statusText?.toLowerCase()).toMatch(/fail|error|not found/);
    });

    test('[PR-UARCH-48][PR-UARCH-03][PR-UARCH-04] empty-cache boot defers first render until sync completes', async ({ page }) => {
        const username = `EmptyCacheDeferredRender_${Date.now()}`;
        const userId = 'u-empty-cache-deferred-render';
        const delayedPost = {
            _id: 'p-delayed-first',
            title: 'Delayed First Post',
            slug: 'delayed-first-post',
            pageUrl: 'https://lesswrong.com/posts/p-delayed-first/delayed-first-post',
            postedAt: '2025-01-02T00:00:00.000Z',
            baseScore: 10,
            voteCount: 2,
            commentCount: 0,
            htmlBody: '<p>Delayed first post body</p>',
            contents: { markdown: 'Delayed first post body' },
            user: { _id: userId, username, displayName: 'Deferred Render User', slug: 'deferred-render-user', karma: 50 }
        };

        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    return { data: { user: { _id: '${userId}', username: '${username}', displayName: 'Deferred Render User' } } };
                }
                if (query.includes('GetUserComments')) {
                    return { data: { comments: { results: [] } } };
                }
                if (query.includes('GetUserPosts')) {
                    // Return data only at offset 0 so the scan ends with an
                    // empty batch (no artificial offset clamp).
                    if ((variables.offset || 0) === 0) {
                        return new Promise((resolve) => {
                            setTimeout(() => resolve({ data: { posts: { results: [${JSON.stringify(delayedPost)}] } } }), 6500);
                        });
                    }
                    return { data: { posts: { results: [] } } };
                }
            `
        });

        await page.goto(`https://www.lesswrong.com/archive?username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Default idle-render timeout is 5s. Keep fetch pending longer and verify we
        // still do not render while local cache was empty at startup.
        await page.waitForTimeout(5600);
        await expect(page.locator('#archive-dashboard')).toBeVisible();
        await expect(page.locator('#archive-feed .pr-item')).toHaveCount(0);

        await waitForArchiveRenderComplete(page);
        await expect(page.locator('.pr-item h2')).toHaveText('Delayed First Post');
        await expect(page.locator('#archive-status')).toContainText('Sync complete.');
        await expect(page.locator('#archive-status')).not.toContainText('Please refresh page to view latest content.');
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
                    if ((variables.offset || 0) !== 0) {
                        return { data: { posts: { results: [] } } };
                    }
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

        await page.goto(`https://www.lesswrong.com/archive?username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
    await waitForArchiveRenderComplete(page);
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
                    if ((variables.offset || 0) !== 0) {
                        return { data: { posts: { results: [] } } };
                    }
                    return {
                        data: {
                            posts: {
                                results: [
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
                                    },
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
    await waitForArchiveRenderComplete(page);

        await expect(async () => {
            const titles = await page.locator('.pr-item h2').allTextContents();
            expect(titles).toContain('Old Cached Post');
            expect(titles).toContain('In-Flight Post');
            expect(new Set(titles).size).toBe(2);
        }).toPass({ timeout: 10000 });
    });

    test('failed mid-comments scan restores the pre-sync comments watermark [PR-UARCH-15]', async ({ page }) => {
        const username = `CommentsRestore_${Date.now()}`;
        const userId = 'u-comments-restore';
        const userObj = { _id: userId, username, displayName: 'Comments Restore', slug: 'comments-restore', karma: 100 };
        const preSync = '2024-01-01T00:00:00.000Z';
        const cachedPost = {
            _id: 'p-comments-restore',
            title: 'Cached Post',
            slug: 'cached-post',
            pageUrl: 'https://lesswrong.com/posts/p-comments-restore/cached-post',
            postedAt: '2020-01-01T00:00:00.000Z',
            modifiedAt: preSync,
            baseScore: 10,
            voteCount: 3,
            commentCount: 0,
            htmlBody: '<p>Cached</p>',
            contents: { markdown: 'Cached' },
            user: userObj,
            username
        };

        // 100 comments with distinct lastEditedAt so the scan advances to a
        // second request (whose failure kills the sync) without boundary
        // expansion or a same-timestamp tail.
        const comments = [];
        for (let i = 0; i < 100; i++) {
            comments.push({
                _id: 'c-restore-' + i,
                postId: 'p-comments-restore',
                postedAt: new Date(Date.UTC(2023, 0, 1, 0, 0, i)).toISOString(),
                lastEditedAt: new Date(Date.UTC(2024, 5, 1, 0, 0, i)).toISOString(),
                user: userObj
            });
        }

        // Seed IndexedDB with watermarks and one cached item before the script runs.
        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onInit: `window.__COMMENT_REQS__ = 0;`,
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
}
if (query.includes('GetUserComments')) {
  window.__COMMENT_REQS__++;
  if (window.__COMMENT_REQS__ === 1) {
    // First batch succeeds and advances the comments watermark via its
    // per-batch save; the second request fails mid-scan.
    return { data: { comments: { results: ${JSON.stringify(comments)} } } };
  }
  return { errors: [{ message: 'Server boom' }], data: {} };
}
if (query.includes('GetUserPosts')) {
  return { data: { posts: { results: [] } } };
}
return { data: {} };
`
        });

        await page.goto(`https://www.lesswrong.com/archive?username=${username}`, { waitUntil: 'commit' });
        await page.evaluate(async ({ username, cachedPost, preSync }) => {
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open('PowerReaderArchive', 2);
                request.onupgradeneeded = (event) => {
                    const database = (event.target as IDBOpenDBRequest).result;
                    if (!database.objectStoreNames.contains('items')) {
                        const itemStore = database.createObjectStore('items', { keyPath: '_id' });
                        itemStore.createIndex('username', 'username', { unique: false });
                        itemStore.createIndex('postedAt', 'postedAt', { unique: false });
                        itemStore.createIndex('userId', 'userId', { unique: false });
                    }
                    if (!database.objectStoreNames.contains('metadata')) {
                        database.createObjectStore('metadata', { keyPath: 'username' });
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            const tx = db.transaction(['items', 'metadata'], 'readwrite');
            tx.objectStore('items').put(cachedPost);
            tx.objectStore('metadata').put({
                username,
                lastSyncDate: preSync,
                lastSyncDate_comments: preSync,
                lastSyncDate_posts: preSync
            });
            await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
        }, { username, cachedPost, preSync });

        const readMetadata = async () => page.evaluate(async ({ username }) => {
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open('PowerReaderArchive', 2);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            const tx = db.transaction('metadata', 'readonly');
            const req = tx.objectStore('metadata').get(username);
            return await new Promise<any>((resolve, reject) => {
                req.onsuccess = () => resolve(req.result ?? null);
                req.onerror = () => reject(req.error);
            });
        }, { username });

        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
        await waitForArchiveRenderComplete(page);

        // Cached post stays visible and the sync surfaces the failure.
        await expect(page.locator('.pr-item h2')).toHaveText('Cached Post');
        await expect(page.locator('#archive-status')).toHaveClass(/status-error/);

        // The comments watermark must be restored to the pre-sync value so the
        // next sync re-scans from it instead of skipping the un-fetched tail;
        // the posts watermark must be untouched by an incremental failure.
        await expect.poll(readMetadata).toEqual(
            expect.objectContaining({
                lastSyncDate: preSync,
                lastSyncDate_comments: preSync,
                lastSyncDate_posts: preSync
            })
        );
    });

    test('truncated posts scan preserves the posts watermark while advancing the comments watermark [PR-UARCH-15]', async ({ page }) => {
        const username = `PostsTruncateWatermark_${Date.now()}`;
        const userId = 'u-posts-truncate-watermark';
        const userObj = { _id: userId, username, displayName: 'Posts Truncate Watermark', slug: 'posts-truncate-watermark', karma: 100 };
        const preSync = '2024-01-01T00:00:00.000Z';
        const cachedPost = {
            _id: 'p-truncate-seed',
            title: 'Seeded Post',
            slug: 'seeded-post',
            pageUrl: 'https://lesswrong.com/posts/p-truncate-seed/seeded-post',
            postedAt: '2020-01-01T00:00:00.000Z',
            modifiedAt: preSync,
            baseScore: 10,
            voteCount: 3,
            commentCount: 0,
            htmlBody: '<p>Seeded</p>',
            contents: { markdown: 'Seeded' },
            user: userObj,
            username
        };

        // Two full 100-item pages of DISTINCT posts newer than the watermark,
        // then the API skip-limit rejection: the scan must stop gracefully as
        // truncated (200 posts merged, posts watermark preserved).
        const makePosts = (offsetBase: number) => {
            const posts = [];
            for (let i = 0; i < 100; i++) {
                const id = 'p-truncate-' + offsetBase + '-' + i;
                posts.push({
                    _id: id,
                    title: 'Truncate Post ' + offsetBase + '-' + i,
                    slug: 'truncate-post-' + offsetBase + '-' + i,
                    pageUrl: `https://lesswrong.com/posts/${id}/truncate-post-${offsetBase}-${i}`,
                    postedAt: new Date(Date.UTC(2024, 5, 1, 0, 0, i)).toISOString(),
                    modifiedAt: new Date(Date.UTC(2024, 5, 1, 0, 0, i)).toISOString(),
                    baseScore: 10,
                    voteCount: 3,
                    commentCount: 0,
                    htmlBody: '<p>Truncate</p>',
                    contents: { markdown: 'Truncate' },
                    user: userObj
                });
            }
            return posts;
        };

        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
}
if (query.includes('GetUserPosts')) {
  const start = variables.offset || 0;
  if (start >= 200) {
    return { errors: [{ message: 'Exceeded maximum value for skip' }], data: {} };
  }
  const page0 = ${JSON.stringify(makePosts(0))};
  const page1 = ${JSON.stringify(makePosts(100))};
  return { data: { posts: { results: start === 0 ? page0 : page1 } } };
}
if (query.includes('GetUserComments')) {
  return { data: { comments: { results: [] } } };
}
return { data: {} };
`
        });

        await page.goto(`https://www.lesswrong.com/archive?username=${username}`, { waitUntil: 'commit' });
        await page.evaluate(async ({ username, cachedPost, preSync }) => {
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open('PowerReaderArchive', 2);
                request.onupgradeneeded = (event) => {
                    const database = (event.target as IDBOpenDBRequest).result;
                    if (!database.objectStoreNames.contains('items')) {
                        const itemStore = database.createObjectStore('items', { keyPath: '_id' });
                        itemStore.createIndex('username', 'username', { unique: false });
                        itemStore.createIndex('postedAt', 'postedAt', { unique: false });
                        itemStore.createIndex('userId', 'userId', { unique: false });
                    }
                    if (!database.objectStoreNames.contains('metadata')) {
                        database.createObjectStore('metadata', { keyPath: 'username' });
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            const tx = db.transaction(['items', 'metadata'], 'readwrite');
            tx.objectStore('items').put(cachedPost);
            tx.objectStore('metadata').put({
                username,
                lastSyncDate: preSync,
                lastSyncDate_comments: preSync,
                lastSyncDate_posts: preSync
            });
            await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
        }, { username, cachedPost, preSync });

        const readMetadata = async () => page.evaluate(async ({ username }) => {
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open('PowerReaderArchive', 2);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            const tx = db.transaction('metadata', 'readonly');
            const req = tx.objectStore('metadata').get(username);
            return await new Promise<any>((resolve, reject) => {
                req.onsuccess = () => resolve(req.result ?? null);
                req.onerror = () => reject(req.error);
            });
        }, { username });

        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
        await waitForArchiveRenderComplete(page);

        // The truncation is surfaced, not fatal, and the final save has run.
        // Normally the terminal status is "Sync complete" with the note; if
        // the sync ever outlasts the network-idle render window, the initial
        // snapshot renders mid-sync and the terminal status becomes the
        // refresh-required variant — both preserve the truncation note.
        await expect(page.locator('#archive-status')).toContainText('truncated at API offset limit');
        await expect(page.locator('#archive-status')).toContainText(/Sync complete|Please refresh page to view latest content/);
        await expect(page.locator('#archive-status')).not.toHaveClass(/status-error/);

        // The posts watermark stays at the pre-sync value so the next sync
        // retries the full scan; the completed comments scan and the combined
        // watermark advance to the sync start time. Polled so a slow CI that
        // outlasts the network-idle render window still waits for the final
        // save instead of reading pre-save metadata. The posts check alone
        // would be trivially true from the seed; requiring the comments
        // watermark to have advanced proves the final save actually ran.
        await expect.poll(async () => {
            const meta = await readMetadata();
            return Boolean(
                meta
                && meta.lastSyncDate_posts === preSync
                && meta.lastSyncDate_comments !== preSync
                && meta.lastSyncDate !== preSync
            );
        }).toBe(true);
    });

    test('[PR-UARCH-04][PR-UARCH-07][PR-UARCH-15] archive sync uses edit-time fields and upserts edited same-id items', async ({ page }) => {
        const username = `EditAwareSync_${Date.now()}`;
        const userId = 'u-edit-aware-sync';
        const userObj = { _id: userId, username, displayName: 'Edit Aware Sync', slug: 'edit-aware-sync', karma: 100 };

        const initialPost = {
            _id: 'p-edit-aware',
            title: 'Original Sync Post',
            slug: 'original-sync-post',
            pageUrl: 'https://lesswrong.com/posts/p-edit-aware/original-sync-post',
            postedAt: '2020-01-01T00:00:00.000Z',
            modifiedAt: '2025-01-01T00:00:00.000Z',
            baseScore: 10,
            voteCount: 3,
            commentCount: 1,
            htmlBody: '<p>Original post body</p>',
            contents: { markdown: 'Original post body' },
            user: userObj
        };
        const editedPost = {
            ...initialPost,
            title: 'Edited Sync Post',
            modifiedAt: '3000-01-01T00:00:00.000Z',
            htmlBody: '<p>Edited post body</p>',
            contents: { markdown: 'Edited post body' }
        };

        const initialComment = {
            _id: 'c-edit-aware',
            postedAt: '2020-02-01T00:00:00.000Z',
            lastEditedAt: '2025-01-01T00:00:00.000Z',
            baseScore: 5,
            voteCount: 2,
            htmlBody: '<p>Original comment body</p>',
            author: username,
            rejected: false,
            topLevelCommentId: 'c-edit-aware',
            postId: initialPost._id,
            parentCommentId: null,
            parentComment: null,
            user: userObj,
            post: {
                _id: initialPost._id,
                title: initialPost.title,
                slug: initialPost.slug,
                pageUrl: initialPost.pageUrl,
                postedAt: initialPost.postedAt,
                modifiedAt: initialPost.modifiedAt,
                baseScore: initialPost.baseScore,
                voteCount: initialPost.voteCount,
                user: userObj
            },
            pageUrl: `${initialPost.pageUrl}#${'c-edit-aware'}`,
            contents: { markdown: 'Original comment body' }
        };
        const editedComment = {
            ...initialComment,
            lastEditedAt: '3000-01-02T00:00:00.000Z',
            htmlBody: '<p>Edited comment body</p>',
            contents: { markdown: 'Edited comment body' },
            post: {
                ...initialComment.post,
                title: editedPost.title,
                modifiedAt: editedPost.modifiedAt
            }
        };

        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
}
if (query.includes('GetUserComments')) {
  window.__COMMENT_BATCH_COUNT__ = (window.__COMMENT_BATCH_COUNT__ || 0) + 1;
  if (!variables.after) {
    return { data: { comments: { results: [${JSON.stringify(initialComment)}] } } };
  }
  return { data: { comments: { results: [] } } };
}
if (query.includes('GetUserPosts')) {
  window.__POST_BATCH_COUNT__ = (window.__POST_BATCH_COUNT__ || 0) + 1;
  if ((variables.offset || 0) === 0) {
    return { data: { posts: { results: [${JSON.stringify(initialPost)}] } } };
  }
  return { data: { posts: { results: [] } } };
}
return { data: {} };
`
        });

        await page.goto(`https://www.lesswrong.com/archive?username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
        await waitForArchiveRenderComplete(page);
        await expect(page.locator('#archive-feed')).toContainText('Original Sync Post');
        await expect(page.locator('#archive-feed')).toContainText('Original comment body');

        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
}
if (query.includes('GetUserComments')) {
  window.__SEEN_COMMENT_TIMEFIELD__ = query.includes('timeField: "lastEditedAt"');
  window.__COMMENT_AFTER_VALUES__ = window.__COMMENT_AFTER_VALUES__ || [];
  window.__COMMENT_AFTER_VALUES__.push(variables.after ?? null);
  window.__COMMENT_BATCH_COUNT__ = (window.__COMMENT_BATCH_COUNT__ || 0) + 1;
  if (window.__COMMENT_BATCH_COUNT__ === 1) {
    return { data: { comments: { results: [${JSON.stringify(editedComment)}] } } };
  }
  return { data: { comments: { results: [] } } };
}
if (query.includes('GetUserPosts')) {
  window.__POST_OFFSET_VALUES__ = window.__POST_OFFSET_VALUES__ || [];
  window.__POST_OFFSET_VALUES__.push(variables.offset ?? null);
  window.__POST_BATCH_COUNT__ = (window.__POST_BATCH_COUNT__ || 0) + 1;
  if (query.includes('GetUserPostsIncremental')) {
    window.__POST_INCREMENTAL_SEEN__ = true;
    window.__POST_INCREMENTAL_AFTER__ = variables.after ?? null;
    window.__POST_TIMEFIELD_SEEN__ = query.includes('timeField: "modifiedAt"');
  }
  if (window.__POST_BATCH_COUNT__ === 1) {
    return { data: { posts: { results: [${JSON.stringify(editedPost)}] } } };
  }
  return { data: { posts: { results: [] } } };
}
return { data: {} };
`
        });

        await page.reload();
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
        await waitForArchiveRenderComplete(page);

        await expect(page.locator('#archive-feed')).toContainText('Edited Sync Post');
        await expect(page.locator('#archive-feed')).toContainText('Edited comment body');

        const selectorChecks = await page.evaluate(() => ({
            commentTimeField: (window as any).__SEEN_COMMENT_TIMEFIELD__ === true,
            postOffsets: (window as any).__POST_OFFSET_VALUES__ || [],
            postIncrementalSeen: (window as any).__POST_INCREMENTAL_SEEN__ === true,
            postIncrementalAfter: (window as any).__POST_INCREMENTAL_AFTER__ ?? null,
            postTimeField: (window as any).__POST_TIMEFIELD_SEEN__ === true,
            commentAfterValues: (window as any).__COMMENT_AFTER_VALUES__ || []
        }));
        expect(selectorChecks.commentTimeField).toBe(true);
        expect(selectorChecks.postOffsets.length).toBeGreaterThanOrEqual(1);
        expect(selectorChecks.postOffsets[0]).toBe(0);
        expect(selectorChecks.postIncrementalSeen).toBe(true);
        expect(selectorChecks.postTimeField).toBe(true);
        expect(typeof selectorChecks.postIncrementalAfter).toBe('string');
        expect((selectorChecks.postIncrementalAfter as string).length).toBeGreaterThan(0);
        expect(selectorChecks.commentAfterValues.length).toBeGreaterThan(0);
        expect(selectorChecks.commentAfterValues.every((v: unknown) => typeof v === 'string' && v.length > 0)).toBe(true);
    });

    test('posts sync falls back to full offset scan when server rejects timeField [PR-UARCH-15]', async ({ page }) => {
        const username = `TimeFieldFallback_${Date.now()}`;
        const userId = 'u-timefield-fallback';
        const userObj = { _id: userId, username, displayName: 'TimeField Fallback', slug: 'timefield-fallback', karma: 100 };

        const initialPost = {
            _id: 'p-tf-fallback',
            title: 'Original Fallback Post',
            slug: 'original-fallback-post',
            pageUrl: 'https://lesswrong.com/posts/p-tf-fallback/original-fallback-post',
            postedAt: '2020-01-01T00:00:00.000Z',
            modifiedAt: '2025-01-01T00:00:00.000Z',
            baseScore: 10,
            voteCount: 3,
            commentCount: 0,
            htmlBody: '<p>Original body</p>',
            contents: { markdown: 'Original body' },
            user: userObj
        };
        const editedPost = {
            ...initialPost,
            title: 'Edited Fallback Post',
            modifiedAt: '3000-01-01T00:00:00.000Z',
            htmlBody: '<p>Edited body</p>',
            contents: { markdown: 'Edited body' }
        };
        const stalePost = {
            ...initialPost,
            _id: 'p-tf-stale',
            title: 'Stale Fallback Post',
            postedAt: '2026-06-01T00:00:00.000Z',
            modifiedAt: '2024-01-01T00:00:00.000Z',
            htmlBody: '<p>Stale body</p>',
            contents: { markdown: 'Stale body' }
        };

        // First visit: full sync (no watermark yet) seeds the cache.
        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
}
if (query.includes('GetUserPosts')) {
  if ((variables.offset || 0) !== 0) {
    return { data: { posts: { results: [] } } };
  }
  return { data: { posts: { results: [${JSON.stringify(initialPost)}] } } };
}
if (query.includes('GetUserComments')) {
  return { data: { comments: { results: [] } } };
}
return { data: {} };
`
        });

        await page.goto(`https://www.lesswrong.com/archive?username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
        await waitForArchiveRenderComplete(page);
        await expect(page.locator('#archive-feed')).toContainText('Original Fallback Post');

        // Second visit: the incremental query (timeField filter) is rejected;
        // the loader must fall back to the full offset scan with client-side
        // cutoff. The full scan must run to exhaustion: page 0 is entirely
        // below-watermark junk (zero new items must NOT stop the scan), the
        // edited post sits on page 1, and the stale post (modifiedAt below the
        // watermark) must be excluded by the client-side cutoff.
        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
}
if (query.includes('GetUserPostsIncremental')) {
  window.__POST_TIMEFIELD_REJECTED__ = true;
  return { errors: [{ message: 'Unknown argument "timeField" on type "PostsUserPostsInput"' }], data: {} };
}
if (query.includes('GetUserPosts')) {
  window.__POST_FULL_SCAN__ = true;
  window.__POST_FULL_SCAN_FETCHES__ = (window.__POST_FULL_SCAN_FETCHES__ || 0) + 1;
  window.__POST_FULL_SCAN_AFTER__ = variables.after ?? null;
  const start = variables.offset || 0;
  if (start === 0) {
    const junk = [];
    for (let i = 0; i < 100; i++) {
      junk.push({
        _id: 'p-junk-' + i,
        title: 'Junk Post ' + i,
        postedAt: new Date(Date.UTC(2020, 0, 1, 0, 0, i)).toISOString(),
        modifiedAt: '2024-01-01T00:00:00.000Z',
        user: ${JSON.stringify(userObj)}
      });
    }
    return { data: { posts: { results: junk } } };
  }
  if (start === 100) {
    return { data: { posts: { results: [${JSON.stringify(editedPost)}, ${JSON.stringify(stalePost)}] } } };
  }
  return { data: { posts: { results: [] } } };
}
if (query.includes('GetUserComments')) {
  return { data: { comments: { results: [] } } };
}
return { data: {} };
`
        });

        await page.reload();
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
        await waitForArchiveRenderComplete(page);

        await expect(page.locator('#archive-feed')).toContainText('Edited Fallback Post');
        await expect(page.locator('#archive-feed')).not.toContainText('Stale Fallback Post');
        await expect(page.locator('#archive-feed')).not.toContainText('Junk Post');
        await expect(page.locator('#archive-status')).not.toHaveClass(/status-error/);

        const flags = await page.evaluate(() => ({
            rejected: (window as any).__POST_TIMEFIELD_REJECTED__ === true,
            fullScan: (window as any).__POST_FULL_SCAN__ === true,
            fullScanFetches: (window as any).__POST_FULL_SCAN_FETCHES__ || 0,
            fullScanAfter: (window as any).__POST_FULL_SCAN_AFTER__ ?? null
        }));
        expect(flags.rejected).toBe(true);
        expect(flags.fullScan).toBe(true);
        expect(flags.fullScanFetches).toBe(3);
        expect(flags.fullScanAfter).toBeNull();
    });

    test('posts sync falls back to full offset scan when the server rejects the incremental combo mid-scan [PR-UARCH-15]', async ({ page }) => {
        const username = `ComboRejectMidScan_${Date.now()}`;
        const userId = 'u-combo-reject';
        const userObj = { _id: userId, username, displayName: 'Combo Reject', slug: 'combo-reject', karma: 100 };
        const initialPost = {
            _id: 'p-combo-seed',
            title: 'Seeded Combo Post',
            slug: 'seeded-combo-post',
            pageUrl: 'https://lesswrong.com/posts/p-combo-seed/seeded-combo-post',
            postedAt: '2020-01-01T00:00:00.000Z',
            modifiedAt: '2024-01-01T00:00:00.000Z',
            baseScore: 10,
            voteCount: 3,
            commentCount: 0,
            htmlBody: '<p>Seeded body</p>',
            contents: { markdown: 'Seeded body' },
            user: userObj
        };
        const editedPost = {
            ...initialPost,
            title: 'Edited Combo Post',
            modifiedAt: '3000-01-01T00:00:00.000Z',
            htmlBody: '<p>Edited body</p>',
            contents: { markdown: 'Edited body' }
        };

        // First visit: full sync (no watermark) seeds the cache.
        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
}
if (query.includes('GetUserPosts')) {
  if ((variables.offset || 0) !== 0) {
    return { data: { posts: { results: [] } } };
  }
  return { data: { posts: { results: [${JSON.stringify(initialPost)}] } } };
}
if (query.includes('GetUserComments')) {
  return { data: { comments: { results: [] } } };
}
return { data: {} };
`
        });

        await page.goto(`https://www.lesswrong.com/archive?username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
        await waitForArchiveRenderComplete(page);
        await expect(page.locator('#archive-feed')).toContainText('Seeded Combo Post');

        // Second visit: the incremental query works on page 0 (full batch of
        // below-watermark junk, so the scan continues) but rejects the
        // after+offset combination on page 1 with a validation-shaped error.
        // The loader must fall back to the full offset scan with client-side
        // cutoff and still surface the edited post from the fallback scan.
        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
}
if (query.includes('GetUserPostsIncremental')) {
  if ((variables.offset || 0) !== 0) {
    window.__POST_COMBO_REJECTED__ = (window.__POST_COMBO_REJECTED__ || 0) + 1;
    return { errors: [{ message: 'Invalid combination: after and offset cannot be used together' }], data: {} };
  }
  const junk = [];
  for (let i = 0; i < 100; i++) {
    junk.push({
      _id: 'p-junk-combo-' + i,
      title: 'Junk Combo Post ' + i,
      postedAt: new Date(Date.UTC(2020, 0, 1, 0, 0, i)).toISOString(),
      modifiedAt: '2024-01-01T00:00:00.000Z',
      user: ${JSON.stringify(userObj)}
    });
  }
  return { data: { posts: { results: junk } } };
}
if (query.includes('GetUserPosts')) {
  window.__POST_COMBO_FULL_SCAN__ = true;
  const start = variables.offset || 0;
  if (start === 0) {
    return { data: { posts: { results: [${JSON.stringify(editedPost)}] } } };
  }
  return { data: { posts: { results: [] } } };
}
if (query.includes('GetUserComments')) {
  return { data: { comments: { results: [] } } };
}
return { data: {} };
`
        });

        await page.reload();
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
        await waitForArchiveRenderComplete(page);

        await expect(page.locator('#archive-feed')).toContainText('Edited Combo Post');
        await expect(page.locator('#archive-feed')).not.toContainText('Junk Combo Post');
        await expect(page.locator('#archive-status')).not.toHaveClass(/status-error/);

        const flags = await page.evaluate(() => ({
            comboRejectedFetches: (window as any).__POST_COMBO_REJECTED__ || 0,
            fullScan: (window as any).__POST_COMBO_FULL_SCAN__ === true
        }));
        expect(flags.comboRejectedFetches).toBe(1);
        expect(flags.fullScan).toBe(true);
    });

    test('posts sync probes an empty incremental first page and falls back to the full scan [PR-UARCH-15]', async ({ page }) => {
        const username = `EmptyIncrementalProbe_${Date.now()}`;
        const userId = 'u-empty-incremental-probe';
        const userObj = { _id: userId, username, displayName: 'Empty Incremental Probe', slug: 'empty-incremental-probe', karma: 100 };
        const initialPost = {
            _id: 'p-probe-seed',
            title: 'Seeded Probe Post',
            slug: 'seeded-probe-post',
            pageUrl: 'https://lesswrong.com/posts/p-probe-seed/seeded-probe-post',
            postedAt: '2020-01-01T00:00:00.000Z',
            modifiedAt: '2024-01-01T00:00:00.000Z',
            baseScore: 10,
            voteCount: 3,
            commentCount: 0,
            htmlBody: '<p>Seeded body</p>',
            contents: { markdown: 'Seeded body' },
            user: userObj
        };
        const editedPost = {
            ...initialPost,
            title: 'Probed Edit Post',
            modifiedAt: '3000-01-01T00:00:00.000Z',
            htmlBody: '<p>Edited body</p>',
            contents: { markdown: 'Edited body' }
        };

        // First visit: full sync (no watermark) seeds the cache.
        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
}
if (query.includes('GetUserPosts')) {
  if ((variables.offset || 0) !== 0) {
    return { data: { posts: { results: [] } } };
  }
  return { data: { posts: { results: [${JSON.stringify(initialPost)}] } } };
}
if (query.includes('GetUserComments')) {
  return { data: { comments: { results: [] } } };
}
return { data: {} };
`
        });

        await page.goto(`https://www.lesswrong.com/archive?username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
        await waitForArchiveRenderComplete(page);
        await expect(page.locator('#archive-feed')).toContainText('Seeded Probe Post');

        // Second visit: the incremental query wrongly returns an EMPTY first
        // page (server misapplies the after filter) while the modifiedAt
        // query without the filter still serves the edited post. The loader
        // must probe once (incremental query without `after`) and fall back
        // to the full offset scan so the edited post is not silently skipped
        // and the posts watermark is not advanced past it.
        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
}
if (query.includes('GetUserPostsIncremental')) {
  if (variables.after) {
    window.__PROBE_INCREMENTAL_SEEN__ = true;
    return { data: { posts: { results: [] } } };
  }
  window.__PROBE_REQUEST_SEEN__ = true;
  return { data: { posts: { results: [${JSON.stringify(editedPost)}] } } };
}
if (query.includes('GetUserPosts')) {
  window.__PROBE_FULL_REQUESTS__ = (window.__PROBE_FULL_REQUESTS__ || 0) + 1;
  const start = variables.offset || 0;
  if (start === 0) {
    return { data: { posts: { results: [${JSON.stringify(editedPost)}] } } };
  }
  return { data: { posts: { results: [] } } };
}
if (query.includes('GetUserComments')) {
  return { data: { comments: { results: [] } } };
}
return { data: {} };
`
        });

        await page.reload();
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
        await waitForArchiveRenderComplete(page);

        // The edited post arrives via the full-scan fallback (one probe
        // request + the two scan pages); without the probe the sync would
        // conclude "up to date" and the post would never appear.
        await expect(page.locator('#archive-feed')).toContainText('Probed Edit Post');
        await expect(page.locator('#archive-status')).not.toHaveClass(/status-error/);

        const flags = await page.evaluate(() => ({
            incrementalSeen: (window as any).__PROBE_INCREMENTAL_SEEN__ === true,
            probeSeen: (window as any).__PROBE_REQUEST_SEEN__ === true,
            fullRequests: (window as any).__PROBE_FULL_REQUESTS__ || 0
        }));
        expect(flags.incrementalSeen).toBe(true);
        expect(flags.probeSeen).toBe(true);
        expect(flags.fullRequests).toBe(2);
    });

    test('posts pagination stops when the server repeats the same full page (offset clamp) [PR-UARCH-15]', async ({ page }) => {
        const username = `OffsetClamp_${Date.now()}`;
        const userId = 'u-offset-clamp';
        const userObj = { _id: userId, username, displayName: 'Offset Clamp', slug: 'offset-clamp', karma: 100 };

        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
}
if (query.includes('GetUserPosts')) {
  window.__POST_CLAMP_FETCHES__ = (window.__POST_CLAMP_FETCHES__ || 0) + 1;
  const results = [];
  for (let i = 0; i < 100; i++) {
    results.push({
      _id: 'p-clamp-' + i,
      title: 'Clamp Post ' + i,
      postedAt: new Date(Date.UTC(2020, 0, 1, 0, 0, i)).toISOString(),
      modifiedAt: new Date(Date.UTC(2020, 0, 1, 0, 0, i)).toISOString(),
      user: ${JSON.stringify(userObj)}
    });
  }
  return { data: { posts: { results } } };
}
if (query.includes('GetUserComments')) {
  return { data: { comments: { results: [] } } };
}
return { data: {} };
`
        });

        await page.goto(`https://www.lesswrong.com/archive?username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
        await waitForArchiveRenderComplete(page);

        // The loader must stop after the third identical page instead of looping
        // (one page to prime, two consecutive all-seen pages to detect the clamp).
        await expect(page.locator('#archive-status')).toContainText('100 total items');
        await expect(page.locator('#archive-status')).not.toHaveClass(/status-error/);
        await expect(page.locator('.pr-item')).toHaveCount(100);
        const fetchCount = await page.evaluate(() => (window as any).__POST_CLAMP_FETCHES__ || 0);
        expect(fetchCount).toBe(3);
    });

    test('posts pagination stops gracefully when the API skip limit is reached [PR-UARCH-15]', async ({ page }) => {
        const username = `OffsetCap_${Date.now()}`;
        const userId = 'u-offset-cap';
        const userObj = { _id: userId, username, displayName: 'Offset Cap', slug: 'offset-cap', karma: 100 };

        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
}
if (query.includes('GetUserPosts')) {
  window.__POST_CAP_BATCHES__ = (window.__POST_CAP_BATCHES__ || 0) + 1;
  if ((variables.offset || 0) >= 100) {
    return { errors: [{ message: 'Exceeded maximum value for skip' }], data: {} };
  }
  const results = [];
  for (let i = 0; i < 100; i++) {
    results.push({
      _id: 'p-cap-' + i,
      title: 'Cap Post ' + i,
      postedAt: new Date(Date.UTC(2020, 0, 1, 0, 0, i)).toISOString(),
      user: ${JSON.stringify(userObj)}
    });
  }
  return { data: { posts: { results } } };
}
if (query.includes('GetUserComments')) {
  return { data: { comments: { results: [] } } };
}
return { data: {} };
`
        });

        await page.goto(`https://www.lesswrong.com/archive?username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
        await waitForArchiveRenderComplete(page);

        // The sync must keep the 100 items fetched before the cap, not fail,
        // and surface the truncation in the status line.
        await expect(page.locator('#archive-status')).toContainText('100 total items');
        await expect(page.locator('#archive-status')).toContainText('truncated at API offset limit');
        await expect(page.locator('#archive-status')).not.toHaveClass(/status-error/);
        await expect(page.locator('.pr-item')).toHaveCount(100);
        const batchCount = await page.evaluate(() => (window as any).__POST_CAP_BATCHES__ || 0);
        expect(batchCount).toBe(2);
    });

    test('posts pagination continues past a partial batch with invalid rows [PR-UARCH-15]', async ({ page }) => {
        const username = `PostsPartial_${Date.now()}`;
        const userId = 'u-posts-partial';
        const userObj = { _id: userId, username, displayName: 'Posts Partial', slug: 'posts-partial', karma: 100 };

        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
}
if (query.includes('GetUserPosts')) {
  const start = variables.offset || 0;
  if (start === 0) {
    const results = [];
    for (let i = 0; i < 100; i++) {
      results.push({
        _id: 'p-partial-' + i,
        title: 'Partial Post ' + i,
        postedAt: new Date(Date.UTC(2020, 0, 1, 0, 0, i)).toISOString(),
        modifiedAt: new Date(Date.UTC(2020, 0, 1, 0, 0, i)).toISOString(),
        user: ${JSON.stringify(userObj)}
      });
    }
    // Poisoned row: dropped by the loader's filter, yielding a short (99-item) batch.
    results[50] = null;
    return {
      data: { posts: { results } },
      errors: [{ message: 'Unable to find document for post: ghost-row', path: ['posts', 'results', 50, 'pageUrl'] }]
    };
  }
  if (start === 100) {
    return {
      data: {
        posts: {
          results: [{
            _id: 'p-partial-tail',
            title: 'Partial Tail Post',
            postedAt: '2019-01-01T00:00:00.000Z',
            modifiedAt: '2019-01-01T00:00:00.000Z',
            user: ${JSON.stringify(userObj)}
          }]
        }
      }
    };
  }
  return { data: { posts: { results: [] } } };
}
if (query.includes('GetUserComments')) {
  return { data: { comments: { results: [] } } };
}
return { data: {} };
`
        });

        await page.goto(`https://www.lesswrong.com/archive?username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
        await waitForArchiveRenderComplete(page);

        // The short (99-item) first batch must NOT stop pagination: the tail
        // post from the second page must be present and all valid items must
        // render (99 + 1 = 100).
        await expect(page.locator('#archive-feed')).toContainText('Partial Tail Post');
        await expect(page.locator('#archive-status')).toContainText('100 total items');
        await expect(page.locator('#archive-status')).not.toHaveClass(/status-error/);
        await expect(page.locator('.pr-item')).toHaveCount(100);
    });

    test('[PR-UARCH-15] cursor pagination does not jump to outlier max timestamp and skip middle history', async ({ page }) => {
        const username = `CursorJumpGuard_${Date.now()}`;
        const userId = 'u-cursor-jump-guard';
        const userObj = {
            _id: userId,
            username,
            displayName: 'Cursor Jump Guard',
            slug: 'cursor-jump-guard',
            karma: 100
        };
        const postObj = {
            _id: 'p-cursor-guard',
            title: 'Cursor Guard Post',
            slug: 'cursor-guard-post',
            pageUrl: 'https://lesswrong.com/posts/p-cursor-guard/cursor-guard-post',
            postedAt: '2019-01-01T00:00:00.000Z',
            modifiedAt: '2026-01-01T00:00:00.000Z',
            baseScore: 10,
            voteCount: 2,
            commentCount: 4,
            user: userObj
        };

        const commentEarly = {
            _id: 'c-cursor-early',
            postedAt: '2019-03-01T00:00:00.000Z',
            lastEditedAt: '2020-05-03T09:48:55.597Z',
            htmlBody: '<p>Early comment</p>',
            baseScore: 3,
            voteCount: 1,
            descendentCount: 0,
            directChildrenCount: 0,
            pageUrl: `${postObj.pageUrl}#c-cursor-early`,
            author: username,
            rejected: false,
            topLevelCommentId: 'c-cursor-early',
            user: userObj,
            postId: postObj._id,
            parentCommentId: null,
            parentComment: null,
            post: postObj,
            contents: { markdown: 'Early comment' }
        };
        const commentOutlier = {
            _id: 'c-cursor-outlier',
            postedAt: '2019-04-01T00:00:00.000Z',
            lastEditedAt: '2026-01-07T23:45:47.549Z',
            htmlBody: '<p>Outlier edited comment</p>',
            baseScore: 4,
            voteCount: 1,
            descendentCount: 0,
            directChildrenCount: 0,
            pageUrl: `${postObj.pageUrl}#c-cursor-outlier`,
            author: username,
            rejected: false,
            topLevelCommentId: 'c-cursor-outlier',
            user: userObj,
            postId: postObj._id,
            parentCommentId: null,
            parentComment: null,
            post: postObj,
            contents: { markdown: 'Outlier edited comment' }
        };
        const commentTail = {
            _id: 'c-cursor-tail',
            postedAt: '2020-01-01T00:00:00.000Z',
            lastEditedAt: '2022-04-12T18:31:57.108Z',
            htmlBody: '<p>Tail boundary comment</p>',
            baseScore: 5,
            voteCount: 1,
            descendentCount: 0,
            directChildrenCount: 0,
            pageUrl: `${postObj.pageUrl}#c-cursor-tail`,
            author: username,
            rejected: false,
            topLevelCommentId: 'c-cursor-tail',
            user: userObj,
            postId: postObj._id,
            parentCommentId: null,
            parentComment: null,
            post: postObj,
            contents: { markdown: 'Tail boundary comment' }
        };
        const commentMiddle = {
            _id: 'c-cursor-middle',
            postedAt: '2024-08-15T00:00:00.000Z',
            lastEditedAt: '2024-08-15T00:00:00.000Z',
            htmlBody: '<p>Middle history comment that must not be skipped</p>',
            baseScore: 9,
            voteCount: 2,
            descendentCount: 0,
            directChildrenCount: 0,
            pageUrl: `${postObj.pageUrl}#c-cursor-middle`,
            author: username,
            rejected: false,
            topLevelCommentId: 'c-cursor-middle',
            user: userObj,
            postId: postObj._id,
            parentCommentId: null,
            parentComment: null,
            post: postObj,
            contents: { markdown: 'Middle history comment that must not be skipped' }
        };

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
  window.__COMMENT_AFTER_VALUES__ = window.__COMMENT_AFTER_VALUES__ || [];
  window.__COMMENT_AFTER_VALUES__.push(variables.after ?? null);
  if (!variables.after) {
    return { data: { comments: { results: [${JSON.stringify(commentEarly)}, ${JSON.stringify(commentOutlier)}, ${JSON.stringify(commentTail)}] } } };
  }
  if (variables.after === '${commentTail.lastEditedAt}') {
    return { data: { comments: { results: [${JSON.stringify(commentMiddle)}] } } };
  }
  if (variables.after === '${commentMiddle.lastEditedAt}') {
    return { data: { comments: { results: [] } } };
  }
  if (variables.after === '${commentOutlier.lastEditedAt}') {
    // Simulates the observed skip path when cursor jumps to the max outlier timestamp.
    return { data: { comments: { results: [${JSON.stringify(commentOutlier)}] } } };
  }
  return { data: { comments: { results: [] } } };
}
return { data: {} };
`
        });

        await page.goto(`https://www.lesswrong.com/archive?username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
        await waitForArchiveRenderComplete(page);

        await expect(page.locator('#archive-feed')).toContainText('Middle history comment that must not be skipped');

        const afterValues = await page.evaluate(() => (window as any).__COMMENT_AFTER_VALUES__ || []);
        expect(afterValues).toContain(commentTail.lastEditedAt);
        expect(afterValues).toContain(commentMiddle.lastEditedAt);
        expect(afterValues).not.toContain(commentOutlier.lastEditedAt);
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

  await page.goto(`https://www.lesswrong.com/archive?username=${username}`);
  await page.evaluate(scriptContent);
  await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
    await waitForArchiveRenderComplete(page);

  // Switch to Thread View (triggers context fetch)
  await selectArchiveView(page, 'thread-full');

  // Wait for thread view to render with parent context
  await expect(page.locator('.pr-comment[data-id="c-parent"]')).toBeVisible();
  await expect(page.locator('.pr-comment[data-id="c-child"]')).toBeVisible();

  // Trigger a rerender by changing sort mode
  await page.locator('#archive-sort').selectOption('score');

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
                    if ((variables.offset || 0) !== 0) {
                        return { data: { posts: { results: [] } } };
                    }
                    // Return only old post initially
                    return { data: { posts: { results: [${JSON.stringify(initialPost)}] } } };
                }
                if (query.includes('GetUserComments')) {
                    return { data: { comments: { results: [] } } };
                }
            `
        });

        await page.goto(`https://www.lesswrong.com/archive?username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
    await waitForArchiveRenderComplete(page);

        // Verify Old Post is there
        await expect(page.locator('.pr-item h2')).toHaveText('Old Post');
        
        // Verify terminal status asks user to refresh for newest background-fetch content
        await expect(page.locator('#archive-status')).toContainText(/Fetch complete\. Please refresh page to view latest content\.|Sync complete\./);

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
                    if ((variables.offset || 0) !== 0) {
                        return { data: { posts: { results: [] } } };
                    }
                    // Return both posts on the first offset page.
                    return { data: { posts: { results: [${JSON.stringify(initialPost)}, ${JSON.stringify(newPost)}] } } };
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
    await waitForArchiveRenderComplete(page);

        // It should load cache first (Old Post), then sync and find New Post.
        // We expect eventually both to be visible.
        await expect(page.locator('.pr-item')).toHaveCount(2);
        await expect(page.locator('.pr-item h2').first()).toHaveText('New Post');
        await expect(page.locator('#archive-status')).toContainText(/Fetch complete\. Please refresh page to view latest content\.|Sync complete\./);
    });

    test('[PR-UARCH-34][PR-UARCH-35][PR-UARCH-38] context cache persists across sessions and resolves parent by ID before network', async ({ page }) => {
        const username = `ContextCacheUser_${Date.now()}`;
        const userId = 'u-context-cache';
        const userObj = { _id: userId, username, displayName: 'Context Cache User', slug: 'context-cache-user', karma: 100 };
        const otherUser = { _id: 'u-other-cache', username: 'OtherCacheUser', displayName: 'Other Cache User', slug: 'other-cache-user', karma: 50 };

        const childComment = {
            _id: 'c-context-child',
            postedAt: '2025-01-15T12:00:00Z',
            baseScore: 5,
            voteCount: 1,
            htmlBody: '<p>Child with parent ID only</p>',
            author: username,
            rejected: false,
            topLevelCommentId: 'c-context-child',
            postId: 'p-context',
            parentCommentId: 'c-context-parent',
            parentComment: null,
            user: userObj,
            post: {
                _id: 'p-context',
                title: 'Context Cache Post',
                slug: 'context-cache-post',
                pageUrl: 'https://lesswrong.com/posts/p-context',
                postedAt: '2025-01-10T00:00:00Z',
                baseScore: 10,
                voteCount: 2,
                user: otherUser
            },
            pageUrl: 'https://lesswrong.com/posts/p-context#c-context-child',
            contents: { markdown: 'Child with parent ID only' }
        };

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
  return { data: { comments: { results: [${JSON.stringify(childComment)}] } } };
}
if (query.includes('GetCommentsByIds')) {
  window.__CTX_FETCH_COUNT__ = (window.__CTX_FETCH_COUNT__ || 0) + 1;
  return {
    data: {
      comments: {
        results: [{
          _id: 'c-context-parent',
          postedAt: '2025-01-14T12:00:00Z',
          baseScore: 12,
          voteCount: 2,
          htmlBody: '<p>Cached parent full body</p>',
          author: 'OtherCacheUser',
          rejected: false,
          topLevelCommentId: 'c-context-parent',
          postId: 'p-context',
          parentCommentId: null,
          parentComment: null,
          user: ${JSON.stringify(otherUser)},
          post: {
            _id: 'p-context',
            title: 'Context Cache Post',
            slug: 'context-cache-post',
            pageUrl: 'https://lesswrong.com/posts/p-context',
            postedAt: '2025-01-10T00:00:00Z',
            baseScore: 10,
            voteCount: 2,
            user: ${JSON.stringify(otherUser)}
          },
          pageUrl: 'https://lesswrong.com/posts/p-context#c-context-parent',
          contents: { markdown: 'Cached parent full body' }
        }]
      }
    }
  };
}
return { data: {} };
`
        });

        await page.goto(`https://www.lesswrong.com/archive?username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
    await waitForArchiveRenderComplete(page);

        await page.evaluate(() => { (window as any).__CTX_FETCH_COUNT__ = 0; });
        await selectArchiveView(page, 'thread-full');
        await expect(page.locator('.pr-comment[data-id="c-context-parent"]')).toContainText('Cached parent full body');
        const firstRunFetches = await page.evaluate(() => (window as any).__CTX_FETCH_COUNT__);
        expect(firstRunFetches).toBeGreaterThan(0);

        // Second visit: same archive user, but network returns no parent comments.
        // Parent must come from contextual IndexedDB cache (cache-first waterfall).
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
  return { data: { comments: { results: [${JSON.stringify(childComment)}] } } };
}
if (query.includes('GetCommentsByIds')) {
  window.__CTX_FETCH_COUNT__ = (window.__CTX_FETCH_COUNT__ || 0) + 1;
  return { data: { comments: { results: [] } } };
}
return { data: {} };
`
        });

        await page.reload();
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
    await waitForArchiveRenderComplete(page);

        await page.evaluate(() => { (window as any).__CTX_FETCH_COUNT__ = 0; });
        await selectArchiveView(page, 'thread-full');
        await expect(page.locator('.pr-comment[data-id="c-context-parent"]')).toContainText('Cached parent full body');
        const secondRunFetches = await page.evaluate(() => (window as any).__CTX_FETCH_COUNT__);
        expect(secondRunFetches).toBe(0);
    });

    test('[PR-UARCH-36] canonical post body is not downgraded by context-lite payloads', async ({ page }) => {
        const username = `CanonicalPostUser_${Date.now()}`;
        const userId = 'u-canonical-post';
        const userObj = { _id: userId, username, displayName: 'Canonical Post User', slug: 'canonical-post-user', karma: 120 };
        const otherUser = { _id: 'u-other-canonical', username: 'OtherCanonicalUser', displayName: 'Other Canonical User', slug: 'other-canonical-user', karma: 60 };

        const canonicalPost = {
            _id: 'p-owned',
            title: 'Owned Canonical Post',
            slug: 'owned-canonical-post',
            pageUrl: 'https://lesswrong.com/posts/p-owned',
            postedAt: '2025-01-20T10:00:00Z',
            baseScore: 30,
            voteCount: 8,
            commentCount: 1,
            htmlBody: '<p>Canonical full post body survives context merge</p>',
            contents: { markdown: 'Canonical full post body survives context merge' },
            user: userObj
        };

        const childComment = {
            _id: 'c-owned-child',
            postedAt: '2025-01-21T10:00:00Z',
            baseScore: 5,
            voteCount: 1,
            htmlBody: '<p>Child on owned post</p>',
            author: username,
            rejected: false,
            topLevelCommentId: 'c-owned-child',
            postId: 'p-owned',
            parentCommentId: 'c-owned-parent',
            parentComment: { _id: 'c-owned-parent', postedAt: '2025-01-20T09:00:00Z', parentCommentId: null, user: otherUser },
            user: userObj,
            post: {
                _id: 'p-owned',
                title: 'Owned Canonical Post',
                slug: 'owned-canonical-post',
                pageUrl: 'https://lesswrong.com/posts/p-owned',
                postedAt: '2025-01-20T10:00:00Z',
                baseScore: 30,
                voteCount: 8,
                user: userObj
            },
            pageUrl: 'https://lesswrong.com/posts/p-owned#c-owned-child',
            contents: { markdown: 'Child on owned post' }
        };

        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: ${JSON.stringify(userObj)} } };
}
if (query.includes('GetUserPosts')) {
  return { data: { posts: { results: [${JSON.stringify(canonicalPost)}] } } };
}
if (query.includes('GetUserComments')) {
  return { data: { comments: { results: [${JSON.stringify(childComment)}] } } };
}
if (query.includes('GetCommentsByIds')) {
  // Parent includes only lite post fields for the same canonical post.
  return {
    data: {
      comments: {
        results: [{
          _id: 'c-owned-parent',
          postedAt: '2025-01-20T09:00:00Z',
          baseScore: 9,
          voteCount: 2,
          htmlBody: '<p>Fetched parent</p>',
          author: 'OtherCanonicalUser',
          rejected: false,
          topLevelCommentId: 'c-owned-parent',
          postId: 'p-owned',
          parentCommentId: null,
          parentComment: null,
          user: ${JSON.stringify(otherUser)},
          post: {
            _id: 'p-owned',
            title: 'Owned Canonical Post',
            slug: 'owned-canonical-post',
            pageUrl: 'https://lesswrong.com/posts/p-owned',
            postedAt: '2025-01-20T10:00:00Z',
            baseScore: 30,
            voteCount: 8,
            user: ${JSON.stringify(userObj)}
          },
          pageUrl: 'https://lesswrong.com/posts/p-owned#c-owned-parent',
          contents: { markdown: 'Fetched parent' }
        }]
      }
    }
  };
}
return { data: {} };
`
        });

        await page.goto(`https://www.lesswrong.com/archive?username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
    await waitForArchiveRenderComplete(page);

        await selectArchiveView(page, 'thread-full');
        await expect(page.locator('.pr-comment[data-id="c-owned-parent"]')).toBeVisible();

        // Return to card view and ensure canonical full body still exists.
        await selectArchiveView(page, 'card');
        await expect(page.locator('.pr-post[data-id="p-owned"]')).toContainText('Canonical full post body survives context merge');
    });

    test('[PR-UARCH-37] archive pagination continues when partial batch contains invalid rows', async ({ page }) => {
        const username = `PagingSafetyUser_${Date.now()}`;
        const userId = 'u-paging-safety';
        const userObj = { _id: userId, username, displayName: 'Paging Safety User', slug: 'paging-safety-user', karma: 80 };

        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
const userObj = ${JSON.stringify(userObj)};
const makeComment = (id, postedAt, bodyText) => ({
  _id: id,
  postedAt,
  baseScore: 1,
  voteCount: 1,
  htmlBody: '<p>' + bodyText + '</p>',
  author: userObj.username,
  rejected: false,
  topLevelCommentId: id,
  postId: 'p-pagination',
  parentCommentId: null,
  parentComment: null,
  user: userObj,
  post: {
    _id: 'p-pagination',
    title: 'Pagination Safety Post',
    slug: 'pagination-safety-post',
    pageUrl: 'https://lesswrong.com/posts/p-pagination',
    postedAt: '2025-01-01T00:00:00Z',
    baseScore: 1,
    voteCount: 1,
    user: userObj
  },
  pageUrl: 'https://lesswrong.com/posts/p-pagination#' + id,
  contents: { markdown: bodyText }
});

if (query.includes('UserBySlug') || query.includes('user(input:')) {
  return { data: { user: userObj } };
}
if (query.includes('GetUserPosts')) {
  return { data: { posts: { results: [] } } };
}
if (query.includes('GetUserComments')) {
  window.__COMMENT_BATCH_CALLS__ = (window.__COMMENT_BATCH_CALLS__ || 0) + 1;

  if (!variables.after) {
    const base = Date.parse('2025-01-01T00:00:00Z');
    const firstBatch = [];
    for (let i = 0; i < 100; i++) {
      const ts = new Date(base + i * 60000).toISOString();
      firstBatch.push(makeComment('c-first-' + i, ts, 'First batch comment ' + i));
    }
    // Partial-response poison row; valid rows should still paginate forward.
    firstBatch[40] = null;
    return {
      data: { comments: { results: firstBatch } },
      errors: [{ message: 'Unable to find document for comment: ghost-row', path: ['comments', 'results', 40, 'pageUrl'] }]
    };
  }

  return {
    data: {
      comments: {
        results: [makeComment('c-second-page', '2025-02-01T00:00:00Z', 'Second page sentinel comment')]
      }
    }
  };
}
return { data: {} };
`
        });

        await page.goto(`https://www.lesswrong.com/archive?username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
    await waitForArchiveRenderComplete(page);

        // Requirement outcome: pagination must continue past a partial/poisoned row
        // and still load older pages.
        await expect(page.locator('.pr-comment[data-id="c-first-0"]')).toBeVisible();
        await expect(page.locator('.pr-comment[data-id="c-second-page"]')).toBeVisible();
    });
});
