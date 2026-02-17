import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Header Injection [PR-INJECT-01]', () => {
    test('should inject Power Reader link into forum header', async ({ page }) => {
        await page.route('https://forum.effectivealtruism.org/', async route => {
            await route.fulfill({
                contentType: 'text/html',
                body: `
                    <html>
                        <head></head>
                        <body>
                            <div class="Header-rightHeaderItems">
                                <div class="SearchBar-root">Search</div>
                            </div>
                            <div id="app">Site Content</div>
                        </body>
                    </html>
                `
            });
        });

        const scriptPath = path.join(__dirname, '../dist/power-reader.user.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');

        await page.goto('https://forum.effectivealtruism.org/');

        // Mock GM_addStyle and other GM stuff
        await page.evaluate(() => {
            (window as any).GM_addStyle = (css: string) => {
                const style = document.createElement('style');
                style.textContent = css;
                document.head.appendChild(style);
            };
            (window as any).GM_getValue = () => null;
            (window as any).GM_setValue = () => { };
            (window as any).GM_log = () => { };
        });

        await page.evaluate(scriptContent);

        // Wait for injection
        const link = page.locator('#pr-reader-link');
        await expect(link).toBeVisible({ timeout: 10000 });
        await expect(link).toContainText(/Power\s+Reader/);
        await expect(link).toHaveAttribute('href', '/reader');
    });

    test('[PR-INJECT-02][PR-INJECT-03] should inject User Archive link on profile pages', async ({ page }) => {
        const username = 'wei-dai';

        await page.route(`https://www.lesswrong.com/users/${username}`, async route => {
            await route.fulfill({
                contentType: 'text/html',
                body: `
                    <html>
                        <head></head>
                        <body>
                            <div class="Header-rightHeaderItems">
                                <div class="SearchBar-root">Search</div>
                            </div>
                            <div id="app">Profile Content</div>
                        </body>
                    </html>
                `
            });
        });

        const scriptPath = path.join(__dirname, '../dist/power-reader.user.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');

        await page.goto(`https://www.lesswrong.com/users/${username}`);

        // Mock GM APIs
        await page.evaluate(() => {
            (window as any).GM_addStyle = (css: string) => {
                const style = document.createElement('style');
                style.textContent = css;
                document.head.appendChild(style);
            };
            (window as any).GM_getValue = () => null;
            (window as any).GM_setValue = () => { };
            (window as any).GM_log = () => { };
        });

        await page.evaluate(scriptContent);

        // Verify both links are injected
        const readerLink = page.locator('#pr-reader-link');
        const archiveLink = page.locator('#pr-archive-link');

        await expect(readerLink).toBeVisible({ timeout: 5000 });
        await expect(archiveLink).toBeVisible({ timeout: 5000 });

        await expect(readerLink).toHaveAttribute('href', '/reader');
        await expect(archiveLink).toHaveAttribute('href', `/reader?view=archive&username=${username}`);

        // Verify shared container [PR-INJECT-03]
        const container = page.locator('#pr-header-links-container');
        await expect(container).toBeVisible();
    });

    test('[PR-INJECT-04] should not inject Archive link on non-profile pages', async ({ page }) => {
        await page.route('https://www.lesswrong.com/', async route => {
            await route.fulfill({
                contentType: 'text/html',
                body: `
                    <html>
                        <head></head>
                        <body>
                            <div class="Header-rightHeaderItems">
                                <div class="SearchBar-root">Search</div>
                            </div>
                            <div id="app">Homepage Content</div>
                        </body>
                    </html>
                `
            });
        });

        const scriptPath = path.join(__dirname, '../dist/power-reader.user.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');

        await page.goto('https://www.lesswrong.com/');

        // Mock GM APIs
        await page.evaluate(() => {
            (window as any).GM_addStyle = () => { };
            (window as any).GM_getValue = () => null;
            (window as any).GM_setValue = () => { };
            (window as any).GM_log = () => { };
        });

        await page.evaluate(scriptContent);

        // Verify only Reader link exists
        const readerLink = page.locator('#pr-reader-link');
        const archiveLink = page.locator('#pr-archive-link');

        await expect(readerLink).toBeVisible({ timeout: 5000 });
        await expect(archiveLink).not.toBeVisible();
    });

    test('supports /users/id/slug URL format', async ({ page }) => {
        const userId = 'user-id-12345';
        const slug = 'john-doe';

        await page.route(`https://www.lesswrong.com/users/${userId}/${slug}`, async route => {
            await route.fulfill({
                contentType: 'text/html',
                body: `
                    <html>
                        <head></head>
                        <body>
                            <div class="Header-rightHeaderItems">
                                <div class="SearchBar-root">Search</div>
                            </div>
                        </body>
                    </html>
                `
            });
        });

        const scriptPath = path.join(__dirname, '../dist/power-reader.user.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');

        await page.goto(`https://www.lesswrong.com/users/${userId}/${slug}`);

        // Mock GM APIs
        await page.evaluate(() => {
            (window as any).GM_addStyle = () => { };
            (window as any).GM_getValue = () => null;
            (window as any).GM_setValue = () => { };
            (window as any).GM_log = () => { };
        });

        await page.evaluate(scriptContent);

        // Verify Archive link uses slug as username
        const archiveLink = page.locator('#pr-archive-link');
        await expect(archiveLink).toBeVisible({ timeout: 5000 });
        await expect(archiveLink).toHaveAttribute('href', `/reader?view=archive&username=${slug}`);
    });
});
