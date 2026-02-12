import { test, expect } from '@playwright/test';
import { PowerReaderPage } from './pages/PowerReaderPage';
import { initPowerReader } from './helpers/setup';

test('[PR-DATA-01][PR-DATA-02][PR-LOAD-01][PR-LOAD-02][PR-LOAD-03][PR-LOAD-04][PR-VIS-04][PR-AUTH-01][PR-AUTH-02][PR-THREAD-01][PR-THREAD-02][PR-USER-01][PR-USER-02] Power Reader /reader page fetches and displays comments', async ({ page }) => {
    const comments = [
        {
            _id: 'test-id-1',
            postId: 'p1',
            pageUrl: 'https://www.lesswrong.com/posts/p1/comment/test-id-1',
            htmlBody: '<p>This is a mock comment body.</p>',
            postedAt: new Date().toISOString(),
            baseScore: 10,
            parentCommentId: null,
            user: { _id: 'u1', slug: 'user-1', username: 'MockUser1' },
            post: { _id: 'p1', title: 'Mock Post Title', slug: 'mock-post' },
            parentComment: null
        },
        {
            _id: 'test-id-2',
            postId: 'p1',
            pageUrl: 'https://www.lesswrong.com/posts/p1/comment/test-id-2',
            htmlBody: '<p>This is a reply to TestUser.</p>',
            postedAt: new Date().toISOString(),
            baseScore: 5,
            parentCommentId: 'test-id-1',
            user: { _id: 'u2', slug: 'user-2', username: 'MockUser2' },
            post: { _id: 'p1', title: 'Mock Post Title', slug: 'mock-post' },
            parentComment: {
                user: { _id: 'test-user-id', username: 'TestUser' }
            }
        }
    ];

    const posts = [
        {
            _id: 'p1',
            title: 'Mock Post Title',
            htmlBody: '<p>Mock post body content</p>',
            postedAt: new Date().toISOString(),
            user: { _id: 'u1', username: 'MockUser1' }
        }
    ];

    await initPowerReader(page, {
        testMode: true,
        comments,
        posts,
        currentUser: {
            _id: 'test-user-id',
            username: 'TestUser',
            slug: 'test-user'
        }
    });

    const prPage = new PowerReaderPage(page);

    // Verify the header
    await expect(prPage.header).toContainText('Power Reader');

    // Verify comments are displayed
    await expect(prPage.comments).toHaveCount(2);

    // Use data-id to target the specific parent comment
    const parentComment = page.locator('.pr-comment[data-id="test-id-1"]');
    await expect(parentComment.locator('> .pr-comment-meta .pr-author')).toContainText('MockUser1');
    await expect(parentComment.locator('> .pr-comment-body')).toContainText('This is a mock comment body.');

    // Verify "reply to you" styling (second comment replies to TestUser)
    const replyComment = page.locator('.pr-comment[data-id="test-id-2"]');
    await expect(replyComment).toHaveClass(/reply-to-you/);

    // Verify author controls are present
    await expect(page.locator('.pr-author-up').first()).toBeVisible();
    await expect(page.locator('.pr-author-down').first()).toBeVisible();
});

test('[PR-URL-01] Power Reader should not activate on non-/reader paths', async ({ page }) => {
    // Navigate to homepage first
    await page.route('https://www.lesswrong.com/', route => {
        route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: '<html><head><title>LessWrong Home</title></head><body><div id="home-content">Home Page</div></body></html>'
        });
    });

    await page.goto('https://www.lesswrong.com/');

    // Inject userscript manually to test LACK of activation
    const { getScriptContent } = await import('./helpers/setup');
    const scriptContent = getScriptContent();
    await page.evaluate(scriptContent);

    // Wait and verify NO UI is rendered
    await page.waitForTimeout(1000);
    const hasRoot = await page.evaluate(() => !!document.getElementById('power-reader-root'));
    const isReady = await page.evaluate(() => !!document.getElementById('lw-power-reader-ready-signal'));

    expect(hasRoot).toBe(false);
    expect(isReady).toBe(false);

    // Title should NOT be changed
    const title = await page.title();
    expect(title).toBe('LessWrong Home');
});
