import { test, expect } from '@playwright/test';
import { getScriptContent, setupMockEnvironment } from './helpers/setup';

test.describe('Power Reader Archive Sync', () => {
    let scriptContent: string;

    test.beforeAll(() => {
        scriptContent = getScriptContent();
    });

    test('incremental sync fetches new items', async ({ page }) => {
        const username = 'Test_User';
        const userId = 'u-test-user';
        
        // Setup initial mock: 1 older post
        const initialPost = {
            _id: 'p1',
            title: 'Old Post',
            slug: 'old-post',
            pageUrl: 'https://lesswrong.com/posts/p1/old-post',
            postedAt: new Date('2023-01-01').toISOString(),
            baseScore: 10,
            voteCount: 5,
            commentCount: 0,
            htmlBody: '<p>Old Body</p>',
            contents: { markdown: 'Old Body' },
            user: { _id: userId, username, displayName: 'Test User', slug: 'test-user', karma: 100 }
        };

        const newPost = {
            _id: 'p2',
            title: 'New Post',
            slug: 'new-post',
            pageUrl: 'https://lesswrong.com/posts/p2/new-post',
            postedAt: new Date('3000-01-01').toISOString(), // Future date to ensure it's > lastSyncDate
            baseScore: 20,
            voteCount: 10,
            commentCount: 0,
            htmlBody: '<p>New Body</p>',
            contents: { markdown: 'New Body' },
            user: { _id: userId, username, displayName: 'Test User', slug: 'test-user', karma: 100 }
        };

        // 1. First Visit
        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    return { data: { user: { _id: '${userId}', username: '${username}' } } };
                }
                if (query.includes('GetUserPosts')) {
                    // Return only old post initially
                    return { data: { posts: { results: [${JSON.stringify(initialPost)}] } } };
                }
                if (query.includes('GetUserComments')) {
                    return { data: { comments: { results: [] } } };
                }
            `
        });

        await page.goto(`https://www.lesswrong.com/reader?view=archive&username=${username}`);
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Verify Old Post is there
        await expect(page.locator('.pr-archive-item h3')).toHaveText('Old Post');
        
        // Verify Status says "Sync complete"
        await expect(page.locator('#archive-status')).toContainText('Sync complete');

        // 2. Second Visit (Reload)
        // We update the mock to return BOTH posts, simulating the API state having changed (or just returning everything)
        // But importantly, the client should validly handle this.
        // Wait, for strict incremental test, we should verify the network request uses minDate logic? 
        // We can't easily spy on network request arguments inside 'onGraphQL' string without console logs or complex setup.
        // But we can check if the UI updates.

        // Update mock to return NEW post as well.
        // IMPORTANT: The loader will fetch ALL posts if we don't implement minDate properly on server side, 
        // but since we are mocking the server response, we can simulate the server returning new posts.
        // If we want to test that the CLIENT filters, we can return both and see if it duplicates?
        // No, we want to test that it fetches and merges.

        await setupMockEnvironment(page, {
            mockHtml: '<html><body><div id="app"></div></body></html>',
            testMode: true,
            onGraphQL: `
                if (query.includes('UserBySlug') || query.includes('user(input:')) {
                    return { data: { user: { _id: '${userId}', username: '${username}' } } };
                }
                if (query.includes('GetUserPosts')) {
                    // Return both posts (Newest first is standard API behavior)
                    return { data: { posts: { results: [${JSON.stringify(newPost)}, ${JSON.stringify(initialPost)}] } } };
                }
                if (query.includes('GetUserComments')) {
                    return { data: { comments: { results: [] } } };
                }
            `
        });

        // We reload the page. IndexedDB should persist in the same Playwright context.
        await page.reload();
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // It should load cache first (Old Post), then sync and find New Post.
        // We expect eventually both to be visible.
        await expect(page.locator('.pr-archive-item')).toHaveCount(2);
        await expect(page.locator('.pr-archive-item h3').first()).toHaveText('New Post');
        await expect(page.locator('#archive-status')).toContainText('Sync complete');
    });
});
