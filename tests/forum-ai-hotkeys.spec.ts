import { expect, test, type Page } from '@playwright/test';
import { getScriptContent } from './helpers/setup';

interface NativeForumFixture {
  host: 'www.lesswrong.com' | 'forum.effectivealtruism.org';
  commentId: string;
  postId: string;
  commentClass: string;
}

interface NativeGraphQLOptions {
  postCommentCount?: number;
  commentDescendentCount?: number;
  getPostDelayMs?: number;
  getCommentDelayMs?: number;
}

const createForumHtml = ({ commentId, postId, commentClass }: NativeForumFixture): string => `
  <!doctype html>
  <html>
    <head><meta charset="utf-8" /></head>
    <body>
      <div class="Header-rightHeaderItems">
        <div class="SearchBar-root">Search</div>
      </div>
      <div id="non-target-zone">Outside target zone</div>
      <main>
        <article id="postBody">
          <h1><a id="post-title-link" href="/posts/${postId}/example-post">Example Post</a></h1>
          <div id="post-body-text">Post body text</div>
          <section class="CommentsList-root">
            <div id="comment-${commentId}" class="${commentClass}">
              <div class="CommentsItem-meta">
                <a href="/posts/${postId}/example-post?commentId=${commentId}">permalink</a>
              </div>
              <div class="CommentsItem-content">
                Comment ${commentId}
                <a id="comment-inline-link" href="/posts/${postId}/example-post?commentId=${commentId}">Inline link</a>
                <button id="comment-inline-button" type="button">Inline button</button>
              </div>
            </div>
          </section>
        </article>
      </main>
    </body>
  </html>
`;

const mockGraphQLResponse = (
  commentId: string,
  postId: string,
  postTitle: string,
  options: NativeGraphQLOptions = {}
) => ({
  comment: {
    result: {
      _id: commentId,
      postedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      htmlBody: `<p>${commentId} html</p>`,
      contents: { markdown: `${commentId} markdown` },
      baseScore: 10,
      voteCount: 1,
      pageUrl: `https://www.lesswrong.com/posts/${postId}/example-post?commentId=${commentId}`,
      author: 'author',
      rejected: false,
      topLevelCommentId: commentId,
      postId,
      parentCommentId: null,
      parentComment: null,
      user: {
        _id: 'u1',
        username: 'Author',
        displayName: 'Author',
        slug: 'author',
        karma: 100,
        htmlBio: '',
      },
      post: {
        _id: postId,
        title: postTitle,
        slug: 'example-post',
        pageUrl: `/posts/${postId}/example-post`,
        postedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        baseScore: 50,
        voteCount: 5,
        commentCount: 1,
        wordCount: 100,
        user: {
          _id: 'u1',
          username: 'Author',
          displayName: 'Author',
          slug: 'author',
          karma: 100,
        },
        extendedScore: null,
        afExtendedScore: null,
        votingSystem: 'twoAxis',
        currentUserVote: null,
        currentUserExtendedVote: null,
      },
      latestChildren: [],
      extendedScore: null,
      afExtendedScore: null,
      votingSystem: 'twoAxis',
      currentUserVote: null,
      currentUserExtendedVote: null,
      descendentCount: options.commentDescendentCount ?? 0,
      directChildrenCount: 0,
    },
  },
  post: {
    result: {
      _id: postId,
      title: postTitle,
      slug: 'example-post',
      pageUrl: `/posts/${postId}/example-post`,
      postedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      baseScore: 50,
      voteCount: 5,
      commentCount: options.postCommentCount ?? 1,
      wordCount: 100,
      user: {
        _id: 'u1',
        username: 'Author',
        displayName: 'Author',
        slug: 'author',
        karma: 100,
      },
      extendedScore: null,
      afExtendedScore: null,
      votingSystem: 'twoAxis',
      currentUserVote: null,
      currentUserExtendedVote: null,
      htmlBody: '<p>post html</p>',
      contents: { markdown: `${postTitle} markdown` },
    },
  },
});

const installGmMocks = async (page: Page) => {
  await page.evaluate(() => {
    const win = window as any;
    const storage: Record<string, any> = {};

    win.__GM_CALLS = {};
    win.__LAST_TAB_URL = null;
    win.__OPEN_TAB_CALLS = [];

    win.GM_setValue = (key: string, value: any) => {
      storage[key] = value;
      win.__GM_CALLS[key] = value;
    };
    win.GM_getValue = (key: string, fallback: any) => (key in storage ? storage[key] : fallback);
    win.GM_deleteValue = (key: string) => {
      delete storage[key];
      delete win.__GM_CALLS[key];
    };
    win.GM_openInTab = (url: string) => {
      win.__LAST_TAB_URL = url;
      win.__OPEN_TAB_CALLS.push(url);
    };
    win.GM_addStyle = (css: string) => {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    };
    win.GM_log = () => {};
    win.GM_xmlhttpRequest = async (options: any) => {
      try {
        const response = await fetch(options.url, {
          method: options.method || 'POST',
          headers: options.headers,
          body: options.data,
        });
        const text = await response.text();
        options.onload?.({ status: response.status, responseText: text });
      } catch (error) {
        options.onerror?.(error);
      }
    };
  });
};

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

