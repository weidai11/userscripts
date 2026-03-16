import { expect, test } from '@playwright/test';
import {
  FACET_BUDGET_MS,
  computeFacets,
  createFacetAccumulator,
  scanFacetChunk
} from '../src/scripts/power-reader/archive/search/facets';

const makePost = (
  id: string,
  displayName: string,
  postedAt: string
): any => ({
  _id: id,
  title: `${id} title`,
  slug: `${id}-slug`,
  pageUrl: `https://lesswrong.com/posts/${id}`,
  postedAt,
  baseScore: 1,
  voteCount: 1,
  commentCount: 0,
  htmlBody: '<p>post body</p>',
  contents: { markdown: 'post body' },
  user: {
    _id: `${id}-user`,
    username: `${id}-user`,
    displayName,
    slug: `${id}-user`,
    karma: 10
  }
});

const makeComment = (
  id: string,
  displayName: string,
  postedAt: string
): any => ({
  _id: id,
  postedAt,
  baseScore: 1,
  voteCount: 1,
  htmlBody: '<p>comment body</p>',
  contents: { markdown: 'comment body' },
  user: {
    _id: `${id}-user`,
    username: `${id}-user`,
    displayName,
    slug: `${id}-user`,
    karma: 10
  },
  postId: 'p-parent',
  topLevelCommentId: id,
  parentCommentId: null,
  parentComment: null,
  post: {
    _id: 'p-parent',
    title: 'Parent Post',
    pageUrl: 'https://lesswrong.com/posts/p-parent',
    user: {
      _id: 'u-parent',
      username: 'parent-user',
      displayName: 'Parent User',
      slug: 'parent-user',
      karma: 10
    }
  },
  pageUrl: `https://lesswrong.com/posts/p-parent/comment/${id}`
});

