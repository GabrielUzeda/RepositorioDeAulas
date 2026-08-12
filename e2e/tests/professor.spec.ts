import { test, expect, Page } from '@playwright/test';
import {
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

test.describe('Professor — CRUD de Disciplinas, Aulas e Atividades', () => {
  let adminToken: string;
  let profEmail: string;
  let profPassword: string;
  let professorId: number;
  let cursoId: number;
  let cursoNome: string;

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
    const prof = await createProfessor(request, adminToken);
    profEmail = prof.email;
    profPassword = prof.password;
    professorId = prof.id;
    const curso = await createCurso(request, adminToken, [professorId]);
    cursoId = curso.id;
    cursoNome = curso.nome;
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) {
      await cleanupEntities(request, adminToken, cursoId, professorId);
    }
  });

  function cursoCard(page: Page) {
    return page.locator('h3', { hasText: cursoNome }).locator('xpath=ancestor::div[contains(@class,"rounded") or contains(@class,"card")][1]');
  }

  test('fluxo completo: disciplina → aula (marp) → atividade pela UI', async ({ page }) => {
    await acceptDialogs(page);
    await loginViaUI(page, profEmail, profPassword, /\/professor/);

    await expect(page.getByRole('heading', { name: 'Painel do Professor' })).toBeVisible();

    // Seleciona o curso
    await page.locator('h3', { hasText: cursoNome }).click();

    // ---------- Disciplina: CREATE ----------
    const discNome = uniqueName('DiscUI');
    await expect(page.getByRole('button', { name: 'Nova Disciplina' })).toBeVisible();
    await page.getByRole('button', { name: 'Nova Disciplina' }).click();

    await page.getByLabel('Nome da Disciplina *').fill(discNome);
    await page.getByRole('button', { name: 'Salvar Disciplina' }).click();

    const discCard = page.locator('h3', { hasText: discNome }).locator('xpath=ancestor::div[contains(@class,"rounded") or contains(@class,"card")][1]');
    await expect(discCard).toBeVisible();

    // ---------- Disciplina: UPDATE ----------
    const discEditada = `${discNome} Editada`;
    await discCard.locator('button[title="Editar Disciplina"]').click();
    await page.getByLabel('Nome da Disciplina *').fill(discEditada);
    await page.getByRole('button', { name: 'Salvar Disciplina' }).click();

    const discCardEdit = page.locator('h3', { hasText: discEditada }).locator('xpath=ancestor::div[contains(@class,"rounded") or contains(@class,"card")][1]');
    await expect(discCardEdit).toBeVisible();

    // ---------- Entra na disciplina ----------
    await discCardEdit.locator('button', { hasText: 'Gerenciar Aulas & Atividades' }).click();
    await expect(page.getByText('Aulas (Marp Markdown)')).toBeVisible();

    // ---------- Aula: CREATE (Marp) ----------
    const aulaTitulo = uniqueName('AulaUI');
    await page.getByRole('button', { name: 'Nova Aula' }).click();
    await page.getByPlaceholder('Título da Aula').fill(aulaTitulo);
    await page.getByPlaceholder('Descrição rápida da aula...').fill('Aula criada pela UI');
    await page.getByPlaceholder('Digite seu código Marp Markdown aqui...').fill('# Slide 1\n\nConteudo do slide.\n\n---\n\n# Slide 2');
    await page.getByRole('button', { name: 'Salvar Aula' }).click();
    await expect(page.locator('p', { hasText: aulaTitulo }).first()).toBeVisible();

    // ---------- Aula: UPDATE ----------
    const aulaEditada = `${aulaTitulo} Editada`;
    await page.locator('p', { hasText: aulaTitulo }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]').locator('button[title="Editar Aula"]').click();
    await page.getByPlaceholder('Título da Aula').fill(aulaEditada);
    await page.getByRole('button', { name: 'Salvar Aula' }).click();
    await expect(page.locator('p', { hasText: aulaEditada }).first()).toBeVisible();

    // ---------- Aula: DELETE ----------
    await acceptDialogs(page);
    await page.locator('p', { hasText: aulaEditada }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]').locator('button[title="Excluir Aula"]').click();
    await expect(page.locator('p', { hasText: aulaEditada })).toHaveCount(0);

    // ---------- Atividade: CREATE ----------
    const atvTitulo = uniqueName('AtvUI');
    await page.getByRole('button', { name: 'Nova Atividade' }).click();
    await page.locator('select').selectOption('reforco');
    await page.getByPlaceholder('Ex: Avaliação de Algoritmos').fill(atvTitulo);
    await page.getByPlaceholder('Breve resumo da atividade...').fill('Atividade criada pela UI');
    await page.getByRole('button', { name: 'Adicionar Pergunta' }).click();
    await page.getByPlaceholder('Digite a pergunta para o aluno...').fill('Qual é a capital do Brasil?');
    await page.getByPlaceholder('Texto da opção').first().fill('Brasília');
    await page.locator('input[type="radio"]').first().check();
    await page.getByPlaceholder('Texto da opção').nth(1).fill('Rio de Janeiro');
    await page.getByRole('button', { name: 'Salvar Atividade' }).click();
    await expect(page.locator('p', { hasText: atvTitulo }).first()).toBeVisible();

    // ---------- Atividade: UPDATE ----------
    const atvEditada = `${atvTitulo} Editada`;
    await page.locator('p', { hasText: atvTitulo }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]').locator('button[title="Editar Atividade"]').click();
    await page.getByPlaceholder('Ex: Avaliação de Algoritmos').fill(atvEditada);
    await page.getByRole('button', { name: 'Salvar Atividade' }).click();
    await expect(page.locator('p', { hasText: atvEditada }).first()).toBeVisible();

    // ---------- Atividade: DELETE ----------
    await page.locator('p', { hasText: atvEditada }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]').locator('button[title="Excluir Atividade"]').click();
    await expect(page.locator('p', { hasText: atvEditada })).toHaveCount(0);

    // ---------- Volta para lista de disciplinas e exclui ----------
    await page.getByRole('button', { name: 'arrow_back' }).click();
    await expect(page.getByRole('button', { name: 'Nova Disciplina' })).toBeVisible();
    const discCardFinal = page.locator('h3', { hasText: discEditada }).locator('xpath=ancestor::div[contains(@class,"rounded") or contains(@class,"card")][1]');
    await expect(discCardFinal).toBeVisible();
    await discCardFinal.locator('button[title="Excluir Disciplina"]').click();
    await expect(discCardFinal).toHaveCount(0);
  });
});
