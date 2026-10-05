import { describe, expect, test } from 'bun:test';
import { contemHtml, escaparHtml, htmlParaTexto, sanitizarHtml } from '../src/shared/utils/sanitizeHtml';

describe('contemHtml', () => {
  test('detecta tags do subconjunto permitido', () => {
    expect(contemHtml('<p>Enunciado</p>')).toBe(true);
    expect(contemHtml('Texto com <strong>destaque</strong>')).toBe(true);
    expect(contemHtml('<pre><code>x = 1;</code></pre>')).toBe(true);
  });

  test('não considera HTML texto puro, vazio ou comparações soltas', () => {
    expect(contemHtml('Enunciado em texto puro')).toBe(false);
    expect(contemHtml('')).toBe(false);
    expect(contemHtml(undefined)).toBe(false);
    expect(contemHtml('Se a < b então')).toBe(false);
  });
});

describe('escaparHtml', () => {
  test('escapa os caracteres sensíveis de HTML', () => {
    expect(escaparHtml('if (a < b && c > d) { alert("x"); }')).toBe(
      'if (a &lt; b &amp;&amp; c &gt; d) { alert(&quot;x&quot;); }'
    );
    expect(escaparHtml("<script>alert('x')</script>")).toBe(
      '&lt;script&gt;alert(&#039;x&#039;)&lt;/script&gt;'
    );
  });
});

describe('sanitizarHtml sem DOM (fallback seguro)', () => {
  test('no runtime sem DOMParser devolve o conteúdo escapado, nunca markup executável', () => {
    const entrada = '<p>Veja <strong>isso</strong></p><script>alert(1)</script>';
    const saida = sanitizarHtml(entrada);
    expect(saida).not.toContain('<script>');
    expect(saida).toContain('&lt;script&gt;');
    expect(sanitizarHtml('')).toBe('');
  });
});

describe('htmlParaTexto', () => {
  test('converte HTML permitido em texto com quebras e sem tags', () => {
    const html = '<p>Analise o código:</p><pre><code>let a = 1;</code></pre><p>Qual o valor?</p>';
    const texto = htmlParaTexto(html);
    expect(texto).not.toContain('<');
    expect(texto).toContain('Analise o código:');
    expect(texto).toContain('let a = 1;');
    expect(texto).toContain('Qual o valor?');
  });

  test('mantém texto puro intacto e desescapa entidades', () => {
    expect(htmlParaTexto('Questão simples')).toBe('Questão simples');
    expect(htmlParaTexto('<p>a &lt; b &amp;&amp; c</p>')).toBe('a < b && c');
    expect(htmlParaTexto(null)).toBe('');
  });
});
