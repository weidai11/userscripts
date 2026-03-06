import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('AI Depth Behavior', () => {
  test('[PR-AI-05] send-to-AI includes full ancestor chain (no fixed parent cap)', async ({ page }) => {
    const chainDepth = 12;
    const postId = 'p-root';
    const comments = Array.from({ length: chainDepth }, (_, index) => {
      const n = index + 1;
      return {
        _id: `c${n}`,
        postId,
        parentCommentId: n === 1 ? null : `c${n - 1}`,
        postedAt: new Date(Date.now() + (n * 1000)).toISOString(),
        baseScore: n,
        htmlBody: `<p>Comment ${n}</p>`,
        contents: { markdown: `Comment ${n} markdown` },
        user: {
          _id: `u${n}`,
          username: `Author${n}`,
          displayName: `Author ${n}`,
          slug: `author-${n}`,
          karma: 100,
        },
        post: {
          _id: postId,
          title: 'Root Post',
          baseScore: 100,
          user: { _id: 'up', username: 'PostAuthor', displayName: 'Post Author', karma: 1000 },
        },
      };
    });

    await initPowerReader(page, {
      testMode: true,
      comments,
      posts: [{
        _id: postId,
        title: 'Root Post',
        postedAt: new Date().toISOString(),
        baseScore: 100,
        htmlBody: '<p>Root post body</p>',
        contents: { markdown: 'Root post markdown' },
        user: { _id: 'up', username: 'PostAuthor', displayName: 'Post Author', slug: 'post-author', karma: 1000 },
      }],
    });

    const targetComment = page.locator(`.pr-comment[data-id="c${chainDepth}"]`);
    await targetComment.scrollIntoViewIfNeeded();
    await targetComment.locator('[data-action="send-to-ai-studio"]').click();

    await expect.poll(async () =>
      await page.evaluate(() => (window as any).__OPENED_TAB || '')
    ).toContain('aistudio.google.com');

    const payload = await page.evaluate(() => {
      const calls = (window as any).__GM_CALLS || {};
      const key = Object.keys(calls).find((k) => k.startsWith('ai_studio_prompt_payload:'));
      return key ? String(calls[key]) : '';
    });

    expect(payload).toContain('<post id="p-root"');
    for (let i = 1; i <= chainDepth; i += 1) {
      expect(payload).toContain(`<comment id="c${i}"`);
    }

    const positions = Array.from({ length: chainDepth }, (_, index) =>
      payload.indexOf(`<comment id="c${index + 1}"`)
    );
    expect(positions.every((pos) => pos >= 0)).toBe(true);
    expect(positions.every((pos, index) => index === 0 || pos > positions[index - 1])).toBe(true);
  });

  test('[PR-AI-05] send-to-AI stops cleanly on malformed parent cycles', async ({ page }) => {
    await initPowerReader(page, {
      testMode: true,
      comments: [
        {
          _id: 'c1',
          postId: 'p-cycle',
          parentCommentId: null,
          postedAt: new Date().toISOString(),
          baseScore: 1,
          htmlBody: '<p>Comment 1</p>',
          contents: { markdown: 'Comment 1 markdown' },
          user: { _id: 'u1', username: 'Author1', displayName: 'Author 1', slug: 'author-1', karma: 100 },
          post: { _id: 'p-cycle', title: 'Cycle Post' },
        },
        {
          _id: 'c2',
          postId: 'p-cycle',
          parentCommentId: 'c1',
          postedAt: new Date(Date.now() + 1000).toISOString(),
          baseScore: 2,
          htmlBody: '<p>Comment 2</p>',
          contents: { markdown: 'Comment 2 markdown' },
          user: { _id: 'u2', username: 'Author2', displayName: 'Author 2', slug: 'author-2', karma: 100 },
          post: { _id: 'p-cycle', title: 'Cycle Post' },
        },
      ],
      posts: [{
        _id: 'p-cycle',
        title: 'Cycle Post',
        postedAt: new Date().toISOString(),
        baseScore: 100,
        htmlBody: '<p>Cycle post body</p>',
        contents: { markdown: 'Cycle post markdown' },
        user: { _id: 'up', username: 'PostAuthor', displayName: 'Post Author', slug: 'post-author', karma: 1000 },
      }],
    });

    const targetComment = page.locator('.pr-comment[data-id="c2"]');
    await expect(targetComment).toBeVisible();

    await page.evaluate(() => {
      const state = (window as any).getState();
      const comment = state.commentById.get('c1');
      if (!comment) throw new Error('Expected c1 in state');
      comment.parentCommentId = 'c2';
    });

    await targetComment.scrollIntoViewIfNeeded();
    await targetComment.locator('[data-action="send-to-ai-studio"]').click();

    await expect.poll(async () =>
      await page.evaluate(() => (window as any).__OPENED_TAB || '')
    ).toContain('aistudio.google.com');

    const payload = await page.evaluate(() => {
      const calls = (window as any).__GM_CALLS || {};
      const key = Object.keys(calls).find((k) => k.startsWith('ai_studio_prompt_payload:'));
      return key ? String(calls[key]) : '';
    });

    expect((payload.match(/<comment id="c1"/g) || [])).toHaveLength(1);
    expect((payload.match(/<comment id="c2"/g) || [])).toHaveLength(1);
    expect(payload.indexOf('<comment id="c1"')).toBeLessThan(payload.indexOf('<comment id="c2"'));
  });
});
