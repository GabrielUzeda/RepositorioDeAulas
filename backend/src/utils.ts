export function sanitizeSlug(s: string): string {
  const input = String(s ?? '');
  const deunicoded = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return deunicoded
    .toLowerCase()
    .split('')
    .map((c) => (/[a-z0-9]/i.test(c) ? c : '_'))
    .join('')
    .split('_')
    .filter((x) => x.length > 0)
    .join('_');
}

export function sanitizePathOrUrl(s: string): string {
  const input = String(s ?? '');
  const deunicoded = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return deunicoded
    .toLowerCase()
    .split('')
    .map((c) => (/[a-z0-9/_.:?&#=%+@-]/i.test(c) ? c : '_'))
    .join('')
    .split('_')
    .filter((x) => x.length > 0)
    // [SEG] Rejeita segmentos de traversal de diretório para evitar uso indevido futuro.
    .map((x) => (x.includes('..') ? x.replace(/\.\./g, '_') : x))
    .join('_');
}

function b64url(data: Uint8Array): string {
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function parseB64url(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getRawKey(): Uint8Array {
  const secret = process.env.ENCRYPTION_KEY_256;
  const encoder = new TextEncoder();
  if (secret) {
    const bytes = encoder.encode(secret);
    if (bytes.length === 32) return bytes;
    // Aceita chaves de tamanho arbitrário derivando 32 bytes (melhor esforço).
    if (bytes.length > 0) {
      const key32 = new Uint8Array(32);
      key32.set(bytes.subarray(0, 32));
      return key32;
    }
  }
  // [SEG] Fail-closed: em produção, ausência de ENCRYPTION_KEY_256 impede o
  // uso de uma chave pública padrão (que permitiria descriptografar todos os
  // dados de alunos — PII — por qualquer pessoa que conheça o repositório).
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY_256 não definido em produção. Abortando operação criptográfica.');
  }
  return encoder.encode('dev-encryption-key-32-bytes-long!');
}

let cachedCryptoKey: CryptoKey | null = null;
async function getCryptoKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) return cachedCryptoKey;
  const rawKey = getRawKey();
  cachedCryptoKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return cachedCryptoKey;
}

export async function encryptData(text: string): Promise<string> {
  if (!text) return text;
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return `enc:v1:${b64url(iv)}:${b64url(new Uint8Array(encrypted))}`;
}

export async function decryptData(encryptedText: string): Promise<string> {
  if (!encryptedText || typeof encryptedText !== 'string' || !encryptedText.startsWith('enc:v1:')) return encryptedText;
  const parts = encryptedText.split(':');
  if (parts.length !== 4) return encryptedText;
  try {
    const iv = parseB64url(parts[2]);
    const data = parseB64url(parts[3]);
    const key = await getCryptoKey();
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
  } catch {
    return encryptedText;
  }
}

export async function hashEmail(email: string): Promise<string> {
  const normalized = String(email || '').trim().toLowerCase();
  const keyRaw = getRawKey();
  const key = await crypto.subtle.importKey('raw', keyRaw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(normalized));
  return b64url(new Uint8Array(sig));
}

