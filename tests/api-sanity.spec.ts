/**
 * Live API sanity check: verifies that the LessWrong GraphQL fields
 * the power-reader depends on still exist and return the expected shapes.
 * Intentionally hits the live server. Keep to 1-2 requests.
 *
 * Run with: npx playwright test tests/api-sanity.spec.ts
 */
import { test, expect } from '@playwright/test';

const GRAPHQL_URL = 'https://www.lesswrong.com/graphql';

test('verify comment, post, and user fields used by power-reader', async ({ request }) => {
  const query = `
    query ApiSanityComments {
      comments(
        selector: { allRecentComments: {} },
        limit: 5
      ) {
        results {
          # Comment core fields
          _id
          postedAt
          htmlBody
          baseScore
          voteCount
          pageUrl
          author
          contents { markdown }

          # Comment vote/reaction fields
          extendedScore
          afExtendedScore
          currentUserVote
          currentUserExtendedVote

          # Comment -> User
          user {
            _id
            username
            displayName
            slug
            karma
          }

          # Comment -> Post
          postId
          post {
            _id
            title
            slug
            pageUrl
            postedAt
            baseScore
            voteCount
            extendedScore
            afExtendedScore
            currentUserVote
            currentUserExtendedVote
            contents { markdown }
            user {
              _id
              username
              displayName
              slug
              karma
            }
          }

          # Comment -> Parent Comment
          parentCommentId
          parentComment {
            _id
            user {
              _id
              username
              displayName
            }
          }
        }
      }
    }
  `;

  const response = await request.post(GRAPHQL_URL, {
    data: { query },
  });

  expect(response.ok()).toBeTruthy();
  const json = await response.json();
  expect(json.errors).toBeUndefined();

  const results = json.data?.comments?.results;
  expect(results).toBeDefined();
  expect(results.length).toBeGreaterThan(0);

  const c = results[0];

  // -- Comment fields --
  expect(c).toHaveProperty('_id');
  expect(c).toHaveProperty('postedAt');
  expect(c).toHaveProperty('htmlBody');
  expect(c).toHaveProperty('baseScore');
  expect(c).toHaveProperty('voteCount');
  expect(c).toHaveProperty('pageUrl');
  expect(c).toHaveProperty('contents');
  expect(c).toHaveProperty('extendedScore');
  expect(c).toHaveProperty('currentUserVote');
  expect(c).toHaveProperty('currentUserExtendedVote');

  // -- Comment -> User --
  expect(c.user).toHaveProperty('_id');
  expect(c.user).toHaveProperty('username');
  expect(c.user).toHaveProperty('displayName');
  expect(c.user).toHaveProperty('slug');
  expect(c.user).toHaveProperty('karma');

  // -- Comment -> Post --
  expect(c).toHaveProperty('postId');
  const p = c.post;
  expect(p).toHaveProperty('_id');
  expect(p).toHaveProperty('title');
  expect(p).toHaveProperty('slug');
  expect(p).toHaveProperty('pageUrl');
  expect(p).toHaveProperty('postedAt');
  expect(p).toHaveProperty('baseScore');
  expect(p).toHaveProperty('voteCount');
  expect(p).toHaveProperty('extendedScore');
  expect(p).toHaveProperty('currentUserVote');
  expect(p).toHaveProperty('currentUserExtendedVote');
  expect(p).toHaveProperty('contents');
  if (p.user) {
    expect(p.user).toHaveProperty('karma');
  }

  // -- Parent comment (find a reply) --
  const reply = results.find((r: any) => r.parentCommentId);
  if (reply) {
    expect(reply.parentComment).toHaveProperty('_id');
    expect(reply.parentComment.user).toHaveProperty('username');
    expect(reply.parentComment.user).toHaveProperty('displayName');
  }
});

