import { expect, test } from '@playwright/test';
import {
  executeFallbackQuery,
  FALLBACK_TOTAL_BUDGET_MS
} from '../src/scripts/power-reader/archive/search/fallback';
import { ArchiveSearchRuntime } from '../src/scripts/power-reader/archive/search/engine';
import {
  ArchiveSearchManager
} from '../src/scripts/power-reader/archive/search';
import {
  createChunkedIndexRequests,
  SearchWorkerClient,
  SearchQueryCancelledError
} from '../src/scripts/power-reader/archive/search/protocol';

const makePost = (overrides: Record<string, unknown> = {}) => ({
  _id: 'p-default',
  title: 'Default Post',
  slug: 'default-post',
  pageUrl: 'https://lesswrong.com/posts/p-default',
  postedAt: '2025-01-01T12:00:00Z',
  baseScore: 1,
  voteCount: 1,
  htmlBody: '<p>default body</p>',
  user: {
    _id: 'u-default',
    username: 'default_user',
    displayName: 'Default User',
    slug: 'default-user',
    karma: 1
  },
  contents: { markdown: 'default body' },
  ...overrides
});

class FakeWorkerClient {
  private indexVersion = 0;
  private readonly indexFullCallCounts: Record<'authored' | 'context', number> = {
    authored: 0,
    context: 0
  };
  private pendingQueries = new Map<string, {
    requestId: string;
    query: string;
    scopeParam?: 'authored' | 'all';
    debugExplain?: boolean;
    resolve: (value: any) => void;
    reject: (reason: Error) => void;
  }>();
  private pendingIndex = new Map<'authored' | 'context', {
    docCount: number;
    resolve: (value: any) => void;
  }>();
  readonly runQueryRequestIds: string[] = [];
  readonly runQueryMessages: Array<{
    requestId: string;
    query: string;
    scopeParam?: 'authored' | 'all';
    debugExplain?: boolean;
  }> = [];

  constructor(private readonly deferIndexReady = false) { }

  indexFull(source: 'authored' | 'context', items: readonly any[]): Promise<any> {
    this.indexFullCallCounts[source] += 1;
    if (!this.deferIndexReady) {
      this.indexVersion += 1;
      return Promise.resolve({
        kind: 'index.ready',
        source: 'full',
        corpus: source,
        batchId: `batch-${source}-${this.indexVersion}`,
        indexVersion: this.indexVersion,
        docCount: items.length,
        buildMs: 0
      });
    }

    return new Promise(resolve => {
      this.pendingIndex.set(source, { docCount: items.length, resolve });
    });
  }

  resolveIndex(source: 'authored' | 'context'): void {
    const pending = this.pendingIndex.get(source);
    if (!pending) return;
    this.pendingIndex.delete(source);
    this.indexVersion += 1;
    pending.resolve({
      kind: 'index.ready',
      source: 'full',
      corpus: source,
      batchId: `batch-${source}-${this.indexVersion}`,
      indexVersion: this.indexVersion,
      docCount: pending.docCount,
      buildMs: 0
    });
  }

  runQuery(message: any): Promise<any> {
    this.runQueryRequestIds.push(message.requestId);
    this.runQueryMessages.push({
      requestId: message.requestId,
      query: message.query,
      scopeParam: message.scopeParam,
      debugExplain: message.debugExplain
    });
    return new Promise((resolve, reject) => {
      this.pendingQueries.set(message.requestId, {
        requestId: message.requestId,
        query: message.query,
        scopeParam: message.scopeParam,
        debugExplain: message.debugExplain,
        resolve,
        reject
      });
    });
  }

  resolveLatestQuery(
    ids: string[],
    total = ids.length,
    debugExplain?: {
      relevanceSignalsById: Record<string, {
        tokenHits: number;
        phraseHits: number;
        authorHit: boolean;
        replyToHit: boolean;
      }>;
    }
  ): void {
    const latest = Array.from(this.pendingQueries.values()).at(-1);
    if (!latest) return;
    this.pendingQueries.delete(latest.requestId);
    latest.resolve({
      kind: 'query.result',
      requestId: latest.requestId,
      indexVersion: this.indexVersion,
      ids,
      total,
      canonicalQuery: latest.query,
      resolvedScope: latest.scopeParam || 'authored',
      diagnostics: {
        warnings: [],
        parseState: 'valid',
        degradedMode: false,
        partialResults: false,
        tookMs: 0,
        stageACandidateCount: total,
        stageBScanned: total,
        totalCandidatesBeforeLimit: total,
        explain: []
      },
      ...(debugExplain ? { debugExplain } : {})
    });
  }

