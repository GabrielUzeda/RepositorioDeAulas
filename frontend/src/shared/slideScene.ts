export interface SceneButton { label: string; to: string; selected?: boolean; disabled?: boolean; row?: number }
export interface SceneFrame {
  id: string; buttons: SceneButton[]; text?: string; textRuns?: { text: string; strong?: boolean; tone?: 'success' | 'danger' }[]; intro?: string; value?: string; valuePrefix?: string; valueTone?: 'success' | 'danger';
  code?: string; focus?: string; codeHidden?: boolean;
  chips?: string[]; hits?: number[];
  rows?: { label: string; result?: string; active?: boolean; muted?: boolean; tone?: 'success' | 'danger' }[];
  chart?: { values: number[]; maximum: number; matches?: boolean[]; lines?: { label: string; value: number; previous?: boolean }[] };
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
  function fail(reason: string): never { throw new Error('Cena inválida: ' + reason); }
  const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const str = (v: unknown, max = 400): v is string => typeof v === 'string' && v.length <= max;
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1000000;
  const bool = (v: unknown) => v === undefined || typeof v === 'boolean';
  const keys = (v: Record<string, unknown>, allowed: string[], where: string) => {
    const extra = Object.keys(v).find(k => !allowed.includes(k));
    if (extra) fail('chave não reconhecida em ' + where + ': ' + extra + ' (aceitas: ' + allowed.join(', ') + ').');
  };
  const array = (v: unknown, max: number): v is unknown[] => Array.isArray(v) && v.length <= max;
  if (!obj(value)) return false;
  keys(value, ['type', 'title', 'initial', 'layout', 'frames', 'align'], 'raiz');
  if (value.type !== 'scene') fail('type deve ser "scene".');
  if (!str(value.title, 100) || !value.title.trim()) fail('title deve ser texto não vazio de até 100 caracteres.');
  if (!str(value.initial, 40)) fail('initial deve ser o id de um quadro (até 40 caracteres).');
  if (value.align !== undefined && value.align !== 'left' && value.align !== 'center') fail('align deve ser "left" ou "center".');
  if (!array(value.layout, 10) || !value.layout.length) fail('layout deve listar de 1 a 10 campos.');
  if (new Set(value.layout).size !== value.layout.length) fail('layout não pode repetir campos.');
  const layoutKeys = ['intro', 'rows', 'value', 'buttons', 'text', 'chart', 'code', 'chips', 'groups', 'cells'];
  if (!value.layout.every(k => typeof k === 'string' && layoutKeys.includes(k))) fail('layout aceita apenas nomes de campos do catálogo.');
  if (!array(value.frames, 64) || !value.frames.length) fail('frames deve ter de 1 a 64 quadros.');
  const ids = new Set<string>();
  for (const f of value.frames as unknown[]) {
    if (!obj(f)) fail('quadro deve ser objeto.');
    keys(f, ['id', 'buttons', 'text', 'textRuns', 'intro', 'value', 'valuePrefix', 'valueTone', 'code', 'focus', 'codeHidden', 'chips', 'hits', 'rows', 'chart', 'groups', 'cells', 'next'], 'quadro');
    if (!str(f.id, 40) || !/^[a-zA-Z0-9_-]+$/.test(f.id)) fail('id de quadro deve usar letras/dígitos/underscore/hífen (até 40 caracteres).');
    if (ids.has(f.id)) fail('id de quadro repetido: ' + f.id + '.');
    if (!array(f.buttons, 8)) fail('quadro ' + f.id + ' deve ter buttons (lista de até 8 objetos).');
    for (const k of ['text', 'intro', 'value', 'valuePrefix'] as const) if (f[k] !== undefined && !str(f[k])) fail(k + ' do quadro ' + f.id + ' deve ter até 400 caracteres.');
    if (f.code !== undefined && (!str(f.code, 800) || f.code.split('\n').length > 12)) fail('code do quadro ' + f.id + ' deve ter até 800 caracteres e 12 linhas.');
    if (f.focus !== undefined) {
      if (!str(f.focus, 100) || !f.focus) fail('focus do quadro ' + f.id + ' deve ser trecho não vazio de até 100 caracteres.');
      if (typeof f.code !== 'string' || !f.code.includes(f.focus)) fail('focus do quadro ' + f.id + ' deve ser trecho exato do code.');
    }
    if (!bool(f.codeHidden)) fail('codeHidden do quadro ' + f.id + ' deve ser booleano.');
    if (f.valueTone !== undefined && f.valueTone !== 'success' && f.valueTone !== 'danger') fail('valueTone do quadro ' + f.id + ' deve ser "success" ou "danger".');
    if (f.textRuns !== undefined) {
      if (!array(f.textRuns, 24)) fail('textRuns do quadro ' + f.id + ' deve ter até 24 trechos.');
      for (const run of f.textRuns as unknown[]) {
        if (!obj(run)) fail('trecho de textRuns deve ser objeto.');
        keys(run, ['text', 'strong', 'tone'], 'textRuns');
        if (!str(run.text) || !bool(run.strong) || (run.tone !== undefined && run.tone !== 'success' && run.tone !== 'danger')) fail('textRuns do quadro ' + f.id + ' aceita apenas text (até 400), strong booleano e tone success/danger.');
      }
      if ((f.textRuns as { text: string }[]).map(r => r.text).join('').trim() !== f.text) fail('a concatenação dos textRuns do quadro ' + f.id + ' deve reproduzir text.');
    }
    ids.add(f.id);
    for (const b of f.buttons as unknown[]) {
      if (!obj(b)) fail('botão deve ser objeto.');
      keys(b, ['label', 'to', 'selected', 'disabled', 'row'], 'botão');
      if (!str(b.label, 100) || !b.label.trim()) fail('label do botão deve ter de 1 a 100 caracteres.');
      if (!str(b.to, 40)) fail('to do botão deve referenciar um quadro (até 40 caracteres).');
      if (!bool(b.selected) || !bool(b.disabled)) fail('selected/disabled do botão devem ser booleanos.');
      if (b.row !== undefined && (!Number.isInteger(b.row) || Number(b.row) < 0 || Number(b.row) > 3)) fail('row do botão deve ser inteiro de 0 a 3.');
    }
    if (f.chips !== undefined && (!array(f.chips, 12) || !f.chips.every(v => str(v, 100)))) fail('chips do quadro ' + f.id + ' deve ter até 12 strings de até 100 caracteres.');
    if (f.hits !== undefined && (!array(f.hits, 12) || !f.hits.every(v => Number.isInteger(v) && Number(v) >= 0 && Array.isArray(f.chips) && Number(v) < f.chips.length))) fail('hits do quadro ' + f.id + ' devem ser índices válidos dos chips do mesmo quadro.');
    if (f.rows !== undefined) {
      if (!array(f.rows, 8)) fail('rows do quadro ' + f.id + ' deve ter até 8 linhas.');
      for (const r of f.rows as unknown[]) {
        if (!obj(r)) fail('linha de rows deve ser objeto.');
        keys(r, ['label', 'result', 'value', 'active', 'muted', 'tone'], 'rows');
        if (r.value !== undefined) {
          if (!str(r.value, 100)) fail('value da linha deve ser texto de até 100 caracteres.');
          if (r.result !== undefined && r.result !== r.value) fail('result e value da linha devem ser iguais quando ambos são usados.');
          r.result = r.value;
          delete r.value;
        }
        if (!str(r.label, 100) || (r.result !== undefined && !str(r.result, 100)) || !bool(r.active) || !bool(r.muted) || (r.tone !== undefined && r.tone !== 'success' && r.tone !== 'danger')) fail('rows do quadro ' + f.id + ' aceita label/result (até 100), active/muted booleanos e tone success/danger.');
      }
    }
    if (f.chart !== undefined) {
      if (!obj(f.chart)) fail('chart deve ser objeto.');
      keys(f.chart, ['values', 'matches', 'lines', 'maximum'], 'chart');
      const maximum = f.chart.maximum;
      if (!num(maximum) || maximum < 1) fail('maximum do chart deve ser número maior ou igual a 1.');
      if (!array(f.chart.values, 12) || !f.chart.values.every(v => num(v) && v <= maximum) || (f.chart.lines !== undefined && !array(f.chart.lines, 6))) fail('chart do quadro ' + f.id + ': values até 12 valores entre 0 e maximum, lines com até 6.');
      if (f.chart.matches !== undefined && (!array(f.chart.matches, 12) ||
          f.chart.matches.length !== f.chart.values.length || !f.chart.matches.every(v => typeof v === 'boolean'))) fail('matches do chart no quadro ' + f.id + ' deve ter o mesmo tamanho de values.');
      for (const l of (f.chart.lines ?? []) as unknown[]) {
        if (!obj(l)) fail('linha do chart deve ser objeto.');
        keys(l, ['label', 'value', 'previous'], 'linha do chart');
        if (!str(l.label, 100) || !num(l.value) || !bool(l.previous)) fail('linha do chart no quadro ' + f.id + ' aceita label (até 100), value numérico e previous booleano.');
        if (l.value > maximum) fail('linha do chart no quadro ' + f.id + ': value ' + l.value + ' excede maximum ' + maximum + '. Aumente maximum para incluir barras e linhas de referência, sem alterar os dados.');
      }
    }
    if (f.groups !== undefined) {
      if (!array(f.groups, 4)) fail('groups do quadro ' + f.id + ' deve ter até 4 grupos.');
      for (const g of f.groups as unknown[]) {
        if (!obj(g)) fail('grupo deve ser objeto.');
        keys(g, ['name', 'items', 'total'], 'grupo');
        if (!str(g.name, 60) || !str(g.total, 100) || !array(g.items, 12) || !g.items.every(v => str(v, 100))) fail('grupo aceita name (até 60), total (até 100) e até 12 itens de até 100 caracteres.');
      }
    }
    if (f.cells !== undefined) {
      if (!obj(f.cells)) fail('cells deve ser objeto.');
      keys(f.cells, ['columns', 'values'], 'cells');
      if (!Number.isInteger(f.cells.columns) || Number(f.cells.columns) < 1 || Number(f.cells.columns) > 4 ||
          !array(f.cells.values, 32) || !f.cells.values.every(v => str(v, 100))) fail('cells aceita columns de 1 a 4 e até 32 valores de até 100 caracteres.');
    }
    if (f.next !== undefined) {
      if (!obj(f.next)) fail('next deve ser objeto.');
      keys(f.next, ['to', 'delay'], 'next');
      if (!str(f.next.to, 40)) fail('next.to deve referenciar um quadro.');
      if (!num(f.next.delay) || f.next.delay < 0 || f.next.delay > 10000) fail('next.delay deve ser entre 0 e 10000 ms.');
    }
  }
  const frames = value.frames as SceneFrame[];
  if (!ids.has(value.initial)) fail('initial aponta para um quadro inexistente.');
  for (const f of frames) {
    for (const b of f.buttons) if (!ids.has(b.to)) fail('botão do quadro ' + f.id + ' aponta para o quadro inexistente ' + b.to + '.');
    const seen = new Set<string>(); let frame: SceneFrame | undefined = f, duration = 0;
    while (frame?.next) {
      if (seen.has(frame.id)) fail('next forma ciclo automático a partir do quadro ' + f.id + '.');
      if (!ids.has(frame.next.to)) fail('next do quadro ' + frame.id + ' aponta para o quadro inexistente ' + frame.next.to + '.');
      seen.add(frame.id); duration += frame.next.delay;
      if (duration > 30000) fail('cadeia de next a partir do quadro ' + f.id + ' excede 30000 ms.');
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
    rows: (frame.rows ?? []).map(r => `<div class="slide-widget-row${r.active ? ' is-scan' : ''}${r.muted ? ' is-muted' : ''}"><span>${esc(r.label)}</span>${r.result === undefined ? '' : `<strong${r.tone ? ` class="slide-scene-${r.tone}"` : ''}>${esc(r.result)}</strong>`}</div>`).join(''),
    chips: frame.chips ? `<p>${frame.chips.map((c, i) => `<span class="slide-widget-chip${c === 'NULL' ? ' is-null' : ''}${frame.hits?.includes(i) ? ' is-match' : ''}">${esc(c)}</span>`).join('')}</p>` : '',
    code: frame.code ? `<pre${frame.codeHidden ? ' hidden' : ''}><code>${code}</code></pre>` : '',
    chart: frame.chart ? `<div class="slide-widget-chart">${frame.chart.values.map((v, i) => `<div class="slide-widget-bar${frame.chart!.matches?.[i] ? ' is-match' : ''}" style="height:${v / frame.chart!.maximum * 100}%"><span>${esc(v)}</span></div>`).join('')}${(frame.chart.lines ?? []).map(l => `<div class="slide-widget-${l.previous ? 'baseline' : 'threshold'}" style="bottom:${l.value / frame.chart!.maximum * 100}%"><span>${esc(l.label)}</span></div>`).join('')}</div>` : '',
    groups: frame.groups ? `<div class="slide-widget-groups">${frame.groups.map(g => `<div class="slide-widget-group"><strong>${esc(g.name)}</strong><div class="slide-widget-items">${g.items.map(i => `<span class="slide-widget-chip">${esc(i)}</span>`).join('')}</div><output>${esc(g.total)}</output></div>`).join('')}</div>` : '',
    cells: frame.cells ? `<div class="slide-scene-cells" style="grid-template-columns:repeat(${frame.cells.columns},minmax(0,9rem))">${frame.cells.values.map(v => `<div class="slide-widget-chip">${esc(v)}</div>`).join('')}</div>` : '',
  };
  return config.layout.map(field => fields[field]).join('');
}