test('verify performVoteComment mutation structure via neutral vote on nonexistent doc', async ({ request }) => {
  const mutation = `
    mutation ApiSanityVote($documentId: String!, $voteType: String!, $extendedVote: JSON) {
      performVoteComment(documentId: $documentId, voteType: $voteType, extendedVote: $extendedVote) {
        document {
          _id
          baseScore
          voteCount
          extendedScore
          afExtendedScore
          currentUserVote
          currentUserExtendedVote
          contents { markdown }
        }
      }
    }
  `;

  const response = await request.post(GRAPHQL_URL, {
    data: {
      query: mutation,
      variables: {
        documentId: 'nonexistent_sanity_check',
        voteType: 'neutral',
      },
    },
  });

  const json = await response.json();

  // We expect an error (not logged in or doc not found), but NOT "Cannot query field".
  // A "Cannot query field" error means the schema has changed and our field selections are stale.
  expect(json.errors).toBeDefined();
  const fieldErrors = json.errors.filter((e: any) =>
    e.message.includes('Cannot query field')
  );
  expect(fieldErrors).toHaveLength(0);
});

test('verify GET_RECENT_COMMENTS supports offset', async ({ request }) => {
  const query = `
    query GetRecentComments($limit: Int!, $offset: Int) {
      comments(input: {
        terms: {
          view: "recentComments"
          limit: $limit
          offset: $offset
        }
      }) {
        results {
          _id
          postedAt
        }
      }
    }
  `;

  // Get 10 most recent
  const response1 = await request.post(GRAPHQL_URL, {
    data: { query, variables: { limit: 10, offset: 0 } }
  });
  const json1 = await response1.json();
  const ids1 = json1.data.comments.results.map((c: any) => c._id);

  // Get 10 starting from offset 10
  const response2 = await request.post(GRAPHQL_URL, {
    data: { query, variables: { limit: 10, offset: 10 } }
  });
  const json2 = await response2.json();
  const ids2 = json2.data.comments.results.map((c: any) => c._id);

  // Verify no overlap between consecutive batches
  const overlap = ids1.filter((id: string) => ids2.includes(id));
  expect(overlap.length).toBe(0);
  expect(ids1.length).toBe(10);
  expect(ids2.length).toBe(10);
});

test('verify comment ID to date resolution', async ({ request }) => {
  // Fetch a recent comment first to get an ID
  const queryRecent = `
    query {
      comments(input: { terms: { view: "recentComments", limit: 1 } }) {
        results { _id postedAt }
      }
    }
  `;
  const resRecent = await request.post(GRAPHQL_URL, { data: { query: queryRecent } });
  const jsonRecent = await resRecent.json();
  const target = jsonRecent.data.comments.results[0];

  const queryById = `
    query GetComment($id: String!) {
      comment(input: { selector: { _id: $id } }) {
        result { _id postedAt }
      }
    }
  `;
  const resById = await request.post(GRAPHQL_URL, {
    data: { query: queryById, variables: { id: target._id } }
  });
  const jsonById = await resById.json();

  expect(jsonById.data.comment.result._id).toBe(target._id);
  expect(jsonById.data.comment.result.postedAt).toBe(target.postedAt);
});

test.describe('GetCommentReplies Verification', () => {
  test('verify GetCommentReplies query structure with selector', async ({ request }) => {
    // First get a comment that has replies
    const query = `
    query GetRecentCommentsWithReplies {
      comments(input: {
        terms: {
          view: "recentComments"
          limit: 20
        }
      }) {
        results {
          _id
          descendentCount
        }
      }
    }
  `;
    const res = await request.post(GRAPHQL_URL, {
      data: { query }
    });
    const json = await res.json();
    const parent = json.data.comments.results.find((c: any) => c.descendentCount > 0);

    if (parent) {
      if (process.env.PW_SINGLE_FILE_RUN === 'true') {
        console.log(`Testing GetCommentReplies with parentId: ${parent._id}`);
      }
      const replyQuery = `
      query GetCommentReplies($parentCommentId: String!) {
        comments(
          selector: {
            commentReplies: {
              parentCommentId: $parentCommentId
            }
          }
        ) {
          results {
            _id
          }
        }
      }
    `;
      const replyRes = await request.post(GRAPHQL_URL, {
        data: {
          query: replyQuery,
          variables: { parentCommentId: parent._id }
        }
      });

      const replyJson = await replyRes.json();
      if (replyJson.errors) {
        console.error('GetCommentReplies Errors:', JSON.stringify(replyJson.errors, null, 2));
      }
      expect(replyJson.errors).toBeUndefined();
      expect(replyJson.data.comments.results).toBeDefined();
    } else {
      console.warn('No comments with replies found to test GetCommentReplies');
    }
  });
});