  cancelQuery(requestId: string): void {
    const pending = this.pendingQueries.get(requestId);
    if (!pending) return;
    this.pendingQueries.delete(requestId);
    pending.reject(new SearchQueryCancelledError(requestId));
  }

  indexPatch(): Promise<any> {
    this.indexVersion += 1;
    return Promise.resolve({
      kind: 'index.ready',
      source: 'patch',
      patchId: `patch-${this.indexVersion}`,
      indexVersion: this.indexVersion,
      docCount: 0,
      buildMs: 0
    });
  }

  terminate(): void {
    this.pendingQueries.clear();
    this.pendingIndex.clear();
  }

  getPendingQueryCount(): number {
    return this.pendingQueries.size;
  }

  getIndexFullCallCount(source: 'authored' | 'context'): number {
    return this.indexFullCallCounts[source];
  }

  getLatestRunQueryDebugExplain(): boolean | undefined {
    return this.runQueryMessages.at(-1)?.debugExplain;
  }
}

class FakeProtocolWorker {
  private readonly listeners: Record<'message' | 'error' | 'messageerror', Array<(event: any) => void>> = {
    message: [],
    error: [],
    messageerror: []
  };
  readonly postedMessages: any[] = [];

  addEventListener(type: 'message' | 'error' | 'messageerror', listener: (event: any) => void): void {
    this.listeners[type].push(listener);
  }

  postMessage(message: any): void {
    this.postedMessages.push(message);
  }

  terminate(): void {
    // no-op
  }

  emitError(message: string): void {
    this.listeners.error.forEach(listener => listener({ message }));
  }

  emitMessageError(): void {
    this.listeners.messageerror.forEach(listener => listener({}));
  }

  emitMessage(data: any): void {
    this.listeners.message.forEach(listener => listener({ data }));
  }
}

