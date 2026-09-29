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

describe('Rotas Avancadas e Testes de Integracao Profunda', () => {
  let admin: string;
  let prof: { id: number; token: string };
  let outroProf: { id: number; token: string };
  let cursoId: number;
  let disciplinaId: number;
  let disciplinaSlug: string;

  beforeAll(async () => {
    admin = await adminToken();
    const p1 = await createProfessor(admin);
    const p2 = await createProfessor(admin);
    prof = { id: p1.id, token: p1.token };
    outroProf = { id: p2.id, token: p2.token };

    const curso = await createCurso(admin, { senha: 'senhaCurso123' });
    cursoId = curso.id;
    await linkProfessorToCurso(admin, prof.id, cursoId);

    const disc = await createDisciplina(prof.token, cursoId);
    disciplinaId = disc.id;
    disciplinaSlug = disc.slug;
  });

  afterAll(async () => {
    await deleteCurso(admin, cursoId);
    await deleteProfessor(admin, prof.id);
    await deleteProfessor(admin, outroProf.id);
  });

  test('Ciclo de vida e status de cursos, disciplinas e atividades', async () => {
    const patchCursoOculto = await app.request(`/cursos/${cursoId}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ status: 'oculto' }),
    });
    expect(patchCursoOculto.status).toBe(200);

    const getAnonym = await app.request('/cursos');
    expect(getAnonym.status).toBe(200);
    const cursosAnonym = await readBody(getAnonym);
    expect(cursosAnonym.some((c: any) => c.id === cursoId)).toBe(false);

    const patchCursoAtivo = await app.request(`/cursos/${cursoId}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ status: 'ativo' }),
    });
    expect(patchCursoAtivo.status).toBe(200);

    const patchDiscInvalido = await app.request(`/disciplinas/${disciplinaId}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ status: 'status_inexistente' }),
    });
    expect(patchDiscInvalido.status).toBe(400);

    const patchDiscOculto = await app.request(`/disciplinas/${disciplinaId}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ status: 'oculto' }),
    });
    expect(patchDiscOculto.status).toBe(200);

    const getDiscAnonym = await app.request(`/cursos/${cursoId}/disciplinas`, {
      headers: { 'x-curso-senha': 'senhaCurso123' },
    });
    expect(getDiscAnonym.status).toBe(200);
    const discAnonym = await readBody(getDiscAnonym);
    expect(discAnonym.some((d: any) => d.id === disciplinaId)).toBe(false);

    const patchDiscOutro = await app.request(`/disciplinas/${disciplinaId}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(outroProf.token),
      body: JSON.stringify({ status: 'ativo' }),
    });
    expect(patchDiscOutro.status).toBe(403);

    const atv = await createAtividade(prof.token, disciplinaId);
    const patchAtvInvalido = await app.request(`/atividades/${atv.id}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ status: 'invalido' }),
    });
    expect(patchAtvInvalido.status).toBe(400);

    const patchAtvOculto = await app.request(`/atividades/${atv.id}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ status: 'oculto' }),
    });
    expect(patchAtvOculto.status).toBe(200);

    await app.request(`/atividades/${atv.id}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ status: 'ativo' }),
    });
    await app.request(`/disciplinas/${disciplinaId}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ status: 'ativo' }),
    });
  });

  test('Controle de prazos em atividades com data_limite', async () => {
    const prazoFuturo = new Date(Date.now() + 86400000).toISOString();
    const prazoPassado = new Date(Date.now() - 86400000).toISOString();

    const atvFuturo = await createAtividade(prof.token, disciplinaId, {
      data_limite: prazoFuturo,
      json_data: roletaJson([{ content: 'Q1', options: [{ text: 'A', correct: true }] }]),
    });

    const subFuturo = await app.request(`/atividades/${atvFuturo.id}/respostas`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        aluno_nome: 'Aluno Futuro',
        aluno_email: `${unique('aluno')}@example.com`,
        respostas: { '0': 'A' },
        senha_curso: 'senhaCurso123',
      }),
    });
    expect([200, 201]).toContain(subFuturo.status);
    const subFuturoData = await readBody(subFuturo);
    const rowFuturo = db.query('SELECT entregue_com_atraso FROM respostas_alunos WHERE id = ?').get(subFuturoData.id) as any;
    expect(rowFuturo.entregue_com_atraso).toBe(0);

    const atvPassado = await createAtividade(prof.token, disciplinaId, {
      data_limite: prazoPassado,
      json_data: roletaJson([{ content: 'Q1', options: [{ text: 'A', correct: true }] }]),
    });

    const subPassado = await app.request(`/atividades/${atvPassado.id}/respostas`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        aluno_nome: 'Aluno Passado',
        aluno_email: `${unique('aluno')}@example.com`,
        respostas: { '0': 'A' },
        senha_curso: 'senhaCurso123',
      }),
    });
    expect([200, 201]).toContain(subPassado.status);
    const subPassadoData = await readBody(subPassado);
    const rowPassado = db.query('SELECT entregue_com_atraso FROM respostas_alunos WHERE id = ?').get(subPassadoData.id) as any;
    expect(rowPassado.entregue_com_atraso).toBe(1);
  });

  test('Relacao N:N de aulas e atividades em aula_atividades', async () => {
    const aula1 = await createAula(prof.token, disciplinaId, 'Aula 1');
    const aula2 = await createAula(prof.token, disciplinaId, 'Aula 2');

    const resAtv = await app.request('/atividades', {
      method: 'POST',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({
        disciplina_id: disciplinaId,
        titulo: unique('Atividade NN'),
        tipo: 'roleta',
        json_data: roletaJson([{ content: 'Q1', options: [{ text: 'A', correct: true }] }]),
        aula_ids: [aula1.id, aula2.id],
      }),
    });
    expect(resAtv.status).toBe(201);
    const atvBody = await readBody(resAtv);
    const atvId = atvBody.id;

    const links = db.query('SELECT aula_id FROM aula_atividades WHERE atividade_id = ?').all(atvId) as any[];
    expect(links.length).toBe(2);
    expect(links.map(l => l.aula_id).sort()).toEqual([aula1.id, aula2.id].sort());

    const delAula1 = await app.request(`/aulas/${aula1.id}`, {
      method: 'DELETE',
      headers: authHeaders(prof.token),
    });
    expect(delAula1.status).toBe(204);

    const linksRestantes = db.query('SELECT aula_id FROM aula_atividades WHERE atividade_id = ?').all(atvId) as any[];
    expect(linksRestantes.length).toBe(1);
    expect(linksRestantes[0].aula_id).toBe(aula2.id);

    const atvCheck = db.query('SELECT id FROM atividades WHERE id = ?').get(atvId);
    expect(atvCheck).toBeDefined();
  });

  test('Endpoints de documentos orientadores e RAG', async () => {
    const docRes = await app.request(`/disciplinas/${disciplinaId}/documentos`, {
      method: 'POST',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({
        titulo: 'Ementa de Teste',
        tipo: 'ementa',
        nome_arquivo: 'ementa.txt',
        conteudo_texto: '# Unidade 1\nConteudo programatico da disciplina para RAG.',
      }),
    });
    expect(docRes.status).toBe(201);
    const docData = await readBody(docRes);
    const docId = docData.id;

    const getDocs = await app.request(`/disciplinas/${disciplinaId}/documentos`, {
      method: 'GET',
      headers: authHeaders(prof.token),
    });
    expect(getDocs.status).toBe(200);
    const docsList = await readBody(getDocs);
    expect(docsList.some((d: any) => d.id === docId)).toBe(true);

    const cursoDocRes = await app.request(`/cursos/${cursoId}/documentos`, {
      method: 'POST',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({
        titulo: 'Plano Geral do Curso',
        tipo: 'plano_ensino',
        nome_arquivo: 'plano.txt',
        conteudo_texto: '# Geral\nDiretrizes do curso inteiro.',
      }),
    });
    expect(cursoDocRes.status).toBe(201);
    const cursoDocData = await readBody(cursoDocRes);
    const cursoDocId = cursoDocData.id;

    const getCursoDocs = await app.request(`/cursos/${cursoId}/documentos`, {
      method: 'GET',
      headers: authHeaders(prof.token),
    });
    expect(getCursoDocs.status).toBe(200);
    const cursoDocsList = await readBody(getCursoDocs);
    expect(cursoDocsList.some((d: any) => d.id === cursoDocId)).toBe(true);

    const secaoCheck = db.query('SELECT id FROM documento_secoes WHERE documento_id = ?').get(docId);
    expect(secaoCheck).toBeDefined();

    const delDoc = await app.request(`/disciplinas/${disciplinaId}/documentos/${docId}`, {
      method: 'DELETE',
      headers: authHeaders(prof.token),
    });
    expect(delDoc.status).toBe(204);

    const secaoAposDel = db.query('SELECT id FROM documento_secoes WHERE documento_id = ?').get(docId);
    expect(secaoAposDel).toBeNull();

    await app.request(`/cursos/${cursoId}/documentos/${cursoDocId}`, {
      method: 'DELETE',
      headers: authHeaders(prof.token),
    });
  });

  test('Expurgo de ranking e seguranca administrativa', async () => {
    const purgeAnon = await app.request('/admin/expurgar-ranking', {
      method: 'POST',
      headers: jsonHeaders(),
    });
    expect(purgeAnon.status).toBe(401);

    const purgeProf = await app.request('/admin/expurgar-ranking', {
      method: 'POST',
      headers: jsonHeaders(prof.token),
    });
    expect(purgeProf.status).toBe(403);

    const purgeAdmin = await app.request('/admin/expurgar-ranking', {
      method: 'POST',
      headers: jsonHeaders(admin),
    });
    expect(purgeAdmin.status).toBe(200);
    const purgeBody = await readBody(purgeAdmin);
    expect(purgeBody).toHaveProperty('deletados');
  });

  test('Acesso protegido a recursos estaticos em /materias/*', async () => {
    const cursoSemSenha = await createCurso(admin);
    const discOutra = await createDisciplina(prof.token, cursoSemSenha.id, 'Disc Outra');
    const aulaOutra = await createAula(prof.token, discOutra.id, 'Aula Outra');

    const reqSemAuth = await app.request(`/materias/${discOutra.slug}/aulas/inexistente.html`);
    expect([401, 404]).toContain(reqSemAuth.status);

    const reqComSenhaErrada = await app.request(`/materias/${disciplinaSlug}/aulas/teste.html`, {
      headers: { 'x-curso-senha': 'senhaErrada' },
    });
    expect(reqComSenhaErrada.status).toBe(401);

    const reqComSenhaCerta = await app.request(`/materias/${disciplinaSlug}/aulas/teste.html`, {
      headers: { 'x-curso-senha': 'senhaCurso123' },
    });
    expect([200, 404]).toContain(reqComSenhaCerta.status);

    const traversalReq = await app.request('/materias/../etc/passwd');
    expect([400, 404]).toContain(traversalReq.status);

    const traversalReqNested = await app.request(`/materias/${disciplinaSlug}/../../etc/passwd`);
    expect([400, 404]).toContain(traversalReqNested.status);

    await deleteCurso(admin, cursoSemSenha.id);
  });
});
