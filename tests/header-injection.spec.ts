import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Header Injection [PR-INJECT-01]', () => {
    test('should inject POWER Reader link into forum header', async ({ page }) => {
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
            (window as any).GM_addStyle = () => { };
            (window as any).GM_getValue = () => null;
            (window as any).GM_setValue = () => { };
            (window as any).GM_log = () => { };
        });

        await page.evaluate(scriptContent);

        // Wait for injection
        const link = page.locator('#pr-header-link');
        await expect(link).toBeVisible({ timeout: 10000 });
        await expect(link).toContainText(/POWER\s+Reader/);
        await expect(link).toHaveAttribute('href', '/reader');
    });
});