const setupNativeForumPage = async (
  page: Page,
  fixture: NativeForumFixture,
  options: NativeGraphQLOptions = {}
) => {
  const { host, commentId, postId } = fixture;
  const pageUrl = `https://${host}/posts/${postId}/example-post`;
  const graphUrl = `https://${host}/graphql`;
  const graphData = mockGraphQLResponse(commentId, postId, `Post ${postId}`, options);

  await page.route(pageUrl, async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: createForumHtml(fixture),
    });
  });

  await page.route(graphUrl, async (route) => {
    const body = route.request().postDataJSON() as { query?: string };
    const query = body?.query || '';

    if (query.includes('GetComment')) {
      const commentDelayMs = options.getCommentDelayMs ?? 0;
      if (commentDelayMs > 0) {
        await delay(commentDelayMs);
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { comment: graphData.comment } }) });
      return;
    }

    if (query.includes('GetPost')) {
      const postDelayMs = options.getPostDelayMs ?? 0;
      if (postDelayMs > 0) {
        await delay(postDelayMs);
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { post: graphData.post } }) });
      return;
    }

    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: {} }) });
  });

  await page.goto(pageUrl);
  await installGmMocks(page);

  const scriptContent = getScriptContent();
  await page.evaluate(scriptContent);
  await expect(page.locator('#pr-reader-link')).toBeVisible();

  const comment = page.locator(`#comment-${commentId}`);
  await comment.hover();
};

const loadNativeForumScript = async (
  page: Page,
  fixture: NativeForumFixture,
  provider: 'ai-studio' | 'arena',
  options: NativeGraphQLOptions = {}
) => {
  await setupNativeForumPage(page, fixture, options);

  const { commentId } = fixture;
  await page.keyboard.press(provider === 'ai-studio' ? 'g' : 'm');

  return { commentId };
};

