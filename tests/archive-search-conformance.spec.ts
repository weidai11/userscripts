import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ArchiveSearchRuntime } from '../src/scripts/power-reader/archive/search/engine';
import type { ArchiveSearchScope, ArchiveSearchSortMode } from '../src/scripts/power-reader/archive/search/types';

type ConformanceFixture = {
  name: string;
  query: string;
  scope?: ArchiveSearchScope;
  sort: ArchiveSearchSortMode;
  limit: number;
  expectedIds: string[];
  expectedTotal: number;
};

type ConformanceCorpusFile = {
  version: string;
  dataset: string;
  generatedAt?: string;
  fixtures: ConformanceFixture[];
};

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

const datasets: Record<string, { authored: any[]; context: any[] }> = {
  'baseline-v1': {
    authored: [
      makePost({
        _id: 'p-alpha',
        title: 'Alpha Alignment',
        postedAt: '2025-01-10T12:00:00Z',
        baseScore: 100,
        user: {
          _id: 'u-alice',
          username: 'alice',
          displayName: 'Alice',
          slug: 'alice',
          karma: 120
        },
        contents: { markdown: 'Mesa optimizer notes for alignment' }
      }),
      makePost({
        _id: 'p-beta',
        title: 'Beta Forecasting',
        postedAt: '2025-01-08T12:00:00Z',
        baseScore: 50,
        user: {
          _id: 'u-bob',
          username: 'bob',
          displayName: 'Bob',
          slug: 'bob',
          karma: 80
        },
        contents: { markdown: 'Calibration and forecasting updates' }
      }),
      makePost({
        _id: 'p-gamma',
        title: 'Gamma Policy',
        postedAt: '2025-01-05T12:00:00Z',
        baseScore: 10,
        user: {
          _id: 'u-alice',
          username: 'alice',
          displayName: 'Alice',
          slug: 'alice',
          karma: 120
        },
        contents: { markdown: 'Governance and policy design notes' }
      }),
      makeComment({
        _id: 'c-alpha',
        postedAt: '2025-01-11T12:00:00Z',
        baseScore: 5,
        htmlBody: '<p>alpha comment with optimizer</p>',
        contents: { markdown: 'alpha comment with optimizer' },
        user: {
          _id: 'u-carol',
          username: 'carol',
          displayName: 'Carol',
          slug: 'carol',
          karma: 40
        },
        parentComment: {
          _id: 'c-parent-a',
          user: {
            _id: 'u-alice',
            username: 'alice',
            displayName: 'Alice',
            slug: 'alice',
            karma: 120
          }
        },
        post: {
          _id: 'p-alpha',
          title: 'Alpha Alignment',
          slug: 'alpha-alignment',
          pageUrl: 'https://lesswrong.com/posts/p-alpha',
          user: {
            _id: 'u-alice',
            username: 'alice',
            displayName: 'Alice',
            slug: 'alice',
            karma: 120
          }
        },
        postId: 'p-alpha',
        parentCommentId: 'c-parent-a',
        topLevelCommentId: 'c-parent-a'
      }),
      makeComment({
        _id: 'c-beta',
        postedAt: '2025-01-09T12:00:00Z',
        baseScore: 2,
        htmlBody: '<p>beta comment disagreement</p>',
        contents: { markdown: 'beta comment disagreement' },
        user: {
          _id: 'u-bob',
          username: 'bob',
          displayName: 'Bob',
          slug: 'bob',
          karma: 80
        },
        parentComment: {
          _id: 'c-parent-b',
          user: {
            _id: 'u-carol',
            username: 'carol',
            displayName: 'Carol',
            slug: 'carol',
            karma: 40
          }
        },
        post: {
          _id: 'p-beta',
          title: 'Beta Forecasting',
          slug: 'beta-forecasting',
          pageUrl: 'https://lesswrong.com/posts/p-beta',
          user: {
            _id: 'u-bob',
            username: 'bob',
            displayName: 'Bob',
            slug: 'bob',
            karma: 80
          }
        },
        postId: 'p-beta',
        parentCommentId: 'c-parent-b',
        topLevelCommentId: 'c-parent-b'
      })
    ],
    context: [
      makePost({
        _id: 'p-context',
        title: 'Context Alignment',
        postedAt: '2025-01-07T12:00:00Z',
        baseScore: 20,
        user: {
          _id: 'u-dana',
          username: 'dana',
          displayName: 'Dana',
          slug: 'dana',
          karma: 30
        },
        contents: { markdown: 'External context material for alignment' }
      }),
      makeComment({
        _id: 'c-context',
        postedAt: '2025-01-06T12:00:00Z',
        baseScore: 1,
        htmlBody: '<p>context comment from dana</p>',
        contents: { markdown: 'context comment from dana' },
        user: {
          _id: 'u-dana',
          username: 'dana',
          displayName: 'Dana',
          slug: 'dana',
          karma: 30
        },
        parentComment: {
          _id: 'c-parent-c',
          user: {
            _id: 'u-bob',
            username: 'bob',
            displayName: 'Bob',
            slug: 'bob',
            karma: 80
          }
        },
        post: {
          _id: 'p-context',
          title: 'Context Alignment',
          slug: 'context-alignment',
          pageUrl: 'https://lesswrong.com/posts/p-context',
          user: {
            _id: 'u-dana',
            username: 'dana',
            displayName: 'Dana',
            slug: 'dana',
            karma: 30
          }
        },
        postId: 'p-context',
        parentCommentId: 'c-parent-c',
        topLevelCommentId: 'c-parent-c'
      })
    ]
  }
};

const conformanceDir = path.resolve(process.cwd(), 'tests/archive-search/conformance');
const corpusFiles = readdirSync(conformanceDir)
  .filter(name => name.endsWith('.json'))
  .sort();

for (const fileName of corpusFiles) {
  const fullPath = path.join(conformanceDir, fileName);
  const parsed = JSON.parse(readFileSync(fullPath, 'utf8')) as ConformanceCorpusFile;
  const dataset = datasets[parsed.dataset];

  test.describe(`archive search conformance: ${fileName}`, () => {
    test(`corpus metadata is valid (${parsed.fixtures.length} fixtures)`, () => {
      expect(parsed.version).toBeTruthy();
      expect(dataset).toBeTruthy();
      expect(parsed.fixtures.length).toBeGreaterThanOrEqual(50);
    });

    for (const fixture of parsed.fixtures) {
      test(fixture.name, () => {
        if (!dataset) {
          throw new Error(`Unknown conformance dataset: ${parsed.dataset}`);
        }

        const runtime = new ArchiveSearchRuntime();
        runtime.setAuthoredItems(dataset.authored);
        runtime.setContextItems(dataset.context);

        const result = runtime.runSearch({
          query: fixture.query,
          scopeParam: fixture.scope,
          sortMode: fixture.sort,
          limit: fixture.limit
        });

        expect(result.ids).toEqual(fixture.expectedIds);
        expect(result.total).toBe(fixture.expectedTotal);
      });
    }
  });
}
