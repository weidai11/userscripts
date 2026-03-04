import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader Author Preferences', () => {

    test('[PR-AUTH-01][PR-AUTH-02][PR-AUTH-06][PR-AUTH-07] toggling favor/disfavor persists and updates UI', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            storage: {
                'power-reader-author-prefs': '{}'
            },
            comments: [{
                _id: 'c1',
                postId: 'p1',
                htmlBody: 'Test',
                postedAt: new Date().toISOString(),
                user: { _id: 'u1', username: 'TestAuthor', slug: 'test-author' },
                post: { _id: 'p1', title: 'Post' }
            }]
        });

        const upBtn = page.locator('.pr-comment').first().locator('span[data-action="author-up"]');
        const downBtn = page.locator('.pr-comment').first().locator('span[data-action="author-down"]');

        // Initial state
        await expect(upBtn).toBeVisible();
        await expect(downBtn).toBeVisible();
        await expect(upBtn).not.toHaveClass(/active/);

        // Click Favor
        await upBtn.click();
        await expect(upBtn).toHaveClass(/active-up/);

        // Verify storage via __GM_CALLS
        const prefsStr = await page.evaluate(() => (window as any).__GM_CALLS?.['power-reader-author-prefs']);
        const prefs = typeof prefsStr === 'string' ? JSON.parse(prefsStr) : prefsStr;
        expect(prefs['TestAuthor']).toBe(1);

        // Click Disfavor
        await downBtn.click();
        await expect(downBtn).toHaveClass(/active-down/);
        await expect(upBtn).not.toHaveClass(/active-up/); // Should toggle off up

        // Verify storage flip
        const prefs2Str = await page.evaluate(() => (window as any).__GM_CALLS?.['power-reader-author-prefs']);
        const prefs2 = typeof prefs2Str === 'string' ? JSON.parse(prefs2Str) : prefs2Str;
        expect(prefs2['TestAuthor']).toBe(-1);
    });

    test('author toggle works on read comments even if container author dataset is missing', async ({ page }) => {
        const now = new Date().toISOString();
        await initPowerReader(page, {
            testMode: true,
            storage: {
                'power-reader-author-prefs': '{}',
                'power-reader-read': { c1: 1 }
            },
            comments: [
                {
                    _id: 'c1',
                    postId: 'p1',
                    htmlBody: 'Read parent',
                    postedAt: now,
                    user: { _id: 'u1', username: 'ReadAuthor', slug: 'read-author' },
                    post: { _id: 'p1', title: 'Post' }
                },
                {
                    _id: 'c2',
                    postId: 'p1',
                    parentCommentId: 'c1',
                    topLevelCommentId: 'c1',
                    htmlBody: 'Unread child 1',
                    postedAt: now,
                    user: { _id: 'u2', username: 'ChildOne', slug: 'child-one' },
                    post: { _id: 'p1', title: 'Post' }
                },
                {
                    _id: 'c3',
                    postId: 'p1',
                    parentCommentId: 'c1',
                    topLevelCommentId: 'c1',
                    htmlBody: 'Unread child 2',
                    postedAt: now,
                    user: { _id: 'u3', username: 'ChildTwo', slug: 'child-two' },
                    post: { _id: 'p1', title: 'Post' }
                }
            ]
        });

        const parentComment = page.locator('.pr-comment[data-id="c1"]');
        await expect(parentComment).toHaveClass(/read/);

        // Simulate render paths where the container misses data-author.
        await page.locator('.pr-comment[data-id="c1"]').evaluate((el) => {
            el.removeAttribute('data-author');
        });

        const initialUrl = page.url();
        let navigated = false;
        page.once('framenavigated', () => {
            navigated = true;
        });

        const upBtn = page.locator('.pr-comment[data-id="c1"] > .pr-comment-meta .pr-author-up');
        await upBtn.click();
        await page.waitForTimeout(300);

        const prefsStr = await page.evaluate(() => (window as any).__GM_CALLS?.['power-reader-author-prefs']);
        const prefs = typeof prefsStr === 'string' ? JSON.parse(prefsStr) : prefsStr;
        expect(prefs['ReadAuthor']).toBe(1);
        expect(page.url()).toBe(initialUrl);
        expect(navigated).toBe(false);
    });

    test('favoring a visible comment after it was marked read does not collapse it away', async ({ page }) => {
        const now = new Date().toISOString();
        await initPowerReader(page, {
            testMode: true,
            storage: {
                'power-reader-author-prefs': '{}',
                'power-reader-read': {}
            },
            comments: [
                {
                    _id: 'c1',
                    postId: 'p1',
                    htmlBody: 'This should stay visible after favor',
                    postedAt: now,
                    user: { _id: 'u1', username: 'ReadAfterScrollAuthor', slug: 'read-after-scroll-author' },
                    post: { _id: 'p1', title: 'Post' }
                }
            ]
        });

        const comment = page.locator('.pr-comment[data-id="c1"]');
        await expect(comment).toBeVisible();
        await expect(comment.locator('.pr-comment-body')).toContainText('This should stay visible');

        // Simulate the "scrolled to bottom, item got marked read" state where DOM is still visible.
        await page.evaluate(() => {
            const readKey = 'power-reader-read';
            const raw = (window as any).GM_getValue(readKey, '{}');
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            parsed.c1 = 1;
            (window as any).GM_setValue(readKey, JSON.stringify(parsed));
            document.querySelector('.pr-comment[data-id="c1"]')?.classList.add('read');
        });

        const upBtn = page.locator('.pr-comment[data-id="c1"] > .pr-comment-meta .pr-author-up');
        await upBtn.click();

        // Regression: previously this interaction could rerender and collapse the clicked comment
        // into a placeholder (or remove it from visible tree) immediately.
        await expect(page.locator('.pr-comment[data-id="c1"]')).toBeVisible();
        await expect(page.locator('.pr-comment[data-id="c1"]')).not.toHaveClass(/pr-comment-placeholder/);
        await expect(page.locator('.pr-comment[data-id="c1"] > .pr-comment-body')).toContainText('This should stay visible');
    });
});
