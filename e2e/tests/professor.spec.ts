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

test.describe('Professor — CRUD de Materias, Aulas e Atividades', () => {
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
    return page.locator('h3', { hasText: cursoNome }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
  }

  test('fluxo completo: materia → aula (marp) → atividade pela UI', async ({ page }) => {
    await acceptDialogs(page);
    await loginViaUI(page, profEmail, profPassword, /\/professor/);

    // ---------- Materia: CREATE ----------
    const materiaNome = uniqueName('MateriaUI');
    const materiaSenha = 'senha123';
    await expect(page.getByRole('heading', { name: 'Meus Cursos' })).toBeVisible();
    await cursoCard(page).locator('button', { hasText: 'Gerenciar Materias' }).click();
    await expect(page.getByRole('button', { name: 'Nova Materia' })).toBeVisible();

    await page.getByRole('button', { name: 'Nova Materia' }).click();
    await page.locator('form').getByLabel('Nome da Materia *').fill(materiaNome);
    await page.locator('form').getByLabel('Senha de Acesso para Alunos').fill(materiaSenha);
    await page.getByRole('button', { name: 'Salvar Materia' }).click();
    const materiaCard = page.locator('h3', { hasText: materiaNome }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(materiaCard).toBeVisible();

    // ---------- Materia: UPDATE ----------
    const materiaEditada = `${materiaNome} Editada`;
    await materiaCard.locator('button', { hasText: 'edit' }).click();
    await page.locator('form').getByLabel('Nome da Materia *').fill(materiaEditada);
    await page.getByRole('button', { name: 'Salvar Materia' }).click();
    const materiaCardEdit = page.locator('h3', { hasText: materiaEditada }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(materiaCardEdit).toBeVisible();

    // ---------- Entra na materia ----------
    await materiaCardEdit.locator('button', { hasText: 'Gerenciar Aulas & Atividades' }).click();
    await expect(page.getByText('Aulas Cadastradas')).toBeVisible();

    // ---------- Aula: CREATE (Marp) ----------
    const aulaTitulo = uniqueName('AulaUI');
    await page.getByRole('button', { name: 'Criar Aula (Marp)' }).click();
    await page.getByPlaceholder('Título da Aula').fill(aulaTitulo);
    await page.getByPlaceholder('Descrição rápida').fill('Aula criada pela UI');
    await page.getByPlaceholder('Digite seu código Marp Markdown aqui...').fill('# Slide 1\n\nConteudo do slide.\n\n---\n\n# Slide 2');
    await page.getByRole('button', { name: 'Salvar Aula' }).click();
    await expect(page.locator('div', { hasText: aulaTitulo }).first()).toBeVisible();

    // ---------- Aula: UPDATE ----------
    const aulaEditada = `${aulaTitulo} Editada`;
    await page.locator('div', { hasText: aulaTitulo }).locator('button[title="Editar Aula"]').click();
    await page.getByPlaceholder('Título da Aula').fill(aulaEditada);
    await page.getByRole('button', { name: 'Salvar Aula' }).click();
    await expect(page.locator('div', { hasText: aulaEditada }).first()).toBeVisible();

    // ---------- Aula: DELETE ----------
    await acceptDialogs(page);
    await page.locator('div', { hasText: aulaEditada }).locator('button[title="Excluir Aula"]').click();
    await expect(page.locator('div', { hasText: aulaEditada })).toHaveCount(0);

    // ---------- Atividade: CREATE ----------
    const atvTitulo = uniqueName('AtvUI');
    await page.getByRole('button', { name: 'Criar Atividade' }).click();
    await page.getByPlaceholder('Ex: Avaliação de Algoritmos').fill(atvTitulo);
    await page.getByPlaceholder('Breve resumo da atividade...').fill('Atividade criada pela UI');
    await page.getByRole('button', { name: 'Adicionar Pergunta' }).click();
    await page.getByPlaceholder('Digite a pergunta para o aluno...').fill('Qual é a capital do Brasil?');
    await page.getByPlaceholder('Texto da opção').first().fill('Brasília');
    await page.locator('input[type="radio"]').first().check();
    await page.getByPlaceholder('Texto da opção').nth(1).fill('Rio de Janeiro');
    await page.getByRole('button', { name: 'Salvar Atividade' }).click();
    await expect(page.locator('div', { hasText: atvTitulo }).first()).toBeVisible();

    // ---------- Atividade: UPDATE ----------
    const atvEditada = `${atvTitulo} Editada`;
    await page.locator('div', { hasText: atvTitulo }).locator('button[title="Editar Atividade"]').click();
    await page.getByPlaceholder('Ex: Avaliação de Algoritmos').fill(atvEditada);
    await page.getByRole('button', { name: 'Salvar Atividade' }).click();
    await expect(page.locator('div', { hasText: atvEditada }).first()).toBeVisible();

    // ---------- Atividade: DELETE ----------
    await page.locator('div', { hasText: atvEditada }).locator('button[title="Excluir Atividade"]').click();
    await expect(page.locator('div', { hasText: atvEditada })).toHaveCount(0);

    // ---------- Volta para materias e exclui a materia ----------
    await page.getByRole('button', { name: 'arrow_back' }).click();
    await expect(page.getByRole('button', { name: 'Nova Materia' })).toBeVisible();
    const materiaCardFinal = page.locator('h3', { hasText: materiaEditada }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(materiaCardFinal).toBeVisible();
    await materiaCardFinal.locator('button', { hasText: 'delete' }).click();
    await expect(materiaCardFinal).toHaveCount(0);
  });
});
