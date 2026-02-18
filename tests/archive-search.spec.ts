import { expect, test } from '@playwright/test';
import { ArchiveSearchRuntime } from '../src/scripts/power-reader/archive/search/engine';
import { parseStructuredQuery } from '../src/scripts/power-reader/archive/search/parser';

const makePost = (overrides: Record<string, unknown> = {}) => ({
  _id: 'p-default',
  title: 'Default Post',
  slug: 'default-post',
  pageUrl: 'https://lesswrong.com/posts/p-default',
  postedAt: '2025-01-01T12:00:00Z',
  baseScore: 1,
  voteCount: 1,
  htmlBody: '<p>default body</p>',
  user: {
    _id: 'u-default',
    username: 'default_user',
    displayName: 'Default User',
    slug: 'default-user',
    karma: 1
  },
  extendedScore: null,
  afExtendedScore: null,
  currentUserVote: null,
  currentUserExtendedVote: null,
  contents: { markdown: 'default body' },
  ...overrides
});

const makeComment = (overrides: Record<string, unknown> = {}) => ({
  _id: 'c-default',
  postedAt: '2025-01-01T12:00:00Z',
  baseScore: 1,
  voteCount: 1,
  htmlBody: '<p>default comment</p>',
  user: {
    _id: 'u-default',
    username: 'default_user',
    displayName: 'Default User',
    slug: 'default-user',
    karma: 1
  },
  postId: 'p-default',
  topLevelCommentId: 'c-default',
  parentCommentId: null,
  parentComment: null,
  post: {
    _id: 'p-parent',
    title: 'Parent Post',
    slug: 'parent-post',
    pageUrl: 'https://lesswrong.com/posts/p-parent',
    user: {
      _id: 'u-parent',
      username: 'parent_user',
      displayName: 'Parent User',
      slug: 'parent-user',
      karma: 1
    }
  },
  pageUrl: 'https://lesswrong.com/posts/p-default/comment/c-default',
  contents: { markdown: 'default comment' },
  ...overrides
});

