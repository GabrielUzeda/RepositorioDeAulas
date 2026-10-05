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

async function api(request: APIRequestContext, method: 'post' | 'put' | 'delete', path: string, token: string, data?: any) {
  return request[method](`${E2E_BACKEND_URL}${path}`, { headers: { Authorization: `Bearer ${token}` }, data });
}

const CODIGO_JS = 'if (a < b) {\n  console.log("menor");\n}';

const CONTEUDO_RICO =
  '<p>Analise o código a seguir com atenção:</p>' +
  `<pre><code class="language-javascript">if (a &lt; b) {&#10;  console.log(&quot;menor&quot;);&#10;}</code></pre>` +
  '<p>Qual será a <strong>saída</strong> exibida?</p>';

test.describe('Atividade — enunciado com formatação rica e bloco de código', () => {
  let adminToken: string;
  let profEmail: string;
  let profPassword: string;
  let professorId: number;
  let cursoId: number;
  let cursoNome: string;
  let materiaId: number;
  let materiaNome: string;
  let atvTitulo: string;

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

    atvTitulo = `Atividade Rico ${uniqueName('E2E')}`;

    const atv = await api(request, 'post', '/atividades', profToken, {
      materia_id: materiaId,
      titulo: atvTitulo,
      tipo: 'normal',
      descricao: 'Atividade com enunciado formatado.',
      allow_password: false,
      slug: uniqueName('atv'),
      json_data: JSON.stringify({
        questions: [
          {
            title: 'Q1 — Comparação de valores',
            content: CONTEUDO_RICO,
            options: [
              { text: 'menor', correct: true },
              { text: 'maior', correct: false }
            ]
          }
        ]
      })
    });
    expect([200, 201]).toContain(atv.status());
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) await cleanupEntities(request, adminToken, cursoId, professorId);
  });

  test('aluno vê o código em bloco formatado, sem tags literais no enunciado', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Selecione seu Curso' })).toBeVisible();
    await page.locator('h3', { hasText: cursoNome }).click();
    await expect(page.locator('h3', { hasText: materiaNome })).toBeVisible({ timeout: 15000 });
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.locator('h3', { hasText: materiaNome })).toBeVisible({ timeout: 15000 });

    await page.getByRole('tab', { name: /Atividades/ }).click();
    await page.locator('h3', { hasText: atvTitulo }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Seu Nome *').fill('Aluno E2E Rico');
    await dialog.getByLabel('Seu E-mail *').fill('aluno.rico@local');
    await dialog.getByRole('button', { name: 'Próximo' }).click();

    // Texto do enunciado renderizado como HTML (não como tags literais)
    await expect(page.getByText('Analise o código a seguir com atenção:')).toBeVisible();
    await expect(page.getByText('Qual será a saída exibida?')).toBeVisible();
    await expect(page.getByText('<p>', { exact: false })).toHaveCount(0);

    // O código aparece dentro de <pre><code>, preservando as quebras de linha
    const blocoCodigo = dialog.locator('pre code').first();
    await expect(blocoCodigo).toBeVisible();
    await expect(blocoCodigo).toContainText('console.log("menor");');
    await expect(blocoCodigo).toContainText('if (a < b) {');

    // A alternativa correta continua funcional após o clique
    await dialog.getByRole('button', { name: 'menor', exact: true }).click();
  });

  test('professor reabre o editor e o enunciado rico é restaurado no editor de texto', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('professor@escola.edu').fill(profEmail);
    await page.getByPlaceholder('••••••••').fill(profPassword);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/professor/);
    await expect(page.getByRole('heading', { name: 'Painel do Professor' })).toBeVisible();

    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.getByRole('heading', { name: materiaNome })).toBeVisible();

    await page.locator('h4', { hasText: atvTitulo }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]')
      .locator('button[title="Editar Atividade"]').click();
    await expect(page.getByRole('heading', { name: 'Editar Atividade' })).toBeVisible();

    // Seleciona a questão na barra lateral para ativar o painel de edição
    await page.getByText('Analise o código a seguir com atenção:').first().click();

    const editorEnunciado = page.getByPlaceholder('Digite o enunciado completo da questão para o aluno...');
    await expect(editorEnunciado).toContainText('Analise o código a seguir com atenção:');

    // O editor rico preserva o bloco de código, inclusive o conteúdo do trecho
    const preEditor = editorEnunciado.locator('pre').first();
    await expect(preEditor).toBeVisible();
    await expect(preEditor).toContainText('console.log("menor");');
    expect(await preEditor.innerText()).toContain(CODIGO_JS.split('\n')[0]);

    // A prévia do aluno ao lado também renderiza o código formatado
    await expect(page.locator('pre code', { hasText: 'console.log("menor");' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar' }).click();
  });
});
