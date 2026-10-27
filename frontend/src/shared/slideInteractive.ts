import { validateSlideScene, renderSlideScene, type SceneInteractive } from './slideScene';

export type Aggregate = 'AVG' | 'MAX' | 'MIN' | 'SUM' | 'COUNT';
export type Operator = '>' | '>=' | '<' | '<=' | '=';
export interface InteractiveTable { headers: string[]; rows: (string | number | null)[][] }
export interface InteractiveRow { label: string; result: string; match?: boolean; muted?: boolean; key?: string }
export interface InteractiveState {
  label: string; text: string; code?: string; focus?: string; value?: number;
  rows?: InteractiveRow[]; chips?: (string | number | null)[]; table?: InteractiveTable;
}
export interface StateInteractive { type: 'steps' | 'compare'; title: string; states: InteractiveState[]; collapse?: boolean }
export interface BarInteractive {
  type: 'bars'; title: string; values: number[]; labels: string[];
  mode?: 'filter' | 'aggregate'; references?: (Aggregate | number)[]; operators?: Operator[];
  extra?: { label: string; value: number };
}
export interface ScanInteractive {
  type: 'scan'; title: string; rows: InteractiveRow[]; chips?: (string | number | null)[];
  variants?: { label: string; stopAtMatch: boolean }[];
}
export interface GroupInteractive {
  type: 'group'; title: string; items: { label: string; group: string; value: number }[];
}
export interface ReferenceInteractive {
  type: 'reference'; title: string; code: string; scope?: 'widget' | 'deck'; annotationOnly?: boolean; tables: (InteractiveTable & { term: string })[];
}
export type SlideInteractive = StateInteractive | BarInteractive | ScanInteractive | GroupInteractive | ReferenceInteractive | SceneInteractive;

