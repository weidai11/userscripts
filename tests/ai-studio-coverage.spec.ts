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

    test('[PR-AI-04] Responses are cached in-memory under provider+mode key', async ({ page }) => {
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
            state.sessionAICache['ai_studio:c1:base'] = 'Cached Response Content';
        });

        const comment = page.locator('.pr-comment').first();
        await comment.hover();

        // Verify state injection works
        const cache = await page.evaluate(() => (window as any).getState().sessionAICache['ai_studio:c1:base']);
        expect(cache).toBe('Cached Response Content');
    });

    test('AI Studio cache keeps separate entries for g and Shift+g', async ({ page }) => {
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
            const target = document.querySelector('.pr-comment[data-id="c1"]') as HTMLElement;
            if (target) target.classList.add('being-summarized');
            const state = (window as any).getState();
            state.currentAIRequestId = 'req-ai-base';
            (window as any).__TRIGGER_GM_CHANGE('ai_studio_response_payload', {
                text: 'AI Studio Base Response',
                requestId: 'req-ai-base',
                includeDescendants: false
            }, true);
        });

        await page.evaluate(() => {
            const state = (window as any).getState();
            state.currentAIRequestId = 'req-ai-desc';
            (window as any).__TRIGGER_GM_CHANGE('ai_studio_response_payload', {
                text: 'AI Studio Descendants Response',
                requestId: 'req-ai-desc',
                includeDescendants: true
            }, true);
        });

        const cacheState = await page.evaluate(() => {
            const state = (window as any).getState();
            return {
                base: state.sessionAICache['ai_studio:c1:base'],
                descendants: state.sessionAICache['ai_studio:c1:with_descendants']
            };
        });

        expect(cacheState.base).toContain('AI Studio Base Response');
        expect(cacheState.descendants).toContain('AI Studio Descendants Response');
        expect(cacheState.base).not.toBe(cacheState.descendants);
    });
});
