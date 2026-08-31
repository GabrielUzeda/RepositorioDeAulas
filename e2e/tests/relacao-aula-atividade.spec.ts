import { test, expect, APIRequestContext } from '@playwright/test';
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

async function profLogin(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${E2E_BACKEND_URL}/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.token as string;
}

async function api(request: APIRequestContext, method: 'post' | 'put' | 'delete', path: string, token: string, data?: any) {
  const res = await request[method](`${E2E_BACKEND_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data
  });
  return res;
}

test.describe('Relação Aula ↔ Atividade: cenários vinculados e desvinculados', () => {
  let adminToken: string;
  let profEmail: string;
  let profPassword: string;
  let professorId: number;
  let cursoId: number;
  let materiaId: number;
  let cursoNome: string;
  let materiaNome: string;

  let aulaSemAtividadeTitulo: string;
  let aulaComAtividadeTitulo: string;
  let atvVinculadaTitulo: string;
  let atvGeralTitulo: string;

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
    const prof = await createProfessor(request, adminToken);
    profEmail = prof.email;
    profPassword = prof.password;
    professorId = prof.id;

    const profToken = await profLogin(request, prof.email, prof.password);
    const curso = await createCurso(request, adminToken, [professorId]);
    cursoId = curso.id;
    cursoNome = curso.nome;

    const materia = await createMateria(request, profToken, cursoId);
    materiaId = materia.id;
    materiaNome = materia.nome;

    // 1. Cria Aula SEM atividade vinculada
    aulaSemAtividadeTitulo = `Aula Isolada ${uniqueName('AULA1')}`;
    const aula1Res = await api(request, 'post', '/aulas', profToken, {
      disciplina_id: materiaId,
      titulo: aulaSemAtividadeTitulo,
      descricao: 'Aula teórica sem atividades',
      markdown: '# Aula 1 Isolada\n\nConteúdo teórico do slide.'
    });
    expect([200, 201]).toContain(aula1Res.status());

    // 2. Cria Aula COM atividade vinculada
    aulaComAtividadeTitulo = `Aula Com Atividade ${uniqueName('AULA2')}`;
    const aula2Res = await api(request, 'post', '/aulas', profToken, {
      disciplina_id: materiaId,
      titulo: aulaComAtividadeTitulo,
      descricao: 'Aula com atividade prática vinculada',
      markdown: '# Aula 2 Com Atividade\n\nConteúdo com exercícios.'
    });
    expect([200, 201]).toContain(aula2Res.status());
    const aula2Id = (await aula2Res.json()).id;

    // 3. Cria Atividade VINCULADA à Aula 2
    atvVinculadaTitulo = `Atividade da Aula 2 ${uniqueName('ATV_VINC')}`;
    const atv1Res = await api(request, 'post', '/atividades', profToken, {
      disciplina_id: materiaId,
      aula_id: aula2Id,
      titulo: atvVinculadaTitulo,
      tipo: 'reforco',
      json_data: JSON.stringify({
        questions: [
          {
            title: 'Exercício da Aula 2',
            content: 'Qual a resposta correta para a questão da Aula 2?',
            options: [
              { text: 'Opção A Correta', correct: true, feedback: 'Excelente!' },
              { text: 'Opção B Incorreta', correct: false, feedback: 'Tente novamente.' }
            ]
          }
        ]
      })
    });
    expect([200, 201]).toContain(atv1Res.status());

    // 4. Cria Atividade GERAL (SEM aula vinculada / aula_id: null)
    atvGeralTitulo = `Atividade Geral Revisão ${uniqueName('ATV_GERAL')}`;
    const atv2Res = await api(request, 'post', '/atividades', profToken, {
      disciplina_id: materiaId,
      aula_id: null,
      titulo: atvGeralTitulo,
      tipo: 'normal',
      json_data: JSON.stringify({
        questions: [
          {
            title: 'Revisão Geral',
            content: 'Pergunta de revisão geral da disciplina',
            options: [
              { text: 'Resposta Certa Geral', correct: true, feedback: 'Correto!' },
              { text: 'Resposta Errada', correct: false, feedback: 'Errado.' }
            ]
          }
        ]
      })
    });
    expect([200, 201]).toContain(atv2Res.status());
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) {
      await cleanupEntities(request, adminToken, cursoId, professorId);
    }
  });

  test('Professor visualiza hierarquia: aula sem atividade (sem badge 0 atividades), aula com atividade aninhada e atividades gerais', async ({ page }) => {
    await loginViaUI(page, profEmail, profPassword, /\/professor/);
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.getByRole('heading', { name: materiaNome })).toBeVisible();

    // 1. Verifica Aula 1 (sem atividades vinculadas: badge '0 atividades' não deve aparecer)
    const aula1Card = page.locator('h4', { hasText: aulaSemAtividadeTitulo }).locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
    await expect(aula1Card).toBeVisible();
    await expect(aula1Card.getByText('0 atividades')).not.toBeVisible();
    await expect(aula1Card.getByText('Nenhuma atividade vinculada a esta aula.')).toBeVisible();

    // 2. Verifica Aula 2 (com atividade vinculada: exibe badge '1 atividade')
    const aula2Card = page.locator('h4', { hasText: aulaComAtividadeTitulo }).locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
    await expect(aula2Card).toBeVisible();
    await expect(aula2Card.getByText('1 atividade')).toBeVisible();
    await expect(aula2Card.locator('h4', { hasText: atvVinculadaTitulo })).toBeVisible();

    // 3. Verifica Seção de Atividades Gerais
    await expect(page.getByRole('heading', { name: 'Atividades Gerais & Revisão' })).toBeVisible();
    await expect(page.locator('h4', { hasText: atvGeralTitulo })).toBeVisible();
  });

  test('Estudante visualiza aulas (com e sem atividades) e responde tanto atividades vinculadas quanto gerais', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Selecione seu Curso' })).toBeVisible();
    await page.locator('h3', { hasText: cursoNome }).click();

    await expect(page.locator('h3', { hasText: materiaNome })).toBeVisible();
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.getByRole('heading', { name: materiaNome })).toBeVisible();

    // --- ABA AULAS (2 aulas disponíveis) ---
    await expect(page.getByRole('tab', { name: /Aulas/ })).toBeVisible();
    await expect(page.locator('h3', { hasText: aulaSemAtividadeTitulo })).toBeVisible();
    await expect(page.locator('h3', { hasText: aulaComAtividadeTitulo })).toBeVisible();

    // Abre a Aula 1 em popup
    const [popup1] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('h3', { hasText: aulaSemAtividadeTitulo }).click()
    ]);
    await popup1.waitForLoadState();
    expect(popup1.url()).toContain('/materias/');
    await popup1.close();

    // --- ABA ATIVIDADES (2 atividades disponíveis) ---
    await page.getByRole('tab', { name: /Atividades/ }).click();
    await expect(page.locator('h3', { hasText: atvVinculadaTitulo })).toBeVisible();
    await expect(page.locator('h3', { hasText: atvGeralTitulo })).toBeVisible();

    // 1. Responde Atividade Vinculada (tipo reforço)
    await page.locator('h3', { hasText: atvVinculadaTitulo }).click();
    await expect(page.getByRole('heading', { level: 2, name: atvVinculadaTitulo })).toBeVisible();
    await page.getByRole('button', { name: 'Começar Atividade' }).click();
    await page.getByRole('button', { name: 'Opção A Correta' }).click();
    await expect(page.getByText('Resposta Correta!')).toBeVisible();
    await page.getByRole('button', { name: 'Concluir' }).click();

    // 2. Responde Atividade Geral (tipo normal)
    await page.locator('h3', { hasText: atvGeralTitulo }).click();
    await expect(page.getByRole('heading', { level: 2, name: atvGeralTitulo })).toBeVisible();
    await page.getByLabel('Seu Nome *').fill('Aluno E2E');
    await page.getByLabel('Seu E-mail *').fill('aluno.e2e@escola.com');
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Pergunta
    await expect(page.getByText('Pergunta de revisão geral da disciplina')).toBeVisible();
    await page.getByRole('button', { name: 'Resposta Certa Geral' }).click();
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Revisão e Envio
    await expect(page.getByText('Revisão das Respostas')).toBeVisible();
    await page.getByRole('button', { name: 'Enviar Resposta' }).click();

    await expect(page.getByRole('heading', { name: 'Resposta Enviada com Sucesso!' })).toBeVisible({ timeout: 15000 });
  });

  test('Professor vincula e desvincula atividade diretamente pelo card da aula e modal de vínculos', async ({ page }) => {
    await loginViaUI(page, profEmail, profPassword, /\/professor/);
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.getByRole('heading', { name: materiaNome })).toBeVisible();

    // 1. No card da Aula 1 (que possui 0 atividades), clica no botão "Vincular"
    const aula1Card = page.locator('h4', { hasText: aulaSemAtividadeTitulo }).locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
    await aula1Card.getByRole('button', { name: 'Vincular' }).first().click();

    // Modal de Vinculação abre
    await expect(page.getByRole('heading', { name: /Vincular Atividades/ })).toBeVisible();
    // Marca o checkbox da atividade geral
    await page.getByLabel(atvGeralTitulo).check();
    await page.getByRole('button', { name: 'Salvar Vínculos' }).click();

    // Valida que a Aula 1 agora possui a atividade vinculada (badge '1 atividade' aparece)
    await expect(aula1Card.getByText('1 atividade')).toBeVisible({ timeout: 10000 });
    await expect(aula1Card.locator('h4', { hasText: atvGeralTitulo })).toBeVisible();

    // 2. Agora desvincula a atividade diretamente pelo botão de desvincular (link_off)
    const atvCard = aula1Card.locator('h4', { hasText: atvGeralTitulo }).locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
    await atvCard.locator('button[title*="Desvincular"]').click();

    // Valida que o badge '1 atividade' desaparece e a mensagem de vazio volta
    await expect(aula1Card.getByText('1 atividade')).not.toBeVisible({ timeout: 10000 });
    await expect(aula1Card.getByText('Nenhuma atividade vinculada a esta aula.')).toBeVisible();
    // E a atividade volta para a seção de Atividades Gerais
    await expect(page.locator('h4', { hasText: atvGeralTitulo })).toBeVisible();
  });

  test('Uma mesma atividade pode ser vinculada a múltiplas aulas e aparecer simultaneamente em ambas', async ({ page }) => {
    await loginViaUI(page, profEmail, profPassword, /\/professor/);
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.getByRole('heading', { name: materiaNome })).toBeVisible();

    const aula1Card = page.locator('h4', { hasText: aulaSemAtividadeTitulo }).locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
    const aula2Card = page.locator('h4', { hasText: aulaComAtividadeTitulo }).locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');

    // 1. A atividade atvVinculadaTitulo já está na Aula 2
    await expect(aula2Card.locator('h4', { hasText: atvVinculadaTitulo })).toBeVisible();

    // 2. Abre modal de vínculos na Aula 1 e vincula a MESMA atividade atvVinculadaTitulo
    await aula1Card.getByRole('button', { name: 'Vincular' }).first().click();
    await expect(page.getByRole('heading', { name: /Vincular Atividades/ })).toBeVisible();
    await page.getByLabel(atvVinculadaTitulo).check();
    await page.getByRole('button', { name: 'Salvar Vínculos' }).click();

    // 3. Verifica que a MESMA atividade agora está visível SIMULTANEAMENTE na Aula 1 e na Aula 2
    await expect(aula1Card.locator('h4', { hasText: atvVinculadaTitulo })).toBeVisible({ timeout: 10000 });
    await expect(aula2Card.locator('h4', { hasText: atvVinculadaTitulo })).toBeVisible({ timeout: 10000 });

    // 4. Desvincula apenas da Aula 1
    const atvCardAula1 = aula1Card.locator('h4', { hasText: atvVinculadaTitulo }).locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
    await atvCardAula1.locator('button[title*="Desvincular"]').click();

    // 5. Verifica que foi removida da Aula 1, mas CONTINUA intacta na Aula 2
    await expect(aula1Card.locator('h4', { hasText: atvVinculadaTitulo })).not.toBeVisible({ timeout: 10000 });
    await expect(aula2Card.locator('h4', { hasText: atvVinculadaTitulo })).toBeVisible();
  });
});
