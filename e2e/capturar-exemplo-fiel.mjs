import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = process.argv[2] ?? '/artifacts/fiel';
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(5000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => route.abort());
await page.clock.install({ time: new Date('2026-01-01T12:00:00Z') });
await page.setContent(readFileSync(dir + '/original.html', 'utf8'));
await page.clock.runFor(100);
assert.deepEqual(errors, []);
const layouts = {
  'subq-cad': ['rows', 'value', 'buttons', 'text'],
  'subq-live': ['chart', 'value', 'buttons', 'text'],
  'subq-nest': ['code', 'buttons', 'text'],
  'subq-ex1': ['chart', 'buttons', 'text'],
  'subq-fn': ['chart', 'buttons', 'value', 'text'],
  'subq-lab': ['chart', 'buttons', 'code', 'text'],
  'subq-scan-in': ['intro', 'chips', 'rows', 'buttons'],
  'subq-scan-notin': ['intro', 'chips', 'rows', 'buttons'],
  'subq-nul': ['intro', 'chips', 'buttons', 'rows', 'text'],
  'subq-parou': ['buttons', 'rows', 'text'],
  'subq-scan-ex': ['rows', 'buttons'],
  'subq-vezes': ['buttons', 'rows', 'value', 'text'],
  'subq-forma': ['buttons', 'cells', 'text'],
  'subq-pile': ['groups', 'buttons'],
  'subq-join': ['buttons', 'rows', 'text'],
  'subq-ord': ['value', 'buttons', 'text'],
  'subq-coal': ['buttons', 'rows', 'text'],
  'subq-traduz': ['buttons', 'code', 'text'],
};
await page.evaluate(layouts => {
  const clean = value => (value ?? '').replace(/\s+/g, ' ').trim();
  window.captureScene = id => {
    const root = document.getElementById(id), layout = layouts[id];
    const f = { buttons: [] }, keys = [], parents = [];
    root.querySelectorAll('.subq-btn').forEach(button => {
      const attr = [...button.attributes].find(a => a.name.startsWith('data-'));
      keys.push(attr.name.slice(5) + ':' + attr.value);
      if (!parents.includes(button.parentElement)) parents.push(button.parentElement);
      const item = { label: button.textContent.trim(), to: '', row: parents.indexOf(button.parentElement) };
      if (button.disabled) item.disabled = true;
      if (['f', 'ref', 'op', 'k', 's', 'j', 'm', 'q'].includes(attr.name.slice(5))) item.selected = button.classList.contains('is-on');
      f.buttons.push(item);
    });
    const notes = [...root.querySelectorAll('.subq-nota')];
    if (layout.includes('intro')) f.intro = notes.shift()?.textContent.trim() ?? '';
    if (layout.includes('text')) {
      f.text = notes.map(note => note.textContent.trim()).join(' ');
      const runs = [];
      notes.forEach(note => {
        const walker = document.createTreeWalker(note, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const run = { text: node.textContent };
          if (node.parentElement.closest('b, strong')) run.strong = true;
          if (node.parentElement.closest('.subq-ok')) run.tone = 'success';
          if (node.parentElement.closest('.subq-no')) run.tone = 'danger';
          runs.push(run);
        }
      });
      if (runs.some(r => r.strong || r.tone)) f.textRuns = runs;
    }
    if (layout.includes('value')) {
      const big = root.querySelector('.subq-big'), p = big.closest('p').cloneNode(true);
      p.querySelectorAll('.subq-nota').forEach(note => { note.remove(); });
      f.value = big.textContent.trim();
      const prefix = clean([...p.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join(''));
      if (prefix) f.valuePrefix = prefix + ' ';
    }
    if (layout.includes('rows')) f.rows = [...root.querySelectorAll('.subq-cli')].map(row => {
      const result = row.querySelector('.subq-res');
      const r = { label: row.firstElementChild.textContent.trim(), result: result.textContent.trim() };
      if (row.classList.contains('is-scan')) r.active = true;
      if (row.classList.contains('is-gone')) r.muted = true;
      if (result.classList.contains('subq-ok')) r.tone = 'success';
      if (result.classList.contains('subq-no')) r.tone = 'danger';
      return r;
    });
    if (layout.includes('chips')) {
      const chips = [...root.querySelectorAll('.subq-chip')];
      f.chips = chips.map(c => c.textContent.trim());
      f.hits = chips.flatMap((c, i) => c.classList.contains('is-hit') ? [i] : []);
    }
    if (layout.includes('chart')) {
      const bars = [...root.querySelectorAll('.subq-b')];
      f.chart = { maximum: root.querySelector('.subq-w').clientHeight / 0.55, values: bars.map(b => Number(b.firstChild.textContent)), matches: bars.map(b => b.classList.contains('is-ok')),
        lines: [...root.querySelectorAll('.subq-ln')].map(line => {
          const value = { label: line.textContent.trim(), value: Math.round(parseFloat(line.style.bottom) / 0.55 * 1000000) / 1000000 };
          if (line.classList.contains('old')) value.previous = true;
          return value;
        }) };
    }
    if (layout.includes('code')) {
      const code = root.querySelector('.subq-code, .subq-sql');
      f.code = code.innerText;
      const slot = root.querySelector('.subq-slot');
      if (slot && (slot.classList.contains('is-in') || slot.classList.contains('is-done'))) f.focus = slot.textContent;
      if (root.querySelector('.subq-collapse')?.clientHeight === 0) f.codeHidden = true;
    }
    if (layout.includes('cells')) {
      const grid = root.querySelector('.subq-grid');
      f.cells = { columns: Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length), values: [...grid.children].map(c => c.textContent.trim()) };
    }
    if (layout.includes('groups')) f.groups = [...root.querySelectorAll('.subq-pile')].map(g => ({
      name: g.querySelector('b').textContent.trim(), items: [...g.querySelectorAll('.subq-chip')].map(c => c.textContent.trim()), total: g.querySelector('.subq-tot').textContent.trim(),
    }));
    let visible = root.innerText;
    if (f.codeHidden && f.code) visible = visible.replace(f.code, '');
    return { frame: f, keys, text: clean(visible), at: Date.now() };
  };
}, layouts);
const widgets = [];
for (const [id, layout] of Object.entries(layouts)) {
  const index = await page.locator('#' + id).evaluate(el => Number(el.closest('.slide').dataset.slide));
  await page.evaluate(index => { location.hash = '#slide-' + (index + 1); }, index);
  await page.clock.runFor(50);
  const frames = [], snapshots = [], byContent = new Map(), routes = new Map(), finals = new Map(), closed = new Map();
  const add = capture => {
    const signature = JSON.stringify(capture.frame);
    let frame = byContent.get(signature);
    if (!frame) {
      frame = { id: 'f' + frames.length, ...capture.frame };
      frames.push(frame); snapshots.push({ id: frame.id, text: capture.text, keys: capture.keys });
      byContent.set(signature, frame);
    }
    return frame;
  };
  const initial = add(await page.evaluate(id => window.captureScene(id), id));
  let current = initial;
  const action = async (key, scenario = key) => {
    const before = await page.evaluate(id => window.captureScene(id), id);
    current = add(before);
    const buttonIndex = before.keys.indexOf(key);
    assert(buttonIndex >= 0, id + ': botão ausente ' + key);
    const label = before.frame.buttons[buttonIndex].label;
    await page.evaluate(id => {
      window.sceneTrace = [];
      let last = JSON.stringify(window.captureScene(id).frame);
      window.sceneObserver = new MutationObserver(() => {
        const capture = window.captureScene(id), next = JSON.stringify(capture.frame);
        if (next !== last) { window.sceneTrace.push(capture); last = next; }
      });
      window.sceneObserver.observe(document.getElementById(id), { childList: true, subtree: true, attributes: true, characterData: true });
    }, id);
    await page.locator('#' + id + ' .subq-btn').nth(buttonIndex).evaluate(button => button.click());
    await page.clock.runFor(5000);
    const trace = await page.evaluate(() => { window.sceneObserver.disconnect(); return window.sceneTrace; });
    const chain = trace.map(add);
    const first = chain[0] ?? current;
    current.buttons[buttonIndex].to = first.id;
    routes.set(key + '|' + label, first.id);
    for (let i = 0; i < chain.length - 1; i++) {
      const edge = { to: chain[i + 1].id, delay: Math.max(0, (trace[i + 1].at - trace[i].at) / 0.45) };
      if (chain[i].next) assert.deepEqual(chain[i].next, edge, id + ': transição ambígua');
      chain[i].next = edge;
    }
    current = add(await page.evaluate(id => window.captureScene(id), id));
    finals.set(scenario, current.id);
    return current;
  };
  if (id === 'subq-cad') { await action('step:'); await action('step:'); await action('step:'); }
  else if (id === 'subq-live') { await action('add:'); await action('add:'); }
  else if (id === 'subq-nest') { await action('run:'); await action('run:'); }
  else if (id === 'subq-nul') { await action('nul:'); await action('nul:'); }
  else if (id === 'subq-lab') {
    for (const ref of ['AVG', 'MAX', 'P1']) {
      await action('ref:' + ref);
      for (const op of ['>', '>=', '<', '<=', '=']) await action('op:' + op, ref + '|' + op);
    }
  } else if (id === 'subq-traduz') {
    for (const key of ['q:a', 'q:b', 'q:c', 'q:d']) { await action(key, 'open-' + key); closed.set(key, (await action(key, 'closed-' + key)).id); }
  } else {
    const keys = (await page.evaluate(id => window.captureScene(id), id)).keys;
    for (const key of keys) await action(key);
    if (keys.length === 1) await action(keys[0]);
  }
  for (const f of frames) {
    const metadata = snapshots.find(s => s.id === f.id);
    f.buttons.forEach((button, i) => {
      const key = metadata.keys[i];
      if (id === 'subq-lab') {
        const ref = metadata.keys.find((k, n) => k.startsWith('ref:') && f.buttons[n].selected).slice(4);
        const op = metadata.keys.find((k, n) => k.startsWith('op:') && f.buttons[n].selected).slice(3);
        button.to = finals.get(key.startsWith('ref:') ? key.slice(4) + '|' + op : ref + '|' + key.slice(3));
      } else if (id === 'subq-traduz') button.to = button.selected ? closed.get(key) : finals.get('open-' + key);
      else if (!button.to) button.to = routes.get(key + '|' + button.label) ?? f.id;
      assert(button.to, id + ': destino ausente');
    });
  }
  const presentation = await page.locator('#' + id).evaluate(root => {
    const button = root.querySelector('.subq-btn');
    return { title: root.closest('.slide').querySelector('h2').textContent.trim(), align: getComputedStyle(button.parentElement).textAlign === 'center' || getComputedStyle(button).display === 'block' ? 'center' : 'left' };
  });
  widgets.push({ id, config: { type: 'scene', ...presentation, initial: initial.id, layout, frames }, snapshots });
}
assert.equal(widgets.length, 18);
assert.deepEqual(errors, []);
writeFileSync(dir + '/cenas-capturadas.json', JSON.stringify({ widgets }, null, 2));
console.log(JSON.stringify({ widgets: widgets.length, frames: widgets.reduce((sum, w) => sum + w.config.frames.length, 0), errors }, null, 2));
await browser.close();
