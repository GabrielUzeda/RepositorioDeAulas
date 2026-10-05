import { describe, expect, test } from 'bun:test';
import {
  diagnosticarOutline,
  dividirEmSlides,
  gerarFrontMatterEPrimeiroSlide,
  parseOutline,
  promptSecaoAula,
  removerFrontMatterRestante,
  validarAulaMarp,
  validarSlideMarp,
} from './aiAula';

function outlineValido(): import('./aiAula').AulaOutline {
  return {
    titulo: 'Estruturas de repeticao em Python',
    subtitulo: 'Do while ao for',
    objetivos: ['Compreender iteracao'],
    prerequisitos: ['Variaveis'],
    secoes: [
      {
        titulo: 'Conceito de iteracao',
        slides: [
          { titulo: 'O problema do trabalho repetitivo', objetivo: 'Motivar', conceitos_novos: ['iteracao'], recurso: 'texto' },
          { titulo: 'Checando pre-requisitos', objetivo: 'Recapitular', conceitos_novos: [], recurso: 'texto' },
          { titulo: 'A estrutura while', objetivo: 'Ensinar sintaxe', conceitos_novos: ['while'], recurso: 'codigo' },
          { titulo: 'Condicao de parada', objetivo: 'Ensinar', conceitos_novos: ['condicao de parada'], recurso: 'texto' },
          { titulo: 'While na pratica', objetivo: 'Exemplificar', conceitos_novos: [], recurso: 'codigo' },
        ],
      },
      {
        titulo: 'Lacos contados',
        slides: [
          { titulo: 'A estrutura for', objetivo: 'Ensinar sintaxe', conceitos_novos: ['for'], recurso: 'codigo' },
          { titulo: 'A funcao range', objetivo: 'Ensinar', conceitos_novos: ['range'], recurso: 'codigo' },
          { titulo: 'Percurso em sequencias', objetivo: 'Aplicar', conceitos_novos: ['percurso'], recurso: 'texto' },
          { titulo: 'Comparando while e for', objetivo: 'Consolidar', conceitos_novos: [], recurso: 'tabela' },
          { titulo: 'Erros comuns', objetivo: 'Prevencionar', conceitos_novos: ['loop infinito'], recurso: 'texto' },
          { titulo: 'Aplicacao guiada', objetivo: 'Consolidar', conceitos_novos: [], recurso: 'codigo' },
        ],
      },
    ],
    fixacao: [
      'Explique a diferenca entre while e for.',
      'Quando usar cada estrutura?',
      'Como evitar um loop infinito?',
    ],
  };
}

describe('aiAula: outline', () => {
  test('parseOutline extrai JSON de resposta com fences', () => {
    const content = '```json\n' + JSON.stringify(outlineValido()) + '\n```';
    const outline = parseOutline(content);
    expect(outline).not.toBeNull();
    expect(outline?.titulo).toBe('Estruturas de repeticao em Python');
  });

  test('diagnosticarOutline aprova um outline consistente', () => {
    expect(diagnosticarOutline(outlineValido())).toEqual([]);
  });

  test('diagnosticarOutline detecta conceito duplicado e fixacao fora da faixa', () => {
    const outline = outlineValido();
    outline.secoes[1].slides[2].conceitos_novos = ['iteracao'];
    const erros = diagnosticarOutline(outline);
    expect(erros.some((e) => e.includes('duplicado'))).toBe(true);
  });

  test('diagnosticarOutline detecta faixa de slides acima do maximo', () => {
    const outline = outlineValido();
    outline.secoes[1].slides.push({ titulo: 'Extra', objetivo: 'X', conceitos_novos: ['extra'], recurso: 'texto' });
    outline.secoes[1].slides.push({ titulo: 'Extra 2', objetivo: 'X', conceitos_novos: ['extra2'], recurso: 'texto' });
    outline.secoes[1].slides.push({ titulo: 'Extra 3', objetivo: 'X', conceitos_novos: ['extra3'], recurso: 'texto' });
    outline.secoes[1].slides.push({ titulo: 'Extra 4', objetivo: 'X', conceitos_novos: ['extra4'], recurso: 'texto' });
    outline.secoes[1].slides.push({ titulo: 'Extra 5', objetivo: 'X', conceitos_novos: ['extra5'], recurso: 'texto' });
    outline.secoes[1].slides.push({ titulo: 'Extra 6', objetivo: 'X', conceitos_novos: ['extra6'], recurso: 'texto' });
    const erros = diagnosticarOutline(outline);
    expect(erros.some((e) => e.includes('Total de slides'))).toBe(true);
  });

  test('diagnosticarOutline recusa outline null ou sem secoes', () => {
    expect(diagnosticarOutline(null).length).toBeGreaterThan(0);
    expect(diagnosticarOutline({ titulo: 'X' }).some((e) => e.includes('Lista de secoes'))).toBe(true);
  });
});

