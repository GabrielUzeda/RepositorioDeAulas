import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseSlideInteractive, renderSlideInteractive, type ReferenceInteractive } from './slideInteractive';
import { type SceneInteractive } from './slideScene';
import { generateMarpNextStandaloneHtml } from './marp';
import { migrarExemploFiel, cenasExemplo, originalExemplo } from '../eval/migrarExemploFiel';

const scene: SceneInteractive = {
  type: 'scene', title: 'Mesmas falas', initial: 'a', layout: ['buttons', 'value', 'text'],
  frames: [
    { id: 'a', text: 'Calcule primeiro.', value: '0', buttons: [{ label: 'Iniciar: calcular a média', to: 'b' }] },
    { id: 'b', text: 'Resultado.', value: '143,33', buttons: [{ label: 'Reiniciar', to: 'a' }], next: { to: 'c', delay: 500 } },
    { id: 'c', text: 'Compare agora.', buttons: [{ label: 'Reiniciar', to: 'a' }] },
  ],
};

describe('Cenas declarativas e migração fiel', () => {
  test('aceita quadros, rótulos próprios e destinos temporizados limitados', () => {
    expect(parseSlideInteractive(JSON.stringify(scene))).toEqual(scene);
    for (const widget of cenasExemplo.widgets) expect(widget.config).toEqual(parseSlideInteractive(JSON.stringify(widget.config)));
    expect(cenasExemplo.widgets.reduce((sum, w) => sum + w.snapshots.length, 0)).toBe(129);
  });

  test('rejeita dados executáveis, destinos ausentes, ciclos automáticos e limites excedidos', () => {
    const withFrame = (frame: object) => ({ ...scene, frames: [{ ...scene.frames[0], ...frame }, ...scene.frames.slice(1)] });
    for (const invalid of [
      { ...scene, initial: 'ausente' }, { ...scene, layout: ['buttons', 'buttons'] },
      { ...scene, layout: ['script'] }, { ...scene, onclick: 'alert(1)' },
      { ...scene, frames: Array(65).fill(scene.frames[0]) },
      withFrame({ id: '"><script>' }), withFrame({ id: 'b' }),
      withFrame({ buttons: [{ label: 'x', to: 'ausente' }] }),
      withFrame({ buttons: [{ label: 'x', to: 'a', onclick: 'alert(1)' }] }),
      withFrame({ next: { to: 'a', delay: 100 } }),
      withFrame({ next: { to: 'b', delay: 10001 } }),
      withFrame({ next: { to: 'ausente', delay: 0 } }),
      withFrame({ code: 'SELECT 1;', focus: 'SELECT 2;' }),
      withFrame({ textRuns: [{ text: 'Outro texto' }] }),
      withFrame({ cells: { columns: 5, values: ['x'] } }),
      withFrame({ chart: { maximum: 10, values: [11], matches: [true], lines: [] } }),
      withFrame({ chips: ['x'], hits: [1] }),
    ]) expect(() => parseSlideInteractive(JSON.stringify(invalid))).toThrow();
    const long = { ...scene, frames: Array.from({ length: 5 }, (_, i) => ({
      id: 'f' + i, buttons: [], ...(i < 4 ? { next: { to: 'f' + (i + 1), delay: 10000 } } : {}),
    })), initial: 'f0' };
    expect(() => parseSlideInteractive(JSON.stringify(long))).toThrow();
  });

  test('escapa todos os campos, inclusive quadros não ativos e texto com ênfase', () => {
    const unsafe = '<script>alert(1)</script>';
    const html = renderSlideInteractive(JSON.stringify({ ...scene, frames: scene.frames.map(f => ({
      ...f, text: unsafe, textRuns: [{ text: unsafe, strong: true, tone: 'danger' }],
      code: unsafe, buttons: [{ label: unsafe, to: 'a' }], rows: [{ label: unsafe, result: unsafe }],
      groups: [{ name: unsafe, total: unsafe, items: [unsafe] }], cells: { columns: 1, values: [unsafe] },
    })) }));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('data-scene-frame="c"');
    expect(html).toContain('aria-live="polite"');
  });

  test('migração é reproduzível, preserva fonte e remove implementação legada', () => {
    const markdown = migrarExemploFiel();
    expect(originalExemplo).toContain('window.subq');
    expect(markdown).not.toMatch(/<(?:script|style)\b/i);
    expect(markdown).not.toContain('window.subq');
    expect([...markdown.matchAll(/"type":"scene"/g)].length).toBe(18);
    expect(markdown).toContain('"annotationOnly":true');
    const html = generateMarpNextStandaloneHtml('Fiel', markdown);
    expect(html).not.toContain('role="alert"');
    for (const script of html.matchAll(/<script(?![^>]*src=)>([\s\S]*?)<\/script>/g)) expect(() => new Function(script[1])).not.toThrow();
  });

  test('cena, parser, runtime e CSS são idênticos na prévia e no standalone', () => {
    if (!existsSync(join(import.meta.dir, '../../frontend/src/shared'))) return;
    for (const file of ['slideScene.ts', 'slideInteractive.ts', 'slideInteractiveRuntime.ts', 'marpTheme.css']) {
      expect(readFileSync(join(import.meta.dir, file), 'utf8')).toBe(readFileSync(join(import.meta.dir, '../../frontend/src/shared', file), 'utf8'));
    }
  });

  test('referência silenciosa exige escopo da aula sem inserir conteúdo visível', () => {
    const reference: ReferenceInteractive = { type: 'reference', title: 'Dados', code: 'clientes', annotationOnly: true, scope: 'deck',
      tables: [{ term: 'clientes', headers: ['id'], rows: [[1]] }] };
    expect(parseSlideInteractive(JSON.stringify(reference))).toEqual(reference);
    expect(renderSlideInteractive(JSON.stringify(reference))).toContain('class="slide-widget" hidden');
    expect(() => parseSlideInteractive(JSON.stringify({ ...reference, scope: 'widget' }))).toThrow();
  });

  test('chart aceita matches e lines ausentes e rows aceita linha sem valor', () => {
    const raw = JSON.stringify({ ...scene, layout: ['buttons', 'rows', 'chart'], frames: [{
      id: 'a', buttons: [{ label: 'Ir', to: 'a' }],
      chart: { values: [130, 100, 200], maximum: 200 },
      rows: [{ label: 'Pedido 1' }, { label: 'Pedido 2', result: '100', muted: true }],
    }] });
    const parsed = parseSlideInteractive(raw);
    expect(parsed.type).toBe('scene');
    if (parsed.type !== 'scene') return;
    expect(parsed.frames[0].chart?.matches).toBeUndefined();
    const html = renderSlideInteractive(raw);
    expect(html).not.toContain('slide-widget-error');
    expect(html).toContain('slide-widget-row');
    expect(html).toContain('100');
  });

  test('linha com value é normalizada para result', () => {
    const raw = JSON.stringify({ ...scene, frames: [{ id: 'a', buttons: [{ label: 'Ir', to: 'a' }], rows: [{ label: 'Pedido 1', value: '130', active: true }, { label: 'Pedido 2', result: '100' }] }] });
    const parsed = parseSlideInteractive(raw);
    expect(parsed.type).toBe('scene');
    if (parsed.type !== 'scene') return;
    expect(parsed.frames[0].rows).toEqual([{ label: 'Pedido 1', result: '130', active: true }, { label: 'Pedido 2', result: '100' }]);
    expect(renderSlideInteractive(raw)).toContain('130');
    expect(renderSlideInteractive(raw)).not.toContain('slide-widget-error');
  });

  test('rejeita apelidos inválidos ou conflitantes sem apagar dados', () => {
    for (const row of [
      { label: 'Ana', value: 230 },
      { label: 'Ana', value: null },
      { label: 'Ana', value: {} },
      { label: 'Ana', value: 'x'.repeat(101) },
      { label: 'Ana', result: '230', value: '360' },
      { label: 'Ana', result: '230', value: false },
      { label: 'Ana', result: '230', script: 'alert(1)' },
    ]) {
      const raw = JSON.stringify({ ...scene, frames: [{ id: 'a', buttons: [], rows: [row] }] });
      expect(() => parseSlideInteractive(raw)).toThrow();
      expect(renderSlideInteractive(raw)).toContain('role="alert"');
    }
    const parsed = parseSlideInteractive(JSON.stringify({ ...scene, frames: [
      { id: 'a', buttons: [], rows: [{ label: 'Ana', result: '230', value: '230' }] },
    ] }));
    if (parsed.type !== 'scene') throw new Error('Esperava scene.');
    expect(parsed.frames[0].rows).toEqual([{ label: 'Ana', result: '230' }]);
  });

  test('layout só aceita strings conhecidas, nunca coerção de arrays ou valores vazios', () => {
    for (const field of [null, false, 0, '', [], ['buttons'], {}]) {
      expect(() => parseSlideInteractive(JSON.stringify({ ...scene, layout: [field] }))).toThrow('layout');
    }
  });

  test('limites opcionais continuam estritos e diagnóstico identifica a causa', () => {
    for (const [frame, error] of [
      [{ chart: { values: [1], maximum: 0 } }, 'maximum'],
      [{ chart: { values: [1], maximum: 2, matches: [] } }, 'matches'],
      [{ chart: { values: [1], maximum: 2, matches: ['true'] } }, 'matches'],
      [{ chart: { values: [1], maximum: 2, lines: null } }, 'chart'],
      [{ chart: { values: [1], maximum: 2, lines: [{ label: 'Fora', value: 3 }] } }, 'linha do chart'],
      [{ chart: { values: [1], maximum: 2, type: 'bar' } }, 'aceitas:'],
      [{ rows: [{ label: 'Ana', active: 'true' }] }, 'rows'],
      [{ rows: [{ result: '230' }] }, 'rows'],
      [{ focus: 'x'.repeat(101), code: 'x'.repeat(101) }, 'focus'],
      [{ next: { to: 'a', delay: -1 } }, 'next.delay'],
    ] as const) {
      expect(() => parseSlideInteractive(JSON.stringify({ ...scene, frames: [
        { id: 'a', buttons: [], ...frame },
      ] }))).toThrow(error);
    }
  });

  test('exemplos da skill do agente são aceitos pelo motor, inclusive scene', () => {
    const skill = join(import.meta.dir, '../../.agents/skills/marp-slides-interativos/SKILL.md');
    if (!existsSync(skill)) return;
    const blocks = [...readFileSync(skill, 'utf8').matchAll(/```interactive\n([\s\S]*?)\n```/g)];
    expect(blocks.length).toBe(7);
    const types = blocks.map(block => parseSlideInteractive(block[1]).type);
    expect(types).toContain('scene');
  });
});
