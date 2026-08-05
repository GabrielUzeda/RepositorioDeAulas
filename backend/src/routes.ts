import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { db } from './db';
import { sanitizeSlug, sanitizePathOrUrl } from './utils';
import { professorAuth, adminAuth, hashPassword, verifyPassword, signJwt, verifyJwt, isValidEmail, createRateLimiter } from './auth';
import { sendMail, type MailRequest } from './mailer';
import { processMarpContent, resolveFrontendDir } from './marp';

const app = new Hono();

app.use('*', secureHeaders());
app.use('*', cors({ origin: '*', allowHeaders: ['Content-Type', 'Authorization'], allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));

app.onError((err, c) => {
  console.error('[HTTP Server Error]:', err);
  return c.text('Internal Server Error', 500);
});

const loginLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 100, message: 'Muitas tentativas de login. Aguarde 1 minuto.' });
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
  if (!prof) return c.text('Invalid credentials', 401);
  const ok = await verifyPassword(body.password, prof.senha_hash, prof.salt);
  if (!ok) return c.text('Invalid credentials', 401);
  const token = await signJwt({ sub: String(prof.id), role: prof.role, email: prof.email });
  return c.json({ token, professor: { id: prof.id, email: prof.email, nome: prof.nome, role: prof.role } });
});

app.post('/auth/register', registerLimiter, async (c) => {
  const body = await parseBody(c);
  if (!body?.email || !body?.password || !body?.nome || !isValidEmail(body.email)) return c.text('Dados inválidos', 400);
  const existing = dbq('SELECT id FROM professores WHERE email = ?').get(body.email);
  if (existing) return c.text('Email already registered', 409);
  const { hash, salt } = await hashPassword(body.password);
  const r = dbq('INSERT INTO professores (email, nome, senha_hash, salt, role) VALUES (?, ?, ?, ?, ?) RETURNING id, email, nome, role')
    .get(body.email, body.nome, hash, salt, 'professor');
  const token = await signJwt({ sub: String((r as any).id), role: 'professor', email: body.email });
  return c.json({ token, professor: r }, 201);
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
  dbq('DELETE FROM curso_professores WHERE curso_id = ?').run(id);
  const ins = db.query('INSERT OR IGNORE INTO curso_professores (curso_id, professor_id) VALUES (?, ?)');
  for (const pid of professorIds) {
    if (dbq('SELECT id FROM professores WHERE id = ?').get(pid)) ins.run(id, pid);
  }
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

  const senha = c.req.query('senha') ?? null;
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

    const senha = c.req.query('senha') ?? null;
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

  const senha = c.req.query('senha') ?? null;
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
  const inputSenha = c.req.query('senha') ?? '';
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

  try {
    const r = db
      .query(
        `INSERT INTO ranking (atividade_id, nome_jogador, pontuacao)
         VALUES (?, ?, ?) RETURNING *`
      )
      .get(atividadeId, nomePublico, Math.floor(pontuacao));
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

app.post('/submeter-resposta', submissionLimiter, async (c) => {
  const body = await parseBody(c);
  if (!body) return c.text('Dados inválidos', 400);
  const atividadeId = parseId(String(body.atividade_id));
  if (atividadeId === null) return c.text('ID de atividade inválido', 400);
  if (!body.aluno_nome || !body.aluno_email || !isValidEmail(body.aluno_email) || !body.respostas) {
    return c.text('Informe nome, e-mail válido e respostas.', 400);
  }
  const atv = dbq('SELECT id FROM atividades WHERE id = ?').get(atividadeId);
  if (!atv) return c.text('Atividade não encontrada', 404);

  try {
    const r = db
      .query(
        `INSERT INTO respostas_alunos (atividade_id, aluno_nome, aluno_email, respostas)
         VALUES (?, ?, ?, ?) RETURNING *`
      )
      .get(atividadeId, String(body.aluno_nome).trim(), String(body.aluno_email).trim(), String(body.respostas).trim());
    return c.json(r, 201);
  } catch (e: any) {
    return c.text('Erro interno ao salvar resposta', 500);
  }
});

// Direitos do Titular (Art. 18 LGPD) - Consulta de respostas próprias do aluno por e-mail (com rate limiter)
app.get('/aluno/minhas-respostas', submissionLimiter, async (c) => {
  const email = c.req.query('email');
  if (!email || !isValidEmail(email)) {
    return c.text('Informe um e-mail válido.', 400);
  }
  const rows = dbq(
    `SELECT r.id, r.atividade_id, r.aluno_nome, r.aluno_email, r.respostas, r.criado_em, a.titulo as atividade_titulo
     FROM respostas_alunos r
     JOIN atividades a ON r.atividade_id = a.id
     WHERE r.aluno_email = ?
     ORDER BY r.criado_em DESC`
  ).all(email);
  return c.json(rows);
});

app.get('/atividades/:id/respostas', professorAuth, async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('ID inválido', 400);
  const atv = dbq('SELECT materia_id FROM atividades WHERE id = ?').get(id) as any;
  if (!atv) return c.text('Atividade não encontrada', 404);
  if (!(await canManageMateria(c, atv.materia_id))) return c.text('Access denied', 403);

  const rows = dbq('SELECT * FROM respostas_alunos WHERE atividade_id = ? ORDER BY criado_em DESC').all(id);
  return c.json(rows);
});

app.delete('/respostas/:id', professorAuth, async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('ID inválido', 400);
  const resp = dbq('SELECT atividade_id FROM respostas_alunos WHERE id = ?').get(id) as any;
  if (!resp) return c.text('Resposta não encontrada', 404);
  const atv = dbq('SELECT materia_id FROM atividades WHERE id = ?').get(resp.atividade_id) as any;
  if (atv && !(await canManageMateria(c, atv.materia_id))) return c.text('Access denied', 403);

  dbq('DELETE FROM respostas_alunos WHERE id = ?').run(id);
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
  return { id: row.id, nome: row.nome, email: row.email, role: row.role, criado_em: row.criado_em };
}

app.get('/professores', adminAuth, async (c) => {
  const rows = dbq('SELECT id, nome, email, role, criado_em FROM professores ORDER BY nome').all();
  return c.json(rows.map(mapProfessor));
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
  const r = dbq('INSERT INTO professores (email, nome, senha_hash, salt, role) VALUES (?, ?, ?, ?, ?) RETURNING id, nome, email, role, criado_em')
    .get(body.email, body.nome, hash, salt, role);
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

  if (typeof body.password === 'string' && body.password) {
    const { hash, salt } = await hashPassword(body.password);
    dbq('UPDATE professores SET nome = ?, email = ?, senha_hash = ?, salt = ?, role = ? WHERE id = ?')
      .run(nome, email, hash, salt, role, id);
  } else {
    dbq('UPDATE professores SET nome = ?, email = ?, role = ? WHERE id = ?').run(nome, email, role, id);
  }

  const r = dbq('SELECT id, nome, email, role, criado_em FROM professores WHERE id = ?').get(id);
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
  const abs = path.join(resolveFrontendDir(), 'materias', safe);
  if (!safe || !existsSync(abs) || !statSync(abs).isFile()) return c.text('Not found', 404);
  return new Response(Bun.file(abs));
});

export default app;
