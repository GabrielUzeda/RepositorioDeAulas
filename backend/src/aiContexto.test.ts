import { describe, it, expect } from 'bun:test';
import { markdownParaContexto, distribuirOrcamentoContexto } from './aiContexto';

describe('aiContexto', () => {
  it('remove front-matter YAML', () => {
    const md = '---\ntitle: Test\n---\nConteúdo real';
    expect(markdownParaContexto(md)).toBe('Conteúdo real');
  });

  it('remove style, script e comentários sem corromper genéricos', () => {
    const md = '<style>body{}</style><script>alert()</script><!-- comment -->Map<string, number> List<T>';
    const resultado = markdownParaContexto(md);
    expect(resultado).toContain('Map<string, number>');
    expect(resultado).toContain('List<T>');
    expect(resultado).not.toContain('body');
    expect(resultado).not.toContain('alert');
  });

  it('preserva diagramas mermaid', () => {
    const md = '```mermaid\ngraph TD;\nA-->B;\n```';
    expect(markdownParaContexto(md)).toBe(md);
  });

  it('corta respeitando separador de slide fora de blocos de código', () => {
    const md = 'Slide 1\n---\nSlide 2\n---\nSlide 3 muito longo...'.padEnd(50, 'x');
    const res = markdownParaContexto(md, 20);
    expect(res).toBe('Slide 1\n---');
  });

  it('separador dentro de bloco de código python não causa corte indevido', () => {
    const md = 'Texto\n```python\n---\n```\nFim';
    const res = markdownParaContexto(md, 30);
    expect(res).toContain('```python\n---\n```');
  });

  it('distribuirOrcamentoContexto divide orçamento igualmente e prefixa cabeçalhos', () => {
    const aulas = [
      { titulo: 'Aula 1', conteudo_md: 'Conteudo 1' },
      { titulo: 'Aula 2', conteudo_md: 'Conteudo 2' }
    ];
    const res = distribuirOrcamentoContexto(aulas, 10000);
    expect(res).toContain('--- AULA 1: Aula 1 ---');
    expect(res).toContain('Conteudo 1');
    expect(res).toContain('--- AULA 2: Aula 2 ---');
    expect(res).toContain('Conteudo 2');
  });
});