test.describe('Archive Search Manager/Fallback', () => {
  test('fallback downgrades regex literals to plain-text contains checks', () => {
    const runtime = new ArchiveSearchRuntime();
    runtime.setAuthoredItems([
      makePost({
        _id: 'p-regex',
        title: 'Regex Sample',
        contents: { markdown: 'foo bar baz' }
      }) as any
    ]);
    runtime.setContextItems([]);

    const result = executeFallbackQuery(runtime, {
      query: '/foo.*bar/i',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20
    });

    expect(result.ids).toContain('p-regex');
    expect(result.diagnostics.warnings.some(w => w.message.includes('downgraded regex'))).toBeTruthy();
    expect(result.diagnostics.degradedMode).toBeTruthy();
  });

  test('fallback does not report regex downgrade when regex literal cannot be transformed', () => {
    const runtime = new ArchiveSearchRuntime();
    runtime.setAuthoredItems([
      makePost({
        _id: 'p-invalid-regex',
        title: 'Invalid Regex Sample',
        contents: { markdown: 'foo bar baz' }
      }) as any
    ]);
    runtime.setContextItems([]);

    const result = executeFallbackQuery(runtime, {
      query: '/foo/z',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20
    });

    expect(result.diagnostics.warnings.some(w => w.message.includes('downgraded regex'))).toBeFalsy();
    expect(result.diagnostics.degradedMode).toBeFalsy();
  });

  test('search manager defaults to runtime mode and returns results', async () => {
    const manager = new ArchiveSearchManager();
    manager.setAuthoredItems([
      makePost({
        _id: 'p-manager',
        title: 'Manager Result',
        contents: { markdown: 'manager query target' }
      }) as any
    ]);
    manager.setContextItems([]);

    const result = await manager.runSearch({
      query: 'manager target',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20
    });

    expect(manager.getStatus().mode).toBe('runtime');
    expect(result.ids).toContain('p-manager');
    expect(result.diagnostics.tookMs).toBeGreaterThanOrEqual(0);
    manager.destroy();
  });

  test('runtime search emits debug relevance payload only when requested', async () => {
    const manager = new ArchiveSearchManager();
    manager.setAuthoredItems([
      makePost({
        _id: 'p-runtime-debug',
        title: 'Runtime Debug Result',
        contents: { markdown: 'runtime debug token payload' }
      }) as any
    ]);
    manager.setContextItems([]);

    const withoutDebug = await manager.runSearch({
      query: 'runtime debug',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20
    });
    expect(withoutDebug.debugExplain).toBeUndefined();

    const withDebug = await manager.runSearch({
      query: 'runtime debug',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20,
      debugExplain: true
    });
    expect(withDebug.debugExplain).toBeDefined();
    expect(withDebug.debugExplain?.relevanceSignalsById['p-runtime-debug']?.tokenHits).toBeGreaterThan(0);
    manager.destroy();
  });

  test('worker requested without client falls back to runtime mode when Worker unavailable', () => {
    const manager = new ArchiveSearchManager({ useWorker: true });
    const status = manager.getStatus();
    expect(status.mode).toBe('runtime');
    expect(status.lastError).toContain('runtime mode');
    manager.destroy();
  });

  test('manager waits for worker index sync before sending query', async () => {
    const client = new FakeWorkerClient(true);
    const manager = new ArchiveSearchManager({ workerClient: client as any });
    manager.setAuthoredItems([
      makePost({
        _id: 'p-manager-sync',
        title: 'Manager Sync Result',
        contents: { markdown: 'manager sync query target' }
      }) as any
    ]);
    manager.setContextItems([]);

    const searchPromise = manager.runSearch({
      query: 'manager sync',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20
    });

    await Promise.resolve();
    expect(client.runQueryRequestIds).toHaveLength(0);

    client.resolveIndex('authored');
    client.resolveIndex('context');
    await expect.poll(() => client.runQueryRequestIds.length).toBe(1);

    client.resolveLatestQuery(['p-manager-sync']);
    const result = await searchPromise;
    expect(result.ids).toEqual(['p-manager-sync']);
    manager.destroy();
  });

  test('superseded query during index sync is cancelled before worker run', async () => {
    const client = new FakeWorkerClient(true);
    const manager = new ArchiveSearchManager({ workerClient: client as any });
    manager.setAuthoredItems([
      makePost({
        _id: 'p-manager-sync-cancel',
        title: 'Manager Sync Cancel Result',
        contents: { markdown: 'manager sync cancel target' }
      }) as any
    ]);
    manager.setContextItems([]);

    const firstPromise = manager.runSearch({
      query: 'first pending',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20
    });
    const secondPromise = manager.runSearch({
      query: 'second pending',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20
    });

    await Promise.resolve();
    expect(client.runQueryRequestIds).toHaveLength(0);

    client.resolveIndex('authored');
    client.resolveIndex('context');
    await expect.poll(() => client.runQueryRequestIds.length).toBe(1);

    client.resolveLatestQuery(['p-manager-sync-cancel']);
    const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);

    expect(firstResult.ids).toEqual([]);
    expect(firstResult.diagnostics.explain).toContain('cancelled-superseded');
    expect(secondResult.ids).toEqual(['p-manager-sync-cancel']);
    manager.destroy();
  });

  test('cancelled prior worker query does not disable worker mode', async () => {
    const client = new FakeWorkerClient(false);
    const manager = new ArchiveSearchManager({ workerClient: client as any });
    manager.setAuthoredItems([
      makePost({
        _id: 'p-manager-cancel',
        title: 'Manager Cancel Result',
        contents: { markdown: 'manager cancel query target' }
      }) as any
    ]);
    manager.setContextItems([]);

    const firstPromise = manager.runSearch({
      query: 'manager',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20
    });
    await expect.poll(() => client.getPendingQueryCount()).toBe(1);

    const secondPromise = manager.runSearch({
      query: 'manager cancel',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20
    });
    await expect.poll(() => client.getPendingQueryCount()).toBe(1);

    client.resolveLatestQuery(['p-manager-cancel']);
    const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);

    expect(firstResult.ids).toEqual([]);
    expect(firstResult.total).toBe(0);
    expect(secondResult.ids).toEqual(['p-manager-cancel']);
    expect(manager.getStatus().mode).toBe('worker');
    manager.destroy();
  });

  test('worker total is reconciled when stale ids are missing on the main thread', async () => {
    const client = new FakeWorkerClient(false);
    const manager = new ArchiveSearchManager({ workerClient: client as any });
    manager.setAuthoredItems([
      makePost({
        _id: 'p-manager-present',
        title: 'Present Result',
        contents: { markdown: 'present result body' }
      }) as any
    ]);
    manager.setContextItems([]);

    const searchPromise = manager.runSearch({
      query: 'present',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20
    });
    await expect.poll(() => client.getPendingQueryCount()).toBe(1);

    client.resolveLatestQuery(['p-manager-present', 'p-manager-missing'], 2);
    const result = await searchPromise;

    expect(result.ids).toEqual(['p-manager-present']);
    expect(result.total).toBe(1);
    manager.destroy();
  });

  test('manager forwards debugExplain to worker and exposes worker debug payload', async () => {
    const client = new FakeWorkerClient(false);
    const manager = new ArchiveSearchManager({ workerClient: client as any });
    manager.setAuthoredItems([
      makePost({
        _id: 'p-manager-debug',
        title: 'Manager Debug Result',
        contents: { markdown: 'manager debug payload' }
      }) as any
    ]);
    manager.setContextItems([]);

    const searchPromise = manager.runSearch({
      query: 'manager debug',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20,
      debugExplain: true
    });
    await expect.poll(() => client.getPendingQueryCount()).toBe(1);
    expect(client.getLatestRunQueryDebugExplain()).toBe(true);

    client.resolveLatestQuery(
      ['p-manager-debug'],
      1,
      {
        relevanceSignalsById: {
          'p-manager-debug': {
            tokenHits: 2,
            phraseHits: 0,
            authorHit: false,
            replyToHit: false
          }
        }
      }
    );
    const result = await searchPromise;
    expect(result.debugExplain?.relevanceSignalsById['p-manager-debug']?.tokenHits).toBe(2);
    manager.destroy();
  });

  test('manager suppresses worker debug payload when request does not enable debugExplain', async () => {
    const client = new FakeWorkerClient(false);
    const manager = new ArchiveSearchManager({ workerClient: client as any });
    manager.setAuthoredItems([
      makePost({
        _id: 'p-manager-nodebug',
        title: 'Manager No Debug Result',
        contents: { markdown: 'manager no debug payload' }
      }) as any
    ]);
    manager.setContextItems([]);

    const searchPromise = manager.runSearch({
      query: 'manager no debug',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20
    });
    await expect.poll(() => client.getPendingQueryCount()).toBe(1);

    client.resolveLatestQuery(
      ['p-manager-nodebug'],
      1,
      {
        relevanceSignalsById: {
          'p-manager-nodebug': {
            tokenHits: 3,
            phraseHits: 1,
            authorHit: false,
            replyToHit: false
          }
        }
      }
    );

    const result = await searchPromise;
    expect(result.debugExplain).toBeUndefined();
    manager.destroy();
  });

  test('manager filters worker debug payload to mapped ids', async () => {
    const client = new FakeWorkerClient(false);
    const manager = new ArchiveSearchManager({ workerClient: client as any });
    manager.setAuthoredItems([
      makePost({
        _id: 'p-manager-present-debug',
        title: 'Present Debug Result',
        contents: { markdown: 'present debug body' }
      }) as any
    ]);
    manager.setContextItems([]);

    const searchPromise = manager.runSearch({
      query: 'present debug',
      scopeParam: 'authored',
      sortMode: 'relevance',
      limit: 20,
      debugExplain: true
    });
    await expect.poll(() => client.getPendingQueryCount()).toBe(1);

    client.resolveLatestQuery(
      ['p-manager-present-debug', 'p-manager-missing-debug'],
      2,
      {
        relevanceSignalsById: {
          'p-manager-present-debug': {
            tokenHits: 4,
            phraseHits: 0,
            authorHit: false,
            replyToHit: false
          },
          'p-manager-missing-debug': {
            tokenHits: 99,
            phraseHits: 99,
            authorHit: true,
            replyToHit: true
          }
        }
      }
    );

    const result = await searchPromise;
    expect(result.ids).toEqual(['p-manager-present-debug']);
    expect(result.debugExplain?.relevanceSignalsById['p-manager-present-debug']?.tokenHits).toBe(4);
    expect(result.debugExplain?.relevanceSignalsById['p-manager-missing-debug']).toBeUndefined();
    manager.destroy();
  });

  test('manager skips redundant context worker full-index when context references are unchanged', () => {
    const client = new FakeWorkerClient(false);
    const manager = new ArchiveSearchManager({ workerClient: client as any });
    const context = [
      makePost({
        _id: 'p-manager-context',
        title: 'Manager Context Result',
        contents: { markdown: 'manager context query target' }
      }) as any
    ];

    manager.setAuthoredItems([]);
    manager.setContextItems(context);
    manager.setContextItems(context);

    expect(client.getIndexFullCallCount('context')).toBe(1);
    manager.destroy();
  });

  test('manager skips redundant authored worker full-index when authored refs and revision are unchanged', () => {
    const client = new FakeWorkerClient(false);
    const manager = new ArchiveSearchManager({ workerClient: client as any });
    const authored = [
      makePost({
        _id: 'p-manager-authored',
        title: 'Manager Authored Result',
        contents: { markdown: 'manager authored query target' }
      }) as any
    ];

    manager.setAuthoredItems(authored, 7);
    manager.setAuthoredItems(authored, 7);

    expect(client.getIndexFullCallCount('authored')).toBe(1);
    manager.destroy();
  });

  test('worker client rejects pending requests when worker emits error', async () => {
    const worker = new FakeProtocolWorker();
    const client = new SearchWorkerClient(worker as any);

    const queryPromise = client.runQuery({
      kind: 'query.run',
      requestId: 'q-worker-error',
      query: 'foo',
      limit: 20,
      sortMode: 'relevance'
    });
    const indexPromise = client.indexPatch('authored', [], []);

    worker.emitError('kaboom');

    await expect(queryPromise).rejects.toThrow('kaboom');
    await expect(indexPromise).rejects.toThrow('kaboom');
    await expect(client.runQuery({
      kind: 'query.run',
      requestId: 'q-worker-error-next',
      query: 'bar',
      limit: 20,
      sortMode: 'relevance'
    })).rejects.toThrow('kaboom');
  });

  test('worker client transports debugExplain request and response payloads', async () => {
    const worker = new FakeProtocolWorker();
    const client = new SearchWorkerClient(worker as any);

    const pending = client.runQuery({
      kind: 'query.run',
      requestId: 'q-debug',
      query: 'debug payload',
      limit: 20,
      sortMode: 'relevance',
      debugExplain: true
    });

    const sent = worker.postedMessages.at(-1);
    expect(sent?.kind).toBe('query.run');
    expect(sent?.debugExplain).toBe(true);

    worker.emitMessage({
      kind: 'query.result',
      requestId: 'q-debug',
      indexVersion: 1,
      ids: ['p-debug'],
      total: 1,
      canonicalQuery: 'debug payload',
      resolvedScope: 'authored',
      diagnostics: {
        warnings: [],
        parseState: 'valid',
        degradedMode: false,
        partialResults: false,
        tookMs: 0,
        stageACandidateCount: 1,
        stageBScanned: 1,
        totalCandidatesBeforeLimit: 1,
        explain: []
      },
      debugExplain: {
        relevanceSignalsById: {
          'p-debug': {
            tokenHits: 1,
            phraseHits: 1,
            authorHit: false,
            replyToHit: false
          }
        }
      }
    });

    const response = await pending;
    expect(response.debugExplain?.relevanceSignalsById['p-debug']?.phraseHits).toBe(1);
  });

  test('worker client rejects pending requests when worker emits messageerror', async () => {
    const worker = new FakeProtocolWorker();
    const client = new SearchWorkerClient(worker as any);

    const pending = client.indexPatch('context', [], []);
    worker.emitMessageError();

    await expect(pending).rejects.toThrow('deserialization');
  });

  test('chunked index request helper emits stable chunk metadata', () => {
    const items = Array.from({ length: 5 }, (_, i) => makePost({ _id: `p-${i}` })) as any[];
    const chunks = createChunkedIndexRequests('batch-1', 'authored', items, 2);

    expect(chunks).toHaveLength(3);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[1].chunkIndex).toBe(1);
    expect(chunks[2].chunkIndex).toBe(2);
    expect(chunks[0].totalChunks).toBe(3);
    expect(chunks[0].source).toBe('authored');
  });

  test('fallback default budget constant remains 150ms', () => {
    expect(FALLBACK_TOTAL_BUDGET_MS).toBe(150);
  });
});
