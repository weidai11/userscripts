import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Power Reader Reset Route', () => {
    let scriptContent: string;

    test.beforeAll(() => {
        const scriptPath = path.resolve(__dirname, '../dist/power-reader.user.js');
        scriptContent = fs.readFileSync(scriptPath, 'utf8');
    });

    test('[PR-URL-02][PR-URL-05] visiting /reader/reset clears storage and redirects', async ({ page }) => {
        // Single route handler to prevent live server hits
        await page.route('**/*', route => {
            const url = route.request().url();
            if (url.includes('lesswrong.com') || url.includes('effectivealtruism.org')) {
                if (url.endsWith('/reader/reset')) {
                    return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' });
                }
                if (url.endsWith('/reader')) {
                    return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Redirected to Reader</body></html>' });
                }
                if (url.includes('chunks') || url.includes('bundle.js')) {
                    return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* mock */' });
                }
                if (url.includes('/graphql')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ data: {} })
                    });
                }
                console.warn(`[BLOCKER] Aborting un-mocked request: ${url}`);
                return route.abort();
            }
            return route.continue();
        });

        await page.addInitScript(() => {
            const snapshotKey = '__PR_RESET_TEST_STORAGE';
            const deletedKey = '__PR_RESET_TEST_WRITES';
            const initialStorage: Record<string, any> = {
                'power-reader-read-from': '2023-01-01T00:00:00.000Z',
                'power-reader-read': '{"c1":1}',
                'power-reader-author-prefs': '{"Alice":1}',
                'power-reader-view-width': '777'
            };
            const existingSnapshot = localStorage.getItem(snapshotKey);
            const storage: Record<string, any> = existingSnapshot
                ? JSON.parse(existingSnapshot)
                : initialStorage;
            const writes: Array<{ key: string, value: any }> = [];

            const persist = () => {
                localStorage.setItem(snapshotKey, JSON.stringify(storage));
                localStorage.setItem(deletedKey, JSON.stringify(writes));
            };
            persist();

            (window as any).GM_getValue = (k: string, d: any) => {
                const val = storage[k];
                return val !== undefined ? val : d;
            };
            (window as any).GM_deleteValue = (k: string) => {
                delete storage[k];
                writes.push({ key: k, value: '__DELETED__' });
                persist();
            };
            (window as any).GM_setValue = (k: string, v: any) => {
                storage[k] = v;
                writes.push({ key: k, value: v });
                persist();
            };
            (window as any).GM_log = (msg: string) => console.log(msg);
        });

        await page.goto('https://www.lesswrong.com/reader/reset', { waitUntil: 'domcontentloaded' });

        // Inject script - this might throw due to navigation
        try {
            await page.evaluate(scriptContent);
        } catch (e) {
            // Navigation expected
        }

        // Check if redirected (Playwright should follow the navigation if it was real)
        await page.waitForURL('**/reader', { timeout: 5000 });
        expect(page.url()).toContain('/reader');

        const storageSnapshot = await page.evaluate(() => {
            const raw = localStorage.getItem('__PR_RESET_TEST_STORAGE');
            return raw ? JSON.parse(raw) : null;
        });

        expect(storageSnapshot).toBeTruthy();
        expect(storageSnapshot['power-reader-read']).toBe('{}');
        expect(storageSnapshot['power-reader-read-from']).toBe('');
        expect(storageSnapshot['power-reader-author-prefs']).toBe('{}');
        expect(storageSnapshot['power-reader-view-width']).toBe('0');
    });
});
