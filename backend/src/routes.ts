import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { db } from './db';
import { sanitizeSlug, sanitizePathOrUrl, encryptData, decryptData, hashEmail } from './utils';
import { professorAuth, adminAuth, hashPassword, verifyPassword, signJwt, verifyJwt, isValidEmail, createRateLimiter, extractClientIp } from './auth';
import { sendMail, type MailRequest } from './mailer';
import { processMarpContent, resolveFrontendDir } from './marp';

const app = new Hono();

async function logAudit(c: any, acao: string, recurso: string, detalhes?: object) {
  try {
    const ip = extractClientIp(c);
    const userAgent = c.req.header('user-agent') || '';
    const authHeader = c.req.header('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';
    const prof = token ? await verifyJwt(token) : null;

    let sanitizedDetalhes: string | null = null;
    if (detalhes && typeof detalhes === 'object') {
      const copy: Record<string, any> = { ...detalhes };
      delete copy.password;
      delete copy.senha;
      delete copy.token;
      delete copy.salt;
      delete copy.senha_hash;
      sanitizedDetalhes = JSON.stringify(copy);
    }

    db.query(
      `INSERT INTO audit_logs (usuario_id, usuario_email, acao, recurso, ip, user_agent, detalhes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      prof?.sub ? Number(prof.sub) : null,
      prof?.email || null,
      acao,
      recurso,
      ip,
      userAgent,
      sanitizedDetalhes
    );
  } catch (e) {
    console.error('❌ Falha ao gravar log de auditoria:', e);
  }
}

// [3.9] CSP emitida pelo backend (não há nginx). Mínima permissiva para marp + mermaid (esm.sh).
// Aplicada somente em respostas de arquivos .html. `--html` do marp foi MANTIDO de propósito:
// sem ele, os blocos `<div class="mermaid">` injetados em marp.ts seriam escapados (diagramas quebram).
const CSP_HTML = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://esm.sh",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' https://esm.sh",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

function serveFileWithCsp(filePath: string, contentType?: string): Response | null {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return null;
  const headers: Record<string, string> = {};
  if (contentType) headers['Content-Type'] = contentType;
  if (filePath.endsWith('.html') || contentType?.includes('text/html')) {
    headers['Content-Security-Policy'] = CSP_HTML;
  }
  return new Response(Bun.file(filePath), { headers });
}

app.use('*', secureHeaders());

// [3.4] CORS restrito: origens controladas via env CORS_ORIGIN (lista separada por vírgula).
// Fallback apenas para dev local (http://localhost). Em produção exija CORS_ORIGIN explícito.
function parseCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN;
  if (raw && raw.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return ['http://localhost'];
}
export const corsOrigins = parseCorsOrigins();
app.use(
  '*',
  cors({
    origin: corsOrigins,
    allowHeaders: ['Content-Type', 'Authorization', 'X-Materia-Senha'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  })
);

app.onError((err, c) => {
  console.error('[HTTP Server Error]:', err);
  return c.text('Internal Server Error', 500);
});

const loginLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10, message: 'Muitas tentativas de login. Aguarde 1 minuto.' });
const registerLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5, message: 'Muitas tentativas de registro. Aguarde 10 minutos.' });
const submissionLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, message: 'Muitas submissões de resposta. Aguarde 1 minuto.' });

const dbq = (sql: string) => db.query<Record<string, any>, any[]>(sql);

function mapAtividade(row: any) {
  if (row == null) return row;
  return { ...row, allow_password: row.allow_password == null ? null : !!row.allow_password };
}

function parseId(v: string | undefined): number | null {
  if (v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

async function parseBody(c: any): Promise<Record<string, any> | null> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

function normalizeJsonData(value: any): string | null {
  if (value == null) return null;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// [2.6] Leitura única e coesa da "senha" de acesso do aluno (matéria/atividade).
// Prioriza o header `x-materia-senha` (não fica em logs/histórico de proxy);
// mantém compat com `?senha=` na query apenas como fallback (frontend atual não foi alterado).
// A senha NUNCA é usada em logging. Criação/edição segue em texto no DB por decisão
// ("senha pública de turma"), mas o transporte por query fica normalizado/desincentivado.
function readMateriaSenha(c: any): string | null {
  const header = c.req.header('x-materia-senha')?.trim();
  if (header) return header;
  const q = c.req.query('senha');
  return q && q.length > 0 ? q : null;
}

function getProfessor(c: any): { id: number; role: string } | null {
  const id = c.get('professorId');
  const role = c.get('professorRole');
  if (!id) return null;
  return { id: Number(id), role };
}

function canManageCurso(prof: { id: number; role: string }, cursoId: number): boolean {
  if (prof.role === 'admin') return true;
  return !!dbq('SELECT 1 FROM curso_professores WHERE curso_id = ? AND professor_id = ?').get(cursoId, prof.id);
}

function getMateriaCursoId(materiaId: number): number | null {
  const m = dbq('SELECT curso_id FROM materias WHERE id = ?').get(materiaId) as any;
  return m ? Number(m.curso_id) : null;
}

async function canManageMateria(c: any, materiaId: number): Promise<boolean> {
  const prof = getProfessor(c);
  if (!prof) return false;
  const cursoId = getMateriaCursoId(materiaId);
  if (cursoId === null) return false;
  return canManageCurso(prof, cursoId);
}

// ---------- Auth routes ----------

app.post('/auth/login', loginLimiter, async (c) => {
  const body = await parseBody(c);
  if (!body?.email || !body?.password || !isValidEmail(body.email)) return c.text('Invalid credentials', 400);
  const prof = dbq('SELECT * FROM professores WHERE email = ?').get(body.email) as any;
  if (!prof) {
    await logAudit(c, 'login_failed', 'auth', { email: body.email, reason: 'user_not_found' });
    return c.text('Invalid credentials', 401);
  }
  if (prof.status === 'pendente') {
    await logAudit(c, 'login_failed', 'auth', { email: body.email, reason: 'pending_approval' });
    return c.text('Aguardando aprovação do administrador', 403);
  }
  const ok = await verifyPassword(body.password, prof.senha_hash, prof.salt);
  if (!ok) {
    await logAudit(c, 'login_failed', 'auth', { email: body.email, reason: 'invalid_password' });
    return c.text('Invalid credentials', 401);
  }
  const token = await signJwt({ sub: String(prof.id), role: prof.role, email: prof.email });
  await logAudit(c, 'login', `professor:${prof.id}`, { email: prof.email });
  return c.json({ token, professor: { id: prof.id, email: prof.email, nome: prof.nome, role: prof.role, status: prof.status } });
});

app.post('/auth/register', registerLimiter, async (c) => {
  const body = await parseBody(c);
  if (!body?.email || !body?.password || !body?.nome || !isValidEmail(body.email)) return c.text('Dados inválidos', 400);
  const existing = dbq('SELECT id FROM professores WHERE email = ?').get(body.email);
  if (existing) return c.text('Email already registered', 409);
  const { hash, salt } = await hashPassword(body.password);
  const r = dbq('INSERT INTO professores (email, nome, senha_hash, salt, role, status) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, email, nome, role, status')
    .get(body.email, body.nome, hash, salt, 'professor', 'pendente') as any;
  await logAudit(c, 'register', `professor:${r.id}`, { email: r.email, nome: r.nome });
  return c.json({ mensagem: 'Cadastro realizado. Aguardando aprovação do administrador.', professor: r }, 201);
});

app.get('/check-auth', professorAuth, (c) => {
  const prof = getProfessor(c);
  return c.json({ id: prof?.id, role: prof?.role });
});

// ---------- Curso handlers (admin) ----------

async function createCurso(c: any) {
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const slug = sanitizeSlug(body.slug ?? body.nome ?? '');
  if (!slug) return c.text('Informe um nome válido para o curso.', 400);
  const r = db
    .query(
      `INSERT INTO cursos (slug, nome, cor, icone, descricao)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(slug, body.nome ?? '', body.cor ?? null, body.icone ?? null, body.descricao ?? null);
  return c.json(r, 201);
}

async function updateCurso(c: any) {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const slug = sanitizeSlug(body.slug ?? body.nome ?? '');
  if (!slug) return c.text('Informe um nome válido para o curso.', 400);
  const r = db
    .query(
      `UPDATE cursos
       SET slug = ?, nome = ?, cor = ?, icone = ?, descricao = ?,
           atualizado_em = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id = ?
       RETURNING *`
    )
    .get(slug, body.nome ?? '', body.cor ?? null, body.icone ?? null, body.descricao ?? null, id);
  if (!r) return c.text('Curso not found', 404);
  return c.json(r, 200);
}

// ---------- Materia handlers ----------

async function createMateria(c: any) {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const cursoId = parseId(String(body.curso_id));
  if (cursoId === null) return c.text('', 400);
  if (!canManageCurso(prof, cursoId)) return c.text('Access denied', 403);
  const slug = sanitizeSlug(body.slug ?? '');
  if (!slug) return c.text('Informe um nome válido para a materia.', 400);
  const r = db
    .query(
      `INSERT INTO materias (curso_id, slug, nome, cor, icone, senha, descricao)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(cursoId, slug, body.nome ?? '', body.cor ?? null, body.icone ?? null, body.senha ?? null, body.descricao ?? null);
  return c.json(r, 201);
}

async function updateMateria(c: any) {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  if (!(await canManageMateria(c, id))) return c.text('Materia not found or access denied', 404);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const slug = sanitizeSlug(body.slug ?? body.nome ?? '');
  const r = db
    .query(
      `UPDATE materias
       SET slug = COALESCE(NULLIF(?, ''), slug), nome = COALESCE(NULLIF(?, ''), nome),
           cor = COALESCE(?, cor), icone = COALESCE(?, icone),
           senha = COALESCE(?, senha), descricao = COALESCE(?, descricao),
           atualizado_em = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id = ?
       RETURNING *`
    )
    .get(slug, body.nome ?? '', body.cor ?? null, body.icone ?? null, body.senha ?? null, body.descricao ?? null, id);
  if (!r) return c.text('Materia not found', 404);
  return c.json(r, 200);
}

async function createAula(c: any) {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const materiaId = parseId(String(body.materia_id));
  if (materiaId === null) return c.text('', 400);
  if (!(await canManageMateria(c, materiaId))) return c.text('Access denied', 403);
  const materia = dbq('SELECT * FROM materias WHERE id = ?').get(materiaId) as any;
  const markdown = body.markdown ?? body.marp_markdown ?? body.conteudo_md ?? null;
  let finalCaminho = sanitizePathOrUrl(body.caminho ?? '');
  if (markdown !== null && markdown !== undefined) {
    const res = processMarpContent(materia.slug, body.titulo ?? '', markdown);
    if (res.error) return c.text(res.error, 500);
    finalCaminho = res.caminho!;
  }
  const r = db
    .query(
      `INSERT INTO aulas (materia_id, titulo, caminho, icone, descricao, ordem, conteudo_md)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(materiaId, body.titulo ?? '', finalCaminho, body.icone ?? null, body.descricao ?? null, body.ordem ?? 0, markdown);
  return c.json(r, 201);
}

async function updateAula(c: any) {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const materiaId = parseId(String(body.materia_id));
  if (materiaId === null) return c.text('', 400);
  if (!(await canManageMateria(c, materiaId))) return c.text('Access denied', 403);
  const materia = dbq('SELECT * FROM materias WHERE id = ?').get(materiaId) as any;
  const markdown = body.markdown ?? body.marp_markdown ?? body.conteudo_md ?? null;
  let finalCaminho = sanitizePathOrUrl(body.caminho ?? '');
  if (markdown !== null && markdown !== undefined) {
    const res = processMarpContent(materia.slug, body.titulo ?? '', markdown);
    if (res.error) return c.text(res.error, 500);
    finalCaminho = res.caminho!;
  }
  const r = db
    .query(
      `UPDATE aulas
       SET materia_id = ?, titulo = ?, caminho = ?, icone = ?, descricao = ?, ordem = ?, conteudo_md = ?,
           atualizado_em = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id = ?
       RETURNING *`
    )
    .get(materiaId, body.titulo ?? '', finalCaminho, body.icone ?? null, body.descricao ?? null, body.ordem ?? 0, markdown, id);
  if (!r) return c.text('Aula not found', 404);
  return c.json(r, 200);
}

async function createAtividade(c: any) {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const materiaId = parseId(String(body.materia_id));
  if (materiaId === null) return c.text('', 400);
  if (!(await canManageMateria(c, materiaId))) return c.text('Access denied', 403);
  const externalId = body.external_id != null ? sanitizeSlug(body.external_id) : null;
  const caminho = sanitizePathOrUrl(body.caminho ?? '');
  const r = db
    .query(
      `INSERT INTO atividades (materia_id, external_id, titulo, descricao, caminho, icone, json_data, tipo, senha, allow_password, ordem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(
      materiaId,
      externalId,
      body.titulo ?? '',
      body.descricao ?? null,
      caminho,
      body.icone ?? null,
      normalizeJsonData(body.json_data),
      body.tipo ?? null,
      body.senha ?? null,
      body.allow_password == null ? null : body.allow_password ? 1 : 0,
      body.ordem ?? 0
    );
  return c.json(mapAtividade(r), 201);
}

async function updateAtividade(c: any) {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const materiaId = parseId(String(body.materia_id));
  if (materiaId === null) return c.text('', 400);
  if (!(await canManageMateria(c, materiaId))) return c.text('Access denied', 403);
  const externalId = body.external_id != null ? sanitizeSlug(body.external_id) : null;
  const caminho = sanitizePathOrUrl(body.caminho ?? '');
  const r = db
    .query(
      `UPDATE atividades
       SET materia_id = ?, external_id = ?, titulo = ?, descricao = ?, caminho = ?, icone = ?,
           json_data = ?, tipo = ?, senha = COALESCE(?, senha), allow_password = ?, ordem = ?,
           atualizado_em = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id = ?
       RETURNING *`
    )
    .get(
      materiaId,
      externalId,
      body.titulo ?? '',
      body.descricao ?? null,
      caminho,
      body.icone ?? null,
      normalizeJsonData(body.json_data),
      body.tipo ?? null,
      body.senha ?? null,
      body.allow_password == null ? null : body.allow_password ? 1 : 0,
      body.ordem ?? 0,
      id
    );
  if (!r) return c.text('Atividade not found', 404);
  return c.json(mapAtividade(r), 200);
}

// ---------- Route registration ----------

app.post('/cursos', adminAuth, createCurso);
app.put('/cursos/:id', adminAuth, updateCurso);
app.delete('/cursos/:id', adminAuth, (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  dbq('DELETE FROM cursos WHERE id = ?').run(id);
  return c.body(null, 204);
});

app.get('/cursos/:id/professores', adminAuth, (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const rows = dbq(
    `SELECT p.id, p.nome, p.email, p.role FROM curso_professores cp
     JOIN professores p ON p.id = cp.professor_id
     WHERE cp.curso_id = ? ORDER BY p.nome`
  ).all(id);
  return c.json(rows);
});

app.put('/cursos/:id/professores', adminAuth, async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const curso = dbq('SELECT id FROM cursos WHERE id = ?').get(id);
  if (!curso) return c.text('Curso not found', 404);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const professorIds = Array.isArray(body.professor_ids) ? body.professor_ids.map(Number).filter((n: number) => Number.isInteger(n)) : [];

  db.transaction(() => {
    dbq('DELETE FROM curso_professores WHERE curso_id = ?').run(id);
    const ins = db.query('INSERT OR IGNORE INTO curso_professores (curso_id, professor_id) VALUES (?, ?)');
    for (const pid of professorIds) {
      if (dbq('SELECT id FROM professores WHERE id = ?').get(pid)) ins.run(id, pid);
    }
  })();

  const rows = dbq(
    `SELECT p.id, p.nome, p.email, p.role FROM curso_professores cp
     JOIN professores p ON p.id = cp.professor_id
     WHERE cp.curso_id = ? ORDER BY p.nome`
  ).all(id);
  return c.json(rows);
});

app.post('/materias', professorAuth, createMateria);
app.put('/materias/:id', professorAuth, updateMateria);
app.post('/materias/:id', professorAuth, updateMateria);
app.delete('/materias/:id', professorAuth, async (c) => {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  if (!(await canManageMateria(c, id))) return c.text('Materia not found or access denied', 404);
  dbq('DELETE FROM materias WHERE id = ?').run(id);
  return c.body(null, 204);
});

app.post('/aulas', professorAuth, createAula);
app.put('/aulas/:id', professorAuth, updateAula);
app.delete('/aulas/:id', professorAuth, async (c) => {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const aula = dbq('SELECT materia_id FROM aulas WHERE id = ?').get(id) as any;
  if (!aula) return c.text('Aula not found', 404);
  if (!(await canManageMateria(c, aula.materia_id))) return c.text('Access denied', 403);
  dbq('DELETE FROM aulas WHERE id = ?').run(id);
  return c.body(null, 204);
});

app.post('/atividades', professorAuth, createAtividade);
app.put('/atividades/:id', professorAuth, updateAtividade);
app.delete('/atividades/:id', professorAuth, async (c) => {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const atv = dbq('SELECT materia_id FROM atividades WHERE id = ?').get(id) as any;
  if (!atv) return c.text('Atividade not found', 404);
  if (!(await canManageMateria(c, atv.materia_id))) return c.text('Access denied', 403);
  dbq('DELETE FROM atividades WHERE id = ?').run(id);
  return c.body(null, 204);
});

// ---------- Public routes ----------

app.get('/cursos', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const payload = await verifyJwt(authHeader.slice(7));
    if (payload?.sub) {
      const profId = Number(payload.sub);
      if (payload.role === 'admin') {
        const rows = dbq(
          `SELECT c.*,
             (SELECT COUNT(*) FROM materias m WHERE m.curso_id = c.id) AS total_materias,
             (SELECT COUNT(*) FROM curso_professores cp WHERE cp.curso_id = c.id) AS total_professores
           FROM cursos c ORDER BY c.nome`
        ).all();
        return c.json(rows);
      }
      const rows = dbq(
        `SELECT c.*,
           (SELECT COUNT(*) FROM materias m WHERE m.curso_id = c.id) AS total_materias,
           (SELECT COUNT(*) FROM curso_professores cp WHERE cp.curso_id = c.id) AS total_professores
         FROM cursos c
         WHERE c.id IN (SELECT curso_id FROM curso_professores WHERE professor_id = ?)
         ORDER BY c.nome`
      ).all(profId);
      return c.json(rows);
    }
  }
  const rows = dbq(
    `SELECT c.id, c.slug, c.nome, c.cor, c.icone, c.descricao,
       (SELECT COUNT(*) FROM materias m WHERE m.curso_id = c.id) AS total_materias,
       (SELECT COUNT(*) FROM curso_professores cp WHERE cp.curso_id = c.id) AS total_professores
     FROM cursos c ORDER BY c.nome`
  ).all();
  return c.json(rows);
});

app.get('/cursos/:id', (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const r = dbq('SELECT id, slug, nome, cor, icone, descricao FROM cursos WHERE id = ?').get(id);
  if (!r) return c.text('Curso not found', 404);
  return c.json(r);
});

app.get('/cursos/:id/materias', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const curso = dbq('SELECT id FROM cursos WHERE id = ?').get(id);
  if (!curso) return c.text('Curso not found', 404);
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const payload = await verifyJwt(authHeader.slice(7));
    if (payload?.sub) {
      const profId = Number(payload.sub);
      if (payload.role === 'admin' || canManageCurso({ id: profId, role: payload.role }, id)) {
        const rows = dbq('SELECT * FROM materias WHERE curso_id = ? ORDER BY nome').all(id);
        return c.json(rows);
      }
    }
  }
  const rows = dbq('SELECT id, slug, nome, cor, icone, descricao FROM materias WHERE curso_id = ? ORDER BY nome').all(id);
  return c.json(rows);
});

app.get('/materias/:id', (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const r = dbq('SELECT id, curso_id, slug, nome, cor, icone, descricao FROM materias WHERE id = ?').get(id);
  if (!r) return c.text('Materia not found', 404);
  return c.json(r);
});

app.get('/aulas', async (c) => {
  const materiaId = parseId(c.req.query('materia_id'));
  if (materiaId === null) return c.text('', 400);
  const materia = dbq('SELECT * FROM materias WHERE id = ?').get(materiaId) as any;
  if (!materia) return c.text('Materia não encontrada', 404);

  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const payload = await verifyJwt(authHeader.slice(7));
    if (payload?.sub) {
      const profId = Number(payload.sub);
      if (payload.role === 'admin' || canManageCurso({ id: profId, role: payload.role }, materia.curso_id)) {
        const rows = dbq('SELECT * FROM aulas WHERE materia_id = ? ORDER BY ordem, titulo').all(materiaId);
        return c.json(rows);
      }
    }
  }

  const senha = readMateriaSenha(c);
  if ((materia.senha ?? null) !== senha) return c.text('Senha da materia incorreta', 401);
  const rows = dbq('SELECT * FROM aulas WHERE materia_id = ? ORDER BY ordem, titulo').all(materiaId);
  return c.json(rows);
});

app.get('/aulas/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const r = dbq('SELECT * FROM aulas WHERE id = ?').get(id) as any;
  if (!r) return c.text('Aula not found', 404);

  const materia = dbq('SELECT * FROM materias WHERE id = ?').get(r.materia_id) as any;
  if (materia && materia.senha) {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const payload = await verifyJwt(authHeader.slice(7));
      if (payload?.sub) {
        const profId = Number(payload.sub);
        if (payload.role === 'admin' || canManageCurso({ id: profId, role: payload.role }, materia.curso_id)) {
          return c.json(r);
        }
      }
    }

    const senha = readMateriaSenha(c);
    if ((materia.senha ?? null) !== senha) return c.text('Senha da materia incorreta', 401);
  }

  return c.json(r);
});

app.get('/atividades', async (c) => {
  const materiaId = parseId(c.req.query('materia_id'));
  if (materiaId === null) return c.text('', 400);
  const materia = dbq('SELECT * FROM materias WHERE id = ?').get(materiaId) as any;
  if (!materia) return c.text('Materia não encontrada', 404);

  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const payload = await verifyJwt(authHeader.slice(7));
    if (payload?.sub) {
      const profId = Number(payload.sub);
      if (payload.role === 'admin' || canManageCurso({ id: profId, role: payload.role }, materia.curso_id)) {
        const rows = dbq('SELECT * FROM atividades WHERE materia_id = ? ORDER BY ordem, titulo').all(materiaId);
        return c.json(rows.map(mapAtividade));
      }
    }
  }

  const senha = readMateriaSenha(c);
  if ((materia.senha ?? null) !== senha) return c.text('Senha da materia incorreta', 401);
  const rows = dbq('SELECT * FROM atividades WHERE materia_id = ? ORDER BY ordem, titulo').all(materiaId);
  return c.json(rows.map(mapAtividade));
});

app.get('/atividades/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const atv = dbq('SELECT * FROM atividades WHERE id = ?').get(id) as any;
  if (!atv) return c.text('Atividade not found', 404);
  atv.allow_password = atv.allow_password == null ? null : !!atv.allow_password;

  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const payload = await verifyJwt(authHeader.slice(7));
    if (payload?.sub) {
      const profId = Number(payload.sub);
      const materia = dbq('SELECT curso_id FROM materias WHERE id = ?').get(atv.materia_id) as any;
      if (materia && (payload.role === 'admin' || canManageCurso({ id: profId, role: payload.role }, materia.curso_id))) {
        return c.json(atv);
      }
    }
  }

  const materia = dbq('SELECT * FROM materias WHERE id = ?').get(atv.materia_id) as any;
  if (!materia) return c.text('Materia not found for activity', 500);
  const inputSenha = readMateriaSenha(c) ?? '';
  const materiaSenha = materia.senha ?? '';
  const atvSenha = atv.senha ?? '';
  const isProtected = !!atv.allow_password;

  if (inputSenha === atvSenha && isProtected) {
    return c.json(atv);
  } else if (inputSenha === materiaSenha) {
    if (isProtected) atv.json_data = null;
    return c.json(atv);
  } else {
    return c.text('Senha incorreta', 401);
  }
});

interface CorrecaoResultado {
  acertos: number;
  total: number;
  pontuacao: number;
}

const MAX_RANKING_PONTUACAO = 1_000_000;

function corrigirObjetivas(jsonData: string | null, respostasStr: string): CorrecaoResultado {
  let questoes: any[] = [];
  let respostasAluno: { questao?: string; resposta?: string | null }[] = [];
  try {
    const parsed = jsonData ? JSON.parse(jsonData) : null;
    if (parsed && Array.isArray(parsed.questions)) questoes = parsed.questions;
  } catch {
    questoes = [];
  }
  try {
    const parsedResp = JSON.parse(respostasStr);
    if (Array.isArray(parsedResp)) respostasAluno = parsedResp;
  } catch {
    respostasAluno = [];
  }

  const respByQuestao = new Map<string, string | null | undefined>();
  for (const r of respostasAluno) {
    if (typeof r.questao === 'string') respByQuestao.set(r.questao, r.resposta);
  }

  let acertos = 0;
  let total = 0;
  for (const q of questoes) {
    const options = Array.isArray(q?.options) ? q.options : [];
    const correta = options.find((o: any) => o && o.correct === true);
    if (!correta || typeof correta.text !== 'string') continue;
    total++;
    const chave = typeof q.title === 'string' ? q.title : typeof q.content === 'string' ? q.content : '';
    if (!chave) continue;
    const respAluno = respByQuestao.get(chave);
    if (typeof respAluno === 'string' && respAluno.trim() === correta.text.trim()) {
      acertos++;
    }
  }

  return { acertos, total, pontuacao: acertos };
}

function formatPublicName(fullName: string): string {
  const parts = String(fullName || '').trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || 'Aluno';
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

app.post('/ranking', submissionLimiter, async (c) => {
  const body = await parseBody(c);
  if (!body) return c.text('Dados inválidos', 400);
  const atividadeId = parseId(String(body.atividade_id));
  const pontuacao = Number(body.pontuacao);
  if (atividadeId === null || isNaN(pontuacao)) return c.text('Parâmetros inválidos', 400);
  const atv = dbq('SELECT id FROM atividades WHERE id = ?').get(atividadeId);
  if (!atv) return c.text('Atividade não encontrada', 404);

  const rawNome = String(body.nome_jogador || 'Aluno').trim();
  const nomePublico = formatPublicName(rawNome);
  const pontuacaoInt = Math.floor(pontuacao);
  const pontuacaoCap = Math.min(Math.max(pontuacaoInt, 0), MAX_RANKING_PONTUACAO);

  try {
    const r = db
      .query(
        `INSERT INTO ranking (atividade_id, nome_jogador, pontuacao)
         VALUES (?, ?, ?) RETURNING *`
      )
      .get(atividadeId, nomePublico, pontuacaoCap);
    return c.json(r, 200);
  } catch (e: any) {
    return c.text('Erro interno ao registrar ranking', 500);
  }
});

app.get('/ranking/:atividade_id', (c) => {
  const id = parseId(c.req.param('atividade_id'));
  if (id === null) return c.text('', 400);
  try {
    const rows = dbq('SELECT id, atividade_id, nome_jogador, pontuacao, data_envio FROM ranking WHERE atividade_id = ? ORDER BY pontuacao DESC LIMIT 50').all(id);
    return c.json(rows);
  } catch (e: any) {
    return c.text('Erro interno ao listar ranking', 500);
  }
});

// ---------- Submissões de Respostas de Alunos ----------

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateConsultaToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

app.post('/submeter-resposta', submissionLimiter, async (c) => {
  const body = await parseBody(c);
  if (!body) return c.text('Dados inválidos', 400);
  const atividadeId = parseId(String(body.atividade_id));
  if (atividadeId === null) return c.text('ID de atividade inválido', 400);
  if (!body.aluno_nome || !body.aluno_email || !isValidEmail(body.aluno_email) || !body.respostas) {
    return c.text('Informe nome, e-mail válido e respostas.', 400);
  }
  const atv = dbq('SELECT id, json_data FROM atividades WHERE id = ?').get(atividadeId);
  if (!atv) return c.text('Atividade não encontrada', 404);

  const email = String(body.aluno_email).trim();
  const nome = String(body.aluno_nome).trim();
  const respostasStr = String(body.respostas).trim();

  const token = generateConsultaToken();
  const tokenHash = await sha256Hex(token);
  const emailHash = await hashEmail(email);

  const encNome = await encryptData(nome);
  const encEmail = await encryptData(email);
  const encRespostas = await encryptData(respostasStr);

  const correcao = corrigirObjetivas(atv.json_data, respostasStr);

  try {
    const r = db
      .query(
        `INSERT INTO respostas_alunos (atividade_id, aluno_nome, aluno_email, aluno_email_hash, respostas, consulta_token_hash)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING id, atividade_id, criado_em`
      )
      .get(atividadeId, encNome, encEmail, emailHash, encRespostas, tokenHash) as any;

    await logAudit(c, 'submeter_resposta', `atividade:${atividadeId}`, { email_hash: emailHash });

    return c.json({
      id: r.id,
      atividade_id: r.atividade_id,
      aluno_nome: nome,
      aluno_email: email,
      respostas: respostasStr,
      criado_em: r.criado_em,
      consulta_token: token,
      acertos: correcao.acertos,
      total: correcao.total,
      pontuacao: correcao.pontuacao
    }, 201);
  } catch (e: any) {
    return c.text('Erro interno ao salvar resposta', 500);
  }
});

// Direitos do Titular (Art. 18 LGPD) - Consulta e exclusão de respostas próprias do aluno.
// Exige prova de posse do e-mail via token de consulta (devolvido pelo POST /submeter-resposta).
// O token NUNCA é logado. O backend guarda apenas o SHA-256 do token no DB.

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

app.get('/aluno/minhas-respostas', submissionLimiter, async (c) => {
  const email = c.req.query('email');
  const token = c.req.query('token');
  if (!email || !isValidEmail(email)) return c.text('Informe um e-mail válido.', 400);
  if (!token || typeof token !== 'string' || token.length < 16) return c.text('Token de consulta obrigatório.', 401);

  const tokenHash = await sha256Hex(token);
  const emailHash = await hashEmail(email);

  const own = dbq(
    'SELECT 1 AS ok FROM respostas_alunos WHERE aluno_email_hash = ? AND consulta_token_hash = ? LIMIT 1'
  ).get(emailHash, tokenHash);
  if (!own) return c.text('Token inválido para este e-mail.', 401);

  const rows = dbq(
    `SELECT r.id, r.atividade_id, r.aluno_nome, r.aluno_email, r.respostas, r.criado_em, a.titulo as atividade_titulo
     FROM respostas_alunos r
     JOIN atividades a ON r.atividade_id = a.id
     WHERE r.aluno_email_hash = ? AND r.consulta_token_hash = ?
     ORDER BY r.criado_em DESC`
  ).all(emailHash, tokenHash);

  const decryptedRows = await Promise.all(
    rows.map(async (row: any) => ({
      ...row,
      aluno_nome: await decryptData(row.aluno_nome),
      aluno_email: await decryptData(row.aluno_email),
      respostas: await decryptData(row.respostas),
    }))
  );

  return c.json(decryptedRows);
});

app.delete('/aluno/minhas-respostas', submissionLimiter, async (c) => {
  const email = c.req.query('email');
  const token = c.req.query('token');
  if (!email || !isValidEmail(email)) return c.text('Informe um e-mail válido.', 400);
  if (!token || typeof token !== 'string' || token.length < 16) return c.text('Token de consulta obrigatório.', 401);

  const tokenHash = await sha256Hex(token);
  const emailHash = await hashEmail(email);

  const tokenCheck = dbq(
    'SELECT 1 AS ok FROM respostas_alunos WHERE aluno_email_hash = ? AND consulta_token_hash = ? LIMIT 1'
  ).get(emailHash, tokenHash);
  if (!tokenCheck) return c.text('Token inválido para este e-mail.', 401);

  dbq('DELETE FROM respostas_alunos WHERE aluno_email_hash = ? AND consulta_token_hash = ?').run(emailHash, tokenHash);

  await logAudit(c, 'excluir_respostas_aluno', 'respostas_alunos', { email_hash: emailHash });

  return c.body(null, 204);
});

app.get('/atividades/:id/respostas', professorAuth, async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('ID inválido', 400);
  const atv = dbq('SELECT materia_id FROM atividades WHERE id = ?').get(id) as any;
  if (!atv) return c.text('Atividade não encontrada', 404);
  if (!(await canManageMateria(c, atv.materia_id))) return c.text('Access denied', 403);

  const rows = dbq('SELECT * FROM respostas_alunos WHERE atividade_id = ? ORDER BY criado_em DESC').all(id);

  const decryptedRows = await Promise.all(
    rows.map(async (row: any) => ({
      ...row,
      aluno_nome: await decryptData(row.aluno_nome),
      aluno_email: await decryptData(row.aluno_email),
      respostas: await decryptData(row.respostas),
    }))
  );

  return c.json(decryptedRows);
});

app.delete('/respostas/:id', professorAuth, async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('ID inválido', 400);
  const resp = dbq('SELECT atividade_id FROM respostas_alunos WHERE id = ?').get(id) as any;
  if (!resp) return c.text('Resposta não encontrada', 404);
  const atv = dbq('SELECT materia_id FROM atividades WHERE id = ?').get(resp.atividade_id) as any;
  if (atv && !(await canManageMateria(c, atv.materia_id))) return c.text('Access denied', 403);

  dbq('DELETE FROM respostas_alunos WHERE id = ?').run(id);

  await logAudit(c, 'excluir_resposta_professor', `resposta:${id}`);

  return c.body(null, 204);
});

app.post('/send-mail', async (c) => {
  const body = await parseBody(c);
  if (!body) return c.json({ success: false, message: 'Erro ao enfileirar email' }, 200);
  const req: MailRequest = {
    to: body.to ?? '',
    subject: body.subject ?? '',
    template: body.template,
    variables: body.variables,
  };
  const resp = await sendMail(req);
  return c.json(resp, 200);
});

app.get('/db-test', (c) => {
  try {
    dbq('SELECT 1').get();
    return c.json({ success: true, message: 'Conexão com SQLite OK!' });
  } catch {
    return c.json({ success: false, message: 'Erro na conexão com o banco de dados.' });
  }
});

// ---------- Admin: CRUD de professores ----------

function mapProfessor(row: any) {
  if (!row) return row;
  return { id: row.id, nome: row.nome, email: row.email, role: row.role, status: row.status, criado_em: row.criado_em };
}

app.get('/professores', adminAuth, async (c) => {
  const rows = dbq(`
    SELECT p.id, p.nome, p.email, p.role, p.status, p.criado_em,
           (SELECT COUNT(*) FROM curso_professores cp WHERE cp.professor_id = p.id) AS total_cursos
    FROM professores p ORDER BY p.nome
  `).all();
  return c.json(rows.map(r => ({ ...mapProfessor(r), total_cursos: Number((r as any).total_cursos || 0) })));
});

app.post('/professores', adminAuth, async (c) => {
  const body = await parseBody(c);
  if (!body?.nome || !body?.email || !body?.password || !isValidEmail(body.email)) {
    return c.text('Dados inválidos. Informe nome, email e senha válidos.', 400);
  }
  const existing = dbq('SELECT id FROM professores WHERE email = ?').get(body.email);
  if (existing) return c.text('Email already registered', 409);
  const role = body.role === 'admin' ? 'admin' : 'professor';
  const { hash, salt } = await hashPassword(body.password);
  const r = dbq('INSERT INTO professores (email, nome, senha_hash, salt, role, status) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, nome, email, role, status, criado_em')
    .get(body.email, body.nome, hash, salt, role, 'ativo');
  return c.json(mapProfessor(r), 201);
});

app.put('/professores/:id', adminAuth, async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const existing = dbq('SELECT * FROM professores WHERE id = ?').get(id) as any;
  if (!existing) return c.text('Professor not found', 404);

  const nome = typeof body.nome === 'string' && body.nome.trim() ? body.nome.trim() : existing.nome;
  let email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : existing.email;
  if (email !== existing.email) {
    if (!isValidEmail(email)) return c.text('Email inválido', 400);
    const dup = dbq('SELECT id FROM professores WHERE email = ? AND id != ?').get(email, id);
    if (dup) return c.text('Email already registered', 409);
  }
  const role = body.role === 'admin' ? 'admin' : body.role === 'professor' ? 'professor' : existing.role;
  let status = existing.status;
  if (body.status !== undefined) {
    if (body.status !== 'ativo' && body.status !== 'pendente') return c.text('Status inválido', 400);
    status = body.status;
  }

  if (typeof body.password === 'string' && body.password) {
    const { hash, salt } = await hashPassword(body.password);
    dbq('UPDATE professores SET nome = ?, email = ?, senha_hash = ?, salt = ?, role = ?, status = ? WHERE id = ?')
      .run(nome, email, hash, salt, role, status, id);
  } else {
    dbq('UPDATE professores SET nome = ?, email = ?, role = ?, status = ? WHERE id = ?').run(nome, email, role, status, id);
  }

  const r = dbq('SELECT id, nome, email, role, status, criado_em FROM professores WHERE id = ?').get(id);
  return c.json(mapProfessor(r));
});

app.delete('/professores/:id', adminAuth, async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const existing = dbq('SELECT id FROM professores WHERE id = ?').get(id);
  if (!existing) return c.text('Professor not found', 404);
  dbq('DELETE FROM professores WHERE id = ?').run(id);
  return c.body(null, 204);
});

app.get('/professores/:id/cursos', adminAuth, (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const rows = dbq(
    `SELECT c.id, c.slug, c.nome, c.cor, c.icone, c.descricao FROM curso_professores cp
     JOIN cursos c ON c.id = cp.curso_id
     WHERE cp.professor_id = ? ORDER BY c.nome`
  ).all(id);
  return c.json(rows);
});

app.put('/professores/:id/cursos', adminAuth, async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const prof = dbq('SELECT id FROM professores WHERE id = ?').get(id);
  if (!prof) return c.text('Professor not found', 404);
  const body = await parseBody(c);
  if (!body || !Array.isArray(body.curso_ids)) return c.text('curso_ids required', 400);
  const cursoIds = body.curso_ids.map(Number).filter((n: number) => Number.isInteger(n));

  db.transaction(() => {
    dbq('DELETE FROM curso_professores WHERE professor_id = ?').run(id);
    const ins = db.query('INSERT OR IGNORE INTO curso_professores (curso_id, professor_id) VALUES (?, ?)');
    for (const cid of cursoIds) {
      if (dbq('SELECT id FROM cursos WHERE id = ?').get(cid)) ins.run(cid, id);
    }
  })();

  const rows = dbq(
    `SELECT c.id, c.slug, c.nome, c.cor, c.icone, c.descricao FROM curso_professores cp
     JOIN cursos c ON c.id = cp.curso_id
     WHERE cp.professor_id = ? ORDER BY c.nome`
  ).all(id);
  return c.json(rows);
});

app.get('/materias/*', async (c) => {
  let rest: string;
  try {
    rest = decodeURIComponent(c.req.path.replace(/^\/materias\/?/, ''));
  } catch {
    return c.text('Bad request', 400);
  }
  const safe = rest
    .split('/')
    .map((seg) => seg.replace(/\.\./g, '').replace(/\\/g, ''))
    .join('/');
  const firstSeg = safe.split('/')[0] || '';
  if (!firstSeg) return c.text('Not found', 404);

  const materia = dbq('SELECT id, senha FROM materias WHERE slug = ?').get(firstSeg) as { id: number; senha: string } | undefined;
  if (materia) {
    const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
    const prof = token ? verifyJwt(token) : null;
    const isProfessor = prof && (prof.role === 'admin' || !!dbq('SELECT 1 FROM curso_professores cp INNER JOIN materias m ON m.curso_id = cp.curso_id WHERE m.id = ? AND cp.professor_id = ?').get(materia.id, Number(prof.sub)));
    if (!isProfessor) {
      const senha = readMateriaSenha(c);
      if (!senha || senha !== materia.senha) return c.text('Unauthorized', 401);
    }
  }

  const abs = path.join(resolveFrontendDir(), 'materias', safe);
  const served = serveFileWithCsp(abs);
  if (!served) return c.text('Not found', 404);
  return served;
});

const frontendStaticDir = process.env.FRONTEND_STATIC_DIR || (existsSync('/app/frontend_static') ? '/app/frontend_static' : path.join(import.meta.dir, '..', '..', 'frontend', 'dist'));

app.use('*', async (c, next) => {
  await next();
  if (c.res.status === 404 && existsSync(frontendStaticDir)) {
    const reqPath = c.req.path;
    const filePath = path.join(frontendStaticDir, reqPath.startsWith('/') ? reqPath.slice(1) : reqPath);
    const fileResp = serveFileWithCsp(filePath);
    if (fileResp) return fileResp;
    const indexPath = path.join(frontendStaticDir, 'index.html');
    const indexResp = serveFileWithCsp(indexPath, 'text/html; charset=utf-8');
    if (indexResp) return indexResp;
  }
});

export default app;
