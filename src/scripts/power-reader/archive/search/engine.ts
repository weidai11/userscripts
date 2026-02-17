import { isPositiveContentClause } from './ast';
import { tokenizeForIndex } from './normalize';
import { parseStructuredQuery } from './parser';
import { buildExecutionPlan } from './planner';
import { sortSearchDocs, type RelevanceSignals } from './ranker';
import { buildCorpusIndex } from './searchIndex';
import type {
  ArchiveItem,
  ArchiveSearchDoc,
  ArchiveSearchScope,
  SearchClause,
  SearchCorpusIndex,
  SearchDiagnostics,
  SearchRunRequest,
  SearchRunResult
} from './types';

const DEFAULT_BUDGET_MS = 150;

const createEmptySignals = (): RelevanceSignals => ({
  tokenHits: 0,
  phraseHits: 0,
  authorHit: false,
  replyToHit: false
});

const upsertSignal = (
  signalMap: Map<number, RelevanceSignals>,
  ordinal: number
): RelevanceSignals => {
  const existing = signalMap.get(ordinal);
  if (existing) return existing;

  const created = createEmptySignals();
  signalMap.set(ordinal, created);
  return created;
};

const allOrdinalsSet = (docCount: number): Set<number> => {
  const output = new Set<number>();
  for (let i = 0; i < docCount; i++) output.add(i);
  return output;
};

const intersectSets = (a: Set<number>, b: Set<number>): Set<number> => {
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  const out = new Set<number>();
  small.forEach(value => {
    if (large.has(value)) out.add(value);
  });
  return out;
};

const postingsToSet = (postings: Uint32Array): Set<number> => {
  const out = new Set<number>();
  for (let i = 0; i < postings.length; i++) out.add(postings[i]);
  return out;
};

const maybeIntersectWithCandidate = (
  candidate: Set<number> | null,
  current: Set<number>
): Set<number> => {
  if (!candidate) return current;
  return intersectSets(candidate, current);
};

const getTokenPostingIntersection = (
  index: Map<string, Uint32Array>,
  tokens: string[],
  docCount: number
): Set<number> => {
  if (tokens.length === 0) return allOrdinalsSet(docCount);

  let result: Set<number> | null = null;
  for (const token of tokens) {
    const postings = index.get(token);
    if (!postings) return new Set<number>();
    const postingSet = postingsToSet(postings);
    result = result ? intersectSets(result, postingSet) : postingSet;
    if (result.size === 0) return result;
  }

  return result || new Set<number>();
};

const matchesScoreClause = (doc: ArchiveSearchDoc, clause: Extract<SearchClause, { kind: 'score' }>): boolean => {
  const value = doc.baseScore;

  if (clause.op === 'gt') {
    return clause.includeMin ? value >= (clause.min ?? Number.NEGATIVE_INFINITY) : value > (clause.min ?? Number.NEGATIVE_INFINITY);
  }
  if (clause.op === 'lt') {
    return clause.includeMax ? value <= (clause.max ?? Number.POSITIVE_INFINITY) : value < (clause.max ?? Number.POSITIVE_INFINITY);
  }

  const minOk = clause.min === undefined ? true : (clause.includeMin ? value >= clause.min : value > clause.min);
  const maxOk = clause.max === undefined ? true : (clause.includeMax ? value <= clause.max : value < clause.max);
  return minOk && maxOk;
};

const matchesDateClause = (doc: ArchiveSearchDoc, clause: Extract<SearchClause, { kind: 'date' }>): boolean => {
  const value = doc.postedAtMs;

  if (clause.op === 'gt') {
    return clause.includeMin ? value >= (clause.minMs ?? Number.NEGATIVE_INFINITY) : value > (clause.minMs ?? Number.NEGATIVE_INFINITY);
  }
  if (clause.op === 'lt') {
    return clause.includeMax ? value <= (clause.maxMs ?? Number.POSITIVE_INFINITY) : value < (clause.maxMs ?? Number.POSITIVE_INFINITY);
  }

  const minOk = clause.minMs === undefined ? true : (clause.includeMin ? value >= clause.minMs : value > clause.minMs);
  const maxOk = clause.maxMs === undefined ? true : (clause.includeMax ? value <= clause.maxMs : value < clause.maxMs);
  return minOk && maxOk;
};

