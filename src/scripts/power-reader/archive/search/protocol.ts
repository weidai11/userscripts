import type {
  ArchiveCorpusName,
  ArchiveItem,
  ArchiveSearchScope,
  ArchiveSearchSortMode,
  SearchDebugExplainPayload,
  SearchDiagnostics
} from './types';

export const SEARCH_SCHEMA_VERSION = 1;
const DEFAULT_INDEX_CHUNK_SIZE = 500;

export type SearchWorkerRequest =
  | { kind: 'index.full.start'; batchId: string; source: ArchiveCorpusName; schemaVersion: number }
  | {
    kind: 'index.full.chunk';
    batchId: string;
    source: ArchiveCorpusName;
    chunkIndex: number;
    totalChunks: number;
    items: ArchiveItem[];
  }
  | { kind: 'index.full.commit'; batchId: string; source: ArchiveCorpusName }
  | {
    kind: 'index.patch';
    patchId: string;
    source: ArchiveCorpusName;
    upserts: ArchiveItem[];
    deletes: string[];
    schemaVersion: number;
  }
  | {
    kind: 'query.run';
    requestId: string;
    query: string;
    limit: number;
    sortMode: ArchiveSearchSortMode;
    scopeParam?: ArchiveSearchScope;
    budgetMs?: number;
    debugExplain?: boolean;
    expectedIndexVersion?: number;
  }
  | { kind: 'query.cancel'; requestId: string };

export type SearchWorkerResponse =
  | {
    kind: 'index.ready';
    source: 'full' | 'patch';
    indexVersion: number;
    docCount: number;
    buildMs: number;
    batchId?: string;
    patchId?: string;
    corpus?: ArchiveCorpusName;
  }
  | {
    kind: 'query.result';
    requestId: string;
    indexVersion: number;
    ids: string[];
    total: number;
    canonicalQuery: string;
    resolvedScope: ArchiveSearchScope;
    diagnostics: SearchDiagnostics;
    debugExplain?: SearchDebugExplainPayload;
  }
  | { kind: 'error'; requestId?: string; batchId?: string; patchId?: string; message: string };

type PendingQuery = {
  resolve: (response: Extract<SearchWorkerResponse, { kind: 'query.result' }>) => void;
  reject: (err: Error) => void;
};

type PendingIndex = {
  resolve: (response: Extract<SearchWorkerResponse, { kind: 'index.ready' }>) => void;
  reject: (err: Error) => void;
};

const randomId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isQueryResult = (msg: SearchWorkerResponse): msg is Extract<SearchWorkerResponse, { kind: 'query.result' }> =>
  msg.kind === 'query.result';

const isIndexReady = (msg: SearchWorkerResponse): msg is Extract<SearchWorkerResponse, { kind: 'index.ready' }> =>
  msg.kind === 'index.ready';

const isError = (msg: SearchWorkerResponse): msg is Extract<SearchWorkerResponse, { kind: 'error' }> =>
  msg.kind === 'error';

export class SearchQueryCancelledError extends Error {
  readonly requestId: string;

  constructor(requestId: string) {
    super(`Search query cancelled: ${requestId}`);
    this.name = 'SearchQueryCancelledError';
    this.requestId = requestId;
  }
}

