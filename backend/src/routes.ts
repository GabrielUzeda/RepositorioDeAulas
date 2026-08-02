import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { db } from './db';
import { sanitizeSlug, sanitizePathOrUrl } from './utils';
import { professorAuth, hashPassword, verifyPassword, signJwt, verifyJwt, isValidEmail, createRateLimiter } from './auth';
import { sendMail, type MailRequest } from './mailer';
import { processMarpContent } from './marp';

const app = new Hono();

app.use('*', secureHeaders());
app.use('*', cors({ origin: '*', allowHeaders: ['Content-Type', 'Authorization'], allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));

const loginLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10, message: 'Muitas tentativas de login. Aguarde 1 minuto.' });
const registerLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5, message: 'Muitas tentativas de registro. Aguarde 10 minutos.' });

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

// ---------- Admin handlers ----------

async function createTurma(c: any) {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const slug = sanitizeSlug(body.slug ?? '');
  const professorId = prof.role === 'admin' ? (body.professor_id ?? prof.id) : prof.id;
  const r = db
    .query(
      `INSERT INTO turmas (professor_id, slug, nome, cor, icone, senha, descricao)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(professorId, slug, body.nome ?? '', body.cor ?? null, body.icone ?? null, body.senha ?? null, body.descricao ?? null);
  return c.json(r, 201);
}

async function updateTurma(c: any) {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const slug = sanitizeSlug(body.slug ?? '');
  const scope = prof.role === 'admin' ? '' : ' AND professor_id = ?';
  const params: any[] = [slug, body.nome ?? '', body.cor ?? null, body.icone ?? null, body.senha ?? null, body.descricao ?? null, id];
  if (prof.role !== 'admin') params.push(prof.id);
  const r = db
    .query(
      `UPDATE turmas
       SET slug = ?, nome = ?, cor = ?, icone = ?, senha = COALESCE(?, senha), descricao = ?,
           atualizado_em = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id = ?${scope}
       RETURNING *`
    )
    .get(...params);
  if (!r) return c.text('Turma not found or access denied', 404);
  return c.json(r, 200);
}

async function createAula(c: any) {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const turmaId = parseId(String(body.turma_id));
  if (turmaId === null) return c.text('', 400);
  const turma = dbq('SELECT * FROM turmas WHERE id = ?').get(turmaId) as any;
  if (!turma) return c.text('Turma not found', 404);
  if (prof.role !== 'admin' && turma.professor_id !== prof.id) return c.text('Access denied', 403);
  const markdown = body.markdown ?? body.conteudo_md ?? null;
  let finalCaminho = sanitizePathOrUrl(body.caminho ?? '');
  if (markdown !== null && markdown !== undefined) {
    const res = processMarpContent(turma.slug, body.titulo ?? '', markdown);
    if (res.error) return c.text(res.error, 500);
    finalCaminho = res.caminho!;
  }
  const r = db
    .query(
      `INSERT INTO aulas (turma_id, titulo, caminho, icone, descricao, ordem, conteudo_md)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(turmaId, body.titulo ?? '', finalCaminho, body.icone ?? null, body.descricao ?? null, body.ordem ?? 0, markdown);
  return c.json(r, 201);
}

async function updateAula(c: any) {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const turmaId = parseId(String(body.turma_id));
  if (turmaId === null) return c.text('', 400);
  const turma = dbq('SELECT * FROM turmas WHERE id = ?').get(turmaId) as any;
  if (!turma) return c.text('Turma not found', 404);
  if (prof.role !== 'admin' && turma.professor_id !== prof.id) return c.text('Access denied', 403);
  const markdown = body.markdown ?? body.conteudo_md ?? null;
  let finalCaminho = sanitizePathOrUrl(body.caminho ?? '');
  if (markdown !== null && markdown !== undefined) {
    const res = processMarpContent(turma.slug, body.titulo ?? '', markdown);
    if (res.error) return c.text(res.error, 500);
    finalCaminho = res.caminho!;
  }
  const r = db
    .query(
      `UPDATE aulas
       SET turma_id = ?, titulo = ?, caminho = ?, icone = ?, descricao = ?, ordem = ?, conteudo_md = ?,
           atualizado_em = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id = ?
       RETURNING *`
    )
    .get(turmaId, body.titulo ?? '', finalCaminho, body.icone ?? null, body.descricao ?? null, body.ordem ?? 0, markdown, id);
  if (!r) return c.text('Aula not found', 404);
  return c.json(r, 200);
}

async function createAtividade(c: any) {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const turmaId = parseId(String(body.turma_id));
  if (turmaId === null) return c.text('', 400);
  const turma = dbq('SELECT * FROM turmas WHERE id = ?').get(turmaId) as any;
  if (!turma) return c.text('Turma not found', 404);
  if (prof.role !== 'admin' && turma.professor_id !== prof.id) return c.text('Access denied', 403);
  const externalId = body.external_id != null ? sanitizeSlug(body.external_id) : null;
  const caminho = sanitizePathOrUrl(body.caminho ?? '');
  const r = db
    .query(
      `INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone, json_data, tipo, senha, allow_password, ordem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(
      turmaId,
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
  const turmaId = parseId(String(body.turma_id));
  if (turmaId === null) return c.text('', 400);
  const turma = dbq('SELECT * FROM turmas WHERE id = ?').get(turmaId) as any;
  if (!turma) return c.text('Turma not found', 404);
  if (prof.role !== 'admin' && turma.professor_id !== prof.id) return c.text('Access denied', 403);
  const externalId = body.external_id != null ? sanitizeSlug(body.external_id) : null;
  const caminho = sanitizePathOrUrl(body.caminho ?? '');
  const r = db
    .query(
      `UPDATE atividades
       SET turma_id = ?, external_id = ?, titulo = ?, descricao = ?, caminho = ?, icone = ?,
           json_data = ?, tipo = ?, senha = COALESCE(?, senha), allow_password = ?, ordem = ?,
           atualizado_em = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id = ?
       RETURNING *`
    )
    .get(
      turmaId,
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

app.post('/turmas', professorAuth, createTurma);
app.put('/turmas/:id', professorAuth, updateTurma);
app.post('/turmas/:id', professorAuth, updateTurma);
app.delete('/turmas/:id', professorAuth, (c) => {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  if (prof.role !== 'admin') {
    const turma = dbq('SELECT professor_id FROM turmas WHERE id = ?').get(id) as any;
    if (!turma || turma.professor_id !== prof.id) return c.text('Access denied', 403);
  }
  dbq('DELETE FROM turmas WHERE id = ?').run(id);
  return c.body(null, 204);
});

app.post('/aulas', professorAuth, createAula);
app.put('/aulas/:id', professorAuth, updateAula);
app.delete('/aulas/:id', professorAuth, (c) => {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  if (prof.role !== 'admin') {
    const aula = dbq('SELECT turma_id FROM aulas WHERE id = ?').get(id) as any;
    if (!aula) return c.text('Aula not found', 404);
    const turma = dbq('SELECT professor_id FROM turmas WHERE id = ?').get(aula.turma_id) as any;
    if (!turma || turma.professor_id !== prof.id) return c.text('Access denied', 403);
  }
  dbq('DELETE FROM aulas WHERE id = ?').run(id);
  return c.body(null, 204);
});

app.post('/atividades', professorAuth, createAtividade);
app.put('/atividades/:id', professorAuth, updateAtividade);
app.delete('/atividades/:id', professorAuth, (c) => {
  const prof = getProfessor(c);
  if (!prof) return c.body(null, 401);
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  if (prof.role !== 'admin') {
    const atv = dbq('SELECT turma_id FROM atividades WHERE id = ?').get(id) as any;
    if (!atv) return c.text('Atividade not found', 404);
    const turma = dbq('SELECT professor_id FROM turmas WHERE id = ?').get(atv.turma_id) as any;
    if (!turma || turma.professor_id !== prof.id) return c.text('Access denied', 403);
  }
  dbq('DELETE FROM atividades WHERE id = ?').run(id);
  return c.body(null, 204);
});

// ---------- Public routes ----------

app.get('/turmas', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const payload = await verifyJwt(authHeader.slice(7));
    if (payload?.sub) {
      if (payload.role === 'admin') {
        return c.json(dbq('SELECT * FROM turmas ORDER BY nome').all());
      }
      return c.json(dbq('SELECT * FROM turmas WHERE professor_id = ? ORDER BY nome').all(Number(payload.sub)));
    }
  }
  const rows = dbq('SELECT id, slug, nome, cor, icone, descricao FROM turmas ORDER BY nome').all();
  return c.json(rows);
});

app.get('/turmas/:id', (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const r = dbq('SELECT id, slug, nome, cor, icone, descricao FROM turmas WHERE id = ?').get(id);
  if (!r) return c.text('Turma not found', 404);
  return c.json(r);
});

app.get('/aulas', async (c) => {
  const turmaId = parseId(c.req.query('turma_id'));
  if (turmaId === null) return c.text('', 400);
  const turma = dbq('SELECT * FROM turmas WHERE id = ?').get(turmaId) as any;
  if (!turma) return c.text('Turma não encontrada', 404);

  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const payload = await verifyJwt(authHeader.slice(7));
    if (payload?.sub) {
      const profId = Number(payload.sub);
      if (payload.role === 'admin' || turma.professor_id === profId) {
        const rows = dbq('SELECT * FROM aulas WHERE turma_id = ? ORDER BY ordem, titulo').all(turmaId);
        return c.json(rows);
      }
    }
  }

  const senha = c.req.query('senha') ?? null;
  if ((turma.senha ?? null) !== senha) return c.text('Senha da turma incorreta', 401);
  const rows = dbq('SELECT * FROM aulas WHERE turma_id = ? ORDER BY ordem, titulo').all(turmaId);
  return c.json(rows);
});

app.get('/aulas/:id', (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const r = dbq('SELECT * FROM aulas WHERE id = ?').get(id);
  if (!r) return c.text('Aula not found', 404);
  return c.json(r);
});

app.get('/atividades', async (c) => {
  const turmaId = parseId(c.req.query('turma_id'));
  if (turmaId === null) return c.text('', 400);
  const turma = dbq('SELECT * FROM turmas WHERE id = ?').get(turmaId) as any;
  if (!turma) return c.text('Turma não encontrada', 404);

  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const payload = await verifyJwt(authHeader.slice(7));
    if (payload?.sub) {
      const profId = Number(payload.sub);
      if (payload.role === 'admin' || turma.professor_id === profId) {
        const rows = dbq('SELECT * FROM atividades WHERE turma_id = ? ORDER BY ordem, titulo').all(turmaId);
        return c.json(rows.map(mapAtividade));
      }
    }
  }

  const senha = c.req.query('senha') ?? null;
  if ((turma.senha ?? null) !== senha) return c.text('Senha da turma incorreta', 401);
  const rows = dbq('SELECT * FROM atividades WHERE turma_id = ? ORDER BY ordem, titulo').all(turmaId);
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
      const turma = dbq('SELECT professor_id FROM turmas WHERE id = ?').get(atv.turma_id) as any;
      if (turma && (payload.role === 'admin' || turma.professor_id === profId)) {
        return c.json(atv);
      }
    }
  }

  const turma = dbq('SELECT * FROM turmas WHERE id = ?').get(atv.turma_id) as any;
  if (!turma) return c.text('Turma not found for activity', 500);
  const inputSenha = c.req.query('senha') ?? '';
  const turmaSenha = turma.senha ?? '';
  const atvSenha = atv.senha ?? '';
  const isProtected = !!atv.allow_password;

  if (inputSenha === atvSenha && isProtected) {
    return c.json(atv);
  } else if (inputSenha === turmaSenha) {
    if (isProtected) atv.json_data = null;
    return c.json(atv);
  } else {
    return c.text('Senha incorreta', 401);
  }
});

app.post('/ranking', async (c) => {
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  try {
    const r = db
      .query('INSERT INTO ranking (atividade_id, nome_jogador, pontuacao) VALUES (?, ?, ?) RETURNING *')
      .get(body.atividade_id, body.nome_jogador ?? '', body.pontuacao ?? 0);
    return c.json(r, 200);
  } catch (e: any) {
    return c.text(`Erro ao criar ranking: ${e?.message}`, 500);
  }
});

app.get('/ranking/:atividade_id', (c) => {
  const id = parseId(c.req.param('atividade_id'));
  if (id === null) return c.text('', 400);
  try {
    const rows = dbq('SELECT * FROM ranking WHERE atividade_id = ? ORDER BY pontuacao DESC LIMIT 50').all(id);
    return c.json(rows);
  } catch (e: any) {
    return c.text(`Erro ao listar ranking: ${e?.message}`, 500);
  }
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
  } catch (e: any) {
    return c.json({ success: false, message: `Erro na conexão: ${e?.message}` });
  }
});

export default app;
