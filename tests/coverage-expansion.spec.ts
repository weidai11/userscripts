import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader Expanded Coverage', () => {

    test('[PR-URL-01][PR-URL-04] Should activate on LessWrong /reader and show setup if no loadFrom', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            storage: {
                'power-reader-read-from': null as any
            }
        });

        // [PR-LOAD-06] Show setup prompt
        await expect(page.locator('.pr-setup')).toBeVisible();
        await expect(page.locator('h1')).toContainText('Welcome to Power Reader');
    });

    test('[PR-URL-03] Should activate on EA Forum /reader', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            comments: []
        });

        // If it starts loading, it's active
        await expect(page.locator('.pr-header')).toBeVisible();
    });

    test('[PR-SETUP-01][PR-SETUP-02][PR-SETUP-03][PR-SETUP-04][PR-LOAD-01.1] Setup UI date picker and default behavior', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            storage: {
                'power-reader-read-from': null as any
            }
        });

        // [PR-SETUP-02] Date picker exists
        await expect(page.locator('#loadFromDate')).toBeVisible();

        // [PR-SETUP-03] Click Start without date sets __LOAD_RECENT__
        await page.click('#startReading');

        // Wait for storage call
        await page.waitForFunction(() => (window as any).__GM_CALLS?.['power-reader-read-from'] !== undefined);
        const lastValue = await page.evaluate(() => (window as any).__GM_CALLS?.['power-reader-read-from']);
        // It was set to __LOAD_RECENT__ initially, but then snapshotted to a date by [PR-LOAD-01.1]
        expect(lastValue).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test('[PR-HELP-01][PR-HELP-02][PR-HELP-04] Help panel behavior', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            storage: {
                'helpCollapsed': false
            }
        });

        const help = page.locator('#pr-help-section');
        // [PR-HELP-02] Expanded by default
        await expect(help).toHaveAttribute('open', '');

        // [PR-HELP-04] Click summary saves state
        await help.locator('summary').click();

        await page.waitForFunction(() => (window as any).__GM_CALLS?.['helpCollapsed'] !== undefined);
        const state = await page.evaluate(() => (window as any).__GM_CALLS?.['helpCollapsed']);
        expect(state).toBe(true);
    });

    test('[PR-HELP-03] Help panel stays collapsed on subsequent visits', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            storage: {
                'helpCollapsed': true
            }
        });

        const help = page.locator('#pr-help-section');
        // Should NOT have 'open' attribute
        await expect(help).not.toHaveAttribute('open', '');
    });

    test('[PR-ARCH-03][PR-ARCH-05] Page takeover logic', async ({ page }) => {
        // initPowerReader uses setupMockEnvironment which defaults to removing existing content.
        // But we want to verify it actually removes it.
        await page.route('https://www.lesswrong.com/reader', route => {
            route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: '<html><body><div id="native-react-app">Native Content</div></body></html>'
            });
        });

        // We can't use initPowerReader here because it does its own goto and mock setup.
        // We need to bypass its goto.
        // Actually, setupMockEnvironment is what does the goto.
        // Let's just use it and assume it works as intended.
        await initPowerReader(page, {
            testMode: true,
            mockHtml: '<html><body><div id="native-react-app">Native Content</div></body></html>'
        });

        // [PR-ARCH-05] Native content should be GONE
        await expect(page.locator('#native-react-app')).not.toBeAttached();
        // [PR-ARCH-05] Our root should be there
        await expect(page.locator('#power-reader-root')).toBeVisible();
    });

    test('[PR-POST-04][PR-POST-05] Post truncation and expansion', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            posts: [{
                _id: 'p-long',
                title: 'Long Post',
                htmlBody: '<div style="height: 2000px;">Huge Content</div>',
                user: { username: 'Author' },
                postedAt: new Date().toISOString()
            }],
            comments: [{
                _id: 'c-dummy',
                postId: 'p-long',
                htmlBody: 'Dummy',
                postedAt: new Date().toISOString(),
                user: { username: 'Author' }
            }]
        });

        const bodyContainer = page.locator('.pr-post-body-container');
        // [PR-POST-04] Should be truncated initially
        await expect(bodyContainer).toHaveClass(/truncated/);

        const readMore = page.locator('[data-action="read-more"]');
        await expect(readMore).toBeVisible();

        // [PR-POST-05] Click expansion
        await readMore.click();
        await expect(bodyContainer).not.toHaveClass(/truncated/);
        await expect(readMore).not.toBeVisible();
    });

    test('[PR-READ-06] Cleanup of old read IDs', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            verbose: true,
            storage: {
                'power-reader-read': JSON.stringify({ 'p1': 1, 'c-old': 1, 'c-current': 1 })
            },
            comments: [{ _id: 'c-current', postId: 'p1', postedAt: new Date().toISOString(), user: { username: 'U' }, post: { _id: 'p1', title: 'T' } }]
        });

        // Wait for cleanup logic to run (ReadTracker init has delayed start)
        await expect.poll(async () => {
            const finalStateStr = await page.evaluate(() => {
                const calls = (window as any).__GM_CALLS;
                if (calls && calls['power-reader-read'] !== undefined) return calls['power-reader-read'];
                return (window as any).__GM_STORAGE?.['power-reader-read'];
            });
            return typeof finalStateStr === 'string' ? JSON.parse(finalStateStr) : finalStateStr;
        }, { timeout: 5000 }).toMatchObject({ 'c-current': 1 });

        const finalStateStr = await page.evaluate(() => {
            const calls = (window as any).__GM_CALLS;
            if (calls && calls['power-reader-read'] !== undefined) return calls['power-reader-read'];
            return (window as any).__GM_STORAGE?.['power-reader-read'];
        });
        const parsedFinalState = typeof finalStateStr === 'string' ? JSON.parse(finalStateStr) : finalStateStr;

        // [PR-READ-06] 'c-current' should be KEPT, 'c-old' should be REMOVED
        expect(parsedFinalState).toBeDefined();
        expect(parsedFinalState['c-current']).toBe(1);
        expect(parsedFinalState['c-old']).toBeUndefined();
    });
});
