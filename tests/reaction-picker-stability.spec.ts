import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test('Reaction picker stays open after clicking the + button', async ({ page }) => {
    await initPowerReader(page, {
        testMode: true,
        comments: [{
            _id: 'c1', postId: 'p1',
            htmlBody: '<p>Body</p>',
            postedAt: '2024-01-01T00:00:00.000Z',
            baseScore: 10,
            user: { _id: 'a1', username: 'AuthorName', karma: 100 },
            post: { _id: 'p1', title: 'Post', slug: 'post' }
        }]
    });

    // Find the "+" button
    const openPickerBtn = page.locator('.pr-add-reaction-btn').first();
    await expect(openPickerBtn).toBeVisible();

    // Click it
    await openPickerBtn.click();

    // The picker should appear
    const picker = page.locator('#pr-global-reaction-picker');
    await expect(picker).toBeVisible();
    await expect(picker).toHaveClass(/visible/);

    // Ensure it stays visible for a short stability window.
    const visibleSince = Date.now();
    await expect.poll(async () => {
        const isVisible = await picker.isVisible();
        if (!isVisible) return -1;
        return Date.now() - visibleSince;
    }, { timeout: 1500 }).toBeGreaterThanOrEqual(500);

    // Click elsewhere (e.g. on the post header)
    await page.click('.pr-header h1');

    // It should disappear
    await expect(picker).not.toBeVisible();
});
