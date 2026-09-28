import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  adminToken,
  createCurso,
  createDisciplina,
  createProfessor,
  deleteCurso,
  deleteProfessor,
  jsonHeaders,
  unique,
} from './testHelpers';
import app from './routes';
import { resolveFrontendDir } from './marp';
import { GZIP_MIN_BYTES, clientAcceptsGzip, getGzipSidecar, isCompressible, cacheControlFor, CACHE_ASSETS_IMMUTABLE, CACHE_NO_CACHE } from './gzipStatic';

// Executar com FRONTEND_STATIC_DIR gravável:
//   cd backend && FRONTEND_STATIC_DIR=/tmp/opencode/mt2-fe bun test src/gzipStatic.test.ts
const staticBase = resolveFrontendDir();

async function bytesOf(res: Response): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await res.arrayBuffer());
}

function textOf(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function writeFile(filePath: string, content: string) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function cleanupFiles(...files: string[]) {
  for (const file of files) {
    try {
      if (existsSync(file)) unlinkSync(file);
    } catch {
      void 0;
    }
  }
}

describe('gzipStatic: helpers puros', () => {
  test('clientAcceptsGzip interpreta quality values', () => {
    expect(clientAcceptsGzip(null)).toBe(false);
    expect(clientAcceptsGzip('')).toBe(false);
    expect(clientAcceptsGzip('gzip')).toBe(true);
    expect(clientAcceptsGzip('GZIP')).toBe(true);
    expect(clientAcceptsGzip('gzip;q=0')).toBe(false);
    expect(clientAcceptsGzip('gzip;q=0.0')).toBe(false);
    expect(clientAcceptsGzip('gzip;q=0.5')).toBe(true);
    expect(clientAcceptsGzip('deflate, gzip;q=0.5')).toBe(true);
    expect(clientAcceptsGzip('br, deflate, identity')).toBe(false);
    expect(clientAcceptsGzip('*')).toBe(false);
  });

  test('isCompressible respeita threshold real de 1024 bytes e tipo', () => {
    expect(GZIP_MIN_BYTES).toBe(1024);
    expect(isCompressible(undefined, '/x/a.html', 2048)).toBe(true);
    expect(isCompressible('text/html; charset=utf-8', '/x/a', 2048)).toBe(true);
    expect(isCompressible(undefined, '/x/a.css', 1025)).toBe(true);
    expect(isCompressible(undefined, '/x/a.css', 1024)).toBe(false);
    expect(isCompressible('text/html', '/x/a', 1024)).toBe(false);
    expect(isCompressible(undefined, '/x/a.png', 99999)).toBe(false);
    expect(isCompressible(undefined, '/x/a.woff2', 99999)).toBe(false);
    expect(isCompressible('application/javascript', '/x/a.woff2', 2048)).toBe(true);
  });

  test('getGzipSidecar gera, reusa e regenera sidecar', () => {
    const unitFile = path.join(staticBase, 'gzip-unit-sidecar.html');
    const content = `<!doctype html><body>${'lorem ipsum '.repeat(300)}</body>`;
    writeFile(unitFile, content);
    try {
      const first = getGzipSidecar(unitFile);
      expect(first).not.toBeNull();
      expect(first?.fresh).toBe(false);
      const firstGz = first?.gzPath ?? '';
      const gzBytes = readFileSync(firstGz);
      expect(textOf(Bun.gunzipSync(gzBytes))).toBe(content);

      const second = getGzipSidecar(unitFile);
      expect(second?.fresh).toBe(true);

      const updated = `${content}<!-- stale -->`;
      writeFile(unitFile, updated);
      utimesSync(unitFile, new Date(Date.now() + 5000), new Date(Date.now() + 5000));
      const third = getGzipSidecar(unitFile);
      expect(third?.fresh).toBe(false);
      expect(textOf(Bun.gunzipSync(readFileSync(third?.gzPath ?? '')))).toBe(updated);
    } finally {
      cleanupFiles(unitFile, `${unitFile}.gz`, `${unitFile}.gz.meta`);
    }
  });

  test('getGzipSidecar devolve null para arquivo inexistente', () => {
    expect(getGzipSidecar(path.join(staticBase, 'gzip-nao-existe.html'))).toBeNull();
  });

  test('cacheControlFor define immutable para /assets e no-cache para index', () => {
    expect(cacheControlFor('/app/frontend_static/assets/index-a1b2c3.js')).toBe(CACHE_ASSETS_IMMUTABLE);
    expect(cacheControlFor('C:\\frontend_static\\assets\\app.js')).toBe(CACHE_ASSETS_IMMUTABLE);
    expect(cacheControlFor('/app/frontend_static/index.html')).toBe(CACHE_NO_CACHE);
    expect(cacheControlFor('/app/frontend_static/qualquer', true)).toBe(CACHE_NO_CACHE);
    expect(cacheControlFor('/tmp/base/materias/logica/aulas/intro.html')).toBeNull();
    expect(cacheControlFor('/tmp/base/materias/logica/aula.css')).toBeNull();
    expect(cacheControlFor('/tmp/base/materias/assets/a.html')).toBeNull();
    expect(cacheControlFor('')).toBeNull();
  });
});

describe('gzipStatic: entrega HTTP com gzip + passthrough', () => {
  const adminPromise = adminToken();
  let admin = '';
  let profId = 0;
  let cursoId = 0;
  let cursoSenhaId = 0;
  let discSlug = '';
  let discSenhaSlug = '';
  let aulaCaminho = '';
  let aulaSenhaCaminho = '';
  let discBaseDir = '';
  const createdFiles: string[] = [];
  const createdDirs: string[] = [];

  async function createAulaComMarkdown(disciplinaId: number, titulo: string, markdown: string) {
    const res = await app.request('/aulas', {
      method: 'POST',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ disciplina_id: disciplinaId, titulo, markdown }),
    });
    return (await res.json()) as { id: number; caminho: string };
  }

  beforeAll(async () => {
    admin = await adminPromise;
    const prof = await createProfessor(admin);
    profId = prof.id;

    const curso = await createCurso(admin, { senha: undefined });
    cursoId = curso.id;
    const disc = await createDisciplina(admin, cursoId, unique('GzipDisc'));
    discSlug = disc.slug;
    discBaseDir = path.join(staticBase, 'materias', discSlug);
    createdDirs.push(discBaseDir);

    const aula = await createAulaComMarkdown(
      disc.id,
      unique('GzipAula'),
      `# Slide 1\n\n${'conteudo de teste '.repeat(200)}\n\n---\n\n# Slide 2\n\nFim.`
    );
    aulaCaminho = aula.caminho;

    const cursoSenha = await createCurso(admin, { senha: 'senha-gzip-123' });
    cursoSenhaId = cursoSenha.id;
    const discSenha = await createDisciplina(admin, cursoSenhaId, unique('GzipDiscSenha'));
    discSenhaSlug = discSenha.slug;
    const senhaDir = path.join(staticBase, 'materias', discSenhaSlug);
    createdDirs.push(senhaDir);
    const aulaSenha = await createAulaComMarkdown(
      discSenha.id,
      unique('GzipAulaSenha'),
      `# Protegida\n\n${'conteudo protegido '.repeat(200)}`
    );
    aulaSenhaCaminho = aulaSenha.caminho;
  });

  afterAll(async () => {
    for (const file of createdFiles) cleanupFiles(file, `${file}.gz`, `${file}.gz.meta`);
    for (const dir of createdDirs) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        void 0;
      }
    }
    await deleteCurso(admin, cursoId);
    await deleteCurso(admin, cursoSenhaId);
    await deleteProfessor(admin, profId);
  });

  test('sem Accept-Encoding entrega identity com Vary e CSP', async () => {
    const htmlAbs = path.join(staticBase, aulaCaminho);
    const res = await app.request(`/${aulaCaminho}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(res.headers.get('vary') || '').toContain('Accept-Encoding');
    expect(res.headers.get('content-security-policy')).toBeTruthy();
    const body = await bytesOf(res);
    expect(Buffer.compare(Buffer.from(body), readFileSync(htmlAbs))).toBe(0);
  });

  test('com gzip em html > 1024 entrega sidecar comprimido', async () => {
    const htmlAbs = path.join(staticBase, aulaCaminho);
    const gzAbs = `${htmlAbs}.gz`;
    const res = await app.request(`/${aulaCaminho}`, { headers: { 'accept-encoding': 'gzip' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBe('gzip');
    expect(res.headers.get('vary') || '').toContain('Accept-Encoding');
    expect(res.headers.get('content-security-policy')).toBeTruthy();
    expect(res.headers.get('content-length')).toBe(String(statSync(gzAbs).size));
    const body = await bytesOf(res);
    expect(textOf(Bun.gunzipSync(body))).toBe(readFileSync(htmlAbs, 'utf8'));
  });

  test('gzip;q=0 volta para identity', async () => {
    const htmlAbs = path.join(staticBase, aulaCaminho);
    const res = await app.request(`/${aulaCaminho}`, { headers: { 'accept-encoding': 'gzip;q=0' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBeNull();
    const body = await bytesOf(res);
    expect(Buffer.compare(Buffer.from(body), readFileSync(htmlAbs))).toBe(0);
  });

  test('tipo nao-compressivel (.png) permanece identity mesmo com gzip', async () => {
    const pngPath = path.join(discBaseDir, 'gzip-case.png');
    createdFiles.push(pngPath);
    writeFile(pngPath, `PNG${'A'.repeat(2000)}`);
    const res = await app.request(`/materias/${discSlug}/gzip-case.png`, {
      headers: { 'accept-encoding': 'gzip' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(existsSync(`${pngPath}.gz`)).toBe(false);
  });

  test('arquivo <= 1024 bytes permanece identity', async () => {
    const smallPath = path.join(discBaseDir, 'gzip-small.css');
    createdFiles.push(smallPath);
    writeFile(smallPath, `.a{color:red}${'x'.repeat(500)}`);
    expect(statSync(smallPath).size).toBeLessThanOrEqual(GZIP_MIN_BYTES);
    const res = await app.request(`/materias/${discSlug}/gzip-small.css`, {
      headers: { 'accept-encoding': 'gzip' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(existsSync(`${smallPath}.gz`)).toBe(false);
  });

  test('sidecar stale por mtime+size regenera com conteudo novo', async () => {
    const cssPath = path.join(discBaseDir, 'gzip-case.css');
    createdFiles.push(cssPath);
    const v1 = `.v1{content:"${'a'.repeat(3000)}"}`;
    writeFile(cssPath, v1);
    const first = await app.request(`/materias/${discSlug}/gzip-case.css`, {
      headers: { 'accept-encoding': 'gzip' },
    });
    expect(first.headers.get('content-encoding')).toBe('gzip');
    expect(textOf(Bun.gunzipSync(await bytesOf(first)))).toBe(v1);

    const v2 = `.v2{content:"${'b'.repeat(1500)}"}`;
    writeFile(cssPath, v2);
    utimesSync(cssPath, new Date(Date.now() + 10000), new Date(Date.now() + 10000));

    const second = await app.request(`/materias/${discSlug}/gzip-case.css`, {
      headers: { 'accept-encoding': 'gzip' },
    });
    expect(second.headers.get('content-encoding')).toBe('gzip');
    const body = await bytesOf(second);
    expect(textOf(Bun.gunzipSync(body))).toBe(v2);
    expect(second.headers.get('content-length')).toBe(String(statSync(`${cssPath}.gz`).size));
  });

  test('traversal nao serve arquivo fora da base nem cria sidecar', async () => {
    const res = await app.request('/materias/..%2f..%2fetc%2fpasswd', {
      headers: { 'accept-encoding': 'gzip' },
    });
    expect(res.status).toBe(404);
    const body = textOf(await bytesOf(res));
    expect(body).not.toContain('root:');
    expect(existsSync('/tmp/opencode/etc/passwd')).toBe(false);
    expect(existsSync('/tmp/opencode/etc/passwd.gz')).toBe(false);
    expect(existsSync('/etc/passwd.gz')).toBe(false);
  });

  test('401 sem senha nao vaza gzip do arquivo protegido', async () => {
    const res = await app.request(`/${aulaSenhaCaminho}`, {
      headers: { 'accept-encoding': 'gzip' },
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('content-encoding')).toBeNull();
    const body = textOf(await bytesOf(res));
    expect(body).not.toContain('conteudo protegido');
  });

  test('assets recebem Cache-Control immutable em gzip e identity', async () => {
    const assetsDir = path.join(staticBase, 'assets');
    const assetsExisted = existsSync(assetsDir);
    const assetPath = path.join(assetsDir, 'cache-asset-abc123.js');
    createdFiles.push(assetPath);
    writeFile(assetPath, `export const x = "${'a'.repeat(3000)}";`);
    try {
      const gz = await app.request('/assets/cache-asset-abc123.js', {
        headers: { 'accept-encoding': 'gzip' },
      });
      expect(gz.status).toBe(200);
      expect(gz.headers.get('content-encoding')).toBe('gzip');
      expect(gz.headers.get('cache-control')).toBe(CACHE_ASSETS_IMMUTABLE);

      const identity = await app.request('/assets/cache-asset-abc123.js');
      expect(identity.status).toBe(200);
      expect(identity.headers.get('content-encoding')).toBeNull();
      expect(identity.headers.get('cache-control')).toBe(CACHE_ASSETS_IMMUTABLE);
    } finally {
      cleanupFiles(assetPath, `${assetPath}.gz`, `${assetPath}.gz.meta`);
      if (!assetsExisted) {
        try {
          rmSync(assetsDir, { recursive: true, force: true });
        } catch {
          void 0;
        }
      }
    }
  });

  test('pedido direto a sidecar .gz ou .meta responde 404', async () => {
    const assetsDir = path.join(staticBase, 'assets');
    const assetsExisted = existsSync(assetsDir);
    const assetPath = path.join(assetsDir, 'block-sidecar-abc123.js');
    createdFiles.push(assetPath);
    writeFile(assetPath, `export const z = "${'b'.repeat(3000)}";`);
    try {
      const gz = await app.request('/assets/block-sidecar-abc123.js', {
        headers: { 'accept-encoding': 'gzip' },
      });
      expect(gz.status).toBe(200);
      expect(gz.headers.get('content-encoding')).toBe('gzip');
      expect(existsSync(`${assetPath}.gz`)).toBe(true);
      expect((await app.request('/assets/block-sidecar-abc123.js.gz')).status).toBe(404);
      expect((await app.request('/assets/block-sidecar-abc123.js.gz.meta')).status).toBe(404);

      const aulaHtml = await app.request(`/${aulaCaminho}`, { headers: { 'accept-encoding': 'gzip' } });
      expect(aulaHtml.headers.get('content-encoding')).toBe('gzip');
      expect((await app.request(`/${aulaCaminho}.gz`)).status).toBe(404);
    } finally {
      cleanupFiles(assetPath, `${assetPath}.gz`, `${assetPath}.gz.meta`);
      if (!assetsExisted) {
        try {
          rmSync(assetsDir, { recursive: true, force: true });
        } catch {
          void 0;
        }
      }
    }
  });

  test('SPA fallback de index.html e index direto recebem no-cache', async () => {
    const indexPath = path.join(staticBase, 'index.html');
    const existed = existsSync(indexPath);
    if (!existed) writeFile(indexPath, `<!doctype html><body>spa${'x'.repeat(2000)}</body>`);
    try {
      const fallback = await app.request('/rota-spa-inexistente-cache-test');
      expect(fallback.status).toBe(200);
      expect(fallback.headers.get('cache-control')).toBe(CACHE_NO_CACHE);

      const direct = await app.request('/index.html');
      expect(direct.status).toBe(200);
      expect(direct.headers.get('cache-control')).toBe(CACHE_NO_CACHE);
    } finally {
      if (!existed) cleanupFiles(indexPath, `${indexPath}.gz`, `${indexPath}.gz.meta`);
    }
  });

  test('conteudo de /materias nao recebe Cache-Control immutable', async () => {
    const res = await app.request(`/${aulaCaminho}`);
    expect(res.status).toBe(200);
    const cacheControl = res.headers.get('cache-control');
    expect(cacheControl === null || !cacheControl.includes('immutable')).toBe(true);
  });
});
