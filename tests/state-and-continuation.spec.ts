import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader State and Continuation', () => {

    test('[PR-URL-05] Reset State button exists and triggers confirmation', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            verbose: true,
            storage: {
                'power-reader-read-from': '2023-12-31T00:00:00.000Z',
                'power-reader-read': '{}'
            }
        });

        const resetBtn = page.locator('#pr-reset-state-btn');
        await expect(resetBtn).toBeVisible();
        await expect(resetBtn).toHaveText('Reset State');

        // Mock confirm
        let confirmed = false;
        page.on('dialog', async dialog => {
            confirmed = true;
            expect(dialog.message()).toContain('Are you sure you want to reset all state');
            await dialog.dismiss();
        });

        await resetBtn.click();
        expect(confirmed).toBe(true);
    });

    test('[PR-SETUP-01] Empty comments state shows retry buttons', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            verbose: true,
            appDebugMode: true,
            appVerbose: true,
            comments: [],
            posts: [],
            onMutation: `
                if (query.includes('GetAllRecentComments')) {
                    return { data: { comments: { results: [] } } };
                }
            `
        });

        const info = page.locator('.pr-info');
        await expect(info).toBeVisible({ timeout: 10000 });
        await expect(info).toHaveText(/No content found/);

        const checkBtn = page.locator('#pr-check-now-btn');
        const changeBtn = page.locator('#pr-change-date-btn');

        await expect(checkBtn).toBeVisible();
        await expect(checkBtn).toHaveText('Check Server Again');
        await expect(changeBtn).toBeVisible();
        await expect(changeBtn).toHaveText('Change Starting Date');
    });

    test('[PR-LOAD-09] Bottom message appears and checks server for more comments (none found)', async ({ page }) => {
        const comments = [{
            _id: 'c1', postId: 'p1',
            htmlBody: '<p>Body</p>',
            postedAt: '2024-01-01T00:00:00.000Z',
            baseScore: 10,
            user: { _id: 'a1', username: 'Author', karma: 100 },
            post: { _id: 'p1', title: 'Post' }
        }];

        await initPowerReader(page, {
            testMode: true,
            verbose: true,
            appDebugMode: true,
            appVerbose: true,
            comments,
            posts: [{
                _id: 'p1',
                title: 'Post',
                htmlBody: '<p>Post body</p>',
                postedAt: '2024-01-01T00:00:00.000Z',
                user: { _id: 'a1', username: 'Author' }
            }],
            onMutation: `
                if (query.includes('GetAllRecentComments')) {
                    // Return the injected comments for initial load
                    if (!variables.after) {
                         return { data: { comments: { results: ${JSON.stringify(comments)} } } };
                    }
                    // Return empty for subsequent checks
                    return { data: { comments: { results: [] } } };
                }
            `
        });

        await page.evaluate(() => {
            const root = document.getElementById('power-reader-root') || document.body;
            const spacer = document.createElement('div');
            spacer.id = 'pr-test-spacer';
            spacer.style.height = '3000px';
            root.appendChild(spacer);
            window.scrollTo(0, document.body.scrollHeight);
            window.dispatchEvent(new Event('scroll'));
        });

        const bottomMsg = page.locator('#pr-bottom-message');
        await expect(bottomMsg).toBeVisible({ timeout: 15000 });
        await expect(bottomMsg).toHaveText(/No more comments on server/);
    });

    test('[PR-LOAD-09] Bottom message countdown decrements and triggers auto-recheck', async ({ page }) => {
        const comments = [{
            _id: 'c1', postId: 'p1',
            htmlBody: '<p>Body</p>',
            postedAt: '2024-01-01T00:00:00.000Z',
            baseScore: 10,
            user: { _id: 'a1', username: 'Author', karma: 100 },
            post: { _id: 'p1', title: 'Post' }
        }];

        await initPowerReader(page, {
            testMode: true,
            verbose: true,
            appDebugMode: true,
            appVerbose: true,
            comments,
            posts: [{
                _id: 'p1', title: 'Post'
            }],
            onMutation: `
                if (query.includes('GetAllRecentComments')) {
                    if (!variables.after) return { data: { comments: { results: ${JSON.stringify(comments)} } } };
                    return { data: { comments: { results: [] } } };
                }
            `
        });

        await page.evaluate(() => {
            const root = document.getElementById('power-reader-root') || document.body;
            const spacer = document.createElement('div');
            spacer.id = 'pr-test-spacer';
            spacer.style.height = '3000px';
            root.appendChild(spacer);
            window.scrollTo(0, document.body.scrollHeight);
            window.dispatchEvent(new Event('scroll'));
        });

        const bottomMsg = page.locator('#pr-bottom-message');
        await expect(bottomMsg).toBeVisible({ timeout: 15000 });
        await expect(bottomMsg).toHaveText(/Waiting [5-6][0-9]s for next check/);

        // Wait a bit more for decrement
        await page.waitForTimeout(1500);

        const text = await bottomMsg.textContent();
        const count = parseInt(text?.match(/Waiting (\d+)s/)?.[1] || '0');
        expect(count).toBeLessThanOrEqual(59);
    });

    test('[PR-LOAD-09][PR-LOAD-11] Bottom message shows "New comments available" when server has more', async ({ page }) => {
        const comments = [{
            _id: 'c1', postId: 'p1',
            htmlBody: '<p>Body</p>',
            postedAt: '2024-01-01T00:00:00.000Z',
            baseScore: 10,
            user: { _id: 'a1', username: 'Author', karma: 100 },
            post: { _id: 'p1', title: 'Post' }
        }];

        await initPowerReader(page, {
            testMode: true,
            verbose: true,
            appDebugMode: true,
            appVerbose: true,
            comments,
            posts: [{ _id: 'p1', title: 'Post' }],
            onMutation: `
                if (query.includes('GetAllRecentComments')) {
                    if (!variables.after) return { data: { comments: { results: ${JSON.stringify(comments)} } } };
                    if (variables.limit === 1) {
                        return { data: { comments: { results: [{_id: 'c_new'}] } } };
                    }
                    return { data: { comments: { results: [] } } };
                }
            `
        });

        await page.evaluate(() => {
            const root = document.getElementById('power-reader-root') || document.body;
            const spacer = document.createElement('div');
            spacer.id = 'pr-test-spacer';
            spacer.style.height = '3000px';
            root.appendChild(spacer);
            window.scrollTo(0, document.body.scrollHeight);
            window.dispatchEvent(new Event('scroll'));
        });

        const bottomMsg = page.locator('#pr-bottom-message');
        await expect(bottomMsg).toBeVisible({ timeout: 15000 });
        await expect(bottomMsg).toHaveText(/New comments available/);
        await expect(bottomMsg).toHaveClass(/has-more/);
    });

    test('[PR-READ-03] Session advances and increments date by 1ms when at bottom', async ({ page }) => {
        const consoleMsgs: string[] = [];
        page.on('console', msg => consoleMsgs.push(msg.text()));

        const comments = [{
            _id: 'c1', postId: 'p1',
            htmlBody: '<p>Body</p>',
            postedAt: '2024-01-01T00:00:00.000Z',
            baseScore: 10,
            user: { _id: 'a1', username: 'Author', karma: 100 },
            post: { _id: 'p1', title: 'Post' }
        }];

        await initPowerReader(page, {
            testMode: true,
            verbose: true,
            appDebugMode: true,
            appVerbose: true,
            storage: {
                'power-reader-read-from': '2023-12-31T00:00:00.000Z'
            },
            comments,
            posts: [{ _id: 'p1', title: 'Post' }],
            onMutation: `
                if (query.includes('GetAllRecentComments')) {
                    if (!variables.after || variables.after === '2023-12-31T00:00:00.000Z') {
                         return { data: { comments: { results: ${JSON.stringify(comments)} } } };
                    }
                    return { data: { comments: { results: [] } } };
                }
            `
        });

        await page.evaluate(() => {
            const root = document.getElementById('power-reader-root') || document.body;
            const spacer = document.createElement('div');
            spacer.id = 'pr-test-spacer';
            spacer.style.height = '3000px';
            root.appendChild(spacer);
            window.scrollTo(0, document.body.scrollHeight);
            window.dispatchEvent(new Event('scroll'));
        });

        await expect.poll(() =>
            consoleMsgs.some(m => m.includes('Advancing session start to'))
            , { timeout: 15000 }).toBe(true);

        const advMsg = consoleMsgs.find(m => m.includes('Advancing session start to'))!;
        expect(advMsg).toContain('2024-01-01T00:00:00.001Z');
    });

    test('[PR-READ-05] Loads most recent comments when start date is left blank', async ({ page }) => {
        const consoleMsgs: string[] = [];
        page.on('console', msg => consoleMsgs.push(msg.text()));

        await initPowerReader(page, {
            testMode: true,
            verbose: true,
            appDebugMode: true,
            appVerbose: true,
            skipStorageDefaults: true,
            // storage: { 'power-reader-read-from': null }, // DONT pass this, let it be undefined
            comments: [],
            posts: [],
            onMutation: `
                if (query.includes('GetAllRecentComments')) {
                    return { data: { comments: { results: [] } } };
                }
            `
        });

        await expect(page.locator('.pr-setup')).toBeVisible({ timeout: 10000 });
        await page.click('#startReading');

        await expect.poll(() =>
            consoleMsgs.some(m => m.includes('GetAllRecentComments') && m.includes('"sortBy":"newest"'))
            , { timeout: 15000 }).toBe(true);
    });
});
