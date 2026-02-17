import type { SearchClause } from './types';

export type SearchExecutionPlan = {
  stageA: SearchClause[];
  stageB: SearchClause[];
  negations: SearchClause[];
};

export const buildExecutionPlan = (clauses: SearchClause[]): SearchExecutionPlan => {
  const stageA: SearchClause[] = [];
  const stageB: SearchClause[] = [];
  const negations: SearchClause[] = [];

  for (const clause of clauses) {
    if (clause.negated) {
      negations.push(clause);
      continue;
    }

    switch (clause.kind) {
      case 'type':
      case 'author':
      case 'replyto':
      case 'score':
      case 'date':
        stageA.push(clause);
        break;
      case 'term':
        if (clause.valueNorm.length >= 2) {
          stageA.push(clause);
        } else {
          stageB.push(clause);
        }
        break;
      case 'phrase':
      case 'regex':
      case 'wildcard':
        stageB.push(clause);
        break;
      default:
        stageB.push(clause);
        break;
    }
  }

  return { stageA, stageB, negations };
};
