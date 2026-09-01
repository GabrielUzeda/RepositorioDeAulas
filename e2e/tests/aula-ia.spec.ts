import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import {
  createCurso,
  createMateria,
  createProfessor,
  setupAdminContext,
  cleanupEntities,
  loginViaUI,
  E2E_BACKEND_URL
} from '../helpers';

async function profLogin(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${E2E_BACKEND_URL}/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).token as string;
}

test.describe('Professor — Gerador de Aula por IA (MarpEditor)', () => {
  let adminToken: string;
  let profEmail: string;
  let profPassword: string;
  let professorId: number;
  let cursoId: number;
  let cursoNome: string;
  let materiaNome: string;

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
    const prof = await createProfessor(request, adminToken);
    profEmail = prof.email;
    profPassword = prof.password;
    professorId = prof.id;

    const curso = await createCurso(request, adminToken, [professorId]);
    cursoId = curso.id;
    cursoNome = curso.nome;

    const profToken = await profLogin(request, profEmail, profPassword);
    const materia = await createMateria(request, profToken, cursoId);
    materiaNome = materia.nome;

    await request.post(`${E2E_BACKEND_URL}/aulas`, {
      headers: { Authorization: `Bearer ${profToken}` },
      data: {
        disciplina_id: materia.id,
        titulo: 'Aula de Fundamentos 1',
        descricao: 'Introdução aos fundamentos',
        ordem: 1,
        conteudo_md: '---\ntheme: default\ntitle: Fundamentos 1\n---\n\n# Fundamentos 1\n\nConteúdo introdutório da disciplina.'
      }
    });
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) await cleanupEntities(request, adminToken, cursoId, professorId);
  });

  test('botão IA aparece na toolbar do MarpEditor', async ({ page }) => {
    await loginViaUI(page, profEmail, profPassword, /\/professor/);
    await expect(page.getByRole('heading', { name: 'Painel do Professor' })).toBeVisible();
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.getByRole('heading', { name: materiaNome })).toBeVisible();

    await page.getByRole('button', { name: 'Nova Aula' }).first().click();

    await expect(page.getByTitle('Gerar Aula com IA')).toBeVisible();
    await expect(page.getByPlaceholder('Título da Aula')).toBeVisible();
  });

  test('painel de IA abre com campos corretos ao clicar no botão IA', async ({ page }) => {
    await loginViaUI(page, profEmail, profPassword, /\/professor/);
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await page.getByRole('button', { name: 'Nova Aula' }).first().click();

    await page.getByTitle('Gerar Aula com IA').click();

    await expect(page.getByText('Gerar Aula com IA')).toBeVisible();
    await expect(page.getByPlaceholder('Ex: Introdução à Lógica de Programação')).toBeVisible();
    await expect(page.getByText('O markdown gerado substituirá o conteúdo atual do editor.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gerar Aula' })).toBeVisible();
  });

  test('botão Gerar Aula fica desabilitado sem tema e sem referência selecionada', async ({ page }) => {
    await loginViaUI(page, profEmail, profPassword, /\/professor/);
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await page.getByRole('button', { name: 'Nova Aula' }).first().click();

    await page.getByTitle('Gerar Aula com IA').click();
    await expect(page.getByText('Gerar Aula com IA')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Gerar Aula' })).toBeEnabled();

    await page.locator('label.ai-aula-check', { hasText: 'Aula de Fundamentos 1' }).click();
    await expect(page.getByRole('button', { name: 'Gerar Aula' })).toBeDisabled();
  });

  test('botão Gerar Aula fica habilitado ao digitar um tema', async ({ page }) => {
    await loginViaUI(page, profEmail, profPassword, /\/professor/);
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await page.getByRole('button', { name: 'Nova Aula' }).first().click();

    await page.getByTitle('Gerar Aula com IA').click();
    await expect(page.getByText('Gerar Aula com IA')).toBeVisible();

    await page.getByPlaceholder('Ex: Introdução à Lógica de Programação').fill('Estruturas de Repetição');
    await expect(page.getByRole('button', { name: 'Gerar Aula' })).toBeEnabled();
  });

  test('aulas anteriores aparecem como referência com recomendação quando há aulas na disciplina', async ({ page }) => {
    await loginViaUI(page, profEmail, profPassword, /\/professor/);
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await page.getByRole('button', { name: 'Nova Aula' }).first().click();

    await page.getByTitle('Gerar Aula com IA').click();
    await expect(page.getByText('Gerar Aula com IA')).toBeVisible();

    await expect(page.getByText('Usar aulas anteriores como referência?')).toBeVisible();
    await expect(page.locator('.ai-aula-title', { hasText: 'Aula de Fundamentos 1' })).toBeVisible();
    await expect(page.getByTitle('Recomendação: adicione a última aula para contexto sequencial da aula.')).toBeVisible();
    await expect(page.getByRole('checkbox').first()).toBeChecked();
  });

  test('última aula pré-selecionada como referência habilita Gerar Aula mesmo sem tema', async ({ page }) => {
    await loginViaUI(page, profEmail, profPassword, /\/professor/);
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await page.getByRole('button', { name: 'Nova Aula' }).first().click();

    await page.getByTitle('Gerar Aula com IA').click();
    await expect(page.getByText('Gerar Aula com IA')).toBeVisible();

    await expect(page.getByRole('checkbox').first()).toBeChecked();
    await expect(page.getByRole('button', { name: 'Gerar Aula' })).toBeEnabled();

    await page.locator('label.ai-aula-check', { hasText: 'Aula de Fundamentos 1' }).click();
    await expect(page.getByRole('button', { name: 'Gerar Aula' })).toBeDisabled();
  });

  test('botão Cancelar fecha o painel de IA', async ({ page }) => {
    await loginViaUI(page, profEmail, profPassword, /\/professor/);
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await page.getByRole('button', { name: 'Nova Aula' }).first().click();

    await page.getByTitle('Gerar Aula com IA').click();
    await expect(page.getByText('Gerar Aula com IA')).toBeVisible();

    const cancelarBtns = page.getByRole('button', { name: 'Cancelar' });
    await cancelarBtns.last().click();
    await expect(page.getByText('Gerar Aula com IA')).not.toBeVisible();
    await expect(page.getByPlaceholder('Título da Aula')).toBeVisible();
  });
});
