const BASE36_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const HEX_DIGITS = '0123456789abcdef';
const RANGE53 = 0x20_0000_0000_0000; // 2^53
let cachedCryptoApi: Crypto | null = null;

const getCryptoApi = (): Crypto => {
  if (cachedCryptoApi) {
    return cachedCryptoApi;
  }
  if (typeof globalThis === 'undefined') {
    throw new Error('Secure randomness unavailable: globalThis is undefined');
  }
  const candidate = globalThis.crypto;
  if (!candidate || typeof candidate.getRandomValues !== 'function') {
    throw new Error('Secure randomness unavailable: globalThis.crypto.getRandomValues is required');
  }
  cachedCryptoApi = candidate;
  return cachedCryptoApi;
};

const byteToHex = (value: number): string =>
  `${HEX_DIGITS[(value >>> 4) & 0x0f]}${HEX_DIGITS[value & 0x0f]}`;

export const randomUuid = (): string => {
  const cryptoApi = getCryptoApi();
  if (typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, byteToHex).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

export const randomBase36 = (length: number): string => {
  const targetLength = Math.max(0, Math.floor(length));
  if (targetLength === 0) return '';
  const cryptoApi = getCryptoApi();
  const buffer = new Uint8Array(Math.max(16, targetLength * 2));
  let out = '';
  while (out.length < targetLength) {
    cryptoApi.getRandomValues(buffer);
    for (let i = 0; i < buffer.length && out.length < targetLength; i++) {
      const value = buffer[i];
      // 252 is the largest multiple of 36 below 256; reject to avoid modulo bias.
      if (value >= 252) continue;
      out += BASE36_ALPHABET[value % BASE36_ALPHABET.length];
    }
  }
  return out;
};

export const randomInt = (maxExclusive: number): number => {
  const max = Math.floor(maxExclusive);
  if (!Number.isFinite(max) || max <= 0) return 0;
  const boundedMax = Math.min(max, RANGE53);
  const cryptoApi = getCryptoApi();
  const maxUnbiased = Math.floor(RANGE53 / boundedMax) * boundedMax;
  const randomWordsBuffer = new Uint32Array(2);
  while (true) {
    cryptoApi.getRandomValues(randomWordsBuffer);
    // Compose an unbiased 53-bit integer from two 32-bit words.
    const candidate =
      (randomWordsBuffer[0] & 0x001f_ffff) * 0x1_0000_0000 + randomWordsBuffer[1];
    if (candidate < maxUnbiased) {
      return candidate % boundedMax;
    }
  }
};
