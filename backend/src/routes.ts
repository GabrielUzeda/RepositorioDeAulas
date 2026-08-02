import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { db } from './db';
import { sanitizeSlug, sanitizePathOrUrl } from './utils';
import { professorAuth } from './auth';
import { sendMail, type MailRequest } from './mailer';
import { processMarpContent } from './marp';

const app = new Hono();

app.use('*', cors({ origin: '*', allowHeaders: ['Content-Type', 'X-Professor-Password'], allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));

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

// ---------- Admin handlers ----------

async function createTurma(c: any) {
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const slug = sanitizeSlug(body.slug ?? '');
  const r = db
    .query(
      `INSERT INTO turmas (slug, nome, cor, icone, senha, descricao)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(slug, body.nome ?? '', body.cor ?? null, body.icone ?? null, body.senha ?? null, body.descricao ?? null);
  return c.json(r, 201);
}

async function updateTurma(c: any) {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);
  const slug = sanitizeSlug(body.slug ?? '');
  const r = db
    .query(
      `UPDATE turmas
       SET slug = ?, nome = ?, cor = ?, icone = ?, senha = COALESCE(?, senha), descricao = ?,
           atualizado_em = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id = ?
       RETURNING *`
    )
    .get(slug, body.nome ?? '', body.cor ?? null, body.icone ?? null, body.senha ?? null, body.descricao ?? null, id);
  if (!r) return c.text('Error: no rows returned by a query that expected to return at least one row', 500);
  return c.json(r, 200);
}

async function createAula(c: any) {
  const body = await parseBody(c);
  if (!body) return c.text('', 400);

  const turmaId = parseId(String(body.turma_id));
  if (turmaId === null) return c.text('', 400);

  const markdown = body.markdown ?? body.conteudo_md ?? null;
  let finalCaminho = sanitizePathOrUrl(body.caminho ?? '');

  const turma = db.query('SELECT * FROM turmas WHERE id = ?').get(turmaId);
  if (!turma) return c.text('Turma not found', 404);

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
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);

  const turmaId = parseId(String(body.turma_id));
  if (turmaId === null) return c.text('', 400);

  const markdown = body.markdown ?? body.conteudo_md ?? null;
  let finalCaminho = sanitizePathOrUrl(body.caminho ?? '');

  const turma = db.query('SELECT * FROM turmas WHERE id = ?').get(turmaId);
  if (!turma) return c.text('Turma not found', 404);

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
  if (!r) return c.text('Error: no rows returned by a query that expected to return at least one row', 500);
  return c.json(r, 200);
}

async function createAtividade(c: any) {
  const body = await parseBody(c);
  if (!body) return c.text('', 400);

  const turmaId = parseId(String(body.turma_id));
  if (turmaId === null) return c.text('', 400);

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
      body.json_data ?? null,
      body.tipo ?? null,
      body.senha ?? null,
      body.allow_password == null ? null : body.allow_password ? 1 : 0,
      body.ordem ?? 0
    );
  return c.json(mapAtividade(r), 201);
}

async function updateAtividade(c: any) {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const body = await parseBody(c);
  if (!body) return c.text('', 400);

  const turmaId = parseId(String(body.turma_id));
  if (turmaId === null) return c.text('', 400);

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
      body.json_data ?? null,
      body.tipo ?? null,
      body.senha ?? null,
      body.allow_password == null ? null : body.allow_password ? 1 : 0,
      body.ordem ?? 0,
      id
    );
  if (!r) return c.text('Error: no rows returned by a query that expected to return at least one row', 500);
  return c.json(mapAtividade(r), 200);
}

// ---------- Route registration ----------

app.get('/check-auth', professorAuth, (c) => c.body(null, 200));

app.post('/turmas', professorAuth, createTurma);
app.put('/turmas/:id', professorAuth, updateTurma);
app.post('/turmas/:id', professorAuth, updateTurma);
app.delete('/turmas/:id', professorAuth, (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  db.query('DELETE FROM turmas WHERE id = ?').run(id);
  return c.body(null, 204);
});

app.post('/aulas', professorAuth, createAula);
app.put('/aulas/:id', professorAuth, updateAula);
app.delete('/aulas/:id', professorAuth, (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  db.query('DELETE FROM aulas WHERE id = ?').run(id);
  return c.body(null, 204);
});

app.post('/atividades', professorAuth, createAtividade);
app.put('/atividades/:id', professorAuth, updateAtividade);
app.delete('/atividades/:id', professorAuth, (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  db.query('DELETE FROM atividades WHERE id = ?').run(id);
  return c.body(null, 204);
});

// ---------- Public routes ----------

app.get('/turmas', (c) => {
  const rows = db.query('SELECT id, slug, nome, cor, icone, descricao FROM turmas ORDER BY nome').all();
  return c.json(rows);
});

app.get('/turmas/:id', (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const r = db.query('SELECT * FROM turmas WHERE id = ?').get(id);
  if (!r) return c.text('Turma not found', 404);
  return c.json(r);
});

app.get('/aulas', (c) => {
  const turmaId = parseId(c.req.query('turma_id'));
  if (turmaId === null) return c.text('', 400);
  const senha = c.req.query('senha') ?? null;

  const turma = db.query('SELECT * FROM turmas WHERE id = ?').get(turmaId);
  if (!turma) return c.text('Turma não encontrada', 404);
  if ((turma.senha ?? null) !== senha) return c.text('Senha da turma incorreta', 401);

  const rows = db.query('SELECT * FROM aulas WHERE turma_id = ? ORDER BY ordem, titulo').all(turmaId);
  return c.json(rows);
});

app.get('/aulas/:id', (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);
  const r = db.query('SELECT * FROM aulas WHERE id = ?').get(id);
  if (!r) return c.text('Aula not found', 404);
  return c.json(r);
});

app.get('/atividades', (c) => {
  const turmaId = parseId(c.req.query('turma_id'));
  if (turmaId === null) return c.text('', 400);
  const senha = c.req.query('senha') ?? null;

  const turma = db.query('SELECT * FROM turmas WHERE id = ?').get(turmaId);
  if (!turma) return c.text('Turma não encontrada', 404);
  if ((turma.senha ?? null) !== senha) return c.text('Senha da turma incorreta', 401);

  const rows = db.query('SELECT * FROM atividades WHERE turma_id = ? ORDER BY ordem, titulo').all(turmaId);
  return c.json(rows.map(mapAtividade));
});

app.get('/atividades/:id', (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.text('', 400);

  const atv = db.query('SELECT * FROM atividades WHERE id = ?').get(id);
  if (!atv) return c.text('Atividade not found', 404);
  atv.allow_password = atv.allow_password == null ? null : !!atv.allow_password;

  const professorPassword = process.env.PROFESSOR_PASSWORD || 'admin123';
  const headerPass = c.req.header('X-Professor-Password');
  if (headerPass === professorPassword) {
    return c.json(atv);
  }

  const turma = db.query('SELECT * FROM turmas WHERE id = ?').get(atv.turma_id);
  if (!turma) return c.text('Turma not found for activity', 500);

  const inputSenha = c.req.query('senha') ?? '';
  const turmaSenha = turma.senha ?? '';
  const atvSenha = atv.senha ?? '';
  const isProtected = !!atv.allow_password;

  if (inputSenha === atvSenha && isProtected) {
    return c.json(atv);
  } else if (inputSenha === turmaSenha) {
    if (isProtected) {
      atv.json_data = null;
    }
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
    const rows = db.query('SELECT * FROM ranking WHERE atividade_id = ? ORDER BY pontuacao DESC LIMIT 50').all(id);
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
    db.query('SELECT 1').get();
    return c.json({ success: true, message: 'Conexão com Postgres OK!' });
  } catch (e: any) {
    return c.json({ success: false, message: `Erro na conexão: ${e?.message}` });
  }
});

export default app;
