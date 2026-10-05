import { describe, expect, test } from 'bun:test';
import { escapeHtml, removerTagsHtml, renderEmailHtmlContent, sanitizarHtmlEmail } from './htmlEmail';

describe('htmlEmail: escapeHtml e removerTagsHtml', () => {
  test('escapeHtml cobre os cinco caracteres sensíveis', () => {
    expect(escapeHtml(`<a href="x" onerror='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onerror=&#039;y&#039;&gt;&amp;&lt;/a&gt;'
    );
    expect(escapeHtml(null)).toBe('');
  });

  test('removerTagsHtml descarta tags e normaliza espaços', () => {
    expect(removerTagsHtml('<p>Analise o <strong>código</strong>:</p>')).toBe('Analise o código:');
    expect(removerTagsHtml('<pre><code>if (a &lt; b) {}</code></pre>')).toBe('if (a &lt; b) {}');
    expect(removerTagsHtml(undefined)).toBe('');
  });
});

describe('htmlEmail: sanitizarHtmlEmail (allowlist sem DOM)', () => {
  test('remove blocos perigosos inteiros, inclusive o conteúdo', () => {
    const saida = sanitizarHtmlEmail('Antes<script>alert("xss")</script>Depois');
    expect(saida).not.toContain('<script');
    expect(saida).not.toContain('alert');
    expect(saida).toContain('Antes');
    expect(saida).toContain('Depois');

    expect(sanitizarHtmlEmail('<style>body{display:none}</style>texto')).not.toContain('display:none');
    expect(sanitizarHtmlEmail('<iframe src="https://x"></iframe>texto')).not.toContain('iframe');
  });

  test('descarta tags fora da allowlist preservando o texto interno', () => {
    const saida = sanitizarHtmlEmail('<marquee>oi</marquee> e <img src=x onerror="alert(1)">fim');
    expect(saida).not.toContain('marquee');
    expect(saida).not.toContain('img');
    expect(saida).not.toContain('onerror');
    expect(saida).toContain('oi');
    expect(saida).toContain('fim');
  });

  test('mantém a formatação permitida e injeta estilo fixo em pre/code', () => {
    const saida = sanitizarHtmlEmail('<p>Veja <strong>isto</strong></p><pre><code>let a = 1;</code></pre>');
    expect(saida).toContain('<p>Veja <strong>isto</strong></p>');
    expect(saida).toContain('<pre style=');
    expect(saida).toContain('<code style=');
    expect(saida).toContain('let a = 1;');
  });

  test('preserva o código escapado no bloco, sem quebrar o HTML do e-mail', () => {
    const saida = sanitizarHtmlEmail('<pre><code>if (a &lt; b &amp;&amp; c &gt; d) {}</code></pre>');
    expect(saida).toContain('if (a &lt; b &amp;&amp; c &gt; d) {}');
    expect(saida).not.toContain('alert');
  });

  test('remove todos os atributos de tags sem allowlist de atributo (onclick, class, style)', () => {
    const saida = sanitizarHtmlEmail('<p onclick="alert(1)" class="x" style="color:red">texto</p>');
    expect(saida).toBe('<p>texto</p>');
  });

  test('link só sobrevive com protocolo seguro', () => {
    expect(sanitizarHtmlEmail('<a href="https://escola.com">site</a>')).toBe(
      '<a href="https://escola.com">site</a>'
    );
    expect(sanitizarHtmlEmail('<a href="mailto:x@y.com">email</a>')).toBe(
      '<a href="mailto:x@y.com">email</a>'
    );
    for (const ruim of [
      '<a href="javascript:alert(1)">x</a>',
      '<a href="JaVaScRiPt:alert(1)">x</a>',
      '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>',
      '<a href="vbscript:x">x</a>',
    ]) {
      const saida = sanitizarHtmlEmail(ruim);
      expect(saida).not.toMatch(/javascript:|data:|vbscript:/i);
      expect(saida).toBe('<a>x</a>');
    }
  });

  test('link com atributo extra mantém só o href válido', () => {
    const saida = sanitizarHtmlEmail('<a href="https://x" onclick="y">x</a>');
    expect(saida).toBe('<a href="https://x">x</a>');
    expect(saida).not.toContain('onclick');
  });

  test('escapa texto solto com < e preserva entidades já existentes no código', () => {
    expect(sanitizarHtmlEmail('2 < 3 e 5 > 4')).toBe('2 &lt; 3 e 5 > 4');
    expect(sanitizarHtmlEmail('a & b')).toBe('a &amp; b');
    expect(sanitizarHtmlEmail('<scr<script>ipt>alert(1)</script>')).not.toContain('<script');
    expect(sanitizarHtmlEmail('<img src=x onerror=alert(1)>')).not.toContain('onerror');
    const quebrado = sanitizarHtmlEmail('<p>sem fechar');
    expect(quebrado).toBe('<p>sem fechar');
  });

  test('normaliza tags vazias e texto vazio', () => {
    expect(sanitizarHtmlEmail('<br>')).toBe('<br/>');
    expect(sanitizarHtmlEmail('<br/>')).toBe('<br/>');
    expect(sanitizarHtmlEmail('')).toBe('');
  });
});

describe('htmlEmail: renderEmailHtmlContent', () => {
  test('texto puro é escapado com quebras convertidas em <br/>', () => {
    expect(renderEmailHtmlContent('linha 1\nlinha 2 ok')).toBe('linha 1<br/>linha 2 ok');
  });

  test('conteúdo com tags passa pelo sanitizador', () => {
    const saida = renderEmailHtmlContent('<p>ok</p><script>alert(1)</script>');
    expect(saida).not.toContain('<script');
    expect(saida).toContain('<p>ok</p>');
  });

  test('valor vazio devolve string vazia', () => {
    expect(renderEmailHtmlContent('')).toBe('');
  });
});
