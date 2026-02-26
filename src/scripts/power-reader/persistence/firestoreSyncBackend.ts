import { Logger } from '../utils/logger';

declare const __PR_FIRESTORE_PROJECT_ID__: string;
declare const __PR_FIRESTORE_API_KEY__: string;
declare const __PR_FIRESTORE_HOST__: string;

declare const GM_xmlhttpRequest: (options: {
  method: 'GET' | 'POST';
  url: string;
  headers?: Record<string, string>;
  data?: string;
  timeout?: number;
  onload?: (response: { status: number; responseText: string }) => void;
  onerror?: (error: any) => void;
  ontimeout?: () => void;
}) => void;

export type SyncSite = 'lw' | 'eaf';

export interface AuthorPrefEnvelopeValue {
  v: -1 | 0 | 1;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface PRSyncEnvelopeV1 {
  schemaVersion: 1;
  site: SyncSite;
  lastPushedBy: string;
  lastPushedAt: string;
  lastPushedAtMs?: number;
  expiresAt: string;
  fields: {
    read: {
      updatedAt: string;
      updatedBy: string;
      clearEpoch: number;
      value: Record<string, 1>;
    };
    loadFrom: {
      updatedAt: string;
      updatedBy: string;
      version: number;
      clearEpoch: number;
      value?: '__LOAD_RECENT__' | string;
    };
    authorPrefs: {
      updatedAt: string;
      updatedBy: string;
      clearEpoch: number;
      value: Record<string, AuthorPrefEnvelopeValue>;
    };
  };
}

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { timestampValue: string }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

type FirestoreDoc = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
  updateTime?: string;
};

type FirestoreCommitResponse = {
  writeResults?: Array<{ updateTime?: string }>;
};

export interface FirestoreBackendConfig {
  projectId: string;
  apiKey: string;
  host?: string;
}

export interface FirestoreReadResult {
  kind: 'ok' | 'missing';
  envelope?: PRSyncEnvelopeV1;
  updateTime?: string;
}

export type FirestoreCommitOptions =
  | {
    createIfMissing: true;
    timeoutMs?: number;
  }
  | {
    expectedUpdateTime: string;
    createIfMissing?: false;
    timeoutMs?: number;
  };

export class FirestoreBackendError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;
  public readonly transient: boolean;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
    transient = false
  ) {
    super(message);
    this.name = 'FirestoreBackendError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.transient = transient;
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_HOST = 'firestore.googleapis.com';
const MAX_SYNC_COUNTER = 1_000_000_000;
const MAX_EPOCH_MS = 253_402_300_799_999;
const MAX_WRITER_LABEL_LENGTH = 128;

let testConfigOverride: FirestoreBackendConfig | null = null;

const isInteger = (value: number): boolean => Number.isFinite(value) && Math.floor(value) === value;

const requireInteger = (value: number, label: string): number => {
  if (!isInteger(value)) {
    throw new Error(`invalid integer for ${label}`);
  }
  return value;
};

const asMap = (value: FirestoreValue | undefined, label: string): Record<string, FirestoreValue> => {
  if (!value || !('mapValue' in value)) {
    throw new Error(`missing map value: ${label}`);
  }
  return value.mapValue.fields || {};
};

const asString = (value: FirestoreValue | undefined, label: string): string => {
  if (!value || !('stringValue' in value)) {
    throw new Error(`missing string value: ${label}`);
  }
  return value.stringValue;
};

const asTimestamp = (value: FirestoreValue | undefined, label: string): string => {
  if (!value || !('timestampValue' in value)) {
    throw new Error(`missing timestamp value: ${label}`);
  }
  return value.timestampValue;
};

const asInteger = (value: FirestoreValue | undefined, label: string): number => {
  if (!value || !('integerValue' in value)) {
    throw new Error(`missing integer value: ${label}`);
  }
  const parsed = Number.parseInt(value.integerValue, 10);
  if (!isInteger(parsed)) {
    throw new Error(`invalid integer value: ${label}`);
  }
  return parsed;
};

const asOptionalInteger = (value: FirestoreValue | undefined, label: string): number | undefined => {
  if (!value) return undefined;
  return asInteger(value, label);
};

const assertSaneCounter = (value: number, label: string): number => {
  if (!isInteger(value) || value < 0 || value > MAX_SYNC_COUNTER) {
    throw new Error(`out-of-range integer for ${label}`);
  }
  return value;
};

const assertEpochMs = (value: number, label: string): number => {
  if (!isInteger(value) || value < 0 || value > MAX_EPOCH_MS) {
    throw new Error(`out-of-range epoch ms for ${label}`);
  }
  return value;
};

const fvString = (value: string): FirestoreValue => ({ stringValue: value });
const fvInteger = (value: number): FirestoreValue => ({ integerValue: String(requireInteger(value, 'integerValue')) });
const fvTimestamp = (value: string): FirestoreValue => ({ timestampValue: value });
const fvMap = (fields: Record<string, FirestoreValue>): FirestoreValue => ({ mapValue: { fields } });

export const buildFirestorePath = (site: SyncSite, syncNode: string): string =>
  `pr_sync_v1/${site}/nodes/${syncNode}`;

const getHostBaseUrl = (config: FirestoreBackendConfig): string => {
  const rawHost = String(config.host || DEFAULT_HOST).trim();
  if (/^https?:\/\//i.test(rawHost)) {
    return rawHost.replace(/\/+$/, '');
  }
  return `https://${rawHost}`;
};

const buildDocumentUrl = (config: FirestoreBackendConfig, site: SyncSite, syncNode: string): string =>
  `${getHostBaseUrl(config)}/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents/${buildFirestorePath(site, syncNode)}?key=${encodeURIComponent(config.apiKey)}`;

const buildCommitUrl = (config: FirestoreBackendConfig): string =>
  `${getHostBaseUrl(config)}/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents:commit?key=${encodeURIComponent(config.apiKey)}`;

const buildDocumentName = (config: FirestoreBackendConfig, site: SyncSite, syncNode: string): string =>
  `projects/${config.projectId}/databases/(default)/documents/${buildFirestorePath(site, syncNode)}`;

const request = async (
  method: 'GET' | 'POST',
  url: string,
  body?: unknown,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<{ status: number; responseText: string }> =>
  new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    GM_xmlhttpRequest({
      method,
      url,
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      data: payload,
      timeout: timeoutMs,
      onload: (response) => resolve(response),
      onerror: (error) => reject(new FirestoreBackendError('network error', 0, undefined, error, true)),
      ontimeout: () => reject(new FirestoreBackendError('request timed out', 0, 'TIMEOUT', undefined, true)),
    });
  });

