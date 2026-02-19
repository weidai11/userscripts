import type { ArchiveSearchDoc, ArchiveSearchSortMode } from './types';

export type RelevanceSignals = {
  tokenHits: number;
  phraseHits: number;
  authorHit: boolean;
  replyToHit: boolean;
};

const compareSourcePriority = (a: ArchiveSearchDoc, b: ArchiveSearchDoc): number => {
  if (a.source === b.source) return 0;
  return a.source === 'authored' ? -1 : 1;
};

const compareStableTail = (a: ArchiveSearchDoc, b: ArchiveSearchDoc): number => {
  const sourceCmp = compareSourcePriority(a, b);
  if (sourceCmp !== 0) return sourceCmp;

  const dateCmp = b.postedAtMs - a.postedAtMs;
  if (dateCmp !== 0) return dateCmp;

  return a.id.localeCompare(b.id);
};

const compareReplyTo = (a: ArchiveSearchDoc, b: ArchiveSearchDoc): number => {
  const aEmpty = a.replyToNorm.length === 0;
  const bEmpty = b.replyToNorm.length === 0;
  if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;

  const nameCmp = a.replyToNorm.localeCompare(b.replyToNorm);
  if (nameCmp !== 0) return nameCmp;

  return compareStableTail(a, b);
};

const computeRelevanceScore = (signals: RelevanceSignals): number => {
  let score = 0;
  score += signals.tokenHits * 10;
  score += signals.phraseHits * 15;
  if (signals.authorHit) score += 8;
  if (signals.replyToHit) score += 6;
  return score;
};

const EMPTY_SIGNALS: RelevanceSignals = {
  tokenHits: 0,
  phraseHits: 0,
  authorHit: false,
  replyToHit: false
};

export const sortSearchDocs = (
  docs: ArchiveSearchDoc[],
  sortMode: ArchiveSearchSortMode,
  relevanceSignalsById: Map<string, RelevanceSignals>
): ArchiveSearchDoc[] => {
  const sorted = [...docs];

  switch (sortMode) {
    case 'date-asc':
      sorted.sort((a, b) => {
        const cmp = a.postedAtMs - b.postedAtMs;
        if (cmp !== 0) return cmp;
        return compareStableTail(a, b);
      });
      return sorted;
    case 'score':
      sorted.sort((a, b) => {
        const cmp = b.baseScore - a.baseScore;
        if (cmp !== 0) return cmp;
        return compareStableTail(a, b);
      });
      return sorted;
    case 'score-asc':
      sorted.sort((a, b) => {
        const cmp = a.baseScore - b.baseScore;
        if (cmp !== 0) return cmp;
        return compareStableTail(a, b);
      });
      return sorted;
    case 'replyTo':
      sorted.sort(compareReplyTo);
      return sorted;
    case 'relevance':
      sorted.sort((a, b) => {
        const aSignals = relevanceSignalsById.get(a.id) || EMPTY_SIGNALS;
        const bSignals = relevanceSignalsById.get(b.id) || EMPTY_SIGNALS;
        const scoreCmp = computeRelevanceScore(bSignals) - computeRelevanceScore(aSignals);
        if (scoreCmp !== 0) return scoreCmp;

        const dateCmp = b.postedAtMs - a.postedAtMs;
        if (dateCmp !== 0) return dateCmp;

        return a.id.localeCompare(b.id);
      });
      return sorted;
    case 'date':
    default:
      sorted.sort((a, b) => {
        const cmp = b.postedAtMs - a.postedAtMs;
        if (cmp !== 0) return cmp;
        return compareStableTail(a, b);
      });
      return sorted;
  }
};
