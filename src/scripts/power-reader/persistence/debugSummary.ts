const MAX_DEBUG_SUMMARY_ERROR_DEPTH = 4;
const MAX_DEBUG_SUMMARY_ARRAY_ITEMS = 20;
const MAX_DEBUG_SUMMARY_OBJECT_KEYS = 40;
const MAX_DEBUG_SUMMARY_STRING_LENGTH = 4_000;

export const truncateDebugString = (value: string): string => {
  if (value.length <= MAX_DEBUG_SUMMARY_STRING_LENGTH) return value;
  let truncated = value.slice(0, MAX_DEBUG_SUMMARY_STRING_LENGTH);
  const lastChar = truncated.charCodeAt(truncated.length - 1);
  if (lastChar >= 0xd800 && lastChar <= 0xdbff) {
    truncated = truncated.slice(0, -1);
  } else if (lastChar >= 0xdc00 && lastChar <= 0xdfff) {
    const prevChar = truncated.length >= 2 ? truncated.charCodeAt(truncated.length - 2) : 0;
    const hasMatchingHigh = prevChar >= 0xd800 && prevChar <= 0xdbff;
    if (!hasMatchingHigh) {
      truncated = truncated.slice(0, -1);
    }
  }
  return `${truncated}...[truncated]`;
};

export const toDebugSummaryValue = (
  value: unknown,
  depth: number = 0,
  activeStack?: WeakSet<object>
): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return truncateDebugString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return String(value);
  if (depth >= MAX_DEBUG_SUMMARY_ERROR_DEPTH) return '[max-depth]';
  if (typeof value !== 'object') return String(value);

  const objectValue = value as object;
  const stack = activeStack ?? new WeakSet<object>();
  if (stack.has(objectValue)) return '[circular]';
  stack.add(objectValue);

  try {
    if (Array.isArray(value)) {
      return value
        .slice(0, MAX_DEBUG_SUMMARY_ARRAY_ITEMS)
        .map((entry) => toDebugSummaryValue(entry, depth + 1, stack));
    }

    if (value instanceof Map) {
      const entries = Array.from(value.entries()).slice(0, MAX_DEBUG_SUMMARY_ARRAY_ITEMS);
      return entries.map(([entryKey, entryValue]) => ([
        toDebugSummaryValue(entryKey, depth + 1, stack),
        toDebugSummaryValue(entryValue, depth + 1, stack),
      ]));
    }

    if (value instanceof Set) {
      return Array.from(value.values())
        .slice(0, MAX_DEBUG_SUMMARY_ARRAY_ITEMS)
        .map((entry) => toDebugSummaryValue(entry, depth + 1, stack));
    }

    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return value instanceof Date ? value.toISOString() : String(value);
    }

    const entries = Object.entries(value as Record<string, unknown>)
      .slice(0, MAX_DEBUG_SUMMARY_OBJECT_KEYS);
    const out: Record<string, unknown> = {};
    for (const [key, entryValue] of entries) {
      out[key] = toDebugSummaryValue(entryValue, depth + 1, stack);
    }
    return out;
  } finally {
    stack.delete(objectValue);
  }
};
