export interface SceneButton { label: string; to: string; selected?: boolean; disabled?: boolean; row?: number }
export interface SceneFrame {
  id: string; buttons: SceneButton[]; text?: string; textRuns?: { text: string; strong?: boolean; tone?: 'success' | 'danger' }[]; intro?: string; value?: string; valuePrefix?: string; valueTone?: 'success' | 'danger';
  code?: string; focus?: string; codeHidden?: boolean;
  chips?: string[]; hits?: number[];
  rows?: { label: string; result: string; active?: boolean; muted?: boolean; tone?: 'success' | 'danger' }[];
  chart?: { values: number[]; maximum: number; matches: boolean[]; lines: { label: string; value: number; previous?: boolean }[] };
  groups?: { name: string; items: string[]; total: string }[];
  cells?: { columns: number; values: string[] };
  next?: { to: string; delay: number };
}
export interface SceneInteractive {
  type: 'scene'; title: string; initial: string; align?: 'left' | 'center';
  layout: ('intro' | 'rows' | 'value' | 'buttons' | 'text' | 'chart' | 'code' | 'chips' | 'groups' | 'cells')[];
  frames: SceneFrame[];
}

export function validateSlideScene(value: unknown): value is SceneInteractive {
  function fail(): never { throw new Error('Cena inválida: confira quadros, controles, destinos e limites.'); }
  const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const str = (v: unknown, max = 400): v is string => typeof v === 'string' && v.length <= max;
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1000000;
  const bool = (v: unknown) => v === undefined || typeof v === 'boolean';
  const keys = (v: Record<string, unknown>, allowed: string[]) => { if (Object.keys(v).some(k => !allowed.includes(k))) fail(); };
  const array = (v: unknown, max: number): v is unknown[] => Array.isArray(v) && v.length <= max;
  if (!obj(value)) return false;
  keys(value, ['type', 'title', 'initial', 'layout', 'frames', 'align']);
  if ((value.align !== undefined && value.align !== 'left' && value.align !== 'center') || value.type !== 'scene' || !str(value.title, 100) || !value.title.trim() || !str(value.initial, 40) ||
      !array(value.layout, 10) || !value.layout.length || new Set(value.layout).size !== value.layout.length ||
      !value.layout.every(k => ['intro', 'rows', 'value', 'buttons', 'text', 'chart', 'code', 'chips', 'groups', 'cells'].includes(String(k))) ||
      !array(value.frames, 64) || !value.frames.length) fail();
  const ids = new Set<string>();
  for (const f of value.frames as unknown[]) {
    if (!obj(f)) fail();
    keys(f, ['id', 'buttons', 'text', 'textRuns', 'intro', 'value', 'valuePrefix', 'valueTone', 'code', 'focus', 'codeHidden', 'chips', 'hits', 'rows', 'chart', 'groups', 'cells', 'next']);
    if (!str(f.id, 40) || !/^[a-zA-Z0-9_-]+$/.test(f.id) || ids.has(f.id) || !array(f.buttons, 8) ||
        ['text', 'intro', 'value', 'valuePrefix'].some(k => f[k] !== undefined && !str(f[k])) ||
        (f.code !== undefined && (!str(f.code, 800) || f.code.split('\n').length > 12)) ||
        (f.focus !== undefined && (!str(f.focus, 100) || !f.focus || typeof f.code !== 'string' || !f.code.includes(f.focus))) ||
        !bool(f.codeHidden) || (f.valueTone !== undefined && f.valueTone !== 'success' && f.valueTone !== 'danger')) fail();
    if (f.textRuns !== undefined) {
      if (!array(f.textRuns, 24)) fail();
      for (const run of f.textRuns as unknown[]) {
        if (!obj(run)) fail();
        keys(run, ['text', 'strong', 'tone']);
        if (!str(run.text) || !bool(run.strong) || (run.tone !== undefined && run.tone !== 'success' && run.tone !== 'danger')) fail();
      }
      if ((f.textRuns as { text: string }[]).map(r => r.text).join('').trim() !== f.text) fail();
    }
    ids.add(f.id);
    for (const b of f.buttons as unknown[]) {
      if (!obj(b)) fail();
      keys(b, ['label', 'to', 'selected', 'disabled', 'row']);
      if (!str(b.label, 100) || !b.label.trim() || !str(b.to, 40) || !bool(b.selected) || !bool(b.disabled) ||
          (b.row !== undefined && (!Number.isInteger(b.row) || Number(b.row) < 0 || Number(b.row) > 3))) fail();
    }
    if (f.chips !== undefined && (!array(f.chips, 12) || !f.chips.every(v => str(v, 100)))) fail();
    if (f.hits !== undefined && (!array(f.hits, 12) || !f.hits.every(v => Number.isInteger(v) && Number(v) >= 0 && Array.isArray(f.chips) && Number(v) < f.chips.length))) fail();
    if (f.rows !== undefined) {
      if (!array(f.rows, 8)) fail();
      for (const r of f.rows as unknown[]) {
        if (!obj(r)) fail();
        keys(r, ['label', 'result', 'active', 'muted', 'tone']);
        if (!str(r.label, 100) || !str(r.result, 100) || !bool(r.active) || !bool(r.muted) ||
            (r.tone !== undefined && r.tone !== 'success' && r.tone !== 'danger')) fail();
      }
    }
    if (f.chart !== undefined) {
      if (!obj(f.chart)) fail();
      keys(f.chart, ['values', 'matches', 'lines', 'maximum']);
      const maximum = f.chart.maximum;
      if (!num(maximum) || maximum < 1) fail();
      if (!array(f.chart.values, 12) || !f.chart.values.every(v => num(v) && v <= maximum) || !array(f.chart.matches, 12) ||
          f.chart.matches.length !== f.chart.values.length || !f.chart.matches.every(v => typeof v === 'boolean') || !array(f.chart.lines, 6)) fail();
      for (const l of f.chart.lines as unknown[]) {
        if (!obj(l)) fail();
        keys(l, ['label', 'value', 'previous']);
        if (!str(l.label, 100) || !num(l.value) || l.value > maximum || !bool(l.previous)) fail();
      }
    }
    if (f.groups !== undefined) {
      if (!array(f.groups, 4)) fail();
      for (const g of f.groups as unknown[]) {
        if (!obj(g)) fail();
        keys(g, ['name', 'items', 'total']);
        if (!str(g.name, 60) || !str(g.total, 100) || !array(g.items, 12) || !g.items.every(v => str(v, 100))) fail();
      }
    }
    if (f.cells !== undefined) {
      if (!obj(f.cells)) fail();
      keys(f.cells, ['columns', 'values']);
      if (!Number.isInteger(f.cells.columns) || Number(f.cells.columns) < 1 || Number(f.cells.columns) > 4 ||
          !array(f.cells.values, 32) || !f.cells.values.every(v => str(v, 100))) fail();
    }
    if (f.next !== undefined) {
      if (!obj(f.next)) fail();
      keys(f.next, ['to', 'delay']);
      if (!str(f.next.to, 40) || !num(f.next.delay) || f.next.delay < 0 || f.next.delay > 10000) fail();
    }
  }
  const frames = value.frames as SceneFrame[];
  if (!ids.has(value.initial)) fail();
  for (const f of frames) {
    if (f.buttons.some(b => !ids.has(b.to))) fail();
    const seen = new Set<string>(); let frame: SceneFrame | undefined = f, duration = 0;
    while (frame?.next) {
      if (seen.has(frame.id) || !ids.has(frame.next.to)) fail();
      seen.add(frame.id); duration += frame.next.delay;
      if (duration > 30000) fail();
      frame = frames.find(candidate => candidate.id === frame!.next!.to);
    }
  }
  return true;
}

