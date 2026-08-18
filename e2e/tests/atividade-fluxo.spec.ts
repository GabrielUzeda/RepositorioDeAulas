import { test, expect, Page, APIRequestContext } from '@playwright/test';
import fs from 'fs';
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

test.describe('Professor — gravar, exportar e importar atividade (JSON)', () => {
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

  test('grava atividade com 2 questões, exporta e importa JSON', async ({ page }) => {
    const atvTitulo = uniqueName('AtvGrav');
    await loginViaUI(page, profEmail, profPassword, /\/professor/);
    await expect(page.getByRole('heading', { name: 'Painel do Professor' })).toBeVisible();
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.getByRole('heading', { name: materiaNome })).toBeVisible();

    // --- NOVA ATIVIDADE (tipo objetivo: reforco) ---
    await page.getByRole('button', { name: 'Nova Atividade' }).click();
    await page.locator('select').selectOption('reforco');
    await page.getByPlaceholder('Ex: Avaliação de Algoritmos').fill(atvTitulo);

    // Questão 1
    await page.getByRole('button', { name: 'Adicionar Pergunta' }).click();
    await page.getByPlaceholder('Digite a pergunta para o aluno...').fill('Qual é a capital do Brasil?');
    await page.getByPlaceholder('Texto da opção').first().fill('Brasília');
    await page.getByPlaceholder('Texto da opção').nth(1).fill('Rio de Janeiro');

    // Questão 2
    await page.getByRole('button', { name: 'Adicionar Pergunta' }).click();
    await page.getByPlaceholder('Digite a pergunta para o aluno...').nth(1).fill('Quanto é 2 + 2?');
    await page.getByPlaceholder('Texto da opção').nth(2).fill('4');
    await page.getByPlaceholder('Texto da opção').nth(3).fill('5');

    // --- EXPORTAÇÃO (download do JSON) ---
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportar JSON' }).click(),
    ]);
    const dlPath = await download.path();
    const exported = JSON.parse(fs.readFileSync(dlPath!, 'utf-8'));
    expect(exported.questions.length).toBe(2);
    expect(
      exported.questions[0].options.some((o: any) => o.text === 'Brasília' && o.correct === true)
    ).toBeTruthy();

    // --- GRAVAÇÃO ---
    await page.getByRole('button', { name: 'Salvar Atividade' }).click();
    await expect(page.locator('p', { hasText: atvTitulo }).first()).toBeVisible();

    // --- IMPORTAÇÃO (JSON -> editor) ---
    const importTitulo = uniqueName('AtvImp');
    const importFile = '/tmp/import-atv.json';
    fs.writeFileSync(
      importFile,
      JSON.stringify({
        titulo: importTitulo,
        tipo: 'reforco',
        questions: [
          {
            title: 'Q import 1',
            content: 'Importada 1?',
            options: [
              { text: 'Sim', correct: true, feedback: 'ok' },
              { text: 'Não', correct: false, feedback: 'no' },
            ],
          },
          {
            title: 'Q import 2',
            content: 'Importada 2?',
            options: [
              { text: 'A', correct: true, feedback: 'ok' },
              { text: 'B', correct: false, feedback: 'no' },
            ],
          },
        ],
      })
    );
    await page.getByRole('button', { name: 'Nova Atividade' }).click();
    await page.locator('input[type="file"]').setInputFiles(importFile);
    await expect(page.getByPlaceholder('Ex: Avaliação de Algoritmos')).toHaveValue(importTitulo);
    await expect(page.getByText('Perguntas (2)')).toBeVisible();
    await page.getByRole('button', { name: 'Salvar Atividade' }).click();
    await expect(page.locator('p', { hasText: importTitulo }).first()).toBeVisible();
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
    await expect(page.getByText('Q1')).toBeVisible();
    await page.getByRole('button', { name: /Brasília/ }).click();
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Passo 2: Pergunta 2
    await expect(page.getByText('Q2')).toBeVisible();
    await page.getByRole('button', { name: /^4/ }).click();
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Passo 3: Revisão e Envio
    await expect(page.getByText('Revisão das Respostas')).toBeVisible();
    await page.getByRole('button', { name: /Enviar Resposta/ }).click();
    await expect(page.getByText(/Correção do servidor: 2 \/ 2 acertos/).first()).toBeVisible();
  });
});
