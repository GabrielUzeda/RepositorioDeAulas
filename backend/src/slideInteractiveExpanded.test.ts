import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import MarkdownIt from 'markdown-it';
import { calculateBarInteractive, parseSlideInteractive, renderSlideInteractive, type BarInteractive } from './slideInteractive';
import { generateMarpNextStandaloneHtml } from './marp';

const bars: BarInteractive = { type: 'bars', title: 'Valores', labels: ['A', 'B', 'C'], values: [130, 100, 200], extra: { label: 'D', value: 300 } };
const fixture = JSON.parse(readFileSync(join(import.meta.dir, '../eval/referencias/interativos-subconsultas.json'), 'utf8'));
const markdown = readFileSync(join(import.meta.dir, '../eval/referencias/subconsultas-modular.md'), 'utf8');

describe('Cobertura dos recursos de examplo.md', () => {
  test('cálculos, filtros, agregações e inclusão de dados usam valores reais', () => {
    expect(calculateBarInteractive(bars, 'AVG', '>').threshold).toBeCloseTo(143.33333);
    expect(calculateBarInteractive(bars, 'AVG', '>').matches).toEqual([false, false, true]);
    expect(calculateBarInteractive(bars, 'AVG', '>', true).threshold).toBe(182.5);
    for (const [op, result] of [['>', [false, false, true]], ['>=', [true, false, true]], ['<', [false, true, false]], ['<=', [true, true, false]], ['=', [true, false, false]]] as const) {
      expect(calculateBarInteractive(bars, 130, op).matches).toEqual([...result]);
    }
    for (const [ref, expected] of [['SUM', 430], ['COUNT', 3], ['MIN', 100], ['MAX', 200]] as const) expect(calculateBarInteractive(bars, ref, '>').threshold).toBe(expected);
    expect(calculateBarInteractive({ ...bars, mode: 'aggregate' }, 'MAX', '>').matches).toEqual([false, false, true]);
    expect(calculateBarInteractive({ ...bars, values: [0, 0, 0] }, 'AVG', '>').maximum).toBe(1);
  });

  test('todos os 18 widgets originais e a referência são nativos e válidos', () => {
    expect(fixture.widgets.length).toBe(18);
    const tokens = new MarkdownIt({ html: true }).parse(markdown, {}).filter(t => t.type === 'fence' && t.info.trim() === 'interactive');
    expect(tokens.length).toBe(19);
    for (const token of tokens) {
      expect(() => parseSlideInteractive(token.content)).not.toThrow();
      expect(renderSlideInteractive(token.content)).not.toContain('role="alert"');
    }
    expect(markdown).not.toMatch(/<(?:script|style)\b/i);
    expect(markdown).not.toContain('subq.');
    const html = generateMarpNextStandaloneHtml('Modular', markdown);
    expect(html).not.toContain('language-interactive');
    expect(html).toContain('data-slide-widget="group"');
    expect(html).toContain('data-slide-widget="reference"');
    for (const script of html.matchAll(/<script(?![^>]*src=)>([\s\S]*?)<\/script>/g)) expect(() => new Function(script[1])).not.toThrow();
  });

  test('estados visuais distinguem matches e valores nulos sem HTML cru', () => {
    const html = renderSlideInteractive(JSON.stringify({ type: 'compare', title: 'Dados', states: [
      { label: 'Antes', text: 'Nulo', chips: [null], rows: [{ label: 'A', result: '<ok>', match: true }] },
      { label: 'Depois', text: 'Zero', chips: [0], rows: [{ label: 'B', result: 'ausente', muted: true }] },
    ] }));
    expect(html).toContain('slide-widget-chip is-null');
    expect(html).toContain('slide-widget-row is-match');
    expect(html).toContain('slide-widget-row is-muted');
    expect(html).toContain('&lt;ok&gt;');
  });

  test('rejeita configurações desconhecidas ou inconsistentes das novas famílias', () => {
    for (const invalid of [
      { ...bars, values: [-1] }, { ...bars, labels: ['A'] }, { ...bars, references: ['MEDIAN'] },
      { ...bars, operators: ['eval'] }, { ...bars, extra: { label: 'D', value: -2 } },
      { type: 'group', title: 'x', items: [{ label: 'A', group: 'x', value: '10' }] },
      { type: 'scan', title: 'x', rows: [{ label: 'A', result: 'ok', match: 'true' }] },
      { type: 'reference', title: 'x', code: 'A', tables: [{ term: 'A', headers: ['x'], rows: [[1, 2]] }] },
      { type: 'reference', title: 'x', code: 'A', tables: [{ term: '<img>', headers: ['x'], rows: [[1]] }] },
    ]) expect(() => parseSlideInteractive(JSON.stringify(invalid))).toThrow();
  });
});
