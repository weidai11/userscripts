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

const appendPostingBatch = (index: Map<string, Uint32Array>, token: string, ordinals: readonly number[]): void => {
  if (ordinals.length === 0) return;
  const postings = index.get(token);
  if (!postings) {
    index.set(token, Uint32Array.from(ordinals));
    return;
  }

  const next = new Uint32Array(postings.length + ordinals.length);
  next.set(postings);
  next.set(ordinals, postings.length);
  index.set(token, next);
};

const buildIndexes = (docs: ArchiveSearchDoc[]): Pick<SearchCorpusIndex, 'tokenIndex' | 'authorIndex' | 'replyToIndex'> => {
  const tokenMutable = new Map<string, number[]>();
  const authorMutable = new Map<string, number[]>();
  const replyToMutable = new Map<string, number[]>();

  for (let ordinal = 0; ordinal < docs.length; ordinal++) {
    const doc = docs[ordinal];
    const seenContentTokens = new Set<string>();

    for (const token of tokenizeForIndex(doc.titleNorm)) {
      if (seenContentTokens.has(token)) continue;
      seenContentTokens.add(token);
      addPosting(tokenMutable, token, ordinal);
    }
    for (const token of tokenizeForIndex(doc.bodyNorm)) {
      if (seenContentTokens.has(token)) continue;
      seenContentTokens.add(token);
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
  const itemsById = new Map<string, ArchiveItem>();
  docs.forEach((doc, ordinal) => {
    docOrdinalsById.set(doc.id, ordinal);
    itemsById.set(doc.id, items[ordinal]);
  });

  const indexes = buildIndexes(docs);

  return {
    source,
    docs,
    itemsById,
    docOrdinalsById,
    ...indexes
  };
};

export const appendItemsToCorpusIndex = (
  index: SearchCorpusIndex,
  source: ArchiveCorpusName,
  upserts: readonly ArchiveItem[]
): void => {
  if (upserts.length === 0) return;

  const tokenBatch = new Map<string, number[]>();
  const authorBatch = new Map<string, number[]>();
  const replyToBatch = new Map<string, number[]>();

  for (const item of upserts) {
    if (index.docOrdinalsById.has(item._id)) continue;

    const doc = buildArchiveSearchDoc(item, source);
    const ordinal = index.docs.length;
    index.docs.push(doc);
    index.docOrdinalsById.set(doc.id, ordinal);
    index.itemsById.set(doc.id, item);

    const seenContentTokens = new Set<string>();
    for (const token of tokenizeForIndex(doc.titleNorm)) {
      if (seenContentTokens.has(token)) continue;
      seenContentTokens.add(token);
      addPosting(tokenBatch, token, ordinal);
    }
    for (const token of tokenizeForIndex(doc.bodyNorm)) {
      if (seenContentTokens.has(token)) continue;
      seenContentTokens.add(token);
      addPosting(tokenBatch, token, ordinal);
    }
    for (const token of tokenizeForIndex(doc.authorNameNorm)) {
      addPosting(authorBatch, token, ordinal);
    }
    for (const token of tokenizeForIndex(doc.replyToNorm)) {
      addPosting(replyToBatch, token, ordinal);
    }
  }

  tokenBatch.forEach((ordinals, token) => appendPostingBatch(index.tokenIndex, token, ordinals));
  authorBatch.forEach((ordinals, token) => appendPostingBatch(index.authorIndex, token, ordinals));
  replyToBatch.forEach((ordinals, token) => appendPostingBatch(index.replyToIndex, token, ordinals));
};