const parseJson = <T>(raw: string): T | null => {
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const toBackendError = (status: number, responseText: string): FirestoreBackendError => {
  const parsed = parseJson<{ error?: { status?: string; message?: string } }>(responseText);
  const code = parsed?.error?.status;
  const message = parsed?.error?.message || `HTTP ${status}`;
  const transient = status === 429 || status >= 500 || code === 'RESOURCE_EXHAUSTED';
  return new FirestoreBackendError(message, status, code, parsed, transient);
};

export const isCasConflict = (error: unknown): boolean => {
  if (!(error instanceof FirestoreBackendError)) return false;
  if (error.code === 'ABORTED' || error.code === 'FAILED_PRECONDITION') return true;
  if (error.status === 409 || error.status === 412) return true;
  if (error.status === 400 && typeof error.message === 'string' && /precondition/i.test(error.message)) {
    return true;
  }
  return false;
};

export const isCreateRace = (error: unknown): boolean =>
  error instanceof FirestoreBackendError && error.status === 409 && error.code === 'ALREADY_EXISTS';

export const isMissingDocumentError = (error: unknown): boolean =>
  error instanceof FirestoreBackendError && (
    error.status === 404 ||
    error.code === 'NOT_FOUND'
  );

export const isPermissionDenied = (error: unknown): boolean =>
  error instanceof FirestoreBackendError && (
    error.status === 403 ||
    error.code === 'PERMISSION_DENIED'
  );

export const isInvalidArgument = (error: unknown): boolean =>
  error instanceof FirestoreBackendError && (
    error.status === 400 ||
    error.code === 'INVALID_ARGUMENT'
  );

export const isQuotaExceeded = (error: unknown): boolean => {
  if (!(error instanceof FirestoreBackendError)) return false;
  if (error.status === 429) return true;
  if (error.code === 'RESOURCE_EXHAUSTED') return true;
  return typeof error.message === 'string' && /quota|resource exhausted/i.test(error.message);
};

export const isUncertainWriteOutcome = (error: unknown): boolean =>
  error instanceof FirestoreBackendError && error.code === 'UNCERTAIN_WRITE_OUTCOME';

const decodeEnvelope = (doc: FirestoreDoc): PRSyncEnvelopeV1 => {
  const fields = doc.fields || {};

  const schemaVersion = asInteger(fields.schemaVersion, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new Error(`unsupported schemaVersion: ${schemaVersion}`);
  }

  const site = asString(fields.site, 'site');
  if (site !== 'lw' && site !== 'eaf') {
    throw new Error(`invalid site in envelope: ${site}`);
  }

  const outerFields = asMap(fields.fields, 'fields');
  const readField = asMap(outerFields.read, 'fields.read');
  const loadFromField = asMap(outerFields.loadFrom, 'fields.loadFrom');
  const authorPrefsField = asMap(outerFields.authorPrefs, 'fields.authorPrefs');

  const readValueRaw = asMap(readField.value, 'fields.read.value');
  const readValue: Record<string, 1> = {};
  for (const [key, value] of Object.entries(readValueRaw)) {
    if (!/^[A-Za-z0-9:_-]{1,256}$/.test(key)) continue;
    if (!('integerValue' in value) || value.integerValue !== '1') continue;
    readValue[key] = 1;
  }

  const authorPrefValueRaw = asMap(authorPrefsField.value, 'fields.authorPrefs.value');
  const authorPrefValue: Record<string, AuthorPrefEnvelopeValue> = {};
  for (const [key, rawValue] of Object.entries(authorPrefValueRaw)) {
    if (!/^[A-Za-z0-9 ._,'/:;-]{1,128}$/.test(key)) continue;
    try {
      const entry = asMap(rawValue, `fields.authorPrefs.value.${key}`);
      const v = asInteger(entry.v, `fields.authorPrefs.value.${key}.v`);
      if (v !== -1 && v !== 0 && v !== 1) continue;
      const updatedBy = asString(entry.updatedBy, `fields.authorPrefs.value.${key}.updatedBy`);
      if (updatedBy.length === 0 || updatedBy.length > MAX_WRITER_LABEL_LENGTH) continue;
      authorPrefValue[key] = {
        v,
        version: assertSaneCounter(asInteger(entry.version, `fields.authorPrefs.value.${key}.version`), `fields.authorPrefs.value.${key}.version`),
        updatedAt: asTimestamp(entry.updatedAt, `fields.authorPrefs.value.${key}.updatedAt`),
        updatedBy,
      };
    } catch {
      // Skip malformed dynamic entries instead of rejecting the whole envelope.
      continue;
    }
  }

  const loadFromValue = loadFromField.value && 'stringValue' in loadFromField.value
    ? loadFromField.value.stringValue
    : undefined;

  return {
    schemaVersion: 1,
    site,
    lastPushedBy: asString(fields.lastPushedBy, 'lastPushedBy'),
    lastPushedAt: asTimestamp(fields.lastPushedAt, 'lastPushedAt'),
    lastPushedAtMs: (() => {
      const ms = asOptionalInteger(fields.lastPushedAtMs, 'lastPushedAtMs');
      if (ms === undefined) return undefined;
      return assertEpochMs(ms, 'lastPushedAtMs');
    })(),
    expiresAt: asTimestamp(fields.expiresAt, 'expiresAt'),
    fields: {
      read: {
        updatedAt: asTimestamp(readField.updatedAt, 'fields.read.updatedAt'),
        updatedBy: asString(readField.updatedBy, 'fields.read.updatedBy'),
        clearEpoch: assertSaneCounter(asInteger(readField.clearEpoch, 'fields.read.clearEpoch'), 'fields.read.clearEpoch'),
        value: readValue,
      },
      loadFrom: {
        updatedAt: asTimestamp(loadFromField.updatedAt, 'fields.loadFrom.updatedAt'),
        updatedBy: asString(loadFromField.updatedBy, 'fields.loadFrom.updatedBy'),
        version: assertSaneCounter(asInteger(loadFromField.version, 'fields.loadFrom.version'), 'fields.loadFrom.version'),
        clearEpoch: assertSaneCounter(asInteger(loadFromField.clearEpoch, 'fields.loadFrom.clearEpoch'), 'fields.loadFrom.clearEpoch'),
        ...(loadFromValue ? { value: loadFromValue as '__LOAD_RECENT__' | string } : {}),
      },
      authorPrefs: {
        updatedAt: asTimestamp(authorPrefsField.updatedAt, 'fields.authorPrefs.updatedAt'),
        updatedBy: asString(authorPrefsField.updatedBy, 'fields.authorPrefs.updatedBy'),
        clearEpoch: assertSaneCounter(asInteger(authorPrefsField.clearEpoch, 'fields.authorPrefs.clearEpoch'), 'fields.authorPrefs.clearEpoch'),
        value: authorPrefValue,
      },
    },
  };
};

const encodeEnvelope = (envelope: PRSyncEnvelopeV1): Record<string, FirestoreValue> => {
  const readMapFields: Record<string, FirestoreValue> = {};
  for (const [id, v] of Object.entries(envelope.fields.read.value)) {
    if (v !== 1) continue;
    readMapFields[id] = fvInteger(1);
  }

  const authorMapFields: Record<string, FirestoreValue> = {};
  for (const [author, entry] of Object.entries(envelope.fields.authorPrefs.value)) {
    if (entry.v !== -1 && entry.v !== 0 && entry.v !== 1) continue;
    authorMapFields[author] = fvMap({
      v: fvInteger(entry.v),
      version: fvInteger(entry.version),
      updatedAt: fvTimestamp(entry.updatedAt),
      updatedBy: fvString(entry.updatedBy),
    });
  }

  const loadFromFields: Record<string, FirestoreValue> = {
    updatedAt: fvTimestamp(envelope.fields.loadFrom.updatedAt),
    updatedBy: fvString(envelope.fields.loadFrom.updatedBy),
    version: fvInteger(envelope.fields.loadFrom.version),
    clearEpoch: fvInteger(envelope.fields.loadFrom.clearEpoch),
  };
  if (envelope.fields.loadFrom.value) {
    loadFromFields.value = fvString(envelope.fields.loadFrom.value);
  }

  const topLevelFields: Record<string, FirestoreValue> = {
    schemaVersion: fvInteger(1),
    site: fvString(envelope.site),
    lastPushedBy: fvString(envelope.lastPushedBy),
    lastPushedAt: fvTimestamp(envelope.lastPushedAt),
    expiresAt: fvTimestamp(envelope.expiresAt),
    fields: fvMap({
      read: fvMap({
        updatedAt: fvTimestamp(envelope.fields.read.updatedAt),
        updatedBy: fvString(envelope.fields.read.updatedBy),
        clearEpoch: fvInteger(envelope.fields.read.clearEpoch),
        value: fvMap(readMapFields),
      }),
      loadFrom: fvMap(loadFromFields),
      authorPrefs: fvMap({
        updatedAt: fvTimestamp(envelope.fields.authorPrefs.updatedAt),
        updatedBy: fvString(envelope.fields.authorPrefs.updatedBy),
        clearEpoch: fvInteger(envelope.fields.authorPrefs.clearEpoch),
        value: fvMap(authorMapFields),
      }),
    }),
  };
  if (envelope.lastPushedAtMs !== undefined) {
    topLevelFields.lastPushedAtMs = fvInteger(assertEpochMs(envelope.lastPushedAtMs, 'lastPushedAtMs'));
  }
  return topLevelFields;
};

const assertSingleWriteCommitPayload = (payload: any): void => {
  if (!payload || !Array.isArray(payload.writes) || payload.writes.length !== 1) {
    throw new Error('commit payload must contain exactly one write');
  }
  const write = payload.writes[0];
  if (!write?.update || !write?.currentDocument) {
    throw new Error('commit payload must contain an update write and currentDocument precondition');
  }
  const hasUpdateTime = typeof write.currentDocument.updateTime === 'string' && write.currentDocument.updateTime.length > 0;
  const hasExists = typeof write.currentDocument.exists === 'boolean';
  if (!hasUpdateTime && !hasExists) {
    throw new Error('commit payload must include currentDocument.updateTime or currentDocument.exists');
  }
};

export const readEnvelope = async (
  config: FirestoreBackendConfig,
  site: SyncSite,
  syncNode: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<FirestoreReadResult> => {
  const url = buildDocumentUrl(config, site, syncNode);
  const response = await request('GET', url, undefined, timeoutMs);
  if (response.status === 404) {
    return { kind: 'missing' };
  }
  if (response.status < 200 || response.status >= 300) {
    throw toBackendError(response.status, response.responseText);
  }

  const doc = parseJson<FirestoreDoc>(response.responseText);
  if (!doc) {
    throw new FirestoreBackendError('invalid Firestore read response', response.status, 'INVALID_RESPONSE');
  }

  try {
    const envelope = decodeEnvelope(doc);
    return {
      kind: 'ok',
      envelope,
      updateTime: doc.updateTime,
    };
  } catch (error) {
    throw new FirestoreBackendError(
      error instanceof Error ? error.message : 'invalid envelope',
      response.status,
      'INVALID_ENVELOPE',
      doc
    );
  }
};

export const commitEnvelope = async (
  config: FirestoreBackendConfig,
  site: SyncSite,
  syncNode: string,
  envelope: PRSyncEnvelopeV1,
  options: FirestoreCommitOptions
): Promise<{ updateTime: string }> => {
  const docName = buildDocumentName(config, site, syncNode);
  const isCreateIfMissing = 'createIfMissing' in options && options.createIfMissing === true;
  const updateTimeToken = ('expectedUpdateTime' in options) && typeof options.expectedUpdateTime === 'string'
    ? options.expectedUpdateTime.trim()
    : '';
  if (!isCreateIfMissing && !updateTimeToken) {
    throw new FirestoreBackendError(
      'CAS update requires expectedUpdateTime; call readEnvelope first',
      0,
      'INVALID_COMMIT_OPTIONS'
    );
  }
  const payload = {
    writes: [
      {
        update: {
          name: docName,
          fields: encodeEnvelope(envelope),
        },
        updateTransforms: [
          {
            fieldPath: 'lastPushedAt',
            setToServerValue: 'REQUEST_TIME',
          },
        ],
        currentDocument: isCreateIfMissing
          ? { exists: false }
          : { updateTime: updateTimeToken },
      },
    ],
  };

  assertSingleWriteCommitPayload(payload);
  const response = await request('POST', buildCommitUrl(config), payload, options.timeoutMs || DEFAULT_TIMEOUT_MS);
  if (response.status < 200 || response.status >= 300) {
    throw toBackendError(response.status, response.responseText);
  }

  const parsed = parseJson<FirestoreCommitResponse>(response.responseText);
  const updateTime = parsed?.writeResults?.[0]?.updateTime;
  if (!updateTime) {
    throw new FirestoreBackendError(
      'missing commit updateTime',
      response.status,
      'UNCERTAIN_WRITE_OUTCOME',
      parsed,
      true
    );
  }
  return { updateTime };
};

export const withRetryJitter = async (attempt: number): Promise<void> => {
  const base = Math.min(1200, 120 + (attempt * 170));
  const jitter = Math.floor(Math.random() * 90);
  await new Promise((resolve) => window.setTimeout(resolve, base + jitter));
};

export const updateTimeToEpochMs = (updateTime: string): number | undefined => {
  if (!updateTime) return undefined;
  const ms = Date.parse(updateTime);
  return Number.isFinite(ms) ? ms : undefined;
};

export const defaultEnvelope = (
  site: SyncSite,
  writerId: string,
  nowIso: string,
  expiresAtIso: string
): PRSyncEnvelopeV1 => ({
  schemaVersion: 1,
  site,
  lastPushedBy: writerId,
  lastPushedAt: nowIso,
  expiresAt: expiresAtIso,
  fields: {
    read: {
      updatedAt: nowIso,
      updatedBy: writerId,
      clearEpoch: 0,
      value: {},
    },
    loadFrom: {
      updatedAt: nowIso,
      updatedBy: writerId,
      version: 0,
      clearEpoch: 0,
    },
    authorPrefs: {
      updatedAt: nowIso,
      updatedBy: writerId,
      clearEpoch: 0,
      value: {},
    },
  },
});

export const getFirestoreBackendConfig = (): FirestoreBackendConfig | null => {
  if (testConfigOverride) return { ...testConfigOverride };
  const projectId = typeof __PR_FIRESTORE_PROJECT_ID__ === 'string'
    ? __PR_FIRESTORE_PROJECT_ID__.trim()
    : '';
  const apiKey = typeof __PR_FIRESTORE_API_KEY__ === 'string'
    ? __PR_FIRESTORE_API_KEY__.trim()
    : '';
  const host = typeof __PR_FIRESTORE_HOST__ === 'string'
    ? __PR_FIRESTORE_HOST__.trim()
    : '';
  if (!projectId || !apiKey) {
    return null;
  }
  return {
    projectId,
    apiKey,
    host: host || undefined,
  };
};

export const setFirestoreBackendConfigForTests = (config: {
  projectId?: string;
  apiKey?: string;
  host?: string;
}): void => {
  const projectId = String(config.projectId || '').trim();
  const apiKey = String(config.apiKey || '').trim();
  const host = String(config.host || '').trim();
  if (!projectId || !apiKey) {
    testConfigOverride = null;
    return;
  }
  testConfigOverride = {
    projectId,
    apiKey,
    host: host || undefined,
  };
};

export const logBackendError = (context: string, error: unknown): void => {
  if (error instanceof FirestoreBackendError) {
    Logger.warn(`${context}: ${error.message}`, {
      status: error.status,
      code: error.code,
      transient: error.transient,
    });
    return;
  }
  Logger.warn(`${context}: unknown error`, error);
};
