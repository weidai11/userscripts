import { isPositiveContentWithoutWildcard } from './ast';
import { normalizeForSearch } from './normalize';
import type {
  ArchiveSearchScope,
  SearchAst,
  SearchClause,
  SearchWarning
} from './types';

const MAX_REGEX_PATTERN_LENGTH = 512;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UTC_DAY_MS = 24 * 60 * 60 * 1000;

type RegexLiteral = {
  raw: string;
  pattern: string;
  flags: string;
};

const tokenizeQuery = (query: string): string[] => {
  const tokens: string[] = [];
  let i = 0;

  while (i < query.length) {
    while (i < query.length && /\s/.test(query[i])) i++;
    if (i >= query.length) break;

    const start = i;
    let cursor = i;
    let inQuote = false;

    const startsWithNegation = query[cursor] === '-';
    if (startsWithNegation) cursor++;

    const startsRegexLiteral = query[cursor] === '/';
    if (startsRegexLiteral) {
      cursor++;
      let escaped = false;
      while (cursor < query.length) {
        const ch = query[cursor];
        if (!escaped && ch === '/') {
          cursor++;
          while (cursor < query.length && /[a-z]/i.test(query[cursor])) {
            cursor++;
          }
          break;
        }
        if (!escaped && ch === '\\') {
          escaped = true;
        } else {
          escaped = false;
        }
        cursor++;
      }
      while (cursor < query.length && !/\s/.test(query[cursor])) {
        cursor++;
      }
      tokens.push(query.slice(start, cursor));
      i = cursor;
      continue;
    }

    let escaped = false;
    while (cursor < query.length) {
      const ch = query[cursor];
      if (!escaped && ch === '"') {
        inQuote = !inQuote;
        cursor++;
        continue;
      }
      if (!inQuote && /\s/.test(ch)) {
        break;
      }
      escaped = !escaped && ch === '\\';
      cursor++;
    }

    tokens.push(query.slice(start, cursor));
    i = cursor;
  }

  return tokens;
};

const parseRegexLiteral = (token: string): RegexLiteral | null => {
  if (!token.startsWith('/')) return null;

  let i = 1;
  let escaped = false;
  while (i < token.length) {
    const ch = token[i];
    if (!escaped && ch === '/') {
      const pattern = token.slice(1, i);
      const flags = token.slice(i + 1);
      if (!/^[a-z]*$/i.test(flags)) return null;
      return { raw: token, pattern, flags };
    }
    if (!escaped && ch === '\\') {
      escaped = true;
    } else {
      escaped = false;
    }
    i++;
  }

  return null;
};

const addWarning = (
  warnings: SearchWarning[],
  type: SearchWarning['type'],
  token: string,
  message: string
): void => {
  warnings.push({ type, token, message });
};

const removeOuterQuotes = (value: string): string => {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
};

const parseNumber = (value: string): number | null => {
  if (!/^-?\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const parseScoreClause = (value: string, negated: boolean): SearchClause | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('>')) {
    const n = parseNumber(trimmed.slice(1));
    if (n === null) return null;
    return { kind: 'score', negated, op: 'gt', min: n, includeMin: false, includeMax: true };
  }

  if (trimmed.startsWith('<')) {
    const n = parseNumber(trimmed.slice(1));
    if (n === null) return null;
    return { kind: 'score', negated, op: 'lt', max: n, includeMin: true, includeMax: false };
  }

  if (trimmed.includes('..')) {
    const [minRaw, maxRaw] = trimmed.split('..');
    const min = parseNumber(minRaw);
    const max = parseNumber(maxRaw);
    if (min === null || max === null) return null;
    return { kind: 'score', negated, op: 'range', min, max, includeMin: true, includeMax: true };
  }

  const exact = parseNumber(trimmed);
  if (exact === null) return null;
  return { kind: 'score', negated, op: 'range', min: exact, max: exact, includeMin: true, includeMax: true };
};

type UtcDayBounds = { startMs: number; endMs: number };

const parseUtcDayBounds = (value: string): UtcDayBounds | null => {
  if (!DATE_PATTERN.test(value)) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const startMs = Date.UTC(year, month - 1, day);
  const parsed = new Date(startMs);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    startMs,
    endMs: startMs + UTC_DAY_MS - 1
  };
};