export class SearchWorkerClient {
  private readonly worker: Worker;
  private readonly pendingQueries = new Map<string, PendingQuery>();
  private readonly pendingIndex = new Map<string, PendingIndex>();
  private workerFailure: Error | null = null;

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener('message', event => {
      const msg = event.data as SearchWorkerResponse;

      if (isQueryResult(msg)) {
        const pending = this.pendingQueries.get(msg.requestId);
        if (!pending) return;
        this.pendingQueries.delete(msg.requestId);
        pending.resolve(msg);
        return;
      }

      if (isIndexReady(msg)) {
        const key = msg.batchId || msg.patchId;
        if (!key) return;
        const pending = this.pendingIndex.get(key);
        if (!pending) return;
        this.pendingIndex.delete(key);
        pending.resolve(msg);
        return;
      }

      if (isError(msg)) {
        if (msg.requestId) {
          const queryPending = this.pendingQueries.get(msg.requestId);
          if (queryPending) {
            this.pendingQueries.delete(msg.requestId);
            queryPending.reject(new Error(msg.message));
          }
        }
        const key = msg.batchId || msg.patchId;
        if (key) {
          const indexPending = this.pendingIndex.get(key);
          if (indexPending) {
            this.pendingIndex.delete(key);
            indexPending.reject(new Error(msg.message));
          }
        }
        if (!msg.requestId && !key) {
          this.failWorker(new Error(msg.message));
        }
      }
    });
    this.worker.addEventListener('error', event => {
      const message = event.message?.trim();
      this.failWorker(new Error(message ? `Search worker crashed: ${message}` : 'Search worker crashed'));
    });
    this.worker.addEventListener('messageerror', () => {
      this.failWorker(new Error('Search worker message deserialization failed'));
    });
  }

  private failWorker(error: Error): void {
    if (!this.workerFailure) {
      this.workerFailure = error;
    }
    const rejectReason = this.workerFailure;
    this.pendingQueries.forEach(pending => pending.reject(rejectReason));
    this.pendingQueries.clear();
    this.pendingIndex.forEach(pending => pending.reject(rejectReason));
    this.pendingIndex.clear();
  }

  post(message: SearchWorkerRequest): void {
    if (this.workerFailure) {
      throw this.workerFailure;
    }
    this.worker.postMessage(message);
  }

  runQuery(message: Extract<SearchWorkerRequest, { kind: 'query.run' }>): Promise<Extract<SearchWorkerResponse, { kind: 'query.result' }>> {
    if (this.workerFailure) {
      return Promise.reject(this.workerFailure);
    }
    return new Promise((resolve, reject) => {
      this.pendingQueries.set(message.requestId, { resolve, reject });
      try {
        this.post(message);
      } catch (error) {
        this.pendingQueries.delete(message.requestId);
        reject(error as Error);
      }
    });
  }

  cancelQuery(requestId: string): void {
    const pending = this.pendingQueries.get(requestId);
    if (pending) {
      this.pendingQueries.delete(requestId);
      pending.reject(new SearchQueryCancelledError(requestId));
    }
    try {
      this.post({ kind: 'query.cancel', requestId });
    } catch {
      // Worker is unavailable; pending promises have already been rejected.
    }
  }

  indexFull(source: ArchiveCorpusName, items: readonly ArchiveItem[], chunkSize = DEFAULT_INDEX_CHUNK_SIZE): Promise<Extract<SearchWorkerResponse, { kind: 'index.ready' }>> {
    if (this.workerFailure) {
      return Promise.reject(this.workerFailure);
    }
    const batchId = randomId(`full-${source}`);
    const chunks = createChunkedIndexRequests(batchId, source, items, chunkSize);

    return new Promise((resolve, reject) => {
      this.pendingIndex.set(batchId, { resolve, reject });
      try {
        this.post({
          kind: 'index.full.start',
          batchId,
          source,
          schemaVersion: SEARCH_SCHEMA_VERSION
        });
        for (const chunk of chunks) this.post(chunk);
        this.post({ kind: 'index.full.commit', batchId, source });
      } catch (error) {
        this.pendingIndex.delete(batchId);
        reject(error as Error);
      }
    });
  }

  indexPatch(source: ArchiveCorpusName, upserts: ArchiveItem[], deletes: string[]): Promise<Extract<SearchWorkerResponse, { kind: 'index.ready' }>> {
    if (this.workerFailure) {
      return Promise.reject(this.workerFailure);
    }
    const patchId = randomId(`patch-${source}`);
    return new Promise((resolve, reject) => {
      this.pendingIndex.set(patchId, { resolve, reject });
      try {
        this.post({
          kind: 'index.patch',
          patchId,
          source,
          upserts,
          deletes,
          schemaVersion: SEARCH_SCHEMA_VERSION
        });
      } catch (error) {
        this.pendingIndex.delete(patchId);
        reject(error as Error);
      }
    });
  }

  terminate(): void {
    this.failWorker(new Error('Search worker terminated'));
    this.worker.terminate();
  }
}

export const createChunkedIndexRequests = (
  batchId: string,
  source: ArchiveCorpusName,
  items: readonly ArchiveItem[],
  chunkSize = DEFAULT_INDEX_CHUNK_SIZE
): Array<Extract<SearchWorkerRequest, { kind: 'index.full.chunk' }>> => {
  if (items.length === 0) {
    return [{
      kind: 'index.full.chunk',
      batchId,
      source,
      chunkIndex: 0,
      totalChunks: 1,
      items: []
    }];
  }

  const chunks: Array<Extract<SearchWorkerRequest, { kind: 'index.full.chunk' }>> = [];
  const totalChunks = Math.ceil(items.length / chunkSize);
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = start + chunkSize;
    chunks.push({
      kind: 'index.full.chunk',
      batchId,
      source,
      chunkIndex,
      totalChunks,
      items: items.slice(start, end) as ArchiveItem[]
    });
  }
  return chunks;
};
