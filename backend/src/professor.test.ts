import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { db } from './db';
import app from './routes';
import {
  adminToken,
  authHeaders,
  createCurso,
  createProfessor,
  deleteCurso,
  deleteProfessor,
  jsonHeaders,
  login,
  readBody,
  unique,
} from './testHelpers';

describe('Render de Marp (POST /marp/render)', () => {
  let admin = '';

  beforeAll(async () => {
    admin = await adminToken();
  });

  test('exige autenticação', async () => {
    const semToken = await app.request('/marp/render', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ titulo: 'Aula', markdown: '# Conteúdo' }),
    });
    expect(semToken.status).toBe(401);

    const tokenInvalido = await app.request('/marp/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalido' },
      body: JSON.stringify({ titulo: 'Aula', markdown: '# Conteúdo' }),
    });
    expect(tokenInvalido.status).toBe(401);
  });

  test('valida o corpo da requisição', async () => {
    const semMarkdown = await app.request('/marp/render', {
      method: 'POST',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ titulo: 'Aula' }),
    });
    expect(semMarkdown.status).toBe(400);

    const markdownVazio = await app.request('/marp/render', {
      method: 'POST',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ titulo: 'Aula', markdown: '   ' }),
    });
    expect(markdownVazio.status).toBe(400);

    const tituloNaoString = await app.request('/marp/render', {
      method: 'POST',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ titulo: 42, markdown: '# ok' }),
    });
    expect(tituloNaoString.status).toBe(400);

    const corpoInvalido = await app.request('/marp/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
      body: 'nao-e-json',
    });
    expect(corpoInvalido.status).toBe(400);
  });

  test('gera HTML standalone no endpoint e no alias /api', async () => {
    const payload = {
      titulo: 'Aula de Teste Marp',
      markdown: '# Slide Um\n\nConteúdo da aula de teste\n\n---\n\n## Slide Dois',
    };

    for (const rota of ['/marp/render', '/api/marp/render']) {
      const res = await app.request(rota, {
        method: 'POST',
        headers: jsonHeaders(admin),
        body: JSON.stringify(payload),
      });
      expect(res.status).toBe(200);
      const body = await readBody(res);
      expect(typeof body.html).toBe('string');
      expect(body.html).toContain('<!DOCTYPE html>');
      expect(body.html).toContain('<title>Aula de Teste Marp</title>');
      expect(body.html).toContain('Conteúdo da aula de teste');
      expect(body.html.length).toBeGreaterThan(1000);
    }
  });
});

