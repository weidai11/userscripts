import { expect, test, type Page } from '@playwright/test';
import { getScriptContent } from './helpers/setup';

interface NativeForumFixture {
  host: 'www.lesswrong.com' | 'forum.effectivealtruism.org' | 'www.greaterwrong.com' | 'ea.greaterwrong.com';
  commentId: string;
  postId: string;
  commentClass: string;
}

interface NativeGraphQLOptions {
  postCommentCount?: number;
  commentDescendentCount?: number;
  getPostDelayMs?: number;
  getCommentDelayMs?: number;
  // Overrides the comment mock's postId (null exercises postIdHint-based post resolution).
  commentPostId?: string | null;
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

const createCommentPermalinkHtml = (
  { commentId, postId }: Pick<NativeForumFixture, 'commentId' | 'postId'>
): string => `
  <!doctype html>
  <html>
    <head><meta charset="utf-8" /></head>
    <body>
      <div class="Header-rightHeaderItems">
        <div class="SearchBar-root">Search</div>
      </div>
      <main>
        <div class="CommentPermalink-root">
          <div class="comments-node CommentFrame-node CommentFrame-answerLeafComment">
            <div class="CommentsItem-root recent-comments-node">
              <div class="CommentsItem-body">
                <div class="CommentsItemMeta-root">
                  <span class="CommentsItemDate-root">
                    <a href="/posts/${postId}/example-post?commentId=${commentId}">
                      <time datetime="2026-03-19T20:07:30.178Z">1d</time>
                    </a>
                  </span>
                </div>
                <div class="CommentBody-root">
                  <p id="permalink-comment-body">Permalink comment ${commentId}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <article id="postBody">
          <h1><a id="post-title-link" href="/posts/${postId}/example-post">Example Post</a></h1>
          <div id="post-body-text">Post body text</div>
        </article>
      </main>
    </body>
  </html>
`;

const createCommentPermalinkWithReplyHtml = (
  { commentId, postId }: Pick<NativeForumFixture, 'commentId' | 'postId'>
): string => `
  <!doctype html>
  <html>
    <head><meta charset="utf-8" /></head>
    <body>
      <div class="Header-rightHeaderItems">
        <div class="SearchBar-root">Search</div>
      </div>
      <main>
        <div class="CommentPermalink-root">
          <div class="comments-node CommentFrame-node CommentFrame-answerLeafComment">
            <div class="CommentsItem-root recent-comments-node">
              <div class="CommentsItem-body">
                <div class="CommentsItemMeta-root">
                  <span class="CommentsItemDate-root">
                    <a href="/posts/${postId}/example-post?commentId=${commentId}">
                      <time datetime="2026-03-19T20:07:30.178Z">1d</time>
                    </a>
                  </span>
                </div>
                <div class="CommentBody-root">
                  <p id="permalink-comment-body-with-reply">Permalink comment ${commentId}</p>
                </div>
              </div>
            </div>
            <div class="comments-node CommentFrame-node CommentFrame-answerLeafComment">
              <div class="CommentsItem-root recent-comments-node">
                <div class="CommentsItem-body">
                  <div class="CommentBody-root">
                    <p id="permalink-reply-body">Visible reply</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <article id="postBody">
          <h1><a id="post-title-link" href="/posts/${postId}/example-post">Example Post</a></h1>
          <div id="post-body-text">Post body text</div>
        </article>
      </main>
    </body>
  </html>
`;

const createGreaterWrongPostHtml = (
  { commentId, postId }: Pick<NativeForumFixture, 'commentId' | 'postId'>
): string => `
  <!doctype html>
  <html>
    <head><meta charset="utf-8" /></head>
    <body class="theme-default">
      <nav id="primary-bar" class="nav-bar nav-bar-top active-bar">
        <span id="nav-item-home" class="nav-item nav-inactive"><a class="nav-inner" href="/">Home</a></span>
      </nav>
      <div id="content" class="post-page comment-thread-page">
        <main class="post">
          <h1 class="post-title">Example Post</h1>
          <div class="post-meta top-post-meta">
            <a class="author" href="/users/author" data-userid="u1">Author</a>
            <a class="comment-count" href="#comments">1 comment</a>
          </div>
          <div class="body-text post-body">
            <p id="gw-post-body-text">Post body text</p>
          </div>
        </main>
        <div id="comments" class="comments">
          <ul class="comment-thread">
            <li id="comment-${commentId}" class="comment-item depth-odd">
              <div class="comment" data-post-id="${postId}">
                <div class="comment-meta">
                  <a class="author" href="/users/author" data-userid="u1">Author</a>
                  <a class="date" href="/posts/${postId}/example-post#comment-${commentId}">Jan 2, 2026</a>
                  <a class="permalink" href="/posts/${postId}/example-post/comment/${commentId}">Permalink</a>
                  <span class="comment-post-title">on: <a id="gw-comment-post-title-link" class="comment-post-title-link" href="/posts/${postId}/example-post">Example Post</a></span>
                </div>
                <div class="body-text comment-body">
                  <p id="gw-comment-body">Comment ${commentId}</p>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </body>
  </html>
`;

const createGreaterWrongCommentPermalinkHtml = (
  { commentId, postId }: Pick<NativeForumFixture, 'commentId' | 'postId'>,
  includeCommentId: boolean = true
): string => `
  <!doctype html>
  <html>
    <head><meta charset="utf-8" /></head>
    <body class="theme-default">
      <div id="content" class="individual-thread-page comment-thread-page">
        <h1 class="post-title">Author comments on Example Post</h1>
        <div id="comments" class="comments">
          <ul class="comment-thread">
            <li ${includeCommentId ? `id="comment-${commentId}"` : ''} class="comment-item depth-odd">
              <div class="comment" data-post-id="${postId}">
                <div class="comment-meta">
                  <a class="author" href="/users/author" data-userid="u1">Author</a>
                  ${includeCommentId ? `<a class="date" href="/posts/${postId}/example-post#comment-${commentId}">Jan 2, 2026</a>` : ''}
                  <a class="permalink" href="/posts/${postId}/example-post/comment/${commentId}">Permalink</a>
                </div>
                <div class="body-text comment-body">
                  <p id="gw-permalink-comment-body">Permalink comment ${commentId}</p>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
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
      postId: options.commentPostId === undefined ? postId : options.commentPostId,
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

const getStoredPayloadByPrefix = async (page: Page, keyPrefix: string): Promise<string | null> =>
  page.evaluate((prefix) => {
    const calls = (window as any).__GM_CALLS || {};
    const key = Object.keys(calls).find((candidate: string) => candidate.startsWith(prefix));
    return key ? String(calls[key]) : null;
  }, keyPrefix);

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

const getGreaterWrongGraphUrl = (host: NativeForumFixture['host']): string =>
  host === 'ea.greaterwrong.com'
    ? 'https://forum.effectivealtruism.org/graphql'
    : 'https://www.lesswrong.com/graphql';

const mockGreaterWrongGraphQL = async (
  page: Page,
  host: NativeForumFixture['host'],
  commentId: string,
  postId: string,
  postTitle: string,
  options: NativeGraphQLOptions = {}
) => {
  const graphUrl = getGreaterWrongGraphUrl(host);
  const graphData = mockGraphQLResponse(commentId, postId, postTitle, options);

  await page.route(graphUrl, async (route) => {
    const body = route.request().postDataJSON() as { query?: string };
    const query = body?.query || '';
    const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

    await page.evaluate(({ url, query: q }) => {
      const win = window as any;
      win.__LAST_GRAPHQL_REQUESTS = win.__LAST_GRAPHQL_REQUESTS || [];
      win.__LAST_GRAPHQL_REQUESTS.push({ url, query: q });
    }, { url: route.request().url(), query });

    if (query.includes('GetComment')) {
      await route.fulfill({ contentType: 'application/json', headers: corsHeaders, body: JSON.stringify({ data: { comment: graphData.comment } }) });
      return;
    }
    if (query.includes('GetPost')) {
      await route.fulfill({ contentType: 'application/json', headers: corsHeaders, body: JSON.stringify({ data: { post: graphData.post } }) });
      return;
    }
    await route.fulfill({ contentType: 'application/json', headers: corsHeaders, body: JSON.stringify({ data: {} }) });
  });
};

const setupGreaterWrongPage = async (
  page: Page,
  fixture: NativeForumFixture,
  options: NativeGraphQLOptions = {},
  pagePath = `/posts/${fixture.postId}/example-post`
) => {
  const { host, commentId, postId } = fixture;
  const pageUrl = `https://${host}${pagePath}`;

