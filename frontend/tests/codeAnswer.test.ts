import { describe, expect, test } from 'bun:test';
import {
  LINGUAGENS_CODIGO,
  codigoParaHtml,
  desescaparHtml,
  ehRespostaEmCodigo,
  extrairCodigoDoHtml,
  normalizarLinguagem,
} from '../src/shared/utils/codeAnswer';

describe('normalizarLinguagem', () => {
  test('reconhece ids válidos e aliases conhecidos', () => {
    expect(normalizarLinguagem('javascript')).toBe('javascript');
    expect(normalizarLinguagem('JS')).toBe('javascript');
    expect(normalizarLinguagem('ts')).toBe('typescript');
    expect(normalizarLinguagem('py')).toBe('python');
    expect(normalizarLinguagem('postgres')).toBe('sql');
    expect(normalizarLinguagem('Vue')).toBe('html');
  });

  test('cai em texto quando ausente ou desconhecida', () => {
    expect(normalizarLinguagem('')).toBe('texto');
    expect(normalizarLinguagem(null)).toBe('texto');
    expect(normalizarLinguagem(undefined)).toBe('texto');
    expect(normalizarLinguagem('cobol')).toBe('texto');
  });

  test('o catálogo não tem ids repetidos e começa com texto', () => {
    const ids = LINGUAGENS_CODIGO.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('texto');
  });
});

describe('desescaparHtml', () => {
  test('decodifica entidades nomeadas e numéricas', () => {
    expect(desescaparHtml('&lt;div&gt;')).toBe('<div>');
    expect(desescaparHtml('a &amp; b')).toBe('a & b');
    expect(desescaparHtml('&quot;x&quot;')).toBe('"x"');
    expect(desescaparHtml('&#039;a&#39;b')).toBe("'a'b");
    expect(desescaparHtml('&#65;&#x42;')).toBe('AB');
  });

  test('não decodifica duas vezes uma entidade escapada', () => {
    expect(desescaparHtml('&amp;lt;')).toBe('&lt;');
    expect(desescaparHtml('&amp;#39;')).toBe('&#39;');
    expect(desescaparHtml('&amp;nbsp;')).toBe('&nbsp;');
  });

  test('texto vazio devolve string vazia', () => {
    expect(desescaparHtml('')).toBe('');
  });
});

describe('codigoParaHtml / extrairCodigoDoHtml', () => {
  const casos: Array<{ nome: string; codigo: string; linguagem: string }> = [
    { nome: 'código simples', codigo: 'let x = 10;\nconsole.log(x + 5);', linguagem: 'javascript' },
    { nome: 'aspas e apóstrofos', codigo: 'const s = "a\'b";', linguagem: 'javascript' },
    { nome: 'operador E bit a bit', codigo: 'a && b || c', linguagem: 'javascript' },
    { nome: 'tags literais', codigo: '<div class="x">a</div>', linguagem: 'html' },
    { nome: 'expressões comparativas', codigo: 'if (a < b && c > d) { return; }', linguagem: 'python' },
    { nome: 'entidades literais', codigo: 'print("&lt;escapado&gt; &amp; &#39;")', linguagem: 'python' },
    { nome: 'aspas duplas escapadas', codigo: 'SELECT * FROM t WHERE nome = "O\'Brien";', linguagem: 'sql' },
    { nome: 'quebra final', codigo: 'def f():\n    return 1\n', linguagem: 'python' },
    { nome: 'linhas em branco', codigo: 'a\n\n\nb', linguagem: 'texto' },
    { nome: 'indentação com tabs', codigo: '\tif (x) {\n\t\treturn 1;\n\t}', linguagem: 'css' },
    { nome: 'acentuação e emoji', codigo: 'const msg = "ação café";', linguagem: 'json' },
    { nome: 'sem linguagem informada', codigo: 'algum texto', linguagem: 'desconhecida' },
  ];

  for (const caso of casos) {
    test(`preserva exatamente o conteúdo: ${caso.nome}`, () => {
      const html = codigoParaHtml(caso.codigo, caso.linguagem);
      const extraido = extrairCodigoDoHtml(html);
      expect(extraido).not.toBeNull();
      expect(extraido?.codigo).toBe(caso.codigo);
      expect(extraido?.linguagem).toBe(normalizarLinguagem(caso.linguagem));
      expect(ehRespostaEmCodigo(html)).toBe(true);
    });
  }

  test('é estável em ciclos repetidos de serialização', () => {
    const original = 'if (a < b) {\n  s = "x & y";\n}\n';
    let html = codigoParaHtml(original, 'javascript');
    for (let i = 0; i < 5; i++) {
      const extraido = extrairCodigoDoHtml(html);
      expect(extraido?.codigo).toBe(original);
      html = codigoParaHtml(extraido!.codigo, extraido!.linguagem);
    }
    expect(extrairCodigoDoHtml(html)?.codigo).toBe(original);
  });

  test('sem classe language quando a linguagem é texto', () => {
    const html = codigoParaHtml('a < b', 'texto');
    expect(html).toBe('<pre><code>a &lt; b</code></pre>');
    expect(extrairCodigoDoHtml(html)?.linguagem).toBe('texto');
  });

  test('reconhece bloco de código dentro de HTML mais amplo', () => {
    const html = '<p>Analise:</p><pre><code class="language-python">print(1)</code></pre>';
    expect(extrairCodigoDoHtml(html)).toEqual({ codigo: 'print(1)', linguagem: 'python' });
  });

  test('converte quebras herdadas de contenteditable', () => {
    expect(extrairCodigoDoHtml('<pre><code>linha1<br>linha2<div>linha3</div></code></pre>')?.codigo).toBe('linha1\nlinha2\nlinha3');
    expect(extrairCodigoDoHtml('<pre><code><div>a</div><div>b</div></code></pre>')?.codigo).toBe('a\nb');
    expect(extrairCodigoDoHtml('<pre><code><p>a</p><p>b</p></code></pre>')?.codigo).toBe('a\nb');
  });

  test('mantém o miolo intacto quando não há tags (formato atual)', () => {
    const codigo = '  <\n  a & b\n';
    const html = codigoParaHtml(codigo, 'texto');
    expect(html).toBe('<pre><code>  &lt;\n  a &amp; b\n</code></pre>');
    expect(extrairCodigoDoHtml(html)?.codigo).toBe(codigo);
  });

  test('devolve null quando não há bloco de código', () => {
    expect(extrairCodigoDoHtml('<p>resposta textual</p>')).toBeNull();
    expect(extrairCodigoDoHtml('')).toBeNull();
    expect(extrairCodigoDoHtml(null)).toBeNull();
    expect(extrairCodigoDoHtml(undefined)).toBeNull();
    expect(ehRespostaEmCodigo('<p>resposta textual</p>')).toBe(false);
  });
});
