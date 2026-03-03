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

  test('[PR-DATA-05][PR-LOAD-12][PR-DATA-03.1][PR-DATA-03.2] EAF loadFrom path tolerates allowlisted partial errors', async ({ page }) => {
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
          window.__EAF_PARTIAL_CALLS = window.__EAF_PARTIAL_CALLS || [];
          window.__EAF_PARTIAL_CALLS.push(JSON.parse(JSON.stringify(variables)));

          const offset = variables.offset || 0;
          if (offset > 0) {
            return { data: { comments: { results: [] } } };
          }

          return {
            data: {
              comments: {
                results: [
                  {
                    _id: 'c-new-partial',
                    postId: 'p1',
                    pageUrl: null,
                    htmlBody: '<p>new</p>',
                    postedAt: '2026-02-22T10:00:00.000Z',
                    baseScore: 2,
                    voteCount: 1,
                    user: { _id: 'u1', username: 'UserA' },
                    post: { _id: 'p1', title: 'Post 1' }
                  },
                  {
                    _id: 'c-old-partial',
                    postId: 'p1',
                    pageUrl: null,
                    htmlBody: '<p>old</p>',
                    postedAt: '2014-01-01T00:00:00.000Z',
                    baseScore: 1,
                    voteCount: 1,
                    user: { _id: 'u3', username: 'UserC' },
                    post: { _id: 'p1', title: 'Post 1' }
                  }
                ]
              }
            },
            errors: [{
              message: 'Unable to find document for comment: tolerated-eaf',
              path: ['comments', 'results', 0, 'pageUrl']
            }]
          };
        }
        return null;
      `
    }, EAF_URL);

    await expect(page.locator('.pr-comment[data-id="c-new-partial"]')).toBeVisible();
    await expect(page.locator('.pr-comment[data-id="c-old-partial"]')).toHaveCount(0);
    await expect(page.locator('.pr-error')).toHaveCount(0);

    const calls = await page.evaluate(() => (window as any).__EAF_PARTIAL_CALLS || []);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const firstTerms = calls[0]?.input?.terms || {};
    expect(firstTerms.after).toBeUndefined();
    expect(firstTerms.sortBy).toBe('newest');
  });

  test('[PR-DATA-05][PR-LOAD-12][PR-DATA-03.1][PR-DATA-03.2] EAF loadFrom path rejects non-allowlisted partial errors', async ({ page }) => {
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
          return {
            data: {
              comments: {
                results: [{
                  _id: 'c-strict-eaf',
                  postId: 'p1',
                  pageUrl: 'https://forum.effectivealtruism.org/posts/p1/post?commentId=c-strict-eaf',
                  htmlBody: '<p>Should fail</p>',
                  postedAt: '2026-02-22T10:00:00.000Z',
                  baseScore: 1,
                  voteCount: 1,
                  user: { _id: 'u1', username: 'UserA' },
                  post: { _id: 'p1', title: 'Post 1' }
                }]
              }
            },
            errors: [{
              message: 'Unexpected non-allowlisted EAF error',
              path: ['comments', 'results', 0, 'post']
            }]
          };
        }
        return null;
      `
    }, EAF_URL);

    await expect(page.locator('.pr-error')).toContainText('Error loading reader');
    await expect(page.locator('.pr-comment[data-id="c-strict-eaf"]')).toHaveCount(0);
  });

  test('[PR-LOAD-09][PR-LOAD-12][PR-DATA-05][PR-DATA-03.1][PR-DATA-03.2] EAF bottom polling tolerates allowlisted partial errors', async ({ page }) => {
    const initialComments = [{
      _id: 'c1',
      postId: 'p1',
      pageUrl: 'https://forum.effectivealtruism.org/posts/p1/post?commentId=c1',
      htmlBody: '<p>Body</p>',
      postedAt: '2026-02-22T10:00:00.000Z',
      baseScore: 2,
      voteCount: 1,
      user: { _id: 'u1', username: 'UserA' },
      post: { _id: 'p1', title: 'Post 1' }
    }];

    await initPowerReader(page, {
      testMode: true,
      comments: [],
      posts: [],
      onGraphQL: `
        if (query.includes('GetAllRecentCommentsLite')) {
          return { data: { comments: { results: ${JSON.stringify(initialComments)} } } };
        }
        if ((query.includes('GetAllRecentComments') || query.includes('allRecentComments'))) {
          const terms = variables.input?.terms || variables;
          if (terms.limit === 1 && terms.sortBy === 'newest') {
            return {
              data: { comments: { results: [{ _id: 'c-new', postedAt: '2026-02-22T11:00:00.000Z' }] } },
              errors: [{
                message: 'commentGetPageUrl resolver failed',
                path: ['comments', 'results', 0, 'pageUrl']
              }]
            };
          }
        }
        return null;
      `
    }, EAF_URL);

    await page.evaluate(() => {
      const root = document.getElementById('power-reader-root') || document.body;
      const spacer = document.createElement('div');
      spacer.id = 'pr-test-spacer';
      spacer.style.height = '3000px';
      root.appendChild(spacer);
      window.scrollTo(0, document.body.scrollHeight);
      window.dispatchEvent(new Event('scroll'));
    });

    const bottomMsg = page.locator('#pr-bottom-message');
    await expect(bottomMsg).toBeVisible({ timeout: 15000 });
    await expect(bottomMsg).toHaveText(/New comments available/);
    await expect(bottomMsg).toHaveClass(/has-more/);
  });

  test('[PR-LOAD-09][PR-LOAD-12][PR-DATA-05][PR-DATA-03.1][PR-DATA-03.2] EAF bottom polling rejects non-allowlisted partial errors', async ({ page }) => {
    const initialComments = [{
      _id: 'c1',
      postId: 'p1',
      pageUrl: 'https://forum.effectivealtruism.org/posts/p1/post?commentId=c1',
      htmlBody: '<p>Body</p>',
      postedAt: '2026-02-22T10:00:00.000Z',
      baseScore: 2,
      voteCount: 1,
      user: { _id: 'u1', username: 'UserA' },
      post: { _id: 'p1', title: 'Post 1' }
    }];

    await initPowerReader(page, {
      testMode: true,
      comments: [],
      posts: [],
      onGraphQL: `
        if (query.includes('GetAllRecentCommentsLite')) {
          return { data: { comments: { results: ${JSON.stringify(initialComments)} } } };
        }
        if ((query.includes('GetAllRecentComments') || query.includes('allRecentComments'))) {
          const terms = variables.input?.terms || variables;
          if (terms.limit === 1 && terms.sortBy === 'newest') {
            return {
              data: { comments: { results: [{ _id: 'c-new', postedAt: '2026-02-22T11:00:00.000Z' }] } },
              errors: [{
                message: 'Unexpected non-allowlisted EAF polling error',
                path: ['comments', 'results', 0, 'post']
              }]
            };
          }
        }
        return null;
      `
    }, EAF_URL);

    await page.evaluate(() => {
      const root = document.getElementById('power-reader-root') || document.body;
      const spacer = document.createElement('div');
      spacer.id = 'pr-test-spacer';
      spacer.style.height = '3000px';
      root.appendChild(spacer);
      window.scrollTo(0, document.body.scrollHeight);
      window.dispatchEvent(new Event('scroll'));
    });

    const bottomMsg = page.locator('#pr-bottom-message');
    await expect(bottomMsg).toBeVisible({ timeout: 15000 });
    await expect(bottomMsg).toHaveText(/Failed to check server/);
  });
});
