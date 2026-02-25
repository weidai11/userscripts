import { SearchQueryCancelledError } from './protocol';
import type { SearchWorkerClient } from './protocol';
import type {
  ArchiveItem,
  ArchiveSearchSortMode,
  SearchRunRequest,
  SearchRunResult
} from './types';

export type ArchiveSearchManagerStatus = {
  mode: 'worker';
  ready: boolean;
  indexVersion: number;
  docCount: number;
  lastError: string | null;
};

export type ArchiveSearchManagerOptions = {
  workerClient: SearchWorkerClient;
};

const randomRequestId = (): string =>
  `query-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const hasSameItemRefs = (a: readonly ArchiveItem[], b: readonly ArchiveItem[]): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

export class ArchiveSearchManager {
  private readonly workerClient: SearchWorkerClient;
  private authoredItems: readonly ArchiveItem[] = [];
  private contextItems: readonly ArchiveItem[] = [];
  private itemsById = new Map<string, ArchiveItem>();
  private indexVersion = 0;
  private docCount = 0;
  private lastError: string | null = null;
  private activeRequestId: string | null = null;
  private authoredIndexSync: Promise<void> | null = null;
  private contextIndexSync: Promise<void> | null = null;
  private authoredSyncToken = 0;
  private contextSyncToken = 0;
  private authoredRevisionToken = 0;
  private requestSequence = 0;

  constructor(options: ArchiveSearchManagerOptions) {
    this.workerClient = options.workerClient;
  }

  setAuthoredItems(items: readonly ArchiveItem[], revisionToken = 0): void {
    if (hasSameItemRefs(this.authoredItems, items) && this.authoredRevisionToken === revisionToken) return;
    this.authoredItems = items;
    this.authoredRevisionToken = revisionToken;
    this.rebuildItemsById();
    this.docCount = this.authoredItems.length + this.contextItems.length;

    const token = ++this.authoredSyncToken;
    const syncPromise = this.workerClient
      .indexFull('authored', this.authoredItems)
      .then(ready => {
        if (token !== this.authoredSyncToken) return;
        this.indexVersion = Math.max(this.indexVersion, ready.indexVersion);
        this.lastError = null;
      })
      .catch(error => {
        if (token !== this.authoredSyncToken) return;
        this.lastError = (error as Error).message;
      })
      .finally(() => {
        if (token === this.authoredSyncToken) {
          this.authoredIndexSync = null;
        }
      });
    this.authoredIndexSync = syncPromise;
  }

  setContextItems(items: readonly ArchiveItem[]): void {
    if (hasSameItemRefs(this.contextItems, items)) return;
    this.contextItems = items;
    this.rebuildItemsById();
    this.docCount = this.authoredItems.length + this.contextItems.length;

    const token = ++this.contextSyncToken;
    const syncPromise = this.workerClient
      .indexFull('context', this.contextItems)
      .then(ready => {
        if (token !== this.contextSyncToken) return;
        this.indexVersion = Math.max(this.indexVersion, ready.indexVersion);
        this.lastError = null;
      })
      .catch(error => {
        if (token !== this.contextSyncToken) return;
        this.lastError = (error as Error).message;
      })
      .finally(() => {
        if (token === this.contextSyncToken) {
          this.contextIndexSync = null;
        }
      });
    this.contextIndexSync = syncPromise;
  }

  async runSearch(request: SearchRunRequest): Promise<SearchRunResult> {
    const requestSequence = ++this.requestSequence;
    this.docCount = this.authoredItems.length + this.contextItems.length;

    const syncTasks: Promise<void>[] = [];
    if (this.authoredIndexSync) syncTasks.push(this.authoredIndexSync);
    if (this.contextIndexSync) syncTasks.push(this.contextIndexSync);
    if (syncTasks.length > 0) {
      await Promise.all(syncTasks);
      if (this.lastError) {
        return this.createWorkerErrorResult(request, this.lastError);
      }
      if (requestSequence !== this.requestSequence) {
        return this.createCancelledResult(request);
      }
    }

    const requestId = randomRequestId();
    if (this.activeRequestId) {
      this.workerClient.cancelQuery(this.activeRequestId);
    }
    this.activeRequestId = requestId;

    try {
      const response = await this.workerClient.runQuery({
        kind: 'query.run',
        requestId,
        query: request.query,
        limit: request.limit,
        sortMode: request.sortMode,
        scopeParam: request.scopeParam,
        budgetMs: request.budgetMs,
        debugExplain: request.debugExplain,
        expectedIndexVersion: this.indexVersion
      });
      this.indexVersion = Math.max(this.indexVersion, response.indexVersion);
      const items: ArchiveItem[] = [];
      const ids: string[] = [];
      for (const id of response.ids) {
        const item = this.itemsById.get(id);
        if (!item) continue;
        ids.push(id);
        items.push(item);
      }
      const droppedIds = response.ids.length - ids.length;
      const total = Math.max(ids.length, response.total - droppedIds);
      let debugExplain: SearchRunResult['debugExplain'];
      if (request.debugExplain && response.debugExplain) {
        const relevanceSignalsById: NonNullable<SearchRunResult['debugExplain']>['relevanceSignalsById'] = {};
        for (const id of ids) {
          const signals = response.debugExplain.relevanceSignalsById[id];
          if (!signals) continue;
          relevanceSignalsById[id] = { ...signals };
        }
        debugExplain = { relevanceSignalsById };
      }

      this.lastError = null;
      return {
        ids,
        total,
        items,
        canonicalQuery: response.canonicalQuery,
        resolvedScope: response.resolvedScope,
        diagnostics: response.diagnostics,
        ...(debugExplain ? { debugExplain } : {})
      };
    } catch (error) {
      if (error instanceof SearchQueryCancelledError) {
        return this.createCancelledResult(request);
      }
      this.lastError = (error as Error).message;
      return this.createWorkerErrorResult(request, this.lastError);
    } finally {
      if (this.activeRequestId === requestId) {
        this.activeRequestId = null;
      }
    }
  }

  getStatus(): ArchiveSearchManagerStatus {
    return {
      mode: 'worker',
      ready: !this.authoredIndexSync && !this.contextIndexSync && !this.lastError,
      indexVersion: this.indexVersion,
      docCount: this.docCount,
      lastError: this.lastError
    };
  }

  destroy(): void {
    this.workerClient.terminate();
  }

  private rebuildItemsById(): void {
    const map = new Map<string, ArchiveItem>();
    for (const item of this.authoredItems) map.set(item._id, item);
    for (const item of this.contextItems) {
      if (map.has(item._id)) continue;
      map.set(item._id, item);
    }
    this.itemsById = map;
  }

  private createCancelledResult(request: SearchRunRequest): SearchRunResult {
    return {
      ids: [],
      total: 0,
      items: [],
      canonicalQuery: request.query,
      resolvedScope: request.scopeParam ?? 'authored',
      diagnostics: {
        warnings: [],
        parseState: 'valid',
        degradedMode: false,
        partialResults: false,
        tookMs: 0,
        stageACandidateCount: 0,
        stageBScanned: 0,
        totalCandidatesBeforeLimit: 0,
        explain: ['cancelled-superseded']
      },
      ...(request.debugExplain ? { debugExplain: { relevanceSignalsById: {} } } : {})
    };
  }

  private createWorkerErrorResult(request: SearchRunRequest, message: string): SearchRunResult {
    return {
      ids: [],
      total: 0,
      items: [],
      canonicalQuery: request.query,
      resolvedScope: request.scopeParam ?? 'authored',
      diagnostics: {
        warnings: [{
          type: 'invalid-query',
          token: 'worker',
          message: `Search worker error: ${message}`
        }],
        parseState: 'invalid',
        degradedMode: true,
        partialResults: false,
        tookMs: 0,
        stageACandidateCount: 0,
        stageBScanned: 0,
        totalCandidatesBeforeLimit: 0,
        explain: ['worker-error']
      },
      ...(request.debugExplain ? { debugExplain: { relevanceSignalsById: {} } } : {})
    };
  }
}

export const createArchiveSearchManager = (options: ArchiveSearchManagerOptions): ArchiveSearchManager =>
  new ArchiveSearchManager(options);

export type {
  ArchiveSearchSortMode
};
