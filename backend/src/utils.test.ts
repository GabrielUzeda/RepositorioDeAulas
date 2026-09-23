import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { db } from './db';
import app from './routes';
import {
  encryptData,
  decryptData,
  hashEmail,
  hashSenhaCurso,
  parseJsonOrNull,
  sanitizePathOrUrl,
  sanitizeSlug,
} from './utils';
import {
  ADMIN_SEED_EMAIL,
  ADMIN_SEED_PASSWORD,
  adminToken,
  authHeaders,
  createAtividade,
  createCurso,
  createDisciplina,
  deleteCurso,
  jsonHeaders,
  login,
  readBody,
} from './testHelpers';

describe('Utilitários, senha de curso e conteúdo estático', () => {
  test('sanitizeSlug normaliza acentos, pontuação e entradas vazias', () => {
    expect(sanitizeSlug('Plano de Ensino 2026!')).toBe('plano_de_ensino_2026');
    expect(sanitizeSlug('Lógica de Programação')).toBe('logica_de_programacao');
    expect(sanitizeSlug('  --Aulas+++Extras--  ')).toBe('aulas_extras');
    expect(sanitizeSlug('')).toBe('');
    expect(sanitizeSlug('!!!')).toBe('');
    expect(sanitizeSlug(undefined as unknown as string)).toBe('');
    expect(sanitizeSlug('a b c')).toBe('a_b_c');
    expect(sanitizeSlug('tag#1@x')).toBe('tag_1_x');
  });

  test('sanitizePathOrUrl preserva separadores úteis e neutraliza traversal', () => {
    expect(sanitizePathOrUrl('materias/logica/aulas/intro.html')).toBe(
      'materias/logica/aulas/intro.html'
    );
    expect(sanitizePathOrUrl('../../etc/passwd')).toBe('_/_/etc/passwd');
    expect(sanitizePathOrUrl('a/../b')).toBe('a/_/b');
    expect(sanitizePathOrUrl('https://exemplo.com/a?b=c&d=e#f')).toBe(
      'https://exemplo.com/a?b=c&d=e#f'
    );
    expect(sanitizePathOrUrl('')).toBe('');
  });

  test('parseJsonOrNull devolve null em vez de lançar', () => {
    expect(parseJsonOrNull<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonOrNull<number[]>('[1,2]')).toEqual([1, 2]);
    expect(parseJsonOrNull<number>('42')).toBe(42);
    expect(parseJsonOrNull('{invalido')).toBeNull();
    expect(parseJsonOrNull('')).toBeNull();
    expect(parseJsonOrNull('undefined')).toBeNull();
  });

  test('encryptData/decryptData fazem round-trip e são tolerantes a entradas inválidas', async () => {
    const texto = 'Resposta do aluno com acentuação: ção';
    const cifrado = await encryptData(texto);
    expect(cifrado.startsWith('enc:v1:')).toBe(true);
    expect(cifrado).not.toContain('aluno');
    expect(await decryptData(cifrado)).toBe(texto);

    const cifrado2 = await encryptData(texto);
    expect(cifrado2).not.toBe(cifrado);

    expect(await encryptData('')).toBe('');
    expect(await decryptData('texto-puro')).toBe('texto-puro');
    expect(await decryptData('enc:v1:apenas:duas')).toBe('enc:v1:apenas:duas');
    expect(await decryptData('enc:v1:a:b:c')).toBe('enc:v1:a:b:c');
  });

  test('hashEmail é determinístico, normaliza caixa/espaços e é b64url', async () => {
    const a = await hashEmail('Aluno@Escola.com');
    const b = await hashEmail('  aluno@escola.com  ');
    const c = await hashEmail('outro@escola.com');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThan(30);
  });

  test('hashSenhaCurso gera hash sha256 estável por senha', async () => {
    const a = await hashSenhaCurso('senha123');
    const b = await hashSenhaCurso('senha123');
    const c = await hashSenhaCurso('senha124');
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('Senha de curso e proteção do conteúdo estático', () => {
  let admin = '';
  let cursoAbertoId = 0;
  let cursoAbertoSlug = '';
  let cursoFechadoId = 0;
  let cursoSemSenhaId = 0;
  let cursoRankingLivreId = 0;
  let discAbertaSlug = '';
  let discFechadaSlug = '';

  beforeAll(async () => {
    admin = await adminToken();
    const aberto = await createCurso(admin, { senha: 'senha-forte-123' });
    cursoAbertoId = aberto.id;
    cursoAbertoSlug = aberto.slug;
    discAbertaSlug = (await createDisciplina(admin, cursoAbertoId)).slug;

    const fechado = await createCurso(admin, { senha: 'outra-senha-456' });
    cursoFechadoId = fechado.id;
    discFechadaSlug = (await createDisciplina(admin, cursoFechadoId)).slug;
  });

  afterAll(async () => {
    await deleteCurso(admin, cursoAbertoId);
    await deleteCurso(admin, cursoFechadoId);
    if (cursoSemSenhaId) await deleteCurso(admin, cursoSemSenhaId);
    if (cursoRankingLivreId) await deleteCurso(admin, cursoRankingLivreId);
  });

  test('GET /cursos/:id nunca expõe a senha nem o hash', async () => {
    const res = await app.request(`/cursos/${cursoAbertoId}`);
    expect(res.status).toBe(200);
    const body = await readBody(res);
    expect(body.possui_senha).toBe(1);
    expect(body.senha).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('sha256:');
  });

  test('POST /cursos/:id/verificar-senha valida hash atual e senha legada em texto puro', async () => {
    const semSenha = await app.request(`/cursos/${cursoAbertoId}/verificar-senha`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({}),
    });
    expect(semSenha.status).toBe(400);

    const errada = await app.request(`/cursos/${cursoAbertoId}/verificar-senha`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ senha: 'errada' }),
    });
    expect(errada.status).toBe(401);

    const correta = await app.request(`/cursos/${cursoAbertoId}/verificar-senha`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ senha: 'senha-forte-123' }),
    });
    expect(correta.status).toBe(200);
    const corretaBody = await readBody(correta);
    expect(corretaBody.ok).toBe(true);
    expect(corretaBody.curso.id).toBe(cursoAbertoId);

    const inexistente = await app.request('/cursos/999999/verificar-senha', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ senha: 'x' }),
    });
    expect(inexistente.status).toBe(404);

    const semSenhaRow = db
      .query('INSERT INTO cursos (slug, nome, senha) VALUES (?, ?, ?) RETURNING id')
      .get(`curso_legado_${Date.now()}`, 'Curso Sem Senha', null) as any;
    const semSenhaRes = await app.request(`/cursos/${semSenhaRow.id}/verificar-senha`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ senha: 'qualquer' }),
    });
    expect(semSenhaRes.status).toBe(200);
    expect((await readBody(semSenhaRes)).message).toBe('Curso sem senha');
    db.query('DELETE FROM cursos WHERE id = ?').run(semSenhaRow.id);

    const legado = db
      .query('INSERT INTO cursos (slug, nome, senha) VALUES (?, ?, ?) RETURNING id')
      .get(`curso_legado2_${Date.now()}`, 'Curso Legado', 'texto-puro-123') as any;
    const legadoErrado = await app.request(`/cursos/${legado.id}/verificar-senha`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ senha: 'outra' }),
    });
    expect(legadoErrado.status).toBe(401);
    const legadoCerto = await app.request(`/cursos/${legado.id}/verificar-senha`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ senha: 'texto-puro-123' }),
    });
    expect(legadoCerto.status).toBe(200);
    db.query('DELETE FROM cursos WHERE id = ?').run(legado.id);
  });

  test('conteúdo estático de disciplina protegida exige senha e não vaza arquivos do sistema', async () => {
    const semSenha = await app.request(`/materias/${discFechadaSlug}/aulas/qualquer.html`);
    expect(semSenha.status).toBe(401);

    const comSenhaErrada = await app.request(`/materias/${discFechadaSlug}/aulas/qualquer.html?senha=errada`);
    expect(comSenhaErrada.status).toBe(401);

    const comSenhaCerta = await app.request(
      `/materias/${discFechadaSlug}/aulas/qualquer.html?senha=outra-senha-456`
    );
    expect(comSenhaCerta.status).toBe(404);

    const traversal = await app.request(`/materias/${discAbertaSlug}/%2e%2e%2f%2e%2e%2fetc%2fpasswd`, {
      headers: { 'x-curso-senha': 'senha-forte-123' },
    });
    expect(traversal.status).not.toBe(200);
    expect(await traversal.text()).not.toContain('root:');

    const traversalSemSlug = await app.request('/materias/%2e%2e%2f%2e%2e%2fetc%2fpasswd');
    expect(traversalSemSlug.status).toBe(404);
    expect(await traversalSemSlug.text()).not.toContain('root:');

    const semArquivo = await app.request(`/materias/${discAbertaSlug}/inexistente.html`, {
      headers: { 'x-curso-senha': 'senha-forte-123' },
    });
    expect(semArquivo.status).toBe(404);
  });

  test('POST /cursos/slug/:slug/verificar-senha valida senha por slug', async () => {
    const correta = await app.request(`/cursos/slug/${cursoAbertoSlug}/verificar-senha`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ senha: 'senha-forte-123' }),
    });
    expect(correta.status).toBe(200);
    const corretaBody = await readBody(correta);
    expect(corretaBody.ok).toBe(true);
    expect(corretaBody.curso.id).toBe(cursoAbertoId);

    const errada = await app.request(`/cursos/slug/${cursoAbertoSlug}/verificar-senha`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ senha: 'errada' }),
    });
    expect(errada.status).toBe(401);

    const semSenha = await app.request(`/cursos/slug/${cursoAbertoSlug}/verificar-senha`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({}),
    });
    expect(semSenha.status).toBe(400);

    const inexistente = await app.request('/cursos/slug/curso_que_nao_existe/verificar-senha', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ senha: 'x' }),
    });
    expect(inexistente.status).toBe(404);
  });

  test('GET /cursos/:id/disciplinas esconde as ocultas do público e revela ao gestor', async () => {
    const visivel = await createDisciplina(admin, cursoAbertoId, 'Disciplina Visivel');
    const oculta = await createDisciplina(admin, cursoAbertoId, 'Disciplina Oculta');

    const ocultar = await app.request(`/disciplinas/${oculta.id}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ status: 'oculto' }),
    });
    expect(ocultar.status).toBe(200);

    const anonimo = await app.request(`/cursos/${cursoAbertoId}/disciplinas?senha=senha-forte-123`);
    expect(anonimo.status).toBe(200);
    const anonimoBody = await readBody(anonimo);
    const idsAnonimo = anonimoBody.map((d: any) => d.id);
    expect(idsAnonimo).toContain(visivel.id);
    expect(idsAnonimo).not.toContain(oculta.id);
    for (const item of anonimoBody) {
      expect(item.status).toBeUndefined();
    }

    const gestor = await app.request(`/cursos/${cursoAbertoId}/disciplinas`, {
      headers: authHeaders(admin),
    });
    expect(gestor.status).toBe(200);
    const gestorBody = await readBody(gestor);
    expect(gestorBody.map((d: any) => d.id)).toContain(oculta.id);
    expect(gestorBody.find((d: any) => d.id === oculta.id).status).toBe('oculto');

    const cursoInexistente = await app.request('/cursos/999999/disciplinas');
    expect(cursoInexistente.status).toBe(404);

    const idInvalido = await app.request('/cursos/abc/disciplinas');
    expect(idInvalido.status).toBe(400);
  });

  test('GET /cursos/:id/disciplinas exige a senha do curso para o público', async () => {
    const semSenha = await app.request(`/cursos/${cursoAbertoId}/disciplinas`);
    expect(semSenha.status).toBe(401);

    const senhaErrada = await app.request(`/cursos/${cursoAbertoId}/disciplinas?senha=errada`);
    expect(senhaErrada.status).toBe(401);

    const senhaErradaHeader = await app.request(`/cursos/${cursoAbertoId}/disciplinas`, {
      headers: { 'x-curso-senha': 'errada' },
    });
    expect(senhaErradaHeader.status).toBe(401);

    const senhaNaQuery = await app.request(`/cursos/${cursoAbertoId}/disciplinas?senha=senha-forte-123`);
    expect(senhaNaQuery.status).toBe(200);
    expect((await readBody(senhaNaQuery)).length).toBeGreaterThan(0);

    const senhaNoHeader = await app.request(`/cursos/${cursoAbertoId}/disciplinas`, {
      headers: { 'x-curso-senha': 'senha-forte-123' },
    });
    expect(senhaNoHeader.status).toBe(200);

    const gestorSemSenha = await app.request(`/cursos/${cursoAbertoId}/disciplinas`, {
      headers: authHeaders(admin),
    });
    expect(gestorSemSenha.status).toBe(200);

    const outroCursoComSenha = await app.request(`/cursos/${cursoFechadoId}/disciplinas`);
    expect(outroCursoComSenha.status).toBe(401);

    const semSenhaCadastrada = await createCurso(admin);
    cursoSemSenhaId = semSenhaCadastrada.id;
    await createDisciplina(admin, cursoSemSenhaId, 'Disciplina Livre');
    const cursoLivre = await app.request(`/cursos/${cursoSemSenhaId}/disciplinas`);
    expect(cursoLivre.status).toBe(200);
    expect((await readBody(cursoLivre)).length).toBe(1);
  });

  test('GET /ranking/:atividade_id exige a senha do curso para o público', async () => {
    const disc = await createDisciplina(admin, cursoAbertoId);
    const atv = await createAtividade(admin, disc.id, { tipo: 'minigame', json_data: { questions: [] } });

    const registro = await app.request('/ranking', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        atividade_id: atv.id,
        pontuacao: 10,
        nome_jogador: 'Aluno Teste',
        senha_curso: 'senha-forte-123',
      }),
    });
    expect(registro.status).toBe(200);

    const semSenha = await app.request(`/ranking/${atv.id}`);
    expect(semSenha.status).toBe(401);

    const senhaErrada = await app.request(`/ranking/${atv.id}?senha=errada`);
    expect(senhaErrada.status).toBe(401);

    const comSenha = await app.request(`/ranking/${atv.id}?senha=senha-forte-123`);
    expect(comSenha.status).toBe(200);
    const lista = await readBody(comSenha);
    expect(lista.length).toBe(1);
    expect(lista[0].nome_jogador).toBe('Aluno T.');
    expect(lista[0].pontuacao).toBe(10);

    const comHeader = await app.request(`/ranking/${atv.id}`, {
      headers: { 'x-curso-senha': 'senha-forte-123' },
    });
    expect(comHeader.status).toBe(200);

    const gestorSemSenha = await app.request(`/ranking/${atv.id}`, { headers: authHeaders(admin) });
    expect(gestorSemSenha.status).toBe(200);

    const atividadeInexistente = await app.request('/ranking/999999');
    expect(atividadeInexistente.status).toBe(404);

    const cursoLivre = await createCurso(admin);
    cursoRankingLivreId = cursoLivre.id;
    const discLivre = await createDisciplina(admin, cursoRankingLivreId);
    const atvLivre = await createAtividade(admin, discLivre.id, {
      tipo: 'minigame',
      json_data: { questions: [] },
    });
    const registroLivre = await app.request('/ranking', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ atividade_id: atvLivre.id, pontuacao: 5, nome_jogador: 'Aluno Livre' }),
    });
    expect(registroLivre.status).toBe(200);
    const rankingLivre = await app.request(`/ranking/${atvLivre.id}`);
    expect(rankingLivre.status).toBe(200);
    expect((await readBody(rankingLivre)).length).toBe(1);
  });

  test('health responde e /db-test exige admin', async () => {
    const health = await app.request('/health');
    expect(health.status).toBe(200);

    const semAuth = await app.request('/db-test');
    expect(semAuth.status).toBe(401);

    const comAuth = await app.request('/db-test', { headers: authHeaders(admin) });
    expect(comAuth.status).toBe(200);
  });

  test('login do admin semeado funciona e rejeita senha errada', async () => {
    const ok = await login(ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD);
    expect(ok.res.status).toBe(200);
    expect(typeof ok.token).toBe('string');

    const errado = await login(ADMIN_SEED_EMAIL, 'senha-que-nao-existe');
    expect(errado.res.status).toBe(401);

    const usuarioInexistente = await login('ninguem@escola.com', 'qualquer');
    expect(usuarioInexistente.res.status).toBe(401);

    const emailInvalido = await login('sem-arroba', 'qualquer');
    expect(emailInvalido.res.status).toBe(400);
  });
});
