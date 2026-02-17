import { test, expect } from '@playwright/test';
import { getScriptContent, setupMockEnvironment } from './helpers/setup';

test.describe('User Archive Context Type & View Modes', () => {
  let scriptContent: string;

  test.beforeAll(() => {
    scriptContent = getScriptContent();
  });

  test('[PR-UARCH-27] contextType enum replaces boolean flags', async ({ page }) => {
    const userId = 'u-test-user';
    const username = 'TestUser';
    
    // Create a comment with parentComment chain
    const childComment = {
      _id: 'comment-child',
      postedAt: '2024-01-15T12:00:00Z',
      htmlBody: '<p>Child comment</p>',
      baseScore: 10,
      voteCount: 2,
      author: 'TestUser',
      postId: 'post-1',
      topLevelCommentId: 'comment-root',
      parentCommentId: 'comment-parent',
      parentComment: {
        _id: 'comment-parent',
        postedAt: '2024-01-15T11:00:00Z',
        parentCommentId: null,
        user: { _id: 'u-other', username: 'OtherUser', displayName: 'Other User' }
      },
      user: { _id: userId, username, displayName: 'Test User', slug: 'testuser', karma: 100 },
      pageUrl: 'https://lesswrong.com/posts/post-1/comment-child',
      contents: { markdown: 'Child comment' }
    };

    await setupMockEnvironment(page, {
      mockHtml: '<html><body><div id="app"></div></body></html>',
      testMode: true,
      onGraphQL: `
        if (query.includes('UserBySlug') || query.includes('user(input:')) {
          return { data: { user: { _id: '${userId}', username: '${username}', displayName: 'Test User' } } };
        }
        if (query.includes('GetUserPosts')) {
          return { data: { posts: { results: [] } } };
        }
        if (query.includes('GetUserComments')) {
          return { data: { comments: { results: [${JSON.stringify(childComment)}] } } };
        }
        if (query.includes('GetCommentsByIds')) {
          // Simulate fetched parent
          return { data: { comments: { results: [{
            _id: 'comment-parent',
            postedAt: '2024-01-15T11:00:00Z',
            htmlBody: '<p>Parent content</p>',
            baseScore: 20,
            voteCount: 5,
            author: 'OtherUser',
            postId: 'post-1',
            topLevelCommentId: 'comment-root',
            parentCommentId: null,
            user: { _id: 'u-other', username: 'OtherUser', displayName: 'Other User', slug: 'otheruser', karma: 50 },
            pageUrl: 'https://lesswrong.com/posts/post-1/comment-parent',
            contents: { markdown: 'Parent content' }
          }] } } };
        }
      `
    });

    await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`);
    await page.evaluate(scriptContent);
    await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

    // Switch to thread-full view to trigger context fetching
    await page.locator('#archive-view').selectOption('thread-full');
    await page.waitForTimeout(500);

    // Verify parent context was fetched and rendered
    await expect(page.locator('.pr-comment[data-id="comment-parent"]')).toBeVisible();
    await expect(page.locator('.pr-comment[data-id="comment-parent"]').first()).toHaveClass(/context/);
  });

  test('[PR-UARCH-28] thread-full fetches context from server', async ({ page }) => {
    const userId = 'u-test-user';
    const username = 'TestUser';

    const childComment = {
      _id: 'comment-child',
      postedAt: '2024-01-15T12:00:00Z',
      htmlBody: '<p>Child comment</p>',
      baseScore: 10,
      voteCount: 2,
      author: 'TestUser',
      postId: 'post-1',
      topLevelCommentId: 'comment-root',
      parentCommentId: 'comment-parent',
      parentComment: {
        _id: 'comment-parent',
        postedAt: '2024-01-15T11:00:00Z',
        parentCommentId: null,
        user: { _id: 'u-other', username: 'OtherUser', displayName: 'Other User' }
      },
      user: { _id: userId, username, displayName: 'Test User', slug: 'testuser', karma: 100 },
      pageUrl: 'https://lesswrong.com/posts/post-1/comment-child',
      contents: { markdown: 'Child comment' }
    };

    await setupMockEnvironment(page, {
      mockHtml: '<html><body><div id="app"></div></body></html>',
      testMode: true,
      onGraphQL: `
        if (query.includes('UserBySlug') || query.includes('user(input:')) {
          return { data: { user: { _id: '${userId}', username: '${username}', displayName: 'Test User' } } };
        }
        if (query.includes('GetUserPosts')) {
          return { data: { posts: { results: [] } } };
        }
        if (query.includes('GetUserComments')) {
          return { data: { comments: { results: [${JSON.stringify(childComment)}] } } };
        }
        if (query.includes('GetCommentsByIds')) {
          window.__TEST_FETCH_COUNT__ = (window.__TEST_FETCH_COUNT__ || 0) + 1;
          return { data: { comments: { results: [{
            _id: 'comment-parent',
            postedAt: '2024-01-15T11:00:00Z',
            htmlBody: '<p>Fetched parent content</p>',
            baseScore: 20,
            voteCount: 5,
            author: 'OtherUser',
            postId: 'post-1',
            topLevelCommentId: 'comment-root',
            parentCommentId: null,
            user: { _id: 'u-other', username: 'OtherUser', displayName: 'Other User', slug: 'otheruser', karma: 50 },
            pageUrl: 'https://lesswrong.com/posts/post-1/comment-parent',
            contents: { markdown: 'Fetched parent content' }
          }] } } };
        }
      `
    });

    await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`);
    await page.evaluate(scriptContent);
    await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

    // Initialize fetch counter
    await page.evaluate(() => { (window as any).__TEST_FETCH_COUNT__ = 0; });

    // Switch to thread-full view
    await page.locator('#archive-view').selectOption('thread-full');
    await page.waitForTimeout(500);

    // Verify server fetch occurred
    const fetchCount = await page.evaluate(() => (window as any).__TEST_FETCH_COUNT__);
    expect(fetchCount).toBeGreaterThan(0);

    // Verify parent rendered with full content
    await expect(page.locator('.pr-comment[data-id="comment-parent"] > .pr-comment-body').first()).toContainText('Fetched parent content');
  });

  test('[PR-UARCH-28] thread-placeholder creates local stubs without network', async ({ page }) => {
    const userId = 'u-test-user';
    const username = 'TestUser';

    const childComment = {
      _id: 'comment-child',
      postedAt: '2024-01-15T12:00:00Z',
      htmlBody: '<p>Child comment</p>',
      baseScore: 10,
      voteCount: 2,
      author: 'TestUser',
      postId: 'post-1',
      topLevelCommentId: 'comment-root',
      parentCommentId: 'comment-parent',
      parentComment: {
        _id: 'comment-parent',
        postedAt: '2024-01-15T11:00:00Z',
        parentCommentId: null,
        user: { _id: 'u-other', username: 'OtherUser', displayName: 'Other User' }
      },
      user: { _id: userId, username, displayName: 'Test User', slug: 'testuser', karma: 100 },
      pageUrl: 'https://lesswrong.com/posts/post-1/comment-child',
      contents: { markdown: 'Child comment' }
    };

    await setupMockEnvironment(page, {
      mockHtml: '<html><body><div id="app"></div></body></html>',
      testMode: true,
      onGraphQL: `
        if (query.includes('UserBySlug') || query.includes('user(input:')) {
          return { data: { user: { _id: '${userId}', username: '${username}', displayName: 'Test User' } } };
        }
        if (query.includes('GetUserPosts')) {
          return { data: { posts: { results: [] } } };
        }
        if (query.includes('GetUserComments')) {
          return { data: { comments: { results: [${JSON.stringify(childComment)}] } } };
        }
        if (query.includes('GetCommentsByIds')) {
          // Should NOT be called in placeholder mode
          window.__TEST_FETCH_COUNT__ = (window.__TEST_FETCH_COUNT__ || 0) + 1;
          return { data: { comments: { results: [] } } };
        }
      `
    });

    await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`);
    await page.evaluate(scriptContent);
    await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

    // Initialize fetch counter
    await page.evaluate(() => { (window as any).__TEST_FETCH_COUNT__ = 0; });

    // Switch to thread-placeholder view
    await page.locator('#archive-view').selectOption('thread-placeholder');
    await page.waitForTimeout(500);

    // Verify NO server fetch occurred
    const fetchCount = await page.evaluate(() => (window as any).__TEST_FETCH_COUNT__);
    expect(fetchCount).toBe(0);

    // Verify parent stub rendered with placeholder styling
    const parentStub = page.locator('.pr-context-placeholder[data-id="comment-parent"]');
    await expect(parentStub).toBeVisible();
    await expect(parentStub.locator('.pr-comment-meta').first()).toContainText('Other User');
  });

  test('[PR-UARCH-29] card view shows parent context stub', async ({ page }) => {
    const userId = 'u-test-user';
    const username = 'TestUser';

    const childComment = {
      _id: 'comment-child',
      postedAt: '2024-01-15T12:00:00Z',
      htmlBody: '<p>Child comment with parent context</p>',
      baseScore: 10,
      voteCount: 2,
      author: 'TestUser',
      postId: 'post-1',
      topLevelCommentId: 'comment-root',
      parentCommentId: 'comment-parent',
      parentComment: {
        _id: 'comment-parent',
        postedAt: '2024-01-15T11:00:00Z',
        parentCommentId: null,
        user: { _id: 'u-other', username: 'ParentAuthor', displayName: 'Parent Author' }
      },
      user: { _id: userId, username, displayName: 'Test User', slug: 'testuser', karma: 100 },
      pageUrl: 'https://lesswrong.com/posts/post-1/comment-child',
      contents: { markdown: 'Child comment with parent context' }
    };

    await setupMockEnvironment(page, {
      mockHtml: '<html><body><div id="app"></div></body></html>',
      testMode: true,
      onGraphQL: `
        if (query.includes('UserBySlug') || query.includes('user(input:')) {
          return { data: { user: { _id: '${userId}', username: '${username}', displayName: 'Test User' } } };
        }
        if (query.includes('GetUserPosts')) {
          return { data: { posts: { results: [] } } };
        }
        if (query.includes('GetUserComments')) {
          return { data: { comments: { results: [${JSON.stringify(childComment)}] } } };
        }
      `
    });

    await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`);
    await page.evaluate(scriptContent);
    await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

    // Verify card view is active
    await expect(page.locator('#archive-view')).toHaveValue('card');

    // Verify child comment has parent context stub before it
    const card = page.locator('.pr-comment[data-id="comment-child"]');
    await expect(card).toBeVisible();

    // Verify parent context stub exists
    const parentStub = page.locator('.pr-context-placeholder[data-id="comment-parent"]');
    await expect(parentStub).toBeVisible();
    await expect(parentStub.locator('.pr-author')).toContainText('Parent Author');

    // Verify stub has reduced opacity styling (placeholder)
    const stubStyle = await parentStub.evaluate(el => window.getComputedStyle(el).opacity);
    expect(parseFloat(stubStyle)).toBeLessThan(1);
  });

  test('[PR-UARCH-30] index view click-to-expand', async ({ page }) => {
    const userId = 'u-test-user';
    const username = 'TestUser';

    const testComment = {
      _id: 'comment-test',
      postedAt: '2024-01-15T12:00:00Z',
      htmlBody: '<p>Test comment content for expansion</p>',
      baseScore: 15,
      voteCount: 3,
      author: 'TestUser',
      postId: 'post-1',
      topLevelCommentId: 'comment-test',
      parentCommentId: null,
      user: { _id: userId, username, displayName: 'Test User', slug: 'testuser', karma: 100 },
      pageUrl: 'https://lesswrong.com/posts/post-1/comment-test',
      contents: { markdown: 'Test comment content for expansion' }
    };

    await setupMockEnvironment(page, {
      mockHtml: '<html><body><div id="app"></div></body></html>',
      testMode: true,
      onGraphQL: `
        if (query.includes('UserBySlug') || query.includes('user(input:')) {
          return { data: { user: { _id: '${userId}', username: '${username}', displayName: 'Test User' } } };
        }
        if (query.includes('GetUserPosts')) {
          return { data: { posts: { results: [] } } };
        }
        if (query.includes('GetUserComments')) {
          return { data: { comments: { results: [${JSON.stringify(testComment)}] } } };
        }
      `
    });

    await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`);
    await page.evaluate(scriptContent);
    await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

    // Switch to index view
    await page.locator('#archive-view').selectOption('index');
    await page.waitForTimeout(300);

    // Verify index row exists
    const indexRow = page.locator('.pr-archive-index-item[data-id="comment-test"]');
    await expect(indexRow).toBeVisible();

    // Click to expand
    await indexRow.click();
    await page.waitForTimeout(300);

    // Verify expanded to card view
    await expect(page.locator('.pr-index-expanded[data-id="comment-test"]')).toBeVisible();
    await expect(page.locator('.pr-comment[data-id="comment-test"]')).toBeVisible();
    await expect(page.locator('.pr-comment[data-id="comment-test"] .pr-comment-body')).toContainText('Test comment content for expansion');

    // Click collapse button
    await page.locator('.pr-index-collapse-btn[data-id="comment-test"]').click();
    await page.waitForTimeout(300);

    // Verify back to index row
    await expect(page.locator('.pr-archive-index-item[data-id="comment-test"]')).toBeVisible();
    await expect(page.locator('.pr-index-expanded[data-id="comment-test"]')).not.toBeVisible();
  });

  test('[PR-UARCH-31] stub context renders without vote buttons', async ({ page }) => {
    const userId = 'u-test-user';
    const username = 'TestUser';

    const childComment = {
      _id: 'comment-child',
      postedAt: '2024-01-15T12:00:00Z',
      htmlBody: '<p>Child comment</p>',
      baseScore: 10,
      voteCount: 2,
      author: 'TestUser',
      postId: 'post-1',
      topLevelCommentId: 'comment-root',
      parentCommentId: 'comment-parent',
      parentComment: {
        _id: 'comment-parent',
        postedAt: '2024-01-15T11:00:00Z',
        parentCommentId: null,
        user: { _id: 'u-other', username: 'ParentAuthor', displayName: 'Parent Author' }
      },
      user: { _id: userId, username, displayName: 'Test User', slug: 'testuser', karma: 100 },
      pageUrl: 'https://lesswrong.com/posts/post-1/comment-child',
      contents: { markdown: 'Child comment' }
    };

    await setupMockEnvironment(page, {
      mockHtml: '<html><body><div id="app"></div></body></html>',
      testMode: true,
      onGraphQL: `
        if (query.includes('UserBySlug') || query.includes('user(input:')) {
          return { data: { user: { _id: '${userId}', username: '${username}', displayName: 'Test User' } } };
        }
        if (query.includes('GetUserPosts')) {
          return { data: { posts: { results: [] } } };
        }
        if (query.includes('GetUserComments')) {
          return { data: { comments: { results: [${JSON.stringify(childComment)}] } } };
        }
      `
    });

    await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`);
    await page.evaluate(scriptContent);
    await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

    // Switch to card view
    await page.locator('#archive-view').selectOption('card');
    await page.waitForTimeout(300);

    // Get parent stub
    const parentStub = page.locator('.pr-context-placeholder[data-id="comment-parent"]');
    await expect(parentStub).toBeVisible();

    // Verify no vote buttons in stub (should have no .pr-vote elements)
    const voteButtons = parentStub.locator('.pr-vote');
    await expect(voteButtons).toHaveCount(0);

    // Verify no comment body (just metadata)
    const commentBody = parentStub.locator('.pr-comment-body');
    await expect(commentBody).toHaveCount(0);
  });

  test('[PR-UARCH-32] context persists across view switches', async ({ page }) => {
    const userId = 'u-test-user';
    const username = 'TestUser';

    const childComment = {
      _id: 'comment-child',
      postedAt: '2024-01-15T12:00:00Z',
      htmlBody: '<p>Child comment</p>',
      baseScore: 10,
      voteCount: 2,
      author: 'TestUser',
      postId: 'post-1',
      topLevelCommentId: 'comment-root',
      parentCommentId: 'comment-parent',
      parentComment: {
        _id: 'comment-parent',
        postedAt: '2024-01-15T11:00:00Z',
        parentCommentId: null,
        user: { _id: 'u-other', username: 'OtherUser', displayName: 'Other User' }
      },
      user: { _id: userId, username, displayName: 'Test User', slug: 'testuser', karma: 100 },
      pageUrl: 'https://lesswrong.com/posts/post-1/comment-child',
      contents: { markdown: 'Child comment' }
    };

    await setupMockEnvironment(page, {
      mockHtml: '<html><body><div id="app"></div></body></html>',
      testMode: true,
      onGraphQL: `
        if (query.includes('UserBySlug') || query.includes('user(input:')) {
          return { data: { user: { _id: '${userId}', username: '${username}', displayName: 'Test User' } } };
        }
        if (query.includes('GetUserPosts')) {
          return { data: { posts: { results: [] } } };
        }
        if (query.includes('GetUserComments')) {
          return { data: { comments: { results: [${JSON.stringify(childComment)}] } } };
        }
        if (query.includes('GetCommentsByIds')) {
          window.__TEST_FETCH_COUNT__ = (window.__TEST_FETCH_COUNT__ || 0) + 1;
          return { data: { comments: { results: [{
            _id: 'comment-parent',
            postedAt: '2024-01-15T11:00:00Z',
            htmlBody: '<p>Parent content</p>',
            baseScore: 20,
            voteCount: 5,
            author: 'OtherUser',
            postId: 'post-1',
            topLevelCommentId: 'comment-root',
            parentCommentId: null,
            user: { _id: 'u-other', username: 'OtherUser', displayName: 'Other User', slug: 'otheruser', karma: 50 },
            pageUrl: 'https://lesswrong.com/posts/post-1/comment-parent',
            contents: { markdown: 'Parent content' }
          }] } } };
        }
      `
    });

    await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`);
    await page.evaluate(scriptContent);
    await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

    // Initialize fetch counter
    await page.evaluate(() => { (window as any).__TEST_FETCH_COUNT__ = 0; });

    // Switch to thread-full (triggers fetch)
    await page.locator('#archive-view').selectOption('thread-full');
    await page.waitForTimeout(500);

    // Verify fetch occurred
    const fetchCountAfterFirst = await page.evaluate(() => (window as any).__TEST_FETCH_COUNT__);
    expect(fetchCountAfterFirst).toBeGreaterThan(0);

    // Verify context loaded
    await expect(page.locator('.pr-comment[data-id="comment-parent"]')).toBeVisible();

    // Switch to card view
    await page.locator('#archive-view').selectOption('card');
    await page.waitForTimeout(300);

    // Verify context still exists (not re-fetched but persisted)
    const fetchCountAfterCard = await page.evaluate(() => (window as any).__TEST_FETCH_COUNT__);
    expect(fetchCountAfterCard).toBe(fetchCountAfterFirst); // No additional fetches

    // Switch back to thread-full
    await page.locator('#archive-view').selectOption('thread-full');
    await page.waitForTimeout(300);

    // Verify still no additional fetches
    const fetchCountAfterReturn = await page.evaluate(() => (window as any).__TEST_FETCH_COUNT__);
    expect(fetchCountAfterReturn).toBe(fetchCountAfterFirst);

    // Verify parent is still visible (persisted context)
    await expect(page.locator('.pr-comment[data-id="comment-parent"]').first()).toBeVisible();
  });

  test('[PR-UARCH-33] isThreadMode helper identifies thread variants', async ({ page }) => {
    const userId = 'u-test-user';
    const username = 'TestUser';

    await setupMockEnvironment(page, {
      mockHtml: '<html><body><div id="app"></div></body></html>',
      testMode: true,
      onGraphQL: `
        if (query.includes('UserBySlug') || query.includes('user(input:')) {
          return { data: { user: { _id: '${userId}', username: '${username}', displayName: 'Test User' } } };
        }
        if (query.includes('GetUserPosts') || query.includes('GetUserComments')) {
          return { data: { posts: { results: [] }, comments: { results: [] } } };
        }
      `
    });

    await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`);
    await page.evaluate(scriptContent);
    await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

    // Verify thread modes disable Reply To sort option
    await page.locator('#archive-view').selectOption('card');
    await page.waitForTimeout(200);
    
    // Reply To should be enabled in card view
    const replyToOptionCard = await page.locator('#archive-sort option[value="replyTo"]').evaluate(el => (el as HTMLOptionElement).disabled);
    expect(replyToOptionCard).toBe(false);

    // Switch to thread-full
    await page.locator('#archive-view').selectOption('thread-full');
    await page.waitForTimeout(200);

    // Reply To should be disabled in thread view
    const replyToOptionThread = await page.locator('#archive-sort option[value="replyTo"]').evaluate(el => (el as HTMLOptionElement).disabled);
    expect(replyToOptionThread).toBe(true);

    // Switch to thread-placeholder
    await page.locator('#archive-view').selectOption('thread-placeholder');
    await page.waitForTimeout(200);

    // Reply To should still be disabled
    const replyToOptionPlaceholder = await page.locator('#archive-sort option[value="replyTo"]').evaluate(el => (el as HTMLOptionElement).disabled);
    expect(replyToOptionPlaceholder).toBe(true);
  });
});
