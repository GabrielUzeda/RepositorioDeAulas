import { test, expect, APIRequestContext, Page } from '@playwright/test';
import {
  createCurso,
  createMateria,
  createProfessor,
  setupAdminContext,
  cleanupEntities,
  E2E_BACKEND_URL,
  uniqueName
} from '../helpers';

async function profLogin(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${E2E_BACKEND_URL}/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).token as string;
}

async function api(request: APIRequestContext, method: 'post' | 'put' | 'delete', path: string, token: string, data?: any) {
  return request[method](`${E2E_BACKEND_URL}${path}`, { headers: { Authorization: `Bearer ${token}` }, data });
}

test.describe('Atividade — descrição, título e descrição de cada pergunta (pontos a ponta)', () => {
  let adminToken: string;
  let profEmail: string;
  let profPassword: string;
  let professorId: number;
  let cursoId: number;
  let cursoNome: string;
  let materiaId: number;
  let materiaNome: string;

  let atvTitulo: string;
  let atvDescricao: string;
  const q1 = { title: 'Q1 — Mitocôndria', content: 'O que é a mitocôndria e qual sua função principal na célula?' };
  const q2 = { title: 'Q2 — Fotossíntese', content: 'Explique resumidamente o processo de fotossíntese nas plantas.' };

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
    const prof = await createProfessor(request, adminToken);
    professorId = prof.id;
    profEmail = prof.email;
    profPassword = prof.password;
    const profToken = await profLogin(request, prof.email, prof.password);

    // Curso sem senha → acesso anônimo direto do aluno
    const curso = await createCurso(request, adminToken, [professorId], { senha: '' });
    cursoId = curso.id;
    cursoNome = curso.nome;

    const materia = await createMateria(request, profToken, cursoId);
    materiaId = materia.id;
    materiaNome = materia.nome;

    atvTitulo = `Atividade Conteúdo ${uniqueName('E2E')}`;
    atvDescricao = 'Leia com atenção e responda com suas palavras. Esta atividade vale nota.';

    const atv = await api(request, 'post', '/atividades', profToken, {
      materia_id: materiaId,
      titulo: atvTitulo,
      tipo: 'normal',
      descricao: atvDescricao,
      allow_password: false,
      slug: uniqueName('atv'),
      json_data: JSON.stringify({
        questions: [
          { title: q1.title, content: q1.content },
          { title: q2.title, content: q2.content }
        ]
      })
    });
    expect([200, 201]).toContain(atv.status());
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) await cleanupEntities(request, adminToken, cursoId, professorId);
  });

  test('professor abre o editor e vê descrição da atividade, título e descrição de cada pergunta', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('professor@escola.edu').fill(profEmail);
    await page.getByPlaceholder('••••••••').fill(profPassword);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/professor/);
    await expect(page.getByRole('heading', { name: 'Painel do Professor' })).toBeVisible();

    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.getByRole('heading', { name: materiaNome })).toBeVisible();

    // Card da atividade mostra a descrição
    await expect(page.locator('h4', { hasText: atvTitulo })).toBeVisible();
    await expect(page.getByText(atvDescricao)).toBeVisible();

    // Abre o editor da atividade
    await page.locator('h4', { hasText: atvTitulo }).locator('xpath=ancestor::div[contains(@class,"p-4")][1]')
      .locator('button[title="Editar Atividade"]').click();
    await expect(page.getByRole('heading', { name: 'Editar Atividade' })).toBeVisible();

    // Descrição da atividade visível no editor
    await expect(page.getByPlaceholder('Breve resumo ou instruções da atividade para os alunos...'))
      .toHaveValue(atvDescricao);

    // Pergunta 1 (sidebar → painel ativo)
    await page.getByText(q1.content).first().click();
    await expect(page.getByPlaceholder('Título/Tema da Questão (Ex: Questão 1)')).toHaveValue(q1.title);
    await expect(page.getByPlaceholder('Digite o enunciado completo da questão para o aluno...')).toHaveValue(q1.content);

    // Pergunta 2
    await page.getByText(q2.content).first().click();
    await expect(page.getByPlaceholder('Título/Tema da Questão (Ex: Questão 1)')).toHaveValue(q2.title);
    await expect(page.getByPlaceholder('Digite o enunciado completo da questão para o aluno...')).toHaveValue(q2.content);

    await page.getByRole('button', { name: 'Cancelar' }).click();
  });

  test('aluno abre a atividade e vê descrição da atividade, título e descrição de cada pergunta', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Selecione seu Curso' })).toBeVisible();
    await page.locator('h3', { hasText: cursoNome }).click();
    await expect(page.locator('h3', { hasText: materiaNome })).toBeVisible({ timeout: 15000 });
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.locator('h3', { hasText: materiaNome })).toBeVisible({ timeout: 15000 });

    await page.getByRole('tab', { name: /Atividades/ }).click();
    await page.locator('h3', { hasText: atvTitulo }).toBeVisible({ timeout: 15000 });
    await page.locator('h3', { hasText: atvTitulo }).click();

    // Descrição da atividade visível para o aluno
    await expect(page.getByText(atvDescricao)).toBeVisible();

    // Identificação
    await page.getByLabel('Seu Nome *').fill('Aluno E2E Conteúdo');
    await page.getByLabel('Seu E-mail *').fill('aluno.conteudo@local');
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Pergunta 1: título e descrição visíveis
    await expect(page.getByText(q1.title)).toBeVisible();
    await expect(page.getByText(q1.content)).toBeVisible();
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Pergunta 2: título e descrição visíveis
    await expect(page.getByText(q2.title)).toBeVisible();
    await expect(page.getByText(q2.content)).toBeVisible();
  });
});
