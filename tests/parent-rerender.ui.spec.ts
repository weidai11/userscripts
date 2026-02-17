import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

async function waitAtLeast(ms: number): Promise<void> {
    const start = Date.now();
    await expect.poll(() => Date.now() - start, { timeout: ms + 1000 }).toBeGreaterThanOrEqual(ms);
}

test.describe('Power Reader Post-Rerender Event Reattachment', () => {

    test('[PR-NAV-10] Hover previews work on re-rendered comments after deep loading a parent', async ({ page }) => {
        const childId = 'child-1';
        const missingParentId = 'missing-parent';

        await initPowerReader(page, {
            testMode: true,
            comments: [
                {
                    _id: childId,
                    postId: 'p1',
                    htmlBody: '<p>Child comment</p>',
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
                                    htmlBody: '<p>Fetched parent content</p>',
                                    postedAt: new Date(Date.now() - 100000).toISOString(),
                                    baseScore: 20,
                                    parentCommentId: null,
                                    user: { _id: 'u1', username: 'ParentAuthor' },
                                    post: { _id: 'p1', title: 'Post 1' }
                                }
                            }
                        }
                    };
                }
            `
        });

        // Click [^] to deep-load the missing parent (re-renders the post group)
        const childComment = page.locator(`.pr-comment[data-id="${childId}"]`);
        const findParentBtn = childComment.locator('[data-action="find-parent"]');
        await findParentBtn.click();

        // Wait for the parent to appear in the DOM
        const parentComment = page.locator(`.pr-comment[data-id="${missingParentId}"]`);
        await expect(parentComment).toBeAttached();

        // Wait for scroll cooldown (click or re-render might have triggered a scroll event)
        await waitAtLeast(500);

        // The child was re-rendered — locate the new [^] button
        const newChildComment = page.locator(`.pr-comment[data-id="${childId}"]`);
        const newFindParentBtn = newChildComment.locator('.pr-find-parent');
        await expect(newFindParentBtn).toBeVisible();

        // Disable transitions for instant style application
        await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });

        // Wait for highlight-parent animation to finish before hovering
        await expect(parentComment).not.toHaveClass(/highlight-parent/, { timeout: 5000 });

        // Hover over the re-rendered [^] button — should still trigger parent highlight
        await page.mouse.move(0, 0);
        await page.mouse.move(10, 10);
        await newFindParentBtn.hover();
        await newFindParentBtn.dispatchEvent('mouseenter');

        // Verify the parent gets the hover highlight (#ffe066 = rgb(255, 224, 102))
        await expect(parentComment).toHaveCSS('background-color', 'rgb(255, 224, 102)');
    });
});
