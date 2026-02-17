import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader UI Refinements', () => {

    test('author buttons layout: [down] Name [up]', async ({ page }) => {
        await initPowerReader(page, {
            comments: [{
                _id: 'c1', postId: 'p1',
                htmlBody: '<p>Body</p>',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                user: { _id: 'a1', username: 'AuthorName', karma: 100 },
                post: { _id: 'p1', title: 'Post', slug: 'post' },
                parentComment: null
            }]
        });

        const comment = page.locator('.pr-comment').first();
        const authorControlsDown = comment.locator('[data-action="author-down"]');
        const authorControlsUp = comment.locator('[data-action="author-up"]');
        const authorName = comment.locator('.pr-author');

        await expect(authorName).toBeVisible();

        const downPos = await authorControlsDown.first().boundingBox();
        const upPos = await authorControlsUp.first().boundingBox();
        const namePos = await authorName.first().boundingBox();

        if (downPos && upPos && namePos) {
            // [↓] Name [↑]
            expect(downPos.x).toBeLessThan(namePos.x);
            expect(namePos.x).toBeLessThan(upPos.x);
        } else {
            throw new Error('Bounding box not found');
        }
    });

    test('help section persistence', async ({ page }) => {
        await initPowerReader(page);

        const help = page.locator('#pr-help-section');
        await expect(help).toHaveAttribute('open', '');

        // Close it

        await help.locator('summary').click();
        await expect(help).not.toHaveAttribute('open');
    });

    test('read comment border is light', async ({ page }) => {
        await initPowerReader(page, {
            comments: [{
                _id: 'c1', postId: 'p1',
                htmlBody: '<p>Body</p>',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                user: { _id: 'a1', username: 'AuthorName', karma: 100 },
                post: { _id: 'p1', title: 'Post', slug: 'post' },
                parentComment: null
            }]
        });

        const comment = page.locator('.pr-comment').first();
        await expect(comment).toBeVisible();

        await comment.evaluate(el => el.classList.add('read'));

        const readComment = page.locator('.pr-comment.read');
        const border = await readComment.evaluate(el => window.getComputedStyle(el).borderColor);

        // rgb(238, 238, 238) is #eee
        expect(border).toBe('rgb(238, 238, 238)');
    });
});
