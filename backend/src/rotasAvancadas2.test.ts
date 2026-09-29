import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { db } from './db';
import app from './routes';
import {
  adminToken,
  authHeaders,
  createAtividade,
  createCurso,
  createDisciplina,
  createProfessor,
  deleteCurso,
  deleteProfessor,
  jsonHeaders,
  readBody,
  roletaJson,
  unique,
} from './testHelpers';

describe('Rotas Avancadas 2 - rascunhos, vinculos, ranking, legado e bordas', () => {
  let admin: string;
  let prof: { id: number; token: string };
  let intruso: { id: number; token: string };
  let cursoId: number;
  let cursoSenha: string;
  let disciplinaId: number;

  beforeAll(async () => {
    admin = await adminToken();
    const p1 = await createProfessor(admin);
    const p2 = await createProfessor(admin);
    prof = { id: p1.id, token: p1.token };
    intruso = { id: p2.id, token: p2.token };
    cursoSenha = 'senha-forte-2';
    const curso = await createCurso(admin, { senha: cursoSenha });
    cursoId = curso.id;
    await app.request(`/professores/${prof.id}/cursos`, {
      method: 'PUT',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ curso_ids: [cursoId] }),
    });
    const disc = await createDisciplina(prof.token, cursoId);
    disciplinaId = disc.id;
  });

  afterAll(async () => {
    await deleteCurso(admin, cursoId);
    await deleteProfessor(admin, prof.id);
    await deleteProfessor(admin, intruso.id);
  });

  test('Rascunhos: ciclo criar, buscar case-insensitive, 404 e validacao', async () => {
    const atv = await createAtividade(prof.token, disciplinaId);
    const email = `${unique('rasc')}@example.com`;

    const badEmail = await app.request(`/atividades/${atv.id}/rascunhos`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email: 'nao-e-email', respostas: { '0': 'x' } }),
    });
    expect(badEmail.status).toBe(400);

    const atvInexistente = await app.request('/atividades/999999999/rascunhos', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email, respostas: { '0': 'x' } }),
    });
    expect(atvInexistente.status).toBe(404);

    const created = await app.request(`/atividades/${atv.id}/rascunhos`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ nome: 'Aluno Rasc', email, respostas: { '0': 'minuta parcial' } }),
    });
    expect(created.status).toBe(200);
    const createdBody = await readBody(created);
    expect(createdBody.success).toBe(true);
    expect(createdBody.codigo).toHaveLength(12);

    const fetched = await app.request(`/rascunhos/${createdBody.codigo.toLowerCase()}`);
    expect(fetched.status).toBe(200);
    const fetchedBody = await readBody(fetched);
    expect(fetchedBody.success).toBe(true);
    expect(fetchedBody.data.email).toBe(email);
    expect(fetchedBody.data.nome).toBe('Aluno Rasc');
    expect(fetchedBody.data.atividade_id).toBe(atv.id);

    const upsert = await app.request(`/atividades/${atv.id}/rascunhos`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email, respostas: { '0': 'minuta v2' } }),
    });
    const upsertBody = await readBody(upsert);
    expect(upsertBody.codigo).toBe(createdBody.codigo);

    const missing = await app.request('/rascunhos/AAAAAAAAAAAA');
    expect(missing.status).toBe(404);
    const missingBody = await readBody(missing);
    expect(missingBody.success).toBe(false);
  });

  test('Rascunhos enviar-email: validacao e degradacao sem SMTP', async () => {
    const atv = await createAtividade(prof.token, disciplinaId);

    const badEmail = await app.request(`/atividades/${atv.id}/rascunhos/enviar-email`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email: 'invalido', codigo: 'ABC123' }),
    });
    expect(badEmail.status).toBe(400);

    const semCodigo = await app.request(`/atividades/${atv.id}/rascunhos/enviar-email`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email: 'aluno@example.com', codigo: '' }),
    });
    expect(semCodigo.status).toBe(400);

    const ok = await app.request(`/atividades/${atv.id}/rascunhos/enviar-email`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email: 'aluno@example.com', codigo: 'ABC123XYZ456' }),
    });
    expect(ok.status).toBe(200);
    const okBody = await readBody(ok);
    expect(okBody).toHaveProperty('success');
  });

  test('Vinculos curso-professores: PUT/GET, desvinculo revoga gestao, 404 e 401', async () => {
    const curso = await createCurso(admin);
    const cid = curso.id;

    const anonGet = await app.request(`/cursos/${cid}/professores`);
    expect(anonGet.status).toBe(401);

    const set = await app.request(`/cursos/${cid}/professores`, {
      method: 'PUT',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ professor_ids: [prof.id, intruso.id] }),
    });
    expect(set.status).toBe(200);
    const setBody = await readBody(set);
    expect(setBody.map((p: any) => p.id).sort()).toEqual([prof.id, intruso.id].sort());

    const get = await app.request(`/cursos/${cid}/professores`, {
      headers: authHeaders(admin),
    });
    expect(get.status).toBe(200);
    expect((await readBody(get)).length).toBe(2);

    const curso404 = await app.request('/cursos/999999999/professores', {
      method: 'PUT',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ professor_ids: [prof.id] }),
    });
    expect(curso404.status).toBe(404);

    const profSet = await app.request(`/cursos/${cid}/professores`, {
      method: 'PUT',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ professor_ids: [prof.id] }),
    });
    expect(profSet.status).toBe(403);

    const unset = await app.request(`/cursos/${cid}/professores`, {
      method: 'PUT',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ professor_ids: [prof.id] }),
    });
    expect(unset.status).toBe(200);
    expect((await readBody(unset)).map((p: any) => p.id)).toEqual([prof.id]);

    await deleteCurso(admin, cid);
  });

  test('PUT /cursos/:id: atualiza, troca senha, 404 e 400', async () => {
    const curso = await createCurso(admin, { nome: 'Curso PUT' });

    const upd = await app.request(`/cursos/${curso.id}`, {
      method: 'PUT',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ nome: 'Curso PUT Renomeado' }),
    });
    expect(upd.status).toBe(200);
    expect((await readBody(upd)).nome).toBe('Curso PUT Renomeado');

    const trocaSenha = await app.request(`/cursos/${curso.id}`, {
      method: 'PUT',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ senha: 'nova-senha-999' }),
    });
    expect(trocaSenha.status).toBe(200);

    const senhaNovaOk = await app.request(`/cursos/${curso.id}/verificar-senha`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ senha: 'nova-senha-999' }),
    });
    expect(senhaNovaOk.status).toBe(200);

    const senhaAntigaNaoExiste = await app.request(`/cursos/${curso.id}/verificar-senha`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ senha: 'qualquer-outra' }),
    });
    expect(senhaAntigaNaoExiste.status).toBe(401);

    const removeSenha = await app.request(`/cursos/${curso.id}`, {
      method: 'PUT',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ senha: '' }),
    });
    expect(removeSenha.status).toBe(200);

    const semSenha = await app.request(`/cursos/${curso.id}`, {
      headers: authHeaders(admin),
    });
    expect((await readBody(semSenha)).possui_senha).toBe(0);

    const inexistente = await app.request('/cursos/999999999', {
      method: 'PUT',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ nome: 'x' }),
    });
    expect(inexistente.status).toBe(404);

    const idInvalido = await app.request('/cursos/abc', {
      method: 'PUT',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ nome: 'x' }),
    });
    expect(idInvalido.status).toBe(400);

    await deleteCurso(admin, curso.id);
  });

  test('PUT /disciplinas/:id e alias POST /disciplinas/:id atualizam', async () => {
    const disc = await createDisciplina(prof.token, cursoId, 'Disc Update');

    const upd = await app.request(`/disciplinas/${disc.id}`, {
      method: 'PUT',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ nome: 'Disc Renomeada', descricao: 'nova desc' }),
    });
    expect(upd.status).toBe(200);
    expect((await readBody(upd)).nome).toBe('Disc Renomeada');

    const alias = await app.request(`/disciplinas/${disc.id}`, {
      method: 'POST',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ nome: 'Disc Alias' }),
    });
    expect(alias.status).toBe(200);
    expect((await readBody(alias)).nome).toBe('Disc Alias');

    const intrusoUpd = await app.request(`/disciplinas/${disc.id}`, {
      method: 'PUT',
      headers: jsonHeaders(intruso.token),
      body: JSON.stringify({ nome: 'hack' }),
    });
    expect(intrusoUpd.status).toBe(404);

    await app.request(`/disciplinas/${disc.id}`, {
      method: 'DELETE',
      headers: authHeaders(prof.token),
    });
  });

  test('Status arquivado oculta de anonimo e bloqueia submissao', async () => {
    const atv = await createAtividade(prof.token, disciplinaId, {
      json_data: roletaJson([{ content: 'Q', options: [{ text: 'A', correct: true }] }]),
    });

    await app.request(`/atividades/${atv.id}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ status: 'arquivado' }),
    });

    const bloqueada = await app.request(`/atividades/${atv.id}/respostas`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        aluno_nome: 'Aluno',
        aluno_email: `${unique('a')}@example.com`,
        respostas: { '0': 'A' },
        senha_curso: cursoSenha,
      }),
    });
    expect(bloqueada.status).toBe(403);

    await app.request(`/atividades/${atv.id}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ status: 'ativo' }),
    });

    const liberada = await app.request(`/atividades/${atv.id}/respostas`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        aluno_nome: 'Aluno',
        aluno_email: `${unique('a')}@example.com`,
        respostas: { '0': 'A' },
        senha_curso: cursoSenha,
      }),
    });
    expect([200, 201]).toContain(liberada.status);

    await app.request(`/cursos/${cursoId}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ status: 'arquivado' }),
    });
    const listaAnon = await readBody(await app.request('/cursos'));
    expect(listaAnon.some((c: any) => c.id === cursoId)).toBe(false);
    await app.request(`/cursos/${cursoId}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ status: 'ativo' }),
    });
  });

  test('Ranking: POST com teto, GET com senha, 401 sem senha e 404', async () => {
    const atv = await createAtividade(prof.token, disciplinaId);

    const semSenhaPost = await app.request('/ranking', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ atividade_id: atv.id, nome_jogador: 'Jogador X', pontuacao: 100 }),
    });
    expect(semSenhaPost.status).toBe(403);

    const post = await app.request('/ranking', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        atividade_id: atv.id,
        nome_jogador: '  jogador teste  ',
        pontuacao: 250,
        senha_curso: cursoSenha,
      }),
    });
    expect(post.status).toBe(200);
    const postBody = await readBody(post);
    expect(postBody.pontuacao).toBe(250);
    expect(postBody.nome_jogador).not.toBe('  jogador teste  ');

    const cap = await app.request('/ranking', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        atividade_id: atv.id,
        nome_jogador: ' Hacker',
        pontuacao: 99999999,
        senha_curso: cursoSenha,
      }),
    });
    expect((await readBody(cap)).pontuacao).toBe(1000000);

    const negativa = await app.request('/ranking', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        atividade_id: atv.id,
        nome_jogador: 'Neg',
        pontuacao: -50,
        senha_curso: cursoSenha,
      }),
    });
    expect((await readBody(negativa)).pontuacao).toBe(0);

    const getSemSenha = await app.request(`/ranking/${atv.id}`);
    expect(getSemSenha.status).toBe(401);

    const getComSenha = await app.request(`/ranking/${atv.id}?senha=${encodeURIComponent(cursoSenha)}`);
    expect(getComSenha.status).toBe(200);
    const lista = await readBody(getComSenha);
    expect(Array.isArray(lista)).toBe(true);
    expect(lista.length).toBeGreaterThanOrEqual(3);
    expect(lista[0].pontuacao).toBeGreaterThanOrEqual(lista[lista.length - 1].pontuacao);

    const getGestor = await app.request(`/ranking/${atv.id}`, {
      headers: authHeaders(prof.token),
    });
    expect(getGestor.status).toBe(200);

    const get404 = await app.request('/ranking/999999999', {
      headers: authHeaders(admin),
    });
    expect(get404.status).toBe(404);

    const post400 = await app.request('/ranking', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ nome_jogador: 'x' }),
    });
    expect(post400.status).toBe(400);
  });

  test('Legado POST /submeter-resposta com atividade_id no body', async () => {
    const atv = await createAtividade(prof.token, disciplinaId, {
      json_data: roletaJson([{ content: 'Q leg', options: [{ text: 'A', correct: true }] }]),
    });

    const ok = await app.request('/submeter-resposta', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        atividade_id: atv.id,
        aluno_nome: 'Aluno Legado',
        aluno_email: `${unique('leg')}@example.com`,
        respostas: { '0': 'A' },
        senha_curso: cursoSenha,
      }),
    });
    expect([200, 201]).toContain(ok.status);
    const okBody = await readBody(ok);
    expect(okBody).toHaveProperty('consulta_token');

    const semId = await app.request('/submeter-resposta', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ aluno_nome: 'x', aluno_email: 'x@example.com', respostas: {} }),
    });
    expect(semId.status).toBe(400);
  });

  test('PATCH /respostas/:id/email: atualiza, valida e autoriza', async () => {
    const atv = await createAtividade(prof.token, disciplinaId, {
      json_data: roletaJson([{ content: 'Q', options: [{ text: 'A', correct: true }] }]),
    });
    const emailOrig = `${unique('orig')}@example.com`;
    const sub = await app.request(`/atividades/${atv.id}/respostas`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        aluno_nome: 'Aluno',
        aluno_email: emailOrig,
        respostas: { '0': 'A' },
        senha_curso: cursoSenha,
      }),
    });
    const subId = (await readBody(sub)).id;
    const novoEmail = `${unique('novo')}@example.com`;

    const ok = await app.request(`/respostas/${subId}/email`, {
      method: 'PATCH',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ novo_email: novoEmail }),
    });
    expect(ok.status).toBe(200);
    const okBody = await readBody(ok);
    expect(okBody.aluno_email).toBe(novoEmail);

    const row = db.query('SELECT aluno_email_hash FROM respostas_alunos WHERE id = ?').get(subId) as any;
    expect(row.aluno_email_hash).toBe(okBody.aluno_email_hash);

    const invalido = await app.request(`/respostas/${subId}/email`, {
      method: 'PATCH',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ novo_email: 'nao-email' }),
    });
    expect(invalido.status).toBe(400);

    const semCampo = await app.request(`/respostas/${subId}/email`, {
      method: 'PATCH',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({}),
    });
    expect(semCampo.status).toBe(400);

    const inexistente = await app.request('/respostas/999999999/email', {
      method: 'PATCH',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ novo_email: novoEmail }),
    });
    expect(inexistente.status).toBe(404);

    const intrusoReq = await app.request(`/respostas/${subId}/email`, {
      method: 'PATCH',
      headers: jsonHeaders(intruso.token),
      body: JSON.stringify({ novo_email: novoEmail }),
    });
    expect(intrusoReq.status).toBe(403);

    const idInvalido = await app.request('/respostas/abc/email', {
      method: 'PATCH',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ novo_email: novoEmail }),
    });
    expect(idInvalido.status).toBe(400);
  });

  test('POST /send-mail: authz e bloqueio de html cru', async () => {
    const anon = await app.request('/send-mail', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ to: 'x@example.com', subject: 's', template: 'envio_atividades' }),
    });
    expect(anon.status).toBe(401);

    const profReq = await app.request('/send-mail', {
      method: 'POST',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ to: 'x@example.com', subject: 's', template: 'envio_atividades' }),
    });
    expect(profReq.status).toBe(403);

    const htmlCru = await app.request('/send-mail', {
      method: 'POST',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ to: 'x@example.com', subject: 's', html: '<b>oi</b>' }),
    });
    expect(htmlCru.status).toBe(400);

    const semBody = await app.request('/send-mail', {
      method: 'POST',
      headers: jsonHeaders(admin),
    });
    expect(semBody.status).toBe(400);
  });

  test('Documentos: bordas - vazio 400, tipo invalido 400, 403 intruso, 404 e 413', async () => {
    const vazio = await app.request(`/disciplinas/${disciplinaId}/documentos`, {
      method: 'POST',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ titulo: 'Vazio', tipo: 'ementa', conteudo_texto: '   ' }),
    });
    expect(vazio.status).toBe(400);

    const tipoInvalido = await app.request(`/disciplinas/${disciplinaId}/documentos`, {
      method: 'POST',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({
        titulo: 'Doc Tipo Ruim',
        tipo: 'tipo_custom_xyz',
        nome_arquivo: 'c.txt',
        conteudo_texto: '# Secao\nTexto suficiente para indexar.',
      }),
    });
    expect(tipoInvalido.status).toBe(400);

    const tipoOk = await app.request(`/disciplinas/${disciplinaId}/documentos`, {
      method: 'POST',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({
        titulo: 'Doc Apostila',
        tipo: 'apostila',
        nome_arquivo: 'c.txt',
        conteudo_texto: '# Secao\nTexto suficiente para indexar.',
      }),
    });
    expect(tipoOk.status).toBe(201);
    const tipoOkBody = await readBody(tipoOk);
    expect(tipoOkBody.tipo).toBe('apostila');
    const tipoLivreId = tipoOkBody.id;

    const tipoInvalidoCurso = await app.request(`/cursos/${cursoId}/documentos`, {
      method: 'POST',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({
        titulo: 'Doc Curso Ruim',
        tipo: 'relatorio',
        nome_arquivo: 'c.txt',
        conteudo_texto: '# Geral\nTexto do curso.',
      }),
    });
    expect(tipoInvalidoCurso.status).toBe(400);

    const intrusoGet = await app.request(`/disciplinas/${disciplinaId}/documentos`, {
      headers: authHeaders(intruso.token),
    });
    expect(intrusoGet.status).toBe(403);

    const intrusoDel = await app.request(`/disciplinas/${disciplinaId}/documentos/${tipoLivreId}`, {
      method: 'DELETE',
      headers: authHeaders(intruso.token),
    });
    expect(intrusoDel.status).toBe(403);

    const delInexistente = await app.request(`/disciplinas/${disciplinaId}/documentos/999999999`, {
      method: 'DELETE',
      headers: authHeaders(prof.token),
    });
    expect(delInexistente.status).toBe(404);

    const grande = await app.request(`/disciplinas/${disciplinaId}/documentos`, {
      method: 'POST',
      headers: { ...jsonHeaders(prof.token), 'content-length': String(11 * 1024 * 1024) },
      body: JSON.stringify({ titulo: 'G', tipo: 'outro', conteudo_texto: 'x' }),
    });
    expect(grande.status).toBe(413);

    const del = await app.request(`/disciplinas/${disciplinaId}/documentos/${tipoLivreId}`, {
      method: 'DELETE',
      headers: authHeaders(prof.token),
    });
    expect(del.status).toBe(204);
  });

  test('GET /disciplinas/:id: gate de senha, oculta 404 e gestor sem senha', async () => {
    const semSenha = await app.request(`/disciplinas/${disciplinaId}`);
    expect(semSenha.status).toBe(401);

    const senhaErrada = await app.request(`/disciplinas/${disciplinaId}`, {
      headers: { 'x-curso-senha': 'errada' },
    });
    expect(senhaErrada.status).toBe(401);

    const comSenha = await app.request(`/disciplinas/${disciplinaId}`, {
      headers: { 'x-curso-senha': cursoSenha },
    });
    expect(comSenha.status).toBe(200);
    const comSenhaBody = await readBody(comSenha);
    expect(comSenhaBody).not.toHaveProperty('status');

    const gestor = await app.request(`/disciplinas/${disciplinaId}`, {
      headers: authHeaders(prof.token),
    });
    expect(gestor.status).toBe(200);
    expect(await readBody(gestor)).toHaveProperty('status');

    await app.request(`/disciplinas/${disciplinaId}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ status: 'oculto' }),
    });
    const ocultaAnon = await app.request(`/disciplinas/${disciplinaId}`, {
      headers: { 'x-curso-senha': cursoSenha },
    });
    expect(ocultaAnon.status).toBe(404);
    const ocultaGestor = await app.request(`/disciplinas/${disciplinaId}`, {
      headers: authHeaders(prof.token),
    });
    expect(ocultaGestor.status).toBe(200);
    await app.request(`/disciplinas/${disciplinaId}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(prof.token),
      body: JSON.stringify({ status: 'ativo' }),
    });

    const inexistente = await app.request('/disciplinas/999999999', {
      headers: authHeaders(admin),
    });
    expect(inexistente.status).toBe(404);
  });
});
