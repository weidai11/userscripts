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
});
