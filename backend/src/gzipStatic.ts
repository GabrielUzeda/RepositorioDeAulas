import { existsSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const GZIP_MIN_BYTES = 1024;
export const GZIP_LEVEL = 5;

const COMPRESSIBLE_TYPES = new Set([
  'text/html',
  'text/css',
  'text/plain',
  'text/xml',
  'application/javascript',
  'text/javascript',
  'application/json',
  'image/svg+xml',
  'application/xml',
  'font/ttf',
  'font/otf',
  'font/woff',
]);

const COMPRESSIBLE_EXTENSIONS = new Set([
  '.html',
  '.css',
  '.js',
  '.svg',
  '.json',
  '.xml',
  '.ttf',
  '.otf',
  '.woff',
]);

export const CACHE_ASSETS_IMMUTABLE = 'public, max-age=31536000, immutable';
export const CACHE_NO_CACHE = 'no-cache';

export function cacheControlFor(filePath: string, isIndexFallback = false): string | null {
  const normalized = (filePath || '').replace(/\\/g, '/').toLowerCase();
  const base = normalized.slice(normalized.lastIndexOf('/') + 1);
  if (isIndexFallback || base === 'index.html') return CACHE_NO_CACHE;
  if (normalized.includes('/assets/') && !normalized.includes('/materias/')) return CACHE_ASSETS_IMMUTABLE;
  return null;
}

export function clientAcceptsGzip(acceptEncodingHeader: string | null): boolean {
  if (!acceptEncodingHeader) return false;
  for (const part of acceptEncodingHeader.split(',')) {
    const segments = part.split(';');
    if (segments[0].trim().toLowerCase() !== 'gzip') continue;
    let quality = 1;
    for (const param of segments.slice(1)) {
      const match = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(param);
      if (match) quality = Number.parseFloat(match[1]);
    }
    return quality > 0;
  }
  return false;
}

export function isCompressible(
  contentType: string | undefined,
  filePath: string,
  size: number
): boolean {
  if (size <= GZIP_MIN_BYTES) return false;
  if (contentType) {
    const base = contentType.split(';')[0].trim().toLowerCase();
    if (COMPRESSIBLE_TYPES.has(base)) return true;
  }
  const ext = path.extname(filePath).toLowerCase();
  return COMPRESSIBLE_EXTENSIONS.has(ext);
}

function writeAtomic(target: string, data: Uint8Array | string): void {
  const tmp = `${target}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(tmp, data);
  try {
    renameSync(tmp, target);
  } catch (error) {
    try {
      unlinkSync(tmp);
    } catch {
      void 0;
    }
    throw error;
  }
}

export function getGzipSidecar(filePath: string): { gzPath: string; fresh: boolean } | null {
  const gzPath = `${filePath}.gz`;
  const metaPath = `${gzPath}.meta`;
  try {
    const stats = statSync(filePath);
    const mtimeMs = stats.mtimeMs;
    const size = stats.size;

    if (existsSync(gzPath)) {
      let metaMatches = false;
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as {
          mtimeMs?: number;
          size?: number;
        };
        metaMatches = meta.mtimeMs === mtimeMs && meta.size === size;
      } catch {
        metaMatches = false;
      }
      if (metaMatches) return { gzPath, fresh: true };
    }

    const original = readFileSync(filePath);
    const gzipped = Bun.gzipSync(original, { level: GZIP_LEVEL });
    writeAtomic(gzPath, gzipped);
    writeAtomic(metaPath, JSON.stringify({ mtimeMs, size }));
    return { gzPath, fresh: false };
  } catch {
    return null;
  }
}