describe('Rascunhos do editor (professor)', () => {
  let admin = '';
  let profA = { id: 0, token: '' };
  let profB = { id: 0, token: '' };

  beforeAll(async () => {
    admin = await adminToken();
    const a = await createProfessor(admin);
    const b = await createProfessor(admin);
    profA = { id: a.id, token: a.token };
    profB = { id: b.id, token: b.token };
  });

  afterAll(async () => {
    await deleteProfessor(admin, profA.id);
    await deleteProfessor(admin, profB.id);
  });

  function criarRascunho(token: string, payload: Record<string, unknown> = {}) {
    return app.request('/professor/rascunhos-editor', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({
        titulo: unique('Rascunho'),
        descricao: 'Rascunho criado por teste',
        tipo: 'roleta',
        json_data: { questions: [] },
        ...payload,
      }),
    });
  }

  test('exige autenticação em todas as rotas', async () => {
    const semTokenLista = await app.request('/professor/rascunhos-editor');
    expect(semTokenLista.status).toBe(401);

    const semTokenCria = await app.request('/professor/rascunhos-editor', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ titulo: 'x' }),
    });
    expect(semTokenCria.status).toBe(401);

    const semTokenGet = await app.request('/professor/rascunhos-editor/1');
    expect(semTokenGet.status).toBe(401);

    const semTokenDelete = await app.request('/professor/rascunhos-editor/1', { method: 'DELETE' });
    expect(semTokenDelete.status).toBe(401);
  });

  test('cria, lista, atualiza e exclui o próprio rascunho', async () => {
    const criado = await criarRascunho(profA.token);
    expect(criado.status).toBe(200);
    const criadoBody = await readBody(criado);
    expect(criadoBody.success).toBe(true);
    const id = criadoBody.id;
    expect(typeof id).toBe('number');
    const expira = new Date(criadoBody.expira_em).getTime();
    expect(expira - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);

    const lista = await readBody(
      await app.request('/professor/rascunhos-editor', { headers: authHeaders(profA.token) })
    );
    expect(lista.some((r: any) => r.id === id)).toBe(true);

    const detalhe = await app.request(`/professor/rascunhos-editor/${id}`, {
      headers: authHeaders(profA.token),
    });
    expect(detalhe.status).toBe(200);
    expect((await readBody(detalhe)).id).toBe(id);

    const atualizado = await criarRascunho(profA.token, {
      rascunho_id: id,
      titulo: 'Rascunho atualizado',
    });
    expect(atualizado.status).toBe(200);
    const atualizadoBody = await readBody(atualizado);
    expect(atualizadoBody.id).toBe(id);
    const detalheAtualizado = await app.request(`/professor/rascunhos-editor/${id}`, {
      headers: authHeaders(profA.token),
    });
    expect((await readBody(detalheAtualizado)).titulo).toBe('Rascunho atualizado');

    const exclusao = await app.request(`/professor/rascunhos-editor/${id}`, {
      method: 'DELETE',
      headers: authHeaders(profA.token),
    });
    expect(exclusao.status).toBe(200);
    expect((await readBody(exclusao)).success).toBe(true);

    const aposExcluir = await app.request(`/professor/rascunhos-editor/${id}`, {
      headers: authHeaders(profA.token),
    });
    expect(aposExcluir.status).toBe(404);

    const idInvalido = await app.request('/professor/rascunhos-editor/abc', {
      headers: authHeaders(profA.token),
    });
    expect(idInvalido.status).toBe(400);
  });

  test('rascunho de um professor é invisível e intocável para outro', async () => {
    const criado = await readBody(await criarRascunho(profA.token));
    const id = criado.id;

    const listaDeB = await readBody(
      await app.request('/professor/rascunhos-editor', { headers: authHeaders(profB.token) })
    );
    expect(listaDeB.some((r: any) => r.id === id)).toBe(false);

    const getDeB = await app.request(`/professor/rascunhos-editor/${id}`, {
      headers: authHeaders(profB.token),
    });
    expect(getDeB.status).toBe(404);

    const deleteDeB = await app.request(`/professor/rascunhos-editor/${id}`, {
      method: 'DELETE',
      headers: authHeaders(profB.token),
    });
    expect(deleteDeB.status).toBe(200);

    const aindaExiste = await app.request(`/professor/rascunhos-editor/${id}`, {
      headers: authHeaders(profA.token),
    });
    expect(aindaExiste.status).toBe(200);

    await app.request(`/professor/rascunhos-editor/${id}`, {
      method: 'DELETE',
      headers: authHeaders(profA.token),
    });
  });

  test('limita a 20 rascunhos por professor e limpa os expirados', async () => {
    const profTemp = await createProfessor(admin);
    try {
      let ultimoId = 0;
      for (let i = 0; i < 20; i++) {
        const res = await criarRascunho(profTemp.token);
        expect(res.status).toBe(200);
        ultimoId = (await readBody(res)).id;
      }

      const excedente = await criarRascunho(profTemp.token);
      expect(excedente.status).toBe(400);
      const excedenteBody = await readBody(excedente);
      expect(excedenteBody.success).toBe(false);
      expect(excedenteBody.error).toContain('Limite máximo de 20 rascunhos');

      db.query("UPDATE rascunhos_editor SET expira_em = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(
        ultimoId
      );
      const lista = await readBody(
        await app.request('/professor/rascunhos-editor', { headers: authHeaders(profTemp.token) })
      );
      expect(lista.length).toBe(19);
      expect(lista.some((r: any) => r.id === ultimoId)).toBe(false);
    } finally {
      await deleteProfessor(admin, profTemp.id);
    }
  });
});

