
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scriptPath = path.resolve(__dirname, '../dist/power-reader.user.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

test.describe('Power Reader Architecture', () => {

    test.beforeEach(async ({ page }) => {
        // Global blocker for LW/EA requests
        await page.route('**/*', route => {
            const url = route.request().url();
            if (url.includes('lesswrong.com') || url.includes('effectivealtruism.org')) {
                if (url.endsWith('/reader')) return route.continue();
                console.warn(`[BLOCKER] Aborting un-mocked request: ${url}`);
                route.abort();
            } else {
                route.continue();
            }
        });
    });

    test('[PR-ARCH-01][PR-ARCH-02][PR-ARCH-03] Takeover halts site processing', async ({ page }) => {
        // [PR-ARCH-02] Run at document-start is handled by Playwright evaluate on new document or similar
        // but here we test the effects of takeover

        await page.route('https://www.lesswrong.com/reader', route => {
            route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: '<html><body><div id="app">Native app</div><script>window.siteLoaded = true;</script></body></html>'
            });
        });

        await page.addInitScript(() => {
            (window as any).GM_getValue = () => '__LOAD_RECENT__';
            (window as any).GM_xmlhttpRequest = (o: any) => o.onload({ responseText: JSON.stringify({ data: {} }) });
        });

        await page.goto('https://www.lesswrong.com/reader');

        // Inject script
        await page.evaluate(scriptContent);

        // [PR-ARCH-03] window.stop() is harder to verify but page content should be our UI
        await expect(page.locator('#power-reader-root')).toBeVisible();
        await expect(page.locator('#app')).not.toBeAttached();
    });

    test('[PR-ARCH-04] Takeover blocks dynamically added scripts', async ({ page }) => {
        await page.route('https://www.lesswrong.com/reader', route => {
            route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' });
        });

        await page.addInitScript(() => {
            (window as any).GM_getValue = () => '__LOAD_RECENT__';
            (window as any).GM_xmlhttpRequest = (o: any) => o.onload({ responseText: JSON.stringify({ data: {} }) });
        });

        await page.goto('https://www.lesswrong.com/reader');
        await page.evaluate(scriptContent);

        // Try to add a script
        const scriptExecutionAttempted = await page.evaluate(() => {
            const s = document.createElement('script');
            s.textContent = 'window.HACKED = true;';
            document.body.appendChild(s);
            return (window as any).HACKED === true;
        });

        // [PR-ARCH-04] Script should be removed before execution or at least blocked
        expect(scriptExecutionAttempted).toBe(false);

        const scriptPresent = await page.evaluate(() => !!document.querySelector('script'));
        // Our userscript injects NO scripts into the final body usually, just clears them.
        expect(scriptPresent).toBe(false);
    });

    test('[PR-ARCH-06] Protection observer re-injects if cleared', async ({ page }) => {
        await page.route('https://www.lesswrong.com/reader', route => {
            route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' });
        });

        await page.addInitScript(() => {
            (window as any).GM_getValue = () => '__LOAD_RECENT__';
            (window as any).GM_xmlhttpRequest = (o: any) => o.onload({ responseText: JSON.stringify({ data: {} }) });
        });

        await page.goto('https://www.lesswrong.com/reader');
        await page.evaluate(scriptContent);
        await page.waitForSelector('#power-reader-root');

        // Manually clear the body content (simulating site code)
        await page.evaluate(() => {
            document.body.innerHTML = '<div>Native Cleared Everything</div>';
        });

        // [PR-ARCH-06] Observer should detect and re-inject
        await expect(page.locator('#power-reader-root')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('div:text("Native Cleared Everything")')).not.toBeAttached();
    });

    test('[PR-TECH-01][PR-SYNC-03][PR-PERSIST-80] Built userscript contains required metadata block', async () => {
        const scriptPath = path.resolve(__dirname, '../dist/power-reader.user.js');
        const content = fs.readFileSync(scriptPath, 'utf8');

        // Check for the standard block structure
        expect(content).toContain('// ==UserScript==');
        expect(content).toMatch(/\/\/ @name\s+LW Power Reader/);
        expect(content).toMatch(/\/\/ @grant\s+GM_xmlhttpRequest/);
        expect(content).toMatch(/\/\/ @connect\s+lesswrong.com/);
        expect(content).toMatch(/\/\/ @connect\s+firestore\.googleapis\.com/);
        expect(content).toMatch(/\/\/ ==\/UserScript==/);

        // Ensure it is at the start of the file (ignoring potential sheath comments/whitespace)
        // Vite often bundles it at the top.
        const headerIndex = content.indexOf('// ==UserScript==');
        expect(headerIndex).toBeGreaterThanOrEqual(0);
        expect(headerIndex).toBeLessThan(500); // Should be near the top
    });

    test('[PR-DEV-01] Automated codegen utility exists', async () => {
        const codegenPath = path.resolve(__dirname, '../tooling/maybe-codegen.js');
        expect(fs.existsSync(codegenPath)).toBe(true);
    });

    test('Firestore deployment artifacts exist for sync rules/index overrides', async () => {
        const rulesPath = path.resolve(__dirname, '../firestore.rules');
        const indexesPath = path.resolve(__dirname, '../firestore.indexes.json');
        const firebaseJsonPath = path.resolve(__dirname, '../firebase.json');
        expect(fs.existsSync(rulesPath)).toBe(true);
        expect(fs.existsSync(indexesPath)).toBe(true);
        expect(fs.existsSync(firebaseJsonPath)).toBe(true);
    });
});
