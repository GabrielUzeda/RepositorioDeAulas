import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import {
  createCurso,
  createMateria,
  createProfessor,
  setupAdminContext,
  cleanupEntities,
  loginViaUI,
  E2E_BACKEND_URL,
  uniqueName
} from '../helpers';

test.describe('Gestão Avançada, Estatísticas, Status e Rascunhos', () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
  });

  test('1. Painel do Professor — Estatísticas Agregadas da Turma', async ({ page, request }) => {
    const prof = await createProfessor(request, adminToken);
    const loginRes = await request.post(`${E2E_BACKEND_URL}/auth/login`, {
      data: { email: prof.email, password: prof.password }
    });
    const profToken = (await loginRes.json()).token;

    const curso = await createCurso(request, adminToken, [prof.id]);
    const materia = await createMateria(request, profToken, curso.id);

    // Cria atividade objetiva com id q1
    const atvRes = await request.post(`${E2E_BACKEND_URL}/atividades`, {
      headers: { Authorization: `Bearer ${profToken}` },
      data: {
        materia_id: materia.id,
        titulo: `Atividade Estatisticas ${uniqueName('E2E')}`,
        tipo: 'normal',
        json_data: JSON.stringify({
          questions: [
            {
              id: 'q1',
              title: 'Quanto é 3 + 3?',
              options: [
                { text: '6', correct: true, feedback: 'Correto' },
                { text: '5', correct: false, feedback: 'Incorreto' }
              ]
            }
          ]
        })
      }
    });
    expect(atvRes.ok()).toBeTruthy();
    const atividade = await atvRes.json();

    // Submete 5 respostas válidas para atingir MIN_SUBMISSOES_ESTATISTICAS = 5
    for (let i = 1; i <= 5; i++) {
      const subRes = await request.post(`${E2E_BACKEND_URL}/atividades/${atividade.id}/respostas`, {
        data: {
          aluno_nome: `Estudante ${i}`,
          aluno_email: `estudante_${i}_${Date.now()}@local`,
          respostas: { "q1": "6" }
        }
      });
      expect(subRes.ok()).toBeTruthy();
    }

    // Professor acessa via UI
    await loginViaUI(page, prof.email, prof.password, /\/professor/);
    await page.locator('h3', { hasText: curso.nome }).click();
    await page.locator('h3', { hasText: materia.nome }).click();

    // Clica no botão "Desempenho da Turma"
    const btnDesempenho = page.getByRole('button', { name: /Desempenho da Turma/ });
    await expect(btnDesempenho).toBeVisible();
    await btnDesempenho.click();

    // Valida abertura do modal EstatisticasModal e ocultação de dados pessoais
    await expect(page.getByRole('heading', { name: 'Desempenho da Turma' })).toBeVisible();
    await expect(page.getByText(/agregados por questão/)).toBeVisible();
    await expect(page.getByText(/nenhum aluno é identificado/)).toBeVisible();
    await expect(page.getByRole('dialog').getByText(atividade.titulo)).toBeVisible();
    await expect(page.getByText('Quanto é 3 + 3?')).toBeVisible();
    await expect(page.getByText('100%')).toBeVisible({ timeout: 10000 });

    await cleanupEntities(request, adminToken, curso.id, prof.id);
  });

  test('2. Alternância de Status de Disciplinas e Atividades', async ({ page, request }) => {
    const prof = await createProfessor(request, adminToken);
    const loginRes = await request.post(`${E2E_BACKEND_URL}/auth/login`, {
      data: { email: prof.email, password: prof.password }
    });
    const profToken = (await loginRes.json()).token;

    const curso = await createCurso(request, adminToken, [prof.id]);
    const discStatusNome = `Disciplina Status ${uniqueName('E2E')}`;
    const discRes = await request.post(`${E2E_BACKEND_URL}/materias`, {
      headers: { Authorization: `Bearer ${profToken}` },
      data: {
        curso_id: curso.id,
        nome: discStatusNome,
        slug: uniqueName('status-disc'),
        descricao: 'Teste status'
      }
    });
    expect(discRes.ok()).toBeTruthy();

    // Professor faz login via UI
    await loginViaUI(page, prof.email, prof.password, /\/professor/);
    await page.locator('h3', { hasText: curso.nome }).click();

    // Localiza card da disciplina e oculta
    const discCard = page.locator('h3', { hasText: discStatusNome }).locator('xpath=ancestor::div[contains(@class,"rounded") or contains(@class,"card")][1]');
    await expect(discCard).toBeVisible();
    const hideDiscBtn = discCard.locator('button[title="Ocultar Disciplina para Alunos"]');
    await hideDiscBtn.click();

    // Verifica que status oculto aparece
    await expect(discCard.locator('text=oculto')).toBeVisible();

    // Visão do aluno: Acessa área pública e entra no curso
    await page.goto('/');
    await page.locator('h3', { hasText: curso.nome }).click();

    // Valida que a disciplina oculta não é exibida para o aluno
    await expect(page.locator('h3', { hasText: discStatusNome })).not.toBeVisible();

    await cleanupEntities(request, adminToken, curso.id, prof.id);
  });

  test('3. Rascunhos e Persistência no Aluno', async ({ page, request }) => {
    const prof = await createProfessor(request, adminToken);
    const loginRes = await request.post(`${E2E_BACKEND_URL}/auth/login`, {
      data: { email: prof.email, password: prof.password }
    });
    const profToken = (await loginRes.json()).token;

    const curso = await createCurso(request, adminToken, [prof.id]);
    const materia = await createMateria(request, profToken, curso.id);

    const atvRascunhoTitulo = `Atividade Rascunho UI ${uniqueName('E2E')}`;
    const atvRes = await request.post(`${E2E_BACKEND_URL}/atividades`, {
      headers: { Authorization: `Bearer ${profToken}` },
      data: {
        materia_id: materia.id,
        titulo: atvRascunhoTitulo,
        tipo: 'normal',
        json_data: JSON.stringify({
          questions: [
            {
              id: 'q1',
              title: 'Questão Discursiva',
              content: 'Escreva seus comentários sobre a arquitetura.'
            }
          ]
        })
      }
    });
    expect(atvRes.ok()).toBeTruthy();

    // Aluno navega para o curso e atividade
    await page.goto('/');
    await page.locator('h3', { hasText: curso.nome }).click();

    await page.locator('h3', { hasText: materia.nome }).click();
    await page.getByRole('tab', { name: /Atividades/ }).click();
    await page.locator('h3', { hasText: atvRascunhoTitulo }).click();

    // Preenche identificação (nome e e-mail) no passo 0
    await page.getByLabel('Seu Nome *').fill('Aluno Rascunho UI');
    await page.getByLabel('Seu E-mail *').fill(`rascunho_${Date.now()}@local`);
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Preenche resposta parcial no editor
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible();
    await editor.fill('Resposta parcial digitada pelo aluno para teste de salvamento de rascunho.');

    // Clica em salvar rascunho
    const salvarRascunhoBtn = page.getByRole('button', { name: 'Salvar Rascunho' });
    await expect(salvarRascunhoBtn).toBeVisible();
    await salvarRascunhoBtn.click();

    // Valida a confirmação visual e exibição do código de rascunho na tela
    await expect(page.getByRole('heading', { name: 'Rascunho Salvo no Servidor' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Guarde este código! Ele é válido por 30 dias')).toBeVisible();

    await cleanupEntities(request, adminToken, curso.id, prof.id);
  });

  test('4. Prova nao vaza gabarito no endpoint publico', async ({ request }) => {
    const prof = await createProfessor(request, adminToken);
    const loginRes = await request.post(`${E2E_BACKEND_URL}/auth/login`, {
      data: { email: prof.email, password: prof.password }
    });
    const profToken = (await loginRes.json()).token;

    const curso = await createCurso(request, adminToken, [prof.id]);
    const materia = await createMateria(request, profToken, curso.id);

    const atvRes = await request.post(`${E2E_BACKEND_URL}/atividades`, {
      headers: { Authorization: `Bearer ${profToken}` },
      data: {
        materia_id: materia.id,
        titulo: `Prova Sigilosa ${uniqueName('E2E')}`,
        tipo: 'prova',
        json_data: JSON.stringify({
          questions: [
            {
              id: 'q1',
              title: 'Capital da Franca?',
              options: [
                { text: 'Paris', correct: true },
                { text: 'Londres', correct: false }
              ]
            }
          ]
        })
      }
    });
    expect(atvRes.ok()).toBeTruthy();
    const atividade = await atvRes.json();

    const pubRes = await request.get(`${E2E_BACKEND_URL}/atividades/${atividade.id}`);
    expect(pubRes.ok()).toBeTruthy();
    const pubBody = await pubRes.json();
    const pubStr = JSON.stringify(pubBody.json_data ?? pubBody);
    expect(pubStr).not.toContain('"correct":true');
    expect(pubStr).not.toContain('"correct": true');

    const gestRes = await request.get(`${E2E_BACKEND_URL}/atividades/${atividade.id}`, {
      headers: { Authorization: `Bearer ${profToken}` }
    });
    expect(gestRes.ok()).toBeTruthy();
    expect(JSON.stringify(await gestRes.json())).toContain('Paris');

    await cleanupEntities(request, adminToken, curso.id, prof.id);
  });

  test('5. Curso com senha exige PasswordModal no aluno', async ({ page, request }) => {
    const prof = await createProfessor(request, adminToken);
    const loginRes = await request.post(`${E2E_BACKEND_URL}/auth/login`, {
      data: { email: prof.email, password: prof.password }
    });
    const profToken = (await loginRes.json()).token;

    const senhaCurso = 'senha-e2e-456';
    const curso = await createCurso(request, adminToken, [prof.id], { senha: senhaCurso });
    const materia = await createMateria(request, profToken, curso.id);

    await page.goto('/');
    await page.locator('h3', { hasText: curso.nome }).click();
    await expect(page.getByText('Acesso Restrito')).toBeVisible();
    await page.getByPlaceholder('Digite a senha').fill(senhaCurso);
    await page.getByRole('button', { name: /Confirmar|Entrar|Desbloquear/ }).click();
    await expect(page.locator('h3', { hasText: materia.nome })).toBeVisible();

    await cleanupEntities(request, adminToken, curso.id, prof.id);
  });

  test('6. LGPD: consulta com token e exclusao por submissao', async ({ request }) => {
    const prof = await createProfessor(request, adminToken);
    const loginRes = await request.post(`${E2E_BACKEND_URL}/auth/login`, {
      data: { email: prof.email, password: prof.password }
    });
    const profToken = (await loginRes.json()).token;

    const curso = await createCurso(request, adminToken, [prof.id]);
    const materia = await createMateria(request, profToken, curso.id);

    const atvRes = await request.post(`${E2E_BACKEND_URL}/atividades`, {
      headers: { Authorization: `Bearer ${profToken}` },
      data: {
        materia_id: materia.id,
        titulo: `Atividade LGPD ${uniqueName('E2E')}`,
        tipo: 'normal',
        json_data: JSON.stringify({ questions: [{ id: 'q1', title: 'Q?', content: 'Responda.' }] })
      }
    });
    const atividade = await atvRes.json();
    const alunoEmail = `lgpd_${Date.now()}@local`;

    const subRes = await request.post(`${E2E_BACKEND_URL}/atividades/${atividade.id}/respostas`, {
      data: { aluno_nome: 'Aluno LGPD', aluno_email: alunoEmail, respostas: { q1: 'texto' } }
    });
    expect(subRes.ok()).toBeTruthy();
    const token = (await subRes.json()).consulta_token;
    expect(token).toBeTruthy();

    const consulta = await request.get(
      `${E2E_BACKEND_URL}/aluno/minhas-respostas?email=${encodeURIComponent(alunoEmail)}&token=${token}`
    );
    expect(consulta.ok()).toBeTruthy();

    const consultaRuim = await request.get(
      `${E2E_BACKEND_URL}/aluno/minhas-respostas?email=${encodeURIComponent(alunoEmail)}&token=token-invalido-123456`
    );
    expect(consultaRuim.status()).toBe(401);

    const del = await request.delete(`${E2E_BACKEND_URL}/aluno/minhas-respostas?email=${encodeURIComponent(alunoEmail)}&token=${token}`);
    expect(del.ok()).toBeTruthy();

    const depois = await request.get(
      `${E2E_BACKEND_URL}/aluno/minhas-respostas?email=${encodeURIComponent(alunoEmail)}&token=${token}`
    );
    expect(depois.status()).toBe(401);

    await cleanupEntities(request, adminToken, curso.id, prof.id);
  });
});
