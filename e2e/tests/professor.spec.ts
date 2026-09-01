import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  createCurso,
  createProfessor,
  setupAdminContext,
  cleanupEntities,
  loginViaUI,
  uniqueName
} from '../helpers';

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

  test('fluxo completo: disciplina → aula (marp) → atividade pela UI', async ({ page }) => {
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

    await expect(page.locator('h3', { hasText: discNome })).toBeVisible();

    // ---------- Disciplina: UPDATE ----------
    const discEditada = `${discNome} Editada`;
    await page.locator('h3', { hasText: discNome }).locator('xpath=ancestor::div[contains(@class,"rounded") or contains(@class,"card")][1]').locator('button[title="Editar Disciplina"]').click();
    await page.getByLabel('Nome da Disciplina *').fill(discEditada);
    await page.getByRole('button', { name: 'Salvar Disciplina' }).click();

    await expect(page.locator('h3', { hasText: discEditada })).toBeVisible();

    // ---------- Entra na disciplina ----------
    await page.locator('h3', { hasText: discEditada }).click();
    await expect(page.getByRole('heading', { name: discEditada })).toBeVisible();

    // ---------- Aula: CREATE (Marp) ----------
    const aulaTitulo = uniqueName('AulaUI');
    await page.getByRole('button', { name: 'Nova Aula' }).click();
    await page.getByPlaceholder('Título da Aula').fill(aulaTitulo);
    await page.getByPlaceholder('Descrição rápida da aula...').fill('Aula criada pela UI');
    await page.getByPlaceholder('Digite seu código Marp Markdown aqui...').fill('# Slide 1\n\nConteudo do slide.\n\n---\n\n# Slide 2');
    await page.getByRole('button', { name: 'Salvar Aula' }).click();
    await expect(page.locator('h4', { hasText: aulaTitulo }).first()).toBeVisible();

    // ---------- Aula: UPDATE ----------
    const aulaEditada = `${aulaTitulo} Editada`;
    const aulaCard = page.locator('h4', { hasText: aulaTitulo }).locator('xpath=ancestor::div[contains(@class,"p-4")][1]');
    await aulaCard.locator('button[title="Editar Aula"]').click();
    await page.getByPlaceholder('Título da Aula').fill(aulaEditada);
    await page.getByRole('button', { name: 'Salvar Aula' }).click();
    await expect(page.locator('h4', { hasText: aulaEditada }).first()).toBeVisible();

    // ---------- Aula: DELETE ----------
    const aulaCardEdit = page.locator('h4', { hasText: aulaEditada }).locator('xpath=ancestor::div[contains(@class,"p-4")][1]');
    await aulaCardEdit.locator('button[title="Excluir Aula"]').click();
    await page.getByRole('button', { name: 'Excluir' }).click();
    await expect(page.locator('h4', { hasText: aulaEditada })).toHaveCount(0);

    // ---------- Atividade: CREATE ----------
    const atvTitulo = uniqueName('AtvUI');
    await page.getByRole('button', { name: 'Nova Atividade' }).first().click();
    await page.getByLabel('Tipo de Atividade').selectOption('reforco');
    await page.getByPlaceholder('Ex: Avaliação de Algoritmos').fill(atvTitulo);
    await page.getByPlaceholder('Breve resumo ou instruções da atividade para os alunos...').fill('Atividade criada pela UI');
    await page.getByRole('button', { name: 'Adicionar Pergunta' }).click();
    await page.getByPlaceholder('Digite o enunciado completo da questão para o aluno...').fill('Qual é a capital do Brasil?');
    await page.getByPlaceholder('Texto da alternativa...').first().fill('Brasília');
    await page.locator('input[type="radio"]').first().check();
    await page.getByPlaceholder('Texto da alternativa...').nth(1).fill('Rio de Janeiro');
    await page.getByRole('button', { name: 'Salvar Atividade' }).click();
    await expect(page.locator('h4', { hasText: atvTitulo }).first()).toBeVisible();

    // ---------- Atividade: UPDATE ----------
    const atvEditada = `${atvTitulo} Editada`;
    const atvCard = page.locator('h4', { hasText: atvTitulo }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
    await atvCard.locator('button[title="Editar Atividade"]').click();
    await page.getByPlaceholder('Ex: Avaliação de Algoritmos').fill(atvEditada);
    await page.getByRole('button', { name: 'Salvar Atividade' }).click();
    await expect(page.locator('h4', { hasText: atvEditada }).first()).toBeVisible();

    // ---------- Atividade: DELETE ----------
    const atvCardEdit = page.locator('h4', { hasText: atvEditada }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
    await atvCardEdit.locator('button[title="Excluir Atividade"]').click();
    await page.getByRole('button', { name: 'Excluir' }).click();
    await expect(page.locator('h4', { hasText: atvEditada })).toHaveCount(0);

    // ---------- Volta para lista de disciplinas e exclui ----------
    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page.getByRole('button', { name: 'Nova Disciplina' })).toBeVisible();
    await page.locator('h3', { hasText: discEditada }).locator('xpath=ancestor::div[contains(@class,"rounded") or contains(@class,"card")][1]').locator('button[title="Excluir Disciplina"]').click();
    await page.getByRole('button', { name: 'Excluir' }).click();
    await expect(page.locator('h3', { hasText: discEditada })).toHaveCount(0);
  });

  test('reordenação de aulas e atividades via botões e modo de salvamento', async ({ page }) => {
    await loginViaUI(page, profEmail, profPassword, /\/professor/);

    // Entra no curso
    await page.locator('h3', { hasText: cursoNome }).click();

    // Cria disciplina de teste
    const discNome = uniqueName('DiscReord');
    await page.getByRole('button', { name: 'Nova Disciplina' }).click();
    await page.getByLabel('Nome da Disciplina *').fill(discNome);
    await page.getByRole('button', { name: 'Salvar Disciplina' }).click();

    await page.locator('h3', { hasText: discNome }).click();

    // Cria Aula 1 e Aula 2 (Aula 2 deve ficar no final por padrão)
    await page.getByRole('button', { name: 'Nova Aula' }).click();
    await page.getByPlaceholder('Título da Aula').fill('Aula Primeiro');
    await page.getByPlaceholder('Digite seu código Marp Markdown aqui...').fill('# Slide 1');
    await page.getByRole('button', { name: 'Salvar Aula' }).click();

    await page.getByRole('button', { name: 'Nova Aula' }).click();
    await page.getByPlaceholder('Título da Aula').fill('Aula Segundo');
    await page.getByPlaceholder('Digite seu código Marp Markdown aqui...').fill('# Slide 1');
    await page.getByRole('button', { name: 'Salvar Aula' }).click();

    // Entra em modo de reordenação
    const btnReordenar = page.locator('button', { hasText: 'Reordenar' }).first();
    await expect(btnReordenar).toBeVisible();
    await btnReordenar.click();

    // O botão deve mudar para "Salvar Ordem"
    const btnSalvarOrdem = page.locator('button', { hasText: 'Salvar Ordem' }).first();
    await expect(btnSalvarOrdem).toBeVisible();

    // Move a Aula Segundo para cima
    const btnSubir = page.locator('button[title="Mover para cima"]').last();
    await btnSubir.click();

    // Salva a nova ordem
    await btnSalvarOrdem.click();

    // Aguarda retornar ao estado normal
    await expect(page.locator('button', { hasText: 'Reordenar' }).first()).toBeVisible();

    // Exclui a disciplina de teste
    await page.getByRole('button', { name: 'Voltar' }).click();
    await page.locator('h3', { hasText: discNome }).locator('xpath=ancestor::div[contains(@class,"rounded") or contains(@class,"card")][1]').locator('button[title="Excluir Disciplina"]').click();
    await page.getByRole('button', { name: 'Excluir' }).click();
  });
});
