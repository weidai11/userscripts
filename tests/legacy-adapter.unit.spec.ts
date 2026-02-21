/**
 * Unit tests for the EAF legacy GraphQL query adapter.
 *
 * The adapter rewrites modern selector-based queries into the legacy
 * input/terms format that EA Forum requires.
 *
 * Run with: npx playwright test tests/legacy-adapter.unit.spec.ts
 */
import { test, expect } from '@playwright/test';
import { adaptForLegacy, buildLegacyQuery, buildLegacyVariables, LEGACY_ADAPTERS } from '../src/shared/graphql/legacyAdapter';
import * as Q from '../src/shared/graphql/queries';

// ---------------------------------------------------------------------------
// Query rewriting
// ---------------------------------------------------------------------------

test.describe('[PR-DATA-05] Legacy Adapter – query rewriting', () => {
    test('[PR-DATA-05] rewrites multi-document variable declarations', () => {
        const { query } = adaptForLegacy(Q.GET_ALL_RECENT_COMMENTS_LITE, {});
        expect(query).toContain('$input: MultiCommentInput');
        expect(query).not.toMatch(/\$limit/);
        expect(query).not.toMatch(/\$offset/);
    });

    test('[PR-DATA-05] rewrites multi-document field arguments', () => {
        const { query } = adaptForLegacy(Q.GET_ALL_RECENT_COMMENTS_LITE, {});
        expect(query).toContain('comments(input: $input) {');
        expect(query).not.toContain('selector:');
    });

    test('[PR-DATA-05] rewrites single-document queries', () => {
        const { query } = adaptForLegacy(Q.GET_POST, { id: 'abc' });
        expect(query).toContain('$input: SinglePostInput');
        expect(query).toContain('post(input: $input) {');
        expect(query).not.toContain('selector:');
    });

    test('[PR-DATA-05] preserves fragment content', () => {
        const { query } = adaptForLegacy(Q.GET_ALL_RECENT_COMMENTS_LITE, {});
        expect(query).toContain('fragment CommentFieldsLite');
        expect(query).toContain('fragment PostFieldsLite');
    });

    test('[PR-DATA-05] preserves selection set', () => {
        const { query } = adaptForLegacy(Q.GET_POST_COMMENTS, { postId: 'x' });
        expect(query).toContain('results {');
        expect(query).toContain('...CommentFieldsFull');
    });
});

// ---------------------------------------------------------------------------
// Variable transformation
// ---------------------------------------------------------------------------

test.describe('[PR-DATA-05] Legacy Adapter – variable transformation', () => {
    test('[PR-DATA-05] multi: wraps variables in input.terms with view', () => {
        const { variables } = adaptForLegacy(Q.GET_ALL_RECENT_COMMENTS_LITE, {
            after: '2024-01-01', limit: 10, sortBy: 'newest',
        });
        expect(variables).toEqual({
            input: {
                terms: {
                    view: 'allRecentComments',
                    after: '2024-01-01',
                    limit: 10,
                    sortBy: 'newest',
                },
            },
        });
    });

    test('[PR-DATA-05] multi: merges inlineTerms', () => {
        const { variables } = adaptForLegacy(Q.GET_SUBSCRIPTIONS, { userId: 'u1' });
        expect(variables.input.terms).toMatchObject({
            view: 'subscriptionState',
            userId: 'u1',
            collectionName: 'Users',
        });
    });

    test('[PR-DATA-05] multi: inlineTerms for UserPosts', () => {
        const { variables } = adaptForLegacy(Q.GET_USER_POSTS, { userId: 'u1', limit: 50, after: '2024-06-01' });
        expect(variables.input.terms).toMatchObject({
            view: 'userPosts',
            userId: 'u1',
            limit: 50,
            after: '2024-06-01',
            sortedBy: 'oldest',
        });
    });

    test('[PR-DATA-05] multi: inlineTerms for UserComments', () => {
        const { variables } = adaptForLegacy(Q.GET_USER_COMMENTS, { userId: 'u1', limit: 100 });
        expect(variables.input.terms).toMatchObject({
            view: 'allRecentComments',
            userId: 'u1',
            limit: 100,
            sortBy: 'oldest',
        });
    });

    test('[PR-DATA-05] multi: omits view for default view (GetCommentsByIds)', () => {
        const { variables } = adaptForLegacy(Q.GET_COMMENTS_BY_IDS, { commentIds: ['a', 'b'] });
        expect(variables.input.terms.view).toBeUndefined();
        expect(variables.input.terms.commentIds).toEqual(['a', 'b']);
    });

    test('[PR-DATA-05] single: wraps id in input.selector._id', () => {
        const { variables } = adaptForLegacy(Q.GET_POST, { id: 'post123' });
        expect(variables).toEqual({ input: { selector: { _id: 'post123' } } });
    });

    test('[PR-DATA-05] single: comment by id', () => {
        const { variables } = adaptForLegacy(Q.GET_COMMENT, { id: 'cmt456' });
        expect(variables).toEqual({ input: { selector: { _id: 'cmt456' } } });
    });

    test('[PR-DATA-05] single: user by id', () => {
        const { variables } = adaptForLegacy(Q.GET_USER, { id: 'usr789' });
        expect(variables).toEqual({ input: { selector: { _id: 'usr789' } } });
    });
});

// ---------------------------------------------------------------------------
// Pass-through (queries not in the registry)
// ---------------------------------------------------------------------------

test.describe('[PR-DATA-05] Legacy Adapter – pass-through', () => {
    test('[PR-DATA-05] mutations pass through unchanged', () => {
        const original = Q.VOTE_COMMENT_MUTATION;
        const vars = { documentId: 'd1', voteType: 'smallUpvote' };
        const { query, variables } = adaptForLegacy(original, vars);
        expect(query).toBe(original);
        expect(variables).toBe(vars);
    });

    test('[PR-DATA-05] GetUserBySlug passes through unchanged', () => {
        const vars = { slug: 'someone' };
        const { query, variables } = adaptForLegacy(Q.GET_USER_BY_SLUG, vars);
        expect(query).toBe(Q.GET_USER_BY_SLUG);
        expect(variables).toBe(vars);
    });

    test('[PR-DATA-05] GetCurrentUser passes through unchanged', () => {
        const { query, variables } = adaptForLegacy(Q.GET_CURRENT_USER, {});
        expect(query).toBe(Q.GET_CURRENT_USER);
    });
});

// ---------------------------------------------------------------------------
// Coverage: every registered adapter has a matching query constant
// ---------------------------------------------------------------------------

test.describe('[PR-DATA-05] Legacy Adapter – registry coverage', () => {
    const queryByOpName: Record<string, string> = {};
    for (const [key, value] of Object.entries(Q)) {
        if (typeof value !== 'string') continue;
        const m = value.match(/(?:query|mutation)\s+(\w+)/);
        if (m) queryByOpName[m[1]] = key;
    }

    for (const opName of Object.keys(LEGACY_ADAPTERS)) {
        test(`[PR-DATA-05] adapter "${opName}" has a matching query export`, () => {
            expect(queryByOpName[opName]).toBeDefined();
        });
    }
});