test.describe('Archive Structured Search Core', () => {
  test('slash-prefixed malformed regex token is warned and excluded', () => {
    const parsed = parseStructuredQuery('/foo');
    expect(parsed.warnings.some(w => w.type === 'invalid-regex')).toBeTruthy();
    expect(parsed.clauses).toHaveLength(0);
    expect(parsed.executableQuery).toBe('');
  });

  test('normalized multi-token term still matches via Stage-A acceleration', () => {
    const runtime = new ArchiveSearchRuntime();
    runtime.setAuthoredItems([
      makePost({
        _id: 'p-ea',
        title: 'EA Forum announcement',
        contents: { markdown: 'EA Forum launch notes' }
      }) as any,
      makePost({
        _id: 'p-other',
        title: 'Completely unrelated',
        contents: { markdown: 'No overlap terms here' }
      }) as any
    ]);
    runtime.setContextItems([]);

    const result = runtime.runSearch({
      query: 'ea-forum',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20
    });

    expect(result.ids).toContain('p-ea');
    expect(result.ids).not.toContain('p-other');
    expect(result.total).toBe(1);
  });

  test('normalized multi-token term does not match across title/body boundary', () => {
    const runtime = new ArchiveSearchRuntime();
    runtime.setAuthoredItems([
      makePost({
        _id: 'p-boundary-hit',
        title: 'EA Forum announcement',
        contents: { markdown: 'Additional details' }
      }) as any,
      makePost({
        _id: 'p-boundary-cross',
        title: 'EA',
        contents: { markdown: 'Forum announcement' }
      }) as any
    ]);
    runtime.setContextItems([]);

    const result = runtime.runSearch({
      query: 'ea-forum',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20
    });

    expect(result.ids).toContain('p-boundary-hit');
    expect(result.ids).not.toContain('p-boundary-cross');
  });

  test('field-positive query with negation is accepted', () => {
    const runtime = new ArchiveSearchRuntime();
    runtime.setAuthoredItems([
      makePost({
        _id: 'p-alice',
        title: 'Alice post',
        user: {
          _id: 'u-alice',
          username: 'alice',
          displayName: 'Alice',
          slug: 'alice',
          karma: 10
        }
      }) as any,
      makeComment({
        _id: 'c-alice',
        htmlBody: '<p>Alice comment</p>',
        contents: { markdown: 'Alice comment' },
        user: {
          _id: 'u-alice',
          username: 'alice',
          displayName: 'Alice',
          slug: 'alice',
          karma: 10
        }
      }) as any
    ]);
    runtime.setContextItems([]);

    const result = runtime.runSearch({
      query: 'author:"alice" -type:post',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20
    });

    expect(result.ids).toEqual(['c-alice']);
    expect(result.diagnostics.parseState).toBe('valid');
    expect(result.diagnostics.warnings.some(w => w.type === 'negation-only')).toBeFalsy();
  });

  test('negation-only query is rejected with one warning entry', () => {
    const runtime = new ArchiveSearchRuntime();
    runtime.setAuthoredItems([
      makePost({ _id: 'p-negonly', title: 'Any post' }) as any
    ]);
    runtime.setContextItems([]);

    const result = runtime.runSearch({
      query: '-type:post',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20
    });

    expect(result.ids).toEqual([]);
    expect(result.diagnostics.parseState).toBe('invalid');
    expect(result.diagnostics.warnings.filter(w => w.type === 'negation-only')).toHaveLength(1);
  });

  test('impossible calendar dates in date filters are rejected [PR-UARCH-40]', () => {
    const parsed = parseStructuredQuery('date:2025-02-31');

    expect(parsed.warnings.some(w => w.type === 'malformed-date')).toBeTruthy();
    expect(parsed.clauses.some(clause => clause.kind === 'date')).toBeFalsy();
    expect(parsed.executableQuery).toBe('');
  });

  test('gt/lt field clauses set only relevant bound inclusivity flags', () => {
    const scoreGt = parseStructuredQuery('score:>10').clauses.find(c => c.kind === 'score') as any;
    const scoreLt = parseStructuredQuery('score:<10').clauses.find(c => c.kind === 'score') as any;
    const dateGt = parseStructuredQuery('date:>2025-01-01').clauses.find(c => c.kind === 'date') as any;
    const dateLt = parseStructuredQuery('date:<2025-01-01').clauses.find(c => c.kind === 'date') as any;

    expect(scoreGt.includeMin).toBe(false);
    expect(scoreGt.includeMax).toBe(false);
    expect(scoreLt.includeMin).toBe(false);
    expect(scoreLt.includeMax).toBe(false);
    expect(dateGt.includeMin).toBe(false);
    expect(dateGt.includeMax).toBe(false);
    expect(dateLt.includeMin).toBe(false);
    expect(dateLt.includeMax).toBe(false);
  });

  test('canonical query round-trip preserves normalized single-term semantics', () => {
    const parsed = parseStructuredQuery('ea-forum');
    const reparsed = parseStructuredQuery(parsed.executableQuery);

    expect(parsed.clauses).toHaveLength(1);
    expect(parsed.clauses[0]).toMatchObject({ kind: 'term', valueNorm: 'ea forum', negated: false });
    expect(reparsed.clauses).toEqual(parsed.clauses);
  });

  test('sticky regex flag is stripped to keep corpus matching deterministic', () => {
    const parsed = parseStructuredQuery('/foo/y');
    const regexClause = parsed.clauses.find(clause => clause.kind === 'regex');
    expect(regexClause?.kind).toBe('regex');
    expect((regexClause as any).flags.includes('y')).toBeFalsy();

    const runtime = new ArchiveSearchRuntime();
    runtime.setAuthoredItems([
      makePost({
        _id: 'p-rx-1',
        title: 'Doc One',
        contents: { markdown: 'foo appears here' }
      }) as any,
      makePost({
        _id: 'p-rx-2',
        title: 'Doc Two',
        contents: { markdown: 'foo appears here too' }
      }) as any
    ]);
    runtime.setContextItems([]);

    const result = runtime.runSearch({
      query: '/foo/y',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20
    });

    expect(result.total).toBe(2);
    expect(result.ids).toEqual(['p-rx-1', 'p-rx-2']);
  });

  test('reusing the same authored items reference does not rebuild authored index', () => {
    const runtime = new ArchiveSearchRuntime();
    const items = [
      makePost({ _id: 'p-one', title: 'One' }),
      makePost({ _id: 'p-two', title: 'Two' })
    ] as any[];

    runtime.setAuthoredItems(items);
    const firstIndex = (runtime as any).authoredIndex;
    runtime.setAuthoredItems(items);
    const secondIndex = (runtime as any).authoredIndex;

    expect(secondIndex).toBe(firstIndex);
  });

  test('same authored reference rebuilds when revision token changes', () => {
    const runtime = new ArchiveSearchRuntime();
    const items = [
      makePost({ _id: 'p-one', title: 'One' }),
      makePost({ _id: 'p-two', title: 'Two' })
    ] as any[];

    runtime.setAuthoredItems(items, 1);
    const firstIndex = (runtime as any).authoredIndex;
    runtime.setAuthoredItems(items, 2);
    const secondIndex = (runtime as any).authoredIndex;

    expect(secondIndex).not.toBe(firstIndex);
  });

  test('append-only authored updates patch index without full rebuild', () => {
    const runtime = new ArchiveSearchRuntime();
    const first = [
      makePost({ _id: 'p-a', title: 'Alpha' })
    ] as any[];
    const second = [
      makePost({ _id: 'p-b', title: 'Beta' }),
      ...first
    ] as any[];

    runtime.setAuthoredItems(first, 1);
    const before = (runtime as any).authoredIndex;
    runtime.setAuthoredItems(second, 2);
    const after = (runtime as any).authoredIndex;

    expect(after).toBe(before);

    const result = runtime.runSearch({
      query: 'beta',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20
    });
    expect(result.ids).toContain('p-b');
  });

  test('existing-item replacement triggers full authored rebuild', () => {
    const runtime = new ArchiveSearchRuntime();
    const first = [
      makePost({ _id: 'p-a', title: 'Alpha', contents: { markdown: 'old body' } })
    ] as any[];
    const replaced = [
      makePost({ _id: 'p-a', title: 'Alpha', contents: { markdown: 'new body' } })
    ] as any[];

    runtime.setAuthoredItems(first, 1);
    const before = (runtime as any).authoredIndex;
    runtime.setAuthoredItems(replaced, 2);
    const after = (runtime as any).authoredIndex;

    expect(after).not.toBe(before);
  });

  test('phrase-only query matches exact substring in body', () => {
    const runtime = new ArchiveSearchRuntime();
    runtime.setAuthoredItems([
      makePost({
        _id: 'p-phrase-hit',
        title: 'Unrelated title',
        contents: { markdown: 'The quick brown fox jumps over the lazy dog' }
      }) as any,
      makePost({
        _id: 'p-phrase-miss',
        title: 'Another post',
        contents: { markdown: 'No matching content here at all' }
      }) as any
    ]);
    runtime.setContextItems([]);

    const result = runtime.runSearch({
      query: '"quick brown fox"',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20
    });

    expect(result.ids).toEqual(['p-phrase-hit']);
    expect(result.total).toBe(1);
  });

  test('wildcard + negation returns everything except excluded type', () => {
    const runtime = new ArchiveSearchRuntime();
    runtime.setAuthoredItems([
      makePost({ _id: 'p-wild', title: 'A post' }) as any,
      makeComment({
        _id: 'c-wild',
        htmlBody: '<p>A comment</p>',
        contents: { markdown: 'A comment' }
      }) as any
    ]);
    runtime.setContextItems([]);

    const result = runtime.runSearch({
      query: '* -type:post',
      scopeParam: 'authored',
      sortMode: 'date',
      limit: 20
    });

    expect(result.ids).toEqual(['c-wild']);
    expect(result.total).toBe(1);
  });

  test('scope:all dedup prefers authored over context for same ID', () => {
    const runtime = new ArchiveSearchRuntime();
    const authoredPost = makePost({
      _id: 'p-shared',
      title: 'Authored version',
      contents: { markdown: 'Full authored body with details' }
    }) as any;
    const contextPost = makePost({
      _id: 'p-shared',
      title: 'Context version',
      contents: { markdown: 'Lite context body' }
    }) as any;

    runtime.setAuthoredItems([authoredPost]);
    runtime.setContextItems([contextPost]);

    const result = runtime.runSearch({
      query: '*',
      scopeParam: 'all',
      sortMode: 'date',
      limit: 20
    });

    expect(result.ids).toEqual(['p-shared']);
    expect(result.total).toBe(1);
    const item = result.items[0] as any;
    expect(item.title).toBe('Authored version');
  });

  test('escaped quotes inside phrase are tokenized correctly', () => {
    const parsed = parseStructuredQuery('author:"foo \\"bar\\" baz"');
    const authorClause = parsed.clauses.find(c => c.kind === 'author');
    expect(authorClause).toBeDefined();
    expect((authorClause as any).valueNorm).toContain('foo');
    expect((authorClause as any).valueNorm).toContain('baz');
  });

  test('budgetMs:0 disables time budget enforcement', () => {
    const runtime = new ArchiveSearchRuntime();
    const items = Array.from({ length: 500 }, (_, i) =>
      makePost({
        _id: `p-budget-${i}`,
        title: `Post ${i}`,
        contents: { markdown: `Content for post number ${i}` }
      })
    ) as any[];
    runtime.setAuthoredItems(items);
    runtime.setContextItems([]);

    const result = runtime.runSearch({
      query: 'post content',
      scopeParam: 'authored',
      sortMode: 'date',
      limit: 1000,
      budgetMs: 0
    });

    expect(result.diagnostics.partialResults).toBe(false);
    expect(result.total).toBe(500);
  });
});
