import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const input = resolve(process.argv[2]);
const output = dirname(input);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.route('https://**/*', route => route.abort());
const report = { input, slides: [], interactions: [], errors: [], unverified: [] };
page.on('pageerror', error => report.errors.push(error.message));
try {
  await page.setContent(readFileSync(input, 'utf8'));
  const slides = page.locator('section.slide');
  for (let i = 0; i < await slides.count(); i++) {
    await page.evaluate(n => { location.hash = '#slide-' + n; }, i + 1);
    await page.waitForFunction(n => document.querySelector('#slide-' + n)?.classList.contains('active'), i + 1);
    const measure = async state => {
      await page.waitForFunction(() => [...document.querySelectorAll('.slide.active .slide-content > *')].every(el => getComputedStyle(el).opacity === '1'));

      const result = await slides.nth(i).evaluate(el => {
        const bounds = el.getBoundingClientRect();
        const content = el.querySelector('.slide-content');
        const rect = content.getBoundingClientRect();
        const over = [...content.querySelectorAll('pre,table,.slide-widget,.cols-2,.grid')].filter(node => {
          const r = node.getBoundingClientRect();
          return node.checkVisibility() && r.width > 0 && r.height > 0 && (r.right > bounds.right - 12 || r.bottom > bounds.bottom - 20 || r.left < bounds.left);
        }).map(node => node.tagName + '.' + node.className);
        return { title: el.querySelector('h1,h2')?.textContent, bottom: rect.bottom, overflow: rect.bottom > bounds.bottom - 20 || over.length > 0, elements: over };
      });
      report.slides.push({ slide: i + 1, state, ...result });
    };
    await measure('initial');
    const widgets = slides.nth(i).locator('[data-slide-widget]');
    for (let w = 0; w < await widgets.count(); w++) {
      const widget = widgets.nth(w);
      const config = JSON.parse(await widget.getAttribute('data-widget-config'));
      if (config.annotationOnly) continue;
      let actions = 0;
      const click = async (control, state) => {
        if (await control.count() && await control.isEnabled()) {
          await control.click();
          actions += 1;
          await measure(state);
        }
      };
      if (config.type === 'bars') {
        const refs = config.references ?? ['AVG', 'MAX', 'MIN', 'SUM', 'COUNT'];
        const ops = config.mode === 'aggregate' ? [null] : config.operators ?? ['>', '>=', '<', '<=', '='];
        for (const extra of config.extra ? [false, true] : [false]) {
          await click(widget.locator('[data-widget-reset]'), 'bars:reset');
          if (extra) await click(widget.locator('[data-widget-extra]'), 'bars:extra');
          for (let r = 0; r < refs.length; r++) {
            await click(widget.locator('[data-reference="' + r + '"]'), 'bars:reference:' + refs[r]);
            for (const op of ops) {
              if (op !== null) await click(widget.getByRole('button', { name: op, exact: true }), 'bars:operator:' + op);
            }
          }
        }
      } else if (config.type === 'scan') {
        for (let v = 0; v < (config.variants?.length ?? 1); v++) {
          await click(widget.locator('[data-widget-reset]'), 'scan:reset');
          if (config.variants) await click(widget.locator('[data-variant="' + v + '"]'), 'scan:variant:' + v);
          for (let n = 0; n < config.rows.length; n++) await click(widget.locator('[data-widget-next]'), 'scan:' + v + ':' + n);
        }
      } else if (config.type === 'reference') {
        const terms = widget.locator('[data-term]');
        for (let t = 0; t < await terms.count(); t++) {
          await terms.nth(t).focus();
          actions += 1;
          await measure('reference:' + t);
          await page.keyboard.press('Escape');
        }
      } else if (config.type === 'scene') {
        report.unverified.push({ slide: i + 1, reason: 'Quadros e sequências scene exigem a suíte específica.' });
      } else {
        const states = config.states?.length ?? config.items?.length ?? 0;
        for (let n = 0; n < states; n++) {
          const control = config.type === 'compare'
            ? widget.locator('[data-widget-index="' + n + '"]')
            : widget.locator('[data-widget-next]');
          await click(control, config.type + ':' + n);
        }
      }
      report.interactions.push({ slide: i + 1, type: config.type, title: config.title, actions });
    }
    const details = slides.nth(i).locator('details.gab');
    for (let d = 0; d < await details.count(); d++) {
      await details.nth(d).evaluate(el => { el.open = true; });
      await measure('answer:' + d);
      await details.nth(d).evaluate(el => { el.open = false; });
    }
    if (i === 1 || i === 6 || report.slides.some(s => s.slide === i + 1 && s.overflow)) {
      await page.screenshot({ path: join(output, 'overflow-slide-' + (i + 1) + '.png') });
    }
  }
} catch (error) {
  report.errors.push(String(error));
} finally {
  await browser.close();
}
writeFileSync(join(output, 'browser.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ input, measuredStates: report.slides.length, overflowSlides: [...new Set(report.slides.filter(s => s.overflow).map(s => s.slide))], interactions: report.interactions.length, errors: report.errors }, null, 2));
if (report.errors.length || report.slides.some(s => s.overflow) || report.unverified.length) process.exitCode = 1;