const parseDateClause = (value: string, negated: boolean): SearchClause | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('>')) {
    const bounds = parseUtcDayBounds(trimmed.slice(1));
    if (!bounds) return null;
    return { kind: 'date', negated, op: 'gt', minMs: bounds.endMs, includeMin: false, includeMax: true };
  }

  if (trimmed.startsWith('<')) {
    const bounds = parseUtcDayBounds(trimmed.slice(1));
    if (!bounds) return null;
    return { kind: 'date', negated, op: 'lt', maxMs: bounds.startMs, includeMin: true, includeMax: false };
  }

  if (trimmed.includes('..')) {
    const [startRaw, endRaw] = trimmed.split('..');
    const hasStart = startRaw.trim().length > 0;
    const hasEnd = endRaw.trim().length > 0;

    if (!hasStart && !hasEnd) return null;

    const startBounds = hasStart ? parseUtcDayBounds(startRaw) : null;
    const endBounds = hasEnd ? parseUtcDayBounds(endRaw) : null;
    if ((hasStart && !startBounds) || (hasEnd && !endBounds)) return null;

    return {
      kind: 'date',
      negated,
      op: 'range',
      minMs: startBounds?.startMs,
      maxMs: endBounds?.endMs,
      includeMin: true,
      includeMax: true
    };
  }

  const day = parseUtcDayBounds(trimmed);
  if (!day) return null;

  return {
    kind: 'date',
    negated,
    op: 'range',
    minMs: day.startMs,
    maxMs: day.endMs,
    includeMin: true,
    includeMax: true
  };
};

type FieldParseResult = {
  handled: boolean;
  clause: SearchClause | null;
};

const maybeParseFieldClause = (
  token: string,
  negated: boolean,
  scopeDirectives: ArchiveSearchScope[],
  warnings: SearchWarning[],
  executableTokens: string[]
): FieldParseResult => {
  const colonIndex = token.indexOf(':');
  if (colonIndex <= 0) return { handled: false, clause: null };

  const operator = token.slice(0, colonIndex).toLowerCase();
  const valueRaw = token.slice(colonIndex + 1);
  const value = removeOuterQuotes(valueRaw);

  switch (operator) {
    case 'type': {
      const normalized = value.toLowerCase();
      if (normalized !== 'post' && normalized !== 'comment') {
        addWarning(warnings, 'invalid-type', token, `Unsupported type filter: ${value}`);
        return { handled: true, clause: null };
      }
      executableTokens.push(`${negated ? '-' : ''}type:${normalized}`);
      return { handled: true, clause: { kind: 'type', negated, itemType: normalized } };
    }
    case 'author': {
      const normalized = normalizeForSearch(value);
      if (!normalized) {
        addWarning(warnings, 'invalid-query', token, 'author filter requires a value');
        return { handled: true, clause: null };
      }
      executableTokens.push(`${negated ? '-' : ''}author:"${normalized}"`);
      return { handled: true, clause: { kind: 'author', negated, valueNorm: normalized } };
    }
    case 'replyto': {
      const normalized = normalizeForSearch(value);
      if (!normalized) {
        addWarning(warnings, 'invalid-query', token, 'replyto filter requires a value');
        return { handled: true, clause: null };
      }
      executableTokens.push(`${negated ? '-' : ''}replyto:"${normalized}"`);
      return { handled: true, clause: { kind: 'replyto', negated, valueNorm: normalized } };
    }
    case 'scope': {
      const normalized = value.toLowerCase();
      if (normalized === 'authored' || normalized === 'all') {
        scopeDirectives.push(normalized);
      } else {
        addWarning(warnings, 'invalid-scope', token, `Unsupported scope value: ${value}`);
      }
      return { handled: true, clause: null };
    }
    case 'score': {
      const parsed = parseScoreClause(valueRaw, negated);
      if (!parsed) {
        addWarning(warnings, 'malformed-score', token, `Malformed score filter: ${valueRaw}`);
        return { handled: true, clause: null };
      }
      executableTokens.push(`${negated ? '-' : ''}score:${valueRaw}`);
      return { handled: true, clause: parsed };
    }
    case 'date': {
      const parsed = parseDateClause(valueRaw, negated);
      if (!parsed) {
        addWarning(warnings, 'malformed-date', token, `Malformed date filter: ${valueRaw}`);
        return { handled: true, clause: null };
      }
      executableTokens.push(`${negated ? '-' : ''}date:${valueRaw}`);
      return { handled: true, clause: parsed };
    }
    case 'sort': {
      addWarning(warnings, 'reserved-operator', token, 'sort: is controlled by the sort dropdown');
      return { handled: true, clause: null };
    }
    default:
      return { handled: false, clause: null };
  }
};

