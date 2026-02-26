import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function waitAtLeast(ms: number): Promise<void> {
    const start = Date.now();
    await expect.poll(() => Date.now() - start, { timeout: ms + 1000 }).toBeGreaterThanOrEqual(ms);
}

async function setupPowerReader(page: any, commentCount: number = 20) {
    const scriptPath = path.resolve(__dirname, '../dist/power-reader.user.js');
    if (!fs.existsSync(scriptPath)) {
        console.warn('Userscript bundle not found. Run build first.');
        test.skip();
        return false;
    }
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');

    await page.route('https://www.lesswrong.com/reader', (route: any) => {
        route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: '<html><head><title>Mock LW</title></head><body></body></html>'
        });
    });

    await page.addInitScript((count: number) => {
        const storage: Record<string, any> = {};
        (window as any).GM_setValue = (k: string, v: any) => storage[k] = v;
        (window as any).GM_getValue = (k: string, def: any) => storage[k] ?? def;
        (window as any).GM_xmlhttpRequest = (options: any) => {
            if (options.url.endsWith('/graphql')) {
                const body = JSON.parse(options.data || '{}');
                const query = body.query || '';
                let responseData: any = { data: {} };

                if (query.includes('query GetCurrentUser')) {
                    responseData = { data: { currentUser: { _id: 'u1', username: 'TestUser', slug: 'test' } } };
                } else if (query.includes('query GetAllRecentComments')) {
                    const comments = [];
                    for (let i = 0; i < count; i++) {
                        comments.push({
                            _id: `c${i}`, postId: 'p1', pageUrl: `https://www.lesswrong.com/posts/p1/comment/c${i}`,
                            htmlBody: `<p>Comment content ${i}</p>`, postedAt: new Date().toISOString(),
                            baseScore: 10, parentCommentId: null,
                            user: { _id: 'u1', username: 'User1', karma: 100 },
                            post: { _id: 'p1', title: 'Test Post', slug: 'test-post' }, parentComment: null
                        });
                    }
                    responseData = { data: { comments: { results: comments } } };
                } else if (query.includes('query GetPost')) {
                    responseData = { data: { post: { result: { _id: 'p1', title: 'Test Post', htmlBody: '<p>Full post content for preview</p>', user: { username: 'Author' } } } } };
                }

                setTimeout(() => options.onload({ responseText: JSON.stringify(responseData) }), 10);
            }
        };
        // Skip setup UI
        storage['power-reader-read-from'] = '__LOAD_RECENT__';
        storage['power-reader-read'] = '{}';
        (window as any).__PR_TEST_MODE__ = true;
    }, commentCount);

    await page.goto('https://www.lesswrong.com/reader', { waitUntil: 'domcontentloaded' });
    await page.evaluate(scriptContent);
    await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });
    return true;
}

test('[PR-STICKY-05] sticky header title triggers hover preview', async ({ page }) => {
    await setupPowerReader(page, 20);

    const postHeader = page.locator('.pr-post-header').first();
    const box = await postHeader.boundingBox();
    if (box) {
        await page.evaluate((y) => {
            window.scrollTo(0, y + 50);
            window.dispatchEvent(new Event('scroll'));
        }, box.y + box.height);
    }
    await waitAtLeast(400);

    const stickyHeader = page.locator('#pr-sticky-header');
    await expect(stickyHeader).toHaveClass(/visible/);

    // Hover over the sticky title container (preview listener is on h2)
    const titleContainer = stickyHeader.locator('h2').first();
    const titleBox = await titleContainer.boundingBox();
    if (titleBox) {
        await page.mouse.move(0, 0);
        await page.mouse.move(titleBox.x + titleBox.width / 2, titleBox.y + titleBox.height / 2);
    }
    await titleContainer.hover();

    // The preview overlay should appear
    const preview = page.locator('.pr-preview-overlay');
    await expect(preview).toBeVisible({ timeout: 5000 });
    await expect(preview).toContainText('Full post content for preview');
});
