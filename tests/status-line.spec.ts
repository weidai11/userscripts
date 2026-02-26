import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Status Line Display', () => {

    test('[PR-STATUS-01][PR-STATUS-06] Status line shows date range, comment breakdown, post count, user, and sync mode', async ({ page }) => {
        const now = new Date();
        const comments = [
            {
                _id: 'c1', postId: 'p1',
                htmlBody: '<p>Old comment</p>',
                postedAt: '2026-01-10T08:30:00.000Z',
                baseScore: 5,
                user: { _id: 'u1', username: 'Alice' },
                post: { _id: 'p1', title: 'Post A', baseScore: 5 },
            },
            {
                _id: 'c2', postId: 'p1',
                htmlBody: '<p>New comment</p>',
                postedAt: '2026-01-12T14:22:00.000Z',
                baseScore: 3,
                user: { _id: 'u2', username: 'Bob' },
                post: { _id: 'p1', title: 'Post A', baseScore: 5 },
            },
        ];

        await initPowerReader(page, {
            comments,
            testMode: true,
            verbose: true,
            currentUser: { _id: 'u-me', username: 'TestUser' },
            storage: {
                'power-reader-read-from': '2026-01-10T00:00:00.000Z',
            },
        });

        const status = page.locator('.pr-status');
        await expect(status).toBeVisible();

        // Check date range (formatted from loadFrom and newest comment)
        await expect(status).toContainText('Jan 10');
        await expect(status).toContainText('Jan 12');

        // Check emoji sections present
        await expect(status).toContainText('📆');
        await expect(status).toContainText('💬');
        await expect(status).toContainText('📄');
        await expect(status).toContainText('👤');

        // Check total comment count
        await expect(status).toContainText('2 comments');

        // Check user display
        await expect(status).toContainText('TestUser');
        await expect(status).toContainText('Sync:');

        // Check unread count exists
        const unreadCount = page.locator('#pr-unread-count');
        await expect(unreadCount).toBeVisible();
    });

    test('[PR-STATUS-02] Status shows hidden comments when some are read', async ({ page }) => {
        const now = new Date();
        const oldDate = new Date(now.getTime() - 86400000 * 10).toISOString();
        const newDate = new Date(now.getTime() - 1000).toISOString();

        const comments = [
            {
                _id: 'c-old', postId: 'p1',
                htmlBody: '<p>Old read comment</p>',
                postedAt: oldDate,
                baseScore: 5,
                user: { _id: 'u1', username: 'Alice' },
                post: { _id: 'p1', title: 'Post A', baseScore: 5 },
            },
            {
                _id: 'c-new', postId: 'p1',
                htmlBody: '<p>New unread comment</p>',
                postedAt: newDate,
                baseScore: 3,
                user: { _id: 'u2', username: 'Bob' },
                post: { _id: 'p1', title: 'Post A', baseScore: 5 },
            },
        ];

        // Mark old comment as read
        await initPowerReader(page, {
            comments,
            testMode: true,
            verbose: true,
            currentUser: { _id: 'u-me', username: 'TestUser' },
            storage: {
                'power-reader-read-from': oldDate,
                'power-reader-read': { 'c-old': 1 },
            },
        });

        const status = page.locator('.pr-status');
        await expect(status).toBeVisible();

        // Should show "2 comments" total
        await expect(status).toContainText('2 comments');

        // Should show "hidden" since one comment is read and not shown
        await expect(status).toContainText('hidden');
    });

    test('[PR-STATUS-03] Status shows filtered posts count', async ({ page }) => {
        const now = new Date();
        const date = new Date(now.getTime() - 1000).toISOString();
        const oldDate = new Date(now.getTime() - 86400000 * 10).toISOString();

        const comments = [
            {
                _id: 'c1', postId: 'p1',
                htmlBody: '<p>Comment on post 1</p>',
                postedAt: date,
                baseScore: 5,
                user: { _id: 'u1', username: 'Alice' },
                post: { _id: 'p1', title: 'Post 1', baseScore: 5 },
            },
        ];

        const posts = [
            {
                _id: 'p1', title: 'Post 1',
                htmlBody: '<p>Post 1 body</p>',
                postedAt: date, baseScore: 5,
                user: { _id: 'u1', username: 'Alice' },
            },
            {
                _id: 'p2', title: 'Post 2 (fully read)',
                htmlBody: '<p>Post 2 body</p>',
                postedAt: oldDate, baseScore: 3,
                user: { _id: 'u2', username: 'Bob' },
            },
        ];

        // Mark p2 as read so it gets filtered
        await initPowerReader(page, {
            comments,
            posts,
            testMode: true,
            verbose: true,
            currentUser: { _id: 'u-me', username: 'TestUser' },
            storage: {
                'power-reader-read-from': oldDate,
                'power-reader-read': { 'p2': 1 },
            },
        });

        const status = page.locator('.pr-status');
        await expect(status).toBeVisible();

        // Should show posts count and filtered indicator
        await expect(status).toContainText('posts');
        // p2 should be filtered (fully read, no comments)
        await expect(status).toContainText('filtered');
    });

    test('[PR-STATUS-04] Recent mode still shows resolved date range', async ({ page }) => {
        const commentDate = '2026-02-10T12:00:00.000Z';
        const comments = [{
            _id: 'c1', postId: 'p1',
            htmlBody: '<p>Recent comment</p>',
            postedAt: commentDate,
            baseScore: 5,
            user: { _id: 'u1', username: 'Alice' },
            post: { _id: 'p1', title: 'Post A', baseScore: 5 },
        }];

        // Default storage has __LOAD_RECENT__, but applyInitialLoad resolves it
        await initPowerReader(page, {
            comments,
            testMode: true,
            verbose: true,
            currentUser: { _id: 'u-me', username: 'TestUser' },
        });

        const status = page.locator('.pr-status');
        await expect(status).toBeVisible();

        // applyInitialLoad resolves __LOAD_RECENT__ to actual oldest date
        // so the status should show the resolved date, not '?'
        const text = await status.textContent();
        expect(text).toContain('→');
        expect(text).toContain('Feb 10');
    });
    test('[PR-STATUS-05] Count breakdown handles context and hidden correctly (no negatives)', async ({ page }) => {
        // Setup: 
        // - Post P1 (unread)
        // - Comment C1 (unread, child of P1)
        // - Comment C2 (read, child of C1, shown as context for C3)
        // - Comment C3 (unread, child of C2)
        // - Comment C4 (read, no children, hidden)

        const now = new Date();
        const dateNew = now.toISOString();
        const dateOld = new Date(now.getTime() - 1000000).toISOString();

        const comments = [
            { _id: 'c1', postId: 'p1', postedAt: dateNew, baseScore: 1, user: { username: 'A' }, post: { _id: 'p1', title: 'P1' } },
            { _id: 'c2', postId: 'p1', parentCommentId: 'c1', postedAt: dateOld, baseScore: 1, user: { username: 'A' } },
            { _id: 'c3', postId: 'p1', parentCommentId: 'c2', postedAt: dateNew, baseScore: 1, user: { username: 'A' } },
            { _id: 'c4', postId: 'p1', postedAt: dateOld, baseScore: 1, user: { username: 'A' } },
        ];

        const posts = [
            { _id: 'p1', title: 'P1', postedAt: dateNew, baseScore: 1, user: { username: 'A' } }
        ];

        await initPowerReader(page, {
            comments,
            posts,
            testMode: true,
            storage: {
                // c1, c3 are unread (2)
                // p1 is unread (1)
                // c2 is read (context)
                // c4 is read (hidden)
                'power-reader-read': { 'c2': 1, 'c4': 1 },
                'power-reader-read-from': dateOld,
            },
        });

        const status = page.locator('.pr-status');
        await expect(status).toBeVisible();

        // 1. Total Unread Badge: 2 (c1, c3) comments + 1 (p1) post = 3
        await expect(page.locator('#pr-unread-count')).toHaveText('3');

        // 2. Comment breakdown: 4 comments (2 new · 1 context · 1 hidden)
        // c1, c3 are new (2)
        // c2 is context (1) - it's read but shown because c3 is unread
        // c4 is hidden (1) - it's read and has no unread children
        await expect(status).toContainText('4 comments (2 new · 1 context · 1 hidden)');

        // Ensure no negative sign
        const text = await status.textContent();
        expect(text).not.toContain('-');
    });
});
