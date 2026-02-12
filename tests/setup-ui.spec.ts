import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Power Reader Setup UI', () => {
    let scriptContent: string;

    test.beforeAll(() => {
        const scriptPath = path.resolve(__dirname, '../dist/power-reader.user.js');
        if (!fs.existsSync(scriptPath)) {
            throw new Error('Userscript bundle not found. Run build first.');
        }
        scriptContent = fs.readFileSync(scriptPath, 'utf8');
    });

    test.beforeEach(async ({ page }) => {
        // Single route handler to prevent live server hits
        await page.route('**/*', route => {
            const url = route.request().url();
            if (url.includes('lesswrong.com') || url.includes('effectivealtruism.org')) {
                if (url.endsWith('/reader')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'text/html',
                        body: '<html><body></body></html>'
                    });
                }
                if (url.includes('chunks') || url.includes('bundle.js')) {
                    return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* mock */' });
                }
                console.warn(`[BLOCKER] Aborting un-mocked request: ${url}`);
                return route.abort();
            }
            return route.continue();
        });
    });

    test('shows setup UI when no loadFrom date is set', async ({ page }) => {
        // Mock GM_*
        await page.addInitScript(() => {
            (window as any).GM_getValue = (key: string, def: any) => {
                // Ensure loadFrom returns null/undefined
                if (key === 'power-reader-read-from') return undefined;
                return def;
            };
            (window as any).GM_setValue = () => { };
            (window as any).GM_xmlhttpRequest = () => { };
        });

        await page.goto('https://www.lesswrong.com/reader', { waitUntil: 'domcontentloaded' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        await expect(page.locator('.pr-setup')).toBeVisible();
        await expect(page.locator('#startReading')).toBeVisible();
        await expect(page.locator('#loadFromDate')).toBeVisible();
        await expect(page.locator('h1')).toContainText('Welcome to Power Reader!');
    });

    test('clicking Start Reading with empty date sets __LOAD_RECENT__', async ({ page }) => {
        await page.addInitScript(() => {
            const storage: Record<string, any> = {};
            (window as any).GM_getValue = (key: string, def: any) => storage[key] ?? def;
            (window as any).GM_setValue = (key: string, val: any) => {
                storage[key] = val;
                if (key === 'power-reader-read-from') {
                    (window as any)._lastLoadFromValue = val;
                }
            };
            (window as any).GM_xmlhttpRequest = (opts: any) => {
                // Return empty result to prevent errors when loadAndRender triggers
                setTimeout(() => opts.onload({ responseText: JSON.stringify({ data: { currentUser: null, comments: { results: [] } } }) }), 0);
            };
        });

        await page.goto('https://www.lesswrong.com/reader', { waitUntil: 'domcontentloaded' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('.pr-setup');

        await page.click('#startReading');

        // Check storage update
        const val = await page.evaluate(() => (window as any)._lastLoadFromValue);
        expect(val).toBe('__LOAD_RECENT__');
    });

    test('clicking Start Reading with date sets ISO string', async ({ page }) => {
        await page.addInitScript(() => {
            const storage: Record<string, any> = {};
            (window as any).GM_getValue = (key: string, def: any) => storage[key] ?? def;
            (window as any).GM_setValue = (key: string, val: any) => {
                storage[key] = val;
                if (key === 'power-reader-read-from') {
                    (window as any)._lastLoadFromValue = val;
                }
            };
            (window as any).GM_xmlhttpRequest = (opts: any) => {
                setTimeout(() => opts.onload({ responseText: JSON.stringify({ data: { currentUser: null, comments: { results: [] } } }) }), 0);
            };
        });

        await page.goto('https://www.lesswrong.com/reader', { waitUntil: 'domcontentloaded' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('.pr-setup');

        // Fill date
        await page.fill('#loadFromDate', '2023-01-01');
        await page.click('#startReading');

        const val = await page.evaluate(() => (window as any)._lastLoadFromValue);
        expect(val).toContain('2023-01-01');
    });
});
