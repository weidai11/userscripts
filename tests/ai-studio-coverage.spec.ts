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
                document.elementFromPoint = (x, y) => {
                    return document.querySelector('.pr-comment');
                };
            `
        });

        const comment = page.locator('.pr-comment').first();
        await comment.scrollIntoViewIfNeeded();

        await page.evaluate(() => {
            const state = (window as any).getState();
            state.lastMousePos = { x: 100, y: 100 };
        });

        await page.keyboard.press('g');

        await expect.poll(async () => {
            return await page.evaluate(() => (window as any).__LAST_TAB_URL);
        }).toContain('aistudio.google.com');
    });

    test('[PR-AI-03] AI Studio responses are not rendered in-reader', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            comments: [{
                _id: 'c1', postId: 'p1', postedAt: new Date().toISOString(),
                htmlBody: 'Test', user: { username: 'U' }, post: { _id: 'p1', title: 'T' }
            }],
            onInit: `
                window.__GM_LISTENERS = {};
                window.__GM_LISTENER_ID = 0;
                window.GM_addValueChangeListener = function (key, cb) {
                    if (!window.__GM_LISTENERS[key]) window.__GM_LISTENERS[key] = [];
                    window.__GM_LISTENERS[key].push(cb);
                    window.__GM_LISTENER_ID += 1;
                    return window.__GM_LISTENER_ID;
                };
                window.__TRIGGER_GM_CHANGE = function (key, value, remote) {
                    var listeners = window.__GM_LISTENERS[key] || [];
                    listeners.forEach(function (cb) { cb(key, null, value, remote !== false); });
                };
            `
        });

        await page.evaluate(() => {
            (window as any).__TRIGGER_GM_CHANGE('ai_studio_response_payload', {
                text: 'AI Studio Response',
                requestId: 'req-1',
                includeDescendants: false
            }, true);
        });

        await expect(page.locator('.pr-ai-popup')).toHaveCount(0);
    });
});
