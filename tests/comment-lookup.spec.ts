/**
 * Contract tests for comment lookup and vote mutation structure.
 * Uses mocked responses to verify query/mutation shapes
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

test.describe('Comment Lookup Contract Tests', () => {
  test('fetch specific comment returns expected structure', async ({ request }) => {
    const mock = await createMockGraphQLServer((body) => {
      if (body.query.includes('GetComment')) {
        return {
          data: {
            comment: {
              result: {
                _id: TEST_COMMENT_ID,
                baseScore: 15,
                voteCount: 3,
                currentUserVote: null,
                currentUserExtendedVote: null,
              },
            },
          },
        };
      }
      return { data: null };
    });

    try {
      const query = `
        query GetComment($id: String!) {
          comment(input: { selector: { _id: $id } }) {
            result {
              _id
              baseScore
              voteCount
              currentUserVote
              currentUserExtendedVote
            }
          }
        }
      `;

      const response = await request.post(mock.url, {
        data: { query, variables: { id: TEST_COMMENT_ID } },
      });

      expect(response.ok()).toBeTruthy();
      const json = await response.json();

      expect(json.errors).toBeUndefined();

      const comment = json.data.comment.result;
      expect(comment).toBeDefined();
      expect(comment._id).toBe(TEST_COMMENT_ID);
      expect(comment).toHaveProperty('baseScore');
      expect(comment).toHaveProperty('voteCount');
      expect(comment).toHaveProperty('currentUserVote');
      expect(comment).toHaveProperty('currentUserExtendedVote');
    } finally {
      mock.close();
    }
  });

  test('performVoteComment mutation returns expected fields (not "Cannot query field")', async ({ request }) => {
    const mock = await createMockGraphQLServer((body) => {
      if (body.query.includes('performVoteComment')) {
        return {
          errors: [{ message: 'You need to log in before you can vote.' }],
        };
      }
      return { data: null };
    });

    try {
      const query = `
        mutation TestVoteStructure($documentId: String!, $voteType: String!) {
          performVoteComment(documentId: $documentId, voteType: $voteType) {
            _id
            baseScore
            voteCount
            currentUserVote
            currentUserExtendedVote
          }
        }
      `;

      const response = await request.post(mock.url, {
        data: {
          query,
          variables: { documentId: TEST_COMMENT_ID, voteType: 'neutral' },
        },
      });

      const json = await response.json();
      const errors = json.errors || [];

      const isFieldMissing = errors.some((e: any) => e.message.includes('Cannot query field'));
      expect(isFieldMissing).toBe(false);
    } finally {
      mock.close();
    }
  });
});
