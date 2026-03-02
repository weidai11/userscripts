import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Agreement Tooltips', () => {
  test('[PR-VOTE-07] displays rich tooltip for agreement score with usernames', async ({ page }) => {
    await initPowerReader(page, {
      testMode: true,
      comments: [
        {
          _id: 'c1',
          postId: 'p1',
          votingSystem: 'twoAxis',
          extendedScore: {
            agreement: 5,
            agreementVoteCount: 3,
            approvalVoteCount: 50,
            reacts: {
              agree: [
                { userId: 'u1', userName: 'Alice', reactType: 'agreed' },
                { userId: 'u2', userName: 'Bob', reactType: 'agreed' }
              ],
              disagree: [
                { userId: 'u3', userName: 'Charlie', reactType: 'disagreed' }
              ]
            }
          },
          user: { _id: 'u1', username: 'Author1' },
          post: { _id: 'p1', title: 'Post 1' }
        }
      ]
    });

    const agreementScore = page.locator('.pr-comment[data-id="c1"] .pr-agreement-score');
    await expect(agreementScore).toBeVisible();
    await expect(agreementScore).toHaveText('5');

    // Hover over agreement score
    await agreementScore.hover();

    const tooltip = page.locator('.pr-tooltip-global');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Agreement Score: 5');
    await expect(tooltip).toContainText('Net agreement from 3 votes.');
    
    // Check users
    await expect(tooltip).toContainText('Alice [Agree]');
    await expect(tooltip).toContainText('Bob [Agree]');
    await expect(tooltip).toContainText('Charlie [Disagree]');
  });

  test('[PR-VOTE-07] displays rich tooltip for karma score', async ({ page }) => {
    await initPowerReader(page, {
      testMode: true,
      comments: [
        {
          _id: 'c1',
          postId: 'p1',
          baseScore: 100,
          voteCount: 0, // Should be ignored in favor of extendedScore
          extendedScore: {
            approvalVoteCount: 50
          },
          user: { _id: 'u1', username: 'Author1' },
          post: { _id: 'p1', title: 'Post 1' }
        }
      ]
    });

    const karmaScore = page.locator('.pr-comment[data-id="c1"] .pr-karma-score');
    await expect(karmaScore).toBeVisible();
    await expect(karmaScore).toHaveText('100');

    // Hover over karma score
    await karmaScore.hover();

    const tooltip = page.locator('.pr-tooltip-global');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Karma: 100');
    await expect(tooltip).toContainText('Total votes: 50');
  });

  test('[PR-VOTE-07] displays rich tooltip for post karma score', async ({ page }) => {
    await initPowerReader(page, {
      testMode: true,
      posts: [
        {
          _id: 'p1',
          title: 'Test Post',
          baseScore: 500,
          voteCount: 200,
          user: { _id: 'u1', username: 'Author1' }
        }
      ]
    });

    const karmaScore = page.locator('.pr-post[data-id="p1"] .pr-karma-score');
    await expect(karmaScore).toBeVisible();
    await expect(karmaScore).toHaveText('500');

    // Hover over karma score
    await karmaScore.hover();

    const tooltip = page.locator('.pr-tooltip-global');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Karma: 500');
    await expect(tooltip).toContainText('Total votes: 200');
  });
});