const matchesClause = (doc: ArchiveSearchDoc, clause: SearchClause): boolean => {
  switch (clause.kind) {
    case 'term':
      return doc.combinedNorm.includes(clause.valueNorm);
    case 'phrase':
      return doc.titleNorm.includes(clause.valueNorm) || doc.bodyNorm.includes(clause.valueNorm);
    case 'regex':
      clause.regex.lastIndex = 0;
      if (clause.regex.test(doc.titleNorm)) return true;
      clause.regex.lastIndex = 0;
      return clause.regex.test(doc.bodyNorm);
    case 'wildcard':
      return true;
    case 'type':
      return doc.itemType === clause.itemType;
    case 'author':
      return doc.authorNameNorm.includes(clause.valueNorm);
    case 'replyto':
      return doc.replyToNorm.includes(clause.valueNorm);
    case 'score':
      return matchesScoreClause(doc, clause);
    case 'date':
      return matchesDateClause(doc, clause);
    default:
      return false;
  }
};

type CorpusExecutionResult = {
  docs: ArchiveSearchDoc[];
  relevanceSignalsById: Map<string, RelevanceSignals>;
  stageACandidateCount: number;
  stageBScanned: number;
  partialResults: boolean;
};

const executeAgainstCorpus = (
  corpus: SearchCorpusIndex,
  clauses: SearchClause[],
  startMs: number,
  budgetMs: number
): CorpusExecutionResult => {
  const plan = buildExecutionPlan(clauses);
  const docCount = corpus.docs.length;
  const relevanceSignalsByOrdinal = new Map<number, RelevanceSignals>();
  let partialResults = false;
  let stageBScanned = 0;
  const deferredStageAClauses: SearchClause[] = [];

  const budgetExceeded = (): boolean => budgetMs > 0 && (Date.now() - startMs) > budgetMs;

  let candidateOrdinals: Set<number> | null = null;

  for (const clause of plan.stageA) {
    if (budgetExceeded()) {
      partialResults = true;
      deferredStageAClauses.push(clause);
      continue;
    }

    let matched = new Set<number>();

    switch (clause.kind) {
      case 'term': {
        const termTokens = tokenizeForIndex(clause.valueNorm);
        if (termTokens.length === 0) {
          for (let ordinal = 0; ordinal < corpus.docs.length; ordinal++) {
            if (budgetExceeded()) {
              partialResults = true;
              break;
            }
            const doc = corpus.docs[ordinal];
            if (doc.combinedNorm.includes(clause.valueNorm)) {
              matched.add(ordinal);
            }
          }
        } else if (termTokens.length === 1 && termTokens[0] === clause.valueNorm) {
          const postings = corpus.tokenIndex.get(clause.valueNorm);
          matched = postings ? postingsToSet(postings) : new Set<number>();
        } else {
          const accelerated = getTokenPostingIntersection(corpus.tokenIndex, termTokens, docCount);
          accelerated.forEach(ordinal => {
            const doc = corpus.docs[ordinal];
            if (!doc.combinedNorm.includes(clause.valueNorm)) return;
            matched.add(ordinal);
          });
        }
        matched.forEach(ordinal => {
          const signal = upsertSignal(relevanceSignalsByOrdinal, ordinal);
          signal.tokenHits += 1;
        });
        break;
      }
      case 'author': {
        const nameTokens = tokenizeForIndex(clause.valueNorm);
        const accelerated = getTokenPostingIntersection(corpus.authorIndex, nameTokens, docCount);
        accelerated.forEach(ordinal => {
          const doc = corpus.docs[ordinal];
          if (!doc.authorNameNorm.includes(clause.valueNorm)) return;
          matched.add(ordinal);
          const signal = upsertSignal(relevanceSignalsByOrdinal, ordinal);
          signal.authorHit = true;
        });
        break;
      }
      case 'replyto': {
        const nameTokens = tokenizeForIndex(clause.valueNorm);
        const accelerated = getTokenPostingIntersection(corpus.replyToIndex, nameTokens, docCount);
        accelerated.forEach(ordinal => {
          const doc = corpus.docs[ordinal];
          if (!doc.replyToNorm.includes(clause.valueNorm)) return;
          matched.add(ordinal);
          const signal = upsertSignal(relevanceSignalsByOrdinal, ordinal);
          signal.replyToHit = true;
        });
        break;
      }
      case 'type':
      case 'score':
      case 'date': {
        for (let ordinal = 0; ordinal < corpus.docs.length; ordinal++) {
          if (budgetExceeded()) {
            partialResults = true;
            break;
          }
          const doc = corpus.docs[ordinal];
          if (matchesClause(doc, clause)) {
            matched.add(ordinal);
          }
        }
        break;
      }
      default:
        break;
    }

    candidateOrdinals = maybeIntersectWithCandidate(candidateOrdinals, matched);
    if (candidateOrdinals.size === 0) {
      break;
    }
  }

  const hasPositiveContent = clauses.some(isPositiveContentClause);
  const stageASeeded = candidateOrdinals !== null;

  if (!candidateOrdinals) {
    candidateOrdinals = allOrdinalsSet(docCount);
  }

  // Apply deferred Stage A clauses as post-filters on the candidate set
  // to guarantee filter correctness even when the budget is exceeded.
  for (const clause of deferredStageAClauses) {
    const filtered = new Set<number>();
    candidateOrdinals.forEach(ordinal => {
      const doc = corpus.docs[ordinal];
      if (matchesClause(doc, clause)) {
        filtered.add(ordinal);
      }
    });
    candidateOrdinals = filtered;
    if (candidateOrdinals.size === 0) break;
  }

  if (hasPositiveContent) {
    const filtered = new Set<number>();
    candidateOrdinals.forEach(ordinal => {
      if (budgetExceeded()) {
        partialResults = true;
        return;
      }
      const doc = corpus.docs[ordinal];
      stageBScanned++;

      let matched = true;
      for (const clause of plan.stageB) {
        if (!matchesClause(doc, clause)) {
          matched = false;
          break;
        }

        if (clause.kind === 'phrase') {
          const signal = upsertSignal(relevanceSignalsByOrdinal, ordinal);
          signal.phraseHits += 1;
        }
        if (clause.kind === 'term') {
          const signal = upsertSignal(relevanceSignalsByOrdinal, ordinal);
          signal.tokenHits += 1;
        }
      }

      if (matched) {
        filtered.add(ordinal);
      }
    });
    candidateOrdinals = filtered;
  } else if (!stageASeeded && plan.stageB.length > 0) {
    // Phrase-only/regex-only paths still need stage-B matching against full corpus.
    const filtered = new Set<number>();
    for (let ordinal = 0; ordinal < corpus.docs.length; ordinal++) {
      if (budgetExceeded()) {
        partialResults = true;
        break;
      }
      const doc = corpus.docs[ordinal];
      stageBScanned++;

      let matched = true;
      for (const clause of plan.stageB) {
        if (!matchesClause(doc, clause)) {
          matched = false;
          break;
        }
      }
      if (matched) filtered.add(ordinal);
    }
    candidateOrdinals = filtered;
  }

  if (plan.negations.length > 0) {
    const filtered = new Set<number>();
    candidateOrdinals.forEach(ordinal => {
      if (budgetExceeded()) {
        partialResults = true;
        return;
      }
      const doc = corpus.docs[ordinal];
      const excluded = plan.negations.some(clause => matchesClause(doc, clause));
      if (!excluded) filtered.add(ordinal);
    });
    candidateOrdinals = filtered;
  }

  const docs = Array.from(candidateOrdinals.values()).map(ordinal => corpus.docs[ordinal]);
  const relevanceSignalsById = new Map<string, RelevanceSignals>();
  relevanceSignalsByOrdinal.forEach((signals, ordinal) => {
    const doc = corpus.docs[ordinal];
    relevanceSignalsById.set(doc.id, signals);
  });

  return {
    docs,
    relevanceSignalsById,
    stageACandidateCount: candidateOrdinals.size,
    stageBScanned,
    partialResults
  };
};

