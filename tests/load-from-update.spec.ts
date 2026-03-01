import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test('[PR-LOAD-01.1] explicit loadFrom is preserved on initial load', async ({ page }) => {
    const explicitLoadFrom = '2026-02-01T00:00:00.000Z';
    const baseMs = Date.parse('2026-02-01T10:00:00.000Z');
    const comments = Array.from({ length: 30 }, (_, index) => {
        const postedAt = new Date(baseMs + (index * 60_000)).toISOString();
        return {
            _id: `c${index + 1}`,
            postId: 'p1',
            pageUrl: 'https://www.lesswrong.com/posts/p1/post',
            htmlBody: `<p>${'x'.repeat(300)}</p>`,
            postedAt,
            baseScore: 5,
            user: { _id: `u${index + 1}`, username: `User${index + 1}` },
            post: { _id: 'p1', title: 'Post' }
        };
    });

    await initPowerReader(page, {
        testMode: true,
        storage: {
            'power-reader-read-from': explicitLoadFrom,
            'power-reader-read': '{}'
        },
        comments
    });

    const persisted = await page.evaluate(() => (window as any).GM_getValue('power-reader-read-from', null));
    expect(persisted).toBe(explicitLoadFrom);

    const lastWrite = await page.evaluate(() => (window as any).__GM_CALLS?.['power-reader-read-from']);
    expect(lastWrite).toBeUndefined();
});

test('[PR-LOAD-01.1] recent-mode snapshot uses startup mode even if loadFrom changes mid-load', async ({ page }) => {
    const oldestTimestamp = '2026-02-01T10:00:00.000Z';
    const explicitCutoffInjectedMidLoad = '2020-01-01T00:00:00.000Z';
    await initPowerReader(page, {
        testMode: true,
        storage: {
            'power-reader-read-from': '__LOAD_RECENT__',
            'power-reader-read': '{}'
        },
        comments: [
            {
                _id: 'c1',
                postId: 'p1',
                pageUrl: 'https://www.lesswrong.com/posts/p1/post',
                htmlBody: '<p>Older</p>',
                postedAt: oldestTimestamp,
                baseScore: 5,
                user: { _id: 'u1', username: 'User1' },
                post: { _id: 'p1', title: 'Post' }
            },
            {
                _id: 'c2',
                postId: 'p1',
                pageUrl: 'https://www.lesswrong.com/posts/p1/post',
                htmlBody: '<p>Newer</p>',
                postedAt: '2026-02-01T12:00:00.000Z',
                baseScore: 6,
                user: { _id: 'u2', username: 'User2' },
                post: { _id: 'p1', title: 'Post' }
            }
        ],
        onGraphQL: `
            if (query.includes('GetAllRecentComments') || query.includes('allRecentComments')) {
                window.GM_setValue('power-reader-read-from', '${explicitCutoffInjectedMidLoad}');
            }
            return null;
        `
    });

    const persisted = await page.evaluate(() => (window as any).GM_getValue('power-reader-read-from', null));
    expect(persisted).toBe(oldestTimestamp);
});

test('Power Reader updates loadFrom when reaching bottom of page', async ({ page }) => {
    const oldestTimestamp = '2026-02-01T10:00:00.000Z';
    const newestTimestamp = '2026-02-01T12:00:00.000Z';

    await initPowerReader(page, {
        testMode: true,
        storage: {
            'power-reader-read-from': '2026-02-01T00:00:00.000Z',
            'power-reader-read': '{}'
        },
        comments: [
            {
                _id: 'c1',
                postId: 'p1',
                pageUrl: 'https://www.lesswrong.com/posts/p1/post',
                htmlBody: '<p>Newer</p>',
                postedAt: newestTimestamp,
                baseScore: 10,
                user: { _id: 'u1', username: 'User1' },
                post: { _id: 'p1', title: 'Post' }
            },
            {
                _id: 'c2',
                postId: 'p1',
                pageUrl: 'https://www.lesswrong.com/posts/p1/post',
                htmlBody: '<p>Oldest</p>',
                postedAt: oldestTimestamp,
                baseScore: 5,
                user: { _id: 'u2', username: 'User2' },
                post: { _id: 'p1', title: 'Post' }
            }
        ]
    });

    // 4. Scroll to bottom
    await page.evaluate(() => {
        const spacer = document.createElement('div');
        spacer.style.height = '5000px';
        document.body.appendChild(spacer);
        window.scrollTo(0, document.body.scrollHeight);
        window.dispatchEvent(new Event('scroll'));
    });

    // 5. Wait for scroll delay (testmode: 100ms) and the specific advanceSession update
    const expected = '2026-02-01T12:00:00.001Z';
    await page.waitForFunction((val) => (window as any).__GM_CALLS?.['power-reader-read-from'] === val, expected, { timeout: 10000 });

    // 6. Verify loadFrom was updated to the newest timestamp (advancing the session)
    const loadFrom = await page.evaluate(() => (window as any).__GM_CALLS?.['power-reader-read-from']);
    expect(loadFrom).toBe(expected);
});
