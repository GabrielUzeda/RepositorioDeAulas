import { test, expect, Page, APIRequestContext } from '@playwright/test';
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
  const body = await res.json();
  return body.token as string;
}

async function api(request: APIRequestContext, method: 'post' | 'put' | 'delete', path: string, token: string, data?: any) {
  const res = await request[method](`${E2E_BACKEND_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data
  });
  return res;
}

test.describe('Aluno — fluxo completo (curso → materia → senha → aulas/atividades)', () => {
  let adminToken: string;
  let professorId: number;
  let cursoId: number;
  let materiaId: number;
  let materiaSenha: string;
  let cursoNome: string;
  let materiaNome: string;
  let aulaTitulo: string;
  let atvTitulo: string;

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
    const prof = await createProfessor(request, adminToken);
    professorId = prof.id;
    const profToken = await profLogin(request, prof.email, prof.password);
    const curso = await createCurso(request, adminToken, [professorId]);
    cursoId = curso.id;
    cursoNome = curso.nome;
    const materia = await createMateria(request, profToken, cursoId);
    materiaId = materia.id;
    materiaSenha = materia.senha;
    materiaNome = materia.nome;

    const aula = await api(request, 'post', '/aulas', profToken, {
      materia_id: materiaId,
      titulo: `Aula ${uniqueName('ALUNO')}`,
      markdown: '# Slide 1\n\nConteudo do slide E2E.\n\n---\n\n# Slide 2'
    });
    expect([200, 201]).toContain(aula.status());
    aulaTitulo = (await aula.json()).titulo;

    const atv = await api(request, 'post', '/atividades', profToken, {
      materia_id: materiaId,
      titulo: `Atividade ${uniqueName('ALUNO')}`,
      tipo: 'normal',
      allow_password: false,
      slug: uniqueName('atv'),
      json_data: JSON.stringify({
        questions: [
          {
            title: 'Questão 1',
            content: 'Qual é a capital do Brasil?',
            options: [
              { text: 'Brasília', correct: true, feedback: 'Correto!' },
              { text: 'Rio de Janeiro', correct: false, feedback: 'Tente de novo.' }
            ]
          }
        ]
      })
    });
    expect([200, 201]).toContain(atv.status());
    atvTitulo = (await atv.json()).titulo;
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) {
      await cleanupEntities(request, adminToken, cursoId, professorId);
    }
  });

  test('aluno anônimo navega, desbloqueia com senha, vê aula e responde atividade', async ({ page, context }) => {
    // --- HOME: lista cursos ---
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Área do Aluno' })).toBeVisible();
    await expect(page.locator('h3', { hasText: cursoNome })).toBeVisible();

    // --- Seleciona curso → lista materias ---
    await page.locator('h3', { hasText: cursoNome }).click();
    await expect(page.locator('h3', { hasText: materiaNome })).toBeVisible();

    // --- Seleciona materia → modal de senha ---
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.getByText('Acesso Restrito')).toBeVisible();

    // --- Senha errada mostra alerta e continua no modal ---
    page.on('dialog', (d) => d.accept());
    await page.getByPlaceholder('Digite a senha').fill('senha-errada');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('Acesso Restrito')).toBeVisible();

    // --- Senha correta desbloqueia o conteúdo ---
    await page.getByPlaceholder('Digite a senha').fill(materiaSenha);
    await page.getByRole('button', { name: 'Confirmar' }).click();

    // --- Aba Aulas: card da aula aparece e abre em nova aba (slides Marp) ---
    await expect(page.locator('h3', { hasText: aulaTitulo })).toBeVisible();
    const popupPromise = context.waitForEvent('page');
    await page.locator('h3', { hasText: aulaTitulo }).click();
    const aulaPage = await popupPromise;
    await aulaPage.waitForLoadState('domcontentloaded');
    expect(aulaPage.url()).toContain('/materias/');
    await aulaPage.close();

    // --- Aba Atividades: abre a atividade e responde ---
    await page.getByRole('button', { name: /Atividades/ }).click();
    await expect(page.locator('h3', { hasText: atvTitulo })).toBeVisible();
    await page.locator('h3', { hasText: atvTitulo }).click();
    await expect(page.getByText('Perguntas da Atividade')).toBeVisible();
    await expect(page.getByText('Qual é a capital do Brasil?')).toBeVisible();

    await page.getByLabel('Seu Nome *').fill('Aluno E2E');
    await page.getByLabel('Seu E-mail *').fill('aluno.e2e@local');
    await page.getByLabel('Suas Respostas *').fill('Brasília');
    await page.getByRole('button', { name: 'Enviar Resposta' }).click();
  });
});
