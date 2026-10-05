import { describe, it, expect, test } from 'bun:test';
import {
  diagnosticarQuestoes,
  normalizarQuestoesComRubrica,
  montarPromptQuestoes,
  converterMarkdownParaHtmlPermitido,
  validarHtmlEnunciado,
} from './aiQuestoes';

describe('aiQuestoes', () => {
  it('diagnosticarQuestoes detecta quantidade errada e títulos genéricos', () => {
    const questoes = [
      { title: 'Questão 1', content: 'Enunciado muito curto' },
    ];
    const erros = diagnosticarQuestoes(questoes, { qtdSolicitada: 2, tipo: 'objetiva' });
    expect(erros.length).toBeGreaterThan(0);
    expect(erros.some((e) => e.includes('diferente da solicitada'))).toBe(true);
    expect(erros.some((e) => e.includes('Título genérico'))).toBe(true);
  });

  it('diagnosticarQuestoes valida objetivas (alternativas, correta única, duplicatas)', () => {
    const questoes = [
      {
        title: 'Tema Válido',
        content: 'Enunciado detalhado e longo o suficiente para passar na validação.',
        options: [
          { text: 'Alt A', correct: true },
          { text: 'Alt A', correct: true },
          { text: 'Alt C', correct: false },
          { text: 'Alt D', correct: false },
        ],
      },
    ];
    const erros = diagnosticarQuestoes(questoes, { qtdSolicitada: 1, tipo: 'minigame' });
    expect(erros.some((e) => e.includes('Exatamente 1 alternativa'))).toBe(true);
    expect(erros.some((e) => e.includes('duplicada'))).toBe(true);
  });

  it('diagnosticarQuestoes valida discursivas (resposta esperada e rubrica)', () => {
    const questoes = [
      {
        title: 'Análise Crítica',
        content: 'Descreva detalhadamente o processo estudado nas aulas.',
        resposta_esperada: 'Curta',
        rubrica: [{ criterio: 'A', peso: 10 }],
      },
    ];
    const erros = diagnosticarQuestoes(questoes, { qtdSolicitada: 1, tipo: 'normal' });
    expect(erros.some((e) => e.includes('resposta_esperada'))).toBe(true);
    expect(erros.some((e) => e.includes('rubrica'))).toBe(true);
  });

  it('normalizarQuestoesComRubrica normaliza pesos da rubrica para somar 100 e não força correct no índice 0', () => {
    const questoes = [
      {
        title: 'Discursiva',
        content: 'Explique o conceito.',
        resposta_esperada: 'Resposta esperada longa com mais de 15 caracteres.',
        rubrica: [
          { criterio: 'Crit 1', peso: 30 },
          { criterio: 'Crit 2', peso: 30 },
        ],
      },
      {
        title: 'Objetiva',
        content: 'Selecione a correta.',
        options: [
          { text: 'Errada 1', correct: false },
          { text: 'Correta', correct: true },
        ],
      },
    ];

    const normalizadas = normalizarQuestoesComRubrica(questoes, 'normal');
    expect(normalizadas[0].rubrica[0].peso).toBe(50);
    expect(normalizadas[0].rubrica[1].peso).toBe(50);

    // Garantir que options[0].correct não foi alterado para true se já era false
    expect(normalizadas[1].options[0].correct).toBe(false);
    expect(normalizadas[1].options[1].correct).toBe(true);
  });

  it('montarPromptQuestoes gera prompts válidos', () => {
    const prompts = montarPromptQuestoes({
      tipo: 'objetiva',
      titulo: 'Atividade 1',
      tema: 'Matemática',
      observacoes: 'Focar em álgebra',
      quantidade: 2,
      aulasContexto: 'Aula 1...',
      docsContexto: 'Doc 1...',
      questoes_existentes: [],
    });

    expect(prompts.systemPrompt).toContain('objetiva');
    expect(prompts.userPrompt).toContain('Matemática');
  });
});

describe('formatacao rica do enunciado (HTML permitido)', () => {
  test('converterMarkdownParaHtmlPermitido converte fences em pre/code escapado', () => {
    const md = 'Analise:\n```javascript\nif (a < b && c > d) { alert("&"); }\n```';
    const html = converterMarkdownParaHtmlPermitido(md);
    expect(html).toContain('<pre><code class="language-javascript">');
    expect(html).toContain('if (a &lt; b &amp;&amp; c &gt; d)');
    expect(html).not.toContain('<b'); // nada de tag crua dentro do código
  });

  test('converterMarkdownParaHtmlPermitido mantém texto sem fences intacto', () => {
    expect(converterMarkdownParaHtmlPermitido('Questão simples sem código.')).toBe(
      'Questão simples sem código.'
    );
  });

  test('validarHtmlEnunciado aprova subconjunto permitido e recusa tags perigosas e desbalanceadas', () => {
    const ok = '<p>Analise <strong>este código</strong>:</p><pre><code>x = 1;</code></pre>';
    expect(validarHtmlEnunciado(ok)).toEqual([]);

    const comScript = '<p>Veja</p><script>alert(1)</script>';
    expect(validarHtmlEnunciado(comScript).some((e) => e.includes('não permitidos'))).toBe(true);

    const desbalanceada = '<p>Texto em <strong>negrito</p>';
    expect(validarHtmlEnunciado(desbalanceada).some((e) => e.includes('<strong>'))).toBe(true);
  });

  test('diagnosticarQuestoes acusa enunciado com HTML inválido', () => {
    const questoes = [
      {
        title: 'Conceito de closures',
        content: '<p>Texto</p><script>fetch("/x")</script>',
        options: [
          { text: 'A', correct: true },
          { text: 'B', correct: false },
          { text: 'C', correct: false },
          { text: 'D', correct: false },
        ],
      },
    ];
    const erros = diagnosticarQuestoes(questoes, { qtdSolicitada: 1, tipo: 'normal' });
    expect(erros.some((e) => e.includes('não permitidos'))).toBe(true);
  });
});