export function renderSlideScene(config: SceneInteractive, frame: SceneFrame): string {
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const buttons = frame.buttons.map((b, i) => `<button type="button" data-scene-button="${i}" data-scene-row="${b.row ?? 0}"${b.disabled ? ' disabled' : ''}${b.selected !== undefined ? ` aria-pressed="${b.selected}"` : ''}>${esc(b.label)}</button>`);
  const controls = [...new Set(frame.buttons.map(b => b.row ?? 0))].map(row => `<div class="slide-scene-control-row">${buttons.filter((_b, i) => (frame.buttons[i].row ?? 0) === row).join('')}</div>`).join('');
  let code = esc(frame.code ?? '');
  if (frame.focus && frame.code) {
    const i = frame.code.indexOf(frame.focus);
    code = esc(frame.code.slice(0, i)) + '<mark>' + esc(frame.focus) + '</mark>' + esc(frame.code.slice(i + frame.focus.length));
  }
  const fields: Record<string, string> = {
    intro: frame.intro ? `<p class="slide-scene-intro">${esc(frame.intro)}</p>` : '',
    text: `<p class="slide-widget-message">${frame.textRuns ? frame.textRuns.map(r => `<${r.strong ? 'strong' : 'span'}${r.tone ? ` class="slide-scene-${r.tone}"` : ''}>${esc(r.text)}</${r.strong ? 'strong' : 'span'}>`).join('') : esc(frame.text ?? '')}</p>`,
    value: frame.value !== undefined ? `<p class="slide-scene-value">${esc(frame.valuePrefix ?? '')}<output${frame.valueTone ? ' class="is-tone-' + frame.valueTone + '"' : ''}>${esc(frame.value)}</output></p>` : '',
    buttons: `<div class="slide-widget-controls">${controls}</div>`,
    rows: (frame.rows ?? []).map(r => `<div class="slide-widget-row${r.active ? ' is-scan' : ''}${r.muted ? ' is-muted' : ''}"><span>${esc(r.label)}</span><strong${r.tone ? ` class="slide-scene-${r.tone}"` : ''}>${esc(r.result)}</strong></div>`).join(''),
    chips: frame.chips ? `<p>${frame.chips.map((c, i) => `<span class="slide-widget-chip${c === 'NULL' ? ' is-null' : ''}${frame.hits?.includes(i) ? ' is-match' : ''}">${esc(c)}</span>`).join('')}</p>` : '',
    code: frame.code ? `<pre${frame.codeHidden ? ' hidden' : ''}><code>${code}</code></pre>` : '',
    chart: frame.chart ? `<div class="slide-widget-chart">${frame.chart.values.map((v, i) => `<div class="slide-widget-bar${frame.chart!.matches[i] ? ' is-match' : ''}" style="height:${v / frame.chart!.maximum * 100}%"><span>${esc(v)}</span></div>`).join('')}${frame.chart.lines.map(l => `<div class="slide-widget-${l.previous ? 'baseline' : 'threshold'}" style="bottom:${l.value / frame.chart!.maximum * 100}%"><span>${esc(l.label)}</span></div>`).join('')}</div>` : '',
    groups: frame.groups ? `<div class="slide-widget-groups">${frame.groups.map(g => `<div class="slide-widget-group"><strong>${esc(g.name)}</strong><div class="slide-widget-items">${g.items.map(i => `<span class="slide-widget-chip">${esc(i)}</span>`).join('')}</div><output>${esc(g.total)}</output></div>`).join('')}</div>` : '',
    cells: frame.cells ? `<div class="slide-scene-cells" style="grid-template-columns:repeat(${frame.cells.columns},minmax(0,9rem))">${frame.cells.values.map(v => `<div class="slide-widget-chip">${esc(v)}</div>`).join('')}</div>` : '',
  };
  return config.layout.map(field => fields[field]).join('');
}