export function parseSlideInteractive(source: string): SlideInteractive {
  if (source.length > 64000) throw new Error('Interativo excede 64000 caracteres.');
  let value: unknown;
  try { value = JSON.parse(source); }
  catch { throw new Error('O bloco interactive deve conter JSON válido.'); }
  if (value && typeof value === 'object' && 'type' in value && value.type === 'scene') {
    if (validateSlideScene(value)) return value;
  }
  if (source.length > 12000) throw new Error('Interativo excede 12000 caracteres.');
  function fail(message: string): never { throw new Error(message); }
  const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const text = (v: unknown, max = 100): v is string => typeof v === 'string' && !!v.trim() && v.length <= max;
  const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1000000;
  const scalar = (v: unknown): v is string | number | null => v === null || number(v) || text(v, 100);
  const keys = (v: Record<string, unknown>, allowed: string[]) => {
    if (Object.keys(v).some(k => !allowed.includes(k))) fail('Campo desconhecido no interativo: use apenas os campos do catálogo.');
  };
  const code = (v: unknown): v is string => text(v, 800) && v.split('\n').length <= 12;
  const table = (v: unknown): v is InteractiveTable => record(v) && Array.isArray(v.headers) &&
    v.headers.length >= 1 && v.headers.length <= 4 && v.headers.every(h => text(h, 60)) &&
    Array.isArray(v.rows) && v.rows.length >= 1 && v.rows.length <= 8 &&
    v.rows.every(r => Array.isArray(r) && r.length === (v.headers as unknown[]).length && r.every(scalar));
  const chips = (v: unknown): boolean => Array.isArray(v) && v.length <= 12 && v.every(scalar);
  const rows = (v: unknown): v is InteractiveRow[] => Array.isArray(v) && v.length >= 1 && v.length <= 8 && v.every(r => {
    if (!record(r)) return false;
    keys(r, ['label', 'result', 'match', 'muted', 'key']);
    return text(r.label, 60) && text(r.result, 100) &&
      (r.match === undefined || typeof r.match === 'boolean') && (r.muted === undefined || typeof r.muted === 'boolean') &&
      (r.key === undefined || text(r.key, 60));
  });
  const validate = (value: unknown): value is SlideInteractive => {
  if (!record(value) || !text(value.title)) fail('Interativo exige title com 1–100 caracteres.');
  if (value.type === 'steps' || value.type === 'compare') {
    keys(value, ['type', 'title', 'states', 'collapse']);
    if (value.collapse !== undefined && (value.type !== 'compare' || typeof value.collapse !== 'boolean')) fail('collapse é booleano e exclusivo de compare.');
    if (!Array.isArray(value.states) || value.states.length < 2 || value.states.length > 6) fail('Use states com 2–6 estados.');
    for (const state of value.states) {
      if (!record(state)) fail('Estado inválido.');
      keys(state, ['label', 'text', 'code', 'focus', 'value', 'rows', 'chips', 'table']);
      if (!text(state.label, 60) || !text(state.text, 400) || (state.code !== undefined && !code(state.code)) ||
          (state.focus !== undefined && (!text(state.focus) || typeof state.code !== 'string' || !state.code.includes(state.focus))) ||
          (state.value !== undefined && !number(state.value)) || (state.rows !== undefined && !rows(state.rows)) ||
          (state.chips !== undefined && !chips(state.chips)) || (state.table !== undefined && !table(state.table))) {
        fail('Estado inválido: label/text obrigatórios; confira limites de code, focus, value, rows, chips e table.');
      }
      if (record(state.table)) keys(state.table, ['headers', 'rows']);
    }
  } else if (value.type === 'bars') {
    keys(value, ['type', 'title', 'values', 'labels', 'mode', 'references', 'operators', 'extra']);
    if (!Array.isArray(value.values) || value.values.length < 1 || value.values.length > 12 ||
        !value.values.every(v => number(v) && v >= 0) || !Array.isArray(value.labels) ||
        value.labels.length !== value.values.length || !value.labels.every(l => text(l, 40)) ||
        (value.mode !== undefined && value.mode !== 'aggregate' && value.mode !== 'filter') ||
        (value.references !== undefined && (!Array.isArray(value.references) || !value.references.length || value.references.length > 6 ||
          !value.references.every(r => (number(r) && r >= 0) || ['AVG', 'MIN', 'MAX', 'SUM', 'COUNT'].includes(String(r))))) ||
        (value.operators !== undefined && (!Array.isArray(value.operators) || !value.operators.length || value.operators.length > 5 ||
          !value.operators.every(op => ['>', '>=', '<', '<=', '='].includes(String(op)))))) {
      fail('Barras exigem 1–12 values não negativos e labels correspondentes; confira mode, references e operators.');
    }
    if (value.extra !== undefined) {
      if (!record(value.extra) || !text(value.extra.label, 40) || !number(value.extra.value) || value.extra.value < 0) fail('extra exige label e value não negativo.');
      keys(value.extra, ['label', 'value']);
    }
  } else if (value.type === 'scan') {
    keys(value, ['type', 'title', 'rows', 'chips', 'variants']);
    if (!rows(value.rows) || (value.chips !== undefined && !chips(value.chips))) fail('Varredura exige 1–8 rows válidas e chips opcionais.');
    if (value.variants !== undefined) {
      if (!Array.isArray(value.variants) || !value.variants.length || value.variants.length > 4) fail('Use 1–4 variantes.');
      for (const variant of value.variants) {
        if (!record(variant) || !text(variant.label, 60) || typeof variant.stopAtMatch !== 'boolean') fail('Variante exige label e stopAtMatch booleano.');
        keys(variant, ['label', 'stopAtMatch']);
      }
    }
  } else if (value.type === 'group') {
    keys(value, ['type', 'title', 'items']);
    if (!Array.isArray(value.items) || !value.items.length || value.items.length > 12) fail('Agrupamento exige 1–12 itens.');
    const groups = new Set<string>();
    for (const item of value.items) {
      if (!record(item) || !text(item.label, 60) || !text(item.group, 40) || !number(item.value)) fail('Item exige label, group e value numérico.');
      keys(item, ['label', 'group', 'value']);
      groups.add(item.group);
    }
    if (groups.size > 4) fail('Use no máximo 4 grupos por slide.');
  } else if (value.type === 'reference') {
    keys(value, ['type', 'title', 'code', 'tables', 'scope', 'annotationOnly']);
    if (value.annotationOnly !== undefined && (typeof value.annotationOnly !== 'boolean' || value.scope !== 'deck')) fail('annotationOnly exige scope deck.');
    if (value.scope !== undefined && value.scope !== 'widget' && value.scope !== 'deck') fail('scope deve ser widget ou deck.');
    if (!code(value.code) || !Array.isArray(value.tables) || !value.tables.length || value.tables.length > 4) fail('Referência exige code e 1–4 tables.');
    const terms = new Set<string>();
    for (const t of value.tables) {
      if (!table(t) || !record(t) || typeof t.term !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]{0,39}$/.test(t.term) || terms.has(t.term)) fail('Cada tabela exige term único (identificador), headers e rows.');
      keys(t, ['term', 'headers', 'rows']);
      terms.add(t.term);
    }
  } else fail('Tipos disponíveis: steps, compare, bars, scan, group e reference.');
  return true;
  };
  if (validate(value)) return value;
  return fail('Interativo inválido.');
}

