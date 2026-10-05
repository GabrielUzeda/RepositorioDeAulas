import { test, expect } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import {
  createCurso,
  createMateria,
  createProfessor,
  setupAdminContext,
  cleanupEntities,
  E2E_BACKEND_URL,
  uniqueName
} from '../helpers';

async function profLogin(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${E2E_BACKEND_URL}/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).token as string;
}

async function api(request: APIRequestContext, method: 'post' | 'put' | 'delete' | 'get', path: string, token: string, data?: any) {
  return request[method](`${E2E_BACKEND_URL}${path}`, { headers: { Authorization: `Bearer ${token}` }, data });
}

const CODIGO_LINHAS = ['numero = 42', 'nome = "Ana"', 'print(nome)'];

async function abrirAtividadeDoAluno(page: Page, cursoNome: string, materiaNome: string, atvTitulo: string) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Selecione seu Curso' })).toBeVisible();
  await page.locator('h3', { hasText: cursoNome }).click();
  await expect(page.locator('h3', { hasText: materiaNome })).toBeVisible({ timeout: 15000 });
  await page.locator('h3', { hasText: materiaNome }).click();
  await page.getByRole('tab', { name: /Atividades/ }).click();
  await expect(page.locator('h3', { hasText: atvTitulo })).toBeVisible({ timeout: 15000 });
  await page.locator('h3', { hasText: atvTitulo }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function linhasDoEditor(page: Page): Promise<string[]> {
  await expect(page.locator('.cm-content')).toBeVisible({ timeout: 15000 });
  return page.locator('.cm-line').allInnerTexts();
}

test.describe('Aluno — modo código (IDE) na resposta discursiva', () => {
  let adminToken: string;
  let profEmail: string;
  let profPassword: string;
  let professorId: number;
  let cursoId: number;
  let cursoNome: string;
  let materiaId: number;
  let materiaNome: string;
  let atvId: number;
  let atvTitulo: string;

  const q1 = {
    title: 'Q1 — Variáveis',
    content: 'Escreva um programa que guarde um número, um nome e imprima o nome.'
  };
  const q2 = {
    title: 'Q2 — Conceito',
    content: 'Explique com suas palavras o que é uma variável.'
  };

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
    const prof = await createProfessor(request, adminToken);
    professorId = prof.id;
    profEmail = prof.email;
    profPassword = prof.password;
    const profToken = await profLogin(request, prof.email, prof.password);

    const curso = await createCurso(request, adminToken, [professorId], { senha: '' });
    cursoId = curso.id;
    cursoNome = curso.nome;

    const materia = await createMateria(request, profToken, cursoId);
    materiaId = materia.id;
    materiaNome = materia.nome;

    atvTitulo = `Modo Codigo ${uniqueName('E2E')}`;

    const atv = await api(request, 'post', '/atividades', profToken, {
      materia_id: materiaId,
      titulo: atvTitulo,
      tipo: 'normal',
      descricao: 'Atividade discursiva para validar o editor de programacao.',
      allow_password: false,
      slug: uniqueName('atv'),
      json_data: JSON.stringify({
        questions: [
          { title: q1.title, content: q1.content },
          { title: q2.title, content: q2.content }
        ]
      })
    });
    expect([200, 201]).toContain(atv.status());
    atvId = (await atv.json()).id;
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) await cleanupEntities(request, adminToken, cursoId, professorId);
  });

  test('o código digitado sobrevive à navegação, à revisão e à submissão', async ({ page, request }) => {
    await abrirAtividadeDoAluno(page, cursoNome, materiaNome, atvTitulo);

    await page.getByLabel('Seu Nome *').fill(`Aluno Codigo ${uniqueName('E2E')}`);
    await page.getByLabel('Seu E-mail *').fill(`${uniqueName('aluno.codigo')}@local`);
    await page.getByRole('button', { name: 'Próximo' }).click();

    await expect(page.getByText(q1.title)).toBeVisible();
    await expect(page.getByRole('button', { name: /Modo código/ })).toBeVisible();

    await page.getByRole('button', { name: /Modo código/ }).click();
    await page.getByLabel('Linguagem do código').selectOption('python');

    await page.locator('.cm-content').click();
    await page.keyboard.type(CODIGO_LINHAS.join('\n'));

    expect(await linhasDoEditor(page)).toEqual(CODIGO_LINHAS);

    await page.getByRole('button', { name: 'Próximo' }).click();
    await expect(page.getByText(q2.title)).toBeVisible();

    await page.getByRole('button', { name: 'Anterior' }).click();
    await expect(page.getByText(q1.title)).toBeVisible();

    expect(await linhasDoEditor(page)).toEqual(CODIGO_LINHAS);
    await expect(page.getByLabel('Linguagem do código')).toHaveValue('python');

    await page.getByRole('button', { name: 'Próximo' }).click();
    await expect(page.getByText(q2.title)).toBeVisible();
    await page.locator('[contenteditable="true"].rich-text-content').click();
    await page.keyboard.type('Variavel e um espaco na memoria que guarda um valor.');

    await page.getByRole('button', { name: 'Próximo' }).click();
    await expect(page.getByRole('heading', { name: 'Revisão das Respostas' })).toBeVisible();

    const blocoRevisao = page.locator('pre code', { hasText: 'print(nome)' }).first();
    await expect(blocoRevisao).toBeVisible();
    await expect(blocoRevisao).toHaveAttribute('class', /language-python/);
    await expect(blocoRevisao).toContainText('numero = 42');

    await page.getByRole('button', { name: 'Enviar Resposta' }).click();
    await expect(page.getByRole('heading', { name: 'Resposta Enviada com Sucesso!' })).toBeVisible({ timeout: 15000 });

    const profToken = await profLogin(request, profEmail, profPassword);
    const lista = await api(request, 'get', `/atividades/${atvId}/respostas`, profToken);
    expect(lista.ok()).toBeTruthy();
    const rows = await lista.json();
    expect(Array.isArray(rows)).toBeTruthy();
    expect(rows.length).toBeGreaterThan(0);

    const bruto = rows[0].respostas;
    const mapa: Record<string, string> = typeof bruto === 'string' ? JSON.parse(bruto) : bruto;
    const textoQ1 = String(mapa['0'] ?? mapa[0] ?? '');
    expect(textoQ1).toContain('<pre><code class="language-python">');
    expect(textoQ1).toContain('numero = 42');
    expect(textoQ1).toContain('nome = &quot;Ana&quot;');
    expect(textoQ1).toContain('print(nome)');
  });
});
