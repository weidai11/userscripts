declare const GM_getValue: ((key: string, defaultValue?: any) => any) | undefined;
declare const GM_setValue: ((key: string, value: any) => void) | undefined;
declare const GM_deleteValue: ((key: string) => void) | undefined;

const AI_PAYLOAD_INDEX_KEY = 'power-reader-ai-payload-index-v1';

type PayloadIndex = Record<string, number>;

const canRead = (): boolean => typeof GM_getValue === 'function';
const canWrite = (): boolean => typeof GM_setValue === 'function';
const canDelete = (): boolean => typeof GM_deleteValue === 'function';

export const getPayloadStorageKeyFromHash = (): string | null => {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  return params.get('pr_payload_key');
};

const readPayloadIndex = (): PayloadIndex => {
  if (!canRead()) return {};
  const raw = GM_getValue!(AI_PAYLOAD_INDEX_KEY, '');
  if (!raw) return {};

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!parsed || typeof parsed !== 'object') return {};

  const normalized: PayloadIndex = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      normalized[key] = value;
    }
  }
  return normalized;
};

const writePayloadIndex = (index: PayloadIndex): void => {
  if (!canWrite()) return;
  const keys = Object.keys(index);
  if (keys.length === 0) {
    if (canDelete()) GM_deleteValue!(AI_PAYLOAD_INDEX_KEY);
    return;
  }
  GM_setValue!(AI_PAYLOAD_INDEX_KEY, JSON.stringify(index));
};

export const registerAIPayloadKey = (payloadKey: string, createdAtMs: number = Date.now()): void => {
  if (!payloadKey || !canWrite()) return;
  const index = readPayloadIndex();
  index[payloadKey] = createdAtMs;
  writePayloadIndex(index);
};

export const consumeAIPayloadKey = (payloadKey: string): void => {
  if (!payloadKey || !canRead()) return;
  const index = readPayloadIndex();
  if (!(payloadKey in index)) return;
  delete index[payloadKey];
  writePayloadIndex(index);
};

export const cleanupStaleAIPayloadKeys = (
  nowMs: number = Date.now(),
  maxAgeMs: number = 60 * 60 * 1000
): number => {
  if (!canRead()) return 0;

  const cutoff = nowMs - maxAgeMs;
  const index = readPayloadIndex();
  let removed = 0;

  for (const [payloadKey, createdAtMs] of Object.entries(index)) {
    if (createdAtMs >= cutoff) continue;
    if (canDelete()) GM_deleteValue!(payloadKey);
    delete index[payloadKey];
    removed += 1;
  }

  if (removed > 0) {
    writePayloadIndex(index);
  }

  return removed;
};

export const clearAllAIPayloadKeys = (): number => {
  if (!canRead()) return 0;

  const index = readPayloadIndex();
  let removed = 0;
  for (const payloadKey of Object.keys(index)) {
    if (canDelete()) GM_deleteValue!(payloadKey);
    removed += 1;
  }
  writePayloadIndex({});
  return removed;
};
