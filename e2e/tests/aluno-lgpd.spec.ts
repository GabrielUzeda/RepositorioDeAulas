import { test, expect } from '@playwright/test';
import {
  createCurso,
  createMateria,
  createProfessor,
  setupAdminContext,
  cleanupEntities,
  E2E_BACKEND_URL,
  uniqueName
} from '../helpers';

test.describe('Aluno — Direitos LGPD (Consulta e Exclusão de Respostas)', () => {
  let adminToken: string;
  let professorId: number;
  let cursoId: number;
  let materiaId: number;
  let atividadeId: number;
  const alunoEmail = `aluno_lgpd_${Date.now()}@local.com`;
  const alunoNome = 'Aluno Direitos LGPD';

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
    const prof = await createProfessor(request, adminToken);
    professorId = prof.id;

    // Login prof
    const loginRes = await request.post(`${E2E_BACKEND_URL}/auth/login`, {
      data: { email: prof.email, password: prof.password }
    });
    expect(loginRes.ok()).toBeTruthy();
    const profToken = (await loginRes.json()).token;

    const curso = await createCurso(request, adminToken, [professorId]);
    cursoId = curso.id;

    const materia = await createMateria(request, profToken, cursoId);
    materiaId = materia.id;

    // Criar atividade
    const atvRes = await request.post(`${E2E_BACKEND_URL}/atividades`, {
      headers: { Authorization: `Bearer ${profToken}` },
      data: {
        materia_id: materiaId,
        titulo: `Atividade LGPD ${uniqueName('E2E')}`,
        tipo: 'normal',
        json_data: JSON.stringify({
          questions: [
            {
              title: 'Questão LGPD',
              content: 'Pergunta de Privacidade',
              options: [{ text: 'Opção 1', correct: true }]
            }
          ]
        })
      }
    });
    expect([200, 201]).toContain(atvRes.status());
    atividadeId = (await atvRes.json()).id;
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) {
      await cleanupEntities(request, adminToken, cursoId, professorId);
    }
  });

  test('aluno submete resposta, consulta via LGPD e solicita exclusão definitiva', async ({ request }) => {
    // 1. Submeter resposta da atividade anônima
    const submisaoRes = await request.post(`${E2E_BACKEND_URL}/atividades/${atividadeId}/respostas`, {
      data: {
        aluno_nome: alunoNome,
        aluno_email: alunoEmail,
        respostas: JSON.stringify({ '0': 'Opção 1' }),
        acertos: 1,
        total: 1,
        pontuacao: 100
      }
    });
    expect(submisaoRes.ok()).toBeTruthy();
    const subData = await submisaoRes.json();
    expect(subData.consulta_token).toBeTruthy();
    const consultaToken = subData.consulta_token;

    // 2. Consultar dados (GET /aluno/minhas-respostas)
    const getRes = await request.get(
      `${E2E_BACKEND_URL}/aluno/minhas-respostas?email=${encodeURIComponent(alunoEmail)}&token=${encodeURIComponent(consultaToken)}`
    );
    expect(getRes.ok()).toBeTruthy();
    const listaRespostas = await getRes.json();
    expect(Array.isArray(listaRespostas)).toBeTruthy();
    expect(listaRespostas.length).toBeGreaterThan(0);
    expect(listaRespostas[0].aluno_nome).toBe(alunoNome);

    // 3. Excluir dados por direito LGPD (DELETE /aluno/minhas-respostas)
    const deleteRes = await request.delete(
      `${E2E_BACKEND_URL}/aluno/minhas-respostas?email=${encodeURIComponent(alunoEmail)}&token=${encodeURIComponent(consultaToken)}`
    );
    expect(deleteRes.status()).toBe(204);

    // 4. Verificar que dados não constam mais no banco (401 ou lista vazia)
    const checkRes = await request.get(
      `${E2E_BACKEND_URL}/aluno/minhas-respostas?email=${encodeURIComponent(alunoEmail)}&token=${encodeURIComponent(consultaToken)}`
    );
    expect([200, 401]).toContain(checkRes.status());
    if (checkRes.ok()) {
      const checkLista = await checkRes.json();
      expect(checkLista.length).toBe(0);
    }
  });
});
