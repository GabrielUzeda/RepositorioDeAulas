import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { existsSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { db, purgeOldRanking } from './db';
import { sanitizeSlug, sanitizePathOrUrl, encryptData, decryptData, hashEmail } from './utils';
import { professorAuth, adminAuth, hashPassword, verifyPassword, signJwt, verifyJwt, isValidEmail, createRateLimiter, extractClientIp } from './auth';
import { sendMail, type MailRequest } from './mailer';
import { processMarpContent, resolveFrontendDir, generateMarpNextStandaloneHtml } from './marp';

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

// [3.9] CSP emitida pelo backend. Permissiva para MarpNext + Mermaid + KaTeX (cdn.jsdelivr.net, esm.sh, Google Fonts).
const CSP_HTML = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://esm.sh https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://esm.sh https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com",
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
    allowHeaders: ['Content-Type', 'Authorization', 'X-Curso-Senha', 'X-Materia-Senha'],
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
const draftLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10, message: 'Muitas requisições de rascunho. Aguarde 1 minuto.' });

const dbq = (sql: string) => db.query<Record<string, any>, any[]>(sql);

function mapAtividade(row: any) {
  if (row == null) return row;
  return { ...row, allow_password: row.allow_password == null ? null : !!row.allow_password };
}

function stripGabarito(row: any): any {
  if (row == null || row.json_data == null) return row;
  const out = { ...row };
  try {
    const parsed = typeof out.json_data === 'string' ? JSON.parse(out.json_data) : out.json_data;
    const type = row.tipo || parsed?.meta?.type || parsed?.type;
    if (type === 'reforco' || type === 'roleta' || type === 'minigame') return row;
    if (parsed && Array.isArray(parsed.questions)) {
      for (const q of parsed.questions) {
        if (q && Array.isArray(q.options)) {
          for (const opt of q.options) {
            if (opt && typeof opt === 'object') delete opt.correct;
          }
        }
      }
      out.json_data = JSON.stringify(parsed);
    }
  } catch {
    return out;
  }
  return out;
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

// [SEG] Escapa valor para inserção segura em contexto HTML (e-mails, atributos).
// Previne HTML injection / stored XSS a partir de dados de alunos/professores.
function escapeHtml(value: any): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// [2.6] Leitura única e coesa da "senha" de acesso do aluno ao curso.
function readCursoSenha(c: any): string | null {
  const header = c.req.header('x-curso-senha')?.trim() || c.req.header('x-materia-senha')?.trim();
  if (header) return header;
  const q = c.req.query('senha');
  return q && q.length > 0 ? q : null;
}

// [2.7] Valida senha de curso e de atividade para submissões/ranking do aluno.
// Só exige senha quando o curso tem senha (curso.senha) ou a atividade é
// protegida (allow_password). Cursos sem senha seguem liberados.
function validarSenhasSubmissao(body: any, atv: any): string | null {
  const disciplina = dbq('SELECT id, curso_id FROM disciplinas WHERE id = ?').get(atv.disciplina_id) as any;
  if (!disciplina) return 'Disciplina não encontrada';
  const curso = dbq('SELECT id, senha FROM cursos WHERE id = ?').get(disciplina.curso_id) as any;
  if (!curso) return 'Curso não encontrado';

  if (curso.senha && body.senha_curso !== curso.senha) {
    return 'Senha do curso incorreta';
  }
  if (atv.allow_password && atv.senha && body.senha_atividade !== atv.senha) {
    return 'Senha da atividade incorreta';
  }
  return null;
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

function getDisciplinaCursoId(disciplinaId: number): number | null {
  const d = dbq('SELECT curso_id FROM disciplinas WHERE id = ?').get(disciplinaId) as any;
  return d ? Number(d.curso_id) : null;
}

async function canManageDisciplina(c: any, disciplinaId: number): Promise<boolean> {
  const prof = getProfessor(c);
  if (!prof) return false;
  const cursoId = getDisciplinaCursoId(disciplinaId);
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
      `INSERT INTO cursos (slug, nome, cor, icone, senha, descricao)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(slug, body.nome ?? '', body.cor ?? null, body.icone ?? null, body.senha ?? null, body.descricao ?? null);
  return c.json(r, 201);
}

async function updateCurso(c: any) {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const existing = dbq('SELECT * FROM cursos WHERE id = ?').get(id) as any;
  if (!existing) return c.text('Curso not found', 404);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const slug = sanitizeSlug(body.slug ?? body.nome ?? existing.slug);
  if (!slug) return c.text('Informe um nome válido para o curso.', 400);

  let novaSenha = existing.senha;
  if (body.senha !== undefined) {
    novaSenha = body.senha === '' || body.senha === null ? null : String(body.senha);
  }

  const r = db
    .query(
      `UPDATE cursos
       SET slug = ?, nome = ?, cor = ?, icone = ?, senha = ?, descricao = ?,
           atualizado_em = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id = ?
       RETURNING *`
    )
    .get(slug, body.nome ?? existing.nome, body.cor ?? existing.cor, body.icone ?? existing.icone, novaSenha, body.descricao ?? existing.descricao, id);
  return c.json(r, 200);
}

// ---------- Disciplina handlers ----------

async function createDisciplina(c: any) {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const cursoId = parseId(String(body.curso_id));
  if (cursoId === null) return c.text('', 400);
  if (!canManageCurso(prof, cursoId)) return c.text('Access denied', 403);
  const slug = sanitizeSlug(body.slug ?? body.nome ?? '');
  if (!slug) return c.text('Informe um nome válido para a disciplina.', 400);
  const r = db
    .query(
      `INSERT INTO disciplinas (curso_id, slug, nome, cor, icone, descricao)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(cursoId, slug, body.nome ?? '', body.cor ?? null, body.icone ?? null, body.descricao ?? null);
  return c.json(r, 201);
}

async function updateDisciplina(c: any) {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  if (!(await canManageDisciplina(c, id))) return c.text('Disciplina not found or access denied', 404);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const slug = sanitizeSlug(body.slug ?? body.nome ?? '');
  const r = db
    .query(
      `UPDATE disciplinas
       SET slug = COALESCE(NULLIF(?, ''), slug), nome = COALESCE(NULLIF(?, ''), nome),
           cor = COALESCE(?, cor), icone = COALESCE(?, icone),
           descricao = COALESCE(?, descricao),
           atualizado_em = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id = ?
       RETURNING *`
    )
    .get(slug, body.nome ?? '', body.cor ?? null, body.icone ?? null, body.descricao ?? null, id);
  if (!r) return c.text('Disciplina not found', 404);
  return c.json(r, 200);
}

function removeAulaFiles(caminho: string | null | undefined) {
  if (!caminho || !caminho.startsWith('materias/') || caminho.includes('..')) return;
  const baseDir = resolveFrontendDir();
  const htmlPath = path.join(baseDir, caminho);
  const mdPath = htmlPath.replace(/\.html$/, '.md');
  for (const p of [htmlPath, mdPath]) {
    try {
      if (existsSync(p)) unlinkSync(p);
    } catch (e) { /* best effort */ }
  }
}

async function createAula(c: any) {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const disciplinaId = parseId(String(body.disciplina_id ?? body.materia_id));
  if (disciplinaId === null) return c.text('', 400);
  if (!(await canManageDisciplina(c, disciplinaId))) return c.text('Access denied', 403);
  const disciplina = dbq('SELECT * FROM disciplinas WHERE id = ?').get(disciplinaId) as any;
  const markdown = body.markdown ?? body.marp_markdown ?? body.conteudo_md ?? null;
  let finalCaminho = sanitizePathOrUrl(body.caminho ?? '');
  if (markdown !== null && markdown !== undefined) {
    const res = processMarpContent(disciplina.slug, body.titulo ?? '', markdown);
    if (res.error) return c.text(res.error, 500);
    finalCaminho = res.caminho!;
  }
  const r = db
    .query(
      `INSERT INTO aulas (disciplina_id, titulo, caminho, icone, descricao, ordem, conteudo_md)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(disciplinaId, body.titulo ?? '', finalCaminho, body.icone ?? null, body.descricao ?? null, body.ordem ?? 0, markdown);
  return c.json(r, 201);
}

async function updateAula(c: any) {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const disciplinaId = parseId(String(body.disciplina_id ?? body.materia_id));
  if (disciplinaId === null) return c.text('', 400);
  if (!(await canManageDisciplina(c, disciplinaId))) return c.text('Access denied', 403);
  const oldAula = dbq('SELECT caminho FROM aulas WHERE id = ?').get(id) as any;
  if (!oldAula) return c.text('Aula not found', 404);
  const disciplina = dbq('SELECT * FROM disciplinas WHERE id = ?').get(disciplinaId) as any;
  const markdown = body.markdown ?? body.marp_markdown ?? body.conteudo_md ?? null;
  let finalCaminho = sanitizePathOrUrl(body.caminho ?? '');
  if (markdown !== null && markdown !== undefined) {
    const res = processMarpContent(disciplina.slug, body.titulo ?? '', markdown);
    if (res.error) return c.text(res.error, 500);
    finalCaminho = res.caminho!;
  }
  const r = db
    .query(
      `UPDATE aulas
       SET disciplina_id = ?, titulo = ?, caminho = ?, icone = ?, descricao = ?, ordem = ?, conteudo_md = ?,
           atualizado_em = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id = ?
       RETURNING *`
    )
    .get(disciplinaId, body.titulo ?? '', finalCaminho, body.icone ?? null, body.descricao ?? null, body.ordem ?? 0, markdown, id);
  if (!r) return c.text('Aula not found', 404);
  if (oldAula.caminho && oldAula.caminho !== finalCaminho) {
    removeAulaFiles(oldAula.caminho);
  }
  return c.json(r, 200);
}

async function createAtividade(c: any) {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const disciplinaId = parseId(String(body.disciplina_id ?? body.materia_id));
  if (disciplinaId === null) return c.text('', 400);
  if (!(await canManageDisciplina(c, disciplinaId))) return c.text('Access denied', 403);
  const externalId = body.external_id != null ? sanitizeSlug(body.external_id) : null;
  const caminho = sanitizePathOrUrl((body.caminho ?? '') || (body.slug ?? ''));
  const r = db
    .query(
      `INSERT INTO atividades (disciplina_id, external_id, titulo, descricao, caminho, icone, json_data, tipo, senha, allow_password, ordem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(
      disciplinaId,
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
  const disciplinaId = parseId(String(body.disciplina_id ?? body.materia_id));
  if (disciplinaId === null) return c.text('', 400);
  if (!(await canManageDisciplina(c, disciplinaId))) return c.text('Access denied', 403);
  const externalId = body.external_id != null ? sanitizeSlug(body.external_id) : null;
  const caminho = sanitizePathOrUrl((body.caminho ?? '') || (body.slug ?? ''));
  const r = db
    .query(
      `UPDATE atividades
       SET disciplina_id = ?, external_id = ?, titulo = ?, descricao = ?, caminho = ?, icone = ?,
           json_data = ?, tipo = ?, senha = ?, allow_password = ?, ordem = ?,
           atualizado_em = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id = ?
       RETURNING *`
    )
    .get(
      disciplinaId,
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

  if (Object.hasOwn(body, 'professor_ids') && Array.isArray(body.professor_ids)) {
    const professorIds = body.professor_ids.map(Number).filter((n: number) => Number.isInteger(n));
    db.transaction(() => {
      dbq('DELETE FROM curso_professores WHERE curso_id = ?').run(id);
      const ins = db.query('INSERT OR IGNORE INTO curso_professores (curso_id, professor_id) VALUES (?, ?)');
      for (const pid of professorIds) {
        if (dbq('SELECT id FROM professores WHERE id = ?').get(pid)) ins.run(id, pid);
      }
    })();
  }

  const rows = dbq(
    `SELECT p.id, p.nome, p.email, p.role FROM curso_professores cp
     JOIN professores p ON p.id = cp.professor_id
     WHERE cp.curso_id = ? ORDER BY p.nome`
  ).all(id);
  return c.json(rows);
});

app.post('/disciplinas', professorAuth, createDisciplina);
app.post('/materias', professorAuth, createDisciplina);
app.put('/disciplinas/:id', professorAuth, updateDisciplina);
app.post('/disciplinas/:id', professorAuth, updateDisciplina);
app.delete('/disciplinas/:id', professorAuth, async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  if (!(await canManageDisciplina(c, id))) return c.text('Access denied', 403);
  dbq('DELETE FROM disciplinas WHERE id = ?').run(id);
  await logAudit(c, 'excluir_disciplina', `disciplina:${id}`);
  return c.body(null, 204);
});

app.post('/aulas', professorAuth, createAula);
app.put('/aulas/:id', professorAuth, updateAula);
app.delete('/aulas/:id', professorAuth, async (c) => {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const aula = dbq('SELECT disciplina_id, caminho FROM aulas WHERE id = ?').get(id) as any;
  if (!aula) return c.text('Aula not found', 404);
  if (!(await canManageDisciplina(c, aula.disciplina_id))) return c.text('Access denied', 403);
  dbq('DELETE FROM aulas WHERE id = ?').run(id);
  removeAulaFiles(aula.caminho);
  return c.body(null, 204);
});

async function handleMarpRender(c: any) {
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const { titulo, markdown } = body as { titulo?: unknown; markdown?: unknown };
  if (typeof titulo !== 'string' || typeof markdown !== 'string' || markdown.trim() === '') {
    return c.json({ error: 'invalid body' }, 400);
  }
  const html = generateMarpNextStandaloneHtml(titulo, markdown);
  return c.json({ html });
}

app.post('/marp/render', professorAuth, handleMarpRender);
app.post('/api/marp/render', professorAuth, handleMarpRender);

app.post('/atividades', professorAuth, createAtividade);
app.put('/atividades/:id', professorAuth, updateAtividade);
app.delete('/atividades/:id', professorAuth, async (c) => {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const atv = dbq('SELECT disciplina_id FROM atividades WHERE id = ?').get(id) as any;
  if (!atv) return c.text('Atividade not found', 404);
  if (!(await canManageDisciplina(c, atv.disciplina_id))) return c.text('Access denied', 403);
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
             (SELECT COUNT(*) FROM disciplinas d WHERE d.curso_id = c.id) AS total_disciplinas,
             (SELECT COUNT(*) FROM curso_professores cp WHERE cp.curso_id = c.id) AS total_professores
           FROM cursos c ORDER BY c.nome`
        ).all();
        return c.json(rows);
      }
      const rows = dbq(
        `SELECT c.*,
           (SELECT COUNT(*) FROM disciplinas d WHERE d.curso_id = c.id) AS total_disciplinas,
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
       CASE WHEN c.senha IS NOT NULL AND c.senha <> '' THEN 1 ELSE 0 END AS possui_senha,
       (SELECT COUNT(*) FROM disciplinas d WHERE d.curso_id = c.id) AS total_disciplinas,
       (SELECT COUNT(*) FROM curso_professores cp WHERE cp.curso_id = c.id) AS total_professores
     FROM cursos c ORDER BY c.nome`
  ).all();
  return c.json(rows);
});

app.get('/cursos/:id', (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const r = dbq('SELECT id, slug, nome, cor, icone, descricao, CASE WHEN senha IS NOT NULL AND senha <> \'\' THEN 1 ELSE 0 END AS possui_senha FROM cursos WHERE id = ?').get(id);
  if (!r) return c.text('Curso not found', 404);
  return c.json(r);
});

async function verifyCursoSenha(c: any, cursoId: number) {
  const curso = dbq('SELECT id, slug, nome, senha FROM cursos WHERE id = ?').get(cursoId) as any;
  if (!curso) return c.text('Curso não encontrado', 404);
  const body = await parseBody(c);
  const input = body && body.senha != null ? String(body.senha).trim() : null;
  if (!curso.senha) {
    return c.json({ ok: true, message: 'Curso sem senha', curso: { id: curso.id, slug: curso.slug, nome: curso.nome } });
  }
  if (!input) return c.text('Senha é obrigatória', 400);
  if (input !== curso.senha) return c.text('Senha incorreta', 401);
  return c.json({ ok: true, message: 'Senha correta', curso: { id: curso.id, slug: curso.slug, nome: curso.nome } });
}

app.post('/cursos/:id/verificar-senha', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  return verifyCursoSenha(c, id);
});

app.post('/cursos/slug/:slug/verificar-senha', async (c) => {
  const slug = sanitizeSlug(c.req.param('slug'));
  if (!slug) return c.text('', 400);
  const curso = dbq('SELECT id FROM cursos WHERE slug = ?').get(slug) as any;
  if (!curso) return c.text('Curso não encontrado', 404);
  return verifyCursoSenha(c, Number(curso.id));
});

app.get('/cursos/:id/disciplinas', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const curso = dbq('SELECT id FROM cursos WHERE id = ?').get(id);
  if (!curso) return c.text('Curso não encontrado', 404);
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const payload = await verifyJwt(authHeader.slice(7));
    if (payload?.sub) {
      const profId = Number(payload.sub);
      if (payload.role === 'admin' || canManageCurso({ id: profId, role: payload.role }, id)) {
        const rows = dbq('SELECT * FROM disciplinas WHERE curso_id = ? ORDER BY nome').all(id);
        return c.json(rows);
      }
    }
  }
  const rows = dbq('SELECT id, curso_id, slug, nome, cor, icone, descricao FROM disciplinas WHERE curso_id = ? ORDER BY nome').all(id);
  return c.json(rows);
});

app.get('/disciplinas/:id', (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const r = dbq('SELECT id, curso_id, slug, nome, cor, icone, descricao FROM disciplinas WHERE id = ?').get(id);
  if (!r) return c.text('Disciplina not found', 404);
  return c.json(r);
});

app.get('/aulas', async (c) => {
  const disciplinaId = parseId(c.req.query('disciplina_id') ?? c.req.query('materia_id'));
  if (disciplinaId === null) return c.text('', 400);
  const disciplina = dbq('SELECT * FROM disciplinas WHERE id = ?').get(disciplinaId) as any;
  if (!disciplina) return c.text('Disciplina não encontrada', 404);

  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const payload = await verifyJwt(authHeader.slice(7));
    if (payload?.sub) {
      const profId = Number(payload.sub);
      if (payload.role === 'admin' || canManageCurso({ id: profId, role: payload.role }, disciplina.curso_id)) {
        const rows = dbq('SELECT * FROM aulas WHERE disciplina_id = ? ORDER BY ordem, titulo').all(disciplinaId);
        return c.json(rows);
      }
    }
  }

  const curso = dbq('SELECT id, senha FROM cursos WHERE id = ?').get(disciplina.curso_id) as any;
  if (curso && curso.senha) {
    const senha = readCursoSenha(c);
    if ((curso.senha ?? null) !== senha) return c.text('Senha do curso incorreta', 401);
  }
  const rows = dbq('SELECT * FROM aulas WHERE disciplina_id = ? ORDER BY ordem, titulo').all(disciplinaId);
  return c.json(rows);
});

app.get('/aulas/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const r = dbq('SELECT * FROM aulas WHERE id = ?').get(id) as any;
  if (!r) return c.text('Aula not found', 404);

  const disciplina = dbq('SELECT * FROM disciplinas WHERE id = ?').get(r.disciplina_id) as any;
  if (disciplina) {
    const curso = dbq('SELECT id, senha FROM cursos WHERE id = ?').get(disciplina.curso_id) as any;
    if (curso && curso.senha) {
      const authHeader = c.req.header('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const payload = await verifyJwt(authHeader.slice(7));
        if (payload?.sub) {
          const profId = Number(payload.sub);
          if (payload.role === 'admin' || canManageCurso({ id: profId, role: payload.role }, disciplina.curso_id)) {
            return c.json(r);
          }
        }
      }

      const senha = readCursoSenha(c);
      if ((curso.senha ?? null) !== senha) return c.text('Senha do curso incorreta', 401);
    }
  }

  return c.json(r);
});

app.get('/atividades', async (c) => {
  const disciplinaId = parseId(c.req.query('disciplina_id') ?? c.req.query('materia_id'));
  if (disciplinaId === null) return c.text('', 400);
  const disciplina = dbq('SELECT * FROM disciplinas WHERE id = ?').get(disciplinaId) as any;
  if (!disciplina) return c.text('Disciplina não encontrada', 404);

  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const payload = await verifyJwt(authHeader.slice(7));
    if (payload?.sub) {
      const profId = Number(payload.sub);
      if (payload.role === 'admin' || canManageCurso({ id: profId, role: payload.role }, disciplina.curso_id)) {
        const rows = dbq('SELECT * FROM atividades WHERE disciplina_id = ? ORDER BY ordem, titulo').all(disciplinaId);
        return c.json(rows.map(mapAtividade));
      }
    }
  }

  const curso = dbq('SELECT id, senha FROM cursos WHERE id = ?').get(disciplina.curso_id) as any;
  if (curso && curso.senha) {
    const senha = readCursoSenha(c);
    if ((curso.senha ?? null) !== senha) return c.text('Senha do curso incorreta', 401);
  }
  const rows = dbq('SELECT * FROM atividades WHERE disciplina_id = ? ORDER BY ordem, titulo').all(disciplinaId);
  return c.json(rows.map(stripGabarito));
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
      const disciplina = dbq('SELECT curso_id FROM disciplinas WHERE id = ?').get(atv.disciplina_id) as any;
      if (disciplina && (payload.role === 'admin' || canManageCurso({ id: profId, role: payload.role }, disciplina.curso_id))) {
        return c.json(atv);
      }
    }
  }

  const disciplina = dbq('SELECT id, curso_id FROM disciplinas WHERE id = ?').get(atv.disciplina_id) as any;
  if (!disciplina) return c.text('Disciplina not found for activity', 500);
  const curso = dbq('SELECT id, senha FROM cursos WHERE id = ?').get(disciplina.curso_id) as any;
  if (!curso) return c.text('Curso não encontrado', 500);
  const inputSenha = readCursoSenha(c) ?? '';
  const cursoSenha = curso.senha ?? '';
  const atvSenha = atv.senha ?? '';
  const isProtected = !!atv.allow_password;

  if (isProtected) {
    if (atvSenha && inputSenha === atvSenha) {
      return c.json(stripGabarito(atv));
    }
    return c.text('Senha da atividade incorreta', 401);
  }

  if (cursoSenha) {
    if (inputSenha === cursoSenha) {
      return c.json(stripGabarito(atv));
    }
    return c.text('Senha do curso incorreta', 401);
  }

  return c.json(stripGabarito(atv));
});



interface CorrecaoResultado {
  acertos: number;
  total: number;
  pontuacao: number;
}

const MAX_RANKING_PONTUACAO = 1_000_000;

function corrigirObjetivas(jsonDataStr: string | null | undefined, respostasInput: any): CorrecaoResultado {
  if (!jsonDataStr) return { acertos: 0, total: 0, pontuacao: 0 };

  let questions: any[] = [];
  try {
    const parsed = typeof jsonDataStr === 'string' ? JSON.parse(jsonDataStr) : jsonDataStr;
    questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  } catch {
    return { acertos: 0, total: 0, pontuacao: 0 };
  }

  let acertos = 0;
  let totalObjetivas = 0;

  let respostasMap: Record<string, string> = {};
  if (typeof respostasInput === 'string') {
    try {
      respostasMap = JSON.parse(respostasInput);
    } catch {
      respostasMap = { "0": respostasInput };
    }
  } else if (typeof respostasInput === 'object' && respostasInput !== null) {
    if (Array.isArray(respostasInput)) {
      for (const item of respostasInput) {
        if (item && item.questao !== undefined) respostasMap[String(item.questao)] = String(item.resposta ?? '');
      }
    } else {
      respostasMap = respostasInput;
    }
  }

  questions.forEach((q: any, idx: number) => {
    if (Array.isArray(q.options) && q.options.length > 0) {
      totalObjetivas++;
      const correta = q.options.find((opt: any) => opt && opt.correct === true);
      if (correta && typeof correta.text === 'string') {
        const keyId = q.id !== undefined ? String(q.id) : String(idx);
        const keyTitle = typeof q.title === 'string' ? q.title : '';
        const keyContent = typeof q.content === 'string' ? q.content : '';

        const respAluno = respostasMap[keyId] ?? respostasMap[String(idx)] ?? respostasMap[keyTitle] ?? respostasMap[keyContent];
        if (typeof respAluno === 'string' && respAluno.trim().toLowerCase() === correta.text.trim().toLowerCase()) {
          acertos++;
        }
      }
    }
  });
const pontuacao = totalObjetivas > 0 ? Math.round((acertos / totalObjetivas) * 100) : 0;
  return { acertos, total: totalObjetivas, pontuacao };
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
  const atv = dbq('SELECT id, allow_password, senha, disciplina_id FROM atividades WHERE id = ?').get(atividadeId) as any;
  if (!atv) return c.text('Atividade não encontrada', 404);

  const errSenha = validarSenhasSubmissao(body, atv);
  if (errSenha) return c.json({ erro: errSenha }, 403);

  const rawNome = String(body.nome_jogador || 'Aluno').trim();
  const nomePublico = formatPublicName(rawNome);
  const pontuacaoInt = Math.floor(pontuacao);
  const pontuacaoCap = Math.min(Math.max(pontuacaoInt, 0), MAX_RANKING_PONTUACAO);

  try {
    // Purga automática de registros de ranking com mais de 30 dias
    purgeOldRanking(30);

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
    // Purga automática de registros de ranking com mais de 30 dias
    purgeOldRanking(30);

    const rows = dbq('SELECT id, atividade_id, nome_jogador, pontuacao, data_envio FROM ranking WHERE atividade_id = ? ORDER BY pontuacao DESC LIMIT 50').all(id);
    return c.json(rows);
  } catch (e: any) {
    return c.text('Erro interno ao listar ranking', 500);
  }
});

app.post('/admin/expurgar-ranking', adminAuth, (c) => {
  try {
    const deletados = purgeOldRanking(30);
    return c.json({ mensagem: `Expurgo concluído. ${deletados} registros antigos ( > 30 dias) foram removidos do ranking.`, deletados });
  } catch (e: any) {
    return c.text('Erro ao expurgar registros do ranking', 500);
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

async function handleSubmeterResposta(c: any, overrideAtividadeId?: number) {
  const body = await parseBody(c);
  if (!body) return c.text('Dados inválidos', 400);
  const atividadeId = overrideAtividadeId ?? parseId(String(body.atividade_id));
  if (atividadeId === null) return c.text('ID de atividade inválido', 400);
  if (!body.aluno_nome || !body.aluno_email || !isValidEmail(body.aluno_email) || body.respostas === undefined) {
    return c.text('Informe nome, e-mail válido e respostas.', 400);
  }
  const atv = dbq(`
    SELECT a.id, a.titulo, a.descricao, a.json_data, a.allow_password, a.senha, a.disciplina_id,
           d.nome as disciplina_nome, c.nome as curso_nome
    FROM atividades a
    LEFT JOIN disciplinas d ON d.id = a.disciplina_id
    LEFT JOIN cursos c ON c.id = d.curso_id
    WHERE a.id = ?
  `).get(atividadeId) as any;
  if (!atv) return c.text('Atividade não encontrada', 404);

  const errSenha = validarSenhasSubmissao(body, atv);
  if (errSenha) return c.json({ erro: errSenha }, 403);

  const email = String(body.aluno_email).trim();
  const nome = String(body.aluno_nome).trim();
  const enviarEmail = Boolean(body.enviar_email);
  
  const respostasInput = body.respostas;
  const respostasStr = typeof respostasInput === 'string' ? respostasInput : JSON.stringify(respostasInput);

  const token = generateConsultaToken();
  const tokenHash = await sha256Hex(token);
  const emailHash = await hashEmail(email);

  const encNome = await encryptData(nome);
  const encEmail = await encryptData(email);
  const encRespostas = await encryptData(respostasStr);

  const correcao = corrigirObjetivas(atv.json_data, respostasInput);

  try {
    // Upsert: submissões repetidas do mesmo e-mail na mesma atividade
    // atualizam o registro anterior (última tentativa vence), mantendo o
    // consulta_token original para o direito de consulta LGPD.
    const existente = dbq('SELECT id, criado_em FROM respostas_alunos WHERE atividade_id = ? AND aluno_email_hash = ?').get(atividadeId, emailHash) as any;

    let r: any;
    if (existente) {
      dbq(
        'UPDATE respostas_alunos SET aluno_nome = ?, aluno_email = ?, respostas = ?, consulta_token_hash = ? WHERE id = ?'
      ).run(encNome, encEmail, encRespostas, tokenHash, existente.id);
      r = { id: existente.id, atividade_id: atividadeId, criado_em: existente.criado_em };
    } else {
      r = db
        .query(
          `INSERT INTO respostas_alunos (atividade_id, aluno_nome, aluno_email, aluno_email_hash, respostas, consulta_token_hash)
           VALUES (?, ?, ?, ?, ?, ?) RETURNING id, atividade_id, criado_em`
        )
        .get(atividadeId, encNome, encEmail, emailHash, encRespostas, tokenHash) as any;
    }

    await logAudit(c, 'submeter_resposta', `atividade:${atividadeId}`, { email_hash: emailHash });

    if (enviarEmail) {
      try {
        const escapeHtml = (str: string) => String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');

        let perguntasRespostasHtml = '';
        try {
          const rawQuestions = typeof atv.json_data === 'string' ? JSON.parse(atv.json_data) : atv.json_data;
          const questionsList = Array.isArray(rawQuestions) ? rawQuestions : (rawQuestions?.questions || rawQuestions?.perguntas || []);
          const mapRespostas = typeof respostasInput === 'object' && respostasInput !== null ? respostasInput : {};

          perguntasRespostasHtml = questionsList.map((q: any, idx: number) => {
            const qId = q.id || idx;
            const resp = mapRespostas[qId] ?? mapRespostas[String(qId)] ?? 'Não respondida';
            const respText = typeof resp === 'object' ? JSON.stringify(resp) : String(resp);
            const tituloQuestao = escapeHtml(q.title || q.titulo || q.statement || 'Pergunta');
            return `<div style="margin-bottom: 12px; padding: 10px; background-color: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
              <strong style="color: #1e293b;">Questão ${idx + 1}: ${tituloQuestao}</strong><br/>
              <span style="color: #475569;">Sua resposta: </span><span style="color: #0284c7; font-weight: bold;">${escapeHtml(respText)}</span>
            </div>`;
          }).join('');
        } catch (_e) {
          perguntasRespostasHtml = `<p>Respostas submetidas: ${escapeHtml(respostasStr)}</p>`;
        }

        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0284c7; margin-bottom: 4px;">Comprovante de Envio de Atividade</h2>
            <p style="color: #64748b; font-size: 14px; margin-top: 0;">Guardado com segurança. Conforme a LGPD, este e-mail serve como seu comprovante individual.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
            <p><strong>Aluno:</strong> ${escapeHtml(nome)}</p>
            <p><strong>Curso:</strong> ${escapeHtml(atv.curso_nome || 'N/A')}</p>
            <p><strong>Disciplina:</strong> ${escapeHtml(atv.disciplina_nome || 'N/A')}</p>
            <p><strong>Atividade:</strong> ${escapeHtml(atv.titulo || 'Atividade')}</p>
            <p><strong>Data de Envio:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            <h3 style="color: #1e293b; margin-top: 20px;">Resumo das suas respostas:</h3>
            ${perguntasRespostasHtml}
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #94a3b8;">Este é um e-mail automático enviado pelo Repositório de Aulas. Nenhuma informação pessoal sensível permanece armazenada em texto puro no nosso banco de dados.</p>
          </div>
        `;

        void sendMail({
          to: email,
          subject: `[Comprovante] Resposta enviada: ${atv.titulo || 'Atividade'}`,
          html,
        }).catch((err) => console.error('Erro ao enviar e-mail de comprovante ao aluno:', err));
      } catch (errEmail) {
        console.error('Erro ao preparar e-mail de comprovante:', errEmail);
      }
    }

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
    }, existente ? 200 : 201);
  } catch (e: any) {
    return c.text('Erro interno ao salvar resposta', 500);
  }
}

