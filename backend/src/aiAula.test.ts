import { describe, expect, test } from 'bun:test';
import {
  diagnosticarOutline,
  dividirEmSlides,
  gerarFrontMatterEPrimeiroSlide,
  normalizarOutline,
  parseOutline,
  promptPlanejadorAula,
  promptSecaoAula,
  removerFrontMatterRestante,
  renderBlocoFechamento,
  repararSlideMarp,
  repararSlidesDoConteudo,
  validarAulaMarp,
  validarSecaoMarp,
  validarSlideMarp,
  type AulaOutline,
} from './aiAula';

function outlineValido(): AulaOutline {
  return {
    titulo: 'Estruturas de repeticao em Python',
    subtitulo: 'Do while ao for',
    objetivos: ['Compreender iteracao', 'Escolher entre while e for'],
    prerequisitos: ['Variaveis', 'Condicionais'],
    secoes: [
      {
        titulo: 'Conceito de iteracao',
        proposito: 'Entender por que repetir instrucoes',
        conceitos: ['iteracao', 'while'],
        analogia: 'Uma fila de banco',
        exemplo: 'contador = 0',
      },
      {
        titulo: 'Lacos contados',
        proposito: 'Percorrer sequencias com for',
        conceitos: ['for', 'range'],
        analogia: 'Uma lista de chamada',
      },
      {
        titulo: 'Erros comuns',
        proposito: 'Evitar laco infinito',
        conceitos: ['loop infinito'],
      },
    ],
    sintese: [
      { conceito: 'iteracao', resumo: 'Repetir instrucoes enquanto a condicao valer.' },
      { conceito: 'while', resumo: 'Repete enquanto a condicao for verdadeira.' },
      { conceito: 'for', resumo: 'Percorre uma sequencia conhecida.' },
      { conceito: 'range', resumo: 'Gera a sequencia de numeros do laco.' },
    ],
    fixacao: [
      'Explique a diferenca entre while e for.',
      'Quando usar cada estrutura?',
      'Como evitar um loop infinito?',
    ],
    material_complementar: [
      { titulo: 'Python Tutorial', detalhe: 'Capitulo sobre estruturas de controle.', url: 'https://docs.python.org/3/tutorial/' },
      { titulo: 'Pense em Python', detalhe: 'Capitulos sobre iteracao.' },
      { titulo: 'PEP 8', detalhe: 'Convencoes de estilo.', url: 'https://peps.python.org/pep-0008/' },
    ],
  };
}

