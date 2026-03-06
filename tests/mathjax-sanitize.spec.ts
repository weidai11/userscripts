import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('[PR-DATA-06][PR-DATA-06.1] Content HTML contract', () => {
  test('[PR-DATA-06.1] renders server-provided MathJax CHTML payloads without client filtering', async ({ page }) => {
    const comments = [
      {
        _id: 'c-mathjax-1',
        postId: 'p-mathjax-1',
        postedAt: new Date().toISOString(),
        baseScore: 1,
        voteCount: 1,
        htmlBody: [
          '<p>Equation:</p>',
          '<p>',
          '<style>mjx-container[jax="CHTML"]{line-height:0;} .MJX-TEX{font-family:MJXZERO, MJXTEX;}</style>',
          '<mjx-container jax="CHTML" class="MathJax">',
          '<mjx-math class="MJX-TEX"><mjx-mi><mjx-c class="mjx-c78"></mjx-c></mjx-mi></mjx-math>',
          '</mjx-container>',
          '</p>',
        ].join(''),
        user: { _id: 'u-mathjax', username: 'MathAuthor', displayName: 'Math Author', karma: 10 },
        post: { _id: 'p-mathjax-1', title: 'Math Post', baseScore: 1, user: { karma: 10 } },
        contents: { markdown: 'Equation: $x$' }
      }
    ];

    await initPowerReader(page, {
      testMode: true,
      comments,
    });

    const body = page.locator('.pr-comment .pr-comment-body').first();
    const html = await body.innerHTML();

    expect(html).toContain('<mjx-container');
    expect(html).toContain('<style>');
  });
});
