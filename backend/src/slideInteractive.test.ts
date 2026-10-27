import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseSlideInteractive, renderSlideInteractive, type StateInteractive } from './slideInteractive';
import { mountSlideInteractives } from './slideInteractiveRuntime';
import { validarSlideMarp } from './aiAula';
import { generateMarpNextStandaloneHtml } from './marp';
import { SKILL_RECURSOS_RENDER } from './aiSkillRenderer';

const config: StateInteractive = {
  type: 'compare',
  title: 'NULL no relatório',
  states: [
    { label: 'Sem COALESCE', text: 'Carla: NULL', code: 'SELECT NULL;' },
    { label: 'Com COALESCE', text: 'Carla: 0', code: 'SELECT COALESCE(NULL, 0);' },
  ],
};

describe('Interativos nativos', () => {
  test('valida o contrato e rejeita tipos, campos e limites inválidos', () => {
    expect(parseSlideInteractive(JSON.stringify(config))).toEqual(config);
    expect(parseSlideInteractive(JSON.stringify({ ...config, type: 'steps' })).type).toBe('steps');
    for (const invalid of [
      null, [], { ...config, type: 'sql-runner' }, { ...config, script: 'alert(1)' },
      { ...config, states: [] }, { ...config, states: Array(7).fill(config.states[0]) },
      { ...config, title: 'x'.repeat(101) },
      { ...config, states: [{ label: 'A', text: 'x', code: Array(13).fill('x').join('\n') }, config.states[1]] },
      { ...config, states: [{ label: 'A', text: 'x', onclick: 'alert(1)' }, config.states[1]] },
    ]) expect(() => parseSlideInteractive(JSON.stringify(invalid))).toThrow();
    expect(() => parseSlideInteractive('{')).toThrow();
    expect(() => parseSlideInteractive('x'.repeat(12001))).toThrow();
  });

  test('referências e operadores não aceitam arrays por coerção para string', () => {
    const bars = { type: 'bars', title: 'Valores', values: [1, 2], labels: ['A', 'B'] };
    for (const fields of [
      { references: [['AVG']] }, { references: [{}] },
      { operators: [['>']] }, { operators: [null] },
    ]) expect(() => parseSlideInteractive(JSON.stringify({ ...bars, ...fields }))).toThrow();
    expect(parseSlideInteractive(JSON.stringify({ ...bars, references: ['AVG', 1], operators: ['>', '='] })).type).toBe('bars');
  });

  test('reparo recebe diagnóstico do campo exato do estado', () => {
    for (const [fields, message] of [
      [{ label: '' }, 'label'],
      [{ text: '' }, 'text'],
      [{ code: 'x'.repeat(801) }, 'code'],
      [{ code: 'SELECT 1', focus: 'SELECT 2' }, 'focus'],
      [{ value: '230' }, 'value'],
      [{ rows: [{ label: 'Ana', result: 230 }] }, 'rows'],
      [{ chips: Array(13).fill('x') }, 'chips'],
      [{ table: { headers: ['id'], rows: [[1, 2]] } }, 'table'],
    ] as const) {
      expect(() => parseSlideInteractive(JSON.stringify({
        ...config, states: [{ ...config.states[0], ...fields }, config.states[1]],
      }))).toThrow(message);
    }
  });

  test('escapa todo conteúdo e não injeta scripts ou HTML dos dados', () => {
    const unsafe = '<img src=x onerror=alert(1)><script>alert(1)</script>';
    const html = renderSlideInteractive(JSON.stringify({ ...config, title: unsafe, states: config.states.map(() => ({ label: unsafe, text: unsafe, code: unsafe })) }));
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(renderSlideInteractive('{}')).toContain('role="alert"');
  });

  test('diagnóstico usado nas duas vias aponta JSON inválido', () => {
    expect(validarSlideMarp('## Exemplo\n\n```interactive\n{}\n```').join(' ')).toContain('Interativo inválido');
    expect(validarSlideMarp('## Exemplo\n\n```interactive\n' + JSON.stringify(config) + '\n```')).toEqual([]);
    expect(validarSlideMarp('## Código\n\n```text\n{}\n```')).toEqual([]);
  });

  test('standalone contém componente e runtime autocontido, não JSON literal', () => {
    const html = generateMarpNextStandaloneHtml('Teste', '## Exemplo\n\n```interactive\n' + JSON.stringify(config) + '\n```');
    expect(html).toContain('data-slide-widget="compare"');
    expect(html).not.toContain('language-interactive');
    expect(html).toContain('SELECT COALESCE(NULL, 0);');
    expect(html).toContain('.slide-widget-state[hidden] { display: block !important; }');
    expect(() => new Function('return (' + mountSlideInteractives.toString() + ')')).not.toThrow();
  });

  test('todos os exemplos da skill interna são aceitos pelo motor', () => {
    const blocks = [...SKILL_RECURSOS_RENDER.matchAll(/```interactive\n([\s\S]*?)\n```/g)];
    expect(blocks.length).toBe(8);
    expect(blocks.map(b => JSON.parse(b[1]).type)).toContain('scene');
    for (const block of blocks) expect(() => parseSlideInteractive(block[1])).not.toThrow();
  });

  test('runtime e tema mantêm paridade com a prévia quando o checkout completo está disponível', () => {
    const frontend = join(import.meta.dir, '../../frontend/src/shared');
    const backend = import.meta.dir;
    if (!existsSync(frontend)) return;
    for (const file of ['slideInteractive.ts', 'slideInteractiveRuntime.ts', 'marpTheme.css']) {
      expect(readFileSync(join(backend, file), 'utf8')).toBe(readFileSync(join(frontend, file), 'utf8'));
    }
  });
});
