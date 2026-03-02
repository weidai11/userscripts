import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader Reaction Tooltips', () => {
    test('[PR-REACT-06] Reaction Tooltips: Displays detailed info on hover', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            comments: [{
                _id: 'comment-1',
                postId: 'post-1',
                htmlBody: '<p>Reaction tooltip test</p>',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                extendedScore: {
                    reacts: {
                        insightful: [
                            { userId: 'u2', userName: 'Alice', reactType: 'created' },
                            { userId: 'u3', userName: 'Bob', reactType: 'created', quotes: [{ quote: 'Reaction tooltip test' }] }
                        ]
                    }
                },
                currentUserExtendedVote: {
                    reacts: []
                },
                user: { _id: 'u2', username: 'OtherUser' },
                post: { _id: 'post-1', title: 'Test Post' }
            }]
        });

        const comment = page.locator('.pr-comment').first();
        const insightfulChip = comment.locator('.pr-reaction-chip[data-reaction-name="insightful"]');
        
        await expect(insightfulChip).toBeVisible();
        
        // Hover over the chip
        await insightfulChip.hover();
        
        const globalTooltip = page.locator('.pr-tooltip-global');
        await expect(globalTooltip).toBeVisible();
        await expect(globalTooltip).toHaveCSS('opacity', '1');
        
        // Check content
        await expect(globalTooltip.locator('strong')).toHaveText('Insightful');
        await expect(globalTooltip).toContainText('Alice');
        await expect(globalTooltip).toContainText('Bob');
        await expect(globalTooltip).toContainText('Reaction tooltip test');
        
        // Move mouse away
        await page.mouse.move(0, 0);
        await expect(globalTooltip).not.toBeVisible();
    });

    test('[PR-REACT-06] Reaction Tooltips: string-form quotes do not render as undefined', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            comments: [{
                _id: 'comment-quote-string',
                postId: 'post-quote-string',
                htmlBody: '<p>String quote tooltip test</p>',
                postedAt: new Date().toISOString(),
                baseScore: 5,
                extendedScore: {
                    reacts: {
                        insightful: [
                            { userId: 'u2', userName: 'Alice', reactType: 'created', quotes: ['String quote tooltip test'] }
                        ]
                    }
                },
                currentUserExtendedVote: {
                    reacts: []
                },
                user: { _id: 'u2', username: 'OtherUser' },
                post: { _id: 'post-quote-string', title: 'Test Post' }
            }]
        });

        const chip = page.locator('.pr-comment').first().locator('.pr-reaction-chip[data-reaction-name="insightful"]');
        await expect(chip).toBeVisible();
        await chip.hover();

        const tooltip = page.locator('.pr-tooltip-global');
        await expect(tooltip).toBeVisible();
        await expect(tooltip).toContainText('String quote tooltip test');
        await expect(tooltip).not.toContainText('undefined');
    });
});
