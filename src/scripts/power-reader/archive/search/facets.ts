import { parseStructuredQuery } from './parser';
import { normalizeForSearch } from './normalize';
import type { ArchiveItem } from './types';

export type FacetGroup = {
  label: string;
  items: FacetItem[];
};

export type FacetItem = {
  value: string;
  queryFragment: string;
  count: number;
  active: boolean;
};

export type FacetResult = {
  groups: FacetGroup[];
  delayed: boolean;
  computeMs: number;
};

export const FACET_BUDGET_MS = 30;
const FACET_BUDGET_CHECK_INTERVAL = 100;

export type FacetComputeOptions = {
  budgetMs?: number;
};

export type FacetAccumulator = {
  postCount: number;
  commentCount: number;
  authorCounts: Map<string, { display: string; count: number }>;
  yearCounts: Map<number, number>;
};

export type FacetChunkOptions = FacetComputeOptions & {
  startIndex?: number;
  accumulator?: FacetAccumulator;
};

export type FacetChunkResult = FacetResult & {
  nextIndex: number;
  done: boolean;
  accumulator: FacetAccumulator;
};

const escapeQueryQuotedValue = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const getYearFromTimestamp = (ms: number): number | null => {
  if (!Number.isFinite(ms)) return null;
  const year = new Date(ms).getUTCFullYear();
  return Number.isFinite(year) ? year : null;
};

const getYearFromPostedAt = (postedAt: string): number | null => {
  const timestamp = Date.parse(postedAt);
  if (!Number.isFinite(timestamp)) return null;
  return getYearFromTimestamp(timestamp);
};

const getExactYearFromDateClause = (clause: {
  op: 'gt' | 'lt' | 'range';
  minMs?: number;
  maxMs?: number;
  includeMin: boolean;
  includeMax: boolean;
}): number | null => {
  if (clause.op !== 'range') return null;
  if (!clause.includeMin || !clause.includeMax) return null;
  if (clause.minMs === undefined || clause.maxMs === undefined) return null;

  const minDate = new Date(clause.minMs);
  const maxDate = new Date(clause.maxMs);
  const minYear = getYearFromTimestamp(clause.minMs);
  const maxYear = getYearFromTimestamp(clause.maxMs);
  if (minYear === null || maxYear === null || minYear !== maxYear) return null;

  const isUtcYearStart =
    minDate.getUTCMonth() === 0 &&
    minDate.getUTCDate() === 1 &&
    minDate.getUTCHours() === 0 &&
    minDate.getUTCMinutes() === 0 &&
    minDate.getUTCSeconds() === 0 &&
    minDate.getUTCMilliseconds() === 0;

  const isUtcYearEnd =
    maxDate.getUTCMonth() === 11 &&
    maxDate.getUTCDate() === 31 &&
    maxDate.getUTCHours() === 23 &&
    maxDate.getUTCMinutes() === 59 &&
    maxDate.getUTCSeconds() === 59 &&
    maxDate.getUTCMilliseconds() === 999;

  return isUtcYearStart && isUtcYearEnd ? minYear : null;
};

const detectActiveFacets = (query: string): { types: Set<string>; authors: Set<string>; dateYears: Set<number> } => {
  const parsed = parseStructuredQuery(query);
  const types = new Set<string>();
  const authors = new Set<string>();
  const dateYears = new Set<number>();

  for (const clause of parsed.clauses) {
    if (clause.negated) continue;
    if (clause.kind === 'type') {
      types.add(clause.itemType);
      continue;
    }
    if (clause.kind === 'author') {
      authors.add(clause.valueNorm);
      continue;
    }
    if (clause.kind === 'date') {
      const year = getExactYearFromDateClause(clause);
      if (year !== null) {
        dateYears.add(year);
      }
    }
  }

  return { types, authors, dateYears };
};

export const createFacetAccumulator = (): FacetAccumulator => ({
  postCount: 0,
  commentCount: 0,
  authorCounts: new Map<string, { display: string; count: number }>(),
  yearCounts: new Map<number, number>()
});

const accumulateFacetItem = (accumulator: FacetAccumulator, item: ArchiveItem): void => {
  const isPost = 'title' in item;
  if (isPost) {
    accumulator.postCount += 1;
  } else {
    accumulator.commentCount += 1;
  }

  const displayName = item.user?.displayName || '';
  if (displayName) {
    const key = normalizeForSearch(displayName);
    const existing = accumulator.authorCounts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      accumulator.authorCounts.set(key, { display: displayName, count: 1 });
    }
  }

  const year = getYearFromPostedAt(item.postedAt);
  if (year !== null) {
    accumulator.yearCounts.set(year, (accumulator.yearCounts.get(year) || 0) + 1);
  }
};

const buildFacetGroups = (accumulator: FacetAccumulator, currentQuery: string): FacetGroup[] => {
  const groups: FacetGroup[] = [];
  const active = detectActiveFacets(currentQuery);

  groups.push({
    label: 'Type',
    items: [
      { value: 'Posts', queryFragment: 'type:post', count: accumulator.postCount, active: active.types.has('post') },
      { value: 'Comments', queryFragment: 'type:comment', count: accumulator.commentCount, active: active.types.has('comment') }
    ].filter(item => item.count > 0)
  });

  const topAuthors = Array.from(accumulator.authorCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  if (topAuthors.length > 0) {
    groups.push({
      label: 'Author',
      items: topAuthors.map(([normName, { display, count }]) => {
        const needsQuote = /[\s":]/u.test(display);
        return {
          value: display,
          queryFragment: needsQuote
            ? `author:"${escapeQueryQuotedValue(display)}"`
            : `author:${display}`,
          count,
          active: active.authors.has(normName)
        };
      })
    });
  }

  const sortedYears = Array.from(accumulator.yearCounts.entries()).sort((a, b) => b[0] - a[0]);
  if (sortedYears.length > 1) {
    groups.push({
      label: 'Year',
      items: sortedYears.map(([year, count]) => ({
        value: String(year),
        queryFragment: `date:${year}-01-01..${year}-12-31`,
        count,
        active: active.dateYears.has(year)
      }))
    });
  }

  return groups;
};

export const scanFacetChunk = (
  items: readonly ArchiveItem[],
  currentQuery: string,
  options: FacetChunkOptions = {}
): FacetChunkResult => {
  const startMs = Date.now();
  const accumulator = options.accumulator ?? createFacetAccumulator();
  const budgetMs = options.budgetMs ?? FACET_BUDGET_MS;
  const enforceBudget = Number.isFinite(budgetMs) && budgetMs >= 0;
  const startIndex = Math.max(0, options.startIndex ?? 0);
  let nextIndex = items.length;
  let done = true;

  for (let i = startIndex; i < items.length; i++) {
    const iterations = i - startIndex;
    if (enforceBudget && iterations > 0 && iterations % FACET_BUDGET_CHECK_INTERVAL === 0) {
      if (Date.now() - startMs > budgetMs) {
        nextIndex = i;
        done = false;
        break;
      }
    }

    accumulateFacetItem(accumulator, items[i]);
  }

  return {
    groups: buildFacetGroups(accumulator, currentQuery),
    delayed: !done,
    computeMs: Date.now() - startMs,
    nextIndex,
    done,
    accumulator
  };
};

export const computeFacets = (
  items: readonly ArchiveItem[],
  currentQuery: string,
  options: FacetComputeOptions = {}
): FacetResult => {
  const chunkResult = scanFacetChunk(items, currentQuery, { budgetMs: options.budgetMs });
  return {
    groups: chunkResult.groups,
    delayed: chunkResult.delayed,
    computeMs: chunkResult.computeMs
  };
};
