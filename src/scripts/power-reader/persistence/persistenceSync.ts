import { queryGraphQL, queryGraphQLResponse } from '../../../shared/graphql/client';
import { GET_CURRENT_USER, UPDATE_SYNC_SECRET } from '../../../shared/graphql/queries';
import { Logger } from '../utils/logger';
import { isEAForumHost } from '../utils/forum';
import {
  getAuthorPreferences,
  getDeviceId,
  getLoadFrom,
  getReadState,
  getSyncEnabled,
  getSyncMeta,
  getSyncQuotaMeta,
  onSyncFieldChanged,
  setAuthorPreferences,
  setLoadFrom,
  setReadState,
  setSyncEnabled,
  setSyncMeta,
  setSyncQuotaMeta,
} from '../utils/storage';
import {
  FirestoreBackendError,
  buildFirestorePath,
  commitEnvelope,
  defaultEnvelope,
  getFirestoreBackendConfig,
  isCasConflict,
  isCreateRace,
  isInvalidArgument,
  isMissingDocumentError,
  isPermissionDenied,
  isQuotaExceeded,
  isUncertainWriteOutcome,
  logBackendError,
  readEnvelope,
  setFirestoreBackendConfigForTests,
  withRetryJitter,
} from './firestoreSyncBackend';
import type {
  AuthorPreferences,
  SyncableField,
} from '../utils/storage';
import type {
  AuthorPrefEnvelopeValue,
  FirestoreBackendConfig,
  PRSyncEnvelopeV1,
  SyncSite,
} from './firestoreSyncBackend';

const SYNC_SECRET_KEY = 'pr_sync_secret_v1';
const SYNC_META_VERSION = 1;
const SYNC_TTL_MS = 181 * 24 * 60 * 60 * 1000;
const SYNC_TTL_FALLBACK_MS = 170 * 24 * 60 * 60 * 1000;
const SYNC_DEBOUNCE_MS = 8_000;
const PULL_THROTTLE_MS = 45_000;
const PULL_FALLBACK_STALE_MS = 10 * 60_000;
const PULL_FALLBACK_BASE_MS = 10 * 60_000;
const PULL_FALLBACK_JITTER_MS = 60_000;
const PUSH_FLOOR_MS = 5_000;
const READ_ONLY_PUSH_FLOOR_MS = 45_000;
const SYNC_MAX_WAIT_MS = 30_000;
const SYNC_STARTUP_TIMEOUT_MS = 5_000;
const READ_CAP = 10_000;
const AUTHOR_PREF_CAP = 1_000;
const CAS_RETRY_LIMIT = 3;
const LATE_SYNC_NOTICE_MS = 15_000;
const READ_OVERFLOW_NOTICE_MS = 30_000;
const LOCAL_PUSH_SOFT_LIMIT = 300;
const LOCAL_PUSH_HARD_LIMIT = 500;
const LOCAL_PUSH_COOLDOWN_MS = 60 * 60_000;
const QUOTA_COOLDOWN_LADDER_MIN = [5, 15, 60, 360, 360];
const QUOTA_COOLDOWN_JITTER_MS = 60_000;
const MAX_SYNC_COUNTER = 1_000_000_000;

export interface PersistenceSyncInitOptions {
  isResetRoute: boolean;
}

export interface PersistenceSyncInitResult {
  resetHandled: boolean;
  currentUserSnapshot?: unknown | null;
}

type DirtyFlags = Record<SyncableField, boolean>;

interface SyncMetaV1 {
  version: 1;
  lastUserId?: string;
  lastSyncNode?: string;
  dirty: DirtyFlags;
  readClearEpoch: number;
  loadFrom: {
    version: number;
    clearEpoch: number;
  };
  authorPrefsClearEpoch: number;
  pendingRemoteReset?: boolean;
  pendingRemoteResetAt?: string;
  pendingRemoteResetTargets?: {
    site: SyncSite;
    syncNode?: string;
    userId?: string;
    readClearEpoch?: number;
    loadFromClearEpoch?: number;
    loadFromVersion?: number;
    authorPrefsClearEpoch?: number;
  };
  quotaMode?: 'normal' | 'quota_limited';
  quotaDisabledUntilMs?: number;
  quotaCooldownLevel?: number;
  quotaNextProbeAtMs?: number;
}

interface SyncQuotaMetaV1 {
  version: 1;
  utcDay: string;
  pushCount: number;
  budgetDisabledUntilMs?: number;
}

interface CurrentUserLike {
  _id?: string | null;
  username?: string | null;
  reactPaletteStyle?: 'listView' | 'gridView' | null;
  abTestOverrides?: Record<string, unknown> | null;
}

interface RuntimeState {
  active: boolean;
  site: SyncSite;
  meta: SyncMetaV1;
  config: FirestoreBackendConfig | null;
  currentUser: CurrentUserLike | null;
  syncNode: string | null;
  secret: string | null;
  updateTimeByNode: Map<string, string>;
  lastPullAtMs: number;
  lastPushAtMs: number;
  lastServerAnchorIso: string | null;
  flushTimer: number | null;
  pullInFlight: boolean;
  flushInFlight: boolean;
  pendingFlush: boolean;
  readOnly: boolean;
  pushDisabled: boolean;
  quotaDisabledUntilMs: number;
  startupDone: boolean;
  startupTimedOut: boolean;
  listenerDisposer: (() => void) | null;
  periodicPullTimer: number | null;
  writerId: string;
  userId: string | null;
  connectivityBlocked: boolean;
  secretUnavailable: boolean;
  identityPermissionDenied: boolean;
  lateSyncAppliedUntilMs: number;
  localBudgetMeta: SyncQuotaMetaV1;
  resetGeneration: number;
  firstDirtyAtMs: number | null;
  readOverflowNoticeUntilMs: number;
}

const runtime: RuntimeState = {
  active: false,
  site: isEAForumHost() ? 'eaf' : 'lw',
  meta: createDefaultMeta(),
  config: null,
  currentUser: null,
  syncNode: null,
  secret: null,
  updateTimeByNode: new Map(),
  lastPullAtMs: 0,
  lastPushAtMs: 0,
  lastServerAnchorIso: null,
  flushTimer: null,
  pullInFlight: false,
  flushInFlight: false,
  pendingFlush: false,
  readOnly: false,
  pushDisabled: false,
  quotaDisabledUntilMs: 0,
  startupDone: false,
  startupTimedOut: false,
  listenerDisposer: null,
  periodicPullTimer: null,
  writerId: '',
  userId: null,
  connectivityBlocked: false,
  secretUnavailable: false,
  identityPermissionDenied: false,
  lateSyncAppliedUntilMs: 0,
  localBudgetMeta: createDefaultQuotaMeta(),
  resetGeneration: 0,
  firstDirtyAtMs: null,
  readOverflowNoticeUntilMs: 0,
};

const nowIso = (): string => new Date().toISOString();
const nowMs = (): number => Date.now();
const utcDay = (epochMs: number = nowMs()): string => new Date(epochMs).toISOString().slice(0, 10);

const stableCloneSorted = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => stableCloneSorted(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    out[key] = stableCloneSorted(source[key]);
  }
  return out;
};

const stableJson = (value: unknown): string => JSON.stringify(stableCloneSorted(value));

function safeRandomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `fallback-${Date.now()}-${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
}

function makeWriterId(): string {
  return `${getDeviceId()}:${safeRandomUuid().replace(/-/g, '').slice(0, 8)}`;
}

function asOverridesMap(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function createDefaultMeta(): SyncMetaV1 {
  return {
    version: 1,
    dirty: { read: false, loadFrom: false, authorPrefs: false },
    readClearEpoch: 0,
    loadFrom: { version: 0, clearEpoch: 0 },
    authorPrefsClearEpoch: 0,
    quotaMode: 'normal',
    quotaCooldownLevel: 0,
    quotaNextProbeAtMs: 0,
  };
}

function createDefaultQuotaMeta(): SyncQuotaMetaV1 {
  return {
    version: 1,
    utcDay: new Date().toISOString().slice(0, 10),
    pushCount: 0,
  };
}

function normalizeQuotaMeta(raw: unknown): SyncQuotaMetaV1 {
  if (!raw || typeof raw !== 'object') {
    return createDefaultQuotaMeta();
  }
  const base = raw as Partial<SyncQuotaMetaV1>;
  const next = createDefaultQuotaMeta();
  if (typeof base.utcDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(base.utcDay)) {
    next.utcDay = base.utcDay;
  }
  if (typeof base.pushCount === 'number' && Number.isFinite(base.pushCount)) {
    next.pushCount = Math.max(0, Math.floor(base.pushCount));
  }
  if (typeof base.budgetDisabledUntilMs === 'number' && Number.isFinite(base.budgetDisabledUntilMs)) {
    next.budgetDisabledUntilMs = Math.max(0, Math.floor(base.budgetDisabledUntilMs));
  }
  return next;
}

function clampSyncCounter(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const normalized = Math.floor(numeric);
  if (normalized < 0) return 0;
  if (normalized > MAX_SYNC_COUNTER) return MAX_SYNC_COUNTER;
  return normalized;
}

function incrementSyncCounter(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const normalized = Math.floor(value);
  if (normalized >= MAX_SYNC_COUNTER) return MAX_SYNC_COUNTER;
  if (normalized < 0) return 1;
  return normalized + 1;
}

function normalizeMeta(raw: unknown): SyncMetaV1 {
  if (!raw || typeof raw !== 'object') {
    return createDefaultMeta();
  }
  const base = raw as Partial<SyncMetaV1>;
  const meta = createDefaultMeta();
  if (base.version === SYNC_META_VERSION) {
    meta.version = 1;
  }
  if (typeof base.lastUserId === 'string') meta.lastUserId = base.lastUserId;
  if (typeof base.lastSyncNode === 'string') meta.lastSyncNode = base.lastSyncNode;
  if (base.dirty && typeof base.dirty === 'object') {
    meta.dirty.read = !!base.dirty.read;
    meta.dirty.loadFrom = !!base.dirty.loadFrom;
    meta.dirty.authorPrefs = !!base.dirty.authorPrefs;
  }
  if (typeof base.readClearEpoch === 'number' && Number.isFinite(base.readClearEpoch)) {
    meta.readClearEpoch = clampSyncCounter(base.readClearEpoch, 0);
  }
  if (base.loadFrom && typeof base.loadFrom === 'object') {
    meta.loadFrom.version = clampSyncCounter((base.loadFrom as any).version, meta.loadFrom.version);
    meta.loadFrom.clearEpoch = clampSyncCounter((base.loadFrom as any).clearEpoch, meta.loadFrom.clearEpoch);
  }
  if (typeof base.authorPrefsClearEpoch === 'number' && Number.isFinite(base.authorPrefsClearEpoch)) {
    meta.authorPrefsClearEpoch = clampSyncCounter(base.authorPrefsClearEpoch, 0);
  }
  if (typeof base.pendingRemoteReset === 'boolean') meta.pendingRemoteReset = base.pendingRemoteReset;
  if (typeof base.pendingRemoteResetAt === 'string') meta.pendingRemoteResetAt = base.pendingRemoteResetAt;
  if (base.pendingRemoteResetTargets && typeof base.pendingRemoteResetTargets === 'object') {
    const site = (base.pendingRemoteResetTargets as any).site;
    if (site === 'lw' || site === 'eaf') {
      meta.pendingRemoteResetTargets = {
        site,
        syncNode: typeof (base.pendingRemoteResetTargets as any).syncNode === 'string'
          ? (base.pendingRemoteResetTargets as any).syncNode
          : undefined,
        userId: typeof (base.pendingRemoteResetTargets as any).userId === 'string'
          ? (base.pendingRemoteResetTargets as any).userId
          : undefined,
        readClearEpoch: Number.isFinite((base.pendingRemoteResetTargets as any).readClearEpoch)
          ? clampSyncCounter((base.pendingRemoteResetTargets as any).readClearEpoch, 0)
          : undefined,
        loadFromClearEpoch: Number.isFinite((base.pendingRemoteResetTargets as any).loadFromClearEpoch)
          ? clampSyncCounter((base.pendingRemoteResetTargets as any).loadFromClearEpoch, 0)
          : undefined,
        loadFromVersion: Number.isFinite((base.pendingRemoteResetTargets as any).loadFromVersion)
          ? clampSyncCounter((base.pendingRemoteResetTargets as any).loadFromVersion, 0)
          : undefined,
        authorPrefsClearEpoch: Number.isFinite((base.pendingRemoteResetTargets as any).authorPrefsClearEpoch)
          ? clampSyncCounter((base.pendingRemoteResetTargets as any).authorPrefsClearEpoch, 0)
          : undefined,
      };
    }
  }
  if (base.quotaMode === 'normal' || base.quotaMode === 'quota_limited') {
    meta.quotaMode = base.quotaMode;
  }
  if (typeof base.quotaDisabledUntilMs === 'number' && Number.isFinite(base.quotaDisabledUntilMs)) {
    meta.quotaDisabledUntilMs = base.quotaDisabledUntilMs;
  }
  if (typeof base.quotaCooldownLevel === 'number' && Number.isFinite(base.quotaCooldownLevel)) {
    meta.quotaCooldownLevel = Math.max(0, Math.floor(base.quotaCooldownLevel));
  }
  if (typeof base.quotaNextProbeAtMs === 'number' && Number.isFinite(base.quotaNextProbeAtMs)) {
    meta.quotaNextProbeAtMs = Math.max(0, Math.floor(base.quotaNextProbeAtMs));
  }
  return meta;
}

function persistMeta(): void {
  setSyncMeta(runtime.meta);
}

function persistQuotaMeta(): void {
  setSyncQuotaMeta(runtime.localBudgetMeta);
}

function normalizeDailyBudgetRollover(): void {
  const today = utcDay();
  if (runtime.localBudgetMeta.utcDay === today) return;
  runtime.localBudgetMeta.utcDay = today;
  runtime.localBudgetMeta.pushCount = 0;
  runtime.localBudgetMeta.budgetDisabledUntilMs = 0;
  persistQuotaMeta();
}

function computeSite(): SyncSite {
  return isEAForumHost() ? 'eaf' : 'lw';
}

function normalizeLoadFromValue(value: string | undefined): '__LOAD_RECENT__' | string | undefined {
  if (!value) return undefined;
  if (value === '__LOAD_RECENT__') return '__LOAD_RECENT__';
  if (!value.includes('T')) return undefined;
  return value;
}

function resolveLoadFrom(a?: string, b?: string): '__LOAD_RECENT__' | string | undefined {
  const left = normalizeLoadFromValue(a);
  const right = normalizeLoadFromValue(b);
  if (left === '__LOAD_RECENT__' || right === '__LOAD_RECENT__') return '__LOAD_RECENT__';
  if (left && right) {
    return left > right ? left : right;
  }
  return left || right;
}

function dynamicReadKeyOk(key: string): boolean {
  return /^[A-Za-z0-9:_-]{1,256}$/.test(key);
}

function dynamicAuthorKeyOk(key: string): boolean {
  return /^[A-Za-z0-9 ._,'/:;-]{1,128}$/.test(key);
}

function computeExpiresAt(anchorIso?: string): string {
  const anchorMs = anchorIso ? Date.parse(anchorIso) : NaN;
  if (Number.isFinite(anchorMs)) {
    // Never derive TTL from a stale anchor; clamp to at least local "now".
    return new Date(Math.max(anchorMs, nowMs()) + SYNC_TTL_MS).toISOString();
  }
  // Keep margin below the 181d rules cap when no server anchor exists yet.
  return new Date(nowMs() + SYNC_TTL_FALLBACK_MS).toISOString();
}

function classifyAndSetQuota(error: unknown): void {
  if (!isQuotaExceeded(error)) return;
  runtime.meta.quotaMode = 'quota_limited';
  runtime.meta.quotaCooldownLevel = Math.min(
    (runtime.meta.quotaCooldownLevel || 0) + 1,
    QUOTA_COOLDOWN_LADDER_MIN.length
  );
  const cooldownLevel = Math.max(1, runtime.meta.quotaCooldownLevel || 1);
  const nextMinutes = QUOTA_COOLDOWN_LADDER_MIN[Math.min(cooldownLevel - 1, QUOTA_COOLDOWN_LADDER_MIN.length - 1)];
  const jitterMs = Math.floor(Math.random() * QUOTA_COOLDOWN_JITTER_MS);
  runtime.meta.quotaDisabledUntilMs = nowMs() + (nextMinutes * 60_000) + jitterMs;
  runtime.meta.quotaNextProbeAtMs = runtime.meta.quotaDisabledUntilMs;
  runtime.quotaDisabledUntilMs = runtime.meta.quotaDisabledUntilMs || 0;
  persistMeta();
}

function clearQuotaIfRecovered(): void {
  if (runtime.meta.quotaMode !== 'quota_limited') return;
  runtime.meta.quotaMode = 'normal';
  runtime.meta.quotaDisabledUntilMs = 0;
  runtime.meta.quotaCooldownLevel = 0;
  runtime.meta.quotaNextProbeAtMs = 0;
  runtime.quotaDisabledUntilMs = 0;
  persistMeta();
}

function getCrossTabPushKey(site: SyncSite, userId: string): string {
  return `pr-sync-last-push-at-${site}-${userId}`;
}

function getCrossTabPullKey(site: SyncSite, userId: string): string {
  return `pr-sync-last-pull-at-${site}-${userId}`;
}

function getCrossTabQuotaKey(site: SyncSite, userId: string): string {
  return `pr-sync-quota-next-retry-at-${site}-${userId}`;
}

function readLocalStorageSafe(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorageSafe(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage may be unavailable/blocked in some contexts.
  }
}

function removeLocalStorageSafe(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // localStorage may be unavailable/blocked in some contexts.
  }
}

function isLocalStorageUsable(): boolean {
  const probeKey = '__pr-sync-ls-probe';
  try {
    localStorage.setItem(probeKey, '1');
    localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

function readCrossTabMs(key: string): number {
  const raw = readLocalStorageSafe(key);
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function writeCrossTabMs(key: string, value: number): void {
  writeLocalStorageSafe(key, String(value));
}

function setDirty(field: SyncableField): void {
  const hadDirty = hasAnyDirty();
  runtime.meta.dirty[field] = true;
  if (!hadDirty) {
    runtime.firstDirtyAtMs = nowMs();
  }
  persistMeta();
}

function clearDirty(): void {
  runtime.meta.dirty.read = false;
  runtime.meta.dirty.loadFrom = false;
  runtime.meta.dirty.authorPrefs = false;
  runtime.firstDirtyAtMs = null;
  persistMeta();
}

function hasAnyDirty(meta: SyncMetaV1 = runtime.meta): boolean {
  return !!(meta.dirty.read || meta.dirty.loadFrom || meta.dirty.authorPrefs);
}

function hasOnlyReadDirty(meta: SyncMetaV1 = runtime.meta): boolean {
  return !!(meta.dirty.read && !meta.dirty.loadFrom && !meta.dirty.authorPrefs);
}

function currentPushFloorMs(meta: SyncMetaV1 = runtime.meta): number {
  return hasOnlyReadDirty(meta) ? READ_ONLY_PUSH_FLOOR_MS : PUSH_FLOOR_MS;
}

function computePushFloorWaitMs(): number {
  if (!runtime.userId) return 0;
  const crossTabLastPush = readCrossTabMs(getCrossTabPushKey(runtime.site, runtime.userId));
  const floorGate = Math.max(runtime.lastPushAtMs, crossTabLastPush) + currentPushFloorMs();
  return Math.max(0, floorGate - nowMs());
}

function localDataExistsForFirstPush(): DirtyFlags {
  const read = Object.keys(getReadState()).length > 0;
  const loadFrom = !!normalizeLoadFromValue(getLoadFrom());
  const authorPrefs = Object.keys(getAuthorPreferences()).length > 0;
  return { read, loadFrom, authorPrefs };
}

function shouldBlockForQuota(): boolean {
  const localGate = runtime.meta.quotaDisabledUntilMs || 0;
  const localProbeGate = runtime.meta.quotaNextProbeAtMs || 0;
  const crossTabGate = runtime.userId
    ? readCrossTabMs(getCrossTabQuotaKey(runtime.site, runtime.userId))
    : 0;
  const next = Math.max(localGate, localProbeGate, crossTabGate);
  runtime.quotaDisabledUntilMs = next;
  return next > nowMs();
}

function shouldBlockForLocalBudget(): boolean {
  normalizeDailyBudgetRollover();
  const untilMs = runtime.localBudgetMeta.budgetDisabledUntilMs || 0;
  return untilMs > nowMs();
}

function isLocalBudgetLimitedNow(): boolean {
  if (runtime.localBudgetMeta.utcDay !== utcDay()) return false;
  const untilMs = runtime.localBudgetMeta.budgetDisabledUntilMs || 0;
  return untilMs > nowMs();
}

function noteSuccessfulPushForLocalBudget(): void {
  normalizeDailyBudgetRollover();
  runtime.localBudgetMeta.pushCount += 1;
  if (runtime.localBudgetMeta.pushCount >= LOCAL_PUSH_HARD_LIMIT) {
    runtime.localBudgetMeta.budgetDisabledUntilMs = nowMs() + LOCAL_PUSH_COOLDOWN_MS;
  }
  persistQuotaMeta();
}

async function digestSha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveSyncNode(site: SyncSite, userId: string, secret: string): Promise<string> {
  const canonical = `pr-sync-v1|${site}|${userId}|${secret}`;
  const digest = await digestSha256Hex(canonical);
  return `pr_sync_${digest}`;
}

function extractSecret(user: CurrentUserLike | null): string | null {
  const overrides = asOverridesMap(user?.abTestOverrides);
  const candidate = overrides ? overrides[SYNC_SECRET_KEY] : undefined;
  if (typeof candidate !== 'string') return null;
  if (candidate.length < 16) return null;
  return candidate;
}

type CurrentUserFetchOutcome =
  | {
    kind: 'resolved';
    currentUser: CurrentUserLike | null;
    abTestOverridesPermissionDenied: boolean;
  }
  | {
    kind: 'failed' | 'timeout';
    currentUser: null;
    abTestOverridesPermissionDenied: false;
  };

function isAbTestOverridesPermissionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as {
    path?: Array<string | number>;
    message?: string;
    extensions?: { code?: string };
  };
  const path = Array.isArray(err.path) ? err.path.join('.') : '';
  const message = typeof err.message === 'string' ? err.message.toLowerCase() : '';
  const code = typeof err.extensions?.code === 'string' ? err.extensions.code.toUpperCase() : '';
  const pathMentionsOverrides = path === 'currentUser.abTestOverrides' || path.includes('abTestOverrides');
  const permissionLike =
    code === 'FORBIDDEN' ||
    code === 'PERMISSION_DENIED' ||
    message.includes('permission') ||
    message.includes('forbidden') ||
    message.includes('not authorized');
  return pathMentionsOverrides && permissionLike;
}

async function fetchCurrentUserSnapshotWithDetails(): Promise<CurrentUserFetchOutcome> {
  const task = queryGraphQLResponse<{ currentUser?: CurrentUserLike | null }>(
    GET_CURRENT_USER,
    {},
    {
      operationName: 'GetCurrentUser',
      timeout: 4_000,
    }
  )
    .then((response) => {
      const errors = response.errors || [];
      const abTestOverridesPermissionDenied = errors.some((error) => isAbTestOverridesPermissionError(error));
      if (errors.length > 0 && !abTestOverridesPermissionDenied) {
        Logger.warn('sync current-user query returned GraphQL errors', errors);
        return {
          kind: 'failed',
          currentUser: null,
          abTestOverridesPermissionDenied: false,
        } as const;
      }
      return {
        kind: 'resolved',
        currentUser: response.data?.currentUser || null,
        abTestOverridesPermissionDenied,
      } as const;
    })
    .catch((error) => {
      Logger.warn('sync current-user query failed', error);
      return {
        kind: 'failed',
        currentUser: null,
        abTestOverridesPermissionDenied: false,
      } as const;
    });

  const timeoutGate = new Promise<CurrentUserFetchOutcome>((resolve) => {
    window.setTimeout(() => resolve({
      kind: 'timeout',
      currentUser: null,
      abTestOverridesPermissionDenied: false,
    }), 1_250);
  });

  return Promise.race([task, timeoutGate]);
}

async function fetchCurrentUserSnapshot(): Promise<CurrentUserLike | null | undefined> {
  const result = await fetchCurrentUserSnapshotWithDetails();
  if (result.kind === 'timeout') return undefined;
  if (result.kind === 'failed') return null;
  return result.currentUser;
}

function parseLockPayload(raw: string | null): { token: string; expiresAtMs: number } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { token?: string; expiresAtMs?: number };
    if (!parsed || typeof parsed.token !== 'string') return null;
    if (!Number.isFinite(parsed.expiresAtMs)) return null;
    return {
      token: parsed.token,
      expiresAtMs: parsed.expiresAtMs as number,
    };
  } catch {
    return null;
  }
}

function tryAcquireLocalStorageLock(lockKey: string, token: string, ttlMs: number): boolean {
  if (!isLocalStorageUsable()) return false;
  const current = parseLockPayload(readLocalStorageSafe(lockKey));
  const now = nowMs();
  if (current && current.expiresAtMs > now && current.token !== token) {
    return false;
  }
  const payload = JSON.stringify({ token, expiresAtMs: now + ttlMs });
  writeLocalStorageSafe(lockKey, payload);
  const verify = parseLockPayload(readLocalStorageSafe(lockKey));
  return !!verify && verify.token === token;
}

function releaseLocalStorageLock(lockKey: string, token: string): void {
  const current = parseLockPayload(readLocalStorageSafe(lockKey));
  if (current && current.token === token) {
    removeLocalStorageSafe(lockKey);
  }
}

async function withBootstrapLock<T>(site: SyncSite, userId: string, fn: () => Promise<T>): Promise<{ acquired: boolean; value?: T }> {
  const lockName = `pr-sync-lock-${site}-${userId}`;

  if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
    try {
      let entered = false;
      const value = await navigator.locks.request(
        lockName,
        { mode: 'exclusive', ifAvailable: true },
        async (lock) => {
          if (!lock) return undefined;
          entered = true;
          return fn();
        }
      );
      return entered ? { acquired: true, value } : { acquired: false };
    } catch (error) {
      Logger.warn('sync bootstrap lock via navigator.locks failed; using localStorage fallback', error);
    }
  }

  const token = safeRandomUuid();
  const lockTtlMs = 9_000;
  const acquired = tryAcquireLocalStorageLock(lockName, token, lockTtlMs);
  if (!acquired && !isLocalStorageUsable()) {
    // Fall back to lockless bootstrap when both lock mechanisms are unavailable.
    const value = await fn();
    return { acquired: true, value };
  }
  if (!acquired) return { acquired: false };
  try {
    const value = await fn();
    return { acquired: true, value };
  } finally {
    releaseLocalStorageLock(lockName, token);
  }
}

async function bootstrapSyncSecret(site: SyncSite, userId: string): Promise<string | null> {
  const readAndExtract = async (): Promise<string | null> => {
    const user = await fetchCurrentUserSnapshot();
    if (!user || user._id !== userId) return null;
    return extractSecret(user);
  };

  const candidate = safeRandomUuid();
  const bootstrapAttempt = await withBootstrapLock(site, userId, async () => {
    const latestUser = await fetchCurrentUserSnapshot();
    if (!latestUser || latestUser._id !== userId) {
      return null;
    }

    const existing = extractSecret(latestUser);
    if (existing) {
      return existing;
    }

    const overrides = asOverridesMap(latestUser.abTestOverrides) || {};
    const merged = { ...overrides, [SYNC_SECRET_KEY]: candidate };

    let responseSecret: unknown;
    try {
      const mutationRes = await queryGraphQL<any>(
        UPDATE_SYNC_SECRET,
        {
          id: userId,
          data: { abTestOverrides: merged },
        },
        {
          operationName: 'UpdateSyncSecret',
        }
      );
      responseSecret = mutationRes?.updateUser?.data?.abTestOverrides?.[SYNC_SECRET_KEY];
    } catch (error) {
      Logger.warn('sync secret bootstrap mutation failed', error);
      return null;
    }
    let adopted = typeof responseSecret === 'string' && responseSecret.length >= 16
      ? responseSecret
      : candidate;

    for (let attempt = 0; attempt < 3; attempt++) {
      const verifySecret = await readAndExtract();
      if (verifySecret && verifySecret === adopted) {
        return adopted;
      }
      if (verifySecret && verifySecret.length >= 16) {
        adopted = verifySecret;
        continue;
      }
      if (attempt < 2) {
        await new Promise((resolve) => window.setTimeout(resolve, 180 + (attempt * 160)));
      }
    }
    return null;
  });

  if (bootstrapAttempt.acquired) {
    return bootstrapAttempt.value || null;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    await new Promise((resolve) => window.setTimeout(resolve, 180 + (attempt * 200)));
    const secret = await readAndExtract();
    if (secret) return secret;
  }
  return null;
}

function applyLocalStateFromMerged(
  mergedRead: Record<string, 1>,
  mergedLoadFrom: string | undefined,
  mergedAuthorEntries: Record<string, AuthorPrefEnvelopeValue>
): boolean {
  let changed = false;
  const currentRead = getReadState();
  if (stableJson(currentRead) !== stableJson(mergedRead)) {
    setReadState(mergedRead, { silent: true });
    changed = true;
  }

  const nextLoadFrom = mergedLoadFrom || '';
  if (getLoadFrom() !== nextLoadFrom) {
    setLoadFrom(nextLoadFrom, { silent: true });
    changed = true;
  }

  const nextPrefs: AuthorPreferences = {};
  for (const [key, value] of Object.entries(mergedAuthorEntries)) {
    nextPrefs[key] = value.v;
  }
  const currentPrefs = getAuthorPreferences();
  if (stableJson(currentPrefs) !== stableJson(nextPrefs)) {
    setAuthorPreferences(nextPrefs, { silent: true });
    changed = true;
  }

  return changed;
}

function compactAuthorPrefsIfNeeded(value: Record<string, AuthorPrefEnvelopeValue>): Record<string, AuthorPrefEnvelopeValue> {
  const entries = Object.entries(value);
  if (entries.length <= AUTHOR_PREF_CAP) return value;

  const toSortableUpdatedAtMs = (updatedAt: string): number => {
    const parsed = Date.parse(updatedAt);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const compareByAgeThenKey = (
    a: [string, AuthorPrefEnvelopeValue],
    b: [string, AuthorPrefEnvelopeValue]
  ): number => {
    const aMs = toSortableUpdatedAtMs(a[1].updatedAt);
    const bMs = toSortableUpdatedAtMs(b[1].updatedAt);
    if (aMs !== bMs) return aMs - bMs;
    return a[0].localeCompare(b[0]);
  };

  const neutral = entries
    .filter(([, entry]) => entry.v === 0)
    .sort(compareByAgeThenKey);

  const nonNeutral = entries
    .filter(([, entry]) => entry.v !== 0)
    .sort(compareByAgeThenKey);

  const keep: Array<[string, AuthorPrefEnvelopeValue]> = [];
  const dropCount = entries.length - AUTHOR_PREF_CAP;
  const dropNeutral = Math.min(dropCount, neutral.length);
  keep.push(...neutral.slice(dropNeutral));
  const remainingDrop = dropCount - dropNeutral;
  keep.push(...nonNeutral.slice(Math.min(remainingDrop, nonNeutral.length)));

  const trimmed: Record<string, AuthorPrefEnvelopeValue> = {};
  for (const [key, entry] of keep) {
    trimmed[key] = entry;
  }
  return trimmed;
}

function mergeReadState(
  localRead: Record<string, 1>,
  remoteRead: Record<string, 1>,
  localEpoch: number,
  remoteEpoch: number
): { value: Record<string, 1>; clearEpoch: number; overflowCleared: boolean } {
  let clearEpoch = Math.max(localEpoch, remoteEpoch);
  const merged: Record<string, 1> = {};

  const localAllowed = localEpoch === clearEpoch;
  const remoteAllowed = remoteEpoch === clearEpoch;
  if (remoteAllowed) {
    for (const [id, v] of Object.entries(remoteRead)) {
      if (v !== 1 || !dynamicReadKeyOk(id)) continue;
      merged[id] = 1;
    }
  }
  if (localAllowed) {
    for (const [id, v] of Object.entries(localRead)) {
      if (v !== 1 || !dynamicReadKeyOk(id)) continue;
      merged[id] = 1;
    }
  }

  const keys = Object.keys(merged);
  if (keys.length > READ_CAP) {
    clearEpoch += 1;
    return { value: {}, clearEpoch, overflowCleared: true };
  }

  return { value: merged, clearEpoch, overflowCleared: false };
}

function mergeAuthorPrefs(
  localPrefs: AuthorPreferences,
  remotePrefs: Record<string, AuthorPrefEnvelopeValue>,
  localClearEpoch: number,
  remoteClearEpoch: number,
  allowLocalMerge: boolean,
  writerId: string,
  timestampIso: string
): { value: Record<string, AuthorPrefEnvelopeValue>; clearEpoch: number } {
  const clearEpoch = Math.max(localClearEpoch, remoteClearEpoch);
  const merged: Record<string, AuthorPrefEnvelopeValue> = {};

  if (remoteClearEpoch === clearEpoch) {
    for (const [key, entry] of Object.entries(remotePrefs)) {
      if (!dynamicAuthorKeyOk(key)) continue;
      merged[key] = entry;
    }
  }

  if (allowLocalMerge && localClearEpoch === clearEpoch) {
    for (const key of Object.keys(localPrefs)) {
      if (!dynamicAuthorKeyOk(key)) continue;
      const localRaw = localPrefs[key];
      const localValue = localRaw === -1 || localRaw === 0 || localRaw === 1 ? localRaw : 0;
      const existing = merged[key];
      if (existing && existing.v === localValue) continue;
      merged[key] = {
        v: localValue,
        version: incrementSyncCounter(existing?.version || 0),
        updatedAt: timestampIso,
        updatedBy: writerId,
      };
    }
  }

  return {
    value: compactAuthorPrefsIfNeeded(merged),
    clearEpoch,
  };
}

function buildEnvelopeFromMerged(
  remote: PRSyncEnvelopeV1,
  merged: {
    read: { value: Record<string, 1>; clearEpoch: number };
    loadFromValue?: string;
    loadFromVersion: number;
    loadFromClearEpoch: number;
    authorPrefs: { value: Record<string, AuthorPrefEnvelopeValue>; clearEpoch: number };
  },
  now: string,
  writerId: string,
  site: SyncSite,
  serverAnchorIso: string | null
): PRSyncEnvelopeV1 {
  const remoteLoadFrom = normalizeLoadFromValue(remote.fields.loadFrom.value);
  const mergedLoadFrom = normalizeLoadFromValue(merged.loadFromValue);
  const loadFromChanged = mergedLoadFrom !== remoteLoadFrom ||
    merged.loadFromVersion !== remote.fields.loadFrom.version ||
    merged.loadFromClearEpoch !== remote.fields.loadFrom.clearEpoch;
  const readChanged = stableJson(remote.fields.read.value) !== stableJson(merged.read.value) ||
    remote.fields.read.clearEpoch !== merged.read.clearEpoch;
  const authorChanged = stableJson(remote.fields.authorPrefs.value) !== stableJson(merged.authorPrefs.value) ||
    remote.fields.authorPrefs.clearEpoch !== merged.authorPrefs.clearEpoch;

  return {
    schemaVersion: 1,
    site,
    lastPushedBy: writerId,
    lastPushedAt: serverAnchorIso || now,
    expiresAt: computeExpiresAt(serverAnchorIso || now),
    fields: {
      read: {
        updatedAt: readChanged ? now : remote.fields.read.updatedAt,
        updatedBy: readChanged ? writerId : remote.fields.read.updatedBy,
        clearEpoch: merged.read.clearEpoch,
        value: merged.read.value,
      },
      loadFrom: {
        updatedAt: loadFromChanged ? now : remote.fields.loadFrom.updatedAt,
        updatedBy: loadFromChanged ? writerId : remote.fields.loadFrom.updatedBy,
        version: merged.loadFromVersion,
        clearEpoch: merged.loadFromClearEpoch,
        ...(mergedLoadFrom ? { value: mergedLoadFrom } : {}),
      },
      authorPrefs: {
        updatedAt: authorChanged ? now : remote.fields.authorPrefs.updatedAt,
        updatedBy: authorChanged ? writerId : remote.fields.authorPrefs.updatedBy,
        clearEpoch: merged.authorPrefs.clearEpoch,
        value: merged.authorPrefs.value,
      },
    },
  };
}

function buildMergedState(remoteEnvelope: PRSyncEnvelopeV1): {
  mergedRead: Record<string, 1>;
  mergedReadEpoch: number;
  mergedLoadFrom?: string;
  mergedLoadVersion: number;
  mergedLoadClearEpoch: number;
  mergedAuthorEntries: Record<string, AuthorPrefEnvelopeValue>;
  mergedAuthorEpoch: number;
} {
  const localRead = getReadState();
  const localLoadFrom = normalizeLoadFromValue(getLoadFrom());
  const localAuthorPrefs = getAuthorPreferences();

  const mergedRead = mergeReadState(
    localRead,
    remoteEnvelope.fields.read.value,
    runtime.meta.readClearEpoch,
    remoteEnvelope.fields.read.clearEpoch
  );
  if (mergedRead.overflowCleared) {
    runtime.readOverflowNoticeUntilMs = nowMs() + READ_OVERFLOW_NOTICE_MS;
  }
  if (mergedRead.clearEpoch > runtime.meta.readClearEpoch && mergedRead.clearEpoch > remoteEnvelope.fields.read.clearEpoch) {
    setDirty('read');
  }

  const mergedLoadClearEpoch = Math.max(runtime.meta.loadFrom.clearEpoch, remoteEnvelope.fields.loadFrom.clearEpoch);
  const canUseLocalLoad = runtime.meta.loadFrom.clearEpoch === mergedLoadClearEpoch;
  const canUseRemoteLoad = remoteEnvelope.fields.loadFrom.clearEpoch === mergedLoadClearEpoch;
  const remoteLoadValue = canUseRemoteLoad ? remoteEnvelope.fields.loadFrom.value : undefined;
  const loadFromValue = resolveLoadFrom(
    canUseLocalLoad ? localLoadFrom : undefined,
    remoteLoadValue
  );
  let loadFromVersion = Math.max(runtime.meta.loadFrom.version, remoteEnvelope.fields.loadFrom.version);
  const normalizedRemoteLoad = normalizeLoadFromValue(remoteEnvelope.fields.loadFrom.value);
  if (runtime.meta.dirty.loadFrom && loadFromValue !== normalizedRemoteLoad) {
    loadFromVersion = incrementSyncCounter(loadFromVersion);
  }

  const mergedAuthor = mergeAuthorPrefs(
    localAuthorPrefs,
    remoteEnvelope.fields.authorPrefs.value,
    runtime.meta.authorPrefsClearEpoch,
    remoteEnvelope.fields.authorPrefs.clearEpoch,
    runtime.meta.dirty.authorPrefs,
    runtime.writerId,
    nowIso()
  );

  return {
    mergedRead: mergedRead.value,
    mergedReadEpoch: mergedRead.clearEpoch,
    mergedLoadFrom: loadFromValue,
    mergedLoadVersion: loadFromVersion,
    mergedLoadClearEpoch,
    mergedAuthorEntries: mergedAuthor.value,
    mergedAuthorEpoch: mergedAuthor.clearEpoch,
  };
}

function loadRemoteOrDefault(remoteResult: Awaited<ReturnType<typeof readEnvelope>>): PRSyncEnvelopeV1 {
  if (remoteResult.kind === 'ok' && remoteResult.envelope) {
    return remoteResult.envelope;
  }
  const baseNow = nowIso();
  return defaultEnvelope(runtime.site, runtime.writerId, baseNow, computeExpiresAt(baseNow));
}

async function writeWithCas(
  remoteResult: Awaited<ReturnType<typeof readEnvelope>>,
  force: boolean,
  expectedResetGeneration?: number
): Promise<boolean> {
  if (!runtime.config || !runtime.syncNode) return false;
  if (runtime.readOnly || runtime.pushDisabled) return false;
  if (!force && !hasAnyDirty()) return false;
  if (expectedResetGeneration !== undefined && runtime.resetGeneration !== expectedResetGeneration) return false;

  let readResult = remoteResult;
  for (let attempt = 0; attempt <= CAS_RETRY_LIMIT; attempt++) {
    const remoteEnvelope = loadRemoteOrDefault(readResult);
    if (remoteEnvelope.schemaVersion !== 1) {
      runtime.readOnly = true;
      Logger.warn('sync read-only: unsupported remote schema');
      return false;
    }

    const merged = buildMergedState(remoteEnvelope);
    const envelopeToWrite = buildEnvelopeFromMerged(
      remoteEnvelope,
      {
        read: { value: merged.mergedRead, clearEpoch: merged.mergedReadEpoch },
        loadFromValue: merged.mergedLoadFrom,
        loadFromVersion: merged.mergedLoadVersion,
        loadFromClearEpoch: merged.mergedLoadClearEpoch,
        authorPrefs: {
          value: merged.mergedAuthorEntries,
          clearEpoch: merged.mergedAuthorEpoch,
        },
      },
      nowIso(),
      runtime.writerId,
      runtime.site,
      runtime.lastServerAnchorIso
    );
    if (expectedResetGeneration !== undefined && runtime.resetGeneration !== expectedResetGeneration) {
      return false;
    }
    if (readResult.kind === 'ok' && !readResult.updateTime) {
      if (attempt >= CAS_RETRY_LIMIT) {
        Logger.warn('sync CAS update token missing after read; retries exhausted');
        return false;
      }
      try {
        readResult = await readEnvelope(runtime.config, runtime.site, runtime.syncNode);
        continue;
      } catch (readError) {
        logBackendError('sync CAS token re-read failed', readError);
        return false;
      }
    }
    const commitOptions = readResult.kind === 'missing'
      ? { createIfMissing: true as const }
      : { expectedUpdateTime: readResult.updateTime as string };

    try {
      const commitResult = await commitEnvelope(
        runtime.config,
        runtime.site,
        runtime.syncNode,
        envelopeToWrite,
        commitOptions
      );

      runtime.updateTimeByNode.set(runtime.syncNode, commitResult.updateTime);
      runtime.lastServerAnchorIso = commitResult.updateTime;
      runtime.lastPushAtMs = nowMs();
      runtime.connectivityBlocked = false;
      if (runtime.userId) {
        writeCrossTabMs(getCrossTabPushKey(runtime.site, runtime.userId), runtime.lastPushAtMs);
      }
      runtime.meta.readClearEpoch = merged.mergedReadEpoch;
      runtime.meta.loadFrom.clearEpoch = merged.mergedLoadClearEpoch;
      runtime.meta.loadFrom.version = merged.mergedLoadVersion;
      runtime.meta.authorPrefsClearEpoch = merged.mergedAuthorEpoch;
      clearDirty();
      clearQuotaIfRecovered();
      noteSuccessfulPushForLocalBudget();
      if (runtime.syncNode) {
        runtime.meta.lastSyncNode = runtime.syncNode;
      }
      persistMeta();
      return true;
    } catch (error) {
      classifyAndSetQuota(error);
      runtime.connectivityBlocked = isConnectivityBlocked(error);
      if (isCreateRace(error)) {
        readResult = await readEnvelope(runtime.config, runtime.site, runtime.syncNode);
        continue;
      }
      if (isUncertainWriteOutcome(error)) {
        if (attempt >= CAS_RETRY_LIMIT) {
          logBackendError('sync uncertain write retries exhausted', error);
          return false;
        }
        await withRetryJitter(attempt);
        try {
          readResult = await readEnvelope(runtime.config, runtime.site, runtime.syncNode);
          continue;
        } catch (readError) {
          logBackendError('sync uncertain write reconcile failed', readError);
          return false;
        }
      }
      if (isCasConflict(error)) {
        if (attempt >= CAS_RETRY_LIMIT) {
          logBackendError('sync CAS retries exhausted', error);
          return false;
        }
        await withRetryJitter(attempt);
        try {
          readResult = await readEnvelope(runtime.config, runtime.site, runtime.syncNode);
          continue;
        } catch (readError) {
          logBackendError('sync CAS re-read failed', readError);
          return false;
        }
      }
      if (isPermissionDenied(error)) {
        runtime.pushDisabled = true;
        logBackendError('sync push permission denied', error);
        return false;
      }
      if (isInvalidArgument(error)) {
        runtime.readOnly = true;
        logBackendError('sync invalid envelope shape', error);
        return false;
      }
      if (isQuotaExceeded(error)) {
        if (runtime.userId) {
          writeCrossTabMs(
            getCrossTabQuotaKey(runtime.site, runtime.userId),
            runtime.meta.quotaDisabledUntilMs || runtime.quotaDisabledUntilMs || 0
          );
        }
        logBackendError('sync quota-limited', error);
        return false;
      }
      logBackendError('sync commit failed', error);
      return false;
    }
  }
  return false;
}

async function performPullAndMerge(): Promise<boolean> {
  if (!runtime.config || !runtime.syncNode) return false;
  if (typeof document !== 'undefined' && document.hidden) return false;
  if (shouldBlockForQuota()) return false;
  if (runtime.pullInFlight) return false;
  const pullGeneration = runtime.resetGeneration;
  runtime.pullInFlight = true;
  try {
    const result = await readEnvelope(runtime.config, runtime.site, runtime.syncNode);
    if (runtime.resetGeneration !== pullGeneration) return false;
    runtime.connectivityBlocked = false;
    if (runtime.userId) {
      const stamp = nowMs();
      runtime.lastPullAtMs = stamp;
      writeCrossTabMs(getCrossTabPullKey(runtime.site, runtime.userId), stamp);
    }

    if (result.kind === 'missing') {
      const fallbackProbeAllowed = !!runtime.userId && runtime.meta.lastUserId === runtime.userId;
      if (!fallbackProbeAllowed && (
        runtime.meta.lastSyncNode ||
        runtime.meta.pendingRemoteReset ||
        runtime.meta.pendingRemoteResetAt ||
        runtime.meta.pendingRemoteResetTargets
      )) {
        clearFallbackAndResetPointers();
        persistMeta();
      }
      if (
        fallbackProbeAllowed &&
        runtime.meta.lastSyncNode &&
        runtime.meta.lastSyncNode !== runtime.syncNode &&
        !runtime.meta.pendingRemoteReset
      ) {
        try {
          const fallback = await readEnvelope(runtime.config, runtime.site, runtime.meta.lastSyncNode);
          if (runtime.resetGeneration !== pullGeneration) return false;
          if (fallback.kind === 'ok') {
            Logger.info('sync fallback probe found historical node', { node: runtime.meta.lastSyncNode.slice(-8) });
          }
        } catch (error) {
          logBackendError('sync fallback probe failed', error);
        }
      }
      return true;
    }

    const remote = result.envelope!;
    if (remote.schemaVersion !== 1) {
      runtime.readOnly = true;
      Logger.warn('sync read-only due to remote schema');
      return false;
    }
    if (runtime.resetGeneration !== pullGeneration) return false;

    runtime.lastServerAnchorIso = result.updateTime || runtime.lastServerAnchorIso;
    const merged = buildMergedState(remote);
    runtime.meta.readClearEpoch = merged.mergedReadEpoch;
    runtime.meta.loadFrom.clearEpoch = merged.mergedLoadClearEpoch;
    runtime.meta.loadFrom.version = Math.max(runtime.meta.loadFrom.version, merged.mergedLoadVersion);
    runtime.meta.authorPrefsClearEpoch = merged.mergedAuthorEpoch;
    const changed = applyLocalStateFromMerged(merged.mergedRead, merged.mergedLoadFrom, merged.mergedAuthorEntries);
    if (runtime.startupDone && changed) {
      runtime.lateSyncAppliedUntilMs = nowMs() + LATE_SYNC_NOTICE_MS;
      Logger.info('Synced state applied');
    }

    if (runtime.syncNode) {
      runtime.meta.lastSyncNode = runtime.syncNode;
    }
    persistMeta();
    return true;
  } catch (error) {
    classifyAndSetQuota(error);
    runtime.connectivityBlocked = isConnectivityBlocked(error);
    if (error instanceof FirestoreBackendError && error.code === 'INVALID_ENVELOPE') {
      runtime.pushDisabled = true;
    }
    if (isPermissionDenied(error)) {
      runtime.pushDisabled = true;
      runtime.readOnly = true;
    }
    logBackendError('sync pull failed', error);
    return false;
  } finally {
    runtime.pullInFlight = false;
    if (runtime.pendingFlush && !runtime.flushInFlight) {
      runtime.pendingFlush = false;
      void flushIfNeeded(false);
    }
  }
}

async function flushIfNeeded(force: boolean): Promise<void> {
  if (!runtime.active || !runtime.config || !runtime.syncNode || !runtime.userId) return;
  if (runtime.flushInFlight) return;
  if (!force && !hasAnyDirty()) return;
  if (!force && typeof document !== 'undefined' && document.hidden) return;
  const flushGeneration = runtime.resetGeneration;
  if (runtime.pullInFlight) {
    runtime.pendingFlush = true;
    return;
  }
  if (runtime.readOnly || runtime.pushDisabled) return;
  if (shouldBlockForQuota()) return;
  if (!force && shouldBlockForLocalBudget()) return;

  const waitMs = computePushFloorWaitMs();
  if (!force && waitMs > 0) {
    scheduleFlush(waitMs, false);
    return;
  }

  runtime.flushInFlight = true;
  try {
    const readResult = await readEnvelope(runtime.config, runtime.site, runtime.syncNode);
    runtime.connectivityBlocked = false;
    if (runtime.resetGeneration !== flushGeneration) return;
    await writeWithCas(readResult, force, flushGeneration);
  } catch (error) {
    runtime.connectivityBlocked = isConnectivityBlocked(error);
    if (error instanceof FirestoreBackendError && error.code === 'INVALID_ENVELOPE') {
      runtime.pushDisabled = true;
    }
    if (!isMissingDocumentError(error)) {
      logBackendError('sync flush read failed', error);
    }
  } finally {
    runtime.flushInFlight = false;
  }
}

function scheduleFlush(delayMs: number = SYNC_DEBOUNCE_MS, enforceMaxWait = false): void {
  let targetDelayMs = Math.max(0, Math.floor(delayMs));
  if (enforceMaxWait && runtime.firstDirtyAtMs !== null) {
    const remainingMaxWait = (runtime.firstDirtyAtMs + SYNC_MAX_WAIT_MS) - nowMs();
    targetDelayMs = Math.min(targetDelayMs, Math.max(0, remainingMaxWait));
  }
  if (runtime.flushTimer !== null) {
    window.clearTimeout(runtime.flushTimer);
  }
  runtime.flushTimer = window.setTimeout(() => {
    runtime.flushTimer = null;
    void flushIfNeeded(false);
  }, targetDelayMs) as unknown as number;
}

async function onLocalFieldChanged(field: SyncableField): Promise<void> {
  if (!runtime.active || runtime.readOnly) return;
  setDirty(field);
  if (hasOnlyReadDirty()) {
    const floorWaitMs = computePushFloorWaitMs();
    if (floorWaitMs > SYNC_DEBOUNCE_MS) {
      scheduleFlush(floorWaitMs, false);
      return;
    }
  }
  scheduleFlush(SYNC_DEBOUNCE_MS, true);
}

function installListeners(): void {
  if (runtime.listenerDisposer) return;
  const disposeFieldListener = onSyncFieldChanged((field) => {
    void onLocalFieldChanged(field);
  });
  const runPeriodicPull = async (): Promise<void> => {
    if (!runtime.active || !runtime.userId || !runtime.syncNode) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const crossTabLastPull = readCrossTabMs(getCrossTabPullKey(runtime.site, runtime.userId));
    const gate = Math.max(runtime.lastPullAtMs, crossTabLastPull) + PULL_FALLBACK_STALE_MS;
    if (gate > nowMs()) return;
    await performPullAndMerge();
    await flushIfNeeded(false);
  };
  const schedulePeriodicPull = (): void => {
    if (runtime.periodicPullTimer !== null) {
      window.clearTimeout(runtime.periodicPullTimer);
    }
    const delayMs = PULL_FALLBACK_BASE_MS + Math.floor(Math.random() * PULL_FALLBACK_JITTER_MS);
    runtime.periodicPullTimer = window.setTimeout(() => {
      runtime.periodicPullTimer = null;
      void runPeriodicPull().finally(() => {
        if (runtime.active) {
          schedulePeriodicPull();
        }
      });
    }, delayMs) as unknown as number;
  };
  const focusListener = () => {
    if (!runtime.active || !runtime.userId || !runtime.syncNode) return;
    const crossTabLastPull = readCrossTabMs(getCrossTabPullKey(runtime.site, runtime.userId));
    const gate = Math.max(runtime.lastPullAtMs, crossTabLastPull) + PULL_THROTTLE_MS;
    if (gate > nowMs()) return;
    void performPullAndMerge().then(() => void flushIfNeeded(false));
  };
  const visibilityListener = () => {
    if (!runtime.active) return;
    if (typeof document !== 'undefined' && document.hidden) {
      void flushIfNeeded(true);
      return;
    }
    void performPullAndMerge().then(() => void flushIfNeeded(false));
  };
  window.addEventListener('focus', focusListener, { passive: true });
  window.addEventListener('visibilitychange', visibilityListener, { passive: true });
  schedulePeriodicPull();
  runtime.listenerDisposer = () => {
    disposeFieldListener();
    window.removeEventListener('focus', focusListener);
    window.removeEventListener('visibilitychange', visibilityListener);
    if (runtime.periodicPullTimer !== null) {
      window.clearTimeout(runtime.periodicPullTimer);
      runtime.periodicPullTimer = null;
    }
  };
}

function normalizeDirtyAfterRecovery(): void {
  if (runtime.meta.version !== 1) {
    runtime.meta = createDefaultMeta();
  }
  const initialDirty = localDataExistsForFirstPush();
  if (!runtime.meta.lastSyncNode && !runtime.meta.pendingRemoteReset && !hasAnyDirty(runtime.meta)) {
    runtime.meta.dirty = initialDirty;
  }
  runtime.firstDirtyAtMs = hasAnyDirty(runtime.meta) ? nowMs() : null;
}

function clearLocalSyncableFieldsForUserSwitch(): void {
  setReadState({}, { silent: true });
  setLoadFrom('', { silent: true });
  setAuthorPreferences({}, { silent: true });
  clearFallbackAndResetPointers();
  runtime.meta.dirty = { read: false, loadFrom: false, authorPrefs: false };
  runtime.firstDirtyAtMs = null;
  runtime.meta.readClearEpoch = 0;
  runtime.meta.loadFrom = { version: 0, clearEpoch: 0 };
  runtime.meta.authorPrefsClearEpoch = 0;
  runtime.readOverflowNoticeUntilMs = 0;
  runtime.updateTimeByNode.clear();
  persistMeta();
}

function clearFallbackAndResetPointers(): void {
  runtime.meta.lastSyncNode = undefined;
  runtime.meta.pendingRemoteReset = false;
  runtime.meta.pendingRemoteResetAt = undefined;
  runtime.meta.pendingRemoteResetTargets = undefined;
}

function markPendingRemoteReset(syncNode: string | null): void {
  runtime.meta.pendingRemoteReset = true;
  runtime.meta.pendingRemoteResetAt = nowIso();
  runtime.meta.pendingRemoteResetTargets = {
    site: runtime.site,
    syncNode: syncNode || undefined,
    userId: runtime.userId || undefined,
    readClearEpoch: runtime.meta.readClearEpoch,
    loadFromClearEpoch: runtime.meta.loadFrom.clearEpoch,
    loadFromVersion: runtime.meta.loadFrom.version,
    authorPrefsClearEpoch: runtime.meta.authorPrefsClearEpoch,
  };
  runtime.meta.dirty.read = true;
  runtime.meta.dirty.loadFrom = true;
  runtime.meta.dirty.authorPrefs = true;
  if (runtime.firstDirtyAtMs === null) {
    runtime.firstDirtyAtMs = nowMs();
  }
  persistMeta();
}

function applyResetLocallyToTargets(targets: {
  readClearEpoch: number;
  loadFromClearEpoch: number;
  loadFromVersion: number;
  authorPrefsClearEpoch: number;
}): void {
  setReadState({}, { silent: true });
  setLoadFrom('', { silent: true });
  setAuthorPreferences({}, { silent: true });
  runtime.meta.readClearEpoch = clampSyncCounter(targets.readClearEpoch, runtime.meta.readClearEpoch);
  runtime.meta.loadFrom.clearEpoch = clampSyncCounter(targets.loadFromClearEpoch, runtime.meta.loadFrom.clearEpoch);
  runtime.meta.loadFrom.version = clampSyncCounter(targets.loadFromVersion, runtime.meta.loadFrom.version);
  runtime.meta.authorPrefsClearEpoch = clampSyncCounter(targets.authorPrefsClearEpoch, runtime.meta.authorPrefsClearEpoch);
  runtime.meta.dirty.read = true;
  runtime.meta.dirty.loadFrom = true;
  runtime.meta.dirty.authorPrefs = true;
  runtime.readOverflowNoticeUntilMs = 0;
  if (runtime.firstDirtyAtMs === null) {
    runtime.firstDirtyAtMs = nowMs();
  }
  persistMeta();
}

function applyResetLocallyAndBumpEpochs(): void {
  applyResetLocallyToTargets({
    readClearEpoch: runtime.meta.readClearEpoch + 1,
    loadFromClearEpoch: runtime.meta.loadFrom.clearEpoch + 1,
    loadFromVersion: incrementSyncCounter(runtime.meta.loadFrom.version),
    authorPrefsClearEpoch: runtime.meta.authorPrefsClearEpoch + 1,
  });
}

async function replayPendingResetIfNeeded(): Promise<void> {
  if (!runtime.meta.pendingRemoteReset) return;
  if (!runtime.config || !runtime.syncNode) return;

  try {
    const remoteResult = await readEnvelope(runtime.config, runtime.site, runtime.syncNode);
    const remoteEnvelope = loadRemoteOrDefault(remoteResult);
    const pendingTargets = runtime.meta.pendingRemoteResetTargets;
    const targetReadClearEpoch = Math.max(
      remoteEnvelope.fields.read.clearEpoch,
      pendingTargets?.readClearEpoch ?? runtime.meta.readClearEpoch
    );
    const targetLoadFromClearEpoch = Math.max(
      remoteEnvelope.fields.loadFrom.clearEpoch,
      pendingTargets?.loadFromClearEpoch ?? runtime.meta.loadFrom.clearEpoch
    );
    const targetLoadFromVersion = Math.max(
      remoteEnvelope.fields.loadFrom.version,
      pendingTargets?.loadFromVersion ?? runtime.meta.loadFrom.version
    );
    const targetAuthorPrefsClearEpoch = Math.max(
      remoteEnvelope.fields.authorPrefs.clearEpoch,
      pendingTargets?.authorPrefsClearEpoch ?? runtime.meta.authorPrefsClearEpoch
    );

    runtime.meta.pendingRemoteResetTargets = {
      site: runtime.site,
      syncNode: runtime.syncNode,
      userId: runtime.userId || undefined,
      readClearEpoch: targetReadClearEpoch,
      loadFromClearEpoch: targetLoadFromClearEpoch,
      loadFromVersion: targetLoadFromVersion,
      authorPrefsClearEpoch: targetAuthorPrefsClearEpoch,
    };
    applyResetLocallyToTargets({
      readClearEpoch: targetReadClearEpoch,
      loadFromClearEpoch: targetLoadFromClearEpoch,
      loadFromVersion: targetLoadFromVersion,
      authorPrefsClearEpoch: targetAuthorPrefsClearEpoch,
    });
    const wrote = await writeWithCas(remoteResult, true, runtime.resetGeneration);
    if (wrote) {
      runtime.meta.pendingRemoteReset = false;
      runtime.meta.pendingRemoteResetAt = undefined;
      runtime.meta.pendingRemoteResetTargets = undefined;
      persistMeta();
    }
  } catch (error) {
    logBackendError('sync pending reset replay failed', error);
  }
}

export async function runPersistenceResetFlow(): Promise<void> {
  runtime.site = computeSite();
  runtime.meta = normalizeMeta(getSyncMeta());
  runtime.localBudgetMeta = normalizeQuotaMeta(getSyncQuotaMeta());
  runtime.config = getFirestoreBackendConfig();
  const currentUserResult = await fetchCurrentUserSnapshotWithDetails();
  runtime.identityPermissionDenied =
    currentUserResult.kind === 'resolved' && currentUserResult.abTestOverridesPermissionDenied;
  runtime.currentUser = currentUserResult.kind === 'resolved' ? currentUserResult.currentUser : null;
  runtime.userId = typeof runtime.currentUser?._id === 'string' ? runtime.currentUser._id : null;
  runtime.writerId = makeWriterId();
  runtime.resetGeneration += 1;

  applyResetLocallyAndBumpEpochs();

  if (!runtime.userId || !runtime.config || runtime.identityPermissionDenied) {
    runtime.secretUnavailable = runtime.identityPermissionDenied;
    markPendingRemoteReset(null);
    return;
  }

  let secret = extractSecret(runtime.currentUser);
  if (!secret) {
    secret = await bootstrapSyncSecret(runtime.site, runtime.userId);
  }
  if (!secret) {
    runtime.secretUnavailable = true;
    markPendingRemoteReset(null);
    return;
  }

  runtime.secretUnavailable = false;
  runtime.secret = secret;
  runtime.syncNode = await deriveSyncNode(runtime.site, runtime.userId, secret);
  markPendingRemoteReset(runtime.syncNode);
  await replayPendingResetIfNeeded();
}

function canRunSync(): boolean {
  if (!getSyncEnabled()) return false;
  if (!runtime.config) return false;
  return true;
}

async function startupEngine(): Promise<void> {
  if (!runtime.syncNode || !runtime.userId) return;
  await replayPendingResetIfNeeded();
  await performPullAndMerge();
  if (hasAnyDirty()) {
    await flushIfNeeded(false);
  }
}

export async function initPersistenceSync(
  options: PersistenceSyncInitOptions
): Promise<PersistenceSyncInitResult> {
  const isTestMode = (window as any).__PR_TEST_MODE__ === true;
  if (isTestMode) {
    runtime.active = false;
    runtime.config = null;
    runtime.currentUser = null;
    runtime.userId = null;
    runtime.syncNode = null;
    runtime.secret = null;
    runtime.secretUnavailable = false;
    runtime.identityPermissionDenied = false;
    runtime.connectivityBlocked = false;
    runtime.localBudgetMeta = createDefaultQuotaMeta();
    runtime.resetGeneration = 0;
    runtime.startupDone = false;
    runtime.startupTimedOut = false;
    runtime.firstDirtyAtMs = null;
    runtime.readOverflowNoticeUntilMs = 0;
    return {
      resetHandled: options.isResetRoute,
      // In tests, let loader fetch currentUser from mocked GraphQL so
      // user-aware UI behavior (reply-to-you/status/voting) stays realistic.
      currentUserSnapshot: undefined,
    };
  }

  runtime.site = computeSite();
  runtime.meta = normalizeMeta(getSyncMeta());
  runtime.config = getFirestoreBackendConfig();
  runtime.active = false;
  runtime.readOnly = false;
  runtime.pushDisabled = false;
  runtime.syncNode = null;
  runtime.secret = null;
  runtime.secretUnavailable = false;
  runtime.identityPermissionDenied = false;
  runtime.connectivityBlocked = false;
  runtime.lateSyncAppliedUntilMs = 0;
  runtime.resetGeneration = 0;
  runtime.startupDone = false;
  runtime.startupTimedOut = false;
  runtime.readOverflowNoticeUntilMs = 0;
  runtime.currentUser = null;
  runtime.userId = null;
  runtime.writerId = makeWriterId();
  runtime.localBudgetMeta = normalizeQuotaMeta(getSyncQuotaMeta());
  normalizeDailyBudgetRollover();

  normalizeDirtyAfterRecovery();
  persistMeta();

  const currentUserResult = await fetchCurrentUserSnapshotWithDetails();
  const identityResolved = currentUserResult.kind === 'resolved';
  const currentUserSnapshot = identityResolved ? currentUserResult.currentUser : undefined;
  runtime.identityPermissionDenied =
    identityResolved && currentUserResult.abTestOverridesPermissionDenied;
  runtime.currentUser = identityResolved ? currentUserResult.currentUser : null;
  runtime.userId = identityResolved && typeof currentUserResult.currentUser?._id === 'string'
    ? currentUserResult.currentUser._id
    : null;

  if (options.isResetRoute) {
    await runPersistenceResetFlow();
    return {
      resetHandled: true,
      ...(identityResolved ? { currentUserSnapshot } : {}),
    };
  }

  if (!identityResolved) {
    runtime.active = false;
    return {
      resetHandled: false,
    };
  }

  if (!runtime.userId) {
    runtime.active = false;
    return {
      resetHandled: false,
      currentUserSnapshot,
    };
  }

  if (runtime.meta.lastUserId !== runtime.userId && (
    runtime.meta.lastSyncNode ||
    runtime.meta.pendingRemoteReset ||
    runtime.meta.pendingRemoteResetAt ||
    runtime.meta.pendingRemoteResetTargets
  )) {
    clearFallbackAndResetPointers();
    persistMeta();
  }

  if (runtime.meta.lastUserId && runtime.meta.lastUserId !== runtime.userId) {
    clearLocalSyncableFieldsForUserSwitch();
  }
  runtime.meta.lastUserId = runtime.userId;
  persistMeta();

  if (runtime.identityPermissionDenied) {
    runtime.active = false;
    runtime.secretUnavailable = true;
    return {
      resetHandled: false,
      currentUserSnapshot,
    };
  }

  if (!canRunSync()) {
    runtime.active = false;
    return {
      resetHandled: false,
      currentUserSnapshot,
    };
  }

  let secret = extractSecret(runtime.currentUser);
  if (!secret) {
    secret = await bootstrapSyncSecret(runtime.site, runtime.userId);
  }
  if (!secret) {
    runtime.active = false;
    runtime.secretUnavailable = true;
    if (runtime.meta.pendingRemoteReset) {
      Logger.warn('sync reset pending: identity secret unavailable');
    }
    return {
      resetHandled: false,
      currentUserSnapshot,
    };
  }

  runtime.secret = secret;
  runtime.secretUnavailable = false;
  runtime.syncNode = await deriveSyncNode(runtime.site, runtime.userId, secret);
  runtime.active = true;
  installListeners();

  const startup = startupEngine();
  const startupOutcome = await Promise.race([
    startup.then(() => 'done' as const),
    new Promise<'timeout'>((resolve) => window.setTimeout(() => resolve('timeout'), SYNC_STARTUP_TIMEOUT_MS)),
  ]);
  runtime.startupTimedOut = startupOutcome === 'timeout';
  if (runtime.startupTimedOut) {
    void startup.finally(() => {
      runtime.startupTimedOut = false;
    });
  }
  runtime.startupDone = true;

  return {
    resetHandled: false,
    currentUserSnapshot,
  };
}

export function shutdownPersistenceSync(): void {
  runtime.active = false;
  if (runtime.flushTimer !== null) {
    window.clearTimeout(runtime.flushTimer);
    runtime.flushTimer = null;
  }
  if (runtime.periodicPullTimer !== null) {
    window.clearTimeout(runtime.periodicPullTimer);
    runtime.periodicPullTimer = null;
  }
  if (runtime.listenerDisposer) {
    runtime.listenerDisposer();
    runtime.listenerDisposer = null;
  }
}

export function getSyncStatusLineText(): string {
  const showReadOverflowNotice = runtime.readOverflowNoticeUntilMs > nowMs();
  if (!getSyncEnabled()) return 'Sync: off';
  if (!runtime.config) return 'Sync: unconfigured';
  if (runtime.connectivityBlocked) return 'Sync: blocked by userscript permissions/connectivity';
  if (runtime.identityPermissionDenied) return 'Sync: unavailable (identity permission)';
  if (!runtime.userId) return 'Sync: anonymous';
  if (runtime.meta.pendingRemoteReset) {
    if (runtime.secretUnavailable) {
      return 'Sync: reset pending (secret unavailable)';
    }
    return 'Sync: reset pending';
  }
  if (runtime.secretUnavailable) return 'Sync: unavailable';
  if (runtime.meta.quotaMode === 'quota_limited') {
    const untilMs = runtime.meta.quotaDisabledUntilMs || runtime.quotaDisabledUntilMs || 0;
    const remainingMin = Math.max(1, Math.ceil((untilMs - nowMs()) / 60_000));
    return `Sync: quota-limited (retry in ${remainingMin}m)`;
  }
  if (runtime.startupTimedOut) return 'Sync: syncing...';
  if (isLocalBudgetLimitedNow() || runtime.localBudgetMeta.pushCount >= LOCAL_PUSH_SOFT_LIMIT) {
    const untilMs = runtime.localBudgetMeta.budgetDisabledUntilMs || 0;
    if (untilMs > nowMs()) {
      const remainingMin = Math.max(1, Math.ceil((untilMs - nowMs()) / 60_000));
      return `Sync: local budget-limited (retry in ${remainingMin}m)`;
    }
    return 'Sync: local budget-limited';
  }
  if (runtime.lateSyncAppliedUntilMs > nowMs()) return 'Sync: synced state applied';
  if (runtime.readOnly) return 'Sync: read-only';
  if (runtime.pushDisabled) return 'Sync: push-disabled';
  if (!runtime.active) return 'Sync: local-only';
  if (hasAnyDirty()) {
    return showReadOverflowNotice ? 'Sync: syncing... (read overflow cleared)' : 'Sync: syncing...';
  }
  if (showReadOverflowNotice) return 'Sync: on (read overflow cleared)';
  return 'Sync: on';
}

export function forceSyncFlushForDebug(): void {
  void flushIfNeeded(true);
}

export function getCurrentSyncNodeSuffix(): string | null {
  if (!runtime.syncNode) return null;
  return runtime.syncNode.slice(-8);
}

export function getCurrentSyncPath(): string | null {
  if (!runtime.syncNode) return null;
  return buildFirestorePath(runtime.site, runtime.syncNode);
}

export function isSyncConfigured(): boolean {
  return !!runtime.config;
}

export function setRuntimeFirebaseConfigForTests(config: {
  projectId?: string;
  apiKey?: string;
  host?: string;
}): void {
  setFirestoreBackendConfigForTests(config);
}

export function getPersistedSyncToggle(): boolean {
  return getSyncEnabled();
}

export function setPersistedSyncToggle(enabled: boolean): void {
  setSyncEnabled(enabled);
}

export function getSyncDebugSnapshot(): Record<string, unknown> {
  return {
    active: runtime.active,
    site: runtime.site,
    userId: runtime.userId,
    syncNodeSuffix: runtime.syncNode?.slice(-8),
    readOnly: runtime.readOnly,
    pushDisabled: runtime.pushDisabled,
    pendingRemoteReset: runtime.meta.pendingRemoteReset,
    pendingRemoteResetTargets: runtime.meta.pendingRemoteResetTargets,
    dirty: runtime.meta.dirty,
    lastSyncNodeSuffix: runtime.meta.lastSyncNode?.slice(-8),
    lastServerAnchorIso: runtime.lastServerAnchorIso,
    connectivityBlocked: runtime.connectivityBlocked,
    secretUnavailable: runtime.secretUnavailable,
    identityPermissionDenied: runtime.identityPermissionDenied,
    startupTimedOut: runtime.startupTimedOut,
    readOverflowNoticeUntilMs: runtime.readOverflowNoticeUntilMs,
    localBudget: runtime.localBudgetMeta,
  };
}

export function isConnectivityBlocked(error: unknown): boolean {
  return error instanceof FirestoreBackendError &&
    (error.status === 0 || /timed out|network/i.test(error.message));
}
