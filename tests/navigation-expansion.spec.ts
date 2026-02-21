
import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Navigation to Read Placeholders', () => {
    test('find-parent [^] should expand a read placeholder parent', async ({ page }) => {
        const posts = [
            { _id: 'p1', title: 'Post 1', htmlBody: 'Content 1', postedAt: '2020-01-01T00:00:00Z' }
        ];

        // Prepare nested comments for proper placeholder reconstruction
        const c1: any = {
            _id: 'c1',
            postId: 'p1',
            htmlBody: 'Parent',
            postedAt: '2020-01-01T00:01:00Z',
            user: { _id: 'u1', username: 'Author1' }
        };
        const c2: any = {
            _id: 'c2',
            postId: 'p1',
            parentCommentId: 'c1',
            parentComment: c1,
            htmlBody: 'Middle',
            postedAt: '2020-01-01T00:02:00Z',
            user: { _id: 'u2', username: 'Author2' }
        };
        const c3: any = {
            _id: 'c3',
            postId: 'p1',
            parentCommentId: 'c2',
            parentComment: c2,
            htmlBody: 'Child',
            postedAt: new Date().toISOString(),
            user: { _id: 'u3', username: 'Author3' }
        };

        const comments = [c1, c2, c3];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments,
            // Explicitly mark c1 and c2 as read, otherwise they might be unread depending on loadFrom
            storage: {
                'power-reader-read': { 'c1': 1, 'c2': 1 }
            }
        });

        // After init, c1 and c2 are READ but c3 is UNREAD.
        // c3 is visible. c2 is parent of c3. c1 is parent of c2.
        // Since c3 is unread, it brings c2 and c1 into the "Ids To Show" set via parent chain.
        // Since c2 is read and has <2 unread descendants (only c3), it should be a placeholder.
        // Same for c1.



        const c2Loc = page.locator('.pr-comment[data-id="c2"]');
        const c1Loc = page.locator('.pr-comment[data-id="c1"]');
        await expect(c2Loc).toBeAttached();

        // It SHOULD be a checked placeholder because it's read
        await expect(c1Loc).toHaveClass(/pr-comment-placeholder/);
        await expect(c2Loc).toHaveClass(/pr-comment-placeholder/);

        const c3Loc = page.locator('.pr-comment[data-id="c3"]');
        const findParentBtn = c3Loc.locator('[data-action="find-parent"]');
        await expect(findParentBtn).toBeVisible();
        await findParentBtn.click();

        // Expect c2 to expand
        await expect(c2Loc).not.toHaveClass(/pr-comment-placeholder/);
        const c2Body = c2Loc.locator('> .pr-comment-body');
        await expect(c2Body).toBeVisible();
        await expect(c2Body).toContainText('Middle');
        // [p]/[^] should reveal only the direct parent; deeper ancestors are for [t].
        await expect(c1Loc).toHaveClass(/pr-comment-placeholder/);
    });

    test('trace-to-root [t] should expand ALL read placeholder ancestors', async ({ page }) => {
        const posts = [
            { _id: 'p1', title: 'Post 1', htmlBody: 'Content 1', postedAt: '2020-01-01T00:00:00Z' }
        ];

        // Prepare nested comments
        const c1: any = {
            _id: 'c1',
            postId: 'p1',
            htmlBody: 'Root',
            postedAt: '2020-01-01T00:01:00Z',
            user: { _id: 'u1', username: 'Author1' }
        };
        const c2: any = {
            _id: 'c2',
            postId: 'p1',
            parentCommentId: 'c1',
            parentComment: c1,
            htmlBody: 'Middle',
            postedAt: '2020-01-01T00:02:00Z',
            user: { _id: 'u2', username: 'Author2' }
        };
        const c3: any = {
            _id: 'c3',
            postId: 'p1',
            parentCommentId: 'c2',
            parentComment: c2,
            htmlBody: 'Child',
            postedAt: new Date().toISOString(),
            user: { _id: 'u3', username: 'Author3' }
        };

        const comments = [c1, c2, c3];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments,
            storage: {
                'power-reader-read': { 'c1': 1, 'c2': 1 }
            }
        });

        const c1Loc = page.locator('.pr-comment[data-id="c1"]');
        const c2Loc = page.locator('.pr-comment[data-id="c2"]');
        const c3Loc = page.locator('.pr-comment[data-id="c3"]');

        await expect(c1Loc).toBeAttached();
        await expect(c2Loc).toBeAttached();

        await expect(c1Loc).toHaveClass(/pr-comment-placeholder/);
        await expect(c2Loc).toHaveClass(/pr-comment-placeholder/);

        // Click [t] (trace to root) on C3
        const traceBtn = c3Loc.locator('[data-action="load-parents-and-scroll"]');
        await expect(traceBtn).toBeVisible();
        await traceBtn.click();

        // Both ancestors should expand
        await expect(c1Loc).not.toHaveClass(/pr-comment-placeholder/);
        await expect(c2Loc).not.toHaveClass(/pr-comment-placeholder/);

        await expect(c1Loc.locator('> .pr-comment-body')).toContainText('Root');
        await expect(c2Loc.locator('> .pr-comment-body')).toContainText('Middle');
    });
});
