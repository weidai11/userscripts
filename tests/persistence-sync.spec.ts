import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readRepoFile = (relativePath: string): string =>
  fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

test.describe('Persistence Sync Contracts', () => {
  test('[PR-SYNC-01][PR-PERSIST-03][PR-PERSIST-44] Firestore sync path is site-scoped (lw/eaf)', async () => {
    const content = readRepoFile('src/scripts/power-reader/persistence/firestoreSyncBackend.ts');
    expect(content).toContain("export type SyncSite = 'lw' | 'eaf';");
    expect(content).toContain('pr_sync_v1/${site}/nodes/${syncNode}');
  });

  test('[PR-SYNC-02][PR-SYNC-02.1][PR-PERSIST-15] current-user query includes abTestOverrides for sync secret bootstrap', async () => {
    const content = readRepoFile('src/shared/graphql/queries.ts');
    expect(content).toContain('query GetCurrentUser');
    expect(content).toContain('abTestOverrides');
  });

  test('[PR-SYNC-04][PR-PERSIST-06] sync state machine tracks read/loadFrom/authorPrefs as synced subset', async () => {
    const content = readRepoFile('src/scripts/power-reader/persistence/persistenceSync.ts');
    expect(content).toContain("dirty: { read: false, loadFrom: false, authorPrefs: false }");
    expect(content).toContain('runtime.meta.dirty.read = true');
    expect(content).toContain('runtime.meta.dirty.loadFrom = true');
    expect(content).toContain('runtime.meta.dirty.authorPrefs = true');
  });

  test('[PR-PERSIST-17][PR-PERSIST-56] sync debug UI exposes toggle and debug summary controls', async () => {
    const content = readRepoFile('src/scripts/power-reader/render/index.ts');
    expect(content).toContain('pr-sync-enabled-toggle');
    expect(content).toContain('pr-copy-sync-debug-btn');
  });

  test('[PR-SYNC-05][PR-PERSIST-05] reset debug action routes through /reader/reset', async () => {
    const content = readRepoFile('src/scripts/power-reader/render/index.ts');
    expect(content).toContain("window.location.href = '/reader/reset'");
  });

  test('[PR-PERSIST-79] rules and client enforce sane upper bounds for sync counters', async () => {
    const rules = readRepoFile('firestore.rules');
    const backend = readRepoFile('src/scripts/power-reader/persistence/firestoreSyncBackend.ts');
    expect(rules).toContain('value <= 1000000000');
    expect(rules).toContain('validWriterLabel(value)');
    expect(rules).toContain('value.size() <= 128');
    expect(backend).toContain('const MAX_SYNC_COUNTER = 1_000_000_000;');
    expect(backend).toContain('out-of-range integer');
  });

  test('[PR-PERSIST-38] optional lastPushedAtMs is validated as epoch-ms in rules and client schema decode/encode', async () => {
    const rules = readRepoFile('firestore.rules');
    const backend = readRepoFile('src/scripts/power-reader/persistence/firestoreSyncBackend.ts');
    expect(rules).toContain('function validEpochMs(value)');
    expect(rules).toContain("validEpochMs(data.lastPushedAtMs)");
    expect(backend).toContain('const MAX_EPOCH_MS = 253_402_300_799_999;');
    expect(backend).toContain('return assertEpochMs(ms, \'lastPushedAtMs\');');
    expect(backend).toContain('fvInteger(assertEpochMs(envelope.lastPushedAtMs, \'lastPushedAtMs\'))');
  });

  test('[PR-PERSIST-83] commit path uses Firestore server timestamp transform for diagnostics', async () => {
    const backend = readRepoFile('src/scripts/power-reader/persistence/firestoreSyncBackend.ts');
    expect(backend).toContain('updateTransforms');
    expect(backend).toContain("fieldPath: 'lastPushedAt'");
    expect(backend).toContain("setToServerValue: 'REQUEST_TIME'");
    expect(backend).toContain('CAS update requires expectedUpdateTime; call readEnvelope first');
  });

  test('[PR-PERSIST-84] backend decode tolerates malformed dynamic author-pref entries', async () => {
    const backend = readRepoFile('src/scripts/power-reader/persistence/firestoreSyncBackend.ts');
    expect(backend).toContain('Skip malformed dynamic entries');
    expect(backend).toContain('MAX_WRITER_LABEL_LENGTH');
  });

  test('[PR-PERSIST-27] author preference key validation stays aligned across merge and decode paths', async () => {
    const sync = readRepoFile('src/scripts/power-reader/persistence/persistenceSync.ts');
    const backend = readRepoFile('src/scripts/power-reader/persistence/firestoreSyncBackend.ts');
    expect(sync).toContain("/^[A-Za-z0-9 ._,'/:;-]{1,128}$/");
    expect(backend).toContain("/^[A-Za-z0-9 ._,'/:;-]{1,128}$/");
  });

  test('[PR-PERSIST-14][PR-PERSIST-74] read-only dirty state uses extended push floor while preserving debounce max-wait', async () => {
    const sync = readRepoFile('src/scripts/power-reader/persistence/persistenceSync.ts');
    expect(sync).toContain('const READ_ONLY_PUSH_FLOOR_MS = 45_000;');
    expect(sync).toContain('const SYNC_MAX_WAIT_MS = 30_000;');
    expect(sync).toContain('return hasOnlyReadDirty(meta) ? READ_ONLY_PUSH_FLOOR_MS : PUSH_FLOOR_MS;');
    expect(sync).toContain('scheduleFlush(SYNC_DEBOUNCE_MS, true);');
  });

  test('[PR-PERSIST-15] bootstrap mutation failures are handled without crashing startup', async () => {
    const sync = readRepoFile('src/scripts/power-reader/persistence/persistenceSync.ts');
    expect(sync).toContain("Logger.warn('sync secret bootstrap mutation failed', error);");
    expect(sync).toContain('let responseSecret: unknown;');
  });

  test('[PR-PERSIST-23] author preference merge only overlays local author prefs when dirty', async () => {
    const sync = readRepoFile('src/scripts/power-reader/persistence/persistenceSync.ts');
    expect(sync).toContain('allowLocalMerge && localClearEpoch === clearEpoch');
    expect(sync).toContain('runtime.meta.dirty.authorPrefs');
    expect(sync).toContain('return Number.isFinite(parsed) ? parsed : 0;');
    expect(sync).toContain('return a[0].localeCompare(b[0]);');
  });

  test('[PR-PERSIST-19] read overflow clear-epoch bump marks read dirty for propagation', async () => {
    const sync = readRepoFile('src/scripts/power-reader/persistence/persistenceSync.ts');
    expect(sync).toContain("setDirty('read');");
    expect(sync).toContain('mergedRead.clearEpoch > runtime.meta.readClearEpoch');
  });

  test('[PR-PERSIST-04][PR-PERSIST-07] explicit current-user override only applies for resolved identity snapshots', async () => {
    const main = readRepoFile('src/scripts/power-reader/main.ts');
    const sync = readRepoFile('src/scripts/power-reader/persistence/persistenceSync.ts');
    const loader = readRepoFile('src/scripts/power-reader/services/loader.ts');
    expect(main).toContain('if (syncInit.currentUserSnapshot === undefined)');
    expect(sync).toContain('queryGraphQLResponse<{ currentUser?: CurrentUserLike | null }>');
    expect(sync).toContain("const identityResolved = currentUserResult.kind === 'resolved';");
    expect(loader).toContain('const userPromise = currentUserOverride !== undefined');
    expect(loader).toContain('const effectiveCurrentUser = currentUserOverride !== undefined ? currentUserOverride : userRes?.currentUser;');
  });

  test('[PR-PERSIST-24] identity permission-denied path is fail-closed with explicit status', async () => {
    const sync = readRepoFile('src/scripts/power-reader/persistence/persistenceSync.ts');
    expect(sync).toContain('abTestOverridesPermissionDenied');
    expect(sync).toContain("if (runtime.identityPermissionDenied) return 'Sync: unavailable (identity permission)';");
  });

  test('[PR-PERSIST-34][PR-PERSIST-35] anonymous sessions preserve lastUserId guard and gate fallback probe', async () => {
    const sync = readRepoFile('src/scripts/power-reader/persistence/persistenceSync.ts');
    expect(sync).toContain('if (runtime.meta.lastUserId && runtime.meta.lastUserId !== runtime.userId) {');
    expect(sync).not.toContain('runtime.meta.lastUserId = undefined;');
    expect(sync).toContain('runtime.meta.lastUserId === runtime.userId');
  });

  test('[PR-PERSIST-25] flush path guards against stale writes across reset generation changes', async () => {
    const sync = readRepoFile('src/scripts/power-reader/persistence/persistenceSync.ts');
    expect(sync).toContain('runtime.resetGeneration += 1;');
    expect(sync).toContain('if (runtime.resetGeneration !== flushGeneration) return;');
    expect(sync).toContain('const pullGeneration = runtime.resetGeneration;');
    expect(sync).toContain('if (runtime.resetGeneration !== pullGeneration) return false;');
    expect(sync).toContain('writeWithCas(readResult, force, flushGeneration)');
  });

  test('[PR-PERSIST-85] counter increments are overflow-safe for loadFrom and authorPrefs', async () => {
    const sync = readRepoFile('src/scripts/power-reader/persistence/persistenceSync.ts');
    expect(sync).toContain('function incrementSyncCounter(value: number): number');
    expect(sync).toContain('loadFromVersion = incrementSyncCounter(loadFromVersion);');
    expect(sync).toContain('version: incrementSyncCounter(existing?.version || 0)');
  });

  test('[PR-PERSIST-86] uncertain write outcomes reconcile via read before retry', async () => {
    const sync = readRepoFile('src/scripts/power-reader/persistence/persistenceSync.ts');
    expect(sync).toContain('isUncertainWriteOutcome(error)');
    expect(sync).toContain("logBackendError('sync uncertain write reconcile failed', readError);");
  });

  test('[PR-PERSIST-87] Firestore config is not exported onto window globals', async () => {
    const main = readRepoFile('src/scripts/power-reader/main.ts');
    const backend = readRepoFile('src/scripts/power-reader/persistence/firestoreSyncBackend.ts');
    expect(main).not.toContain('__PR_FIRESTORE_PROJECT_ID__ =');
    expect(backend).toContain("typeof __PR_FIRESTORE_PROJECT_ID__ === 'string'");
    expect(backend).not.toContain('window as any');
    expect(backend).toContain('if (/^https?:\\/\\//i.test(rawHost))');
    expect(backend).not.toContain('requireExists');
  });

  test('[PR-PERSIST-88] stable compare is deep and order-insensitive for nested sync maps', async () => {
    const sync = readRepoFile('src/scripts/power-reader/persistence/persistenceSync.ts');
    expect(sync).toContain('const stableCloneSorted = (value: unknown): unknown => {');
    expect(sync).toContain('for (const key of Object.keys(source).sort())');
  });

  test('[PR-PERSIST-89] device id is bounded to keep writer labels rule-safe', async () => {
    const storage = readRepoFile('src/scripts/power-reader/utils/storage.ts');
    expect(storage).toContain('const DEVICE_ID_MAX_LENGTH = 96;');
    expect(storage).toContain('normalized.length <= DEVICE_ID_MAX_LENGTH');
  });

  test('[PR-PERSIST-90] GraphQL request includes operationName when provided', async () => {
    const client = readRepoFile('src/shared/graphql/client.ts');
    expect(client).toContain('body.operationName = options.operationName;');
  });

  test('[PR-PERSIST-91] reset clear-all path clears sync metadata and local sync settings', async () => {
    const storage = readRepoFile('src/scripts/power-reader/utils/storage.ts');
    expect(storage).toContain('export function clearReaderStorage(options: StorageWriteOptions = {})');
    expect(storage).toContain("GM_setValue(getKey(STORAGE_KEYS.SYNC_META), '')");
    expect(storage).toContain("GM_setValue(getKey(STORAGE_KEYS.SYNC_ENABLED), '')");
    expect(storage).toContain("GM_setValue(getKey(STORAGE_KEYS.DEVICE_ID), '')");
    expect(storage).toContain("GM_setValue(getKey(STORAGE_KEYS.SYNC_QUOTA_META), '')");
  });

  test('[PR-PERSIST-92] preview timers re-check hover intent/visibility before opening', async () => {
    const preview = readRepoFile('src/scripts/power-reader/utils/preview.ts');
    expect(preview).toContain("!trigger.isConnected || !trigger.matches(':hover') || !isIntentionalHover()");
  });

  test('[PR-PERSIST-93] expiresAt anchor clamps stale server times and ignores remote lastPushedAt fallback', async () => {
    const sync = readRepoFile('src/scripts/power-reader/persistence/persistenceSync.ts');
    expect(sync).toContain('Math.max(anchorMs, nowMs()) + SYNC_TTL_MS');
    expect(sync).toContain('runtime.lastServerAnchorIso = result.updateTime || runtime.lastServerAnchorIso;');
  });

  test('[PR-PERSIST-19] read-overflow guard surfaces explicit status-line signal', async () => {
    const sync = readRepoFile('src/scripts/power-reader/persistence/persistenceSync.ts');
    expect(sync).toContain("return showReadOverflowNotice ? 'Sync: syncing... (read overflow cleared)' : 'Sync: syncing...';");
    expect(sync).toContain("if (showReadOverflowNotice) return 'Sync: on (read overflow cleared)';");
  });
});
