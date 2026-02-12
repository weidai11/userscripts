/**
 * Live API sanity check: verifies that the LessWrong GraphQL fields
 * the power-reader depends on still exist and return the expected shapes.
 * Intentionally hits the live server with a minimal number of requests.
 *
 * Run with: npx playwright test tests/api-sanity.spec.ts
 */
import { test, expect } from '@playwright/test';

const GRAPHQL_URL = 'https://www.lesswrong.com/graphql';

type GraphQLError = {
  message?: string;
  [key: string]: unknown;
};

type GraphQLResponse = {
  data?: any;
  errors?: GraphQLError[];
  [key: string]: unknown;
};

const clip = (s: string, max = 800): string => (s.length > max ? `${s.slice(0, max)}...` : s);
const formatErrors = (errors?: GraphQLError[]): string => JSON.stringify(errors ?? [], null, 2);

const postGraphQL = async (
  request: any,
  label: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<GraphQLResponse> => {
  const response = await request.post(GRAPHQL_URL, {
    data: variables ? { query, variables } : { query },
  });

  const status = response.status();
  const headers = response.headers();
  const contentType = headers['content-type'] || '';
  const text = await response.text();

  if (!response.ok()) {
    console.error(`[api-sanity] ${label} HTTP ${status} content-type=${contentType}`);
    console.error(`[api-sanity] ${label} raw body: ${clip(text)}`);
  }

  let json: GraphQLResponse;
  try {
    json = JSON.parse(text);
  } catch {
    console.error(`[api-sanity] ${label} non-JSON response (status=${status}, content-type=${contentType})`);
    console.error(`[api-sanity] ${label} raw body: ${clip(text)}`);
    throw new Error(`[api-sanity] ${label} expected JSON but got non-JSON response`);
  }

  if (json.errors?.length) {
    console.error(`[api-sanity] ${label} GraphQL errors: ${formatErrors(json.errors)}`);
  }

  return json;
};

let batchA: GraphQLResponse;
let batchB: GraphQLResponse;
let expectedTarget: { _id: string; postedAt: string };

test.describe('Live API Sanity (batched)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    const queryA = `
      query ApiSanityBatchA {
        core: comments(selector: { allRecentComments: {} }, limit: 20) {
          results {
            _id
            postedAt
            htmlBody
            baseScore
            voteCount
            pageUrl
            author
            contents { markdown }
            extendedScore
            afExtendedScore
            currentUserVote
            currentUserExtendedVote
            descendentCount
            postId
            user {
              _id
              username
              displayName
              slug
              karma
            }
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
        page0: comments(input: { terms: { view: "recentComments", limit: 10, offset: 0 } }) {
          results { _id postedAt }
        }
        page10: comments(input: { terms: { view: "recentComments", limit: 10, offset: 10 } }) {
          results { _id postedAt }
        }
      }
    `;

    batchA = await postGraphQL(request, 'BatchA', queryA);
    expect(batchA.errors).toBeUndefined();

    const coreResults = batchA.data?.core?.results || [];
    expect(coreResults.length).toBeGreaterThan(0);

    expectedTarget = {
      _id: coreResults[0]._id,
      postedAt: coreResults[0].postedAt,
    };

    const parentWithReplies = coreResults.find((c: any) => (c.descendentCount || 0) > 0);
    const parentCommentId = parentWithReplies?._id || expectedTarget._id;

    const queryB = `
      query ApiSanityBatchB($id: String!, $parentCommentId: String!) {
        byId: comment(input: { selector: { _id: $id } }) {
          result { _id postedAt }
        }
        replies: comments(
          selector: {
            commentReplies: {
              parentCommentId: $parentCommentId
            }
          }
        ) {
          results { _id }
        }
      }
    `;

    batchB = await postGraphQL(request, 'BatchB', queryB, {
      id: expectedTarget._id,
      parentCommentId,
    });
    expect(batchB.errors).toBeUndefined();
  });

  test('verify comment, post, and user fields used by power-reader', async () => {
    const results = batchA.data?.core?.results;
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

  test('verify GET_RECENT_COMMENTS supports offset', async () => {
    const ids0 = (batchA.data?.page0?.results || []).map((c: any) => c._id);
    const ids10 = (batchA.data?.page10?.results || []).map((c: any) => c._id);

    const overlap = ids0.filter((id: string) => ids10.includes(id));
    expect(overlap.length).toBe(0);
    expect(ids0.length).toBe(10);
    expect(ids10.length).toBe(10);
  });

  test('verify comment ID to date resolution', async () => {
    const result = batchB.data?.byId?.result;
    expect(result).toBeDefined();
    expect(result._id).toBe(expectedTarget._id);
    expect(result.postedAt).toBe(expectedTarget.postedAt);
  });

  test('verify GetCommentReplies query structure with selector', async () => {
    expect(batchB.data?.replies?.results).toBeDefined();
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

    const json = await postGraphQL(request, 'VoteMutation', mutation, {
      documentId: 'nonexistent_sanity_check',
      voteType: 'neutral',
    });

    // We expect an error (not logged in or doc not found), but NOT "Cannot query field".
    // A "Cannot query field" error means the schema has changed and our field selections are stale.
    expect(json.errors).toBeDefined();
    const fieldErrors = json.errors!.filter((e: GraphQLError) =>
      String(e.message || '').includes('Cannot query field'),
    );
    expect(
      fieldErrors,
      `[api-sanity] VoteMutation schema error. Full server errors:\n${formatErrors(json.errors)}`,
    ).toHaveLength(0);
  });
});
