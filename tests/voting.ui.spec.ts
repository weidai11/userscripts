/**
 * E2E tests for voting UI in Power Reader
 * Tests that vote buttons render correctly and interact with mocked API
 */
import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader Voting UI', () => {

    test('[PR-VOTE-01][PR-VOTE-02][PR-VOTE-03] renders vote buttons with correct initial state', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            currentUser: { _id: 'test-user-id', username: 'TestUser', slug: 'test-user' },
            comments: [
                {
                    _id: 'comment-upvoted',
                    postId: 'p1',
                    pageUrl: 'https://www.lesswrong.com/posts/p1/comment/comment-upvoted',
                    htmlBody: '<p>This comment is upvoted by current user.</p>',
                    postedAt: new Date().toISOString(),
                    baseScore: 15,
                    voteCount: 5,
                    afExtendedScore: { agreement: 2 },
                    currentUserVote: 'smallUpvote',
                    currentUserExtendedVote: null,
                    parentCommentId: null,
                    user: { _id: 'u1', slug: 'user-1', username: 'Author1', karma: 100 },
                    post: { _id: 'p1', title: 'Test Post', slug: 'test-post' },
                    parentComment: null
                },
                {
                    _id: 'comment-downvoted',
                    postId: 'p1',
                    pageUrl: 'https://www.lesswrong.com/posts/p1/comment/comment-downvoted',
                    htmlBody: '<p>This comment is downvoted by current user.</p>',
                    postedAt: new Date(Date.now() - 1000).toISOString(),
                    baseScore: 3,
                    voteCount: 2,
                    afExtendedScore: { agreement: 0 },
                    currentUserVote: 'smallDownvote',
                    currentUserExtendedVote: null,
                    parentCommentId: null,
                    user: { _id: 'u2', slug: 'user-2', username: 'Author2', karma: 100 },
                    post: { _id: 'p1', title: 'Test Post', slug: 'test-post' },
                    parentComment: null
                },
                {
                    _id: 'comment-agreed',
                    postId: 'p1',
                    pageUrl: 'https://www.lesswrong.com/posts/p1/comment/comment-agreed',
                    htmlBody: '<p>This comment has agreement vote.</p>',
                    postedAt: new Date(Date.now() - 2000).toISOString(),
                    baseScore: 8,
                    voteCount: 3,
                    afExtendedScore: { agreement: 5 },
                    currentUserVote: null,
                    currentUserExtendedVote: { agreement: 'smallUpvote' },
                    parentCommentId: null,
                    user: { _id: 'u3', slug: 'user-3', username: 'Author3', karma: 100 },
                    post: { _id: 'p1', title: 'Test Post', slug: 'test-post' },
                    parentComment: null
                },
                {
                    _id: 'comment-disagreed',
                    postId: 'p1',
                    pageUrl: 'https://www.lesswrong.com/posts/p1/comment/comment-disagreed',
                    htmlBody: '<p>This comment has disagreement vote.</p>',
                    postedAt: new Date(Date.now() - 3000).toISOString(),
                    baseScore: 5,
                    voteCount: 4,
                    currentUserVote: null,
                    currentUserExtendedVote: { agreement: 'smallDownvote' },
                    parentCommentId: null,
                    user: { _id: 'u4', slug: 'user-4', username: 'Author4', karma: 100 },
                    post: { _id: 'p1', title: 'Test Post', slug: 'test-post' },
                    parentComment: null
                },
                {
                    _id: 'comment-neutral',
                    postId: 'p1',
                    pageUrl: 'https://www.lesswrong.com/posts/p1/comment/comment-neutral',
                    htmlBody: '<p>No votes on this comment.</p>',
                    postedAt: new Date(Date.now() - 4000).toISOString(),
                    baseScore: 1,
                    voteCount: 0,
                    afExtendedScore: { agreement: 0 },
                    currentUserVote: null,
                    currentUserExtendedVote: null,
                    parentCommentId: null,
                    user: { _id: 'u5', slug: 'user-5', username: 'Author5', karma: 100 },
                    post: { _id: 'p1', title: 'Test Post', slug: 'test-post' },
                    parentComment: null
                }
            ]
        });

        // Test upvoted comment
        const upvotedComment = page.locator('[data-id="comment-upvoted"]');
        await expect(upvotedComment.locator('[data-action="karma-up"]')).toHaveClass(/active-up/);
        await expect(upvotedComment.locator('[data-action="karma-down"]')).not.toHaveClass(/active-down/);
        await expect(upvotedComment.locator('.pr-karma-score')).toContainText('15');

        // Test downvoted comment
        const downvotedComment = page.locator('[data-id="comment-downvoted"]');
        await expect(downvotedComment.locator('[data-action="karma-up"]')).not.toHaveClass(/active-up/);
        await expect(downvotedComment.locator('[data-action="karma-down"]')).toHaveClass(/active-down/);
        await expect(downvotedComment.locator('.pr-karma-score')).toContainText('3');

        // Test agreed comment
        const agreedComment = page.locator('[data-id="comment-agreed"]');
        await expect(agreedComment.locator('[data-action="agree"]')).toHaveClass(/agree-active/);
        await expect(agreedComment.locator('[data-action="disagree"]')).not.toHaveClass(/disagree-active/);

        // Test disagreed comment
        const disagreedComment = page.locator('[data-id="comment-disagreed"]');
        await expect(disagreedComment.locator('[data-action="agree"]')).not.toHaveClass(/agree-active/);
        await expect(disagreedComment.locator('[data-action="disagree"]')).toHaveClass(/disagree-active/);

        // Test neutral comment (no active classes)
        const neutralComment = page.locator('[data-id="comment-neutral"]');
        await expect(neutralComment.locator('[data-action="karma-up"]')).not.toHaveClass(/active-up/);
        await expect(neutralComment.locator('[data-action="karma-down"]')).not.toHaveClass(/active-down/);
        await expect(neutralComment.locator('[data-action="agree"]')).not.toHaveClass(/agree-active/);
        await expect(neutralComment.locator('[data-action="disagree"]')).not.toHaveClass(/disagree-active/);
        await expect(neutralComment.locator('.pr-karma-score')).toContainText('1');
    });

    test('[PR-VOTE-04] clicking vote button updates UI after successful mutation', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            onMutation: `
                if (query.includes('setVoteComment') || query.includes('mutation Vote')) {
                  const { documentId, voteType } = variables;
                  return {
                    data: {
                      performVoteComment: {
                        document: {
                          _id: documentId,
                          baseScore: voteType === 'smallUpvote' ? 11 : voteType === 'smallDownvote' ? 9 : 10,
                          voteCount: 1,
                          extendedScore: { reacts: {} },
                          currentUserVote: voteType === 'neutral' ? null : voteType,
                          currentUserExtendedVote: null,
                          afExtendedScore: { agreement: 0 }
                        }
                      }
                    }
                  };
                }
            `,
            comments: [{
                _id: 'test-comment',
                postId: 'p1',
                pageUrl: 'https://www.lesswrong.com/posts/p1/comment/test-comment',
                htmlBody: '<p>Test comment for voting.</p>',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                voteCount: 0,
                afExtendedScore: { agreement: 0 },
                currentUserVote: null,
                currentUserExtendedVote: null,
                user: { _id: 'u1', slug: 'user-1', username: 'TestAuthor', karma: 100 },
                post: { _id: 'p1', title: 'Test Post', slug: 'test-post' }
            }]
        });

        // Find the upvote button
        const comment = page.locator('[data-id="test-comment"]');
        const upvoteBtn = comment.locator('[data-action="karma-up"]');
        const scoreEl = comment.locator('.pr-karma-score');

        // Verify initial state
        await expect(upvoteBtn).not.toHaveClass(/active-up/);
        await expect(scoreEl).toContainText('10');

        // Click upvote
        await upvoteBtn.click();

        // Wait for the UI to update
        await expect(upvoteBtn).toHaveClass(/active-up/, { timeout: 5000 });
        await expect(scoreEl).toContainText('11');
    });

    test('toggles vote off when clicking active vote button', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            comments: [{
                _id: 'upvoted-comment',
                postId: 'p1',
                pageUrl: 'https://www.lesswrong.com/posts/p1/comment/upvoted-comment',
                htmlBody: '<p>Already upvoted comment.</p>',
                postedAt: new Date().toISOString(),
                baseScore: 11,
                voteCount: 1,
                afExtendedScore: { agreement: 0 },
                currentUserVote: 'smallUpvote',
                currentUserExtendedVote: null,
                user: { _id: 'u1', username: 'Tester' },
                post: { _id: 'p1', title: 'P' }
            }],
            onMutation: `
                if (query.includes('performVoteComment') || query.includes('mutation Vote')) {
                    const { voteType } = variables;
                    return {
                        data: {
                            performVoteComment: {
                                document: {
                                    _id: 'upvoted-comment',
                                    baseScore: voteType === 'neutral' ? 10 : 11,
                                    voteCount: voteType === 'neutral' ? 0 : 1,
                                    extendedScore: { reacts: {} },
                                    currentUserVote: voteType === 'neutral' ? null : voteType,
                                    currentUserExtendedVote: null,
                                    afExtendedScore: { agreement: 0 }
                                }
                            }
                        }
                    };
                }
            `
        });

        const comment = page.locator('[data-id="upvoted-comment"]');
        const upvoteBtn = comment.locator('[data-action="karma-up"]');
        const scoreEl = comment.locator('.pr-karma-score');

        // Verify initial upvoted state
        await expect(upvoteBtn).toHaveClass(/active-up/);
        await expect(scoreEl).toContainText('11');

        // Click to toggle off
        await upvoteBtn.click();

        // Should remove the active class and update score
        await expect(upvoteBtn).not.toHaveClass(/active-up/, { timeout: 5000 });
        await expect(scoreEl).toContainText('10');
    });

    test('vote buttons have correct data attributes', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            currentUser: null,
            comments: [{
                _id: 'attr-test-comment',
                postId: 'p1',
                pageUrl: 'https://www.lesswrong.com/posts/p1/comment/attr-test-comment',
                htmlBody: '<p>Testing data attributes.</p>',
                postedAt: new Date().toISOString(),
                baseScore: 7,
                voteCount: 2,
                user: { _id: 'u1', username: 'TestAuthor', karma: 100 },
                post: { _id: 'p1', title: 'Test Post', slug: 'test-post' }
            }]
        });

        // Test attribute checks
        const comment = page.locator('[data-id="attr-test-comment"]');

        // Verify karma up button
        const karmaUpBtn = comment.locator('[data-action="karma-up"]');
        await expect(karmaUpBtn).toHaveAttribute('data-id', 'attr-test-comment');
        await expect(karmaUpBtn).toHaveAttribute('title', 'Upvote');

        // Verify karma down button
        const karmaDownBtn = comment.locator('[data-action="karma-down"]');
        await expect(karmaDownBtn).toHaveAttribute('data-id', 'attr-test-comment');
        await expect(karmaDownBtn).toHaveAttribute('title', 'Downvote');

        // Verify agree button
        const agreeBtn = comment.locator('[data-action="agree"]');
        await expect(agreeBtn).toHaveAttribute('data-id', 'attr-test-comment');
        await expect(agreeBtn).toHaveAttribute('title', 'Agree');

        // Verify disagree button
        const disagreeBtn = comment.locator('[data-action="disagree"]');
        await expect(disagreeBtn).toHaveAttribute('data-id', 'attr-test-comment');
        await expect(disagreeBtn).toHaveAttribute('title', 'Disagree');
    });

    test('strong voting (hold) triggers strong vote', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            comments: [{
                _id: 'hold-test-comment',
                postId: 'p1',
                pageUrl: 'https://www.lesswrong.com/posts/p1/comment/hold-test-comment',
                htmlBody: '<p>Test hold comment.</p>',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                voteCount: 0,
                user: { _id: 'author1', username: 'Author', karma: 100 },
                post: { _id: 'p1', title: 'Test Post' }
            }],
            onMutation: `
                if (query.includes('performVoteComment') || query.includes('mutation Vote')) {
                    const { documentId, voteType } = variables;
                    return {
                        data: {
                            performVoteComment: {
                                document: {
                                    _id: documentId,
                                    baseScore: 10,
                                    voteCount: 1,
                                    extendedScore: { reacts: {} },
                                    currentUserVote: voteType === 'neutral' ? null : voteType,
                                    currentUserExtendedVote: null,
                                    afExtendedScore: { agreement: 0 }
                                }
                            }
                        }
                    };
                }
            `
        });

        const comment = page.locator('[data-id="hold-test-comment"]');
        const upvoteBtn = comment.locator('[data-action="karma-up"]');

        // Trigger Hold
        await upvoteBtn.hover();
        await page.mouse.down();
        await page.waitForTimeout(1100); // > 1000ms
        await page.mouse.up();

        // Verify visual strong vote class
        await expect(upvoteBtn).toHaveClass(/strong-vote/);
    });

    test('[PR-VOTE-05] voting when not logged in opens login page', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            currentUser: null,
            comments: [{
                _id: 'c1', postId: 'p1', postedAt: new Date().toISOString(),
                user: { username: 'U', karma: 100 }, post: { _id: 'p1', title: 'P' },
                htmlBody: '<p>Vote here</p>'
            }]
        });

        const upvoteBtn = page.locator('.pr-comment[data-id="c1"] [data-action="karma-up"]');
        await expect(upvoteBtn).toBeVisible({ timeout: 15000 });

        // Trigger via mousedown since that's where the app listens for login status
        await upvoteBtn.hover();
        await page.mouse.down();
        await page.mouse.up();

        // Wait for async window.open (mocked in setup.ts to set __OPENED_TAB)
        await page.waitForFunction(() => (window as any).__OPENED_TAB !== undefined, { timeout: 15000 });

        const openedTab = await page.evaluate(() => (window as any).__OPENED_TAB);
        expect(openedTab).toContain('lesswrong.com/auth/auth0');
    });
});