test.describe('Archive Facets', () => {
  test('computes type/author/year facets and detects active clauses via AST', () => {
    const result = computeFacets([
      makePost('p-1', 'Alice Smith', '2025-02-01T00:00:00Z'),
      makeComment('c-1', 'Alice Smith', '2025-06-05T00:00:00Z'),
      makeComment('c-2', 'Bob Stone', '2024-03-03T00:00:00Z')
    ], 'type:comment author:"alice smith" date:2025-01-01..2025-12-31 -type:post');

    const groups = new Map(result.groups.map(group => [group.label, group]));
    const typeGroup = groups.get('Type');
    const authorGroup = groups.get('Author');
    const yearGroup = groups.get('Year');

    expect(result.delayed).toBe(false);
    expect(typeGroup?.items).toEqual([
      { value: 'Posts', queryFragment: 'type:post', count: 1, active: false },
      { value: 'Comments', queryFragment: 'type:comment', count: 2, active: true }
    ]);
    expect(authorGroup?.items).toEqual([
      { value: 'Alice Smith', queryFragment: 'author:"Alice Smith"', count: 2, active: true },
      { value: 'Bob Stone', queryFragment: 'author:"Bob Stone"', count: 1, active: false }
    ]);
    expect(yearGroup?.items).toEqual([
      { value: '2025', queryFragment: 'date:2025-01-01..2025-12-31', count: 2, active: true },
      { value: '2024', queryFragment: 'date:2024-01-01..2024-12-31', count: 1, active: false }
    ]);
  });

  test('escapes quoted author values in facet query fragments', () => {
    const displayName = 'A "B" \\\\ C';
    const result = computeFacets([
      makeComment('c-escape', displayName, '2025-01-01T00:00:00Z')
    ], '');

    const authorGroup = result.groups.find(group => group.label === 'Author');
    expect(authorGroup).toBeDefined();
    expect(authorGroup?.items[0]).toMatchObject({
      value: displayName,
      queryFragment: 'author:"A \\"B\\" \\\\\\\\ C"',
      count: 1,
      active: false
    });
  });

  test('marks year facets active only for exact full-year date ranges', () => {
    const items = [
      makeComment('c-2025', 'Year User', '2025-06-01T00:00:00Z'),
      makeComment('c-2024', 'Year User', '2024-03-01T00:00:00Z')
    ];

    const broadRange = computeFacets(items, 'date:2024-01-01..2025-12-31');
    const greaterThanRange = computeFacets(items, 'date:>2025-01-01');

    const broadYearItems = broadRange.groups.find(group => group.label === 'Year')?.items ?? [];
    const gtYearItems = greaterThanRange.groups.find(group => group.label === 'Year')?.items ?? [];

    expect(broadYearItems.length).toBeGreaterThan(0);
    expect(gtYearItems.length).toBeGreaterThan(0);
    expect(broadYearItems.every(item => item.active === false)).toBe(true);
    expect(gtYearItems.every(item => item.active === false)).toBe(true);
  });

  test('[PR-UARCH-53] returns sampled facets with delayed status when compute budget is exceeded', () => {
    const originalNow = Date.now;
    let tick = 0;
    Date.now = () => {
      tick += 20;
      return tick;
    };

    try {
      const largeItems = Array.from({ length: 240 }, (_, i) =>
        makeComment(`c-${i}`, 'Delay User', '2025-01-01T00:00:00Z')
      );
      const result = computeFacets(largeItems, '');
      const typeGroup = result.groups.find(group => group.label === 'Type');
      const authorGroup = result.groups.find(group => group.label === 'Author');

      expect(result.delayed).toBe(true);
      expect(typeGroup?.items[0]).toMatchObject({
        value: 'Comments',
        queryFragment: 'type:comment',
        active: false
      });
      expect(typeGroup?.items[0].count ?? 0).toBeGreaterThanOrEqual(100);
      expect(typeGroup?.items[0].count ?? 0).toBeLessThan(240);
      expect(authorGroup?.items[0]).toMatchObject({
        value: 'Delay User',
        queryFragment: 'author:"Delay User"',
        active: false
      });
      expect(authorGroup?.items[0].count ?? 0).toBeGreaterThanOrEqual(100);
      expect(authorGroup?.items[0].count ?? 0).toBeLessThan(240);
      expect(result.computeMs).toBeGreaterThan(FACET_BUDGET_MS);
    } finally {
      Date.now = originalNow;
    }
  });

  test('[PR-UARCH-53] computes exact facets when budget is disabled', () => {
    const originalNow = Date.now;
    let tick = 0;
    Date.now = () => {
      tick += 20;
      return tick;
    };

    try {
      const largeItems = Array.from({ length: 240 }, (_, i) =>
        makeComment(`c-exact-${i}`, 'Exact User', '2025-01-01T00:00:00Z')
      );
      const result = computeFacets(largeItems, '', { budgetMs: Number.POSITIVE_INFINITY });
      const typeGroup = result.groups.find(group => group.label === 'Type');
      const authorGroup = result.groups.find(group => group.label === 'Author');

      expect(result.delayed).toBe(false);
      expect(typeGroup?.items).toEqual([
        { value: 'Comments', queryFragment: 'type:comment', count: 240, active: false }
      ]);
      expect(authorGroup?.items[0]).toMatchObject({
        value: 'Exact User',
        queryFragment: 'author:"Exact User"',
        count: 240,
        active: false
      });
    } finally {
      Date.now = originalNow;
    }
  });

  test('[PR-UARCH-53] chunked refinement converges to exact facets across multiple passes', () => {
    const originalNow = Date.now;
    let tick = 0;
    Date.now = () => {
      tick += 20;
      return tick;
    };

    try {
      const largeItems = Array.from({ length: 240 }, (_, i) =>
        makeComment(`c-chunk-${i}`, 'Chunk User', '2025-01-01T00:00:00Z')
      );
      const accumulator = createFacetAccumulator();
      let nextIndex = 0;
      let finalResult: ReturnType<typeof scanFacetChunk> | null = null;
      let passCount = 0;

      while (finalResult === null || !finalResult.done) {
        finalResult = scanFacetChunk(largeItems, '', {
          accumulator,
          startIndex: nextIndex,
          budgetMs: FACET_BUDGET_MS
        });
        nextIndex = finalResult.nextIndex;
        passCount += 1;
        expect(passCount).toBeLessThan(10);
      }

      const typeGroup = finalResult.groups.find(group => group.label === 'Type');
      const authorGroup = finalResult.groups.find(group => group.label === 'Author');

      expect(passCount).toBeGreaterThan(1);
      expect(finalResult.delayed).toBe(false);
      expect(typeGroup?.items).toEqual([
        { value: 'Comments', queryFragment: 'type:comment', count: 240, active: false }
      ]);
      expect(authorGroup?.items[0]).toMatchObject({
        value: 'Chunk User',
        queryFragment: 'author:"Chunk User"',
        count: 240,
        active: false
      });
    } finally {
      Date.now = originalNow;
    }
  });
});
