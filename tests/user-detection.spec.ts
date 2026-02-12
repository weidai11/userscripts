
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scriptPath = path.resolve(__dirname, '../dist/power-reader.user.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

test.describe('Power Reader User Detection', () => {

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

    test('[PR-USER-01] Detect current logged-in user via GraphQL', async ({ page }) => {
        await page.addInitScript(() => {
            (window as any).GM_getValue = () => '__LOAD_RECENT__';
            (window as any).GM_setValue = () => { };
            (window as any).GM_xmlhttpRequest = (o: any) => {
                const body = JSON.parse(o.data || '{}');
                if (body.query?.includes('GetCurrentUser')) {
                    o.onload({ responseText: JSON.stringify({ data: { currentUser: { _id: 'u-123', username: 'TestLoggedUser', slug: 'test' } } }) });
                } else {
                    o.onload({ responseText: JSON.stringify({ data: { comments: { results: [] } } }) });
                }
            };
        });

        await page.goto('https://www.lesswrong.com/reader');
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        const status = page.locator('.pr-status');
        await expect(status).toContainText('👤 TestLoggedUser');
    });
});
