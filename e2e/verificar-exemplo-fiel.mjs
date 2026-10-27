import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

export async function verificarExemploFiel(page, fixture, screenshots) {
  const widgets = page.locator('[data-slide-widget="scene"]');
  assert.equal(await widgets.count(), 18);
  let states = 0, actions = 0;
  const overflows = [];
  for (const [i, source] of fixture.widgets.entries()) {
    const widget = widgets.nth(i), config = JSON.parse(await widget.getAttribute('data-widget-config'));
    assert.deepEqual({ ...config, frames: undefined }, { ...source.config, frames: undefined });
    const slide = await widget.evaluate(el => Number(el.closest('.slide').dataset.slide));
    await page.evaluate(slide => {
      if (window.marpNext) window.marpNext.goTo(slide);
      else location.hash = '#slide-' + (slide + 1);
    }, slide);
    await page.clock.runFor(800);
    for (const snapshot of source.snapshots) {
      const result = await widget.evaluate((el, id) => {
        const host = el.querySelector('.slide-widget-live');
        host.replaceChildren(el.querySelector('[data-scene-frame="' + id + '"]').content.cloneNode(true));
        const r = host.getBoundingClientRect(), s = el.closest('.slide').getBoundingClientRect();
        return { text: host.innerText.replace(/\s+/g, ' ').trim(), fits: r.top >= s.top && r.bottom <= s.bottom - 20 };
      }, snapshot.id);
      assert.equal(result.text, snapshot.text, source.id + '/' + snapshot.id);
      if (!result.fits) overflows.push(source.id + '/' + snapshot.id);
      states++;
    }
    if (screenshots && [0, 1, 2, 5, 9, 13, 17].includes(i)) await page.screenshot({ path: screenshots + '/widget-' + i + '.png' });
    await widget.evaluate((el, initial) => {
      el.querySelector('.slide-widget-live').replaceChildren(el.querySelector('[data-scene-frame="' + initial + '"]').content.cloneNode(true));
    }, config.initial);
    const slots = config.frames.find(f => f.id === config.initial).buttons.length;
    for (let pass = 0; pass < 3; pass++) for (let b = 0; b < slots; b++) {
      const result = await widget.evaluate((el, b) => {
        const config = JSON.parse(el.dataset.widgetConfig);
        const current = config.frames.find(f => f.id === el.dataset.sceneFrame);
        const action = current.buttons[b];
        if (action.disabled) return null;
        el.querySelector('.slide-widget-live [data-scene-button="' + b + '"]').click();
        return { expected: action.to, actual: el.dataset.sceneFrame, text: el.querySelector('.slide-widget-live').innerText.replace(/\s+/g, ' ').trim() };
      }, b);
      if (!result) continue;
      assert.equal(result.actual, result.expected, source.id + ': botão ' + b);
      assert.equal(result.text, source.snapshots.find(s => s.id === result.expected).text, source.id + ': quadro após clique');
      await page.clock.runFor(8000);
      const final = await widget.evaluate(el => ({ id: el.dataset.sceneFrame, text: el.querySelector('.slide-widget-live').innerText.replace(/\s+/g, ' ').trim() }));
      assert.equal(final.text, source.snapshots.find(s => s.id === final.id).text, source.id + ': sequência');
      actions++;
    }
  }
  return { widgets: 18, states, actions, overflows };
}

export async function estruturaEstatica(page) {
  return page.locator('.slide-content').evaluateAll(contents => contents.map(content => {
    const clone = content.cloneNode(true);
    clone.querySelectorAll('.subq, [data-slide-widget], style, script').forEach(el => { el.remove(); });
    const clean = text => text.replace(/\s+/g, ' ').trim();
    return {
      text: clean(clone.textContent),
      headings: [...clone.querySelectorAll('h1,h2,h3')].map(el => [el.tagName, clean(el.textContent)]),
      code: [...clone.querySelectorAll('pre code')].map(el => el.textContent),
      columns: [...clone.querySelectorAll('.grid,.cols-2,.cols-3,.cols-4,.grid-auto')].map(el => [el.className, [...el.children].map(child => child.className)]),
    };
  }));
}

if (process.argv[1]?.endsWith('verificar-exemplo-fiel.mjs')) {
  const dir = process.argv[2] ?? '../backend/eval/output/fiel';
  const fixture = JSON.parse(readFileSync(process.argv[3] ?? '../backend/eval/referencias/examplo-cenas.json', 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.abort());
  await page.clock.install({ time: new Date('2026-01-01T12:00:00Z') });
  try {
    await page.setContent(readFileSync(dir + '/original.html', 'utf8'));
    const original = await estruturaEstatica(page);
    await page.goto('about:blank');
    await page.setContent(readFileSync(dir + '/aula.html', 'utf8'));
    const migrated = await estruturaEstatica(page);
    assert.deepEqual(migrated, original, 'Texto, SQL, títulos, ordem ou colunas foram alterados.');
    const report = await verificarExemploFiel(page, fixture, dir);
    assert.deepEqual(errors, []);
    writeFileSync(dir + '/fidelidade.json', JSON.stringify({ slides: original.length, staticContentIdentical: true, ...report }, null, 2));
    console.log(JSON.stringify({ slides: original.length, staticContentIdentical: true, ...report }, null, 2));
    assert.deepEqual(report.overflows, [], 'Há estados cortados; conteúdo não deve ser removido para corrigir.');
  } finally {
    await browser.close();
  }
}
