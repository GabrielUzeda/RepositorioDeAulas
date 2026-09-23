import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { db } from './db';
import app from './routes';
import {
  adminToken,
  authHeaders,
  createAtividade,
  createCurso,
  createDisciplina,
  deleteCurso,
  jsonHeaders,
  readBody,
  unique,
} from './testHelpers';

const questoesObjetivas = [
  {
    id: 'q1',
    content: 'Qual é a capital do Brasil?',
    options: [
      { text: 'Brasília', correct: true },
      { text: 'Goiânia', correct: false },
    ],
  },
  {
    id: 'q2',
    content: 'Quanto é 2 + 2?',
    options: [
      { text: '4', correct: true },
      { text: '5', correct: false },
    ],
  },
];

describe('Respostas de alunos: correção, LGPD, ranking e rascunhos', () => {
  let admin = '';
  let cursoId = 0;
  let discId = 0;
  let atvObjetivaId = 0;
  let atvDiscursivaId = 0;
  let atvOcultaId = 0;
  let atvComSenhaId = 0;
  let cursoComSenhaId = 0;
  let atvSenhaCursoId = 0;
  const respostaIds: number[] = [];

  beforeAll(async () => {
    admin = await adminToken();
    const curso = await createCurso(admin);
    cursoId = curso.id;
    const disc = await createDisciplina(admin, cursoId);
    discId = disc.id;

    atvObjetivaId = (
      await createAtividade(admin, discId, {
        tipo: 'roleta',
        titulo: 'Atividade Objetiva',
        json_data: { questions: questoesObjetivas },
      })
    ).id;

    atvDiscursivaId = (
      await createAtividade(admin, discId, {
        tipo: 'normal',
        titulo: 'Atividade Discursiva',
        json_data: { questions: [{ content: 'Disserte sobre redes.' }] },
      })
    ).id;

    atvOcultaId = (
      await createAtividade(admin, discId, { tipo: 'roleta', titulo: 'Atividade Oculta' })
    ).id;

    atvComSenhaId = (
      await createAtividade(admin, discId, {
        tipo: 'prova',
        titulo: 'Prova com Senha',
        allow_password: 1,
        senha: 'senha-atividade',
        json_data: { questions: questoesObjetivas },
      })
    ).id;

    const cursoComSenha = await createCurso(admin, { senha: 'senha-do-curso' });
    cursoComSenhaId = cursoComSenha.id;
    const discComSenha = await createDisciplina(admin, cursoComSenhaId);
    atvSenhaCursoId = (
      await createAtividade(admin, discComSenha.id, {
        tipo: 'roleta',
        titulo: 'Atividade de Curso com Senha',
        json_data: { questions: questoesObjetivas },
      })
    ).id;

    await app.request(`/atividades/${atvOcultaId}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ status: 'oculto' }),
    });
  });

  afterAll(async () => {
    await deleteCurso(admin, cursoId);
    await deleteCurso(admin, cursoComSenhaId);
  });

  function submeter(atividadeId: number, payload: Record<string, unknown> = {}) {
    return app.request(`/atividades/${atividadeId}/respostas`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        aluno_nome: 'Aluno de Teste',
        aluno_email: `${unique('aluno')}@example.com`,
        ...payload,
      }),
    });
  }

  test('correção objetiva casa por texto (case-insensitive) e calcula a pontuação', async () => {
    const email = `${unique('aluno')}@example.com`;
    const metade = await submeter(atvObjetivaId, {
      aluno_email: email,
      respostas: { q1: '  BRASÍLIA ', q2: '5' },
    });
    expect(metade.status).toBe(201);
    const metadeBody = await readBody(metade);
    expect(metadeBody.acertos).toBe(1);
    expect(metadeBody.total).toBe(2);
    expect(metadeBody.pontuacao).toBe(50);
    expect(typeof metadeBody.consulta_token).toBe('string');
    respostaIds.push(metadeBody.id);

    const total = await submeter(atvObjetivaId, {
      respostas: [
        { questao: 'q1', resposta: 'Brasília' },
        { questao: 'q2', resposta: '4' },
      ],
    });
    expect(total.status).toBe(201);
    const totalBody = await readBody(total);
    expect(totalBody.acertos).toBe(2);
    expect(totalBody.pontuacao).toBe(100);
    respostaIds.push(totalBody.id);

    const semRespostas = await submeter(atvObjetivaId, {
      respostas: JSON.stringify({ q1: 'Brasília' }),
    });
    const semRespostasBody = await readBody(semRespostas);
    expect(semRespostasBody.acertos).toBe(1);
    expect(semRespostasBody.total).toBe(2);
    respostaIds.push(semRespostasBody.id);

    const nenhuma = await submeter(atvObjetivaId, { respostas: { q1: 'x', q2: 'y' } });
    const nenhumaBody = await readBody(nenhuma);
    expect(nenhumaBody.acertos).toBe(0);
    expect(nenhumaBody.pontuacao).toBe(0);
    respostaIds.push(nenhumaBody.id);

    const discursiva = await submeter(atvDiscursivaId, { respostas: { 0: 'Texto livre' } });
    expect(discursiva.status).toBe(201);
    const discursivaBody = await readBody(discursiva);
    expect(discursivaBody.total).toBe(0);
    expect(discursivaBody.pontuacao).toBe(0);
    respostaIds.push(discursivaBody.id);

    const row = db
      .query('SELECT aluno_nome, aluno_email, respostas, aluno_email_hash FROM respostas_alunos WHERE id = ?')
      .get(totalBody.id) as any;
    expect(row.aluno_email.startsWith('enc:v1:')).toBe(true);
    expect(row.aluno_nome.startsWith('enc:v1:')).toBe(true);
    expect(row.respostas.startsWith('enc:v1:')).toBe(true);
    expect(row.aluno_email).not.toContain(email);
    expect(row.aluno_email_hash.length).toBeGreaterThan(10);
  });

  test('valida payloads, atividade inexistente e atividade oculta', async () => {
    const semNome = await app.request(`/atividades/${atvObjetivaId}/respostas`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ aluno_email: 'a@b.com', respostas: {} }),
    });
    expect(semNome.status).toBe(400);

    const emailInvalido = await submeter(atvObjetivaId, { aluno_email: 'sem-arroba', respostas: {} });
    expect(emailInvalido.status).toBe(400);

    const semRespostas = await app.request(`/atividades/${atvObjetivaId}/respostas`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ aluno_nome: 'A', aluno_email: 'a@b.com' }),
    });
    expect(semRespostas.status).toBe(400);

    const inexistente = await submeter(999999, { respostas: {} });
    expect(inexistente.status).toBe(404);

    const oculta = await submeter(atvOcultaId, { respostas: {} });
    expect(oculta.status).toBe(403);

    const peloEndpointGenerico = await app.request('/submeter-resposta', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        atividade_id: atvObjetivaId,
        aluno_nome: 'Aluno Genérico',
        aluno_email: `${unique('aluno')}@example.com`,
        respostas: { q1: 'Brasília', q2: '4' },
      }),
    });
    expect(peloEndpointGenerico.status).toBe(201);
    const genericoBody = await readBody(peloEndpointGenerico);
    expect(genericoBody.acertos).toBe(2);
    respostaIds.push(genericoBody.id);

    const semAtividade = await app.request('/submeter-resposta', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ aluno_nome: 'A', aluno_email: 'a@b.com', respostas: {} }),
    });
    expect(semAtividade.status).toBe(400);
  });

  test('senhas de curso e de atividade bloqueiam a submissão', async () => {
    const semSenhaCurso = await submeter(atvSenhaCursoId, { respostas: { q1: 'Brasília', q2: '4' } });
    expect(semSenhaCurso.status).toBe(403);
    const semSenhaCursoBody = await readBody(semSenhaCurso);
    expect(semSenhaCursoBody.erro).toBe('Senha do curso incorreta');

    const senhaErrada = await submeter(atvSenhaCursoId, {
      respostas: { q1: 'Brasília', q2: '4' },
      senha_curso: 'errada',
    });
    expect(senhaErrada.status).toBe(403);

    const senhaCerta = await submeter(atvSenhaCursoId, {
      respostas: { q1: 'Brasília', q2: '4' },
      senha_curso: 'senha-do-curso',
    });
    expect(senhaCerta.status).toBe(201);
    const senhaCertaBody = await readBody(senhaCerta);
    expect(senhaCertaBody.acertos).toBe(2);
    respostaIds.push(senhaCertaBody.id);

    const semSenhaAtividade = await submeter(atvComSenhaId, { respostas: { q1: 'Brasília' } });
    expect(semSenhaAtividade.status).toBe(403);
    const semSenhaAtividadeBody = await readBody(semSenhaAtividade);
    expect(semSenhaAtividadeBody.erro).toBe('Senha da atividade incorreta');

    const comSenhaAtividade = await submeter(atvComSenhaId, {
      respostas: { q1: 'Brasília', q2: '4' },
      senha_atividade: 'senha-atividade',
    });
    expect(comSenhaAtividade.status).toBe(201);
    respostaIds.push((await readBody(comSenhaAtividade)).id);
  });

  test('reenvio do mesmo e-mail atualiza o registro em vez de duplicar', async () => {
    const email = `${unique('aluno')}@example.com`;
    const primeira = await submeter(atvObjetivaId, { aluno_email: email, respostas: { q1: 'Errado', q2: 'Errado' } });
    expect(primeira.status).toBe(201);
    const primeiraBody = await readBody(primeira);
    respostaIds.push(primeiraBody.id);

    const segunda = await submeter(atvObjetivaId, {
      aluno_email: email,
      respostas: { q1: 'Brasília', q2: '4' },
    });
    expect(segunda.status).toBe(200);
    const segundaBody = await readBody(segunda);
    expect(segundaBody.id).toBe(primeiraBody.id);
    expect(segundaBody.acertos).toBe(2);

    const total = db
      .query('SELECT COUNT(*) AS total FROM respostas_alunos WHERE atividade_id = ? AND id = ?')
      .get(atvObjetivaId, primeiraBody.id) as any;
    expect(total.total).toBe(1);

    const listaProfessor = await app.request(`/atividades/${atvObjetivaId}/respostas`, {
      headers: authHeaders(admin),
    });
    expect(listaProfessor.status).toBe(200);
    const rows = await readBody(listaProfessor);
    const atualizada = rows.find((r: any) => r.id === primeiraBody.id);
    expect(atualizada.respostas).toContain('Brasília');
  });

  test('LGPD: consulta com token, token inválido e exclusão em cascata', async () => {
    const email = `${unique('aluno')}@example.com`;
    const envio = await submeter(atvObjetivaId, {
      aluno_email: email,
      respostas: { q1: 'Brasília', q2: '4' },
    });
    const envioBody = await readBody(envio);
    respostaIds.push(envioBody.id);
    const token = envioBody.consulta_token;

    const semToken = await app.request(`/aluno/minhas-respostas?email=${encodeURIComponent(email)}`);
    expect(semToken.status).toBe(401);

    const tokenCurto = await app.request(
      `/aluno/minhas-respostas?email=${encodeURIComponent(email)}&token=abc`
    );
    expect(tokenCurto.status).toBe(401);

    const emailInvalido = await app.request(`/aluno/minhas-respostas?email=invalido&token=${token}`);
    expect(emailInvalido.status).toBe(400);

    const tokenErrado = await app.request(
      `/aluno/minhas-respostas?email=${encodeURIComponent(email)}&token=token_totalmente_invalido`
    );
    expect(tokenErrado.status).toBe(401);

    const consulta = await app.request(
      `/aluno/minhas-respostas?email=${encodeURIComponent(email)}&token=${token}`
    );
    expect(consulta.status).toBe(200);
    const consultaBody = await readBody(consulta);
    expect(consultaBody.length).toBe(1);
    expect(consultaBody[0].aluno_email).toBe(email);
    expect(consultaBody[0].respostas).toContain('Brasília');

    const rascunho = await app.request(`/atividades/${atvObjetivaId}/rascunhos`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email, nome: 'Aluno de Teste', respostas: { q1: 'rascunho' } }),
    });
    const rascunhoBody = await readBody(rascunho);
    expect(rascunhoBody.success).toBe(true);

    const exclusaoSemToken = await app.request(
      `/aluno/minhas-respostas?email=${encodeURIComponent(email)}&token=token_totalmente_invalido`,
      { method: 'DELETE' }
    );
    expect(exclusaoSemToken.status).toBe(401);

    const exclusao = await app.request(
      `/aluno/minhas-respostas?email=${encodeURIComponent(email)}&token=${token}`,
      { method: 'DELETE' }
    );
    expect(exclusao.status).toBe(204);

    const aposExclusao = await app.request(
      `/aluno/minhas-respostas?email=${encodeURIComponent(email)}&token=${token}`
    );
    expect(aposExclusao.status).toBe(401);

    const rascunhoRemovido = await app.request(`/rascunhos/${rascunhoBody.codigo}`);
    expect(rascunhoRemovido.status).toBe(404);
  });

  test('ranking: nome público formatado, ordenação e limites de pontuação', async () => {
    const nome = await app.request('/ranking', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ atividade_id: atvObjetivaId, pontuacao: 95.7, nome_jogador: 'Joao da Silva' }),
    });
    expect(nome.status).toBe(200);
    const nomeBody = await readBody(nome);
    expect(nomeBody.nome_jogador).toBe('Joao D.');
    expect(nomeBody.pontuacao).toBe(95);

    const nomeCompleto = await readBody(
      await app.request('/ranking', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ atividade_id: atvObjetivaId, pontuacao: 10, nome_jogador: 'Maria Souza' }),
      })
    );
    expect(nomeCompleto.nome_jogador).toBe('Maria S.');

    const negativo = await readBody(
      await app.request('/ranking', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ atividade_id: atvObjetivaId, pontuacao: -50, nome_jogador: '' }),
      })
    );
    expect(negativo.pontuacao).toBe(0);
    expect(negativo.nome_jogador).toBe('Aluno');

    const acimaDoTeto = await readBody(
      await app.request('/ranking', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ atividade_id: atvObjetivaId, pontuacao: 2_000_000, nome_jogador: 'Maria Souza' }),
      })
    );
    expect(acimaDoTeto.pontuacao).toBe(1_000_000);

    const lista = await readBody(await app.request(`/ranking/${atvObjetivaId}`));
    expect(lista.length).toBeGreaterThanOrEqual(3);
    expect(lista[0].pontuacao).toBe(1_000_000);
    for (let i = 1; i < lista.length; i++) {
      expect(lista[i - 1].pontuacao >= lista[i].pontuacao).toBe(true);
    }

    const invalido = await app.request('/ranking', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ pontuacao: 10 }),
    });
    expect(invalido.status).toBe(400);

    const pontuacaoInvalida = await app.request('/ranking', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ atividade_id: atvObjetivaId, pontuacao: 'nao-numero' }),
    });
    expect(pontuacaoInvalida.status).toBe(400);

    const inexistente = await app.request('/ranking', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ atividade_id: 999999, pontuacao: 10 }),
    });
    expect(inexistente.status).toBe(404);
  });

  test('rascunhos: código, upsert por e-mail, restauração e expiração', async () => {
    const email = `${unique('aluno')}@example.com`;
    const criar = await app.request(`/atividades/${atvObjetivaId}/rascunhos`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email, nome: 'Aluno Rascunho', respostas: { q1: 'Brasília' } }),
    });
    expect(criar.status).toBe(200);
    const criado = await readBody(criar);
    expect(criado.success).toBe(true);
    expect(criado.codigo).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
    const expira = new Date(criado.expira_em).getTime();
    const trintaDiasMs = 30 * 24 * 60 * 60 * 1000;
    expect(expira - Date.now()).toBeGreaterThan(trintaDiasMs - 60_000);
    expect(expira - Date.now()).toBeLessThanOrEqual(trintaDiasMs);

    const restaurado = await app.request(`/rascunhos/${criado.codigo.toLowerCase()}`);
    expect(restaurado.status).toBe(200);
    const restauradoBody = await readBody(restaurado);
    expect(restauradoBody.data.nome).toBe('Aluno Rascunho');
    expect(restauradoBody.data.email).toBe(email);
    expect(restauradoBody.data.respostas.q1).toBe('Brasília');
    expect(restauradoBody.data.atividade_id).toBe(atvObjetivaId);

    const salvoNovamente = await app.request(`/atividades/${atvObjetivaId}/rascunhos`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email, nome: 'Aluno Rascunho', respostas: { q1: 'Atualizado' } }),
    });
    const salvoNovamenteBody = await readBody(salvoNovamente);
    expect(salvoNovamenteBody.codigo).toBe(criado.codigo);

    const codigoInexistente = await app.request('/rascunhos/AAAAAAAAAAAA');
    expect(codigoInexistente.status).toBe(404);

    const emailInvalido = await app.request(`/atividades/${atvObjetivaId}/rascunhos`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email: 'invalido', respostas: {} }),
    });
    expect(emailInvalido.status).toBe(400);

    const atividadeInexistente = await app.request('/atividades/999999/rascunhos', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email, respostas: {} }),
    });
    expect(atividadeInexistente.status).toBe(404);

    db.query('UPDATE rascunhos_atividades SET expira_em = ? WHERE codigo_recuperacao = ?').run(
      '2020-01-01T00:00:00.000Z',
      criado.codigo
    );
    const expirado = await app.request(`/rascunhos/${criado.codigo}`);
    expect(expirado.status).toBe(404);
    const aindaNoBanco = db
      .query('SELECT COUNT(*) AS total FROM rascunhos_atividades WHERE codigo_recuperacao = ?')
      .get(criado.codigo) as any;
    expect(aindaNoBanco.total).toBe(0);
  });

  test('professor acessa e exclui respostas apenas com autenticação', async () => {
    const semAuth = await app.request(`/atividades/${atvObjetivaId}/respostas`);
    expect(semAuth.status).toBe(401);

    const lista = await app.request(`/atividades/${atvObjetivaId}/respostas`, {
      headers: authHeaders(admin),
    });
    expect(lista.status).toBe(200);
    const rows = await readBody(lista);
    expect(rows.length).toBeGreaterThan(0);

    const alvo = rows[0];
    const exclusao = await app.request(`/respostas/${alvo.id}`, {
      method: 'DELETE',
      headers: authHeaders(admin),
    });
    expect(exclusao.status).toBe(204);
    const removida = db.query('SELECT COUNT(*) AS total FROM respostas_alunos WHERE id = ?').get(alvo.id) as any;
    expect(removida.total).toBe(0);

    const inexistente = await app.request(`/respostas/${alvo.id}`, {
      method: 'DELETE',
      headers: authHeaders(admin),
    });
    expect(inexistente.status).toBe(404);

    const semAuthDelete = await app.request(`/respostas/${alvo.id}`, { method: 'DELETE' });
    expect(semAuthDelete.status).toBe(401);
  });
});
