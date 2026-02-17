import { buildArchiveSearchDoc, tokenizeForIndex } from './normalize';
import type { ArchiveCorpusName, ArchiveItem, ArchiveSearchDoc, SearchCorpusIndex } from './types';

const addPosting = (index: Map<string, number[]>, token: string, ordinal: number): void => {
  const postings = index.get(token);
  if (postings) {
    postings.push(ordinal);
    return;
  }
  index.set(token, [ordinal]);
};

const compactPostings = (mutable: Map<string, number[]>): Map<string, Uint32Array> => {
  const compact = new Map<string, Uint32Array>();
  mutable.forEach((postings, token) => {
    postings.sort((a, b) => a - b);
    compact.set(token, Uint32Array.from(postings));
  });
  return compact;
};

const buildIndexes = (docs: ArchiveSearchDoc[]): Pick<SearchCorpusIndex, 'tokenIndex' | 'authorIndex' | 'replyToIndex'> => {
  const tokenMutable = new Map<string, number[]>();
  const authorMutable = new Map<string, number[]>();
  const replyToMutable = new Map<string, number[]>();

  for (let ordinal = 0; ordinal < docs.length; ordinal++) {
    const doc = docs[ordinal];

    for (const token of tokenizeForIndex(doc.combinedNorm)) {
      addPosting(tokenMutable, token, ordinal);
    }
    for (const token of tokenizeForIndex(doc.authorNameNorm)) {
      addPosting(authorMutable, token, ordinal);
    }
    for (const token of tokenizeForIndex(doc.replyToNorm)) {
      addPosting(replyToMutable, token, ordinal);
    }
  }

  return {
    tokenIndex: compactPostings(tokenMutable),
    authorIndex: compactPostings(authorMutable),
    replyToIndex: compactPostings(replyToMutable)
  };
};

export const buildCorpusIndex = (source: ArchiveCorpusName, items: readonly ArchiveItem[]): SearchCorpusIndex => {
  const docs = items.map(item => buildArchiveSearchDoc(item, source));
  const docOrdinalsById = new Map<string, number>();
  docs.forEach((doc, ordinal) => docOrdinalsById.set(doc.id, ordinal));

  const indexes = buildIndexes(docs);

  return {
    source,
    docs,
    docOrdinalsById,
    ...indexes
  };
};
