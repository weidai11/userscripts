const BASE36_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const HEX_DIGITS = '0123456789abcdef';
const UUID_HEX_LENGTH = 32;

const getCryptoApi = (): Crypto | null => {
  if (typeof globalThis === 'undefined') return null;
  const candidate = globalThis.crypto;
  if (!candidate || typeof candidate.getRandomValues !== 'function') return null;
  return candidate;
};

const mathRandomInt = (maxExclusive: number): number =>
  Math.floor(Math.random() * maxExclusive);

const byteToHex = (value: number): string =>
  `${HEX_DIGITS[(value >>> 4) & 0x0f]}${HEX_DIGITS[value & 0x0f]}`;

const randomHex = (length: number): string => {
  const targetLength = Math.max(0, Math.floor(length));
  if (targetLength === 0) return '';
  const cryptoApi = getCryptoApi();
  if (cryptoApi) {
    const bytes = new Uint8Array(Math.ceil(targetLength / 2));
    cryptoApi.getRandomValues(bytes);
    let out = '';
    for (const byte of bytes) {
      out += byteToHex(byte);
    }
    return out.slice(0, targetLength);
  }

  const bytes = new Uint8Array(Math.ceil(targetLength / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = mathRandomInt(256);
  }
  let out = '';
  for (const byte of bytes) {
    out += byteToHex(byte);
  }
  return out.slice(0, targetLength);
};

export const randomUuid = (): string => {
  const cryptoApi = getCryptoApi();
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (cryptoApi) {
    cryptoApi.getRandomValues(bytes);
  } else {
    const fallbackHex = randomHex(UUID_HEX_LENGTH);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Number.parseInt(fallbackHex.slice(i * 2, i * 2 + 2), 16);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, byteToHex).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

export const randomBase36 = (length: number): string => {
  const targetLength = Math.max(0, Math.floor(length));
  if (targetLength === 0) return '';
  let out = '';
  for (let i = 0; i < targetLength; i++) {
    out += BASE36_ALPHABET[randomInt(BASE36_ALPHABET.length)];
  }
  return out;
};

export const randomInt = (maxExclusive: number): number => {
  const max = Math.floor(maxExclusive);
  if (!Number.isFinite(max) || max <= 0) return 0;

  const cryptoApi = getCryptoApi();
  if (cryptoApi) {
    const random = new Uint32Array(1);
    const range = 0x1_0000_0000;
    if (max >= range) {
      return mathRandomInt(max);
    }
    const maxUnbiased = Math.floor(range / max) * max;
    do {
      cryptoApi.getRandomValues(random);
    } while (random[0] >= maxUnbiased);
    return random[0] % max;
  }

  return mathRandomInt(max);
};
