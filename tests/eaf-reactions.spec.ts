import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('EAF-style Reactions', () => {
  const EAF_URL = 'https://forum.effectivealtruism.org/reader';

  test('renders top-level agree/disagree counts from extendedScore on EAF host', async ({ page }) => {
    await initPowerReader(page, {
      testMode: true,
      comments: [
        {
          _id: 'c1',
          postId: 'p1',
          votingSystem: 'eaEmojis',
          extendedScore: {
            agree: 10,
            disagree: 5,
            reacts: {}
          },
          user: { _id: 'u1', username: 'Author1' },
          post: { _id: 'p1', title: 'Post 1' }
        }
      ]
    }, EAF_URL);

    // Verify 'agree' and 'disagree' chips are visible with correct counts
    const agreeChip = page.locator('.pr-reaction-chip[data-reaction-name="agree"]');
    const disagreeChip = page.locator('.pr-reaction-chip[data-reaction-name="disagree"]');

    await expect(agreeChip).toBeVisible();
    await expect(agreeChip.locator('.pr-reaction-count')).toHaveText('10');

    await expect(disagreeChip).toBeVisible();
    await expect(disagreeChip.locator('.pr-reaction-count')).toHaveText('5');

    // Verify agreement axis is HIDDEN on EAF
    await expect(page.locator('.pr-agreement-score')).not.toBeVisible();
  });

  test('renders voted state for top-level reactions on EAF', async ({ page }) => {
    await initPowerReader(page, {
      testMode: true,
      comments: [
        {
          _id: 'c1',
          postId: 'p1',
          votingSystem: 'eaEmojis',
          extendedScore: {
            agree: 1,
            reacts: {}
          },
          currentUserExtendedVote: {
            agree: true
          },
          user: { _id: 'u1', username: 'Author1' },
          post: { _id: 'p1', title: 'Post 1' }
        }
      ]
    }, EAF_URL);

    const agreeChip = page.locator('.pr-reaction-chip[data-reaction-name="agree"]');
    await expect(agreeChip).toHaveClass(/voted/);
  });

  test('uses top-level payload format when voting on EAF', async ({ page }) => {
    await initPowerReader(page, {
      testMode: true,
      comments: [
        {
          _id: 'c1',
          postId: 'p1',
          votingSystem: 'eaEmojis',
          extendedScore: {
            agree: 1,
            reacts: {}
          },
          user: { _id: 'u1', username: 'Author1' },
          post: { _id: 'p1', title: 'Post 1' }
        }
      ],
      onGraphQL: `
        if (query.includes('mutation Vote')) {
          window.__LAST_MUTATION_VARS = variables;
          return {
            data: {
              performVoteComment: {
                document: {
                  _id: variables.documentId,
                  baseScore: 10,
                  voteCount: 1,
                  extendedScore: { ...variables.extendedVote, reacts: [] },
                  currentUserVote: 'neutral',
                  currentUserExtendedVote: variables.extendedVote
                }
              }
            }
          };
        }
      `
    }, EAF_URL);

    // Click agree chip in the comment
    const agreeChip = page.locator('.pr-comment[data-id="c1"] .pr-reaction-chip[data-reaction-name="agree"]');
    await agreeChip.click();

    // Verify last mutation variables
    const lastVars = await page.evaluate(() => (window as any).__LAST_MUTATION_VARS);
    expect(lastVars.extendedVote).toHaveProperty('agree', true);
    // Should NOT use LW style reacts array for this (it should be empty or default)
    // Actually our implementation ensures it's an empty array if not present
    expect(lastVars.extendedVote.reacts).toHaveLength(0);
  });

  test('handles mutual exclusivity of agree/disagree on EAF', async ({ page }) => {
    await initPowerReader(page, {
      testMode: true,
      comments: [
        {
          _id: 'c1',
          postId: 'p1',
          votingSystem: 'eaEmojis',
          currentUserExtendedVote: {
            agree: true
          },
          user: { _id: 'u1', username: 'Author1' },
          post: { _id: 'p1', title: 'Post 1' }
        }
      ],
      onGraphQL: `
        if (query.includes('mutation Vote')) {
          window.__LAST_MUTATION_VARS = variables;
          return {
            data: {
              performVoteComment: {
                document: {
                  _id: variables.documentId,
                  baseScore: 10,
                  voteCount: 1,
                  extendedScore: { ...variables.extendedVote, reacts: [] },
                  currentUserVote: 'neutral',
                  currentUserExtendedVote: variables.extendedVote
                }
              }
            }
          };
        }
      `
    }, EAF_URL);

    // Open picker for comment c1
    await page.locator('.pr-comment[data-id="c1"] .pr-add-reaction-btn').click();
    const disagreeInPicker = page.locator('.pr-reaction-picker-item[data-reaction-name="disagree"]');
    await disagreeInPicker.click();

    // Verify last mutation variables
    const lastVars = await page.evaluate(() => (window as any).__LAST_MUTATION_VARS);
    // Verify 'disagree' is set to true and 'agree' is toggled to false
    expect(lastVars.extendedVote).toHaveProperty('disagree', true);
    expect(lastVars.extendedVote).toHaveProperty('agree', false);
  });

  test('shows agreement axis for EAF content on LW if not using eaEmojis system (fallback)', async ({ page }) => {
    await initPowerReader(page, {
      testMode: true,
      comments: [
        {
          _id: 'c1',
          postId: 'p1',
          votingSystem: 'twoAxis',
          extendedScore: {
            agreement: 10
          },
          user: { _id: 'u1', username: 'Author1' },
          post: { _id: 'p1', title: 'Post 1' }
        }
      ]
    }); // Default host is LW

    const scoreEl = page.locator('.pr-comment[data-id="c1"] .pr-agreement-score');
    await expect(scoreEl).toBeVisible();
    await expect(scoreEl).toHaveText('10');
  });
});
