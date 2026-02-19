import type { Comment, Post } from '../../../../shared/graphql/queries';
import type { ArchiveSortBy } from '../state';

export type ArchiveItem = Post | Comment;
export type ArchiveItemType = 'post' | 'comment';
export type ArchiveCorpusName = 'authored' | 'context';
export type ArchiveSearchScope = 'authored' | 'all';
export type ArchiveSearchSortMode = ArchiveSortBy;

export type ArchiveSearchDoc = {
  id: string;
  itemType: ArchiveItemType;
  source: ArchiveCorpusName;
  postedAtMs: number;
  baseScore: number;
  authorNameNorm: string;
  replyToNorm: string;
  titleNorm: string;
  bodyNorm: string;
};

export type SearchWarningType =
  | 'invalid-regex'
  | 'regex-too-long'
  | 'regex-unsafe'
  | 'malformed-date'
  | 'malformed-score'
  | 'unknown-operator'
  | 'reserved-operator'
  | 'invalid-type'
  | 'invalid-scope'
  | 'negation-only'
  | 'invalid-query';

export type SearchWarning = {
  type: SearchWarningType;
  token: string;
  message: string;
};

export type SearchClause =
  | { kind: 'term'; negated: boolean; valueNorm: string }
  | { kind: 'phrase'; negated: boolean; valueNorm: string }
  | { kind: 'regex'; negated: boolean; raw: string; pattern: string; flags: string; regex: RegExp }
  | { kind: 'wildcard'; negated: boolean }
  | { kind: 'type'; negated: boolean; itemType: ArchiveItemType }
  | { kind: 'author'; negated: boolean; valueNorm: string }
  | { kind: 'replyto'; negated: boolean; valueNorm: string }
  | {
    kind: 'score';
    negated: boolean;
    op: 'gt' | 'lt' | 'range';
    min?: number;
    max?: number;
    includeMin: boolean;
    includeMax: boolean;
  }
  | {
    kind: 'date';
    negated: boolean;
    op: 'gt' | 'lt' | 'range';
    minMs?: number;
    maxMs?: number;
    includeMin: boolean;
    includeMax: boolean;
  };

export type SearchAst = {
  rawQuery: string;
  executableQuery: string;
  clauses: SearchClause[];
  scopeDirectives: ArchiveSearchScope[];
  warnings: SearchWarning[];
};

export type SearchCorpusIndex = {
  source: ArchiveCorpusName;
  docs: ArchiveSearchDoc[];
  itemsById: Map<string, ArchiveItem>;
  docOrdinalsById: Map<string, number>;
  tokenIndex: Map<string, Uint32Array>;
  authorIndex: Map<string, Uint32Array>;
  replyToIndex: Map<string, Uint32Array>;
};

export type SearchDiagnostics = {
  warnings: SearchWarning[];
  parseState: 'valid' | 'warning' | 'invalid';
  degradedMode: boolean;
  partialResults: boolean;
  tookMs: number;
  stageACandidateCount: number;
  stageBScanned: number;
  totalCandidatesBeforeLimit: number;
  explain: string[];
};

export type RelevanceSignals = {
  tokenHits: number;
  phraseHits: number;
  authorHit: boolean;
  replyToHit: boolean;
};

export type SearchDebugExplainPayload = {
  relevanceSignalsById: Record<string, RelevanceSignals>;
};

export type SearchRunRequest = {
  query: string;
  scopeParam?: ArchiveSearchScope;
  sortMode: ArchiveSearchSortMode;
  limit: number;
  budgetMs?: number;
  debugExplain?: boolean;
};

export type SearchRunResult = {
  ids: string[];
  total: number;
  items: ArchiveItem[];
  canonicalQuery: string;
  resolvedScope: ArchiveSearchScope;
  diagnostics: SearchDiagnostics;
  debugExplain?: SearchDebugExplainPayload;
};
