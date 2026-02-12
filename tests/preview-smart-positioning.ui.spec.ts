import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

/**
 * Tests for the "Smart Positioning" logic in preview.ts
 * This ensures popups don't overflow the viewport or overlap their triggers
 * unnecessarily when near screen edges.
 */
test.describe('Smart Preview Positioning', () => {

    test('Preview stays within viewport when trigger is on LEFT edge', async ({ page }) => {
        const user = { _id: 'u1', username: 'Author', karma: 100 };
        const comment = {
            _id: 'c1', postId: 'p1',
            htmlBody: '<p>A comment that triggers a preview.</p>',
            postedAt: new Date().toISOString(),
            user,
            post: { _id: 'p1', title: 'Target Post' },
            parentCommentId: 'parent_id' // Forces [^] to show and trigger preview
        };
        const parent = {
            _id: 'parent_id', postId: 'p1',
            htmlBody: '<p>Parent content that is long enough to have a significant width.</p>',
            user: { username: 'ParentAuthor' }
        };

        // Small viewport to force edge constraints
        await page.setViewportSize({ width: 600, height: 800 });

        await initPowerReader(page, {
            testMode: true,
            comments: [comment],
            currentUser: user,
            onGraphQL: `
                if (query.includes('GetCommentsByIds') && variables.commentIds.includes('parent_id')) {
                    return { data: { comments: { results: [${JSON.stringify(parent)}] } } };
                }
            `
        });

        // Wait for ready signal
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // The [^] button is at the start of the comment controls (left side)
        const btn = page.locator('.pr-find-parent').first();
        await btn.waitFor();

        // Natural hover
        const box = await btn.boundingBox();
        if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        }
        // Dispatch mouseenter to satisfy the intentional-hover check
        await btn.dispatchEvent('mouseenter');

        const preview = page.locator('.pr-preview-overlay');
        await expect(preview).toBeVisible();

        const previewBox = await preview.boundingBox();
        const vw = page.viewportSize()?.width || 0;

        if (previewBox) {
            // Should be at least 10px from the left edge (per positionPreview logic)
            expect(previewBox.x).toBeGreaterThanOrEqual(10);
            // Should not overflow right edge
            expect(previewBox.x + previewBox.width).toBeLessThanOrEqual(vw - 10);
        }
    });

    test('Preview stays within viewport when trigger is on RIGHT edge', async ({ page }) => {
        const user = { _id: 'u1', username: 'Author', karma: 100 };
        const comment = {
            _id: 'c1', postId: 'p1',
            htmlBody: '<p>A comment that triggers a preview.</p>',
            postedAt: new Date().toISOString(),
            user,
            post: { _id: 'p1', title: 'Target Post' },
            parentCommentId: 'parent_id'
        };
        const parent = {
            _id: 'parent_id', postId: 'p1',
            htmlBody: '<p>Parent content that is long enough to have a significant width.</p>',
            user: { username: 'ParentAuthor' }
        };

        // Small viewport
        await page.setViewportSize({ width: 600, height: 800 });

        await initPowerReader(page, {
            testMode: true,
            comments: [comment],
            currentUser: user,
            onGraphQL: `
                if (query.includes('GetCommentsByIds') && variables.commentIds.includes('parent_id')) {
                    return { data: { comments: { results: [${JSON.stringify(parent)}] } } };
                }
            `
        });

        // Wait for ready signal
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Use CSS to push the container to the right edge
        await page.addStyleTag({ content: '.pr-comment-header { justify-content: flex-end !important; }' });

        const btn = page.locator('.pr-find-parent').first();
        await btn.waitFor();

        const box = await btn.boundingBox();
        if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        }
        await btn.dispatchEvent('mouseenter');

        const preview = page.locator('.pr-preview-overlay');
        await expect(preview).toBeVisible();

        const previewBox = await preview.boundingBox();
        const vw = page.viewportSize()?.width || 0;

        if (previewBox) {
            // Should not overflow right edge (vw - width - 10)
            expect(previewBox.x + previewBox.width).toBeLessThanOrEqual(vw - 10);
            // Should be at least 10px from the left edge
            expect(previewBox.x).toBeGreaterThanOrEqual(10);
        }
    });
});