export function calculateBarInteractive(config: BarInteractive, reference: Aggregate | number, operator: Operator, extra = false) {
  const values = [...config.values, ...(extra && config.extra ? [config.extra.value] : [])];
  const labels = [...config.labels, ...(extra && config.extra ? [config.extra.label] : [])];
  const sum = values.reduce((a, b) => a + b, 0);
  const aggregates = { AVG: sum / values.length, MIN: Math.min(...values), MAX: Math.max(...values), SUM: sum, COUNT: values.length };
  const threshold = typeof reference === 'number' ? reference : aggregates[reference];
  const matches = values.map(v => config.mode === 'aggregate'
    ? (reference === 'MIN' || reference === 'MAX' ? v === threshold : true)
    : operator === '>' ? v > threshold : operator === '>=' ? v >= threshold : operator === '<' ? v < threshold : operator === '<=' ? v <= threshold : v === threshold);
  return { values, labels, threshold, matches, maximum: Math.max(1, ...values, threshold), aggregates };
}

export function renderSlideInteractive(source: string): string {
  const esc = (s: unknown) => String(s ?? 'NULL').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const table = (t: InteractiveTable) => `<table><thead><tr>${t.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const rows = (items: InteractiveRow[]) => items.map((row, i) => `<div class="slide-widget-row${row.muted ? ' is-muted' : ''}${row.match ? ' is-match' : ''}" data-row="${i}"${row.match !== undefined ? ` data-match="${row.match}"` : ''}><span>${esc(row.label)}</span><strong>${esc(row.result)}</strong></div>`).join('');
  const chips = (items: (string | number | null)[]) => `<div class="slide-widget-chips">${items.map(v => `<span class="slide-widget-chip${v === null ? ' is-null' : ''}">${esc(v)}</span>`).join('')}</div>`;
  const button = (label: string, attr: string) => `<button type="button" ${attr}>${esc(label)}</button>`;
  const playback = button('Reproduzir', 'data-widget-play') + button('Próximo', 'data-widget-next') + button('Reiniciar', 'data-widget-reset');
  try {
    const config = parseSlideInteractive(source);
    if (config.type === 'scene') {
      const frame = config.frames.find(f => f.id === config.initial)!;
      return `<div class="slide-widget slide-widget-scene" data-scene-align="${config.align ?? 'left'}" data-slide-widget="scene" data-widget-config="${esc(JSON.stringify(config))}" role="group" aria-label="${esc(config.title)}"><div class="slide-widget-live" aria-live="polite" aria-atomic="true">${renderSlideScene(config, frame)}</div><div class="slide-widget-print">${renderSlideScene(config, frame)}</div>${config.frames.map(f => `<template data-scene-frame="${esc(f.id)}">${renderSlideScene(config, f)}</template>`).join('')}</div>`;
    }
    let controls = '', body = '', snapshot = '';
    if (config.type === 'steps' || config.type === 'compare') {
      body = config.states.map(state => {
        let code = state.code ? esc(state.code) : '';
        if (state.code && state.focus) {
          const index = state.code.indexOf(state.focus);
          code = esc(state.code.slice(0, index)) + '<mark>' + esc(state.focus) + '</mark>' + esc(state.code.slice(index + state.focus.length));
        }
        return `<div class="slide-widget-state"><h3>${esc(state.label)}</h3><p>${esc(state.text)}</p>${state.value !== undefined ? `<output class="slide-widget-number" data-number="${state.value}">${esc(state.value)}</output>` : ''}${state.chips ? chips(state.chips) : ''}${state.rows ? rows(state.rows) : ''}${state.table ? table(state.table) : ''}${state.code ? `<pre><code>${code}</code></pre>` : ''}</div>`;
      }).join('');
      controls = config.type === 'compare'
        ? config.states.map((s, i) => button(s.label, `data-widget-index="${i}" aria-pressed="false"`)).join('')
        : button('Anterior', 'data-widget-prev') + playback;
    } else if (config.type === 'bars') {
      const refs = config.references ?? ['AVG', 'MAX', 'MIN', 'SUM', 'COUNT'];
      controls = refs.map((r, i) => button(String(r), `data-reference="${i}" aria-pressed="false"`)).join('');
      if (config.mode !== 'aggregate') controls += '<div class="slide-widget-operators">' + (config.operators ?? ['>', '>=', '<', '<=', '=']).map(op => button(op, `data-operator="${esc(op)}" aria-pressed="false"`)).join('') + '</div>';
      if (config.extra) controls += button('+ ' + config.extra.label, 'data-widget-extra');
      controls += button('Reiniciar', 'data-widget-reset');
      const initial = calculateBarInteractive(config, refs[0], config.operators?.[0] ?? '>');
      body = `<div class="slide-widget-live"><div class="slide-widget-chart" role="img" aria-label="${esc(config.title)}">${initial.values.map((v, i) => `<div class="slide-widget-bar${initial.matches[i] ? ' is-match' : ''}" style="height:${v / initial.maximum * 100}%"><span>${v}</span><small>${esc(initial.labels[i])}</small></div>`).join('')}<div class="slide-widget-threshold" style="bottom:${initial.threshold / initial.maximum * 100}%"></div></div><output class="slide-widget-number">${initial.threshold}</output><p class="slide-widget-message"></p></div>`;
      snapshot = table({ headers: ['Item', 'Valor'], rows: initial.values.map((v, i) => [initial.labels[i], v]) }) +
        table({ headers: ['Referência', 'Resultado inicial'], rows: refs.map(r => [String(r), calculateBarInteractive(config, r, '>', false).threshold]) }) +
        (config.extra ? `<p>Ao adicionar ${esc(config.extra.label)}: ${config.extra.value}.</p>` : '');
    } else if (config.type === 'scan') {
      controls = (config.variants ?? []).map((v, i) => button(v.label, `data-variant="${i}" aria-pressed="false"`)).join('') + playback;
      body = `<div class="slide-widget-live">${config.chips ? chips(config.chips) : ''}${rows(config.rows)}<output class="slide-widget-number">0</output><p class="slide-widget-message">Avance ou reproduza a conferência.</p></div>`;
      snapshot = rows(config.rows);
    } else if (config.type === 'group') {
      controls = playback;
      const names = [...new Set(config.items.map(i => i.group))];
      body = `<div class="slide-widget-live"><div class="slide-widget-pool">${config.items.map((i, index) => `<span class="slide-widget-chip" data-item="${index}">${esc(i.label)}: ${i.value}</span>`).join('')}</div><div class="slide-widget-groups">${names.map((name, i) => `<div class="slide-widget-group" data-group="${i}"><strong>${esc(name)}</strong><div class="slide-widget-items"></div><output>0</output></div>`).join('')}</div><p class="slide-widget-message">Distribua os itens e acompanhe os totais.</p></div>`;
      snapshot = table({ headers: ['Grupo', 'Total'], rows: names.map(n => [n, config.items.filter(i => i.group === n).reduce((sum, i) => sum + i.value, 0)]) });
    } else if (config.type === 'reference') {
      const names = config.tables.map(t => t.term);
      const code = config.code.split(/([a-zA-Z_][a-zA-Z0-9_]*)/).map(part => names.includes(part)
        ? `<span class="slide-widget-term" role="button" tabindex="0" data-term="${names.indexOf(part)}">${esc(part)}</span>` : esc(part)).join('');
      body = `<div class="slide-widget-live"><pre><code>${code}</code></pre><div class="slide-widget-tooltip" role="tooltip" hidden></div></div>`;
      snapshot = `<pre><code>${esc(config.code)}</code></pre>` + config.tables.map(t => `<h3>${esc(t.term)}</h3>${table(t)}`).join('');
    }
    return `<div class="slide-widget"${config.type === 'reference' && config.annotationOnly ? ' hidden' : ''} data-slide-widget="${config.type}" data-widget-config="${esc(JSON.stringify(config))}" role="group" aria-label="${esc(config.title)}"><p class="slide-widget-title">${esc(config.title)}</p><div class="slide-widget-controls" hidden>${controls}</div><div class="slide-widget-panels" aria-live="polite" aria-atomic="false">${body}</div><p class="slide-widget-progress" role="status"></p>${snapshot ? `<div class="slide-widget-print">${snapshot}</div>` : ''}</div>`;
  } catch (error) {
    return `<p class="slide-widget-error" role="alert">Interativo inválido: ${esc(error instanceof Error ? error.message : 'Configuração inválida.')}</p>`;
  }
}
