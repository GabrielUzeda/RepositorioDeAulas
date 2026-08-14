import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  setupAdminContext,
  createProfessor,
  cleanupEntities,
  loginViaUI,
  uniqueName
} from '../helpers';

test.describe('Admin — CRUD de Professores', () => {
  let adminToken: string;
  let profEmail: string;

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
  });

  test('cria, edita e exclui um professor pela UI', async ({ page }) => {
    await loginViaUI(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin/);
    await expect(page.getByText('Painel Administrador')).toBeVisible();

    const nome = uniqueName('ProfUI');
    profEmail = `${uniqueName('profui')}@local`;

    // --- CREATE ---
    await page.getByRole('button', { name: 'Novo Professor' }).click();
    await page.locator('form').getByLabel('Nome').fill(nome);
    await page.locator('form').getByLabel('E-mail').fill(profEmail);
    await page.locator('form').getByLabel('Senha').fill('senha12345');
    await page.locator('form').getByLabel('Perfil').selectOption('professor');
    await page.getByRole('button', { name: 'Salvar Professor' }).click();
    await expect(page.locator('tbody', { hasText: profEmail })).toBeVisible();

    // --- UPDATE ---
    const row = page.locator('tr', { hasText: profEmail });
    const novoNome = `${nome} Editado`;
    await row.locator('button', { hasText: 'edit' }).click();
    await page.locator('form').getByLabel('Nome').fill(novoNome);
    await page.getByRole('button', { name: 'Salvar Professor' }).click();
    await expect(page.locator('tr', { hasText: novoNome })).toBeVisible();

    // --- DELETE ---
    await page.locator('tr', { hasText: novoNome }).locator('button', { hasText: 'delete' }).click();
    await page.getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(page.locator('tr', { hasText: novoNome })).toHaveCount(0);
  });

  test.afterEach(async ({ request }) => {
    if (adminToken && profEmail) {
      const res = await request.get(`${process.env.E2E_BACKEND_URL || 'http://localhost:18080'}/professores`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok()) {
        const list = await res.json();
        const found = list.find((p: any) => p.email === profEmail);
        if (found) {
          await request.delete(
            `${process.env.E2E_BACKEND_URL || 'http://localhost:18080'}/professores/${found.id}`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
          );
        }
      }
    }
  });
});

test.describe('Admin — CRUD de Cursos', () => {
  let adminToken: string;
  let professorId: number;
  let professorEmail: string;

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
    const prof = await createProfessor(request, adminToken);
    professorId = prof.id;
    professorEmail = prof.email;
  });

  test.afterAll(async ({ request }) => {
    if (adminToken && professorId != null) {
      await cleanupEntities(request, adminToken, undefined, professorId);
    }
  });

  test('cria, edita e exclui um curso pela UI atribuindo um professor', async ({ page }) => {
    await loginViaUI(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin/);
    await page.getByRole('tab', { name: /Cursos/ }).click();

    const nome = uniqueName('CursoUI');

    // --- CREATE ---
    await page.getByRole('button', { name: 'Novo Curso' }).click();
    await page.locator('form').getByLabel('Nome do Curso *').fill(nome);
    await page.locator('form').getByLabel('Descrição').fill('Curso criado pela UI de teste');
    await page.locator('button', { hasText: professorEmail }).click();
    await page.getByRole('button', { name: 'Salvar Curso' }).click();
    const card = page.locator('div.bg-surface-alt', { has: page.locator('h3', { hasText: nome }) });
    await expect(card).toBeVisible();
    await expect(card).toContainText('1 professores');

    // --- UPDATE ---
    const novoNome = `${nome} Alt`;
    await card.locator('button', { hasText: 'edit' }).click();
    await page.locator('form').getByLabel('Nome do Curso *').fill(novoNome);
    await page.getByRole('button', { name: 'Salvar Curso' }).click();
    const cardNovo = page.locator('div.bg-surface-alt', { has: page.locator('h3', { hasText: novoNome }) });
    await expect(cardNovo).toBeVisible();

    // --- DELETE ---
    await cardNovo.locator('button', { hasText: 'delete' }).click();
    await page.getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(page.locator('h3', { hasText: novoNome })).toHaveCount(0);
  });
});
