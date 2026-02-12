import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader Reaction Coverage', () => {

    test('[PR-REACT-05] Reaction search functionality', async ({ page }) => {
        const reactions = [
            { name: 'agree', label: 'Agreed', svg: '' },
            { name: 'insightful', label: 'Insightful', svg: '' },
            { name: 'thinking', label: 'Thinking', svg: '' }
        ];

        await initPowerReader(page, {
            testMode: true,
            scrapedReactions: reactions,
            comments: [{
                _id: 'c1', postId: 'p1', postedAt: new Date().toISOString(),
                htmlBody: 'Test', user: { username: 'U' }, post: { _id: 'p1', title: 'T' }
            }]
        });

        // Open picker
        await page.click('.pr-add-reaction-btn');
        const picker = page.locator('#pr-global-reaction-picker');
        await expect(picker).toBeVisible();

        // [PR-REACT-05] Initially all show
        // Count depends on bootstrap + mock. Setup.ts DEFAULT_SCRAPED_REACTIONS is ~18.
        // Mock adds 3 but the script always merges with bootstrap.
        // The picker shows 18(primary) + 18(B) + 18(C) + 9(likelihoods) = 63 items.
        await expect(picker.locator('.pr-reaction-picker-item')).toHaveCount(63);

        // Search for 'thinking'
        const searchInput = picker.locator('.pr-picker-search input');
        await searchInput.fill('thinking');

        // Only 'thinking' should show
        const visibleItems = picker.locator('.pr-reaction-picker-item:visible');
        const count = await visibleItems.count();
        expect(count).toBe(1);

        const name = await visibleItems.first().getAttribute('data-reaction-name');
        expect(name).toBe('thinking');
    });

    test('[PR-REACT-07] Inline reaction trigger', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            comments: [{
                _id: 'c1', postId: 'p1', postedAt: new Date().toISOString(),
                htmlBody: '<p id="test-text">React to this part of the comment.</p>',
                user: { username: 'U' }, post: { _id: 'p1', title: 'T' }
            }]
        });

        await page.waitForSelector('#test-text');

        // Simulate text selection
        await page.evaluate(() => {
            const el = document.getElementById('test-text');
            const range = document.createRange();
            range.selectNodeContents(el!);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
            // Dispatch mouseup to trigger our listener
            document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        });

        // [PR-REACT-07] Floating button should appear
        const floatBtn = page.locator('#pr-inline-react-btn');
        await expect(floatBtn).toBeVisible();

        // Click float btn should open picker
        await floatBtn.click();
        await expect(page.locator('#pr-global-reaction-picker')).toBeVisible();
    });
});
