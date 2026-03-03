import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';
import { selectArchiveView, waitForArchiveRenderComplete } from './helpers/archiveControls';

test.describe('Archive Reaction Tooltips', () => {
  test('[PR-VOTE-07] archive thread view shows rich reaction tooltip on hover', async ({ page }) => {
    const username = 'ArchiveReactUser';
    const userObj = {
      _id: 'u-archive-user',
      username,
      displayName: 'Archive React User',
      slug: 'archive-react-user',
      karma: 100,
    };
    const postAuthor = {
      _id: 'u-post-author',
      username: 'PostAuthor',
      displayName: 'Post Author',
      slug: 'post-author',
      karma: 120,
    };
    const commentAuthor = {
      _id: 'u-comment-author',
      username: 'CommentAuthor',
      displayName: 'Comment Author',
      slug: 'comment-author',
      karma: 80,
    };

    await initPowerReader(
      page,
      {
        testMode: true,
        onGraphQL: `
          if (query.includes('UserBySlug') || query.includes('user(input:')) {
            return { data: { user: ${JSON.stringify(userObj)} } };
          }
          if (query.includes('GetUserPosts')) {
            return { data: { posts: { results: [] } } };
          }
          if (query.includes('GetUserComments')) {
            if (variables.after) {
              return { data: { comments: { results: [] } } };
            }
            return {
              data: {
                comments: {
                  results: [
                    {
                      _id: 'c-archive-react-tooltip',
                      postId: 'p-archive-react-tooltip',
                      postedAt: '2025-01-10T12:00:00Z',
                      pageUrl: 'https://www.lesswrong.com/posts/p-archive-react-tooltip/test?commentId=c-archive-react-tooltip',
                      htmlBody: '<p>Comment with reactions</p>',
                      contents: { markdown: 'Comment with reactions' },
                      baseScore: 10,
                      voteCount: 3,
                      currentUserVote: null,
                      currentUserExtendedVote: null,
                      parentCommentId: null,
                      parentComment: null,
                      user: ${JSON.stringify(commentAuthor)},
                      post: {
                        _id: 'p-archive-react-tooltip',
                        title: 'Archive Reaction Tooltip Post',
                        slug: 'archive-reaction-tooltip-post',
                        pageUrl: 'https://www.lesswrong.com/posts/p-archive-react-tooltip/test',
                        postedAt: '2025-01-10T11:00:00Z',
                        baseScore: 20,
                        voteCount: 5,
                        commentCount: 1,
                        wordCount: 100,
                        user: ${JSON.stringify(postAuthor)}
                      },
                      extendedScore: {
                        reacts: {
                          insightful: [
                            {
                              userId: 'u-react-1',
                              userName: 'Alice',
                              reactType: 'created',
                              quotes: ['Comment with reactions']
                            }
                          ]
                        },
                        agreement: 0,
                        agreementVoteCount: 0
                      },
                      afExtendedScore: { agreement: 0 }
                    }
                  ]
                }
              }
            };
          }
          return { data: {} };
        `,
      },
      `https://www.lesswrong.com/archive?username=${username}`
    );

    await waitForArchiveRenderComplete(page);
    await selectArchiveView(page, 'thread-full');

    const reactionChip = page.locator('.pr-comment[data-id="c-archive-react-tooltip"] .pr-reaction-chip').first();
    await expect(reactionChip).toBeVisible();
    await reactionChip.hover();

    const tooltip = page.locator('.pr-tooltip-global');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Insightful');
    await expect(tooltip).toContainText('Alice');
  });
});
