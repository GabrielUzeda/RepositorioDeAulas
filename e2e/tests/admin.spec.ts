import { test, expect, Page } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  createCurso,
  createProfessor,
  setupAdminContext,
  cleanupEntities,
  loginViaUI,
  uniqueName
} from '../helpers';

async function acceptDialogs(page: Page) {
  page.on('dialog', (d) => {
    d.accept().catch(() => {});
  });
}

test.describe('Admin — CRUD de Professores', () => {
  let adminToken: string;
  let profEmail: string;

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
  });

  test('cria, edita e exclui um professor pela UI', async ({ page }) => {
    await loginViaUI(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin/);
    await expect(page.getByRole('heading', { name: 'Painel do Administrador' })).toBeVisible();

    const nome = uniqueName('ProfUI');
    profEmail = `${uniqueName('profui')}@local`;

    // --- CREATE ---
    await page.getByRole('button', { name: 'Novo Professor' }).click();
    await page.locator('form').getByLabel('Nome').fill(nome);
    await page.locator('form').getByLabel('E-mail').fill(profEmail);
    await page.locator('form').getByLabel('Senha').fill('senha12345');
    await page.locator('form').getByLabel('Perfil').selectOption('professor');
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.locator('tbody', { hasText: profEmail })).toBeVisible();

    // --- UPDATE ---
    const row = page.locator('tr', { hasText: profEmail });
    const novoNome = `${nome} Editado`;
    await row.locator('button', { hasText: 'edit' }).click();
    await page.locator('form').getByLabel('Nome').fill(novoNome);
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.locator('tr', { hasText: novoNome })).toBeVisible();

    // --- DELETE ---
    await acceptDialogs(page);
    await page.locator('tr', { hasText: novoNome }).locator('button', { hasText: 'delete' }).click();
    await expect(page.locator('tr', { hasText: novoNome })).toHaveCount(0);
  });

  test.afterEach(async ({ request }) => {
    if (adminToken) {
      // Tenta limpar por API caso o DELETE da UI não tenha acontecido
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
    await page.getByRole('button', { name: 'Cursos', exact: true }).click();

    const nome = uniqueName('CursoUI');

    // --- CREATE ---
    await page.getByRole('button', { name: 'Novo Curso' }).click();
    await page.locator('form').getByLabel('Nome do Curso *').fill(nome);
    await page.locator('form').getByLabel('Descrição').fill('Curso criado pela UI de teste');
    await page.locator('label', { hasText: professorEmail }).locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Salvar Curso' }).click();
    const card = page.locator('h3', { hasText: nome }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(card).toBeVisible();
    await expect(card).toContainText('1 professores');

    // --- UPDATE ---
    const novoNome = `${nome} Editado`;
    await card.locator('button', { hasText: 'edit' }).click();
    await page.locator('form').getByLabel('Nome do Curso *').fill(novoNome);
    await page.getByRole('button', { name: 'Salvar Curso' }).click();
    const cardUpdated = page.locator('h3', { hasText: novoNome }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(cardUpdated).toBeVisible();

    // --- DELETE ---
    await acceptDialogs(page);
    await cardUpdated.locator('button', { hasText: 'delete' }).click();
    await expect(cardUpdated).toHaveCount(0);
  });
});
