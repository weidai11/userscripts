import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader Arena Max Integration', () => {

    test('[PR-AI-08] Pressing "m" over a comment triggers Arena Max prompt generation', async ({ page }) => {
        const comments = [
            {
                _id: 'c1', postId: 'p1', postedAt: new Date().toISOString(),
                htmlBody: '<p>Arena Target Comment</p>', baseScore: 10,
                user: { _id: 'u1', username: 'Author', karma: 100 },
                post: { _id: 'p1', title: 'Post 1', linkUrl: 'https://example.com/linkpost-target', postCategory: 'linkpost', baseScore: 10, user: { karma: 100 } },
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
        await expect(page.locator('.pr-post-linkpost-url').first()).toHaveAttribute('href', 'https://example.com/linkpost-target');
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
                if (key.startsWith('arena_max_prompt_payload:')) {
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
        expect(payload).toContain('https://example.com/linkpost-target');

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
        await page.waitForFunction(() => {
            const calls = (window as any).__GM_CALLS || {};
            return Object.keys(calls).some((key) => key.startsWith('arena_max_prompt_payload:'));
        });
        const payload = await page.evaluate(() => {
            const calls = (window as any).__GM_CALLS || {};
            const payloadKey = Object.keys(calls).find((key) => key.startsWith('arena_max_prompt_payload:'));
            return payloadKey ? calls[payloadKey] : undefined;
        });

        expect(payload).toContain('Parent');
        expect(payload).toContain('Child');
    });

    test('does not render linkpost badge for non-link posts', async ({ page }) => {
        const comments = [
            {
                _id: 'c1', postId: 'p1', postedAt: new Date().toISOString(),
                htmlBody: '<p>Regular post comment</p>', baseScore: 10,
                user: { _id: 'u1', username: 'Author', karma: 100 },
                post: { _id: 'p1', title: 'Post 1', linkUrl: 'https://www.lesswrong.com/posts/p1/post-1', postCategory: 'post', baseScore: 10, user: { karma: 100 } },
                contents: { markdown: 'Regular post comment markdown' }
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            comments
        });

        await expect(page.locator('.pr-post-linkpost-url')).toHaveCount(0);
    });

    test('[PR-AI-03] Arena responses are not rendered in-reader', async ({ page }) => {
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
            (window as any).__TRIGGER_GM_CHANGE('arena_max_response_payload', {
                text: 'Arena Response Content',
                requestId: 'req-1',
                includeDescendants: false
            }, true);
        });

        await expect(page.locator('.pr-ai-popup')).toHaveCount(0);
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