describe('aiAula: validacao de slides Marp', () => {
  test('dividirEmSlides respeita front-matter e fences', () => {
    const md = [
      '---',
      'marp: true',
      '---',
      '',
      '# Titulo',
      '',
      '---',
      '',
      '## Slide 2',
      '',
      '```python',
      'x = 1',
      '---',
      'y = 2',
      '```',
      '',
      '---',
      '',
      '## Slide 3',
    ].join('\n');
    const slides = dividirEmSlides(md);
    expect(slides.length).toBe(3);
    expect(slides[2]).toContain('## Slide 3');
  });

  test('validarSlideMarp detecta fence aberta, $$ aberto e tag HTML aberta', () => {
    expect(validarSlideMarp('## A\n\n```python\nx = 1').length).toBeGreaterThan(0);
    expect(validarSlideMarp('## B\n\n$$\nx^2').length).toBeGreaterThan(0);
    expect(validarSlideMarp('## C\n\n<div>abc\n<span>x</span>').length).toBeGreaterThan(0);
    expect(validarSlideMarp('## D\n\n```mermaid\nmathFluxo LR\nA --> B\n```').some((e) =>
      e.includes('mermaid')
    )).toBe(true);
    expect(validarSlideMarp('## OK\n\n```mermaid\nflowchart LR\nA --> B\n```\n\n$$\nx^2\n$$\n\n<div>ok</div>').length).toBe(0);
  });

  test('validarAulaMarp avalia aula completa e aponta slide do erro', () => {
    const md = [
      '---',
      'marp: true',
      '---',
      '# Aula',
      '',
      '---',
      '## Slide com erro',
      '<style> .x { }',
      'Texto',
    ].join('\n');
    const res = validarAulaMarp(md);
    expect(res.valido).toBe(false);
    expect(res.erros.some((e) => e.startsWith('Slide 2: Tag <style>'))).toBe(true);
  });

  test('validarAulaMarp aprova aula limpa', () => {
    const md = [
      '---',
      'marp: true',
      '---',
      '# Aula',
      '',
      '---',
      '## Slide 1',
      'Conteudo com **negrito**.',
      '',
      '---',
      '## Fixacao',
      '- Pergunta 1?',
    ].join('\n');
    expect(validarAulaMarp(md)).toEqual({ valido: true, erros: [] });
  });
});

describe('aiAula: montagem e sanitizacao de secao', () => {
  test('gerarFrontMatterEPrimeiroSlide gera capa deterministica', () => {
    const md = gerarFrontMatterEPrimeiroSlide(outlineValido(), 'Prof. Ana');
    expect(md.startsWith('---\nmarp: true')).toBe(true);
    expect(md).toContain('title: Estruturas de repeticao em Python');
    expect(md).toContain('# Estruturas de repeticao em Python');
    expect(md).toContain('## Do while ao for');
    expect(md).toContain('**Prof. Ana**');
  });

  test('removerFrontMatterRestante limpa front-matter, fences e --- espurios da secao', () => {
    const secao = '---\nmarp: true\n---\n## Slide\nTexto\n---\n';
    expect(removerFrontMatterRestante(secao)).toBe('## Slide\nTexto');
    const secaoFence = '```markdown\n## Slide X\nConteudo\n```';
    expect(removerFrontMatterRestante(secaoFence)).toBe('## Slide X\nConteudo');
  });

  test('promptSecaoAula inclui secao, conceitos cobertos e proibe front-matter', () => {
    const outline = outlineValido();
    const { systemPrompt, userPrompt } = promptSecaoAula({
      outline,
      indiceSecao: 1,
      conceitosJaCobertos: ['iteracao', 'while'],
      titulosSlidesAnteriores: ['# Conceito de iteracao', '## A estrutura while'],
      contextoLimpo: 'Contexto limpo da aula anterior.',
    });
    expect(systemPrompt).toContain('APENAS os slides da seção "Lacos contados"');
    expect(systemPrompt).toContain('sem front-matter');
    expect(userPrompt).toContain('SEÇÃO ATUAL (2 de 2)');
    expect(userPrompt).toContain('A estrutura for');
    expect(userPrompt).toContain('- iteracao');
    expect(userPrompt).toContain('Contexto limpo da aula anterior.');
  });
});
