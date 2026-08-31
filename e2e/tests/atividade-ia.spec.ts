import { test, expect, APIRequestContext } from '@playwright/test';
import {
  createCurso,
  createMateria,
  createProfessor,
  setupAdminContext,
  cleanupEntities,
  loginViaUI,
  uniqueName,
  E2E_BACKEND_URL
} from '../helpers';

async function profLogin(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${E2E_BACKEND_URL}/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).token as string;
}

test.describe('Professor — Modal de Geração de Atividades por IA (9router)', () => {
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
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) await cleanupEntities(request, adminToken, cursoId, professorId);
  });

  test('verifica elementos visuais do gerador de IA integrado na aba Geral', async ({ page }) => {
    await loginViaUI(page, profEmail, profPassword, /\/professor/);
    await expect(page.getByRole('heading', { name: 'Painel do Professor' })).toBeVisible();
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.getByRole('heading', { name: materiaNome })).toBeVisible();

    // Abrir o editor de atividade
    await page.getByRole('button', { name: 'Nova Atividade' }).first().click();

    // Validar painel de IA integrado na aba Geral
    await expect(page.getByRole('heading', { name: 'Gerador de Questões por IA' })).toBeVisible();
    await expect(page.getByText('Tema / Tópico Específico (Opcional se houver aulas)')).toBeVisible();
    await expect(page.getByText('Observações ou Instruções Pedagógicas para a IA')).toBeVisible();
    await expect(page.getByRole('button', { name: /Gerar e Adicionar Questões na Atividade/i })).toBeVisible();

    // Fechar o editor
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { name: materiaNome })).toBeVisible();
  });
});
