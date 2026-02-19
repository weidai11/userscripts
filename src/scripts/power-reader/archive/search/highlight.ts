import { parseStructuredQuery } from './parser';

const MAX_HIGHLIGHT_TERMS = 20;
const MIN_HIGHLIGHT_TERM_LEN = 3;
const TOKEN_SEPARATOR_UNICODE_PATTERN = '[^\\p{L}\\p{N}]+';
const TOKEN_SEPARATOR_ASCII_PATTERN = '[^A-Za-z0-9]+';
const APOSTROPHE_FLEX_PATTERN = "['’]*";

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const termToPatternSource = (term: string, separatorPattern: string): string | null => {
  const tokens = term.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const tokenPatterns = tokens.map((token) =>
    Array.from(token).map((char) => escapeRegex(char)).join(APOSTROPHE_FLEX_PATTERN)
  );

  return tokenPatterns.join(separatorPattern);
};

const buildCombinedPatternSource = (terms: readonly string[], separatorPattern: string): string | null => {
  const sources = terms
    .map((term) => termToPatternSource(term, separatorPattern))
    .filter((source): source is string => Boolean(source))
    .sort((a, b) => b.length - a.length);

  if (sources.length === 0) return null;
  return `(${sources.join('|')})`;
};

export const buildHighlightRegex = (terms: readonly string[]): RegExp | null => {
  const unicodePattern = buildCombinedPatternSource(terms, TOKEN_SEPARATOR_UNICODE_PATTERN);
  if (unicodePattern) {
    try {
      return new RegExp(unicodePattern, 'giu');
    } catch {
      // Fallback for environments that may not support unicode property escapes.
    }
  }

  const asciiPattern = buildCombinedPatternSource(terms, TOKEN_SEPARATOR_ASCII_PATTERN);
  if (!asciiPattern) return null;
  return new RegExp(asciiPattern, 'gi');
};

export const extractHighlightTerms = (query: string): string[] => {
  const parsed = parseStructuredQuery(query);
  const terms: string[] = [];

  for (const clause of parsed.clauses) {
    if (clause.negated) continue;
    if (clause.kind === 'term' || clause.kind === 'phrase') {
      terms.push(clause.valueNorm);
    }
  }

  return Array.from(new Set(terms))
    .filter(term => term.length >= MIN_HIGHLIGHT_TERM_LEN)
    .slice(0, MAX_HIGHLIGHT_TERMS);
};

export const highlightTermsInContainer = (
  container: HTMLElement,
  terms: readonly string[]
): void => {
  const stableTerms = Array.from(new Set(terms)).sort((a, b) => a.localeCompare(b));
  const signature = stableTerms.join('\u001F');
  const previousSignature = container.getAttribute('data-pr-highlighted-terms');

  if (previousSignature === signature) return;

  if (previousSignature !== null) {
    container.querySelectorAll('mark.pr-search-highlight').forEach((mark) => {
      mark.replaceWith(document.createTextNode(mark.textContent || ''));
    });
    container.normalize();
  }

  if (stableTerms.length === 0) {
    container.setAttribute('data-pr-highlighted-terms', signature);
    return;
  }

  const pattern = buildHighlightRegex(stableTerms);
  if (!pattern) {
    container.setAttribute('data-pr-highlighted-terms', signature);
    return;
  }

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  for (const textNode of textNodes) {
    const parent = textNode.parentElement;
    if (!parent) continue;
    if (parent.closest('mark, code, pre, script, style, a')) continue;

    const text = textNode.textContent || '';
    const parts = text.split(pattern);
    if (parts.length <= 1) continue;

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      if (i % 2 === 1) {
        const mark = document.createElement('mark');
        mark.className = 'pr-search-highlight';
        mark.textContent = part;
        fragment.appendChild(mark);
      } else {
        fragment.appendChild(document.createTextNode(part));
      }
    }

    parent.replaceChild(fragment, textNode);
  }

  container.setAttribute('data-pr-highlighted-terms', signature);
};
