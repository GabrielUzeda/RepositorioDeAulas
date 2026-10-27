import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createCurso, createMateria, createProfessor, setupAdminContext, cleanupEntities, loginViaUI, E2E_BACKEND_URL } from '../helpers';

const fixtureDir = process.env.PLAYWRIGHT_CONTAINER ? '/fixtures' : resolve(__dirname, '../../backend/eval/referencias');
const markdown = readFileSync(resolve(fixtureDir, 'subconsultas-modular.md'), 'utf8');
const format = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v);

async function activate(page: Page, widget: Locator) {
  const index = await widget.evaluate(el => Number((el.closest('.slide') as HTMLElement).dataset.slide));
  await page.evaluate(index => {
    if ((window as any).marpNext) (window as any).marpNext.goTo(index);
    else window.location.hash = '#slide-' + (index + 1);
  }, index);
  await expect(widget.locator('xpath=ancestor::section')).toHaveClass(/active/);
}

async function checkCatalogue(page: Page, root: Locator) {
  const widgets = root.locator('[data-slide-widget]');
  await expect(widgets).toHaveCount(19);
  for (let i = 0; i < 19; i++) {
    const widget = widgets.nth(i);
    await activate(page, widget);
    const config = JSON.parse((await widget.getAttribute('data-widget-config'))!);
    if (config.type === 'compare') {
      for (let s = 0; s < config.states.length; s++) {
        await widget.getByRole('button', { name: config.states[s].label, exact: true }).click();
        await expect(widget.locator('.slide-widget-state').nth(s)).toBeVisible();
        if (config.states[s].value !== undefined) await expect(widget.locator('.slide-widget-state').nth(s).locator('output')).toHaveText(format(config.states[s].value));
      }
      if (config.collapse) {
        await widget.getByRole('button', { name: config.states.at(-1).label, exact: true }).click();
        await expect(widget.locator('.slide-widget-state:visible')).toHaveCount(0);
      }
    } else if (config.type === 'steps') {
      for (let s = 1; s < config.states.length; s++) {
        await widget.getByRole('button', { name: 'Próximo', exact: true }).click();
        await expect(widget.locator('.slide-widget-state').nth(s)).toBeVisible();
      }
      await widget.getByRole('button', { name: 'Reiniciar', exact: true }).click();
      await expect(widget.locator('.slide-widget-state').first()).toBeVisible();
      await widget.getByRole('button', { name: 'Reproduzir', exact: true }).click();
      await expect(widget.locator('.slide-widget-state').nth(1)).toBeVisible();
      if (config.states.length > 2) await widget.getByRole('button', { name: 'Pausar', exact: true }).click();
    } else if (config.type === 'bars') {
      const sum = config.values.reduce((a: number, b: number) => a + b, 0);
      const aggregates: Record<string, number> = { AVG: sum / config.values.length, MAX: Math.max(...config.values), MIN: Math.min(...config.values), SUM: sum, COUNT: config.values.length };
      for (const reference of config.references) {
        await widget.getByRole('button', { name: String(reference), exact: true }).click();
        await expect(widget.locator('output')).toHaveText(format(typeof reference === 'number' ? reference : aggregates[reference]));
      }
      if (config.operators) {
        for (const op of config.operators) {
          await widget.getByRole('button', { name: op, exact: true }).click();
          await expect(widget.getByRole('button', { name: op, exact: true })).toHaveAttribute('aria-pressed', 'true');
        }
      }
      if (config.extra) {
        await widget.getByRole('button', { name: '+ ' + config.extra.label, exact: true }).click();
        await expect(widget.locator('.slide-widget-bar')).toHaveCount(4);
        await expect(widget.locator('output')).toHaveText('182,5');
        await expect(widget.locator('.slide-widget-baseline')).toBeVisible();
        await widget.getByRole('button', { name: 'Remover ' + config.extra.label, exact: true }).click();
        await expect(widget.locator('.slide-widget-bar')).toHaveCount(3);
      }
      await widget.getByRole('button', { name: 'Reiniciar', exact: true }).click();
    } else if (config.type === 'scan') {
      if (config.variants) {
        await widget.getByRole('button', { name: 'EXISTS', exact: true }).click();
        await widget.getByRole('button', { name: 'Próximo', exact: true }).click();
        await expect(widget.locator('.slide-widget-live [data-row].is-muted')).toHaveCount(1);
        await expect(widget.locator('output')).toHaveText('1');
        await widget.getByRole('button', { name: 'COUNT', exact: true }).click();
      }
      for (let s = 0; s < config.rows.length; s++) await widget.getByRole('button', { name: 'Próximo', exact: true }).click();
      await expect(widget.locator('output')).toHaveText(String(config.rows.length));
      await expect(widget.locator('.slide-widget-progress')).toHaveText(config.rows.length + ' / ' + config.rows.length);
      await widget.getByRole('button', { name: 'Reiniciar', exact: true }).click();
      await widget.getByRole('button', { name: 'Reproduzir', exact: true }).click();
      if (!config.variants) await widget.getByRole('button', { name: 'Pausar', exact: true }).click();
    } else if (config.type === 'group') {
      for (let s = 0; s < config.items.length; s++) await widget.getByRole('button', { name: 'Próximo', exact: true }).click();
      await expect(widget.locator('.slide-widget-group .slide-widget-chip')).toHaveCount(3);
      await expect(widget.locator('.slide-widget-group output').first()).toHaveText('230');
      await expect(widget.locator('.slide-widget-group output').nth(1)).toHaveText('200');
      await widget.getByRole('button', { name: 'Reiniciar', exact: true }).click();
      await expect(widget.locator('.slide-widget-pool .slide-widget-chip')).toHaveCount(3);
      await widget.getByRole('button', { name: 'Reproduzir', exact: true }).click();
      expect(await widget.evaluate(el => el.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
      await widget.getByRole('button', { name: 'Pausar', exact: true }).click();
    } else if (config.type === 'reference') {
      const term = widget.locator('[data-term]').first();
      await term.focus();
      await expect(root.locator('.slide-widget-tooltip:visible')).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(root.locator('.slide-widget-tooltip:visible')).toHaveCount(0);
    }
  }
  const globalTerm = root.locator('.slide-content pre code .slide-widget-term').filter({ hasText: 'pedidos' });
  const targetIndex = await globalTerm.evaluateAll(terms => terms.findIndex(term => !term.closest('.slide-widget')));
  expect(targetIndex).toBeGreaterThanOrEqual(0);
  const target = globalTerm.nth(targetIndex);
  await activate(page, target);
  await page.mouse.move(0, 0);
  await target.focus();
  await expect(root.locator('.slide-widget-tooltip:visible')).toHaveCount(1);
  await expect(root.locator('.slide-widget-tooltip:visible')).toContainText('id_cliente');
  await page.keyboard.press('Escape');
}

test.describe('Catálogo completo — exemplo modularizado', () => {
  let adminToken: string, email: string, password: string, cursoNome: string, materiaNome: string;
  let cursoId: number, professorId: number;

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
    const professor = await createProfessor(request, adminToken);
    ({ email, password } = professor); professorId = professor.id;
    const curso = await createCurso(request, adminToken, [professorId]);
    cursoId = curso.id; cursoNome = curso.nome;
    materiaNome = (await createMateria(request, adminToken, cursoId)).nome;
  });
  test.afterAll(async ({ request }) => { if (adminToken) await cleanupEntities(request, adminToken, cursoId, professorId); });

  test('19 componentes no standalone, animações, teclado e snapshots de impressão', async ({ page, request }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    const response = await request.post(E2E_BACKEND_URL + '/marp/render', { headers: { Authorization: 'Bearer ' + adminToken }, data: { titulo: 'Catálogo', markdown } });
    expect(response.ok()).toBeTruthy();
    await page.route('https://**/*', route => route.abort());
    await page.setContent((await response.json()).html);
    await checkCatalogue(page, page.locator('body'));
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeprint'));
      window.dispatchEvent(new Event('beforeprint'));
    });
    await expect(page.locator('.slide-widget-print:visible')).toHaveCount(10);
    expect(await page.locator('details.gab').evaluateAll(details => details.every(d => (d as HTMLDetailsElement).open))).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.locator('details.gab[open]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('outline distingue seleção, resultados e varredura nos três temas', async ({ page, request }, testInfo) => {
    page.setDefaultTimeout(5000);
    const response = await request.post(E2E_BACKEND_URL + '/marp/render', { headers: { Authorization: 'Bearer ' + adminToken }, data: { titulo: 'Estilo dos interativos', markdown } });
    expect(response.ok()).toBeTruthy();
    await page.route('https://**/*', route => route.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setContent((await response.json()).html);
    const appearance = (locator: Locator) => locator.evaluate(el => {
      const css = getComputedStyle(el);
      const context = document.createElement('canvas').getContext('2d')!;
      context.fillStyle = getComputedStyle(el.closest('.slide-widget')!).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      context.fillStyle = css.backgroundColor;
      context.fillRect(0, 0, 1, 1);
      const luminance = (rgb: Uint8ClampedArray) => [...rgb].slice(0, 3).map(n => {
        const c = n / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
      const background = luminance(context.getImageData(0, 0, 1, 1).data);
      context.fillStyle = css.color;
      context.fillRect(0, 0, 1, 1);
      const foreground = luminance(context.getImageData(0, 0, 1, 1).data);
      return { background: css.backgroundColor, border: css.borderTopColor, outline: css.outlineColor, outlineStyle: css.outlineStyle, shadow: css.boxShadow, weight: css.fontWeight, padding: css.padding, fontSize: css.fontSize, opacity: css.opacity, contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) };
    });
    for (const theme of ['default', 'light', 'dark']) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      const bars = page.locator('[data-slide-widget="bars"]').filter({ has: page.getByRole('button', { name: 'MAX', exact: true }) }).filter({ has: page.locator('[data-operator]') }).first();
      await activate(page, bars);
      await bars.getByRole('button', { name: 'Reiniciar', exact: true }).click();
      await page.mouse.move(0, 0);
      const inactiveButton = bars.getByRole('button', { name: 'MAX', exact: true });
      const inactive = await appearance(inactiveButton);
      const selected = await appearance(bars.getByRole('button', { name: 'AVG', exact: true }));
      expect(inactive.background).toBe('rgba(0, 0, 0, 0)');
      expect(selected.background).not.toBe(inactive.background);
      expect(selected.border).not.toBe(inactive.border);
      expect(selected.shadow).not.toBe('none');
      expect(selected.weight).toBe('700');
      expect(inactive.contrast).toBeGreaterThanOrEqual(4.5);
      expect(selected.contrast).toBeGreaterThanOrEqual(4.5);
      await page.keyboard.press('Tab');
      await inactiveButton.focus();
      expect((await appearance(inactiveButton)).outlineStyle).toBe('solid');
      await page.keyboard.press('Space');
      await expect(inactiveButton).toHaveAttribute('aria-pressed', 'true');
      await bars.getByRole('button', { name: 'AVG', exact: true }).click();
      const match = await appearance(bars.locator('.slide-widget-bar.is-match').first());
      const neutral = await appearance(bars.locator('.slide-widget-bar:not(.is-match)').first());
      const reference = await appearance(bars.locator('.slide-widget-threshold'));
      expect(match.border).not.toBe(neutral.border);
      expect(match.border).not.toBe(reference.border);
      await page.screenshot({ path: testInfo.outputPath(theme + '-barras.png') });

      const scan = page.locator('[data-slide-widget="scan"]').first();
      await activate(page, scan);
      await scan.getByRole('button', { name: 'Reiniciar', exact: true }).click();
      await scan.getByRole('button', { name: 'Próximo', exact: true }).click();
      const scanning = await appearance(scan.locator('.is-scan'));
      expect(scanning.outline).not.toBe(scanning.border);
      expect(scanning.contrast).toBeGreaterThanOrEqual(4.5);

      const group = page.locator('[data-slide-widget="group"]');
      await activate(page, group);
      await group.getByRole('button', { name: 'Reiniciar', exact: true }).click();
      const groups = group.locator('.slide-widget-group');
      expect((await appearance(groups.nth(0))).border).not.toBe((await appearance(groups.nth(1))).border);
      await group.getByRole('button', { name: 'Próximo', exact: true }).click();
      await page.screenshot({ path: testInfo.outputPath(theme + '-grupos.png') });

      const referenceWidget = page.locator('[data-slide-widget="reference"]');
      await activate(page, referenceWidget);
      const term = referenceWidget.locator('.slide-widget-term').first();
      expect((await appearance(term)).padding).toBe('0px');
      expect((await appearance(term)).fontSize).toBe(await term.evaluate(el => getComputedStyle(el.closest('code')!).fontSize));
    }
  });

  test('mesmos 19 componentes na prévia, movimento reduzido e descarte ao editar', async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await loginViaUI(page, email, password, /\/professor/);
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await page.getByRole('button', { name: /Nova Aula/ }).click();
    const editor = page.getByPlaceholder('Digite seu código Marp Markdown aqui...');
    await editor.fill(markdown);
    await checkCatalogue(page, page.locator('#preview-pane'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const group = page.locator('#preview-pane [data-slide-widget="group"]');
    await activate(page, group);
    await group.getByRole('button', { name: 'Reiniciar', exact: true }).click();
    await group.getByRole('button', { name: 'Próximo', exact: true }).click();
    expect(await group.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
    await group.getByRole('button', { name: 'Reproduzir', exact: true }).click();
    await editor.fill(markdown + '\n');
    await expect(group.locator('.slide-widget-pool .slide-widget-chip')).toHaveCount(3);
    await page.waitForTimeout(1100);
    await expect(group.locator('.slide-widget-pool .slide-widget-chip')).toHaveCount(3);
    expect(errors).toEqual([]);
  });
});
