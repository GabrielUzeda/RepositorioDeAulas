import type { Context, Next } from 'hono';

const PBKDF2_ITERATIONS = 600000;
const SALT_LENGTH = 16;
const JWT_ALG = 'HS256';
const HASH_PREFIX = 'pbkdf2_sha256';

function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    256
  );
  return crypto.subtle.importKey('raw', derivedBits, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function parseStoredHash(stored: string): { iterations: number; hash: string } {
  if (stored.startsWith(`${HASH_PREFIX}$`)) {
    const parts = stored.split('$');
    if (parts.length === 3) {
      const iterations = Number(parts[1]);
      if (Number.isInteger(iterations) && iterations > 0) {
        return { iterations, hash: parts[2] };
      }
    }
  }
  return { iterations: 100000, hash: stored };
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(password));
  const stored = `${HASH_PREFIX}$${PBKDF2_ITERATIONS}$${base64UrlEncode(new Uint8Array(signature))}`;
  return { hash: stored, salt: base64UrlEncode(salt) };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const { iterations, hash: expected } = parseStoredHash(hash);
  const saltBytes = base64UrlDecode(salt);
  const key = await deriveKey(password, saltBytes, iterations);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(password));
  const computed = base64UrlEncode(new Uint8Array(signature));
  return timingSafeEqual(computed, expected);
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  // [SEG] Fail-closed: em produção, sem JWT_SECRET não há como assinar/validar
  // tokens de forma segura. Lançar impede a aceitação de tokens forjados com a
  // chave pública padrão (bypass total de autenticação/autorização).
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET não definido em produção. Abortando operação de JWT.');
  }
  return 'dev-secret-key-change-in-prod';
}

// Validado na inicialização do servidor (index.ts) para falhar cedo em produção.
export function assertRequiredSecrets(): void {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET ausente em ambiente de produção. Encerrando boot.');
  }
}

export async function signJwt(payload: Record<string, any>): Promise<string> {
  const header = { alg: JWT_ALG, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + 86400 };
  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(fullPayload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getJwtSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyJwt(token: string): Promise<Record<string, any> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const signingInput = `${headerB64}.${payloadB64}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(getJwtSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signature = base64UrlDecode(signatureB64);
    const valid = await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(signingInput));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function professorAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.body(null, 401);
  const token = authHeader.slice(7);
  const payload = await verifyJwt(token);
  if (!payload || !payload.sub) return c.body(null, 401);
  c.set('professorId', payload.sub);
  c.set('professorRole', payload.role ?? 'professor');
  return next();
}

export async function adminAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.body(null, 401);
  const token = authHeader.slice(7);
  const payload = await verifyJwt(token);
  if (!payload || !payload.sub) return c.body(null, 401);
  if ((payload.role ?? 'professor') !== 'admin') return c.text('Access denied', 403);
  c.set('professorId', payload.sub);
  c.set('professorRole', 'admin');
  return next();
}

export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string' || email.length > 255) return false;
  return /^[^\s@]+@[^\s@]+(?:\.[^\s@]+)?$/.test(email);
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

// [3.3] Extração confiável do IP real evita rate-limit spoofing.
// - `cf-connecting-ip` (Cloudflare) tem prioridade: não é spoofável pelo cliente quando o
// backend é alcançado via Cloudflare.
// `x-forwarded-for` é uma lista onde o PRIMEIRO valor é o cliente (spoofável) e o ÚLTIMO é
// acrescentado pelo proxy confiável mais próximo. Usa-se o ÚLTIMO elemento.
// Caveat documentado: assume that o backend só é alcançável via proxy confiável (rede interna),
// como já mitigado na arquitetura (porta não pública). Rate-limit não é uma barreira anti-cheat
// absoluta contra IP spoofing; é defesa em profundidade.
export function extractClientIp(c: Context): string {
  const cf = c.req.header('cf-connecting-ip');
  if (cf) return cf;
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    // Behind a trusted proxy the LAST hop is appended by the proxy (its view of
    // the client). The backend is not directly internet-facing, so we trust that
    // hop. (M12: do NOT trust the client-spoofable FIRST element.)
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  // Direct connection (no proxy / no XFF): use the real peer socket address so
  // clients get distinct buckets instead of all collapsing to 127.0.0.1 (M12).
  const sock = (c.req.raw as unknown as { socket?: { remoteAddress?: string } })?.socket;
  const remote = sock?.remoteAddress;
  if (remote) return remote;
  return '127.0.0.1';
}

export function createRateLimiter(options: RateLimitOptions) {
  const store = new Map<string, { count: number; resetTime: number }>();

  const prune = () => {
    const now = Date.now();
    for (const [k, v] of store) {
      if (now >= v.resetTime) store.delete(k);
    }
  };

  return async (c: Context, next: Next) => {
    if (process.env.NODE_ENV !== 'production' && process.env.DISABLE_RATE_LIMIT === 'true') {
      return next();
    }
    const ip = extractClientIp(c);
    const now = Date.now();

    // [3.3] Cleanup LAZY (sem setInterval): evita um timer bloqueando o fim do processo e
    // mantém o store sem entradas vencidas sob demanda. As janelas são curtas (ex.: 60s) e o
    // número de chaves é pequeno, então uma varredura pontual basta.
    if (store.size >= 1000) prune();

    let record = store.get(ip);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + options.windowMs };
      store.set(ip, record);
    } else {
      record.count++;
    }

    if (record.count > options.max) {
      c.header('Retry-After', String(Math.ceil((record.resetTime - now) / 1000)));
      return c.text(options.message || 'Muitas requisições. Tente novamente mais tarde.', 429);
    }

    return next();
  };
}
