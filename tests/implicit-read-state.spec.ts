import { test, expect } from '@playwright/test';
import { PowerReaderPage } from './pages/PowerReaderPage';
import { initPowerReader } from './helpers/setup';

/**
 * [PR-READ-07] Implicit Read State (Temporal Boundary)
 *
 * Any item (Post or Comment) with a 'postedAt' timestamp older than the current
 * 'loadFrom' session value is treated as READ by default, even if its ID is not
 * present in the explicit readState storage.
 *
 * NOTE on the loadFrom snap: applyInitialLoad() always snaps loadFrom to
 * the oldest comment's date. Therefore:
 *   - Tests 1 & 2 use POSTS that are older than all comments (posts don't affect the snap).
 *   - Test 3 uses page.evaluate to manually set loadFrom after init, then re-renders.
 */

test.describe('Implicit Read State (Temporal Boundary) [PR-READ-07]', () => {

    test('should apply ".read" class to posts older than session cutoff', async ({ page }) => {
        const now = Date.now();
        // T0: old post time (2 hours ago)
        const T0 = new Date(now - 2 * 3600000).toISOString();
        // T2: oldest comment (1 hour ago) — loadFrom will snap here
        const T2 = new Date(now - 1 * 3600000).toISOString();
        // T3: newer comment (30 min ago)
        const T3 = new Date(now - 30 * 60000).toISOString();

        const posts = [
            {
                _id: 'p1',
                title: 'Old Post',
                htmlBody: '<p>Old post body content</p>',
                postedAt: T0,
                baseScore: 10,
                commentCount: 2,
                user: { _id: 'u1', username: 'Author1' }
            }
        ];

        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                baseScore: 5,
                postedAt: T2,
                parentCommentId: null,
                htmlBody: '<p>Comment at T2</p>',
                user: { _id: 'u1', username: 'Author1' },
                post: { _id: 'p1', title: 'Old Post', baseScore: 10 }
            },
            {
                _id: 'c2',
                postId: 'p1',
                baseScore: 5,
                postedAt: T3,
                parentCommentId: null,
                htmlBody: '<p>Comment at T3</p>',
                user: { _id: 'u2', username: 'Author2' },
                post: { _id: 'p1', title: 'Old Post', baseScore: 10 }
            }
        ];

        await initPowerReader(page, { testMode: true, posts, comments });

        // Post p1 has postedAt T0 < loadFrom (T2) → implicitly read
        const postEl = page.locator('.pr-post[data-post-id="p1"]');
        await expect(postEl).toHaveClass(/\bread\b/);

        // Comments c1 (at T2 == loadFrom) and c2 (at T3 > loadFrom) should NOT be read
        const c1 = page.locator('.pr-comment[data-id="c1"]');
        const c2 = page.locator('.pr-comment[data-id="c2"]');
        await expect(c1).not.toHaveClass(/\bread\b/);
        await expect(c2).not.toHaveClass(/\bread\b/);

        // Verify that p1's ID is NOT in the explicit read storage
        const readStorage = await page.evaluate(() => {
            return (window as any).GM_getValue('power-reader-read', '{}');
        });
        const readDict = JSON.parse(readStorage);
        expect(readDict['p1']).toBeUndefined();
    });

    test('should exclude implicitly read posts from Tree-Karma sorting', async ({ page }) => {
        const now = Date.now();
        // T0: old post time (3 hours ago)
        const T0 = new Date(now - 3 * 3600000).toISOString();
        // T2: oldest comment (1 hour ago) — loadFrom snaps here
        const T2 = new Date(now - 1 * 3600000).toISOString();
        // T3: newer times
        const T3 = new Date(now - 30 * 60000).toISOString();
        const T4 = new Date(now - 20 * 60000).toISOString();

        const posts = [
            {
                _id: 'p-old',
                title: 'Old High Karma Post',
                htmlBody: '<p>Old high karma body</p>',
                postedAt: T0,
                baseScore: 1000, // Very high, but implicitly read
                commentCount: 1,
                user: { _id: 'u1', username: 'Author1' }
            },
            {
                _id: 'p-new',
                title: 'New Low Karma Post',
                htmlBody: '<p>New low karma body</p>',
                postedAt: T3,
                baseScore: 5, // Low
                commentCount: 1,
                user: { _id: 'u2', username: 'Author2' }
            }
        ];

        const comments = [
            {
                _id: 'c-old',
                postId: 'p-old',
                baseScore: 1, // Low comment karma
                postedAt: T2, // Oldest comment → loadFrom
                parentCommentId: null,
                htmlBody: '<p>Comment on old post</p>',
                user: { _id: 'u1', username: 'Author1' },
                post: { _id: 'p-old', title: 'Old High Karma Post', baseScore: 1000 }
            },
            {
                _id: 'c-new',
                postId: 'p-new',
                baseScore: 2,
                postedAt: T4,
                parentCommentId: null,
                htmlBody: '<p>Comment on new post</p>',
                user: { _id: 'u2', username: 'Author2' },
                post: { _id: 'p-new', title: 'New Low Karma Post', baseScore: 5 }
            }
        ];

        await initPowerReader(page, { testMode: true, posts, comments });

        const prPage = new PowerReaderPage(page);

        // p-old: post at T0 < loadFrom(T2) → implicitly read → baseScore 1000 excluded from TK
        //   c-old: at T2 == loadFrom → NOT read → TK of p-old group = max(1) = 1
        // p-new: post at T3 > loadFrom → unread → TK = max(5, 2) = 5
        // Since 5 > 1, p-new should be sorted first
        await expect(prPage.posts.nth(0)).toContainText('New Low Karma Post');
        await expect(prPage.posts.nth(1)).toContainText('Old High Karma Post');
    });

    test('should apply ".read" class to comments older than loadFrom after re-render', async ({ page }) => {
        // This tests that context-loaded comments (e.g., via [^] or [t]) that are older
        // than loadFrom are treated as read. We simulate this by re-rendering with a
        // manually-adjusted loadFrom that is newer than some comments.

        const now = Date.now();
        const T1 = new Date(now - 3 * 3600000).toISOString(); // old parent
        const T2 = new Date(now - 2 * 3600000).toISOString(); // mid cutoff
        const T3 = new Date(now - 1 * 3600000).toISOString(); // recent child

        const posts = [
            {
                _id: 'p1',
                title: 'Test Post',
                htmlBody: '<p>Post body</p>',
                postedAt: T3,
                baseScore: 10,
                commentCount: 2,
                user: { _id: 'u1', username: 'Author1' }
            }
        ];

        const comments = [
            {
                _id: 'c-parent',
                postId: 'p1',
                baseScore: 5,
                postedAt: T1, // oldest → loadFrom snaps here initially
                parentCommentId: null,
                htmlBody: '<p>Old parent comment</p>',
                user: { _id: 'u1', username: 'Author1' },
                post: { _id: 'p1', title: 'Test Post', baseScore: 10 }
            },
            {
                _id: 'c-child',
                postId: 'p1',
                baseScore: 5,
                postedAt: T3,
                parentCommentId: 'c-parent',
                htmlBody: '<p>Recent child comment</p>',
                user: { _id: 'u2', username: 'Author2' },
                post: { _id: 'p1', title: 'Test Post', baseScore: 10 }
            }
        ];

        await initPowerReader(page, { testMode: true, posts, comments });

        // Initially, loadFrom snaps to T1 (oldest comment), so both comments are NOT < T1.
        // Verify c-parent is NOT read initially.
        const cParent = page.locator('.pr-comment[data-id="c-parent"]');
        await expect(cParent).not.toHaveClass(/\bread\b/);

        // Now simulate a scenario where loadFrom has advanced past c-parent
        // (e.g., user scrolled to bottom in a previous session, advancing loadFrom to T2)
        // and c-parent was re-loaded as context for c-child.
        await page.evaluate((cutoff) => {
            (window as any).GM_setValue('power-reader-read-from', cutoff);
            // Re-render the UI with the updated loadFrom
            const state = (window as any).getState();
            (window as any).renderUI(state);
        }, T2);

        // Wait for re-render to complete
        await page.waitForTimeout(200);

        // Now c-parent (T1 < T2) should be implicitly read
        const cParentAfter = page.locator('.pr-comment[data-id="c-parent"]');
        await expect(cParentAfter).toHaveClass(/\bread\b/);

        // c-child (T3 > T2) should still be unread
        const cChild = page.locator('.pr-comment[data-id="c-child"]');
        await expect(cChild).not.toHaveClass(/\bread\b/);

        // Verify c-parent's ID is NOT in the explicit read storage
        const readStorage = await page.evaluate(() => {
            return (window as any).GM_getValue('power-reader-read', '{}');
        });
        const readDict = JSON.parse(readStorage);
        expect(readDict['c-parent']).toBeUndefined();
    });
});
