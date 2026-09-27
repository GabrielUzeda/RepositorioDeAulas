import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { db, runDataRetentionPurge } from './db';
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
  linkProfessorToCurso,
  readBody,
  unique,
} from './testHelpers';

const CERTO_Q1 = '4';
const CERTO_Q2 = '8';
const ERRADO_Q1 = '5';
const ERRADO_Q2 = '9';

const questoesObjetivas = [
  {
    id: 'q1',
    title: 'Quanto é 2 + 2?',
    content: 'Quanto é 2 + 2?',
    options: [
      { text: CERTO_Q1, correct: true },
      { text: ERRADO_Q1, correct: false },
    ],
  },
  {
    id: 'q2',
    title: 'Quanto é 4 + 4?',
    content: 'Quanto é 4 + 4?',
    options: [
      { text: CERTO_Q2, correct: true },
      { text: ERRADO_Q2, correct: false },
    ],
  },
];

describe('Estatísticas agregadas por questão (diagnóstico da turma)', () => {
  let admin = '';
  let dono = { id: 0, token: '' };
  let intruso = { id: 0, token: '' };
  let cursoId = 0;
  let discId = 0;
  let atvId = 0;
  let atvDiscursivaId = 0;
  const emails = new Map<number, string>();

  function emailAluno(indice: number): string {
    if (!emails.has(indice)) emails.set(indice, `${unique(`aluno${indice}`)}@example.com`);
    return emails.get(indice) as string;
  }

  beforeAll(async () => {
    admin = await adminToken();
    const donoProf = await createProfessor(admin);
    const intrusoProf = await createProfessor(admin);
    dono = { id: donoProf.id, token: donoProf.token };
    intruso = { id: intrusoProf.id, token: intrusoProf.token };

    cursoId = (await createCurso(admin)).id;
    await linkProfessorToCurso(admin, dono.id, cursoId);
    discId = (await createDisciplina(dono.token, cursoId)).id;

    atvId = (
      await createAtividade(dono.token, discId, {
        tipo: 'reforco',
        titulo: 'Reforço Estatísticas',
        json_data: { questions: questoesObjetivas },
      })
    ).id;

    atvDiscursivaId = (
      await createAtividade(dono.token, discId, {
        tipo: 'normal',
        titulo: 'Discursiva Estatísticas',
        json_data: { questions: [{ id: 'd1', content: 'Disserte sobre redes.' }] },
      })
    ).id;
  });

  afterAll(async () => {
    await deleteCurso(admin, cursoId);
    await deleteProfessor(admin, dono.id);
    await deleteProfessor(admin, intruso.id);
  });

  async function submeter(
    atividadeId: number,
    email: string,
    respostas: Record<string, string>,
    statusEsperado = 201
  ) {
    const res = await app.request(`/atividades/${atividadeId}/respostas`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ aluno_nome: 'Aluno Estatística', aluno_email: email, respostas }),
    });
    expect(res.status).toBe(statusEsperado);
    return readBody(res);
  }

  async function buscarEstatisticas(token = dono.token) {
    const res = await app.request(`/disciplinas/${discId}/estatisticas`, {
      headers: authHeaders(token),
    });
    expect(res.status).toBe(200);
    return readBody(res);
  }

  function atividadeDe(dados: any, atividadeId: number) {
    const encontrada = dados.atividades.find((a: any) => a.id === atividadeId);
    expect(encontrada).toBeDefined();
    return encontrada;
  }

  test('sem submissões lista as questões sem nenhum número', async () => {
    const dados = await buscarEstatisticas();
    expect(dados.min_agrupamento).toBe(5);

    const atv = atividadeDe(dados, atvId);
    expect(atv.tipo).toBe('reforco');
    expect(atv.total_submissoes).toBe(0);
    expect(atv.suficientes).toBe(false);
    expect(atv.questoes.length).toBe(2);
    expect(atv.questoes[0].titulo).toContain('2 + 2');
    expect(atv.questoes[0].objetivo).toBe(true);
    for (const questao of atv.questoes) {
      expect(questao.acertos).toBeNull();
      expect(questao.erros).toBeNull();
      expect(questao.respondentes).toBeNull();
      expect(questao.taxa_acerto).toBeNull();
    }
  });

  test('com menos de 5 submissões suprime os números mesmo tendo contadores', async () => {
    await submeter(atvId, emailAluno(1), { q1: CERTO_Q1, q2: CERTO_Q2 });
    await submeter(atvId, emailAluno(2), { q1: CERTO_Q1, q2: ERRADO_Q2 });

    const dados = await buscarEstatisticas();
    const atv = atividadeDe(dados, atvId);
    expect(atv.total_submissoes).toBe(2);
    expect(atv.suficientes).toBe(false);
    for (const questao of atv.questoes) {
      expect(questao.acertos).toBeNull();
      expect(questao.taxa_acerto).toBeNull();
    }

    const contadores = db
      .query('SELECT COUNT(*) AS total FROM estatisticas_questoes WHERE atividade_id = ?')
      .get(atvId) as any;
    expect(contadores.total).toBe(2);
  });

  test('com 5 submissões expõe acertos e erros por questão', async () => {
    await submeter(atvId, emailAluno(3), { q1: CERTO_Q1, q2: ERRADO_Q2 });
    await submeter(atvId, emailAluno(4), { q1: CERTO_Q1, q2: ERRADO_Q2 });
    await submeter(atvId, emailAluno(5), { q1: ERRADO_Q1, q2: ERRADO_Q2 });

    const atv = atividadeDe(await buscarEstatisticas(), atvId);
    expect(atv.total_submissoes).toBe(5);
    expect(atv.suficientes).toBe(true);

    expect(atv.questoes[0].acertos).toBe(4);
    expect(atv.questoes[0].erros).toBe(1);
    expect(atv.questoes[0].respondentes).toBe(5);
    expect(atv.questoes[0].taxa_acerto).toBe(80);

    expect(atv.questoes[1].acertos).toBe(1);
    expect(atv.questoes[1].erros).toBe(4);
    expect(atv.questoes[1].taxa_acerto).toBe(20);
  });

  test('reenvio do mesmo aluno substitui a contribuição sem inflar a turma', async () => {
    await submeter(atvId, emailAluno(5), { q1: CERTO_Q1, q2: CERTO_Q2 }, 200);

    const atv = atividadeDe(await buscarEstatisticas(), atvId);
    expect(atv.total_submissoes).toBe(5);
    expect(atv.questoes[0].acertos).toBe(5);
    expect(atv.questoes[0].erros).toBe(0);
    expect(atv.questoes[0].taxa_acerto).toBe(100);
    expect(atv.questoes[1].acertos).toBe(2);
    expect(atv.questoes[1].erros).toBe(3);
    expect(atv.questoes[1].taxa_acerto).toBe(40);
  });

  test('exclusão pelo professor devolve a contribuição daquele aluno', async () => {
    const ultima = db
      .query('SELECT id FROM respostas_alunos WHERE atividade_id = ? ORDER BY id DESC LIMIT 1')
      .get(atvId) as any;

    const exclusao = await app.request(`/respostas/${ultima.id}`, {
      method: 'DELETE',
      headers: authHeaders(dono.token),
    });
    expect(exclusao.status).toBe(204);

    const depoisDaExclusao = atividadeDe(await buscarEstatisticas(), atvId);
    expect(depoisDaExclusao.total_submissoes).toBe(4);
    expect(depoisDaExclusao.suficientes).toBe(false);
    expect(depoisDaExclusao.questoes[0].acertos).toBeNull();

    await submeter(atvId, emailAluno(6), { q1: ERRADO_Q1, q2: ERRADO_Q2 });
    const comCincoNovamente = atividadeDe(await buscarEstatisticas(), atvId);
    expect(comCincoNovamente.total_submissoes).toBe(5);
    expect(comCincoNovamente.questoes[0].acertos).toBe(4);
    expect(comCincoNovamente.questoes[0].erros).toBe(1);
    expect(comCincoNovamente.questoes[0].respondentes).toBe(5);
    expect(comCincoNovamente.questoes[1].acertos).toBe(1);
    expect(comCincoNovamente.questoes[1].erros).toBe(4);
  });

  test('exclusão LGPD pelo próprio aluno também devolve a contribuição', async () => {
    const envio = await submeter(atvId, emailAluno(7), { q1: CERTO_Q1, q2: ERRADO_Q2 });
    const comSete = atividadeDe(await buscarEstatisticas(), atvId);
    expect(comSete.total_submissoes).toBe(6);
    expect(comSete.questoes[0].acertos).toBe(5);
    expect(comSete.questoes[1].erros).toBe(5);

    const exclusaoLgpd = await app.request(
      `/aluno/minhas-respostas?email=${encodeURIComponent(emailAluno(7))}&token=${envio.consulta_token}`,
      { method: 'DELETE' }
    );
    expect(exclusaoLgpd.status).toBe(204);

    const aposLgpd = atividadeDe(await buscarEstatisticas(), atvId);
    expect(aposLgpd.total_submissoes).toBe(5);
    expect(aposLgpd.suficientes).toBe(true);
    expect(aposLgpd.questoes[0].acertos).toBe(4);
    expect(aposLgpd.questoes[0].erros).toBe(1);
    expect(aposLgpd.questoes[0].taxa_acerto).toBe(80);
    expect(aposLgpd.questoes[1].acertos).toBe(1);
    expect(aposLgpd.questoes[1].erros).toBe(4);
  });

  test('questão com menos respondentes que o limiar fica oculta mesmo com turma suficiente', async () => {
    const antes = db
      .query("SELECT acertos, erros FROM estatisticas_questoes WHERE atividade_id = ? AND questao_ref = 'q2'")
      .get(atvId) as any;
    expect(antes).toBeDefined();

    db.query(
      "UPDATE estatisticas_questoes SET acertos = 1, erros = 1 WHERE atividade_id = ? AND questao_ref = 'q2'"
    ).run(atvId);

    try {
      const atv = atividadeDe(await buscarEstatisticas(), atvId);
      expect(atv.total_submissoes).toBeGreaterThanOrEqual(5);
      expect(atv.suficientes).toBe(true);
      expect(atv.questoes[0].acertos).not.toBeNull();
      expect(atv.questoes[1].respondentes).toBeNull();
      expect(atv.questoes[1].acertos).toBeNull();
      expect(atv.questoes[1].taxa_acerto).toBeNull();
    } finally {
      db.query(
        "UPDATE estatisticas_questoes SET acertos = ?, erros = ? WHERE atividade_id = ? AND questao_ref = 'q2'"
      ).run(antes.acertos, antes.erros, atvId);
    }
  });

  test('questão discursiva nunca recebe números, mesmo com turma suficiente', async () => {
    for (let i = 0; i < 5; i++) {
      await submeter(atvDiscursivaId, emailAluno(10 + i), { d1: 'Resposta discursiva qualquer.' });
    }

    const discursiva = atividadeDe(await buscarEstatisticas(), atvDiscursivaId);
    expect(discursiva.total_submissoes).toBe(5);
    expect(discursiva.suficientes).toBe(true);
    expect(discursiva.questoes[0].objetivo).toBe(false);
    expect(discursiva.questoes[0].acertos).toBeNull();
    expect(discursiva.questoes[0].erros).toBeNull();
    expect(discursiva.questoes[0].taxa_acerto).toBeNull();
  });

  test('exige autenticação e gestão da disciplina', async () => {
    const semToken = await app.request(`/disciplinas/${discId}/estatisticas`);
    expect(semToken.status).toBe(401);

    const comoIntruso = await app.request(`/disciplinas/${discId}/estatisticas`, {
      headers: authHeaders(intruso.token),
    });
    expect(comoIntruso.status).toBe(403);

    const idInvalido = await app.request('/disciplinas/abc/estatisticas', {
      headers: authHeaders(dono.token),
    });
    expect(idInvalido.status).toBe(400);

    const inexistente = await app.request('/disciplinas/999999/estatisticas', {
      headers: authHeaders(admin),
    });
    expect(inexistente.status).toBe(403);
  });

  test('expurgo de retenção devolve a contribuição dos contadores', async () => {
    const atvExpurgo = await createAtividade(dono.token, discId, {
      tipo: 'reforco',
      titulo: 'Reforço Expurgo',
      json_data: { questions: questoesObjetivas },
    });

    for (let i = 0; i < 5; i++) {
      await submeter(atvExpurgo.id, emailAluno(20 + i), { q1: CERTO_Q1, q2: ERRADO_Q2 });
    }
    expect(atividadeDe(await buscarEstatisticas(), atvExpurgo.id).questoes[0].acertos).toBe(5);

    const antigas = db
      .query('SELECT id FROM respostas_alunos WHERE atividade_id = ? ORDER BY id LIMIT 3')
      .all(atvExpurgo.id) as any[];
    for (const antiga of antigas) {
      db.query("UPDATE respostas_alunos SET criado_em = datetime('now','-730 days') WHERE id = ?").run(antiga.id);
    }

    await runDataRetentionPurge();

    const restantes = db
      .query('SELECT COUNT(*) AS total FROM respostas_alunos WHERE atividade_id = ?')
      .get(atvExpurgo.id) as any;
    expect(restantes.total).toBe(2);

    const contadorQ1 = db
      .query("SELECT acertos, erros FROM estatisticas_questoes WHERE atividade_id = ? AND questao_ref = 'q1'")
      .get(atvExpurgo.id) as any;
    const contadorQ2 = db
      .query("SELECT acertos, erros FROM estatisticas_questoes WHERE atividade_id = ? AND questao_ref = 'q2'")
      .get(atvExpurgo.id) as any;
    expect(contadorQ1.acertos + contadorQ1.erros).toBe(2);
    expect(contadorQ1.acertos).toBe(2);
    expect(contadorQ2.acertos + contadorQ2.erros).toBe(2);
    expect(contadorQ2.erros).toBe(2);

    const depoisDoExpurgo = atividadeDe(await buscarEstatisticas(), atvExpurgo.id);
    expect(depoisDoExpurgo.total_submissoes).toBe(2);
    expect(depoisDoExpurgo.suficientes).toBe(false);
  });

  test('editar o json_data da atividade recalcula os contadores', async () => {
    const atvEdicao = await createAtividade(dono.token, discId, {
      tipo: 'reforco',
      titulo: 'Reforço Edição',
      json_data: { questions: questoesObjetivas },
    });
    for (let i = 0; i < 5; i++) {
      await submeter(atvEdicao.id, emailAluno(30 + i), { q1: CERTO_Q1, q2: ERRADO_Q2 });
    }
    expect(atividadeDe(await buscarEstatisticas(), atvEdicao.id).questoes[0].acertos).toBe(5);

    const caminho = (db.query('SELECT caminho FROM atividades WHERE id = ?').get(atvEdicao.id) as any).caminho;
    const questoesInvertidas = questoesObjetivas.map((q) => ({
      ...q,
      options: q.options.map((o) => ({ ...o, correct: !o.correct })),
    }));

    const edicao = await app.request(`/atividades/${atvEdicao.id}`, {
      method: 'PUT',
      headers: jsonHeaders(dono.token),
      body: JSON.stringify({
        disciplina_id: discId,
        titulo: 'Reforço Edição',
        caminho,
        tipo: 'reforco',
        json_data: { questions: questoesInvertidas },
      }),
    });
    expect(edicao.status).toBe(200);

    const depois = atividadeDe(await buscarEstatisticas(), atvEdicao.id);
    expect(depois.questoes[0].acertos).toBe(0);
    expect(depois.questoes[0].erros).toBe(5);
    expect(depois.questoes[1].acertos).toBe(5);
    expect(depois.questoes[1].erros).toBe(0);
  });

  test('aceita atividades cujo json_data usa a chave perguntas', async () => {
    const atvPerguntas = await createAtividade(dono.token, discId, {
      tipo: 'reforco',
      titulo: 'Reforço Perguntas',
      json_data: { perguntas: questoesObjetivas },
    });
    for (let i = 0; i < 5; i++) {
      await submeter(atvPerguntas.id, emailAluno(40 + i), { q1: CERTO_Q1, q2: CERTO_Q2 });
    }

    const comCinco = atividadeDe(await buscarEstatisticas(), atvPerguntas.id);
    expect(comCinco.questoes.length).toBe(2);
    expect(comCinco.questoes[0].objetivo).toBe(true);
    expect(comCinco.questoes[0].acertos).toBe(5);
    expect(comCinco.questoes[1].acertos).toBe(5);

    const correcao = await submeter(atvPerguntas.id, emailAluno(45), { q1: CERTO_Q1, q2: ERRADO_Q2 });
    expect(correcao.acertos).toBe(1);
    expect(correcao.total).toBe(2);
  });

  test('submissões simultâneas do mesmo e-mail não duplicam a contribuição', async () => {
    const atvCorrida = await createAtividade(dono.token, discId, {
      tipo: 'reforco',
      titulo: 'Reforço Corrida',
      json_data: { questions: questoesObjetivas },
    });
    const email = emailAluno(50);
    const corpo = JSON.stringify({
      aluno_nome: 'Aluno Corrida',
      aluno_email: email,
      respostas: { q1: CERTO_Q1, q2: CERTO_Q2 },
    });

    const respostas = await Promise.all([
      app.request(`/atividades/${atvCorrida.id}/respostas`, { method: 'POST', headers: jsonHeaders(), body: corpo }),
      app.request(`/atividades/${atvCorrida.id}/respostas`, { method: 'POST', headers: jsonHeaders(), body: corpo }),
    ]);
    expect(respostas.map((res) => res.status).sort()).toEqual([200, 201]);

    const linhas = db
      .query('SELECT COUNT(*) AS total FROM respostas_alunos WHERE atividade_id = ?')
      .get(atvCorrida.id) as any;
    expect(linhas.total).toBe(1);

    const contador = db
      .query("SELECT acertos FROM estatisticas_questoes WHERE atividade_id = ? AND questao_ref = 'q1'")
      .get(atvCorrida.id) as any;
    expect(contador.acertos).toBe(1);
  });
});
