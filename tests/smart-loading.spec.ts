import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Smart Loading Heuristic', () => {
    test('[PR-LOAD-06] Heuristic Rendering: Thread vs Individual Loading', async ({ page }) => {
        const user = { _id: 'u1', username: 'tester', karma: 100 };

        // --- Thread 1: High Activity (3 unreads with missing children) ---
        const t1_root = { _id: 't1_root', postId: 'p1', postedAt: '2023-01-01T10:00:00Z', user, htmlBody: 'Root 1' };
        const t1_c1 = { _id: 't1_c1', postId: 'p1', topLevelCommentId: 't1_root', parentCommentId: 't1_root', postedAt: '2023-01-02T10:00:00Z', user, htmlBody: 'T1 Reply 1', directChildrenCount: 1 };
        const t1_c2 = { _id: 't1_c2', postId: 'p1', topLevelCommentId: 't1_root', parentCommentId: 't1_root', postedAt: '2023-01-02T11:00:00Z', user, htmlBody: 'T1 Reply 2', directChildrenCount: 1 };
        const t1_c3 = { _id: 't1_c3', postId: 'p1', topLevelCommentId: 't1_root', parentCommentId: 't1_root', postedAt: '2023-01-02T12:00:00Z', user, htmlBody: 'T1 Reply 3', directChildrenCount: 1 };

        const t1_c1_child = { _id: 't1_c1_child', postId: 'p1', topLevelCommentId: 't1_root', parentCommentId: 't1_c1', postedAt: '2023-01-02T13:00:00Z', user, htmlBody: 'T1 Subreply 1' };

        // --- Thread 2: Individual Loading (1 unread with missing child) ---
        const t2_root = { _id: 't2_root', postId: 'p1', postedAt: '2023-01-01T10:00:00Z', user, htmlBody: 'Root 2' };
        const t2_c1 = {
            _id: 't2_c1',
            postId: 'p1',
            topLevelCommentId: 't2_root',
            parentCommentId: 't2_root',
            postedAt: '2023-01-02T10:00:00Z',
            user,
            htmlBody: 'T2 Unread',
            directChildrenCount: 1
        };
        const t2_c1_child = { _id: 't2_c1_child', postId: 'p1', topLevelCommentId: 't2_root', parentCommentId: 't2_c1', postedAt: '2023-01-02T11:00:00Z', user, htmlBody: 'T2 Subreply' };

        const allComments = [
            t1_root, t1_c1, t1_c2, t1_c3, t1_c1_child,
            t2_root, t2_c1, t2_c1_child
        ];

        await initPowerReader(page, {
            comments: allComments,
            currentUser: user,
            storage: {
                'power-reader-read': {
                    't1_root': 1,
                    't2_root': 1
                }
            },
            onInit: 'window.PR_TEST_FORCE_SMART_LOADING = true;',
            verbose: true,
            appVerbose: true,
            onGraphQL: `
                if (query.includes('GetAllRecentComments')) {
                    return { data: { comments: { results: ${JSON.stringify([t1_root, t1_c1, t1_c2, t1_c3, t2_root, t2_c1])} } } };
                }
            `
        });

        // T1: High activity (3 unreads). Fetched whole thread.
        // Check that descendants are visible.
        await expect(page.locator('.pr-comment[data-id="t1_c1_child"]')).toBeVisible();
        await expect(page.locator('.pr-comment[data-id="t1_c1_child"]')).toContainText('T1 Subreply 1');

        // T2: Low activity (1 unread). Fetched direct replies.
        await expect(page.locator('.pr-comment[data-id="t2_c1_child"]')).toBeVisible();
        await expect(page.locator('.pr-comment[data-id="t2_c1_child"]')).toContainText('T2 Subreply');
    });

    test('Placeholder Logic: Deep Tree Context', async ({ page }) => {
        const user = { _id: 'u1', username: 'tester', karma: 100 };

        const root = { _id: 'root', postId: 'p2', postedAt: '2023-01-01T10:00:00Z', user, htmlBody: 'Deep Root' };
        const L1 = { _id: 'L1', postId: 'p2', parentCommentId: 'root', topLevelCommentId: 'root', postedAt: '2023-01-02T10:00:00Z', user, htmlBody: 'Level 1', directChildrenCount: 1 };
        const L2 = { _id: 'L2', postId: 'p2', parentCommentId: 'L1', topLevelCommentId: 'root', postedAt: '2023-01-03T10:00:00Z', user, htmlBody: 'Level 2', directChildrenCount: 1 };
        const L3 = { _id: 'L3', postId: 'p2', parentCommentId: 'L2', topLevelCommentId: 'root', postedAt: '2023-01-04T10:00:00Z', user, htmlBody: 'Level 3 (Focal)' };

        const allComments = [root, L1, L2, L3];

        await initPowerReader(page, {
            comments: allComments,
            currentUser: user,
            storage: { 'power-reader-read': { 'root': 1 } },
            onInit: 'window.PR_TEST_FORCE_SMART_LOADING = true;',
            verbose: true,
            appVerbose: true,
            onGraphQL: `
                if (query.includes('GetAllRecentComments')) {
                    // Start with only root and the deepest unread reply (L3)
                    return { data: { comments: { results: ${JSON.stringify([root, L3])} } } };
                }
            `
        });

        // L2 is a missing ancestor. It should be a placeholder.
        const l2 = page.locator('.pr-comment[data-id="L2"]');
        await expect(l2).toHaveClass(/pr-missing-parent/);

        // L3 is visible with content
        const l3 = page.locator('.pr-comment[data-id="L3"]');
        await expect(l3).toContainText('Level 3 (Focal)');

        // Because L3 is nested inside L2, L2's innerText should be the same as L3's
        // (meaning L2 itself adds no header or body text).
        expect(await l2.innerText()).toBe(await l3.innerText());

        // L1 is a grandparent. It is missing and we don't do recursive placeholders.
        // It should NOT be attached to the DOM.
        await expect(page.locator('.pr-comment[data-id="L1"]')).not.toBeAttached();
    });
});
