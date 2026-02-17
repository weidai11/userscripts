import type { SearchClause } from './types';

export const isContentClause = (clause: SearchClause): boolean =>
  clause.kind === 'term' ||
  clause.kind === 'phrase' ||
  clause.kind === 'regex' ||
  clause.kind === 'wildcard';

export const isPositiveContentClause = (clause: SearchClause): boolean =>
  isContentClause(clause) && !clause.negated;

export const isPositiveContentWithoutWildcard = (clause: SearchClause): boolean =>
  isPositiveContentClause(clause) && clause.kind !== 'wildcard';

export const isFieldClause = (clause: SearchClause): boolean =>
  clause.kind === 'type' ||
  clause.kind === 'author' ||
  clause.kind === 'replyto' ||
  clause.kind === 'score' ||
  clause.kind === 'date';
