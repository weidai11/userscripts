import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Coverage Gap Filling', () => {
    test.beforeAll(() => {
    });

    test('[PR-HELP-05][PR-HELP-06] Help panel layout and content', async ({ page }) => {
        await initPowerReader(page, {
            comments: [{ _id: 'c1', postId: 'p1', htmlBody: 'C', user: { username: 'A' }, postedAt: new Date().toISOString() }],
            testMode: true
        });

        const helpContent = page.locator('.pr-help-content');
        await expect(helpContent).toHaveClass(/pr-help-columns/);

        // Verify some "new buttons" are documented
        const helpText = await helpContent.textContent();
        expect(helpText).toContain('Load replies');
        expect(helpText).toContain('Trace to root');
        expect(helpText).toContain('load parents');
        expect(helpText).toContain('Find parent');
    });

    test('[PR-GQL-01] GET_POST_COMMENTS usage in Load All Comments', async ({ page }) => {
        const posts = [{ _id: 'p1', title: 'Post 1', htmlBody: 'Body', commentCount: 2 }];
        const initialComments = [{ _id: 'c1', postId: 'p1', htmlBody: 'C1', user: { username: 'A' }, postedAt: new Date().toISOString() }];
        const extraComments = [
            { _id: 'c1', postId: 'p1', htmlBody: 'C1', user: { username: 'A' }, postedAt: new Date().toISOString() },
            { _id: 'c2', postId: 'p1', htmlBody: 'Extra', user: { username: 'B' }, postedAt: new Date().toISOString() }
        ];

        let gqlCalled = false;
        await initPowerReader(page, {
            posts,
            comments: initialComments,
            testMode: true,
            verbose: true,
            onGraphQL: `
                if (query.includes('query GetPostComments')) {
                    window.__GQL_CALLED__ = true;
                    return { data: { comments: { results: ${JSON.stringify(extraComments)} } } };
                }
            `
        });

        const btn = page.locator('.pr-post[data-id="p1"] [data-action="load-all-comments"]');

        // Wait for it to be ready
        await expect(btn).toBeVisible();
        const title = await btn.getAttribute('title');

        // If it's still disabled, we have a logic bug
        await expect(btn).not.toHaveClass(/disabled/);

        await btn.click();

        // Wait for loading to finish (text changes back to [a])
        await expect(btn).toHaveText('[a]', { timeout: 15000 });

        // Check if GQL was called
        await page.waitForSelector('.pr-comment[data-id="c2"]', { timeout: 15000 });
        const wasCalled = await page.evaluate(() => (window as any).__GQL_CALLED__);
        expect(wasCalled).toBe(true);
    });

    test('[PR-GQL-02] GET_THREAD_COMMENTS usage in Load Thread', async ({ page }) => {
        const comments = [
            { _id: 'c1', postId: 'p1', htmlBody: 'C1', user: { username: 'A' }, postedAt: new Date().toISOString() },
            { _id: 'c2', postId: 'p1', parentCommentId: 'c1', htmlBody: 'C2', user: { username: 'B' }, postedAt: new Date().toISOString(), directChildrenCount: 1 }
        ];
        const threadComments = [
            ...comments,
            { _id: 'c3', postId: 'p1', parentCommentId: 'c2', htmlBody: 'C3', user: { username: 'C' }, postedAt: new Date().toISOString() }
        ];

        await initPowerReader(page, {
            comments,
            testMode: true,
            onGraphQL: `
                if (query.includes('query GetThreadComments')) {
                    window.__GQL_CALLED_THREAD__ = true;
                    return { data: { comments: { results: ${JSON.stringify(threadComments)} } } };
                }
            `
        });

        // Trigger Load Thread via [r] (load-descendants)
        const btn = page.locator('.pr-comment[data-id="c2"] [data-action="load-descendants"]');
        await btn.click();

        // Check if GQL was called
        await page.waitForSelector('.pr-comment[data-id="c3"]', { timeout: 10000 });
        const wasCalled = await page.evaluate(() => (window as any).__GQL_CALLED_THREAD__);
        expect(wasCalled).toBe(true);
    });
});
