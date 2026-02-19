import { test, expect } from '@playwright/test';
import { setupMockEnvironment, initPowerReader } from './helpers/setup';

test.describe('Reproduction: [t] failing to show parent content', () => {

    test('should show entire ancestry chain when [t] is clicked', async ({ page }) => {
        // C1 (root) -> C2 (grandparent) -> C3 (parent) -> C4 (unread)
        const post = { _id: 'p1', title: 'Post' };
        
        // Initial load: only C4 and Post
        const initialComments = [
            { 
                _id: 'c4', postId: 'p1', parentCommentId: 'c3', htmlBody: 'Unread Comment', 
                postedAt: new Date().toISOString(), baseScore: 10,
                user: { username: 'Author4' }, topLevelCommentId: 'c1'
            }
        ];

        const fullAncestry = [
            { _id: 'c1', postId: 'p1', htmlBody: 'Root Comment', postedAt: new Date(Date.now() - 3000).toISOString(), user: { username: 'Author1' } },
            { _id: 'c2', postId: 'p1', parentCommentId: 'c1', htmlBody: 'Grandparent Comment', postedAt: new Date(Date.now() - 2000).toISOString(), user: { username: 'Author2' } },
            { _id: 'c3', postId: 'p1', parentCommentId: 'c2', htmlBody: 'Parent Comment', postedAt: new Date(Date.now() - 1000).toISOString(), user: { username: 'Author3' } },
            initialComments[0]
        ];

        await initPowerReader(page, { 
            posts: [post], 
            comments: initialComments,
            testMode: true,
            onGraphQL: `
                if (query.includes('query GetCommentsByIds')) {
                    const ids = variables.commentIds;
                    const results = ${JSON.stringify(fullAncestry)}.filter(c => ids.includes(c._id));
                    return { data: { comments: { results } } };
                }
            `
        });

        // Initially C4 is visible, C3 is a placeholder, C2 and C1 are invisible
        await expect(page.locator('.pr-comment[data-id="c4"]')).toBeVisible();
        await expect(page.locator('.pr-comment[data-id="c3"]')).toHaveClass(/pr-missing-parent/);
        await expect(page.locator('.pr-comment[data-id="c2"]')).not.toBeAttached();
        await expect(page.locator('.pr-comment[data-id="c1"]')).not.toBeAttached();

        // Click [t] on C4
        const btnT = page.locator('.pr-comment[data-id="c4"] [data-action="load-parents-and-scroll"]');
        await btnT.click();

        // Wait for fetch and re-render
        // BUG: Currently C2 and C1 will likely NOT be visible because buildPostGroups filters them out
        await expect(page.locator('.pr-comment[data-id="c1"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.pr-comment[data-id="c2"]')).toBeVisible();
        await expect(page.locator('.pr-comment[data-id="c3"]')).toBeVisible();
        await expect(page.locator('.pr-comment[data-id="c3"]')).not.toHaveClass(/pr-missing-parent/);

        // Check for animation class on newly revealed parents
        await expect(page.locator('.pr-comment[data-id="c1"]')).toHaveClass(/pr-just-revealed/);
        await expect(page.locator('.pr-comment[data-id="c2"]')).toHaveClass(/pr-just-revealed/);
        await expect(page.locator('.pr-comment[data-id="c3"]')).toHaveClass(/pr-just-revealed/);
    });

    test('should show ancestors even if they are already marked as read', async ({ page }) => {
        const post = { _id: 'p1', title: 'Post' };
        const initialComments = [
            { 
                _id: 'c2', postId: 'p1', parentCommentId: 'c1', htmlBody: 'Unread Comment', 
                postedAt: new Date().toISOString(), user: { username: 'Author2' }
            }
        ];
        const root = { _id: 'c1', postId: 'p1', htmlBody: 'Read Root', postedAt: new Date(Date.now() - 5000).toISOString(), user: { username: 'Author1' } };

        await initPowerReader(page, { 
            posts: [post], 
            comments: initialComments,
            testMode: true,
            onGraphQL: `
                if (query.includes('query GetCommentsByIds')) {
                    return { data: { comments: { results: [${JSON.stringify(root)}] } } };
                }
            `
        });

        // Mark C1 as read in storage
        await page.evaluate((id) => {
            const state = JSON.parse(localStorage.getItem('__PR_READ_STATE__') || '{}');
            state[id] = 1;
            localStorage.setItem('__PR_READ_STATE__', JSON.stringify(state));
        }, 'c1');

        // Click [t] on C2
        const btnT = page.locator('.pr-comment[data-id="c2"] [data-action="load-parents-and-scroll"]');
        await btnT.click();

        // C1 should be visible despite being read and having < 2 unread descendants
        await expect(page.locator('.pr-comment[data-id="c1"]')).toBeVisible();
        await expect(page.locator('.pr-comment[data-id="c1"]')).toHaveClass(/read/);
        await expect(page.locator('.pr-comment[data-id="c1"]')).not.toHaveClass(/pr-comment-placeholder/);
    });

    test('should NOT scroll if root is already visible after loading parents', async ({ page }) => {
        const post = { _id: 'p1', title: 'Post' };
        const initialComments = [
            { 
                _id: 'c2', postId: 'p1', parentCommentId: 'c1', htmlBody: 'Click Me', 
                postedAt: new Date().toISOString(), user: { username: 'Author2' }
            }
        ];
        // Root is small and close to child
        const root = { _id: 'c1', postId: 'p1', htmlBody: 'Small Root', postedAt: new Date(Date.now() - 5000).toISOString(), user: { username: 'Author1' } };

        await initPowerReader(page, { 
            posts: [post], 
            comments: initialComments,
            testMode: true,
            onGraphQL: `
                if (query.includes('query GetCommentsByIds')) {
                    return { data: { comments: { results: [${JSON.stringify(root)}] } } };
                }
            `
        });

        // Click [t] on C2
        const btnT = page.locator('.pr-comment[data-id="c2"] [data-action="load-parents-and-scroll"]');
        
        // Measure position before click
        const beforeTop = await btnT.evaluate(el => el.getBoundingClientRect().top);
        
        await btnT.click();
        await expect(page.locator('.pr-comment[data-id="c1"]')).toBeVisible();

        // Position should be PRESERVED (Smart Focus)
        await expect.poll(async () => {
            const afterTop = await page.locator('.pr-comment[data-id="c2"] [data-action="load-parents-and-scroll"]').evaluate(el => el.getBoundingClientRect().top);
            return Math.abs(afterTop - beforeTop);
        }).toBeLessThan(2);
    });
});