describe('aiAula: outline', () => {
  test('parseOutline extrai JSON de resposta com fences', () => {
    const content = '```json\n' + JSON.stringify(outlineValido()) + '\n```';
    const outline = parseOutline(content);
    expect(outline).not.toBeNull();
    expect(outline?.titulo).toBe('Estruturas de repeticao em Python');
    expect(outline?.secoes.length).toBe(3);
  });

  test('normalizarOutline aceita o formato legado com slides e conceitos_novos', () => {
    const legado = {
      titulo: 'Aula legada',
      subtitulo: 'Sub',
      objetivos: ['a', 'b'],
      prerequisitos: [],
      secoes: [
        {
          titulo: 'Bloco 1',
          slides: [
            { titulo: 's1', objetivo: 'Motivar', conceitos_novos: ['x'], recurso: 'texto' },
            { titulo: 's2', objetivo: 'Ensinar', conceitos_novos: ['y'], recurso: 'codigo' },
          ],
        },
      ],
      fixacao: ['q1', 'q2', 'q3'],
    };
    const outline = normalizarOutline(legado);
    expect(outline?.secoes[0].conceitos).toEqual(['x', 'y']);
    expect(outline?.secoes[0].proposito).toBe('Motivar');
  });

  test('diagnosticarOutline aprova um outline consistente', () => {
    expect(diagnosticarOutline(outlineValido())).toEqual([]);
  });

  test('diagnosticarOutline detecta conceito duplicado entre secoes', () => {
    const outline = outlineValido();
    outline.secoes[1].conceitos = ['while'];
    const erros = diagnosticarOutline(outline);
    expect(erros.some((e) => e.includes('duplicado'))).toBe(true);
  });

  test('diagnosticarOutline detecta poucas secoes e fixacao fora da faixa', () => {
    const outline = outlineValido();
    outline.secoes = outline.secoes.slice(0, 1);
    outline.fixacao = ['unica'];
    const erros = diagnosticarOutline(outline);
    expect(erros.some((e) => e.includes('Secoes'))).toBe(true);
    expect(erros.some((e) => e.includes('Fixacao'))).toBe(true);
  });

  test('diagnosticarOutline exige sintese e material complementar', () => {
    const outline = outlineValido();
    outline.sintese = [];
    outline.material_complementar = [];
    const erros = diagnosticarOutline(outline);
    expect(erros.some((e) => e.includes('Sintese'))).toBe(true);
    expect(erros.some((e) => e.includes('Material complementar'))).toBe(true);
  });

  test('diagnosticarOutline recusa outline null ou sem secoes', () => {
    expect(diagnosticarOutline(null).length).toBeGreaterThan(0);
    expect(diagnosticarOutline({ titulo: 'X' }).some((e) => e.includes('Secoes'))).toBe(true);
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

  test('validarSlideMarp detecta fence, KaTeX, tags HTML e mermaid invalido', () => {
    expect(validarSlideMarp('## A\n\n```python\nx = 1').length).toBeGreaterThan(0);
    expect(validarSlideMarp('## B\n\n$$\nx^2').length).toBeGreaterThan(0);
    expect(validarSlideMarp('## C\n\n<div>abc\n<span>x</span>').length).toBeGreaterThan(0);
    expect(validarSlideMarp('## E\n\n<pre>abc').length).toBeGreaterThan(0);
    expect(validarSlideMarp('## D\n\n```mermaid\nmathFluxo LR\nA --> B\n```').some((e) =>
      e.includes('mermaid')
    )).toBe(true);
    expect(validarSlideMarp('## OK\n\n```mermaid\nflowchart LR\nA --> B\n```\n\n$$\nx^2\n$$\n\n<div>ok</div>').length).toBe(0);
  });

  test('validarSecaoMarp valida slide a slide sem exigir separador', () => {
    expect(validarSecaoMarp('## Unico slide\n\nTexto ok.')).toEqual([]);
    expect(validarSecaoMarp('')).toEqual(['Secao vazia.']);
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

  test('repararSlideMarp fecha tags HTML, fences e KaTeX no proprio slide', () => {
    const reparado = repararSlideMarp('## C\n\n<style> .x { }\n<div>abc\n```python\nx = 1\n$$\nx^2');
    expect(validarSlideMarp(reparado)).toEqual([]);
  });

  test('repararSlidesDoConteudo conserta cada slide sem vazar para o seguinte', () => {
    const md = ['## Slide 1', '<div>aberto', '', '---', '', '## Slide 2', 'Texto limpo'].join('\n');
    const reparado = repararSlidesDoConteudo(md);
    const slides = dividirEmSlides(reparado);
    expect(slides.length).toBe(2);
    expect(validarSlideMarp(slides[0])).toEqual([]);
    expect(validarSlideMarp(slides[1])).toEqual([]);
    expect(slides[1]).not.toContain('</div>');
  });
});

describe('aiAula: montagem e prompts', () => {
  test('gerarFrontMatterEPrimeiroSlide gera capa deterministica', () => {
    const md = gerarFrontMatterEPrimeiroSlide(outlineValido(), 'Prof. Ana');
    expect(md.startsWith('---\nmarp: true')).toBe(true);
    expect(md).toContain('title: Estruturas de repeticao em Python');
    expect(md).toContain('# Estruturas de repeticao em Python');
    expect(md).toContain('## Do while ao for');
    expect(md).toContain('**Prof. Ana**');
  });

  test('removerFrontMatterRestante limpa front-matter, fences e --- espurios da secao', () => {
    const secao = '---\nmarp: true\n---\n\n# Titulo\n\n---\n\n## Slide\n';
    const limpa = removerFrontMatterRestante(secao);
    expect(limpa.startsWith('# Titulo')).toBe(true);
    expect(limpa.endsWith('## Slide')).toBe(true);
  });

  test('renderBlocoFechamento monta sintese, fixacao e material complementar', () => {
    const bloco = renderBlocoFechamento(outlineValido());
    expect(bloco).toContain('## Sintese do percurso');
    expect(bloco).toContain('| **iteracao** |');
    expect(bloco).toContain('## Verifique o que voce aprendeu');
    expect(bloco).toContain('1. Explique a diferenca entre while e for.');
    expect(bloco).toContain('## Material Complementar');
    expect(bloco).toContain('https://docs.python.org/3/tutorial/');
  });

  test('promptPlanejadorAula embute o guia didatico, o contrato do renderer e o schema JSON', () => {
    const { systemPrompt } = promptPlanejadorAula({ tema: 'Lacos em Python' });
    expect(systemPrompt).toContain('PRINCÍPIOS DIDÁTICOS');
    expect(systemPrompt).toContain('RECURSOS DO MOTOR');
    expect(systemPrompt).toContain('"material_complementar"');
    expect(systemPrompt).not.toMatch(/Total de \d+ a \d+ slides/);
  });

  test('promptSecaoAula proibe slides de fechamento e nao impoe contagem de slides', () => {
    const { systemPrompt, userPrompt } = promptSecaoAula({
      outline: outlineValido(),
      indiceSecao: 0,
      conceitosJaCobertos: [],
      titulosSlidesAnteriores: [],
      contextoLimpo: '',
    });
    expect(systemPrompt).toContain('PRINCÍPIOS DIDÁTICOS');
    expect(systemPrompt).toContain('PROIBIDO criar slides de "Reflexão"');
    expect(systemPrompt).not.toMatch(/Total de \d+ a \d+ slides/);
    expect(userPrompt).toContain('SEÇÃO ATUAL (1 de 3)');
    expect(userPrompt).toContain('ANALOGIA CONDUTORA');
    expect(userPrompt).toContain('Uma fila de banco');
  });
});
