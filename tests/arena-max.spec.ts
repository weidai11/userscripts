import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader Arena Max Integration', () => {

    test('[PR-AI-08] Pressing "m" over a comment triggers Arena Max prompt generation', async ({ page }) => {
        const comments = [
            {
                _id: 'c1', postId: 'p1', postedAt: new Date().toISOString(),
                htmlBody: '<p>Arena Target Comment</p>', baseScore: 10,
                user: { _id: 'u1', username: 'Author', karma: 100 },
                post: { _id: 'p1', title: 'Post 1', baseScore: 10, user: { karma: 100 } },
                contents: { markdown: 'Arena Target Comment Markdown' }
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            comments,
            // Mock GM_openInTab
            onInit: `
                window.GM_openInTab = (url) => {
                    window.__LAST_TAB_URL = url;
                };
            `
        });

        const comment = page.locator('.pr-comment').first();
        // Collapse help section
        await page.evaluate(() => {
            const help = document.getElementById('pr-help-section') as HTMLDetailsElement;
            if (help) help.open = false;
        });
        await comment.scrollIntoViewIfNeeded();

        const box = await comment.boundingBox();
        const centerX = box!.x + box!.width / 2;
        const centerY = box!.y + box!.height / 2;
        await page.mouse.move(centerX, centerY);

        // Update state manually to be sure (it's how the script tracks hover)
        await page.evaluate(({ x, y }) => {
            const state = (window as any).getState();
            state.lastMousePos = { x, y: y - window.scrollY };
        }, { x: centerX, y: centerY });

        // Setup expectation for GM_setValue
        await page.evaluate(() => {
            const originalSetValue = (window as any).GM_setValue;
            (window as any).GM_setValue = (key: string, value: any) => {
                originalSetValue(key, value);
                if (key === 'arena_max_prompt_payload') {
                    (window as any)._lastArenaPayload = value;
                }
            };
        });

        // Press 'm'
        await page.keyboard.press('m');

        // Verify outcomes
        await expect.poll(async () => await page.evaluate(() => (window as any).__LAST_TAB_URL)).toContain('arena.ai/max');

        const payload = await page.evaluate(() => (window as any)._lastArenaPayload);
        expect(payload).toContain('Arena Target Comment');

        // Verify highlight
        await expect(comment).toHaveClass(/being-summarized/);
    });

    test('Shift+m includes descendants for Arena Max', async ({ page }) => {
        const comments = [
            {
                _id: 'c1', postId: 'p1', postedAt: new Date(Date.now() - 1000).toISOString(),
                htmlBody: '<p>Parent</p>', baseScore: 10,
                user: { _id: 'u1', username: 'Author', karma: 100 },
                post: { _id: 'p1', title: 'Post 1', baseScore: 10, user: { karma: 100 } },
                contents: { markdown: 'Parent Markdown' }
            },
            {
                _id: 'c2', postId: 'p1', parentCommentId: 'c1', postedAt: new Date().toISOString(),
                htmlBody: '<p>Child</p>', baseScore: 5,
                user: { _id: 'u2', username: 'Replier', karma: 50 },
                contents: { markdown: 'Child Markdown' }
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            comments,
            onInit: `
                window.GM_openInTab = (url) => {
                    window.__LAST_TAB_URL = url;
                };
            `
        });

        const comment = page.locator('.pr-comment').first();
        await page.evaluate(() => {
            const help = document.getElementById('pr-help-section') as HTMLDetailsElement;
            if (help) help.open = false;
        });

        const box = await comment.boundingBox();
        const centerX = box!.x + box!.width / 2;
        const centerY = box!.y + box!.height / 2;
        await page.mouse.move(centerX, centerY);

        await page.evaluate(({ x, y }) => {
            const state = (window as any).getState();
            state.lastMousePos = { x, y: y - window.scrollY };
        }, { x: centerX, y: centerY });

        // Press 'Shift+m'
        await page.keyboard.down('Shift');
        await page.keyboard.press('m');
        await page.keyboard.up('Shift');

        // Verify outcome via __GM_CALLS (helpers/setup.ts usually tracks this)
        await page.waitForFunction(() => (window as any).__GM_CALLS?.arena_max_prompt_payload !== undefined);
        const payload = await page.evaluate(() => (window as any).__GM_CALLS?.arena_max_prompt_payload);

        expect(payload).toContain('Parent');
        expect(payload).toContain('Child');
    });

    test('Arena listener displays popup and caches response under provider+mode key', async ({ page }) => {
        const comments = [
            {
                _id: 'c1', postId: 'p1', postedAt: new Date().toISOString(),
                htmlBody: '<p>Target</p>', baseScore: 10,
                user: { _id: 'u1', username: 'Author', karma: 100 },
                post: { _id: 'p1', title: 'Post 1', baseScore: 10, user: { karma: 100 } },
                contents: { markdown: 'Target Markdown' }
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            comments,
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
            const state = (window as any).getState();
            state.currentAIRequestId = 'req-1';
            const target = document.querySelector('.pr-comment[data-id="c1"]') as HTMLElement;
            if (target) target.classList.add('being-summarized');
            (window as any).__TRIGGER_GM_CHANGE('arena_max_response_payload', {
                text: 'Arena Response Content',
                requestId: 'req-1',
                includeDescendants: false
            }, true);
        });

        const popup = page.locator('.pr-ai-popup');
        await expect(popup).toBeVisible({ timeout: 5000 });
        await expect(popup).toContainText('Arena Response Content');

        const cacheState = await page.evaluate(() => {
            const state = (window as any).getState();
            return {
                arenaBase: state.sessionAICache['arena_max:c1:base'],
                arenaWithDescendants: state.sessionAICache['arena_max:c1:with_descendants'],
                aiStudioBase: state.sessionAICache['ai_studio:c1:base']
            };
        });
        expect(cacheState.arenaBase).toContain('Arena Response Content');
        expect(cacheState.arenaWithDescendants).toBeUndefined();
        expect(cacheState.aiStudioBase).toBeUndefined();
    });

    test('Arena cache keeps separate entries for m and Shift+m', async ({ page }) => {
        const comments = [
            {
                _id: 'c1', postId: 'p1', postedAt: new Date().toISOString(),
                htmlBody: '<p>Target</p>', baseScore: 10,
                user: { _id: 'u1', username: 'Author', karma: 100 },
                post: { _id: 'p1', title: 'Post 1', baseScore: 10, user: { karma: 100 } },
                contents: { markdown: 'Target Markdown' }
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            comments,
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
            state.currentAIRequestId = 'req-arena-base';
            (window as any).__TRIGGER_GM_CHANGE('arena_max_response_payload', {
                text: 'Arena Base Response',
                requestId: 'req-arena-base',
                includeDescendants: false
            }, true);
        });

        await page.evaluate(() => {
            const state = (window as any).getState();
            state.currentAIRequestId = 'req-arena-desc';
            (window as any).__TRIGGER_GM_CHANGE('arena_max_response_payload', {
                text: 'Arena Descendants Response',
                requestId: 'req-arena-desc',
                includeDescendants: true
            }, true);
        });

        const cacheState = await page.evaluate(() => {
            const state = (window as any).getState();
            return {
                base: state.sessionAICache['arena_max:c1:base'],
                descendants: state.sessionAICache['arena_max:c1:with_descendants']
            };
        });

        expect(cacheState.base).toContain('Arena Base Response');
        expect(cacheState.descendants).toContain('Arena Descendants Response');
        expect(cacheState.base).not.toBe(cacheState.descendants);
    });

    test('Arena popup regenerate works when pointer is over popup (uses focal item fallback)', async ({ page }) => {
        const comments = [
            {
                _id: 'c1', postId: 'p1', postedAt: new Date().toISOString(),
                htmlBody: '<p>Target</p>', baseScore: 10,
                user: { _id: 'u1', username: 'Author', karma: 100 },
                post: { _id: 'p1', title: 'Post 1', baseScore: 10, user: { karma: 100 } },
                contents: { markdown: 'Target Markdown' }
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            comments,
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
                window.GM_openInTab = function (url) {
                    window.__LAST_TAB_URL = url;
                };
            `
        });

        await page.evaluate(() => {
            const state = (window as any).getState();
            state.currentAIRequestId = 'req-regen';
            const target = document.querySelector('.pr-comment[data-id="c1"]') as HTMLElement;
            if (target) target.classList.add('being-summarized');
            (window as any).__TRIGGER_GM_CHANGE('arena_max_response_payload', {
                text: 'Initial Arena Response',
                requestId: 'req-regen',
                includeDescendants: false
            }, true);
        });

        const popup = page.locator('.pr-ai-popup');
        await expect(popup).toBeVisible({ timeout: 5000 });

        const regenBtn = popup.locator('.pr-ai-popup-regen');
        await expect(regenBtn).toBeVisible();
        await regenBtn.click();

        await expect.poll(async () => await page.evaluate(() => (window as any).__LAST_TAB_URL)).toContain('arena.ai/max');
        await expect.poll(async () => await page.evaluate(() => (window as any).__GM_CALLS?.arena_max_prompt_payload)).toContain('Target');
    });

    test('Shift+m preload cache is reused by [a] load-all without refetch', async ({ page }) => {
        const totalComments = 150;
        const posts = [{
            _id: 'p1',
            title: 'Large Post',
            htmlBody: '<p>Body</p>',
            postedAt: new Date().toISOString(),
            commentCount: totalComments,
            user: { _id: 'u1', username: 'Author' },
            contents: { markdown: 'Large Post Markdown' }
        }];
        const comments = [{
            _id: 'c-seed',
            postId: 'p1',
            htmlBody: '<p>Seed</p>',
            postedAt: new Date().toISOString(),
            user: { _id: 'u2', username: 'SeedUser' },
            contents: { markdown: 'Seed' }
        }];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments,
            onInit: `
                window.GM_openInTab = (url) => {
                    window.__LAST_TAB_URL = url;
                };
            `,
            onGraphQL: `
                if (query.includes('query GetPostComments')) {
                    window.__POST_COMMENTS_CALLS = (window.__POST_COMMENTS_CALLS || 0) + 1;
                    const results = Array.from({ length: ${totalComments} }, (_, i) => ({
                        _id: 'c-' + (i + 1),
                        postId: 'p1',
                        htmlBody: '<p>Comment ' + (i + 1) + '</p>',
                        postedAt: new Date(Date.now() - i * 1000).toISOString(),
                        user: { username: 'User' + (i + 1) },
                        contents: { markdown: 'Comment ' + (i + 1) }
                    }));
                    return { data: { comments: { results } } };
                }
            `
        });

        const arenaBtn = page.locator('.pr-post[data-id="p1"] [data-action="send-to-arena-max"]').first();
        await arenaBtn.scrollIntoViewIfNeeded();
        const box = await arenaBtn.boundingBox();
        const centerX = box!.x + box!.width / 2;
        const centerY = box!.y + box!.height / 2;
        await page.mouse.move(centerX, centerY);
        await page.evaluate(({ x, y }) => {
            const state = (window as any).getState();
            state.lastMousePos = { x, y: y - window.scrollY };
        }, { x: centerX, y: centerY });

        await arenaBtn.click({ modifiers: ['Shift'] });

        await page.getByRole('button', { name: 'Load all descendants' }).click();
        await expect.poll(async () => await page.evaluate(() => (window as any).__LAST_TAB_URL)).toContain('arena.ai/max');

        const loadAllBtn = page.locator('.pr-post[data-id="p1"] [data-action="load-all-comments"]');
        await loadAllBtn.click();
        await page.getByRole('button', { name: 'Load all descendants' }).click();
        await expect(loadAllBtn).toHaveText('[a]', { timeout: 10000 });

        const fetchCalls = await page.evaluate(() => (window as any).__POST_COMMENTS_CALLS || 0);
        expect(fetchCalls).toBe(1);
    });

    test('[a] load-all prefetch is reused by Shift+m without refetch', async ({ page }) => {
        const totalComments = 140;
        const posts = [{
            _id: 'p1',
            title: 'Large Post',
            htmlBody: '<p>Body</p>',
            postedAt: new Date().toISOString(),
            commentCount: totalComments,
            user: { _id: 'u1', username: 'Author' },
            contents: { markdown: 'Large Post Markdown' }
        }];
        const comments = [{
            _id: 'c-seed',
            postId: 'p1',
            htmlBody: '<p>Seed</p>',
            postedAt: new Date().toISOString(),
            user: { _id: 'u2', username: 'SeedUser' },
            contents: { markdown: 'Seed' }
        }];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments,
            onInit: `
                window.GM_openInTab = (url) => {
                    window.__LAST_TAB_URL = url;
                };
            `,
            onGraphQL: `
                if (query.includes('query GetPostComments')) {
                    window.__POST_COMMENTS_CALLS = (window.__POST_COMMENTS_CALLS || 0) + 1;
                    const results = Array.from({ length: ${totalComments} }, (_, i) => ({
                        _id: 'c-' + (i + 1),
                        postId: 'p1',
                        htmlBody: '<p>Comment ' + (i + 1) + '</p>',
                        postedAt: new Date(Date.now() - i * 1000).toISOString(),
                        user: { username: 'User' + (i + 1) },
                        contents: { markdown: 'Comment ' + (i + 1) }
                    }));
                    return { data: { comments: { results } } };
                }
            `
        });

        const loadAllBtn = page.locator('.pr-post[data-id="p1"] [data-action="load-all-comments"]');
        await loadAllBtn.click();
        await page.getByRole('button', { name: 'Load all descendants' }).click();
        await expect(loadAllBtn).toHaveText('[a]', { timeout: 10000 });

        const arenaBtn = page.locator('.pr-post[data-id="p1"] [data-action="send-to-arena-max"]').first();
        await arenaBtn.scrollIntoViewIfNeeded();
        const box = await arenaBtn.boundingBox();
        const centerX = box!.x + box!.width / 2;
        const centerY = box!.y + box!.height / 2;
        await page.mouse.move(centerX, centerY);
        await page.evaluate(({ x, y }) => {
            const state = (window as any).getState();
            state.lastMousePos = { x, y: y - window.scrollY };
        }, { x: centerX, y: centerY });

        await arenaBtn.click({ modifiers: ['Shift'] });
        await page.getByRole('button', { name: 'Load all descendants' }).click();
        await expect.poll(async () => await page.evaluate(() => (window as any).__LAST_TAB_URL)).toContain('arena.ai/max');

        const fetchCalls = await page.evaluate(() => (window as any).__POST_COMMENTS_CALLS || 0);
        expect(fetchCalls).toBe(1);
    });
});
