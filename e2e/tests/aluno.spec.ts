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
    const cursoSenha = 'curso123';
    const curso = await createCurso(request, adminToken, [professorId], { senha: cursoSenha });
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

  test('aluno anônimo navega, desbloqueia curso com senha, vê aula e responde atividade', async ({ page, context }) => {
    // --- HOME: lista cursos ---
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Selecione seu Curso' })).toBeVisible();
    await expect(page.locator('h3', { hasText: cursoNome })).toBeVisible();

    // --- Seleciona curso com senha → modal de senha ---
    await page.locator('h3', { hasText: cursoNome }).click();
    await expect(page.getByText('Acesso Restrito')).toBeVisible();

    // --- Senha errada mostra alerta/erro e continua no modal ---
    await page.getByPlaceholder('Digite a senha').fill('senha-errada');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('Senha do curso incorreta!')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Acesso Restrito')).toBeVisible();

    // --- Senha correta desbloqueia e entra na lista de disciplinas ---
    await page.getByPlaceholder('Digite a senha').fill('curso123');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('Acesso Restrito')).toBeHidden();
    await expect(page.locator('h3', { hasText: materiaNome })).toBeVisible({ timeout: 15000 });

    // --- Seleciona disciplina e entra no conteúdo ---
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.locator('h3', { hasText: aulaTitulo })).toBeVisible({ timeout: 15000 });

    // --- Aba Aulas: card da aula aparece e abre em nova aba (slides Marp) ---
    await expect(page.locator('h3', { hasText: aulaTitulo })).toBeVisible();
    const popupPromise = context.waitForEvent('page');
    await page.locator('h3', { hasText: aulaTitulo }).click();
    const aulaPage = await popupPromise;
    await aulaPage.waitForLoadState('domcontentloaded');
    expect(aulaPage.url()).toContain('/materias/');
    await aulaPage.close();

    // --- Aba Atividades: abre a atividade e responde ---
    await page.getByRole('tab', { name: /Atividades/ }).click();
    await expect(page.locator('h3', { hasText: atvTitulo })).toBeVisible();
    await page.locator('h3', { hasText: atvTitulo }).click();

    // Passo 0: Identificação
    await page.getByLabel('Seu Nome *').fill('Aluno E2E');
    await page.getByLabel('Seu E-mail *').fill('aluno.e2e@local');
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Passo 1: Pergunta
    await expect(page.getByText('Qual é a capital do Brasil?')).toBeVisible();
    await page.getByRole('button', { name: 'Brasília' }).click();
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Passo 2: Revisão e Envio
    await expect(page.getByText('Revisão das Respostas')).toBeVisible();
    await page.getByRole('button', { name: 'Enviar Resposta' }).click();
    await expect(page.getByRole('heading', { name: 'Resposta Enviada com Sucesso!' })).toBeVisible({ timeout: 10000 });
  });
});