  await page.route(pageUrl, async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: createGreaterWrongPostHtml({ commentId, postId }),
    });
  });

  await mockGreaterWrongGraphQL(page, host, commentId, postId, `Post ${postId}`, options);

  await page.goto(pageUrl);
  await installGmMocks(page);

  const scriptContent = getScriptContent();
  await page.evaluate(scriptContent);
  await page.waitForSelector('#content');
};

const setupGreaterWrongCommentPermalinkPage = async (
  page: Page,
  fixture: NativeForumFixture,
  options: NativeGraphQLOptions = {},
  includeCommentId: boolean = true
) => {
  const { host, commentId, postId } = fixture;
  const pageUrl = `https://${host}/posts/${postId}/example-post/comment/${commentId}`;

  await page.route(pageUrl, async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: createGreaterWrongCommentPermalinkHtml({ commentId, postId }, includeCommentId),
    });
  });

  await mockGreaterWrongGraphQL(page, host, commentId, postId, `Post ${postId}`, options);

  await page.goto(pageUrl);
  await installGmMocks(page);

  const scriptContent = getScriptContent();
  await page.evaluate(scriptContent);
  await page.waitForSelector('#content');
};

const createGreaterWrongProfileHtml = (
  { commentId, postId }: Pick<NativeForumFixture, 'commentId' | 'postId'>
): string => `
  <!doctype html>
  <html>
    <head><meta charset="utf-8" /></head>
    <body class="theme-default">
      <div id="content" class="user-page">
        <h1 class="user-name">Author</h1>
        <div id="comments" class="comments">
          <ul class="comment-thread">
            <li id="comment-${commentId}" class="comment-item depth-odd">
              <div class="comment" data-post-id="${postId}">
                <div class="comment-meta">
                  <a class="author" href="/users/author" data-userid="u1">Author</a>
                </div>
                <div class="body-text comment-body">
                  <p id="gw-profile-comment-body">Profile comment ${commentId}</p>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </body>
  </html>
`;

