import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const input = resolve(process.argv[2] ?? '../backend/eval/output/subconsultas-modular/aula.html');
const output = resolve(process.argv[3] ?? dirname(input));
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(10000);
const report = { input, viewport: '1280x720', errors: [], widgets: [], ok: false };
page.on('pageerror', error => report.errors.push(error.message));
await page.route('https://**/*', route => route.abort());
const format = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
const waitText = async (locator, expected) => {
  await page.waitForFunction(({ selector, expected }) => [...document.querySelectorAll(selector)].some(el => el.textContent === expected), { selector: await locator.evaluate(el => {
    el.dataset.probe = 'true'; return '[data-probe="true"]';
  }), expected });
  assert.equal(await locator.textContent(), expected);
  await locator.evaluate(el => { delete el.dataset.probe; });
};
try {
  await page.setContent(readFileSync(input, 'utf8'));
  const widgets = page.locator('[data-slide-widget]');
  assert((await widgets.count()) > 0, 'Nenhum interativo nativo.');
  for (let i = 0; i < await widgets.count(); i++) {
    const widget = widgets.nth(i), config = JSON.parse(await widget.getAttribute('data-widget-config'));
    assert(['steps', 'compare', 'bars', 'scan', 'group', 'reference'].includes(config.type));
    const index = await widget.evaluate(el => Number(el.closest('.slide').dataset.slide));
    await page.evaluate(i => { window.location.hash = '#slide-' + (i + 1); }, index);
    await page.waitForFunction(i => document.querySelectorAll('.slide')[i].classList.contains('active'), index);
    const entry = { type: config.type, title: config.title, interaction: false, layouts: [] };
    const measure = async () => {
      await page.waitForFunction(() => [...document.querySelectorAll('.slide.active .slide-content > *')].every(el => getComputedStyle(el).opacity === '1'));
      entry.layouts.push(await widget.evaluate(el => {
        const s = el.closest('.slide').getBoundingClientRect(), c = el.closest('.slide-content').getBoundingClientRect();
        return { top: c.top, bottom: c.bottom, fits: c.top >= s.top && c.bottom <= s.bottom - 25 };
      }));
    };
    const button = name => widget.getByRole('button', { name, exact: true });
    if (config.type === 'steps' || config.type === 'compare') {
      for (let s = 0; s < config.states.length; s++) {
        if (config.type === 'compare') await button(config.states[s].label).click();
        else if (s > 0) await button('Próximo').click();
        assert(await widget.locator('.slide-widget-state').nth(s).isVisible());
        if (config.states[s].value !== undefined) await waitText(widget.locator('.slide-widget-state').nth(s).locator('output'), format(config.states[s].value));
        await measure();
      }
    } else if (config.type === 'bars') {
      const values = config.values, sum = values.reduce((a, b) => a + b, 0);
      const aggregates = { AVG: sum / values.length, MAX: Math.max(...values), MIN: Math.min(...values), SUM: sum, COUNT: values.length };
      for (const ref of config.references ?? ['AVG', 'MAX', 'MIN', 'SUM', 'COUNT']) {
        await button(String(ref)).click();
        await waitText(widget.locator('output'), format(typeof ref === 'number' ? ref : aggregates[ref]));
      }
      if (config.extra) {
        await button('+ ' + config.extra.label).click();
        assert.equal(await widget.locator('.slide-widget-bar').count(), values.length + 1);
        assert(await widget.locator('.slide-widget-baseline').isVisible());
      }
      await measure();
    } else if (config.type === 'scan') {
      for (const variant of config.variants ?? [{ label: '', stopAtMatch: false }]) {
        if (variant.label) await button(variant.label).click();
        else await button('Reiniciar').click();
        const first = config.rows.findIndex(row => row.match);
        const visits = variant.stopAtMatch && first >= 0 ? first + 1 : config.rows.length;
        for (let s = 0; s < visits; s++) await button('Próximo').click();
        await waitText(widget.locator('output'), String(visits));
        if (visits < config.rows.length) assert.equal(await widget.locator('.slide-widget-live .is-muted').count(), config.rows.length - visits);
      }
      await measure();
    } else if (config.type === 'group') {
      for (const item of config.items) { assert(item.group); await button('Próximo').click(); }
      for (const [index, name] of [...new Set(config.items.map(item => item.group))].entries()) {
        const total = config.items.filter(item => item.group === name).reduce((sum, item) => sum + item.value, 0);
        await waitText(widget.locator('.slide-widget-group output').nth(index), format(total));
      }
      assert.equal(await widget.locator('.slide-widget-pool .slide-widget-chip').count(), 0);
      await measure();
    } else if (config.type === 'reference') {
      const term = widget.locator('[data-term]').first();
      await term.focus();
      assert(await page.locator('.slide-widget-tooltip:visible').isVisible());
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.slide-widget-tooltip:visible').count(), 0);
      await measure();
    }
    entry.interaction = true;
    await page.screenshot({ path: join(output, 'componente-' + i + '-' + config.type + '.png') });
    report.widgets.push(entry);
  }
  report.ok = !report.errors.length && report.widgets.every(widget => widget.interaction && widget.layouts.every(layout => layout.fits));
} catch (error) {
  report.errors.push(error.message);
} finally {
  await browser.close();
  writeFileSync(join(output, 'verificacao-browser.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ ok: report.ok, components: report.widgets.length, errors: report.errors, overflow: report.widgets.filter(w => w.layouts.some(l => !l.fits)).map(w => w.title) }, null, 2));
if (!report.ok) process.exitCode = 1;
