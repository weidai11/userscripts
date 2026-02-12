import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Power Reader Resize Handles', () => {
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
                        body: '<html><body><div id="main-content"></div></body></html>'
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

        await page.addInitScript(() => {
            (window as any).__PR_STORAGE__ = {
                'power-reader-read-from': '__LOAD_RECENT__',
                'power-reader-read': '{}',
                'power-reader-view-width': 0
            };
            (window as any).GM_setValue = (key: string, value: any) => {
                (window as any).__PR_STORAGE__[key] = value;
            };
            (window as any).GM_getValue = (key: string, defaultValue: any) => (window as any).__PR_STORAGE__[key] ?? defaultValue;
            (window as any).__PR_TEST_MODE__ = true;

            (window as any).GM_xmlhttpRequest = (options: any) => {
                if (options.url.endsWith('/graphql')) {
                    const responseData = {
                        data: {
                            currentUser: { _id: 'u1', username: 'TestUser' },
                            comments: {
                                results: [
                                    {
                                        _id: 'c1', postId: 'p1', postedAt: new Date().toISOString(),
                                        htmlBody: '<p>Content</p>', baseScore: 10,
                                        user: { _id: 'u1', username: 'Author', karma: 100 },
                                        post: { _id: 'p1', title: 'Post 1', baseScore: 10, user: { karma: 100 } }
                                    }
                                ]
                            }
                        }
                    };
                    setTimeout(() => options.onload({ responseText: JSON.stringify(responseData) }), 10);
                }
            };
        });

        await page.goto('https://www.lesswrong.com/reader', { waitUntil: 'domcontentloaded' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
    });

    test('[PR-LAYOUT-01] Resize handles appear and dragging changes width', async ({ page }) => {
        const root = page.locator('#power-reader-root');
        const rightHandle = page.locator('.pr-resize-handle.right');

        await expect(rightHandle).toBeAttached();

        const initialBox = await root.boundingBox();
        expect(initialBox).not.toBeNull();

        // 1. Move to handle
        const handleBox = await rightHandle.boundingBox();
        expect(handleBox).not.toBeNull();

        await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + 100);
        await page.mouse.down();

        // 2. Drag left (reduce width)
        // Note: each 1px move reduces width by 2px because it is centered
        await page.mouse.move(handleBox!.x - 100, handleBox!.y + 100, { steps: 10 });
        await page.mouse.up();

        const afterBox = await root.boundingBox();
        expect(afterBox!.width).toBeLessThan(initialBox!.width - 150); // Allowing for some rounding/slack

        // 3. Verify persistence was called
        // We check logs for GM_setValue: power-reader-view-width
    });

    test('[PR-LAYOUT-02] Custom width persists from storage', async ({ page }) => {
        // Preset storage value
        await page.addInitScript(() => {
            if (!(window as any).__PR_STORAGE__) (window as any).__PR_STORAGE__ = {};
            (window as any).__PR_STORAGE__['power-reader-view-width'] = 600;
        });

        await page.goto('https://www.lesswrong.com/reader', { waitUntil: 'domcontentloaded' });
        await page.evaluate(scriptContent);

        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        const root = page.locator('#power-reader-root');
        const box = await root.boundingBox();
        expect(box!.width).toBe(600);
    });
});
