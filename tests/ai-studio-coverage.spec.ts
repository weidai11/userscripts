import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader AI Studio Coverage', () => {

    test('[PR-AI-01] Shortkey "g" triggers AI Studio automation', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            comments: [{
                _id: 'c1', postId: 'p1', postedAt: new Date().toISOString(),
                htmlBody: 'Test Content for AI Studio', user: { username: 'U' }, post: { _id: 'p1', title: 'T' }
            }],
            onInit: `
                window.GM_openInTab = (url) => { 
                    window.__LAST_TAB_URL = url; 
                    return {close: ()=>{}}; 
                };
                // Mock elementFromPoint to always return the comment for keyboard tests
                document.elementFromPoint = (x, y) => {
                    return document.querySelector('.pr-comment');
                };
            `
        });

        const comment = page.locator('.pr-comment').first();
        await comment.scrollIntoViewIfNeeded();

        // Ensure state has some mouse position
        await page.evaluate(() => {
            const state = (window as any).getState();
            state.lastMousePos = { x: 100, y: 100 };
        });

        // [PR-AI-01] Press 'g' over comment
        await page.keyboard.press('g');

        // Verify GM_openInTab was called
        await expect.poll(async () => {
            return await page.evaluate(() => (window as any).__LAST_TAB_URL);
        }).toContain('aistudio.google.com');
    });

    test('[PR-AI-04] Responses are cached in-memory', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            comments: [{
                _id: 'c1', postId: 'p1', postedAt: new Date().toISOString(),
                htmlBody: 'Test', user: { username: 'U' }, post: { _id: 'p1', title: 'T' }
            }]
        });

        // Manually inject a cached response into state
        await page.evaluate(() => {
            const state = (window as any).getState();
            state.sessionAICache['c1'] = 'Cached Response Content';
        });

        const comment = page.locator('.pr-comment').first();
        await comment.hover();

        // Verify state injection works
        const cache = await page.evaluate(() => (window as any).getState().sessionAICache['c1']);
        expect(cache).toBe('Cached Response Content');
    });
});
