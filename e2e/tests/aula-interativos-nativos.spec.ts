import { test, expect } from '@playwright/test';
import { createCurso, createMateria, createProfessor, setupAdminContext, cleanupEntities, loginViaUI, E2E_BACKEND_URL } from '../helpers';

const states = [
  { label: 'Sem COALESCE', text: 'Carla: NULL', code: 'SELECT NULL;', value: 0 },
  { label: 'Com COALESCE', text: 'Carla: 0', code: 'SELECT COALESCE(NULL, 0);', value: 1 },
];
const widget = (type: string) => '```interactive\n' + JSON.stringify({ type, title: 'Resultado de Carla', states }) + '\n```';
const markdown = '---\ntitle: Componentes nativos\n---\n\n## Comparar\n\n' + widget('compare') + '\n\n---\n\n## Executar\n\n' + widget('steps');

test.describe('Aulas — interativos nativos', () => {
  let adminToken: string;
  let professorId: number;
  let cursoId: number;
  let cursoNome: string;
  let materiaNome: string;
  let email: string;
  let password: string;

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
    const professor = await createProfessor(request, adminToken);
    professorId = professor.id;
    email = professor.email;
    password = professor.password;
    const curso = await createCurso(request, adminToken, [professorId]);
    cursoId = curso.id;
    cursoNome = curso.nome;
    const materia = await createMateria(request, adminToken, cursoId);
    materiaNome = materia.nome;
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) await cleanupEntities(request, adminToken, cursoId, professorId);
  });

  test('standalone funciona sem CDNs, respeita teclado e expõe estados na impressão', async ({ page, request }) => {
    const response = await request.post(E2E_BACKEND_URL + '/marp/render', {
      headers: { Authorization: 'Bearer ' + adminToken },
      data: { titulo: 'Nativos', markdown },
    });
    expect(response.ok()).toBeTruthy();
    const { html } = await response.json();
    await page.route('https://**/*', route => route.abort());
    await page.setContent(html);
    const compare = page.locator('[data-slide-widget="compare"]');
    await expect(compare.getByText('Carla: NULL', { exact: true })).toBeVisible();
    await compare.getByRole('button', { name: 'Com COALESCE', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(compare.getByText('Carla: 0', { exact: true })).toBeVisible();
    await expect(page.locator('.slide.active')).toHaveAttribute('id', 'slide-1');
    await expect(compare.getByRole('button', { name: 'Com COALESCE', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.locator('h2').first().click();
    await page.keyboard.press('ArrowRight');
    const steps = page.locator('[data-slide-widget="steps"]');
    await expect(steps.getByRole('button', { name: 'Anterior', exact: true })).toBeDisabled();
    const initialCounter = await steps.evaluate(el => {
      el.querySelector<HTMLButtonElement>('[data-widget-next]')!.click();
      return el.querySelector('.slide-widget-state:not([hidden]) output')?.textContent;
    });
    expect(initialCounter).toBe('0');
    await expect(steps.locator('.slide-widget-state').nth(1).locator('output')).toHaveText('1');
    await expect(steps.getByText('Carla: 0', { exact: true })).toBeVisible();
    await expect(steps.getByRole('button', { name: 'Próximo', exact: true })).toBeDisabled();
    await steps.getByRole('button', { name: 'Reiniciar', exact: true }).click();
    await expect(steps.getByText('Carla: NULL', { exact: true })).toBeVisible();
    await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });
    await expect(steps.getByText('Carla: 0', { exact: true })).toBeVisible();
    await expect(steps.getByRole('button', { name: 'Próximo', exact: true })).toBeHidden();
  });

  test('prévia usa o mesmo componente e não duplica handlers ao editar', async ({ page }) => {
    await loginViaUI(page, email, password, /\/professor/);
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await page.getByRole('button', { name: /Nova Aula/ }).click();
    const editor = page.getByPlaceholder('Digite seu código Marp Markdown aqui...');
    await editor.fill(markdown);
    const compare = page.locator('#preview-pane [data-slide-widget="compare"]');
    await compare.getByRole('button', { name: 'Com COALESCE', exact: true }).click();
    await expect(compare.getByText('Carla: 0', { exact: true })).toBeVisible();
    await editor.fill(markdown + '\n');
    await expect(compare.getByText('Carla: NULL', { exact: true })).toBeVisible();
    await compare.getByRole('button', { name: 'Com COALESCE', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(compare.getByText('Carla: 0', { exact: true })).toBeVisible();
    await expect(page.locator('#preview-pane .slide.active h2')).toHaveText('Comparar');
    await page.evaluate(() => (window as any).marpNext.goTo(1));
    const steps = page.locator('#preview-pane [data-slide-widget="steps"]');
    await steps.getByRole('button', { name: 'Próximo', exact: true }).click();
    await expect(steps.getByText('Carla: 0', { exact: true })).toBeVisible();
    await expect(steps.locator('.slide-widget-progress')).toHaveText('2 / 2');
  });
});