export class ArchiveSearchRuntime {
  private authoredIndex: SearchCorpusIndex = buildCorpusIndex('authored', []);
  private contextIndex: SearchCorpusIndex = buildCorpusIndex('context', []);
  private authoredItemsRef: readonly ArchiveItem[] | null = null;
  private authoredRevisionToken = 0;
  private contextItemsRef: readonly ArchiveItem[] | null = null;

  setAuthoredItems(items: readonly ArchiveItem[], revisionToken = 0): void {
    if (this.authoredItemsRef === items && this.authoredRevisionToken === revisionToken) return;
    this.authoredItemsRef = items;
    this.authoredRevisionToken = revisionToken;
    this.authoredIndex = buildCorpusIndex('authored', items);
  }

  setContextItems(items: readonly ArchiveItem[]): void {
    if (this.contextItemsRef === items) return;
    this.contextItemsRef = items;
    this.contextIndex = buildCorpusIndex('context', items);
  }

  runSearch(request: SearchRunRequest): SearchRunResult {
    const startMs = Date.now();
    const budgetMs = request.budgetMs ?? DEFAULT_BUDGET_MS;
    const parsed = parseStructuredQuery(request.query);
    const warnings = [...parsed.warnings];

    let resolvedScope: ArchiveSearchScope = request.scopeParam || 'authored';
    if (!request.scopeParam && parsed.scopeDirectives.length > 0) {
      resolvedScope = parsed.scopeDirectives[parsed.scopeDirectives.length - 1];
    } else if (request.scopeParam && parsed.scopeDirectives.length > 0) {
      const parsedScope = parsed.scopeDirectives[parsed.scopeDirectives.length - 1];
      if (parsedScope !== request.scopeParam) {
        warnings.push({
          type: 'invalid-scope',
          token: `scope:${parsedScope}`,
          message: 'URL scope parameter takes precedence over in-query scope'
        });
      }
    }

    const hasNegation = parsed.clauses.some(clause => clause.negated);
    const hasPositiveClause = parsed.clauses.some(clause => !clause.negated);
    if (hasNegation && !hasPositiveClause) {
      warnings.push({
        type: 'negation-only',
        token: parsed.rawQuery,
        message: 'Add a positive clause or use "*" before negations'
      });
      const diagnostics: SearchDiagnostics = {
        warnings,
        parseState: 'invalid',
        degradedMode: false,
        partialResults: false,
        tookMs: Date.now() - startMs,
        stageACandidateCount: 0,
        stageBScanned: 0,
        totalCandidatesBeforeLimit: 0,
        explain: ['Query rejected: negations require at least one positive clause']
      };
      return {
        ids: [],
        total: 0,
        items: [],
        canonicalQuery: parsed.executableQuery,
        resolvedScope,
        diagnostics
      };
    }

    const corpora = resolvedScope === 'all'
      ? [this.authoredIndex, this.contextIndex]
      : [this.authoredIndex];

    let stageACandidateCount = 0;
    let stageBScanned = 0;
    let partialResults = false;
    const mergedWarnings = [...warnings];
    const mergedDocs = new Map<string, ArchiveSearchDoc>();
    const mergedSignals = new Map<string, RelevanceSignals>();

    for (const corpus of corpora) {
      const result = executeAgainstCorpus(corpus, parsed.clauses, startMs, budgetMs);
      stageACandidateCount += result.stageACandidateCount;
      stageBScanned += result.stageBScanned;
      partialResults = partialResults || result.partialResults;

      result.docs.forEach(doc => {
        const existing = mergedDocs.get(doc.id);
        if (!existing) {
          mergedDocs.set(doc.id, doc);
          const signal = result.relevanceSignalsById.get(doc.id);
          if (signal) mergedSignals.set(doc.id, signal);
          return;
        }

        // scope:all dedupe policy: authored payload wins
        if (existing.source === 'authored') return;
        if (doc.source === 'authored') {
          mergedDocs.set(doc.id, doc);
          const signal = result.relevanceSignalsById.get(doc.id);
          if (signal) mergedSignals.set(doc.id, signal);
        }
      });
    }

    const sortedDocs = sortSearchDocs(Array.from(mergedDocs.values()), request.sortMode, mergedSignals);
    const total = sortedDocs.length;
    const limitedDocs = sortedDocs.slice(0, request.limit);
    const ids = limitedDocs.map(doc => doc.id);
    const items = limitedDocs.map(doc => doc.item);

    const parseState = mergedWarnings.some(w => w.type === 'negation-only' || w.type === 'invalid-query')
      ? 'invalid'
      : mergedWarnings.length > 0
        ? 'warning'
        : 'valid';

    const diagnostics: SearchDiagnostics = {
      warnings: mergedWarnings,
      parseState,
      degradedMode: partialResults || mergedWarnings.some(w => w.type === 'regex-unsafe' || w.type === 'regex-too-long'),
      partialResults,
      tookMs: Date.now() - startMs,
      stageACandidateCount,
      stageBScanned,
      totalCandidatesBeforeLimit: total,
      explain: [
        `scope=${resolvedScope}`,
        `stageA_candidates=${stageACandidateCount}`,
        `stageB_scanned=${stageBScanned}`,
        `total=${total}`
      ]
    };

    return {
      ids,
      total,
      items,
      canonicalQuery: parsed.executableQuery,
      resolvedScope,
      diagnostics
    };
  }
}
