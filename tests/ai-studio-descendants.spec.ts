import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('AI Studio Descendants: Shift-G and Shift+Click', () => {

    test('Shift-G over a comment includes descendants in XML payload', async ({ page }) => {
        const posts = [{ _id: 'p1', title: 'Post 1', postedAt: new Date().toISOString() }];
        const comments = [
            { 
                _id: 'c1', postId: 'p1', htmlBody: 'Parent Comment', 
                user: { username: 'Author1' }, postedAt: new Date().toISOString(),
                contents: { markdown: 'Parent Markdown' }
            },
            { 
                _id: 'c2', postId: 'p1', parentCommentId: 'c1', htmlBody: 'Child Comment', 
                user: { username: 'Author2' }, postedAt: new Date().toISOString(),
                contents: { markdown: 'Child Markdown' }
            },
            { 
                _id: 'c3', postId: 'p1', parentCommentId: 'c2', htmlBody: 'Grandchild Comment', 
                user: { username: 'Author3' }, postedAt: new Date().toISOString(),
                contents: { markdown: 'Grandchild Markdown' }
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments,
            onInit: `
                window.GM_setValue = (key, value) => {
                    if (key === 'ai_studio_prompt_payload') {
                        window.__LAST_PAYLOAD = value;
                    }
                };
                window.GM_openInTab = () => {};
            `
        });

        const c1 = page.locator('.pr-comment[data-id="c1"]');
        await c1.hover();
        // Shift+G (uppercase G)
        await page.keyboard.press('Shift+G');

        // Wait for payload to be captured
        await expect.poll(async () => {
            return await page.evaluate(() => (window as any).__LAST_PAYLOAD);
        }, { timeout: 5000 }).toContain('<descendants>');

        const payload = await page.evaluate(() => (window as any).__LAST_PAYLOAD);
        
        // Verify descendants are present
        expect(payload).toContain('<comment id="c2"');
        expect(payload).toContain('<comment id="c3"');
        expect(payload).toContain('Child Markdown');
        expect(payload).toContain('Grandchild Markdown');
        
        // Verify structure (nesting)
        // c2 should be inside descendants
        // c3 should be inside c2
        const c2Index = payload.indexOf('<comment id="c2"');
        const c3Index = payload.indexOf('<comment id="c3"');
        expect(c2Index).toBeGreaterThan(0);
        expect(c3Index).toBeGreaterThan(c2Index);
    });

    test('Shift+Click on [g] button includes descendants in XML payload', async ({ page }) => {
        const posts = [{ _id: 'p1', title: 'Post 1', postedAt: new Date().toISOString() }];
        const comments = [
            { 
                _id: 'c1', postId: 'p1', htmlBody: 'Parent Comment', 
                user: { username: 'Author1' }, postedAt: new Date().toISOString(),
                contents: { markdown: 'Parent Markdown' }
            },
            { 
                _id: 'c2', postId: 'p1', parentCommentId: 'c1', htmlBody: 'Child Comment', 
                user: { username: 'Author2' }, postedAt: new Date().toISOString(),
                contents: { markdown: 'Child Markdown' }
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments,
            onInit: `
                window.GM_setValue = (key, value) => {
                    if (key === 'ai_studio_prompt_payload') {
                        window.__LAST_PAYLOAD = value;
                    }
                };
                window.GM_openInTab = () => {};
            `
        });

        const gBtn = page.locator('.pr-comment[data-id="c1"] > .pr-comment-meta [data-action="send-to-ai-studio"]');
        await gBtn.click({ modifiers: ['Shift'] });

        // Wait for payload
        await expect.poll(async () => {
            return await page.evaluate(() => (window as any).__LAST_PAYLOAD);
        }, { timeout: 5000 }).toContain('<descendants>');

        const payload = await page.evaluate(() => (window as any).__LAST_PAYLOAD);
        expect(payload).toContain('<comment id="c2"');
    });
});
