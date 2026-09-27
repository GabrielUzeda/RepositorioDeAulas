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

describe('Matriz de autorização (admin, dono do curso, intruso e anônimo)', () => {
  let admin = '';
  let dono = { id: 0, token: '' };
  let intruso = { id: 0, token: '' };
  let cursoId = 0;
  let discId = 0;
  let aulaId = 0;
  let atvId = 0;
  let respostaId = 0;
  let cursoExtraId = 0;
  let profExtraId = 0;

  const questoes = [
    {
      id: 'q1',
      content: 'Qual é o valor de 2 + 2?',
      options: [
        { text: '4', correct: true },
        { text: '5', correct: false },
      ],
    },
  ];

  beforeAll(async () => {
    admin = await adminToken();
    const donoProf = await createProfessor(admin);
    const intrusoProf = await createProfessor(admin);
    dono = { id: donoProf.id, token: donoProf.token };
    intruso = { id: intrusoProf.id, token: intrusoProf.token };

    const curso = await createCurso(admin);
    cursoId = curso.id;
    await linkProfessorToCurso(admin, dono.id, cursoId);

    discId = (await createDisciplina(dono.token, cursoId)).id;
    aulaId = (await createAula(dono.token, discId)).id;
    atvId = (
      await createAtividade(dono.token, discId, { tipo: 'roleta', json_data: roletaJson(questoes) })
    ).id;

    const submissao = await app.request(`/atividades/${atvId}/respostas`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        aluno_nome: 'Aluno Autorização',
        aluno_email: `${unique('aluno')}@example.com`,
        respostas: { q1: '4' },
      }),
    });
    expect(submissao.status).toBe(201);
    respostaId = (await readBody(submissao)).id;
  });

  afterAll(async () => {
    if (cursoExtraId) await deleteCurso(admin, cursoExtraId);
    if (profExtraId) await deleteProfessor(admin, profExtraId);
    await deleteCurso(admin, cursoId);
    await deleteProfessor(admin, dono.id);
    await deleteProfessor(admin, intruso.id);
  });

  test('rotas administrativas rejeitam professor e liberam admin', async () => {
    const rotasSemEfeito: Array<{ metodo: string; rota: string; corpo?: Record<string, unknown> }> = [
      { metodo: 'GET', rota: '/professores' },
      { metodo: 'GET', rota: '/db-test' },
      { metodo: 'PUT', rota: `/cursos/${cursoId}/professores`, corpo: { professor_ids: [dono.id] } },
      { metodo: 'PATCH', rota: `/cursos/${cursoId}/status`, corpo: { status: 'ativo' } },
      { metodo: 'POST', rota: '/admin/expurgar-ranking' },
      {
        metodo: 'POST',
        rota: '/send-mail',
        corpo: { template: 'envio_atividades', to: 'x@example.com' },
      },
    ];

    for (const { metodo, rota, corpo } of rotasSemEfeito) {
      const semToken = await app.request(rota, {
        method: metodo,
        headers: jsonHeaders(),
        ...(corpo ? { body: JSON.stringify(corpo) } : {}),
      });
      expect(semToken.status).toBe(401);

      const comProfessor = await app.request(rota, {
        method: metodo,
        headers: jsonHeaders(dono.token),
        ...(corpo ? { body: JSON.stringify(corpo) } : {}),
      });
      expect(comProfessor.status).toBe(403);

      const comAdmin = await app.request(rota, {
        method: metodo,
        headers: jsonHeaders(admin),
        ...(corpo ? { body: JSON.stringify(corpo) } : {}),
      });
      expect(comAdmin.status).toBeLessThan(400);
    }

    const criarCursoProibido = await app.request('/cursos', {
      method: 'POST',
      headers: jsonHeaders(dono.token),
      body: JSON.stringify({ nome: 'Curso Indevido' }),
    });
    expect(criarCursoProibido.status).toBe(403);

    const criarCursoPermitido = await app.request('/cursos', {
      method: 'POST',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ nome: unique('Curso Admin Check') }),
    });
    expect(criarCursoPermitido.status).toBe(201);
    cursoExtraId = (await readBody(criarCursoPermitido)).id;

    const criarProfessorProibido = await app.request('/professores', {
      method: 'POST',
      headers: jsonHeaders(dono.token),
      body: JSON.stringify({
        nome: 'Professor Indevido',
        email: `${unique('indevido')}@example.com`,
        password: 'Senha12345!',
      }),
    });
    expect(criarProfessorProibido.status).toBe(403);

    const criarProfessorPermitido = await app.request('/professores', {
      method: 'POST',
      headers: jsonHeaders(admin),
      body: JSON.stringify({
        nome: 'Professor Admin Check',
        email: `${unique('admincheck')}@example.com`,
        password: 'Senha12345!',
      }),
    });
    expect(criarProfessorPermitido.status).toBe(201);
    profExtraId = (await readBody(criarProfessorPermitido)).id;
  });

  test('professor intruso não escreve na disciplina de outro curso', async () => {
    const criarDisciplina = await app.request('/disciplinas', {
      method: 'POST',
      headers: jsonHeaders(intruso.token),
      body: JSON.stringify({ curso_id: cursoId, nome: unique('Disciplina Intrusa') }),
    });
    expect(criarDisciplina.status).toBe(403);

    const editarDisciplina = await app.request(`/disciplinas/${discId}`, {
      method: 'PUT',
      headers: jsonHeaders(intruso.token),
      body: JSON.stringify({ nome: 'Renomeada pelo intruso' }),
    });
    expect(editarDisciplina.status).toBe(404);

    const excluirDisciplina = await app.request(`/disciplinas/${discId}`, {
      method: 'DELETE',
      headers: authHeaders(intruso.token),
    });
    expect(excluirDisciplina.status).toBe(403);

    const criarAula = await app.request('/aulas', {
      method: 'POST',
      headers: jsonHeaders(intruso.token),
      body: JSON.stringify({ disciplina_id: discId, titulo: 'Aula Intrusa' }),
    });
    expect(criarAula.status).toBe(403);

    const editarAula = await app.request(`/aulas/${aulaId}`, {
      method: 'PUT',
      headers: jsonHeaders(intruso.token),
      body: JSON.stringify({ disciplina_id: discId, titulo: 'Aula Renomeada' }),
    });
    expect(editarAula.status).toBe(403);

    const excluirAula = await app.request(`/aulas/${aulaId}`, {
      method: 'DELETE',
      headers: authHeaders(intruso.token),
    });
    expect(excluirAula.status).toBe(403);

    const statusAtividade = await app.request(`/atividades/${atvId}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(intruso.token),
      body: JSON.stringify({ status: 'oculto' }),
    });
    expect(statusAtividade.status).toBe(403);

    const statusDisciplina = await app.request(`/disciplinas/${discId}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(intruso.token),
      body: JSON.stringify({ status: 'oculto' }),
    });
    expect(statusDisciplina.status).toBe(403);

    const disciplina = db.query('SELECT nome, status FROM disciplinas WHERE id = ?').get(discId) as any;
    expect(disciplina.nome).not.toBe('Renomeada pelo intruso');
    expect(disciplina.status ?? 'ativo').toBe('ativo');

    const aula = db.query('SELECT titulo FROM aulas WHERE id = ?').get(aulaId) as any;
    expect(aula.titulo).not.toBe('Aula Renomeada');

    const atividade = db.query('SELECT status FROM atividades WHERE id = ?').get(atvId) as any;
    expect(atividade.status ?? 'ativo').toBe('ativo');
  });

  test('professor intruso não lê nem avalia respostas, relatórios ou documentos', async () => {
    const listarRespostas = await app.request(`/atividades/${atvId}/respostas`, {
      headers: authHeaders(intruso.token),
    });
    expect(listarRespostas.status).toBe(403);

    const avaliarResposta = await app.request(`/respostas/${respostaId}/avaliacao`, {
      method: 'PUT',
      headers: jsonHeaders(intruso.token),
      body: JSON.stringify({ nota: 100, feedback: 'Nota do intruso' }),
    });
    expect(avaliarResposta.status).toBe(403);

    const salvarLote = await app.request(`/atividades/${atvId}/salvar-avaliacoes`, {
      method: 'POST',
      headers: jsonHeaders(intruso.token),
      body: JSON.stringify({ avaliacoes: [{ resposta_id: respostaId, nota: 90, feedback: 'Lote intruso' }] }),
    });
    expect(salvarLote.status).toBe(403);

    const relatorio = await app.request(`/disciplinas/${discId}/relatorio-feedback`, {
      headers: authHeaders(intruso.token),
    });
    expect(relatorio.status).toBe(403);

    const salvarFeedback = await app.request(`/disciplinas/${discId}/salvar-feedback-geral`, {
      method: 'POST',
      headers: jsonHeaders(intruso.token),
      body: JSON.stringify({ feedback_geral: 'Feedback do intruso' }),
    });
    expect(salvarFeedback.status).toBe(403);

    const listarDocsDisc = await app.request(`/disciplinas/${discId}/documentos`, {
      headers: authHeaders(intruso.token),
    });
    expect(listarDocsDisc.status).toBe(403);

    const listarDocsCurso = await app.request(`/cursos/${cursoId}/documentos`, {
      headers: authHeaders(intruso.token),
    });
    expect(listarDocsCurso.status).toBe(403);

    const subirDoc = await app.request(`/cursos/${cursoId}/documentos`, {
      method: 'POST',
      headers: jsonHeaders(intruso.token),
      body: JSON.stringify({ titulo: 'Doc intruso', tipo: 'outro', conteudo_texto: 'x' }),
    });
    expect(subirDoc.status).toBe(403);

    const resposta = db.query('SELECT nota, feedback FROM respostas_alunos WHERE id = ?').get(respostaId) as any;
    expect(resposta.nota).toBeNull();
    expect(resposta.feedback).toBeNull();

    const feedbacks = db
      .query('SELECT COUNT(*) AS total FROM disciplina_feedbacks WHERE disciplina_id = ?')
      .get(discId) as any;
    expect(feedbacks.total).toBe(0);
  });

  test('token ausente, malformado ou adulterado é rejeitado', async () => {
    const malformado = await app.request(`/atividades/${atvId}/respostas`, {
      headers: { Authorization: 'Bearer nao-e-um-jwt' },
    });
    expect(malformado.status).toBe(401);

    const tokenDoDono = dono.token;
    const adulterado = `${tokenDoDono.slice(0, -4)}XXXX`;
    const comAssinaturaAdulterada = await app.request(`/atividades/${atvId}/respostas`, {
      headers: { Authorization: `Bearer ${adulterado}` },
    });
    expect(comAssinaturaAdulterada.status).toBe(401);

    const semBearer = await app.request(`/atividades/${atvId}/respostas`, {
      headers: { Authorization: dono.token },
    });
    expect(semBearer.status).toBe(401);

    const rotaAdminComTokenAdulterado = await app.request('/professores', {
      headers: { Authorization: `Bearer ${adulterado}` },
    });
    expect(rotaAdminComTokenAdulterado.status).toBe(401);
  });

  test('anônimo só acessa o que é público (currículo e conteúdo liberado)', async () => {
    const listarRespostas = await app.request(`/atividades/${atvId}/respostas`);
    expect(listarRespostas.status).toBe(401);

    const listarAtividades = await app.request(`/atividades?materia_id=${discId}`);
    expect(listarAtividades.status).toBe(200);

    const listarCursos = await app.request('/cursos');
    expect(listarCursos.status).toBe(200);

    const listarProfessores = await app.request('/professores');
    expect(listarProfessores.status).toBe(401);
  });

  test('GET /disciplinas/:id exige a senha do curso e esconde disciplina oculta', async () => {
    const cursoProtegido = await createCurso(admin, { senha: 'senha-forte-123' });
    await linkProfessorToCurso(admin, dono.id, cursoProtegido.id);
    const disciplinaProtegida = await createDisciplina(dono.token, cursoProtegido.id, 'Disciplina Protegida');

    try {
      const semSenha = await app.request(`/disciplinas/${disciplinaProtegida.id}`);
      expect(semSenha.status).toBe(401);

      const senhaErrada = await app.request(`/disciplinas/${disciplinaProtegida.id}?senha=errada`);
      expect(senhaErrada.status).toBe(401);

      const comSenha = await app.request(`/disciplinas/${disciplinaProtegida.id}?senha=senha-forte-123`);
      expect(comSenha.status).toBe(200);
      const publica = await readBody(comSenha);
      expect(publica.nome).toBe(disciplinaProtegida.nome);
      expect(publica.status).toBeUndefined();

      const comoDono = await app.request(`/disciplinas/${disciplinaProtegida.id}`, {
        headers: authHeaders(dono.token),
      });
      expect(comoDono.status).toBe(200);
      expect((await readBody(comoDono)).status).toBe('ativo');

      const comoIntruso = await app.request(`/disciplinas/${disciplinaProtegida.id}`, {
        headers: authHeaders(intruso.token),
      });
      expect(comoIntruso.status).toBe(401);

      const inexistente = await app.request('/disciplinas/999999');
      expect(inexistente.status).toBe(404);

      const ocultar = await app.request(`/disciplinas/${disciplinaProtegida.id}/status`, {
        method: 'PATCH',
        headers: jsonHeaders(dono.token),
        body: JSON.stringify({ status: 'oculto' }),
      });
      expect(ocultar.status).toBe(200);

      const ocultaAnonima = await app.request(`/disciplinas/${disciplinaProtegida.id}?senha=senha-forte-123`);
      expect(ocultaAnonima.status).toBe(404);

      const ocultaParaODono = await app.request(`/disciplinas/${disciplinaProtegida.id}`, {
        headers: authHeaders(dono.token),
      });
      expect(ocultaParaODono.status).toBe(200);
    } finally {
      await deleteCurso(admin, cursoProtegido.id);
    }
  });
});
