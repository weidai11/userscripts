import { ArchiveSearchRuntime } from './engine';
import type {
  SearchRunRequest,
  SearchRunResult,
  SearchWarning
} from './types';

export const FALLBACK_TOTAL_BUDGET_MS = 150;

const REGEX_LITERAL_GLOBAL = /-?\/(?:\\\/|[^/])+\/[a-z]*/gi;
const REGEX_META_GLOBAL = /[.*+?^${}()|[\]\\]/g;

const downgradeRegexTokenToLiteral = (token: string): string => {
  const negated = token.startsWith('-');
  const literal = negated ? token.slice(1) : token;
  const endSlash = literal.lastIndexOf('/');
  if (!literal.startsWith('/') || endSlash <= 0) return token;
  const pattern = literal.slice(1, endSlash);
  const flags = literal.slice(endSlash + 1).replace(/[gy]/g, '');
  try {
    // Only downgrade syntactically valid regex literals; invalid ones should remain
    // parser-visible so regular warning semantics are preserved.
    new RegExp(pattern, flags);
  } catch {
    return token;
  }
  const simplified = pattern.replace(REGEX_META_GLOBAL, ' ').replace(/\s+/g, ' ').trim();
  if (!simplified) return negated ? '-*' : '*';
  return negated ? `-${simplified}` : simplified;
};

const downgradeRegexInQuery = (query: string): { query: string; downgraded: boolean } => {
  let downgraded = false;
  const next = query.replace(REGEX_LITERAL_GLOBAL, token => {
    const replacement = downgradeRegexTokenToLiteral(token);
    if (replacement !== token) {
      downgraded = true;
    }
    return replacement;
  });
  return { query: next, downgraded };
};

const prependFallbackWarning = (result: SearchRunResult, warning: SearchWarning): SearchRunResult => ({
  ...result,
  diagnostics: {
    ...result.diagnostics,
    warnings: [warning, ...result.diagnostics.warnings],
    parseState: result.diagnostics.parseState === 'valid' ? 'warning' : result.diagnostics.parseState,
    degradedMode: true
  }
});

export const executeFallbackQuery = (
  runtime: ArchiveSearchRuntime,
  request: SearchRunRequest
): SearchRunResult => {
  const normalizedBudget = request.budgetMs ?? FALLBACK_TOTAL_BUDGET_MS;
  const downgraded = downgradeRegexInQuery(request.query);
  const result = runtime.runSearch({
    ...request,
    query: downgraded.query,
    budgetMs: normalizedBudget
  });

  if (!downgraded.downgraded) return result;
  return prependFallbackWarning(result, {
    type: 'regex-unsafe',
    token: request.query,
    message: 'Fallback mode downgraded regex literals to plain-text contains checks'
  });
};

export const executeFallbackQueryAsync = async (
  runtime: ArchiveSearchRuntime,
  request: SearchRunRequest
): Promise<SearchRunResult> => {
  // Yield first so repeated input can remain responsive under fallback execution.
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  return executeFallbackQuery(runtime, request);
};
