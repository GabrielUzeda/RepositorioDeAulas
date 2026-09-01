import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
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
async function api(request: APIRequestContext, method: 'post' | 'put' | 'delete', path: string, token: string, data?: any) {
  return request[method](`${E2E_BACKEND_URL}${path}`, { headers: { Authorization: `Bearer ${token}` }, data });
}

test.describe('Professor — criar atividade e gerenciar rascunhos no editor', () => {
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

  test('salva rascunho automaticamente, restaura ao reabrir, testa limpar tudo e grava atividade', async ({ page }) => {
    const atvTitulo = uniqueName('AtvRasc');
    await loginViaUI(page, profEmail, profPassword, /\/professor/);
    await expect(page.getByRole('heading', { name: 'Painel do Professor' })).toBeVisible();
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.getByRole('heading', { name: materiaNome })).toBeVisible();

    // --- NOVA ATIVIDADE (tipo objetivo: reforco) ---
    await page.getByRole('button', { name: 'Nova Atividade' }).first().click();
    await page.getByLabel('Tipo de Atividade').selectOption('reforco');
    await page.getByPlaceholder('Ex: Avaliação de Algoritmos').fill(atvTitulo);

    // Questão 1 (painel exibe só a pergunta ativa)
    await page.getByRole('button', { name: 'Adicionar Pergunta' }).click();
    await page.getByPlaceholder('Digite o enunciado completo da questão para o aluno...').fill('Qual é a capital do Brasil?');
    await page.getByPlaceholder('Texto da alternativa...').first().fill('Brasília');
    await page.getByPlaceholder('Texto da alternativa...').nth(1).fill('Rio de Janeiro');

    // Questão 2 (Adicionar Pergunta troca o painel para a nova questão)
    await page.getByRole('button', { name: 'Adicionar Pergunta' }).click();
    await page.getByPlaceholder('Digite o enunciado completo da questão para o aluno...').fill('Quanto é 2 + 2?');
    await page.getByPlaceholder('Texto da alternativa...').first().fill('4');
    await page.getByPlaceholder('Texto da alternativa...').nth(1).fill('5');

    // --- SALVAR RASCUNHO NA NUVEM VIA MODAL DE RASCUNHOS (com aviso de 30 dias) ---
    await page.getByRole('button', { name: 'Rascunhos' }).click();
    await expect(page.getByText('Rascunhos salvos por até 30 dias')).toBeVisible();
    await page.getByRole('button', { name: 'Salvar Rascunho Atual' }).click();
    await expect(page.getByText('Rascunho salvo na nuvem com validade de 30 dias!')).toBeVisible();
    await expect(page.getByText(atvTitulo, { exact: true })).toBeVisible();
    await page.getByRole('dialog', { name: 'Rascunhos de Atividades' }).getByLabel('Fechar modal').click();

    // Fecha o editor pelo botão de fechar do BaseModal
    await page.getByRole('dialog').filter({ hasText: 'Nova Atividade' }).getByLabel('Fechar modal').click();

    // --- REABRIR EDITOR E VERIFICAR RESTAURAÇÃO AUTOMÁTICA ---
    await page.getByRole('button', { name: 'Nova Atividade' }).first().click();
    await expect(page.getByText('Perguntas', { exact: true })).toBeVisible();
    await expect(page.getByText('2', { exact: true }).first()).toBeVisible();

    // --- TESTAR BOTÃO LIMPAR TUDO COM CONFIRMAÇÃO ---
    await page.getByRole('button', { name: 'Limpar Tudo' }).click();
    await expect(page.getByText('Tem certeza de que deseja limpar todos os campos e perguntas do editor?')).toBeVisible();
    await page.getByRole('button', { name: 'Limpar Tudo' }).last().click();
    await expect(page.getByText('Editor limpo com sucesso!')).toBeVisible();
    await expect(page.getByText('Nenhuma pergunta adicionada.')).toBeVisible();

    // --- RESTAURAR DA NUVEM VIA MODAL DE RASCUNHOS ---
    await page.getByRole('button', { name: 'Rascunhos' }).click();
    await expect(page.getByText(atvTitulo, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Carregar' }).first().click();
    await expect(page.getByText('Rascunho carregado no editor!', { exact: true })).toBeVisible();
    await expect(page.getByText('2', { exact: true }).first()).toBeVisible();

    // --- GRAVAR ATIVIDADE DEFINITIVA ---
    await page.getByRole('button', { name: 'Salvar Atividade' }).click();
    await expect(page.locator('h4', { hasText: atvTitulo }).first()).toBeVisible();

    // --- EXCLUIR RASCUNHO APÓS USO ---
    await page.getByRole('button', { name: 'Nova Atividade' }).first().click();
    await page.getByRole('button', { name: 'Rascunhos' }).click();
    const draftsModal = page.getByRole('dialog', { name: 'Rascunhos de Atividades' });
    await expect(draftsModal.getByRole('heading', { name: atvTitulo })).toBeVisible();
    await draftsModal.getByRole('button', { name: 'Excluir' }).first().click();
    await expect(page.getByText('Rascunho excluído com sucesso!', { exact: true })).toBeVisible();
    await draftsModal.getByLabel('Fechar modal').click();
    await page.getByRole('dialog').filter({ hasText: 'Nova Atividade' }).getByLabel('Fechar modal').click();
  });
});

test.describe('Aluno — visualizar e corrigir atividade (resposta por questão)', () => {
  let adminToken: string;
  let profEmail: string;
  let profPassword: string;
  let professorId: number;
  let cursoId: number;
  let cursoNome: string;
  let materiaNome: string;
  let atvTitulo: string;

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
    const prof = await createProfessor(request, adminToken);
    profEmail = prof.email;
    profPassword = prof.password;
    professorId = prof.id;
    const profToken = await profLogin(request, profEmail, profPassword);
    const curso = await createCurso(request, adminToken, [professorId]);
    cursoId = curso.id;
    cursoNome = curso.nome;
    const materia = await createMateria(request, profToken, cursoId);
    materiaNome = materia.nome;
    const atv = await api(request, 'post', '/atividades', profToken, {
      materia_id: materia.id,
      titulo: uniqueName('AtvAluno'),
      tipo: 'prova',
      allow_password: false,
      slug: uniqueName('atv'),
      json_data: JSON.stringify({
        questions: [
          {
            title: 'Q1',
            content: 'Qual é a capital do Brasil?',
            options: [
              { text: 'Brasília', correct: true, feedback: 'Certo!' },
              { text: 'Rio de Janeiro', correct: false, feedback: 'Não.' },
            ],
          },
          {
            title: 'Q2',
            content: 'Quanto é 2 + 2?',
            options: [
              { text: '4', correct: true, feedback: 'Isso!' },
              { text: '5', correct: false, feedback: 'Não.' },
            ],
          },
        ],
      }),
    });
    expect([200, 201]).toContain(atv.status());
    atvTitulo = (await atv.json()).titulo;
  });
  test.afterAll(async ({ request }) => {
    if (adminToken) await cleanupEntities(request, adminToken, cursoId, professorId);
  });

  test('aluno vê questões, responde por questão e recebe correção 2/2', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Selecione seu Curso' })).toBeVisible();
    await page.locator('h3', { hasText: cursoNome }).click();
    await expect(page.locator('h3', { hasText: materiaNome })).toBeVisible();
    await page.locator('h3', { hasText: materiaNome }).click();
    await page.getByRole('tab', { name: /Atividades/ }).click();
    await expect(page.locator('h3', { hasText: atvTitulo })).toBeVisible();
    await page.locator('h3', { hasText: atvTitulo }).click();

    // Passo 0: Identificação
    await page.getByLabel('Seu Nome *').fill('Aluno E2E');
    await page.getByLabel('Seu E-mail *').fill('aluno.e2e@local');
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Passo 1: Pergunta 1
    await expect(page.getByRole('button', { name: 'Brasília', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Brasília', exact: true }).click();
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Passo 2: Pergunta 2
    await expect(page.getByRole('button', { name: '4', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '4', exact: true }).click();
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Passo 3: Revisão e Envio
    await expect(page.getByText('Revisão das Respostas')).toBeVisible();
    await page.getByRole('button', { name: /Enviar Resposta/ }).click();
    await expect(page.getByText(/Correção do servidor: 2 \/ 2 acertos/).first()).toBeVisible();
  });
});
