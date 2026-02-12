import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader Reactions UI', () => {

    test('[PR-REACT-03][PR-REACT-06][PR-REACT-08] Reaction UI: Displays, opens picker, and votes', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            comments: [{
                _id: 'comment-1',
                postId: 'post-1',
                htmlBody: '<p>Reaction test comment</p>',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                extendedScore: {
                    reacts: {
                        insightful: [{ userId: 'u2', reactType: 'created' }, { userId: 'u3', reactType: 'created' }],
                        thanks: [{ userId: 'u2', reactType: 'created' }]
                    }
                },
                currentUserExtendedVote: {
                    agreement: null,
                    reacts: [{ react: 'insightful', vote: 'created' }]
                },
                user: { _id: 'u2', username: 'OtherUser' },
                post: { _id: 'post-1', title: 'Test Post' }
            }],
            onMutation: `
                if (query.includes('mutation Vote')) {
                  const { extendedVote, documentId } = variables;
                  const reactsMap = {};
                  if (extendedVote.reacts) {
                    extendedVote.reacts.forEach(r => {
                      reactsMap[r.react] = [{ userId: 'user-1-id', reactType: r.vote }];
                    });
                  }
                  return {
                    data: {
                      performVoteComment: {
                        document: {
                          _id: documentId,
                          baseScore: 10,
                          extendedScore: { reacts: reactsMap },
                          currentUserVote: variables.voteType,
                          currentUserExtendedVote: extendedVote,
                          afExtendedScore: { agreement: 0 }
                        }
                      }
                    }
                  };
                }
            `
        });

        // 1. Verify reaction chips are displayed
        const comment = page.locator('.pr-comment').first();
        await expect(comment.locator('.pr-reaction-chip')).toHaveCount(2);

        // Check "insightful" chip (voted)
        const insightfulChip = comment.locator('.pr-reaction-chip[data-reaction-name="insightful"]');
        await expect(insightfulChip).toBeVisible();
        await expect(insightfulChip).toHaveClass(/voted/);
        await expect(insightfulChip.locator('.pr-reaction-count')).toHaveText('2');

        // 2. Open Picker
        const addBtn = comment.locator('.pr-add-reaction-btn');
        await addBtn.click();

        const picker = page.locator('#pr-global-reaction-picker');
        await expect(picker).toBeVisible();
        await expect(picker).toHaveClass(/visible/);

        // 3. Verify picker items
        const pickerItems = picker.locator('.pr-reaction-picker-item');
        await expect(pickerItems).toHaveCount(63);

        // Check "thanks" reaction
        const thanksReaction = picker.locator('.pr-reaction-picker-item[data-reaction-name="thanks"]');
        await expect(thanksReaction).toBeVisible();

        // Hover to check tooltip
        await thanksReaction.hover();
        const globalTooltip = page.locator('.pr-tooltip-global');
        await expect(globalTooltip).toBeVisible();
        await expect(globalTooltip).toContainText('Thanks');

        // 4. Cast a vote from picker (laugh)
        const hahaReaction = picker.locator('.pr-reaction-picker-item[data-reaction-name="laugh"]');
        await hahaReaction.click();

        // Picker should stay open
        await expect(picker).toHaveClass(/visible/);

        // New chip should appear for "laugh"
        const hahaChip = comment.locator('.pr-reaction-chip[data-reaction-name="laugh"]');
        await expect(hahaChip).toBeVisible();
        await expect(hahaChip).toHaveClass(/voted/);
    });

    test('Reaction UI: Regression - Handles null karma vote when reacting', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            comments: [{
                _id: 'comment-null-vote',
                postId: 'post-1',
                htmlBody: '<p>Comment with no karma vote</p>',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                extendedScore: { reacts: {} },
                currentUserVote: null,
                currentUserExtendedVote: { reacts: [] },
                user: { _id: 'u2', username: 'OtherUser' },
                post: { _id: 'post-1', title: 'Test Post' }
            }],
            onMutation: `
                if (query.includes('mutation Vote')) {
                  if (variables.voteType === null || variables.voteType === undefined) {
                    return {
                      errors: [{ message: 'Variable "$voteType" of non-null type "String!" must not be null.' }]
                    };
                  }
                  return {
                    data: {
                      performVoteComment: {
                        document: {
                          _id: variables.documentId,
                          baseScore: 10,
                          extendedScore: { reacts: { laugh: [{userId:'u1', reactType: 'created'}] } },
                          currentUserVote: variables.voteType,
                          currentUserExtendedVote: variables.extendedVote,
                          afExtendedScore: { agreement: 0 }
                        }
                      }
                    }
                  };
                }
            `
        });

        const comment = page.locator('.pr-comment').first();
        const addBtn = comment.locator('.pr-add-reaction-btn');
        await addBtn.click();

        const picker = page.locator('#pr-global-reaction-picker');
        const hahaReaction = picker.locator('.pr-reaction-picker-item[data-reaction-name="laugh"]');

        await hahaReaction.click();

        // Chip should appear
        const hahaChip = comment.locator('.pr-reaction-chip[data-reaction-name="laugh"]');
        await expect(hahaChip).toBeVisible();
    });

    test('Reaction UI: Regression - Picker clicks trigger vote despite stopPropagation', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            comments: [{
                _id: 'c1',
                postId: 'p1',
                htmlBody: '<p>Test Comment</p>',
                postedAt: new Date().toISOString(),
                baseScore: 5,
                extendedScore: { reacts: {} },
                currentUserExtendedVote: { reacts: [] },
                user: { _id: 'u2', username: 'Poster' },
                post: { _id: 'p1', title: 'Test Post' }
            }],
            onMutation: `
                if (query.includes('mutation Vote')) {
                  const extendedVote = variables.extendedVote;
                  if (extendedVote?.reacts?.[0]?.react === 'agree') {
                    return {
                      data: {
                        performVoteComment: {
                          document: {
                            _id: 'c1',
                            baseScore: 6,
                            extendedScore: { reacts: { agree: [{ userId: 'user-1-id', reactType: 'created' }] } },
                            currentUserExtendedVote: extendedVote,
                            afExtendedScore: { agreement: 0 }
                          }
                        }
                      }
                    };
                  }
                }
            `
        });

        const comment = page.locator('.pr-comment').first();
        await comment.locator('.pr-add-reaction-btn').click();

        const picker = page.locator('#pr-global-reaction-picker');
        await expect(picker).toBeVisible();

        const agreeBtn = picker.locator('.pr-reaction-picker-item[data-reaction-name="agree"]');
        await agreeBtn.click();

        const chip = comment.locator('.pr-reaction-chip[data-reaction-name="agree"]');
        await expect(chip).toBeVisible();
        await expect(agreeBtn).toHaveClass(/active/);
    });
});