test.describe('Forum AI Hotkeys', () => {
  test('[PR-AI-01][PR-AI-09][PR-HK-08] LW native page: g sends hovered comment to AI Studio', async ({ page }) => {
    await loadNativeForumScript(page, {
      host: 'www.lesswrong.com',
      commentId: 'c-lw-1',
      postId: 'p-lw-1',
      commentClass: 'comments-node CommentsItem-root',
    }, 'ai-studio');

    await expect.poll(async () => page.evaluate(() => (window as any).__LAST_TAB_URL)).toContain('aistudio.google.com');
    await expect.poll(async () => page.evaluate(() => Object.keys((window as any).__GM_CALLS || {}).find((k: string) => k.startsWith('ai_studio_prompt_payload:')) || null)).not.toBeNull();
  });

  test('[PR-AI-01][PR-AI-09][PR-HK-08] LW native page: m sends hovered comment to Arena Max', async ({ page }) => {
    await loadNativeForumScript(page, {
      host: 'www.lesswrong.com',
      commentId: 'c-lw-2',
      postId: 'p-lw-2',
      commentClass: 'comments-node CommentsItem-root',
    }, 'arena');

    await expect.poll(async () => page.evaluate(() => (window as any).__LAST_TAB_URL)).toContain('arena.ai/max');
    await expect.poll(async () => page.evaluate(() => Object.keys((window as any).__GM_CALLS || {}).find((k: string) => k.startsWith('arena_max_prompt_payload:')) || null)).not.toBeNull();
  });

  test('[PR-AI-09][PR-HK-08] EAF native page parity: g sends hovered comment to AI Studio', async ({ page }) => {
    await loadNativeForumScript(page, {
      host: 'forum.effectivealtruism.org',
      commentId: 'c-eaf-1',
      postId: 'p-eaf-1',
      commentClass: 'CommentFrame-node CommentsItem-root',
    }, 'ai-studio');

    await expect.poll(async () => page.evaluate(() => (window as any).__LAST_TAB_URL)).toContain('aistudio.google.com');
    await expect.poll(async () => page.evaluate(() => Object.keys((window as any).__GM_CALLS || {}).find((k: string) => k.startsWith('ai_studio_prompt_payload:')) || null)).not.toBeNull();
  });

  test('[PR-HK-08] Does not send when pressing g over unrelated area even if URL has commentId', async ({ page }) => {
    const host = 'www.lesswrong.com';
    const commentId = 'c-lw-3';
    const postId = 'p-lw-3';
    const pageUrl = `https://${host}/posts/${postId}/example-post?commentId=${commentId}`;
    const graphUrl = `https://${host}/graphql`;
    const graphData = mockGraphQLResponse(commentId, postId, `Post ${postId}`);

    await page.route(pageUrl, async (route) => {
      await route.fulfill({
        contentType: 'text/html',
        body: createForumHtml({
          host,
          commentId,
          postId,
          commentClass: 'comments-node CommentsItem-root',
        }),
      });
    });

    await page.route(graphUrl, async (route) => {
      const body = route.request().postDataJSON() as { query?: string };
      const query = body?.query || '';
      if (query.includes('GetComment')) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { comment: graphData.comment } }) });
        return;
      }
      if (query.includes('GetPost')) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { post: graphData.post } }) });
        return;
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: {} }) });
    });

    await page.goto(pageUrl);
    await installGmMocks(page);

    const scriptContent = getScriptContent();
    await page.evaluate(scriptContent);
    await expect(page.locator('#pr-reader-link')).toBeVisible();

    await page.locator('#non-target-zone').hover();
    await page.keyboard.press('g');
    await page.waitForTimeout(250);

    const lastTabUrl = await page.evaluate(() => (window as any).__LAST_TAB_URL);
    const aiPayloadKey = await page.evaluate(() =>
      Object.keys((window as any).__GM_CALLS || {}).find((k: string) => k.startsWith('ai_studio_prompt_payload:')) || null
    );

    expect(lastTabUrl).toBeNull();
    expect(aiPayloadKey).toBeNull();
  });

  test('[PR-HK-08] Interactive pointer targets suppress hotkeys (anchor + button)', async ({ page }) => {
    const fixture: NativeForumFixture = {
      host: 'www.lesswrong.com',
      commentId: 'c-lw-interactive',
      postId: 'p-lw-interactive',
      commentClass: 'comments-node CommentsItem-root',
    };
    await setupNativeForumPage(page, fixture);

    await page.locator('#post-title-link').hover();
    await page.keyboard.press('g');
    await page.waitForTimeout(250);

    await page.locator('#comment-inline-button').hover();
    await page.keyboard.press('g');
    await page.waitForTimeout(250);

    const openCount = await page.evaluate(() => ((window as any).__OPEN_TAB_CALLS || []).length);
    expect(openCount).toBe(0);
  });

  test('[PR-HK-08] Double key press while request is in-flight only sends once', async ({ page }) => {
    const fixture: NativeForumFixture = {
      host: 'www.lesswrong.com',
      commentId: 'c-lw-inflight',
      postId: 'p-lw-inflight',
      commentClass: 'comments-node CommentsItem-root',
    };
    await setupNativeForumPage(page, fixture, { getCommentDelayMs: 400 });

    await page.keyboard.press('g');
    await page.keyboard.press('g');

    await expect.poll(async () => page.evaluate(() => ((window as any).__OPEN_TAB_CALLS || []).length)).toBe(1);
  });

  test('[PR-HK-08] Text selection outside target blocks send; inside target allows send', async ({ page }) => {
    const fixture: NativeForumFixture = {
      host: 'www.lesswrong.com',
      commentId: 'c-lw-selection',
      postId: 'p-lw-selection',
      commentClass: 'comments-node CommentsItem-root',
    };
    await setupNativeForumPage(page, fixture);

    await page.evaluate(() => {
      const outside = document.getElementById('non-target-zone');
      const selection = window.getSelection();
      if (!outside || !selection) return;
      const range = document.createRange();
      range.selectNodeContents(outside);
      selection.removeAllRanges();
      selection.addRange(range);
    });

    await page.locator(`#comment-${fixture.commentId}`).hover();
    await page.keyboard.press('g');
    await page.waitForTimeout(250);
    let openCount = await page.evaluate(() => ((window as any).__OPEN_TAB_CALLS || []).length);
    expect(openCount).toBe(0);

    await page.evaluate(() => {
      const inside = document.querySelector('.CommentsItem-content');
      const selection = window.getSelection();
      if (!inside || !selection) return;
      const range = document.createRange();
      range.selectNodeContents(inside);
      selection.removeAllRanges();
      selection.addRange(range);
    });

    await page.locator(`#comment-${fixture.commentId}`).hover();
    await page.keyboard.press('g');
    await expect.poll(async () => page.evaluate(() => ((window as any).__OPEN_TAB_CALLS || []).length)).toBe(1);

    openCount = await page.evaluate(() => ((window as any).__OPEN_TAB_CALLS || []).length);
    expect(openCount).toBe(1);
  });

  test('[PR-AI-04][PR-HK-08] Shift-G prompt cancels on navigation and does not send', async ({ page }) => {
    const fixture: NativeForumFixture = {
      host: 'www.lesswrong.com',
      commentId: 'c-lw-nav-cancel',
      postId: 'p-lw-nav-cancel',
      commentClass: 'comments-node CommentsItem-root',
    };
    await setupNativeForumPage(page, fixture, { postCommentCount: 150 });

    await page.locator('#post-body-text').hover();
    await page.keyboard.press('Shift+g');

    await expect(page.locator('#pr-descendant-confirm-overlay')).toBeVisible();

    await page.evaluate(() => {
      history.pushState({}, '', '/posts/p-lw-nav-cancel/after-nav');
    });

    await expect(page.locator('#pr-descendant-confirm-overlay')).toHaveCount(0);

    const openCount = await page.evaluate(() => ((window as any).__OPEN_TAB_CALLS || []).length);
    expect(openCount).toBe(0);
  });
});
