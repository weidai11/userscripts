
import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Navigation to Read Placeholders', () => {
    test('find-parent [^] should expand a read placeholder parent', async ({ page }) => {
        const posts = [
            { _id: 'p1', title: 'Post 1', htmlBody: 'Content 1', postedAt: '2020-01-01T00:00:00Z' }
        ];
        // C1 (Read) -> C2 (Read) -> C3 (Unread)
        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                htmlBody: 'Parent',
                postedAt: '2020-01-01T00:01:00Z',
                user: { _id: 'u1', username: 'Author1' }
            },
            {
                _id: 'c2',
                postId: 'p1',
                parentCommentId: 'c1',
                htmlBody: 'Middle',
                postedAt: '2020-01-01T00:02:00Z',
                user: { _id: 'u2', username: 'Author2' }
            },
            {
                _id: 'c3',
                postId: 'p1',
                parentCommentId: 'c2',
                htmlBody: 'Child',
                postedAt: new Date().toISOString(),
                user: { _id: 'u3', username: 'Author3' }
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments,
            storage: {
                'power-reader-read': { 'c1': 1, 'c2': 1 }
            }
        });

        const c2 = page.locator('.pr-comment[data-id="c2"]');
        await expect(c2).toBeAttached();
        await expect(c2).toHaveClass(/pr-comment-placeholder/);

        const c3 = page.locator('.pr-comment[data-id="c3"]');
        const findParentBtn = c3.locator('[data-action="find-parent"]');
        await findParentBtn.click();

        await expect(c2).not.toHaveClass(/pr-comment-placeholder/);
        const c2Body = c2.locator('> .pr-comment-body');
        await expect(c2Body).toBeVisible();
        await expect(c2Body).toContainText('Middle');
    });

    test('trace-to-root [t] should expand ALL read placeholder ancestors', async ({ page }) => {
        const posts = [
            { _id: 'p1', title: 'Post 1', htmlBody: 'Content 1', postedAt: '2020-01-01T00:00:00Z' }
        ];
        // C1 (Root) -> C2 (Middle) -> C3 (Child)
        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                htmlBody: 'Root',
                postedAt: '2020-01-01T00:01:00Z',
                user: { _id: 'u1', username: 'Author1' }
            },
            {
                _id: 'c2',
                postId: 'p1',
                parentCommentId: 'c1',
                htmlBody: 'Middle',
                postedAt: '2020-01-01T00:02:00Z',
                user: { _id: 'u2', username: 'Author2' }
            },
            {
                _id: 'c3',
                postId: 'p1',
                parentCommentId: 'c2',
                htmlBody: 'Child',
                postedAt: new Date().toISOString(),
                user: { _id: 'u3', username: 'Author3' }
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments,
            storage: {
                'power-reader-read': { 'c1': 1, 'c2': 1 }
            }
        });

        const c1 = page.locator('.pr-comment[data-id="c1"]');
        const c2 = page.locator('.pr-comment[data-id="c2"]');
        const c3 = page.locator('.pr-comment[data-id="c3"]');

        await expect(c1).toBeAttached();
        await expect(c2).toBeAttached();

        await expect(c1).toHaveClass(/pr-comment-placeholder/);
        await expect(c2).toHaveClass(/pr-comment-placeholder/);

        const traceBtn = c3.locator('[data-action="load-parents-and-scroll"]');
        await traceBtn.click();

        await expect(c1).not.toHaveClass(/pr-comment-placeholder/);
        await expect(c2).not.toHaveClass(/pr-comment-placeholder/);

        await expect(c1.locator('> .pr-comment-body')).toContainText('Root');
        await expect(c2.locator('> .pr-comment-body')).toContainText('Middle');
    });
});