const setupGreaterWrongProfilePage = async (
  page: Page,
  fixture: NativeForumFixture,
  options: NativeGraphQLOptions = {}
) => {
  const { host, commentId, postId } = fixture;
  const pageUrl = `https://${host}/users/author?show=comments`;

  await page.route(pageUrl, async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: createGreaterWrongProfileHtml({ commentId, postId }),
    });
  });

  await mockGreaterWrongGraphQL(page, host, commentId, postId, `Post ${postId}`, options);

  await page.goto(pageUrl);
  await installGmMocks(page);

  const scriptContent = getScriptContent();
  await page.evaluate(scriptContent);
  await page.waitForSelector('#content');
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

  test('[PR-AI-09][PR-HK-08] Comment permalink page: g over comment body sends focal comment thread', async ({ page }) => {
    const host = 'www.lesswrong.com';
    const commentId = 'c-lw-permalink';
    const postId = 'p-lw-permalink';
    const pageUrl = `https://${host}/posts/${postId}/example-post?commentId=${commentId}`;
    const graphUrl = `https://${host}/graphql`;
    const graphData = mockGraphQLResponse(commentId, postId, `Post ${postId}`);

    await page.route(pageUrl, async (route) => {
      await route.fulfill({
        contentType: 'text/html',
        body: createCommentPermalinkHtml({ commentId, postId }),
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

    await page.locator('#permalink-comment-body').hover();
    await page.keyboard.press('g');

    await expect.poll(async () => page.evaluate(() => (window as any).__LAST_TAB_URL)).toContain('aistudio.google.com');
    await expect.poll(async () => getStoredPayloadByPrefix(page, 'ai_studio_prompt_payload:')).not.toBeNull();

    const payload = (await getStoredPayloadByPrefix(page, 'ai_studio_prompt_payload:')) || '';
    expect(payload).toContain(`<comment id="${commentId}"`);
    expect(payload).toMatch(new RegExp(`<comment id="${commentId}"[^>]*is_focal="true"`));
    expect(payload).not.toMatch(new RegExp(`<post id="${postId}"[^>]*is_focal="true"`));
  });

  test('[PR-AI-09][PR-HK-08] Comment permalink with visible reply still resolves focal permalink comment', async ({ page }) => {
    const host = 'www.lesswrong.com';
    const commentId = 'c-lw-permalink-reply';
    const postId = 'p-lw-permalink-reply';
    const pageUrl = `https://${host}/posts/${postId}/example-post?commentId=${commentId}`;
    const graphUrl = `https://${host}/graphql`;
    const graphData = mockGraphQLResponse(commentId, postId, `Post ${postId}`);

    await page.route(pageUrl, async (route) => {
      await route.fulfill({
        contentType: 'text/html',
        body: createCommentPermalinkWithReplyHtml({ commentId, postId }),
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

    await page.locator('#permalink-comment-body-with-reply').hover();
    await page.keyboard.press('g');

    await expect.poll(async () => page.evaluate(() => (window as any).__LAST_TAB_URL)).toContain('aistudio.google.com');
    await expect.poll(async () => getStoredPayloadByPrefix(page, 'ai_studio_prompt_payload:')).not.toBeNull();

    const payload = (await getStoredPayloadByPrefix(page, 'ai_studio_prompt_payload:')) || '';
    expect(payload).toContain(`<comment id="${commentId}"`);
    expect(payload).toMatch(new RegExp(`<comment id="${commentId}"[^>]*is_focal="true"`));
    expect(payload).not.toMatch(new RegExp(`<post id="${postId}"[^>]*is_focal="true"`));
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

  test('[PR-AI-12] GW post page: g sends hovered comment to AI Studio', async ({ page }) => {
    const fixture: NativeForumFixture = {
      host: 'www.greaterwrong.com',
      commentId: 'c-gw-1',
      postId: 'p-gw-1',
      commentClass: 'comment-item',
    };
    await setupGreaterWrongPage(page, fixture);

    await page.locator('#gw-comment-body').hover();
    await page.keyboard.press('g');

    await expect.poll(async () => page.evaluate(() => (window as any).__LAST_TAB_URL)).toContain('aistudio.google.com');
    const payload = (await getStoredPayloadByPrefix(page, 'ai_studio_prompt_payload:')) || '';
    expect(payload).toContain(`<comment id="c-gw-1"`);
    expect(payload).toMatch(new RegExp(`<comment id="c-gw-1"[^>]*is_focal="true"`));
    expect(payload).not.toMatch(new RegExp(`<post id="p-gw-1"[^>]*is_focal="true"`));
  });

  test('[PR-AI-12] GW post page: m over post body sends post to Arena Max', async ({ page }) => {
    const fixture: NativeForumFixture = {
      host: 'www.greaterwrong.com',
      commentId: 'c-gw-2',
      postId: 'p-gw-2',
      commentClass: 'comment-item',
    };
    await setupGreaterWrongPage(page, fixture);

    await page.locator('#gw-post-body-text').hover();
    await page.keyboard.press('m');

    await expect.poll(async () => page.evaluate(() => (window as any).__LAST_TAB_URL)).toContain('arena.ai/max');
    const payload = (await getStoredPayloadByPrefix(page, 'arena_max_prompt_payload:')) || '';
    expect(payload).toContain(`<post id="p-gw-2"`);
    expect(payload).toMatch(new RegExp(`<post id="p-gw-2"[^>]*is_focal="true"`));
  });

  test('[PR-AI-12] GW comment permalink page: g over comment body sends focal comment thread', async ({ page }) => {
    const fixture: NativeForumFixture = {
      host: 'www.greaterwrong.com',
      commentId: 'c-gw-permalink',
      postId: 'p-gw-permalink',
      commentClass: 'comment-item',
    };
    await setupGreaterWrongCommentPermalinkPage(page, fixture);

    await page.locator('#gw-permalink-comment-body').hover();
    await page.keyboard.press('g');

    await expect.poll(async () => page.evaluate(() => (window as any).__LAST_TAB_URL)).toContain('aistudio.google.com');
    const payload = (await getStoredPayloadByPrefix(page, 'ai_studio_prompt_payload:')) || '';
    expect(payload).toContain(`<comment id="c-gw-permalink"`);
    expect(payload).toMatch(new RegExp(`<comment id="c-gw-permalink"[^>]*is_focal="true"`));
    expect(payload).not.toMatch(new RegExp(`<post id="p-gw-permalink"[^>]*is_focal="true"`));
  });

  test('[PR-AI-12] GW permalink comment without container id resolves via /comment/{cid} permalink path', async ({ page }) => {
    const fixture: NativeForumFixture = {
      host: 'www.greaterwrong.com',
      commentId: 'c-gw-path',
      postId: 'p-gw-path',
      commentClass: 'comment-item',
    };
    await setupGreaterWrongCommentPermalinkPage(page, fixture, {}, false);

    await page.locator('#gw-permalink-comment-body').hover();
    await page.keyboard.press('g');

    await expect.poll(async () => page.evaluate(() => (window as any).__LAST_TAB_URL)).toContain('aistudio.google.com');
    const payload = (await getStoredPayloadByPrefix(page, 'ai_studio_prompt_payload:')) || '';
    expect(payload).toContain(`<comment id="c-gw-path"`);
    expect(payload).toMatch(new RegExp(`<comment id="c-gw-path"[^>]*is_focal="true"`));
    expect(payload).not.toMatch(new RegExp(`<post id="p-gw-path"[^>]*is_focal="true"`));
  });

  test('[PR-AI-12] EA GW post page: g sends hovered comment to AI Studio via EAF API', async ({ page }) => {
    const fixture: NativeForumFixture = {
      host: 'ea.greaterwrong.com',
      commentId: 'c-ea-gw-1',
      postId: 'p-ea-gw-1',
      commentClass: 'comment-item',
    };
    await setupGreaterWrongPage(page, fixture);

    await page.locator('#gw-comment-body').hover();
    await page.keyboard.press('g');

    await expect.poll(async () => page.evaluate(() => (window as any).__LAST_TAB_URL)).toContain('aistudio.google.com');
    const payload = (await getStoredPayloadByPrefix(page, 'ai_studio_prompt_payload:')) || '';
    expect(payload).toContain(`<comment id="c-ea-gw-1"`);
    expect(payload).toMatch(new RegExp(`<comment id="c-ea-gw-1"[^>]*is_focal="true"`));
    expect(payload).not.toMatch(new RegExp(`<post id="p-ea-gw-1"[^>]*is_focal="true"`));

    const requests = await page.evaluate(() => (window as any).__LAST_GRAPHQL_REQUESTS || []);
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((r: { url: string }) => r.url === 'https://forum.effectivealtruism.org/graphql')).toBe(true);
    const adaptedQueries = requests.map((r: { query: string }) => r.query);
    expect(adaptedQueries.some((q: string) => q.includes('GetPost') && q.includes('input: $input'))).toBe(true);
  });

  test('[PR-AI-12] GW profile page: postIdHint resolves from data-post-id when URL has no /posts/ segment', async ({ page }) => {
    const fixture: NativeForumFixture = {
      host: 'www.greaterwrong.com',
      commentId: 'c-gw-profile',
      postId: 'p-gw-profile',
      commentClass: 'comment-item',
    };
    await setupGreaterWrongProfilePage(page, fixture, { commentPostId: null });

    await page.locator('#gw-profile-comment-body').hover();
    await page.keyboard.press('Shift+g');

    await expect.poll(async () => page.evaluate(() => (window as any).__LAST_TAB_URL)).toContain('aistudio.google.com');
    const payload = (await getStoredPayloadByPrefix(page, 'ai_studio_prompt_payload:')) || '';
    expect(payload).toContain(`<comment id="c-gw-profile"`);
    expect(payload).toMatch(new RegExp(`<comment id="c-gw-profile"[^>]*is_focal="true"`));
  });
});
