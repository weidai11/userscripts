import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

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
