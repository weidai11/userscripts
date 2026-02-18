import { ArchiveSearchRuntime } from './engine';
import { SEARCH_SCHEMA_VERSION } from './protocol';
import type {
  SearchWorkerRequest,
  SearchWorkerResponse
} from './protocol';
import type {
  ArchiveCorpusName,
  ArchiveItem
} from './types';

type FullBatchState = {
  batchId: string;
  source: ArchiveCorpusName;
  totalChunks: number;
  nextChunkIndex: number;
  items: ArchiveItem[];
  startedAtMs: number;
};

type QueryRequest = Extract<SearchWorkerRequest, { kind: 'query.run' }>;

const runtime = new ArchiveSearchRuntime();
let indexVersion = 0;
const cancelledRequests = new Map<string, number>();
const CANCEL_MAX = 2000;
const CANCEL_TTL_MS = 10_000;

const noteCancel = (id: string): void => {
  const now = Date.now();
  cancelledRequests.set(id, now);
  if (cancelledRequests.size > CANCEL_MAX) {
    for (const [key, ts] of cancelledRequests) {
      if (now - ts > CANCEL_TTL_MS) cancelledRequests.delete(key);
    }
    if (cancelledRequests.size > CANCEL_MAX) cancelledRequests.clear();
  }
};

const consumeCancel = (id: string): boolean => {
  if (!cancelledRequests.has(id)) return false;
  cancelledRequests.delete(id);
  return true;
};
let fullBatch: FullBatchState | null = null;

let authoredItems: ArchiveItem[] = [];
let contextItems: ArchiveItem[] = [];

const post = (message: SearchWorkerResponse): void => {
  self.postMessage(message);
};

const emitSchemaError = (message: SearchWorkerRequest, scope: { batchId?: string; patchId?: string } = {}): void => {
  if ('kind' in message && message.kind === 'query.run') {
    post({ kind: 'error', requestId: message.requestId, message: `Schema mismatch: expected ${SEARCH_SCHEMA_VERSION}` });
    return;
  }
  post({
    kind: 'error',
    ...scope,
    message: `Schema mismatch: expected ${SEARCH_SCHEMA_VERSION}`
  });
};

const setCorpusItems = (source: ArchiveCorpusName, items: ArchiveItem[]): void => {
  if (source === 'authored') {
    authoredItems = items;
    runtime.setAuthoredItems(authoredItems, indexVersion);
    return;
  }
  contextItems = items;
  runtime.setContextItems(contextItems);
};

const applyPatch = (source: ArchiveCorpusName, upserts: ArchiveItem[], deletes: string[]): void => {
  const base = source === 'authored' ? authoredItems : contextItems;
  const byId = new Map<string, ArchiveItem>();
  for (const item of base) byId.set(item._id, item);
  for (const id of deletes) byId.delete(id);
  for (const item of upserts) byId.set(item._id, item);
  setCorpusItems(source, Array.from(byId.values()));
};

const handleFullStart = (message: Extract<SearchWorkerRequest, { kind: 'index.full.start' }>): void => {
  if (message.schemaVersion !== SEARCH_SCHEMA_VERSION) {
    emitSchemaError(message, { batchId: message.batchId });
    return;
  }
  fullBatch = {
    batchId: message.batchId,
    source: message.source,
    totalChunks: 0,
    nextChunkIndex: 0,
    items: [],
    startedAtMs: Date.now()
  };
};

const handleFullChunk = (message: Extract<SearchWorkerRequest, { kind: 'index.full.chunk' }>): void => {
  if (!fullBatch || fullBatch.batchId !== message.batchId || fullBatch.source !== message.source) {
    post({ kind: 'error', batchId: message.batchId, message: 'Unknown or inactive full index batch' });
    return;
  }
  if (fullBatch.totalChunks === 0) {
    fullBatch.totalChunks = message.totalChunks;
  } else if (fullBatch.totalChunks !== message.totalChunks) {
    post({ kind: 'error', batchId: message.batchId, message: 'Mismatched totalChunks for batch' });
    return;
  }
  if (message.chunkIndex !== fullBatch.nextChunkIndex) {
    post({ kind: 'error', batchId: message.batchId, message: 'Out-of-order chunk index for batch' });
    return;
  }

  fullBatch.items.push(...message.items);
  fullBatch.nextChunkIndex += 1;
};

const handleFullCommit = (message: Extract<SearchWorkerRequest, { kind: 'index.full.commit' }>): void => {
  if (!fullBatch || fullBatch.batchId !== message.batchId || fullBatch.source !== message.source) {
    post({ kind: 'error', batchId: message.batchId, message: 'Unknown or inactive full index batch commit' });
    return;
  }
  if (fullBatch.totalChunks > 0 && fullBatch.nextChunkIndex !== fullBatch.totalChunks) {
    post({ kind: 'error', batchId: message.batchId, message: 'Full index commit called before all chunks arrived' });
    return;
  }

  setCorpusItems(fullBatch.source, fullBatch.items);
  indexVersion += 1;
  const docCount = fullBatch.source === 'authored' ? authoredItems.length : contextItems.length;
  post({
    kind: 'index.ready',
    source: 'full',
    corpus: fullBatch.source,
    batchId: fullBatch.batchId,
    indexVersion,
    docCount,
    buildMs: Date.now() - fullBatch.startedAtMs
  });
  fullBatch = null;
};

const handlePatch = (message: Extract<SearchWorkerRequest, { kind: 'index.patch' }>): void => {
  if (message.schemaVersion !== SEARCH_SCHEMA_VERSION) {
    emitSchemaError(message, { patchId: message.patchId });
    return;
  }

  const started = Date.now();
  applyPatch(message.source, message.upserts, message.deletes);
  indexVersion += 1;
  post({
    kind: 'index.ready',
    source: 'patch',
    corpus: message.source,
    patchId: message.patchId,
    indexVersion,
    docCount: message.source === 'authored' ? authoredItems.length : contextItems.length,
    buildMs: Date.now() - started
  });
};

const handleQuery = (message: QueryRequest): void => {
  if (consumeCancel(message.requestId)) return;

  const result = runtime.runSearch({
    query: message.query,
    limit: message.limit,
    sortMode: message.sortMode,
    scopeParam: message.scopeParam,
    budgetMs: message.budgetMs
  });

  if (consumeCancel(message.requestId)) return;

  post({
    kind: 'query.result',
    requestId: message.requestId,
    indexVersion,
    ids: result.ids,
    total: result.total,
    canonicalQuery: result.canonicalQuery,
    resolvedScope: result.resolvedScope,
    diagnostics: result.diagnostics
  });
};

self.addEventListener('message', (event: MessageEvent<SearchWorkerRequest>) => {
  const message = event.data;

  switch (message.kind) {
    case 'index.full.start':
      handleFullStart(message);
      break;
    case 'index.full.chunk':
      handleFullChunk(message);
      break;
    case 'index.full.commit':
      handleFullCommit(message);
      break;
    case 'index.patch':
      handlePatch(message);
      break;
    case 'query.cancel':
      noteCancel(message.requestId);
      break;
    case 'query.run':
      handleQuery(message);
      break;
    default:
      post({ kind: 'error', message: 'Unsupported worker request kind' });
  }
});