describe('Admin: CRUD de professores e vínculos com cursos', () => {
  let admin = '';
  let cursoAId = 0;
  let cursoBId = 0;

  beforeAll(async () => {
    admin = await adminToken();
    cursoAId = (await createCurso(admin)).id;
    cursoBId = (await createCurso(admin)).id;
  });

  afterAll(async () => {
    await deleteCurso(admin, cursoAId);
    await deleteCurso(admin, cursoBId);
  });

  test('lista de professores não expõe hash de senha nem salt', async () => {
    const res = await app.request('/professores', { headers: authHeaders(admin) });
    expect(res.status).toBe(200);
    const lista = await readBody(res);
    expect(lista.length).toBeGreaterThan(0);
    for (const item of lista) {
      expect(item.senha_hash).toBeUndefined();
      expect(item.salt).toBeUndefined();
      expect(JSON.stringify(item)).not.toContain('pbkdf2');
    }
  });

  test('cria professor com validação e detecta e-mail duplicado', async () => {
    const invalido = await app.request('/professores', {
      method: 'POST',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ nome: 'Sem senha', email: 'x@example.com' }),
    });
    expect(invalido.status).toBe(400);

    const emailInvalido = await app.request('/professores', {
      method: 'POST',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ nome: 'X', email: 'sem-arroba', password: 'Senha12345!' }),
    });
    expect(emailInvalido.status).toBe(400);

    const email = `${unique('crud_prof')}@example.com`;
    const criado = await app.request('/professores', {
      method: 'POST',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ nome: 'Professor CRUD', email, password: 'Senha12345!' }),
    });
    expect(criado.status).toBe(201);
    const criadoBody = await readBody(criado);
    expect(criadoBody.role).toBe('professor');
    expect(criadoBody.status).toBe('ativo');
    expect(criadoBody.senha_hash).toBeUndefined();

    const duplicado = await app.request('/professores', {
      method: 'POST',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ nome: 'Professor CRUD', email, password: 'Senha12345!' }),
    });
    expect(duplicado.status).toBe(409);

    await deleteProfessor(admin, criadoBody.id);
  });

  test('atualiza dados, rejeita status inválido e permite trocar a senha', async () => {
    const criado = await readBody(
      await app.request('/professores', {
        method: 'POST',
        headers: jsonHeaders(admin),
        body: JSON.stringify({
          nome: 'Professor Update',
          email: `${unique('update_prof')}@example.com`,
          password: 'SenhaOriginal1!',
        }),
      })
    );

    const inexistente = await app.request('/professores/999999', {
      method: 'PUT',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ nome: 'Fantasma' }),
    });
    expect(inexistente.status).toBe(404);

    const statusInvalido = await app.request(`/professores/${criado.id}`, {
      method: 'PUT',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ status: 'arquivado' }),
    });
    expect(statusInvalido.status).toBe(400);

    const atualizado = await app.request(`/professores/${criado.id}`, {
      method: 'PUT',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ nome: 'Professor Renomeado', role: 'professor', status: 'ativo' }),
    });
    expect(atualizado.status).toBe(200);
    expect((await readBody(atualizado)).nome).toBe('Professor Renomeado');

    const emailDuplicado = await app.request(`/professores/${criado.id}`, {
      method: 'PUT',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ email: 'admin@escola.com' }),
    });
    expect(emailDuplicado.status).toBe(409);

    const novaSenha = await app.request(`/professores/${criado.id}`, {
      method: 'PUT',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ password: 'SenhaNova2!' }),
    });
    expect(novaSenha.status).toBe(200);

    const loginAntigo = await login(criado.email, 'SenhaOriginal1!');
    expect(loginAntigo.res.status).toBe(401);
    const loginNovo = await login(criado.email, 'SenhaNova2!');
    expect(loginNovo.res.status).toBe(200);

    await deleteProfessor(admin, criado.id);
  });

  test('vincula e desvincula cursos (ignorando ids inexistentes)', async () => {
    const criado = await readBody(
      await app.request('/professores', {
        method: 'POST',
        headers: jsonHeaders(admin),
        body: JSON.stringify({
          nome: 'Professor Cursos',
          email: `${unique('cursos_prof')}@example.com`,
          password: 'Senha12345!',
        }),
      })
    );

    const semLista = await app.request(`/professores/${criado.id}/cursos`, {
      method: 'PUT',
      headers: jsonHeaders(admin),
      body: JSON.stringify({}),
    });
    expect(semLista.status).toBe(400);

    const vinculado = await app.request(`/professores/${criado.id}/cursos`, {
      method: 'PUT',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ curso_ids: [cursoAId, cursoBId, 999999] }),
    });
    expect(vinculado.status).toBe(200);
    const vinculadoBody = await readBody(vinculado);
    expect(vinculadoBody.map((c: any) => c.id).sort()).toEqual([cursoAId, cursoBId].sort());

    const listado = await app.request(`/professores/${criado.id}/cursos`, {
      headers: authHeaders(admin),
    });
    expect(listado.status).toBe(200);
    expect((await readBody(listado)).length).toBe(2);

    const desvinculado = await app.request(`/professores/${criado.id}/cursos`, {
      method: 'PUT',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ curso_ids: [] }),
    });
    expect((await readBody(desvinculado)).length).toBe(0);

    const professorInexistente = await app.request('/professores/999999/cursos', {
      method: 'PUT',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ curso_ids: [cursoAId] }),
    });
    expect(professorInexistente.status).toBe(404);

    await deleteProfessor(admin, criado.id);
  });

  test('exclui professor e responde 404 na segunda tentativa', async () => {
    const criado = await readBody(
      await app.request('/professores', {
        method: 'POST',
        headers: jsonHeaders(admin),
        body: JSON.stringify({
          nome: 'Professor Excluído',
          email: `${unique('del_prof')}@example.com`,
          password: 'Senha12345!',
        }),
      })
    );

    const exclusao = await app.request(`/professores/${criado.id}`, {
      method: 'DELETE',
      headers: authHeaders(admin),
    });
    expect(exclusao.status).toBe(204);

    const segunda = await app.request(`/professores/${criado.id}`, {
      method: 'DELETE',
      headers: authHeaders(admin),
    });
    expect(segunda.status).toBe(404);

    const semToken = await app.request(`/professores/${criado.id}`, { method: 'DELETE' });
    expect(semToken.status).toBe(401);
  });
});