const containsUnsafeRegexPattern = (pattern: string): boolean =>
  /(\([^)]*[+*][^)]*\)[+*])/.test(pattern) || /(\+|\*|\{[^}]+\})\s*(\+|\*|\{[^}]+\})/.test(pattern);

const serializeNormalizedTermToken = (termNorm: string): string =>
  termNorm.includes(' ') ? termNorm.replace(/\s+/g, '-') : termNorm;

export const parseStructuredQuery = (query: string): SearchAst => {
  const trimmed = query.trim();
  const warnings: SearchWarning[] = [];
  const scopeDirectives: ArchiveSearchScope[] = [];
  const clauses: SearchClause[] = [];
  const executableTokens: string[] = [];
  let wildcardSeen = false;

  if (!trimmed) {
    return {
      rawQuery: query,
      executableQuery: '',
      clauses,
      scopeDirectives,
      warnings
    };
  }

  const tokens = tokenizeQuery(trimmed);

  for (const rawToken of tokens) {
    if (!rawToken) continue;

    const negated = rawToken.startsWith('-');
    const token = negated ? rawToken.slice(1) : rawToken;
    if (!token) continue;

    const regexLiteral = parseRegexLiteral(token);
    if (regexLiteral) {
      if (regexLiteral.pattern.length > MAX_REGEX_PATTERN_LENGTH) {
        addWarning(warnings, 'regex-too-long', rawToken, 'Regex pattern exceeds the 512 character safety limit');
        continue;
      }
      if (containsUnsafeRegexPattern(regexLiteral.pattern)) {
        addWarning(warnings, 'regex-unsafe', rawToken, 'Regex pattern rejected by safety lint');
        continue;
      }

      try {
        const safeFlags = regexLiteral.flags.replace(/[gy]/g, '');
        const regex = new RegExp(regexLiteral.pattern, safeFlags);
        clauses.push({
          kind: 'regex',
          negated,
          raw: rawToken,
          pattern: regexLiteral.pattern,
          flags: safeFlags,
          regex
        });
        executableTokens.push(rawToken);
        continue;
      } catch {
        addWarning(warnings, 'invalid-regex', rawToken, 'Invalid regex literal');
        continue;
      }
    }

    if (token.startsWith('/')) {
      addWarning(warnings, 'invalid-regex', rawToken, 'Invalid regex literal');
      continue;
    }

    const fieldResult = maybeParseFieldClause(token, negated, scopeDirectives, warnings, executableTokens);
    if (fieldResult.handled) {
      if (fieldResult.clause) {
        clauses.push(fieldResult.clause);
      }
      continue;
    }

    if (token.includes(':') && /^[a-z][a-z0-9_]*:/i.test(token)) {
      addWarning(warnings, 'unknown-operator', rawToken, `Unsupported operator treated as plain term: ${token}`);
    }

    if (token === '*') {
      if (!wildcardSeen) {
        clauses.push({ kind: 'wildcard', negated });
        executableTokens.push(rawToken);
        wildcardSeen = true;
      }
      continue;
    }

    if (token.startsWith('"') && token.endsWith('"') && token.length >= 2) {
      const phraseNorm = normalizeForSearch(removeOuterQuotes(token));
      if (phraseNorm) {
        clauses.push({ kind: 'phrase', negated, valueNorm: phraseNorm });
        executableTokens.push(`${negated ? '-' : ''}"${phraseNorm}"`);
      }
      continue;
    }

    const termNorm = normalizeForSearch(token);
    if (termNorm) {
      clauses.push({ kind: 'term', negated, valueNorm: termNorm });
      executableTokens.push(`${negated ? '-' : ''}${serializeNormalizedTermToken(termNorm)}`);
    }
  }

  const hasPositiveContentClause = clauses.some(isPositiveContentWithoutWildcard);
  const filteredClauses = clauses.filter(clause => !(clause.kind === 'wildcard' && hasPositiveContentClause));
  const hasNegatedClause = filteredClauses.some(clause => clause.negated);
  const hasAnyPositiveClause = filteredClauses.some(clause => !clause.negated);

  if (hasNegatedClause && !hasAnyPositiveClause) {
    addWarning(warnings, 'negation-only', trimmed, 'Queries containing only negations are not allowed');
  }

  return {
    rawQuery: query,
    executableQuery: executableTokens.join(' ').trim(),
    clauses: filteredClauses,
    scopeDirectives,
    warnings
  };
};
