import { describe, expect, test } from 'bun:test';
import {
  diagnosticarOutline,
  dividirEmSlides,
  gerarFrontMatterEPrimeiroSlide,
  inserirSeparadoresAusentes,
  normalizarOutline,
  parseOutline,
  promptPlanejadorAula,
  promptSecaoAula,
  promptAulaDireta,
  removerFrontMatterRestante,
  renderBlocoFechamento,
  repararSlideMarp,
  repararSlidesDoConteudo,
  avisosDensidade,
  validarAulaMarp,
  validarDensidadeSlide,
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

  test('normalizarOutline remove conceito repetido entre secoes em vez de reprovar', () => {
    const base = outlineValido();
    const outline = normalizarOutline({ ...base, secoes: base.secoes.map((s, i) => (i === 1 ? { ...s, conceitos: ['while', 'for'] } : s)) });
    expect(outline?.secoes[1].conceitos).toEqual(['for']);
  });

  test('diagnosticarOutline detecta poucas secoes e secao sem conceito', () => {
    const outline = outlineValido();
    outline.secoes = outline.secoes.slice(0, 1);
    outline.secoes[0].conceitos = [];
    const erros = diagnosticarOutline(outline);
    expect(erros.some((e) => e.includes('Secoes'))).toBe(true);
    expect(erros.some((e) => e.includes('nenhum conceito'))).toBe(true);
  });

  test('sintese e material complementar sao opcionais e limitados na normalizacao', () => {
    const outline = outlineValido();
    outline.sintese = [];
    outline.material_complementar = [];
    expect(diagnosticarOutline(outline)).toEqual([]);
    const bruto = { ...outlineValido(), material_complementar: [{ titulo: 'A', detalhe: 'x', url: 'ftp://invalido' }, ...Array.from({ length: 9 }, (_, i) => ({ titulo: 'R' + i, detalhe: '' }))] };
    const norm = normalizarOutline(bruto);
    expect(norm?.material_complementar.length).toBe(5);
    expect(norm?.material_complementar[0].url).toBeUndefined();
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

  test('validarDensidadeSlide acusa slide longo e aprova slide curto', () => {
    const curto = ['## Titulo', '- item 1', '- item 2'].join('\n');
    expect(validarDensidadeSlide(curto)).toEqual([]);
    const longo = ['## Titulo', ...Array.from({ length: 40 }, (_, i) => `linha densa ${i}`)].join('\n');
    expect(validarDensidadeSlide(longo).some((e) => e.includes('conteudo demais'))).toBe(true);
  });

  test('densidade nao bloqueia a secao e aparece como aviso', () => {
    const densa = ['## Titulo', ...Array.from({ length: 40 }, (_, i) => `texto ${i}`)].join('\n');
    expect(validarSecaoMarp(densa)).toEqual([]);
    expect(avisosDensidade(densa).some((e) => e.startsWith('Slide 1:') && e.includes('conteudo demais'))).toBe(true);
  });

  test('inserirSeparadoresAusentes separa titulos consecutivos sem tocar nos separadores existentes', () => {
    const md = [
      '# Secao',
      '',
      'Abertura.',
      '',
      '## Primeiro topico',
      '',
      'Texto.',
      '',
      '---',
      '',
      '## Segundo topico',
      '',
      'Texto.',
      '',
      '## Terceiro topico',
    ].join('\n');
    const corrigido = inserirSeparadoresAusentes(md);
    const slides = dividirEmSlides(corrigido);
    expect(slides.length).toBe(4);
    expect(corrigido).not.toContain('---\n\n---');
  });

  test('inserirSeparadoresAusentes ignora titulos dentro de blocos de codigo', () => {
    const md = ['# Secao', '', '```md', '# nao e slide', '## tambem nao', '```', '', '## Slide real'].join('\n');
    const corrigido = inserirSeparadoresAusentes(md);
    expect(dividirEmSlides(corrigido).length).toBe(2);
    expect(corrigido).toContain('# nao e slide');
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
    expect(systemPrompt).toContain(':fas-nome:');
    expect(systemPrompt).not.toContain(':fa-solid fa-nome:');
    expect(systemPrompt).not.toContain('SKILL: RECURSOS INTERATIVOS');
    expect(systemPrompt).not.toMatch(/Total de \d+ a \d+ slides/);
  });

  test('promptSecaoAula proibe slides de fechamento e nao impoe contagem de slides', () => {
    const { systemPrompt, userPrompt } = promptSecaoAula({ outline: outlineValido(), indiceSecao: 0 });
    expect(systemPrompt).toContain('PRINCÍPIOS DIDÁTICOS');
    expect(systemPrompt).toContain('PROIBIDO criar slides de "Reflexão"');
    expect(systemPrompt).toContain('SEPARADOR OBRIGATÓRIO');
    expect(systemPrompt).toContain('LIMITE VERTICAL');
    expect(systemPrompt).toContain('SKILL: RECURSOS INTERATIVOS');
    expect(systemPrompt).toContain('GSAP 3.12.5 já vem carregado');
    expect(systemPrompt).toContain(':fas-nome:');
    expect(systemPrompt).not.toMatch(/Total de \d+ a \d+ slides/);
    expect(userPrompt).toContain('SEÇÃO ATUAL (1 de 3)');
    expect(userPrompt).toContain('ANALOGIA CONDUTORA');
    expect(userPrompt).toContain('Uma fila de banco');
    expect(userPrompt).toContain('OUTRAS SEÇÕES DA AULA');
    expect(userPrompt).toContain('- Seção 2 (Lacos contados): for, range');
  });

  test('promptAulaDireta embute densidade de 10-30 linhas, linearidade sem vazamentos e regras negativas', () => {
    const { systemPrompt, userPrompt } = promptAulaDireta({ tema: 'Joins em SQL' });
    expect(systemPrompt).toContain('GeracaoDidaticaAutoAvaliativa');
    expect(systemPrompt).toContain('mínimo de 10 linhas e máximo de 25-30 linhas');
    expect(systemPrompt).toContain('EXPLICAR ANTES DE CITAR');
    expect(systemPrompt).toContain('PROIBIDO VAZAMENTO DE CONTEÚDO');
    expect(systemPrompt).toContain('SEM TERMOS VAGOS OU GENÉRICOS');
    expect(systemPrompt).toContain('SKILL: RECURSOS INTERATIVOS');
    expect(systemPrompt).toContain('NÃO IMPORTAR');
    expect(systemPrompt).toContain('Não incluir metadados: "Público-Alvo", "Duração"');
    expect(userPrompt).toContain('TEMA DA AULA: Joins em SQL');
  });
});
