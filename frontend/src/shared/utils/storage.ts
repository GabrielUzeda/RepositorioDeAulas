const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 1 mês
const KEY_STORAGE_PREFIX = 'enc_key_v1';
const PREFIX = 'enc:';

let cachedKey: CryptoKey | null = null;
let cachedKeyPromise: Promise<CryptoKey | null> | null = null;

function getCryptoKey(): Promise<CryptoKey | null> {
  if (cachedKey) return Promise.resolve(cachedKey);
  if (!cachedKeyPromise) cachedKeyPromise = loadOrCreateKey();
  return cachedKeyPromise.finally(() => {
    cachedKeyPromise = null;
  });
}

async function loadOrCreateKey(): Promise<CryptoKey | null> {
  if (!window.isSecureContext) return null;

  const existing = localStorage.getItem(KEY_STORAGE_PREFIX);
  if (existing) {
    try {
      cachedKey = await importKey(b64ToBuffer(existing));
      return cachedKey;
    } catch {
      localStorage.removeItem(KEY_STORAGE_PREFIX);
    }
  }

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  localStorage.setItem(
    KEY_STORAGE_PREFIX,
    bufferToB64(await crypto.subtle.exportKey('raw', key))
  );
  cachedKey = key;
  return cachedKey;
}

function b64ToBuffer(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bufferToB64(buf: ArrayBuffer | Uint8Array<ArrayBuffer>): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function importKey(keyBytes: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

interface StoredValue {
  v: string;
  exp: number;
}

export async function secureSet(key: string, value: string): Promise<void> {
  const cryptoKey = await getCryptoKey();
  if (!cryptoKey) {
    console.warn('[secure-storage] Contexto não seguro (HTTP); armazenando sem criptografia');
    const plain = JSON.stringify({ v: value, exp: Date.now() + EXPIRY_MS } satisfies StoredValue);
    localStorage.setItem(key, JSON.stringify({ p: 'plain', data: plain }));
    return;
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = JSON.stringify({ v: value, exp: Date.now() + EXPIRY_MS } satisfies StoredValue);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    new TextEncoder().encode(plain)
  );

  const packed = new Uint8Array(iv.byteLength + cipher.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(cipher), iv.byteLength);

  localStorage.setItem(key, JSON.stringify({ p: PREFIX, data: bufferToB64(packed) }));
}

export async function secureGet(key: string): Promise<string | null> {
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed?.p === 'plain') {
    const parsedPlain = JSON.parse(String(parsed.data)) as StoredValue;
    if (typeof parsedPlain.exp !== 'number' || Date.now() > parsedPlain.exp) {
      localStorage.removeItem(key);
      return null;
    }
    return parsedPlain.v;
  }
  if (parsed?.p !== PREFIX) return null;

  const cryptoKey = await getCryptoKey();
  if (!cryptoKey) return null;

  try {
    const packed = b64ToBuffer(String(parsed.data));
    const iv = packed.subarray(0, 12);
    const ciphertext = packed.subarray(12);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext
    );
    const parsedPlain = JSON.parse(new TextDecoder().decode(plain)) as StoredValue;
    if (typeof parsedPlain.exp !== 'number' || Date.now() > parsedPlain.exp) {
      localStorage.removeItem(key);
      return null;
    }
    return parsedPlain.v;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export async function secureRemove(key: string): Promise<void> {
  localStorage.removeItem(key);
}