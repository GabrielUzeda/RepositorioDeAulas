import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { db } from './db';
import app from './routes';
import {
  adminToken,
  authHeaders,
  createAtividade,
  createAula,
  createCurso,
  createDisciplina,
  createProfessor,
  deleteCurso,
  deleteProfessor,
  jsonHeaders,
  linkProfessorToCurso,
  readBody,
  roletaJson,
  unique,
} from './testHelpers';

describe('Atividades: gabarito, autorização e vínculos com aulas', () => {
  let admin = '';
  let profDono = { id: 0, token: '' };
  let profIntruso = { id: 0, token: '' };
  let cursoId = 0;
  let discId = 0;
  let aula1Id = 0;
  let aula2Id = 0;
  const atividadeIds: number[] = [];

  beforeAll(async () => {
    admin = await adminToken();
    const dono = await createProfessor(admin);
    const intruso = await createProfessor(admin);
    profDono = { id: dono.id, token: dono.token };
    profIntruso = { id: intruso.id, token: intruso.token };

    const curso = await createCurso(admin, { senha: 'senha-do-curso-123' });
    cursoId = curso.id;
    await linkProfessorToCurso(admin, profDono.id, cursoId);

    const disc = await createDisciplina(profDono.token, cursoId);
    discId = disc.id;

    aula1Id = (await createAula(profDono.token, discId, 'Aula Um')).id;
    aula2Id = (await createAula(profDono.token, discId, 'Aula Dois')).id;
  });

  afterAll(async () => {
    for (const id of atividadeIds) {
      await app.request(`/atividades/${id}`, { method: 'DELETE', headers: authHeaders(admin) });
    }
    await deleteCurso(admin, cursoId);
    await deleteProfessor(admin, profDono.id);
    await deleteProfessor(admin, profIntruso.id);
  });

  async function novaAtividade(payload: Record<string, unknown>) {
    const criada = await createAtividade(profDono.token, discId, payload);
    expect(criada.res.status).toBe(201);
    if (criada.id) atividadeIds.push(criada.id);
    return criada;
  }

  const questoesObjetivas = [
    {
      content: 'Qual é a capital do Brasil?',
      options: [
        { text: 'Brasília', correct: true, feedback: 'Correto' },
        { text: 'Goiânia', correct: false, feedback: 'Incorreto' },
      ],
    },
  ];

  function questoesDe(body: any): Array<{ options: Array<Record<string, unknown>> }> {
    const json = typeof body.json_data === 'string' ? JSON.parse(body.json_data) : body.json_data;
    return json.questions;
  }

  test('GET /atividades/:id preserva o gabarito em roleta/reforço/minigame e o remove em prova', async () => {
    const roleta = await novaAtividade({ tipo: 'roleta', json_data: roletaJson(questoesObjetivas) });
    const reforco = await novaAtividade({ tipo: 'reforco', json_data: roletaJson(questoesObjetivas) });
    const minigame = await novaAtividade({ tipo: 'minigame', json_data: roletaJson(questoesObjetivas) });
    const prova = await novaAtividade({
      tipo: 'prova',
      allow_password: 0,
      json_data: roletaJson(questoesObjetivas),
    });

    for (const atv of [roleta, reforco, minigame]) {
      const res = await app.request(`/atividades/${atv.id}?senha=senha-do-curso-123`);
      expect(res.status).toBe(200);
      const body = await readBody(res);
      const options = questoesDe(body)[0].options;
      expect(options.some((o: any) => o.correct === true)).toBe(true);
    }

    const provaRes = await app.request(`/atividades/${prova.id}?senha=senha-do-curso-123`);
    expect(provaRes.status).toBe(200);
    const provaBody = await readBody(provaRes);
    const provaOptions = questoesDe(provaBody)[0].options;
    for (const opt of provaOptions) {
      expect('correct' in opt).toBe(false);
    }
    expect(provaBody.senha).toBeUndefined();
  });

  test('atividade com senha própria exige senha e libera com a senha correta', async () => {
    const protegida = await novaAtividade({
      tipo: 'prova',
      allow_password: 1,
      senha: 'segredo123',
      json_data: roletaJson(questoesObjetivas),
    });

    const semSenha = await app.request(`/atividades/${protegida.id}`);
    expect(semSenha.status).toBe(401);

    const senhaErrada = await app.request(`/atividades/${protegida.id}`, {
      headers: { 'x-materia-senha': 'errada' },
    });
    expect(senhaErrada.status).toBe(401);

    const senhaCerta = await app.request(`/atividades/${protegida.id}`, {
      headers: { 'x-materia-senha': 'segredo123' },
    });
    expect(senhaCerta.status).toBe(200);
    const body = await readBody(senhaCerta);
    expect('correct' in questoesDe(body)[0].options[0]).toBe(false);
  });

  test('professor de outro curso recebe a versão anônima (sem gabarito), e o dono recebe completa', async () => {
    const roleta = await novaAtividade({ tipo: 'roleta', json_data: roletaJson(questoesObjetivas) });

    const comoDono = await app.request(`/atividades/${roleta.id}`, { headers: authHeaders(profDono.token) });
    expect(comoDono.status).toBe(200);
    const donoBody = await readBody(comoDono);
    expect(questoesDe(donoBody)[0].options.some((o: any) => o.correct === true)).toBe(true);

    const comoIntruso = await app.request(`/atividades/${roleta.id}`, {
      headers: authHeaders(profIntruso.token),
    });
    expect(comoIntruso.status).toBe(401);

    const listaIntruso = await app.request(`/atividades?materia_id=${discId}`, {
      headers: authHeaders(profIntruso.token),
    });
    expect(listaIntruso.status).toBe(401);
  });

  test('escrita em disciplina de outro professor é bloqueada sem alterar dados', async () => {
    const tituloOriginal = unique('Atividade Protegida');
    const atv = await novaAtividade({ tipo: 'roleta', titulo: tituloOriginal, json_data: roletaJson(questoesObjetivas) });

    const criarIntruso = await createAtividade(profIntruso.token, discId, { tipo: 'roleta' });
    expect(criarIntruso.res.status).toBe(403);

    const editarIntruso = await app.request(`/atividades/${atv.id}`, {
      method: 'PUT',
      headers: jsonHeaders(profIntruso.token),
      body: JSON.stringify({ disciplina_id: discId, titulo: 'Invadida', tipo: 'roleta' }),
    });
    expect(editarIntruso.status).toBe(403);

    const excluirIntruso = await app.request(`/atividades/${atv.id}`, {
      method: 'DELETE',
      headers: authHeaders(profIntruso.token),
    });
    expect(excluirIntruso.status).toBe(403);

    const aindaExiste = db.query('SELECT id, titulo FROM atividades WHERE id = ?').get(atv.id) as any;
    expect(aindaExiste?.id).toBe(atv.id);
    expect(aindaExiste?.titulo).toBe(tituloOriginal);

    const semToken = await app.request(`/atividades/${atv.id}`, {
      method: 'DELETE',
    });
    expect(semToken.status).toBe(401);

    const semTokenCriar = await app.request('/atividades', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ disciplina_id: discId, titulo: 'x', tipo: 'roleta' }),
    });
    expect(semTokenCriar.status).toBe(401);
  });

  test('atividade pode ser vinculada a múltiplas aulas e PUT sem aula_ids preserva os vínculos', async () => {
    const atv = await novaAtividade({
      tipo: 'roleta',
      aula_ids: [aula1Id, aula2Id],
      json_data: roletaJson(questoesObjetivas),
    });

    expect(atv.body.aula_ids.length).toBe(2);
    expect(atv.body.aula_id).toBe(aula1Id);

    const updateSemAulaIds = await app.request(`/atividades/${atv.id}`, {
      method: 'PUT',
      headers: jsonHeaders(profDono.token),
      body: JSON.stringify({
        disciplina_id: discId,
        titulo: 'Título alterado',
        tipo: 'roleta',
        json_data: roletaJson(questoesObjetivas),
      }),
    });
    expect(updateSemAulaIds.status).toBe(200);
    const preservado = await readBody(updateSemAulaIds);
    expect(preservado.aula_ids.length).toBe(2);

    const lista = await app.request(`/atividades?materia_id=${discId}`, { headers: authHeaders(profDono.token) });
    const todas = await readBody(lista);
    const encontrada = todas.find((a: any) => a.id === atv.id);
    expect(encontrada.aula_ids.sort()).toEqual([aula1Id, aula2Id].sort());

    const updateLimpando = await app.request(`/atividades/${atv.id}`, {
      method: 'PUT',
      headers: jsonHeaders(profDono.token),
      body: JSON.stringify({
        disciplina_id: discId,
        titulo: 'Sem aula',
        tipo: 'roleta',
        aula_ids: [],
        json_data: roletaJson(questoesObjetivas),
      }),
    });
    expect(updateLimpando.status).toBe(200);
    const limpo = await readBody(updateLimpando);
    expect(limpo.aula_ids.length).toBe(0);
    expect(limpo.aula_id).toBeNull();
  });

  test('caminho da atividade é sanitizado contra path traversal', async () => {
    const atv = await novaAtividade({
      tipo: 'roleta',
      caminho: '../../etc/passwd',
      json_data: roletaJson(questoesObjetivas),
    });
    expect(atv.body.caminho).not.toContain('..');
    expect(atv.body.caminho.startsWith('/')).toBe(false);
    expect(atv.body.caminho).toBe('_/_/etc/passwd');
  });

  test('PUT sem data_limite preserva o prazo e data_limite null limpa o prazo', async () => {
    const prazo = '2030-01-01T00:00:00.000Z';
    const atv = await novaAtividade({
      tipo: 'roleta',
      data_limite: prazo,
      json_data: roletaJson(questoesObjetivas),
    });
    expect(atv.body.data_limite).toBe(prazo);

    const semPrazoNoBody = await app.request(`/atividades/${atv.id}`, {
      method: 'PUT',
      headers: jsonHeaders(profDono.token),
      body: JSON.stringify({
        disciplina_id: discId,
        titulo: 'Mantém prazo',
        tipo: 'roleta',
        json_data: roletaJson(questoesObjetivas),
      }),
    });
    expect(semPrazoNoBody.status).toBe(200);
    expect((await readBody(semPrazoNoBody)).data_limite).toBe(prazo);

    const novoPrazo = await app.request(`/atividades/${atv.id}`, {
      method: 'PUT',
      headers: jsonHeaders(profDono.token),
      body: JSON.stringify({
        disciplina_id: discId,
        titulo: 'Novo prazo',
        tipo: 'roleta',
        data_limite: '2031-06-30T12:00:00.000Z',
        json_data: roletaJson(questoesObjetivas),
      }),
    });
    expect((await readBody(novoPrazo)).data_limite).toBe('2031-06-30T12:00:00.000Z');

    const semPrazo = await app.request(`/atividades/${atv.id}`, {
      method: 'PUT',
      headers: jsonHeaders(profDono.token),
      body: JSON.stringify({
        disciplina_id: discId,
        titulo: 'Sem prazo',
        tipo: 'roleta',
        data_limite: null,
        json_data: roletaJson(questoesObjetivas),
      }),
    });
    expect((await readBody(semPrazo)).data_limite).toBeNull();
  });

  test('excluir a aula remove o vínculo com a atividade em cascata', async () => {
    const aulaCascataId = (await createAula(profDono.token, discId, 'Aula Cascata')).id;
    const atv = await novaAtividade({
      tipo: 'roleta',
      aula_ids: [aulaCascataId],
      json_data: roletaJson(questoesObjetivas),
    });
    expect(atv.body.aula_ids).toEqual([aulaCascataId]);

    const exclusao = await app.request(`/aulas/${aulaCascataId}`, {
      method: 'DELETE',
      headers: authHeaders(profDono.token),
    });
    expect(exclusao.status).toBeGreaterThanOrEqual(200);
    expect(exclusao.status).toBeLessThan(300);

    const vinculos = db
      .query('SELECT COUNT(*) AS total FROM aula_atividades WHERE aula_id = ?')
      .get(aulaCascataId) as any;
    expect(vinculos.total).toBe(0);

    const lista = await app.request(`/atividades?materia_id=${discId}`, {
      headers: authHeaders(profDono.token),
    });
    const todas = await readBody(lista);
    const encontrada = todas.find((a: any) => a.id === atv.id);
    expect(encontrada.aula_ids.length).toBe(0);
  });

  test('validação de payload de criação', async () => {
    const semDisciplina = await app.request('/atividades', {
      method: 'POST',
      headers: jsonHeaders(profDono.token),
      body: JSON.stringify({ titulo: 'Sem disciplina' }),
    });
    expect(semDisciplina.status).toBe(400);

    const listaSemParametro = await app.request('/atividades');
    expect(listaSemParametro.status).toBe(400);

    const disciplinaInexistente = await app.request('/atividades?materia_id=999999', {
      headers: authHeaders(admin),
    });
    expect(disciplinaInexistente.status).toBe(404);

    const corpoInvalido = await app.request('/atividades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${profDono.token}` },
      body: 'nao-e-json',
    });
    expect(corpoInvalido.status).toBe(400);
  });
});
