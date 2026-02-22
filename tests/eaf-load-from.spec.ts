import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

const EAF_URL = 'https://forum.effectivealtruism.org/reader';

test.describe('EAF loadFrom date handling', () => {
  test('[PR-DATA-05] initial load filters by loadFrom on EAF when legacy after is ignored', async ({ page }) => {
    const afterIso = '2026-02-20T00:00:00.000Z';

    await initPowerReader(page, {
      testMode: true,
      comments: [],
      posts: [],
      storage: {
        'ea-power-reader-read-from': afterIso,
        'power-reader-read-from': afterIso,
      },
      onGraphQL: `
        if (query.includes('GetAllRecentCommentsLite')) {
          window.__EAF_LOAD_CALLS = window.__EAF_LOAD_CALLS || [];
          window.__EAF_LOAD_CALLS.push(JSON.parse(JSON.stringify(variables)));

          return {
            data: {
              comments: {
                results: [
                  {
                    _id: 'c-new',
                    postId: 'p1',
                    pageUrl: 'https://forum.effectivealtruism.org/posts/p1/post?commentId=c-new',
                    htmlBody: '<p>new</p>',
                    postedAt: '2026-02-22T10:00:00.000Z',
                    baseScore: 2,
                    voteCount: 1,
                    user: { _id: 'u1', username: 'UserA' },
                    post: { _id: 'p1', title: 'Post 1' }
                  },
                  {
                    _id: 'c-mid',
                    postId: 'p1',
                    pageUrl: 'https://forum.effectivealtruism.org/posts/p1/post?commentId=c-mid',
                    htmlBody: '<p>mid</p>',
                    postedAt: '2026-02-20T12:00:00.000Z',
                    baseScore: 1,
                    voteCount: 1,
                    user: { _id: 'u2', username: 'UserB' },
                    post: { _id: 'p1', title: 'Post 1' }
                  },
                  {
                    _id: 'c-old',
                    postId: 'p1',
                    pageUrl: 'https://forum.effectivealtruism.org/posts/p1/post?commentId=c-old',
                    htmlBody: '<p>old</p>',
                    postedAt: '2014-01-01T00:00:00.000Z',
                    baseScore: 1,
                    voteCount: 1,
                    user: { _id: 'u3', username: 'UserC' },
                    post: { _id: 'p1', title: 'Post 1' }
                  }
                ]
              }
            }
          };
        }
        return null;
      `
    }, EAF_URL);

    await expect(page.locator('.pr-comment[data-id="c-new"]')).toBeVisible();
    await expect(page.locator('.pr-comment[data-id="c-mid"]')).toBeVisible();
    await expect(page.locator('.pr-comment[data-id="c-old"]')).toHaveCount(0);

    const calls = await page.evaluate(() => (window as any).__EAF_LOAD_CALLS || []);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const firstTerms = calls[0]?.input?.terms || {};
    expect(firstTerms.after).toBeUndefined();
    expect(firstTerms.sortBy).toBe('newest');
  });
});

