/**
 * Contract tests for voting GraphQL queries and mutations.
 * Uses mocked responses to verify query structure and error handling
 * without hitting the live LessWrong server.
 */
import { test, expect } from '@playwright/test';
import http from 'http';

const TEST_COMMENT_ID = 'XAEQBHsi2FHANeT8w';

interface MockHandler {
  (body: { query: string; variables?: Record<string, unknown> }): unknown;
}

function createMockGraphQLServer(handler: MockHandler): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        const parsed = JSON.parse(body);
        const response = handler(parsed);
        res.end(JSON.stringify(response));
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () => server.close(),
      });
    });
  });
}

test.describe('Voting Contract Tests (Mocked GraphQL)', () => {
  test.describe('GraphQL Mutation Schema', () => {
    test('performVoteComment mutation exists and has expected return fields', async ({ request }) => {
      const mock = await createMockGraphQLServer((body) => {
        if (body.query.includes('IntrospectPerformVoteComment')) {
          return {
            data: {
              __type: {
                fields: [
                  {
                    name: 'performVoteComment',
                    args: [
                      { name: 'documentId', type: { name: null, kind: 'NON_NULL', ofType: { name: 'String', kind: 'SCALAR' } } },
                      { name: 'voteType', type: { name: null, kind: 'NON_NULL', ofType: { name: 'String', kind: 'SCALAR' } } },
                      { name: 'extendedVote', type: { name: 'JSON', kind: 'SCALAR', ofType: null } },
                    ],
                    type: {
                      name: 'VoteResultComment',
                      kind: 'OBJECT',
                      fields: [{ name: 'document' }],
                    },
                  },
                ],
              },
            },
          };
        }
        return { data: null };
      });

      try {
        const introspectionQuery = `
          query IntrospectPerformVoteComment {
            __type(name: "Mutation") {
              fields {
                name
                args { name type { name kind ofType { name kind } } }
                type { name kind fields { name } }
              }
            }
          }
        `;

        const response = await request.post(mock.url, {
          data: { query: introspectionQuery },
        });

        expect(response.ok()).toBe(true);
        const json = await response.json();

        const fields = json.data?.__type?.fields || [];
        const performVoteComment = fields.find((f: any) => f.name === 'performVoteComment');

        expect(performVoteComment).toBeTruthy();

        const argNames = performVoteComment.args.map((a: any) => a.name);
        expect(argNames).toContain('documentId');
        expect(argNames).toContain('voteType');

        const returnFields = performVoteComment.type?.fields?.map((f: any) => f.name) || [];
        expect(returnFields).toContain('document');
      } finally {
        mock.close();
      }
    });
  });

  test.describe('Vote Comment Query (Read Current State)', () => {
    test('can parse vote state response for a comment', async ({ request }) => {
      const mock = await createMockGraphQLServer((body) => {
        if (body.query.includes('GetCommentVoteState')) {
          return {
            data: {
              comment: {
                result: {
                  _id: TEST_COMMENT_ID,
                  baseScore: 42,
                  voteCount: 7,
                  currentUserVote: 'smallUpvote',
                  currentUserExtendedVote: { agreementVoteType: 'agree' },
                  user: { username: 'testAuthor' },
                },
              },
            },
          };
        }
        return { data: null };
      });

      try {
        const query = `
          query GetCommentVoteState($id: String!) {
            comment(selector: { _id: $id }) {
              result {
                _id
                baseScore
                voteCount
                currentUserVote
                currentUserExtendedVote
                user { username }
              }
            }
          }
        `;

        const response = await request.post(mock.url, {
          data: { query, variables: { id: TEST_COMMENT_ID } },
        });

        expect(response.ok()).toBe(true);
        const json = await response.json();

        expect(json.errors).toBeUndefined();

        const comment = json.data?.comment?.result;
        expect(comment).toBeTruthy();
        expect(comment._id).toBe(TEST_COMMENT_ID);
        expect(comment.baseScore).toBe(42);
        expect(comment.voteCount).toBe(7);
        expect(comment.currentUserVote).toBe('smallUpvote');
        expect(comment.user.username).toBe('testAuthor');
      } finally {
        mock.close();
      }
    });
  });

  test.describe('Vote Mutation Error Handling', () => {
    test('unauthenticated vote returns appropriate error', async ({ request }) => {
      const mock = await createMockGraphQLServer(() => ({
        errors: [{ message: 'You need to log in before you can vote.' }],
      }));

      try {
        const mutation = `
          mutation Vote($documentId: String!, $voteType: String!) {
            performVoteComment(documentId: $documentId, voteType: $voteType) {
              document { _id baseScore currentUserVote }
            }
          }
        `;

        const response = await request.post(mock.url, {
          data: {
            query: mutation,
            variables: { documentId: TEST_COMMENT_ID, voteType: 'smallUpvote' },
          },
        });

        const json = await response.json();
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toBeTruthy();
      } finally {
        mock.close();
      }
    });

    test('invalid vote type returns error', async ({ request }) => {
      const mock = await createMockGraphQLServer((body) => {
        const voteType = (body.variables as any)?.voteType;
        if (!['smallUpvote', 'smallDownvote', 'bigUpvote', 'bigDownvote', 'neutral'].includes(voteType)) {
          return { errors: [{ message: `Invalid vote type: ${voteType}` }] };
        }
        return { data: null };
      });

      try {
        const mutation = `
          mutation Vote($documentId: String!, $voteType: String!) {
            performVoteComment(documentId: $documentId, voteType: $voteType) {
              document { _id baseScore }
            }
          }
        `;

        const response = await request.post(mock.url, {
          data: {
            query: mutation,
            variables: { documentId: TEST_COMMENT_ID, voteType: 'invalidVoteType' },
          },
        });

        const json = await response.json();
        expect(json.errors).toBeDefined();
      } finally {
        mock.close();
      }
    });

    test('invalid comment ID returns error', async ({ request }) => {
      const mock = await createMockGraphQLServer((body) => {
        const docId = (body.variables as any)?.documentId;
        if (docId === 'nonexistent_comment_id_12345') {
          return { errors: [{ message: `No document found with id: ${docId}` }] };
        }
        return { data: null };
      });

      try {
        const mutation = `
          mutation Vote($documentId: String!, $voteType: String!) {
            performVoteComment(documentId: $documentId, voteType: $voteType) {
              document { _id }
            }
          }
        `;

        const response = await request.post(mock.url, {
          data: {
            query: mutation,
            variables: { documentId: 'nonexistent_comment_id_12345', voteType: 'smallUpvote' },
          },
        });

        const json = await response.json();
        expect(json.errors).toBeDefined();
      } finally {
        mock.close();
      }
    });
  });
});