app.post('/submeter-resposta', submissionLimiter, async (c) => handleSubmeterResposta(c));

app.post('/atividades/:id/respostas', submissionLimiter, async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('ID inválido', 400);
  return handleSubmeterResposta(c, id);
});

// ---------- Endpoints de Rascunhos de Atividades (30 Dias) ----------

// [SEG] Código de recuperação de rascunho com alta entropia (~60 bits) para
// dificultar força bruta/enumeração de PII de alunos.
function generateDraftCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const len = 12;
  let code = '';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

app.post('/atividades/:id/rascunhos', draftLimiter, async (c) => {
  const atividadeId = parseId(c.req.param('id'));
  if (atividadeId === null) return c.text('ID inválido', 400);

  const body = await parseBody(c);
  if (!body) return c.text('Dados inválidos', 400);

  const atv = dbq('SELECT id FROM atividades WHERE id = ?').get(atividadeId);
  if (!atv) return c.text('Atividade não encontrada', 404);

  const nome = String(body.nome || body.aluno_nome || '').trim();
  const email = String(body.email || body.aluno_email || '').trim();
  const respostasInput = body.respostas || {};
  const respostasStr = typeof respostasInput === 'string' ? respostasInput : JSON.stringify(respostasInput);

  if (!email || !isValidEmail(email)) {
    return c.json({ success: false, error: 'E-mail válido é obrigatório para salvar o rascunho.' }, 400);
  }

  const emailHash = await hashEmail(email);
  const encNome = await encryptData(nome || 'Aluno Anônimo');
  const encEmail = await encryptData(email);
  const encRespostas = await encryptData(respostasStr);

  const now = new Date();
  const expiraDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiraEmIso = expiraDate.toISOString();

  const existente = dbq('SELECT id, codigo_recuperacao FROM rascunhos_atividades WHERE atividade_id = ? AND aluno_email_hash = ?').get(atividadeId, emailHash) as any;

  let codigo = '';
  if (existente) {
    codigo = existente.codigo_recuperacao;
    dbq(`
      UPDATE rascunhos_atividades 
      SET aluno_nome = ?, aluno_email = ?, respostas_json = ?, expira_em = ?, atualizado_em = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      WHERE id = ?
    `).run(encNome, encEmail, encRespostas, expiraEmIso, existente.id);
  } else {
    let tentativas = 0;
    do {
      codigo = generateDraftCode();
      tentativas++;
      const duplicado = dbq('SELECT 1 AS ok FROM rascunhos_atividades WHERE codigo_recuperacao = ?').get(codigo);
      if (!duplicado) break;
    } while (tentativas < 5);
    dbq(`
      INSERT INTO rascunhos_atividades (codigo_recuperacao, atividade_id, aluno_nome, aluno_email, aluno_email_hash, respostas_json, expira_em)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(codigo, atividadeId, encNome, encEmail, emailHash, encRespostas, expiraEmIso);
  }

  return c.json({
    success: true,
    codigo,
    codigo_recuperacao: codigo,
    expira_em: expiraEmIso
  });
});

app.get('/rascunhos/:codigo', draftLimiter, async (c) => {
  const rawCodigo = c.req.param('codigo');
  if (!rawCodigo || typeof rawCodigo !== 'string') return c.json({ success: false, error: 'Código inválido' }, 400);

  const codigo = rawCodigo.trim().toUpperCase();

  // Lazy cleanup de rascunhos expirados
  const nowIso = new Date().toISOString();
  dbq('DELETE FROM rascunhos_atividades WHERE expira_em < ?').run(nowIso);

  const rascunho = dbq('SELECT * FROM rascunhos_atividades WHERE codigo_recuperacao = ?').get(codigo) as any;
  if (!rascunho) {
    return c.json({ success: false, error: 'Código de rascunho inválido ou expirado.' }, 404);
  }

  try {
    const nome = await decryptData(rascunho.aluno_nome);
    const email = await decryptData(rascunho.aluno_email);
    const respostasRaw = await decryptData(rascunho.respostas_json);
    let respostas = {};
    try {
      respostas = JSON.parse(respostasRaw);
    } catch {
      respostas = { "0": respostasRaw };
    }

    return c.json({
      success: true,
      data: {
        atividade_id: rascunho.atividade_id,
        nome,
        email,
        respostas,
        expira_em: rascunho.expira_em
      }
    });
  } catch (err) {
    return c.json({ success: false, error: 'Erro ao descriptografar rascunho' }, 500);
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

  db.transaction(() => {
    dbq('DELETE FROM respostas_alunos WHERE aluno_email_hash = ? AND consulta_token_hash = ?').run(emailHash, tokenHash);
    // [LGPD] Direito à eliminação (Art. 16): cascata para rascunhos e feedbacks
    // individuais do mesmo titular (mesmo e-mail/hash), que também contêm PII.
    dbq('DELETE FROM rascunhos_atividades WHERE aluno_email_hash = ?').run(emailHash);
    dbq('DELETE FROM disciplina_feedbacks WHERE aluno_email_hash = ?').run(emailHash);
  })();

  await logAudit(c, 'excluir_respostas_aluno', 'respostas_alunos', { email_hash: emailHash });

  return c.body(null, 204);
});

app.get('/atividades/:id/respostas', professorAuth, async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('ID inválido', 400);
  const atv = dbq('SELECT disciplina_id FROM atividades WHERE id = ?').get(id) as any;
  if (!atv) return c.text('Atividade não encontrada', 404);
  if (!(await canManageDisciplina(c, atv.disciplina_id))) return c.text('Access denied', 403);

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
  const atv = dbq('SELECT disciplina_id FROM atividades WHERE id = ?').get(resp.atividade_id) as any;
  if (atv && !(await canManageDisciplina(c, atv.disciplina_id))) return c.text('Access denied', 403);

  dbq('DELETE FROM respostas_alunos WHERE id = ?').run(id);

  await logAudit(c, 'excluir_resposta_professor', `resposta:${id}`);

  return c.body(null, 204);
});

// [SEG] Endpoint de envio de e-mail restrito a admins. Não aceita HTML/texto cru
// do cliente (apenas templates pré-definidos + variáveis) para evitar open relay
// de phishing através do SMTP da escola.
app.post('/send-mail', adminAuth, async (c) => {
  const body = await parseBody(c);
  if (!body) return c.json({ success: false, message: 'Erro ao enfileirar email' }, 400);
  if (body.html || body.text) {
    return c.json({ success: false, message: 'Envio de HTML/texto cru não permitido. Use template + variables.' }, 400);
  }
  const req: MailRequest = {
    to: body.to ?? '',
    subject: body.subject ?? '',
    template: body.template,
    variables: body.variables,
  };
  const resp = await sendMail(req);
  return c.json(resp, 200);
});

app.get('/health', (c) => {
  return c.json({ status: 'ok' }, 200);
});

app.get('/db-test', adminAuth, (c) => {
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
  const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : existing.email;
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

// ==========================================
// AVALIAÇÃO E FEEDBACK CONSOLIDADO
// ==========================================

app.put('/respostas/:id/avaliacao', professorAuth, async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('ID inválido', 400);

  const resp = dbq('SELECT r.id, a.disciplina_id FROM respostas_alunos r JOIN atividades a ON a.id = r.atividade_id WHERE r.id = ?').get(id) as { id: number; disciplina_id: number } | undefined;
  if (!resp) return c.text('Resposta não encontrada', 404);

  if (!(await canManageDisciplina(c, resp.disciplina_id))) {
    return c.text('Access denied', 403);
  }

  const body = await parseBody(c);
  if (!body) return c.json({ success: false, error: 'JSON inválido' }, 400);

  const nota = body.nota !== undefined && body.nota !== null ? Number(body.nota) : null;
  const feedback = body.feedback !== undefined && body.feedback !== null ? String(body.feedback).trim() : null;

  dbq('UPDATE respostas_alunos SET nota = ?, feedback = ? WHERE id = ?').run(nota, feedback, id);
  await logAudit(c, 'avaliar_resposta', 'respostas_alunos', { resposta_id: id, nota });

  return c.json({ success: true, message: 'Avaliação salva com sucesso' });
});

app.get('/disciplinas/:id/relatorio-feedback', professorAuth, async (c) => {
  const disciplinaId = parseId(c.req.param('id'));
  if (disciplinaId === null) return c.text('ID inválido', 400);

  if (!(await canManageDisciplina(c, disciplinaId))) {
    return c.text('Access denied', 403);
  }

  const turmaFeedbackRow = dbq(
    'SELECT feedback_geral FROM disciplina_feedbacks WHERE disciplina_id = ? AND aluno_email_hash IS NULL'
  ).get(disciplinaId) as { feedback_geral: string } | undefined;

  const alunosFeedbacksRows = dbq(
    'SELECT aluno_email_hash, feedback_geral, enviado_em FROM disciplina_feedbacks WHERE disciplina_id = ? AND aluno_email_hash IS NOT NULL'
  ).all(disciplinaId) as Array<{ aluno_email_hash: string; feedback_geral: string; enviado_em: string | null }>;

  const alunoFeedbackMap = new Map<string, { feedback_geral: string; enviado_em: string | null }>();
  for (const f of alunosFeedbacksRows) {
    if (f.aluno_email_hash) {
      alunoFeedbackMap.set(f.aluno_email_hash, { feedback_geral: f.feedback_geral, enviado_em: f.enviado_em });
    }
  }

  const rawRespostasRows = dbq(
    `SELECT r.id, r.atividade_id, r.aluno_nome, r.aluno_email, r.aluno_email_hash, r.nota, r.feedback, r.enviado_em, r.criado_em, a.titulo as atividade_titulo
     FROM respostas_alunos r
     JOIN atividades a ON a.id = r.atividade_id
     WHERE a.disciplina_id = ?
     ORDER BY r.aluno_email_hash, a.ordem, r.criado_em DESC`
  ).all(disciplinaId) as Array<{
    id: number;
    atividade_id: number;
    aluno_nome: string;
    aluno_email: string;
    aluno_email_hash: string;
    nota: number | null;
    feedback: string | null;
    enviado_em: string | null;
    criado_em: string;
    atividade_titulo: string;
  }>;

  const respostasRows = await Promise.all(
    rawRespostasRows.map(async (r) => ({
      ...r,
      aluno_nome: await decryptData(r.aluno_nome),
      aluno_email: await decryptData(r.aluno_email)
    }))
  );

  const alunosMap = new Map<string, {
    aluno_nome: string;
    aluno_email: string;
    feedback_geral: string;
    atividades: Array<{
      id: number;
      atividade_id: number;
      atividade_titulo: string;
      nota: number | null;
      feedback: string | null;
      criado_em: string;
      enviado_em: string | null;
    }>;
    ja_enviado: boolean;
  }>();

  for (const r of respostasRows) {
    const hashKey = r.aluno_email_hash;
    if (!alunosMap.has(hashKey)) {
      const fAluno = alunoFeedbackMap.get(hashKey);
      alunosMap.set(hashKey, {
        aluno_nome: r.aluno_nome,
        aluno_email: r.aluno_email,
        feedback_geral: fAluno?.feedback_geral || '',
        atividades: [],
        ja_enviado: true
      });
    }

    const alunoObj = alunosMap.get(hashKey)!;
    alunoObj.atividades.push({
      id: r.id,
      atividade_id: r.atividade_id,
      atividade_titulo: r.atividade_titulo,
      nota: r.nota,
      feedback: r.feedback,
      criado_em: r.criado_em,
      enviado_em: r.enviado_em
    });

    if (!r.enviado_em) {
      alunoObj.ja_enviado = false;
    }
  }

  return c.json({
    success: true,
    data: {
      feedback_turma: turmaFeedbackRow?.feedback_geral || '',
      alunos: Array.from(alunosMap.values())
    }
  });
});

app.post('/disciplinas/:id/salvar-feedback-geral', professorAuth, async (c) => {
  const disciplinaId = parseId(c.req.param('id'));
  if (disciplinaId === null) return c.text('ID inválido', 400);

  if (!(await canManageDisciplina(c, disciplinaId))) {
    return c.text('Access denied', 403);
  }

  const body = await parseBody(c);
  if (!body) return c.json({ success: false, error: 'JSON inválido' }, 400);

  const rawEmail = body.aluno_email ? String(body.aluno_email).trim().toLowerCase() : null;
  const emailHash = rawEmail ? await hashEmail(rawEmail) : null;
  const feedbackGeral = body.feedback_geral ? String(body.feedback_geral).trim() : '';

  dbq(
    `INSERT INTO disciplina_feedbacks (disciplina_id, aluno_email_hash, feedback_geral)
     VALUES (?, ?, ?)
     ON CONFLICT(disciplina_id, aluno_email_hash) DO UPDATE SET
       feedback_geral = excluded.feedback_geral,
       atualizado_em = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`
  ).run(disciplinaId, emailHash, feedbackGeral);

  return c.json({ success: true, message: 'Feedback geral salvo com sucesso' });
});

app.post('/disciplinas/:id/enviar-emails-feedback', professorAuth, async (c) => {
  const disciplinaId = parseId(c.req.param('id'));
  if (disciplinaId === null) return c.text('ID inválido', 400);

  if (!(await canManageDisciplina(c, disciplinaId))) {
    return c.text('Access denied', 403);
  }

  const disciplina = dbq('SELECT nome FROM disciplinas WHERE id = ?').get(disciplinaId) as { nome: string } | undefined;
  if (!disciplina) return c.text('Disciplina não encontrada', 404);

  const body = await parseBody(c) || {};
  const targetEmail = body.aluno_email ? String(body.aluno_email).trim().toLowerCase() : null;
  const targetHash = targetEmail ? await hashEmail(targetEmail) : null;
  const forcarReenvio = !!body.forcar_reenvio;

  const turmaFeedbackRow = dbq(
    'SELECT feedback_geral FROM disciplina_feedbacks WHERE disciplina_id = ? AND aluno_email_hash IS NULL'
  ).get(disciplinaId) as { feedback_geral: string } | undefined;
  const feedbackTurma = turmaFeedbackRow?.feedback_geral || '';

  let sqlRespostas = `
    SELECT r.id, r.atividade_id, r.aluno_nome, r.aluno_email, r.aluno_email_hash, r.nota, r.feedback, r.enviado_em, a.titulo as atividade_titulo
    FROM respostas_alunos r
    JOIN atividades a ON a.id = r.atividade_id
    WHERE a.disciplina_id = ?
  `;
  const params: any[] = [disciplinaId];

  if (targetHash) {
    sqlRespostas += ' AND r.aluno_email_hash = ?';
    params.push(targetHash);
  } else if (!forcarReenvio) {
    sqlRespostas += ' AND r.enviado_em IS NULL';
  }

  sqlRespostas += ' ORDER BY r.aluno_email_hash, a.ordem';

  const rawRespostas = dbq(sqlRespostas).all(...params) as Array<{
    id: number;
    atividade_id: number;
    aluno_nome: string;
    aluno_email: string;
    aluno_email_hash: string;
    nota: number | null;
    feedback: string | null;
    enviado_em: string | null;
    atividade_titulo: string;
  }>;

  if (rawRespostas.length === 0) {
    return c.json({ success: true, message: 'Nenhum e-mail pendente para ser enviado', enviados: 0 });
  }

  const respostasRows = await Promise.all(
    rawRespostas.map(async (r) => ({
      ...r,
      aluno_nome: await decryptData(r.aluno_nome),
      aluno_email: await decryptData(r.aluno_email)
    }))
  );

  const alunosMap = new Map<string, {
    aluno_nome: string;
    aluno_email: string;
    respostas: typeof respostasRows;
  }>();

  for (const r of respostasRows) {
    const hashKey = r.aluno_email_hash;
    if (!alunosMap.has(hashKey)) {
      alunosMap.set(hashKey, { aluno_nome: r.aluno_nome, aluno_email: r.aluno_email, respostas: [] });
    }
    alunosMap.get(hashKey)!.respostas.push(r);
  }

  let totalEnviados = 0;
  const nowIso = new Date().toISOString();

  for (const [hashKey, item] of alunosMap.entries()) {
    const fAlunoRow = dbq(
      'SELECT feedback_geral FROM disciplina_feedbacks WHERE disciplina_id = ? AND aluno_email_hash = ?'
    ).get(disciplinaId, hashKey) as { feedback_geral: string } | undefined;
    const feedbackAluno = fAlunoRow?.feedback_geral || '';

    const atividadesHtml = item.respostas.map(r => `
      <div style="margin-bottom: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc;">
        <strong style="color: #1e293b; font-size: 14px;">${escapeHtml(r.atividade_titulo)}</strong>
        ${r.nota !== null && r.nota !== undefined ? `<span style="float: right; font-weight: bold; color: #4f46e5;">Nota: ${escapeHtml(r.nota)}/100</span>` : ''}
        ${r.feedback ? `<p style="margin: 6px 0 0 0; color: #475569; font-size: 13px;"><em>Feedback: ${escapeHtml(r.feedback)}</em></p>` : '<p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 12px;">Sem comentários específicos.</p>'}
      </div>
    `).join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #334155;">
        <h2 style="color: #4f46e5; border-b: 2px solid #e0e7ff; padding-bottom: 8px;">Relatório de Feedback - ${escapeHtml(disciplina.nome)}</h2>
        <p>Olá, <strong>${escapeHtml(item.aluno_nome)}</strong>!</p>
        <p>Segue abaixo o seu relatório consolidado de atividades e avaliações da disciplina <strong>${escapeHtml(disciplina.nome)}</strong>:</p>

        ${feedbackTurma ? `
          <div style="margin-bottom: 16px; padding: 14px; background: #e0e7ff; border-left: 4px solid #4f46e5; border-radius: 4px;">
            <strong style="color: #3730a3;">📢 Recado Geral para a Turma:</strong>
            <p style="margin: 6px 0 0 0; color: #312e81; font-size: 13px;">${escapeHtml(feedbackTurma)}</p>
          </div>
        ` : ''}

        ${feedbackAluno ? `
          <div style="margin-bottom: 16px; padding: 14px; background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px;">
            <strong style="color: #166534;">📝 Feedback do Professor para Você:</strong>
            <p style="margin: 6px 0 0 0; color: #14532d; font-size: 13px;">${escapeHtml(feedbackAluno)}</p>
          </div>
        ` : ''}

        <h3 style="color: #1e293b; margin-top: 20px;">Desempenho por Atividade</h3>
        ${atividadesHtml}

        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 24px;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">Este e-mail foi gerado automaticamente pelo Repositório de Aulas.</p>
      </div>
    `;

    try {
      await sendMail({
        to: item.aluno_email,
        subject: `[Feedback] ${disciplina.nome} - Relatório de Avaliação`,
        html: htmlContent,
      });

      const respIds = item.respostas.map(r => r.id);
      dbq(`UPDATE respostas_alunos SET enviado_em = ? WHERE id IN (${respIds.map(() => '?').join(',')})`).run(nowIso, ...respIds);
      dbq('UPDATE disciplina_feedbacks SET enviado_em = ? WHERE disciplina_id = ? AND aluno_email_hash = ?').run(nowIso, disciplinaId, hashKey);

      totalEnviados++;
    } catch (err) {
      console.error(`Erro ao enviar e-mail de feedback para ${item.aluno_email}:`, err);
    }
  }

  await logAudit(c, 'enviar_feedback_emails', 'disciplinas', { disciplina_id: disciplinaId, enviados: totalEnviados });

  return c.json({ success: true, message: `${totalEnviados} e-mails de feedback enviados com sucesso`, enviados: totalEnviados });
});

// Conteúdo estático gerado pelo marp (aulas). Exposto em `/disciplinas/*` (API renomeada)
// e também em `/materias/*` (compat: caminhos `/materias/...` gravados no banco por marp.ts
// e usados pelo frontend). Ambos servem os arquivos do diretório `materias/` do frontend.
async function serveStaticDisciplinaContent(c: any) {
  let rest: string;
  try {
    rest = decodeURIComponent(c.req.path.replace(/^\/(disciplinas|materias)\/?/, ''));
  } catch {
    return c.text('Bad request', 400);
  }
  const safe = rest
    .split('/')
    .map((seg) => seg.replace(/\.\./g, '').replace(/\\/g, ''))
    .join('/');
  const firstSeg = safe.split('/')[0] || '';
  if (!firstSeg) return c.text('Not found', 404);

  const disciplina = dbq('SELECT id, curso_id FROM disciplinas WHERE slug = ?').get(firstSeg) as { id: number; curso_id: number } | undefined;
  if (disciplina) {
    const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
    const prof = token ? verifyJwt(token) : null;
    const isProfessor = prof && (prof.role === 'admin' || !!dbq('SELECT 1 FROM curso_professores cp WHERE cp.curso_id = ? AND cp.professor_id = ?').get(disciplina.curso_id, Number(prof.sub)));
    if (!isProfessor) {
      const curso = dbq('SELECT senha FROM cursos WHERE id = ?').get(disciplina.curso_id) as { senha: string | null } | undefined;
      if (curso?.senha) {
        const senha = readCursoSenha(c);
        if (!senha || senha !== curso.senha) return c.text('Unauthorized', 401);
      }
    }
  }

  const abs = path.join(resolveFrontendDir(), 'materias', safe);
  const served = serveFileWithCsp(abs);
  if (!served) return c.text('Not found', 404);
  return served;
}

app.get('/materias/*', serveStaticDisciplinaContent);
app.get('/disciplinas/*', serveStaticDisciplinaContent);

const frontendStaticDir = process.env.FRONTEND_STATIC_DIR || (existsSync('/app/frontend_static') ? '/app/frontend_static' : path.join(import.meta.dir, '..', '..', 'frontend', 'dist'));

app.use('*', async (c, next) => {
  await next();
  if (c.res.status === 404 && existsSync(frontendStaticDir)) {
    const reqPath = c.req.path;
    const base = path.resolve(frontendStaticDir);
    // [SEG] Resolve o caminho e impede traversal de diretório (ex.: /../../etc/passwd).
    const target = path.resolve(base, reqPath.replace(/^\/+/, ''));
    if (target !== base && !target.startsWith(base + path.sep)) {
      return; // tentativa de path traversal: mantém 404
    }
    const fileResp = serveFileWithCsp(target);
    if (fileResp) {
      c.res = fileResp;
      return;
    }
    const indexPath = path.join(base, 'index.html');
    const indexResp = serveFileWithCsp(indexPath, 'text/html; charset=utf-8');
    if (indexResp) {
      c.res = indexResp;
      return;
    }
  }
});

export default app;
