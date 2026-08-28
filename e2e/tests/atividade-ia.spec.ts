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

  test('abre modal de IA, verifica elementos visuais, modelos e opções de tema/aulas', async ({ page }) => {
    await loginViaUI(page, profEmail, profPassword, /\/professor/);
    await expect(page.getByRole('heading', { name: 'Painel do Professor' })).toBeVisible();
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.getByRole('heading', { name: materiaNome })).toBeVisible();

    // Abrir o editor de atividade
    await page.getByRole('button', { name: 'Nova Atividade' }).click();
    await expect(page.getByRole('button', { name: 'Gerar com IA' })).toBeVisible();

    // Clicar em "Gerar com IA"
    await page.getByRole('button', { name: 'Gerar com IA' }).click();

    // Validar modal de IA aberto
    await expect(page.getByRole('heading', { name: /Gerador de Atividades por IA/i })).toBeVisible();
    await expect(page.getByText(/Tema \/ Tópico Principal/i)).toBeVisible();
    await expect(page.getByText(/Observações ou Instruções Pedagógicas/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Gerar Questões com IA/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Atualizar Modelos/i })).toBeVisible();

    // Fechar o modal de IA
    await page.locator('.max-w-5xl').getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { name: 'Nova Atividade Interativa' })).toBeVisible();
  });
});
