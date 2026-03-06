import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';
import { toDebugSummaryValue } from '../src/scripts/power-reader/persistence/debugSummary';

test.describe('Content HTML Behavior', () => {
  test('[PR-DATA-06] author preview renders trusted htmlBio content from API', async ({ page }) => {
    await initPowerReader(page, {
      testMode: true,
      comments: [{
        _id: 'c-user-link',
        postId: 'p1',
        postedAt: new Date().toISOString(),
        baseScore: 1,
        htmlBody: '<p>See <a href="/users/TargetUser" id="user-link">TargetUser</a></p>',
        user: { _id: 'u1', username: 'AuthorA', displayName: 'Author A', slug: 'author-a', karma: 100 },
        post: { _id: 'p1', title: 'Post 1' },
      }],
      onGraphQL: `
        if (query.includes('GetUserBySlug') && variables.slug === 'TargetUser') {
          return {
            data: {
              user: {
                _id: 'u-target',
                username: 'TargetUser',
                displayName: 'Target User',
                slug: 'target-user',
                karma: 321,
                htmlBio: '<p>Bio with <strong>trusted html</strong>.</p>'
              }
            }
          };
        }
        return null;
      `,
    });

    const link = page.locator('#user-link');
    await expect(link).toBeVisible();
    await link.hover();

    const preview = page.locator('.pr-preview-overlay.author-preview');
    await expect(preview).toBeVisible({ timeout: 10_000 });
    await expect(preview.getByText('trusted html')).toBeVisible();
  });

  test('[PR-DATA-06] wiki preview renders trusted htmlHighlight content from API', async ({ page }) => {
    await initPowerReader(page, {
      testMode: true,
      comments: [{
        _id: 'c-wiki-link',
        postId: 'p1',
        postedAt: new Date().toISOString(),
        baseScore: 1,
        htmlBody: '<p>See <a href="/tag/alignment" id="wiki-link">alignment</a></p>',
        user: { _id: 'u1', username: 'AuthorA', displayName: 'Author A', slug: 'author-a', karma: 100 },
        post: { _id: 'p1', title: 'Post 1' },
      }],
      onGraphQL: `
        if (query.includes('GetTagPreviewBySlug')) {
          return {
            data: {
              tags: {
                results: [{
                  _id: 'tag-alignment',
                  name: 'Alignment',
                  slug: 'alignment',
                  description: { _id: 'rev1', htmlHighlight: '<p>Wiki <em>trusted highlight</em></p>' }
                }]
              }
            }
          };
        }
        return null;
      `,
    });

    const link = page.locator('#wiki-link');
    await expect(link).toBeVisible();
    await link.hover();

    const preview = page.locator('.pr-preview-overlay.wiki-preview');
    await expect(preview).toBeVisible({ timeout: 10_000 });
    await expect(preview.locator('em')).toContainText('trusted highlight');
  });

  test('[PR-DATA-06.1] quote highlighter skips style/script-like nodes', async ({ page }) => {
    await initPowerReader(page, {
      testMode: true,
      comments: [{
        _id: 'c-style',
        postId: 'p1',
        pageUrl: 'https://example.com/c-style',
        postedAt: new Date().toISOString(),
        baseScore: 10,
        htmlBody: [
          '<style id="style-sentinel">/* SHARED_SENTINEL */</style>',
          '<script id="script-sentinel" type="application/json">{"quote":"SHARED_SENTINEL"}</script>',
          '<noscript id="noscript-sentinel">SHARED_SENTINEL</noscript>',
          '<template id="template-sentinel"><span>SHARED_SENTINEL</span></template>',
          '<p>SHARED_SENTINEL in paragraph</p>',
        ].join(''),
        extendedScore: {
          reacts: {
            mystery_react: [{
              userId: 'u2',
              userName: 'QuotedUser',
              reactType: 'created',
              quotes: [{ quote: 'SHARED_SENTINEL' }],
            }],
          },
        },
        currentUserExtendedVote: { reacts: [] },
        parentCommentId: null,
        user: { _id: 'u2', slug: 'user-2', username: 'OtherUser', displayName: 'Other User' },
        post: { _id: 'p1', title: 'Test Post', slug: 'test-post' },
        parentComment: null,
      }],
    });

    await expect(page.locator('.pr-comment[data-id="c-style"] .pr-highlight')).toHaveCount(1);
    await expect(page.locator('#style-sentinel')).toBeAttached();
    await expect(page.locator('#script-sentinel')).toBeAttached();
    await expect(page.locator('#noscript-sentinel')).toBeAttached();
    await expect(page.locator('#template-sentinel')).toBeAttached();

    const styleText = await page.locator('#style-sentinel').evaluate((el) => el.textContent || '');
    expect(styleText).toContain('SHARED_SENTINEL');
    const styleInner = await page.locator('#style-sentinel').evaluate((el) => el.innerHTML);
    expect(styleInner).toContain('SHARED_SENTINEL');
    expect(styleInner).not.toContain('pr-highlight');

    const scriptText = await page.locator('#script-sentinel').evaluate((el) => el.textContent || '');
    expect(scriptText).toContain('SHARED_SENTINEL');
    const scriptInner = await page.locator('#script-sentinel').evaluate((el) => el.innerHTML);
    expect(scriptInner).toContain('SHARED_SENTINEL');
    expect(scriptInner).not.toContain('pr-highlight');

    const noscriptText = await page.locator('#noscript-sentinel').evaluate((el) => el.textContent || '');
    expect(noscriptText).toContain('SHARED_SENTINEL');
    const noscriptInner = await page.locator('#noscript-sentinel').evaluate((el) => el.innerHTML);
    expect(noscriptInner).toContain('SHARED_SENTINEL');
    expect(noscriptInner).not.toContain('pr-highlight');

    const templateInner = await page.locator('#template-sentinel').evaluate((el) => (el as HTMLTemplateElement).innerHTML);
    expect(templateInner).toContain('SHARED_SENTINEL');
    expect(templateInner).not.toContain('pr-highlight');
  });

  test('[PR-PERSIST-13] debug summary serialization is cycle-safe', () => {
    const cyclic: Record<string, unknown> = { label: 'root' };
    cyclic.self = cyclic;
    cyclic.child = { parent: cyclic };
    const sharedLeaf = { marker: 'shared' };
    cyclic.left = sharedLeaf;
    cyclic.right = sharedLeaf;

    const summary = toDebugSummaryValue(cyclic) as Record<string, unknown>;
    expect(summary.label).toBe('root');
    expect(summary.self).toBe('[circular]');
    expect(summary.child).toEqual({ parent: '[circular]' });
    expect(summary.left).toEqual({ marker: 'shared' });
    expect(summary.right).toEqual({ marker: 'shared' });
  });
});
