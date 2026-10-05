import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
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

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const ENUNCIADO_MALICIOSO =
  '<p>Enunciado seguro com <strong>negrito</strong>:</p>' +
  '<script>alert("enunciado-xss")</script>' +
  '<img src=x onerror="alert(\'img-xss\')">' +
  '<a href="javascript:alert(\'link-xss\')">link perigoso</a>' +
  '<pre><code>if (a &lt; b) { console.log("ok"); }</code></pre>';

const RESPOSTA_MALICIOSA =
  '<p>Resposta do aluno com <strong>negrito</strong></p>' +
  '<script>alert("resposta-xss")</script>' +
  '<img src=x onerror="alert(\'resposta-img-xss\')">' +
  '<pre><code>while (x &gt; 0) { x--; }</code></pre>';

test.describe('Sanitização de conteúdo não confiável no navegador (allowlist real)', () => {
  let adminToken: string;
  let profEmail: string;
  let profPassword: string;
  let professorId: number;
  let cursoId: number;
  let cursoNome: string;
  let materiaNome: string;
  let atvTitulo: string;
  let atividadeId: number;

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
    materiaNome = materia.nome;

    atvTitulo = `Atividade Sanitização ${uniqueName('E2E')}`;

    const atv = await request.post(`${E2E_BACKEND_URL}/atividades`, {
      headers: authHeaders(profToken),
      data: {
        materia_id: materia.id,
        titulo: atvTitulo,
        tipo: 'normal',
        descricao: 'Atividade para validar sanitização no navegador.',
        allow_password: false,
        slug: uniqueName('atv'),
        json_data: JSON.stringify({
          questions: [
            {
              id: 'q1',
              title: 'Q1 — Sanitização',
              content: ENUNCIADO_MALICIOSO,
              options: [
                { text: 'Alternativa segura', correct: true },
                { text: 'Alternativa incorreta', correct: false }
              ]
            }
          ]
        })
      }
    });
    expect([200, 201]).toContain(atv.status());
    atividadeId = Number((await atv.json()).id);
    expect(atividadeId).toBeGreaterThan(0);
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) await cleanupEntities(request, adminToken, cursoId, professorId);
  });

  test('aluno: script, img com onerror e href javascript: neutralizados; formatação permitida permanece', async ({ page }) => {
    const dialogosDisparados: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogosDisparados.push(dialog.message());
      await dialog.dismiss();
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Selecione seu Curso' })).toBeVisible();
    await page.locator('h3', { hasText: cursoNome }).click();
    await expect(page.locator('h3', { hasText: materiaNome })).toBeVisible({ timeout: 15000 });
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.locator('h3', { hasText: materiaNome })).toBeVisible({ timeout: 15000 });

    await page.getByRole('tab', { name: /Atividades/ }).click();
    await page.locator('h3', { hasText: atvTitulo }).click();

    const modal = page.getByRole('dialog');
    await modal.getByLabel('Seu Nome *').fill('Aluno Sanitização');
    await modal.getByLabel('Seu E-mail *').fill('aluno.sanitizacao@local');
    await modal.getByRole('button', { name: 'Próximo' }).click();

    const enunciado = modal.locator('.rich-content').first();
    await expect(enunciado).toBeVisible();

    // Formatação permitida sobrevive (HTML renderizado, nunca tags literais)
    await expect(enunciado).toContainText('Enunciado seguro com');
    await expect(enunciado.locator('strong')).toHaveText('negrito');
    await expect(enunciado.locator('pre code')).toContainText('console.log("ok");');
    await expect(modal.getByText('&lt;p&gt;Enunciado seguro')).toHaveCount(0);

    // Conteúdo perigoso não existe no DOM
    await expect(enunciado.locator('script')).toHaveCount(0);
    await expect(enunciado.locator('img')).toHaveCount(0);
    await expect(enunciado.locator('a')).toHaveCount(0);
    await expect(modal.locator('script')).toHaveCount(0);
    await expect(modal.locator('img')).toHaveCount(0);

    // O link perigoso perdeu a tag; o texto continua legível
    await expect(enunciado).toContainText('link perigoso');

    // Nada executou: nem o conteúdo do script permanece
    await expect(modal.getByText('enunciado-xss')).toHaveCount(0);
    await expect(modal.getByText('img-xss')).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(dialogosDisparados).toEqual([]);
  });

  test('professor: resposta maliciosa do aluno é neutralizada no RespostasModal', async ({ page, request }) => {
    const submissao = await request.post(`${E2E_BACKEND_URL}/atividades/${atividadeId}/respostas`, {
      data: {
        aluno_nome: 'Aluno Malicioso',
        aluno_email: 'aluno.malicioso@local',
        respostas: { q1: RESPOSTA_MALICIOSA }
      }
    });
    expect(submissao.status()).toBe(201);

    const dialogosDisparados: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogosDisparados.push(dialog.message());
      await dialog.dismiss();
    });

    await page.goto('/login');
    await page.getByPlaceholder('professor@escola.edu').fill(profEmail);
    await page.getByPlaceholder('••••••••').fill(profPassword);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/professor/);
    await expect(page.getByRole('heading', { name: 'Painel do Professor' })).toBeVisible();

    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.getByRole('heading', { name: materiaNome })).toBeVisible();

    await page.getByRole('button', { name: /Respostas/i }).click();
    const modalRespostas = page.getByRole('dialog');
    await expect(page.getByText(/Total de Envios: \d+/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Respostas Submetidas:')).toBeVisible({ timeout: 10000 });

    const respostaRenderizada = modalRespostas.locator('[class*="[&_pre]"]').first();
    await expect(respostaRenderizada).toContainText('Resposta do aluno com');
    await expect(respostaRenderizada.locator('strong')).toHaveText('negrito');
    await expect(respostaRenderizada.locator('pre code')).toContainText('while (x > 0)');

    await expect(respostaRenderizada.locator('script')).toHaveCount(0);
    await expect(respostaRenderizada.locator('img')).toHaveCount(0);
    await expect(modalRespostas.getByText('resposta-xss')).toHaveCount(0);
    await expect(modalRespostas.getByText('resposta-img-xss')).toHaveCount(0);

    await page.waitForTimeout(300);
    expect(dialogosDisparados).toEqual([]);
  });
});
