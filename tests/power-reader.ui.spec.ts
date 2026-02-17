import { test, expect } from '@playwright/test';
import { PowerReaderPage } from './pages/PowerReaderPage';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader UI Interactions', () => {

    test('[PR-REACT-03][PR-REACT-04] Reaction Picker should toggle between Grid and List view', async ({ page }) => {
        await initPowerReader(page, {
            storage: { pickerViewMode: 'grid' }
        });

        // 1. Open picker
        await page.click('[data-action="open-picker"]');
        const picker = page.locator('#pr-global-reaction-picker');
        await expect(picker).toBeVisible();

        // 2. Verify initial mode (grid)
        await expect(picker.locator('.pr-reaction-picker-grid').first()).toBeVisible();

        // 3. Toggle to List view
        await page.click('.pr-picker-view-toggle');

        // 4. Verify List view elements
        await expect(picker.locator('.pr-reaction-list-item')).not.toHaveCount(0);
        const changemind = picker.locator('.pr-reaction-list-item[data-reaction-name="changemind"]');
        await expect(changemind).toBeVisible();

        // 5. Toggle back to Grid
        await page.click('.pr-picker-view-toggle');
        await expect(picker.locator('.pr-reaction-picker-grid').first()).toBeVisible();
    });

    test('[PR-NAV-07] Parent Navigation should scroll to and highlight parent', async ({ page }) => {
        await initPowerReader(page, {
            comments: [
                {
                    _id: 'c1', postId: 'p1', htmlBody: '<p>Parent</p>',
                    postedAt: new Date(Date.now() - 100000).toISOString(),
                    baseScore: 10, user: { username: 'User1' }, post: { _id: 'p1', title: 'P' }
                },
                {
                    _id: 'c2', postId: 'p1', htmlBody: '<p>Reply</p>',
                    postedAt: new Date().toISOString(),
                    baseScore: 5, parentCommentId: 'c1',
                    user: { username: 'User2' }, post: { _id: 'p1', title: 'P' }
                }
            ]
        });

        const replyComment = page.locator('.pr-comment[data-id="c2"]');
        const parentComment = page.locator('.pr-comment[data-id="c1"]');

        await expect(replyComment).toBeVisible();
        await expect(parentComment).toBeVisible();

        const findBtn = replyComment.locator('[data-action="find-parent"]');
        await expect(findBtn).toBeVisible();
        await findBtn.click({ force: true });

        await expect(parentComment).toHaveClass(/highlight-parent/);
        await expect(parentComment).not.toHaveClass(/highlight-parent/, { timeout: 5000 });
    });

    test('[PR-READ-04] Read State should mark as read after 5s off-screen', async ({ page }) => {
        // We use testMode: false here because we specifically want to test the 5s delay
        await initPowerReader(page, { testMode: false });

        await page.evaluate(() => {
            document.body.style.minHeight = '5000px';
            window.scrollTo(0, 2000);
            window.dispatchEvent(new Event('scroll'));
        });

        await expect.poll(async () => {
            const readStateStr = await page.evaluate(() => (window as any).GM_getValue('power-reader-read', '{}'));
            const readState = JSON.parse(readStateStr);
            return readState['c1'] ? 1 : 0;
        }, { timeout: 8000 }).toBe(1);
    });

    test('[PR-NEST-01][PR-NEST-02] Clicking post title should toggle body visibility', async ({ page }) => {
        await initPowerReader(page, { testMode: true });
        const postBody = page.locator('.pr-post-body-container').first();

        await expect(postBody).toBeVisible();
        await page.locator('.pr-post-toggle[data-action="collapse"]').first().click();
        await expect(postBody).not.toBeVisible();
        await page.locator('.pr-post-toggle[data-action="expand"]').first().click();
        await expect(postBody).toBeVisible();
    });

    test('[PR-NEST-03] Hover over [+] to preview collapsed comment', async ({ page }) => {
        const comments = [
            {
                _id: 'c-collapsed', postId: 'p1',
                htmlBody: '<p>Hidden low karma content</p>',
                postedAt: new Date().toISOString(),
                baseScore: -150, // Very low score triggers auto-hide even with recent date
                user: { _id: 'u1', username: 'User1', karma: 0 },
                post: { _id: 'p1', title: 'Post 1', user: { username: 'A' } }
            }
        ];

        await initPowerReader(page, { testMode: true, comments });

        const comment = page.locator('.pr-comment[data-id="c-collapsed"]');
        await expect(comment).toBeAttached();

        // Ensure collapsed class is present due to auto-hide score
        await expect(comment).toHaveClass(/collapsed/);

        const expandBtn = comment.locator('.pr-expand').first();
        await expect(expandBtn).toBeVisible({ timeout: 10000 });

        await expandBtn.hover();
        await expandBtn.dispatchEvent('mouseenter');

        const preview = page.locator('.pr-preview-overlay');
        await expect(preview).toBeVisible({ timeout: 10000 });
        await expect(preview).toContainText('Hidden low karma content');
    });
});
