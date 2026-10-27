import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verificarExemploFiel, estruturaEstatica } from '../verificar-exemplo-fiel.mjs';
import { createCurso, createMateria, createProfessor, setupAdminContext, cleanupEntities, loginViaUI, E2E_BACKEND_URL } from '../helpers';

const fixtureDir = process.env.PLAYWRIGHT_CONTAINER ? '/fixtures' : resolve(__dirname, '../../backend/eval/referencias');
const markdown = readFileSync(process.env.PLAYWRIGHT_CONTAINER ? '/examplo.md' : resolve(__dirname, '../../examplo.md'), 'utf8');
const original = readFileSync(resolve(fixtureDir, 'examplo-original.md'), 'utf8');
const fixture = JSON.parse(readFileSync(resolve(fixtureDir, 'examplo-cenas.json'), 'utf8'));

test.describe('Migração fiel de examplo.md', () => {
  let adminToken: string, professorId: number, cursoId: number;
  let email: string, password: string, cursoNome: string, materiaNome: string;
  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
    const professor = await createProfessor(request, adminToken);
    professorId = professor.id; email = professor.email; password = professor.password;
    const curso = await createCurso(request, adminToken, [professorId]);
    cursoId = curso.id; cursoNome = curso.nome;
    materiaNome = (await createMateria(request, adminToken, cursoId)).nome;
  });
  test.afterAll(async ({ request }) => {
    if (adminToken) await cleanupEntities(request, adminToken, cursoId, professorId);
  });

  test('47 slides, textos, SQL, colunas e 129 quadros iguais ao original no standalone', async ({ page, context, request }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    await page.route('https://**/*', route => route.abort());
    const render = async (md: string) => {
      const response = await request.post(E2E_BACKEND_URL + '/marp/render', {
        headers: { Authorization: 'Bearer ' + adminToken }, data: { titulo: 'Fiel', markdown: md },
      });
      expect(response.ok()).toBeTruthy();
      return (await response.json()).html;
    };
    const baseline = await context.newPage();
    await baseline.route('https://**/*', route => route.abort());
    await baseline.setContent(await render(original));
    const structure = await estruturaEstatica(baseline);
    await baseline.close();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(await render(markdown));
    expect(await estruturaEstatica(page)).toEqual(structure);
    expect(structure).toHaveLength(47);
    const report = await verificarExemploFiel(page, fixture);
    expect(report.states).toBe(129);
    expect(report.overflows).toEqual([]);
    expect(errors).toEqual([]);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('[data-slide-widget="scene"] .slide-widget-live').first()).toBeHidden();
    await expect(page.locator('[data-slide-widget="scene"] .slide-widget-print').first()).toBeVisible();
  });

  test('a aula completa também funciona na prévia e remonta após edição', async ({ page }) => {
    test.setTimeout(120000);
    await loginViaUI(page, email, password, /\/professor/);
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await page.getByRole('button', { name: /Nova Aula/ }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    const editor = page.getByPlaceholder('Digite seu código Marp Markdown aqui...');
    await editor.fill(markdown);
    await page.clock.runFor(1500);
    await expect(page.locator('#preview-pane [data-widget-mounted="true"][data-slide-widget="scene"]')).toHaveCount(18);
    const report = await verificarExemploFiel(page, fixture);
    expect(report.states).toBe(129);
    expect(report.overflows).toEqual([]);
    await editor.fill(markdown + '\n');
    await page.clock.runFor(1500);
    await expect(page.locator('#preview-pane [data-slide-widget="scene"][data-scene-frame="f0"]')).toHaveCount(18);
  });

  test('cenas animam contadores, mantêm foco e suspendem sequência ao navegar', async ({ page, request }) => {
    const scene = { type: 'scene', title: 'Contar', initial: 'a', layout: ['buttons', 'value', 'text'], frames: [
      { id: 'a', value: '0', text: 'Primeiro.', buttons: [{ label: 'Iniciar', to: 'b' }] },
      { id: 'b', value: '100', text: 'Depois.', buttons: [{ label: 'Reiniciar', to: 'a' }], next: { to: 'c', delay: 2000 } },
      { id: 'c', value: '200', text: 'Concluído.', buttons: [{ label: 'Reiniciar', to: 'a' }] },
    ] };
    const response = await request.post(E2E_BACKEND_URL + '/marp/render', {
      headers: { Authorization: 'Bearer ' + adminToken },
      data: { titulo: 'Movimento', markdown: '## Cena\n\n```interactive\n' + JSON.stringify(scene) + '\n```\n\n---\n\n## Outro slide' },
    });
    await page.route('https://**/*', route => route.abort());
    await page.clock.install();
    await page.setContent((await response.json()).html);
    const widget = page.locator('[data-slide-widget="scene"]');
    await page.clock.runFor(1000);
    await widget.getByRole('button', { name: 'Iniciar' }).focus();
    await page.keyboard.press('Space');
    await expect(widget).toHaveAttribute('data-scene-frame', 'b');
    await expect(widget.getByRole('button', { name: 'Reiniciar' })).toBeFocused();
    const initial = await widget.locator('.slide-widget-live output').innerText();
    expect(Number(initial.replace(',', '.'))).toBeLessThan(100);
    await page.clock.runFor(600);
    await expect(widget.locator('.slide-widget-live output')).toHaveText('100');
    await page.evaluate(() => { location.hash = '#slide-2'; });
    await page.clock.runFor(4000);
    await expect(widget).toHaveAttribute('data-scene-frame', 'b');
    await page.evaluate(() => { location.hash = '#slide-1'; });
    await page.clock.runFor(2600);
    await expect(widget).toHaveAttribute('data-scene-frame', 'c');
  });

  test('gráficos preenchem, repetir reanima e montinhos destacam os chips', async ({ page, request }) => {
    const response = await request.post(E2E_BACKEND_URL + '/marp/render', {
      headers: { Authorization: 'Bearer ' + adminToken }, data: { titulo: 'Fiel', markdown },
    });
    await page.route('https://**/*', route => route.abort());
    await page.setContent((await response.json()).html);
    const sample = (slide: number, button: number) => page.evaluate(async ({ slide, button }) => {
      location.hash = '#slide-' + slide;
      await new Promise(resolve => setTimeout(resolve, 150));
      const host = document.querySelector('.slide.active [data-slide-widget="scene"] .slide-widget-live')!;
      host.querySelector<HTMLButtonElement>('[data-scene-button="' + button + '"]')!.click();
      const seen: string[][] = [];
      const collect = () => {
        for (const element of host.querySelectorAll<HTMLElement>('.slide-widget-bar, .slide-widget-row, .slide-widget-chip')) {
          for (const animation of element.getAnimations()) seen.push(Object.keys(Object.assign({}, ...((animation.effect as KeyframeEffect | null)?.getKeyframes() ?? []))));
        }
      };
      for (let i = 0; i < 40; i++) { collect(); await new Promise(resolve => setTimeout(resolve, 60)); }
      return { seen, frame: (host.closest('[data-slide-widget]') as HTMLElement).dataset.sceneFrame, bars: host.querySelectorAll('.slide-widget-bar').length, chips: host.querySelectorAll('.slide-widget-chip').length };
    }, { slide, button });
    const graph = await sample(10, 0);
    expect(graph.seen).toContainEqual(expect.arrayContaining(['height', 'backgroundColor']));
    const replay = await sample(10, 0);
    expect(replay.frame).toBe('f1');
    expect(replay.seen).toContainEqual(expect.arrayContaining(['height', 'backgroundColor']));
    expect((await sample(12, 0)).seen).toContainEqual(expect.arrayContaining(['backgroundColor']));
    const scan = await sample(18, 0);
    expect(scan.seen).toContainEqual(expect.arrayContaining(['backgroundColor']));
    expect(scan.chips).toBe(3);
    const piles = await sample(32, 0);
    expect(piles.chips).toBe(3);
    expect(piles.seen).toContainEqual(expect.arrayContaining(['transform']));
  });

  test('tabela anima células e total compara as duas ordens com cor', async ({ page, request }) => {
    const response = await request.post(E2E_BACKEND_URL + '/marp/render', {
      headers: { Authorization: 'Bearer ' + adminToken }, data: { titulo: 'Fiel', markdown },
    });
    await page.route('https://**/*', route => route.abort());
    await page.setContent((await response.json()).html);
    const go = async (slide: number, button: number) => {
      await page.evaluate(index => { location.hash = '#slide-' + index; }, slide);
      await expect(page.locator('.slide.active')).toHaveAttribute('id', 'slide-' + slide);
      await page.locator('.slide.active [data-scene-button="' + button + '"]').first().click();
    };
    await go(31, 2);
    const cells = page.locator('.slide.active .slide-scene-cells .slide-widget-chip');
    await expect(cells).toHaveCount(6);
    const animated = await cells.first().evaluate(element => element.getAnimations().length + (getComputedStyle(element).animationName !== 'none' ? 1 : 0));
    expect(animated).toBeGreaterThan(0);
    await go(36, 0);
    const total = page.locator('.slide.active .slide-scene-value output').first();
    await expect(total).toHaveText('360');
    await expect(total).toHaveClass(/is-tone-danger/);
    await go(36, 1);
    await expect(total).toHaveClass(/is-tone-success/);
    await expect(total).toHaveText('230');
  });
});
