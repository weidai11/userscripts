import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader Parent Navigation', () => {

    test('Clicking [^] scrolls to parent and highlights it', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            verbose: true,
            comments: [
                {
                    _id: 'parent-id',
                    postId: 'p1',
                    pageUrl: 'https://example.com/p1',
                    htmlBody: '<p>This is the parent comment content.</p>',
                    postedAt: new Date(Date.now() - 1000000).toISOString(),
                    baseScore: 10,
                    parentCommentId: null,
                    user: { _id: 'u1', username: 'ParentAuthor' },
                    post: { _id: 'p1', title: 'Post 1' }
                },
                {
                    _id: 'child-id',
                    postId: 'p1',
                    pageUrl: 'https://example.com/c1',
                    htmlBody: '<p>This is the child comment.</p>',
                    postedAt: new Date().toISOString(),
                    baseScore: 5,
                    parentCommentId: 'parent-id',
                    user: { _id: 'u2', username: 'ChildAuthor' },
                    post: { _id: 'p1', title: 'Post 1' }
                }
            ]
        });

        const childComment = page.locator('.pr-comment[data-id="child-id"]');
        const parentComment = page.locator('.pr-comment[data-id="parent-id"]');

        // Scroll away from parent
        await page.evaluate(() => {
            document.body.style.minHeight = '5000px';
            window.scrollTo(0, 1000);
        });

        // Click Find Parent
        await childComment.locator('[data-action="find-parent"]').click();

        // Verify highlight
        await expect(parentComment).toHaveClass(/highlight-parent/);

        // Verify it is visible in viewport
        const isVisible = await parentComment.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
        });
        expect(isVisible).toBe(true);
    });

    test('Hovering [^] shows preview when parent is off-screen', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            verbose: true,
            comments: [
                {
                    _id: 'parent-id',
                    postId: 'p1',
                    pageUrl: 'https://example.com/p1',
                    htmlBody: '<p>This is the parent comment content.</p>',
                    postedAt: new Date(Date.now() - 1000000).toISOString(),
                    baseScore: 10,
                    parentCommentId: null,
                    user: { _id: 'u1', username: 'ParentAuthor' },
                    post: { _id: 'p1', title: 'Post 1' }
                },
                {
                    _id: 'child-id',
                    postId: 'p1',
                    pageUrl: 'https://example.com/c1',
                    htmlBody: '<p>This is the child comment.</p>',
                    postedAt: new Date().toISOString(),
                    baseScore: 5,
                    parentCommentId: 'parent-id',
                    user: { _id: 'u2', username: 'ChildAuthor' },
                    post: { _id: 'p1', title: 'Post 1' }
                }
            ]
        });

        const childComment = page.locator('.pr-comment[data-id="child-id"]');

        // 1. Ensure parent is off-screen (scrolled past it)
        await page.evaluate(() => {
            document.body.style.minHeight = '10000px';
            // Push child down so we can scroll parent out
            const spacer = document.createElement('div');
            spacer.style.height = '4000px';
            const childEl = document.querySelector('.pr-comment[data-id="child-id"]');
            childEl?.parentNode?.insertBefore(spacer, childEl);

            window.scrollTo(0, 4500);
        });

        // Wait for scroll cooldown (intentionality check)
        await page.waitForTimeout(500);

        // 2. Hover Find Parent button
        const findParentBtn = childComment.locator('[data-action="find-parent"]');

        // Use proximity bypass and manual event to ensure stability in CI
        await page.mouse.move(0, 0); // Reset
        await page.mouse.move(500, 500); // Move near target
        await findParentBtn.hover();
        await findParentBtn.dispatchEvent('mouseenter');

        // 3. Verify preview overlay appears
        const preview = page.locator('.pr-preview-overlay.comment-preview');
        await expect(preview).toBeVisible({ timeout: 10000 });
        await expect(preview).toContainText('This is the parent comment content');
    });

    test('[PR-NAV-08] Clicking [^] for missing parent fetches it from server and highlights it', async ({ page }) => {
        const childId = 'child-no-parent-in-view';
        const missingParentId = 'missing-parent-id';

        await initPowerReader(page, {
            testMode: true,
            verbose: true,
            comments: [
                {
                    _id: childId,
                    postId: 'p1',
                    pageUrl: 'https://example.com/c1',
                    htmlBody: '<p>Child whose parent is missing</p>',
                    postedAt: new Date().toISOString(),
                    baseScore: 5,
                    parentCommentId: missingParentId,
                    user: { _id: 'u2', username: 'ChildAuthor' },
                    post: { _id: 'p1', title: 'Post 1' }
                }
            ],
            onGraphQL: `
                if (query.includes('query GetComment')) {
                    return {
                        data: {
                            comment: {
                                result: {
                                    _id: '${missingParentId}',
                                    postId: 'p1',
                                    pageUrl: 'https://example.com/p-parent',
                                    htmlBody: '<p>I was missing but now I am here</p>',
                                    postedAt: new Date(Date.now() - 100000).toISOString(),
                                    baseScore: 20,
                                    parentCommentId: null,
                                    user: { _id: 'u1', username: 'MissingParentAuthor' },
                                    post: { _id: 'p1', title: 'Post 1' }
                                }
                            }
                        }
                    };
                }
            `
        });

        const childComment = page.locator('.pr-comment[data-id="' + childId + '"]');
        const findParentBtn = childComment.locator('[data-action="find-parent"]');

        // Initially, parent should be a placeholder in DOM
        const placeholder = page.locator(`.pr-comment[data-id="${missingParentId}"][data-placeholder="1"]`);
        await expect(placeholder).toBeAttached();
        await expect(placeholder).toHaveClass(/read/);
        // Use robust selectors instead of direct child constraint
        await expect(placeholder.locator('> .pr-comment-meta')).toHaveCount(0);
        await expect(placeholder.locator('> .pr-comment-body')).toHaveCount(0);

        // Click find parent
        await findParentBtn.click();

        // Verify parent is now in DOM and highlighted
        const parentComment = page.locator('.pr-comment[data-id="' + missingParentId + '"]');
        await expect(parentComment).toBeAttached();
        await expect(parentComment).toContainText('I was missing but now I am here');
        await expect(parentComment).toHaveClass(/highlight-parent/);
        await expect(page.locator(`.pr-comment[data-id="${missingParentId}"][data-placeholder="1"]`)).toHaveCount(0);
    });
});
