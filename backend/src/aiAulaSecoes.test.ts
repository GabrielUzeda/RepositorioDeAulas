import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { generateAulaOutlineAndContent } from './ai';

const OUTLINE_MOCK = JSON.stringify({
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
    { titulo: 'PEP 8', detalhe: 'Convencoes de estilo.' },
  ],
});

describe('aiAula: geracao por secoes', () => {
  const ENV_KEYS = ['AI_PROVIDER', 'AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL', 'AI_FALLBACK_MODEL'] as const;

  const originalEnv = new Map<string, string | undefined>();
  let server: ReturnType<typeof Bun.serve>;
  const chamadas: { planner: string[]; secao: string[] } = { planner: [], secao: [] };

  const secaoMock = (indice: number) =>
    `# Secao ${indice} do conteudo\n\n## Abertura da secao\n\nTexto curto com **destaque** e um exemplo:\n\n\`\`\`python\ncontador = 0\n\`\`\`\n\n---\n\n## Fechamento da secao\n\nOutro texto curto, sem repetir o que ja foi visto.\n`;

  beforeAll(() => {
    for (const key of ENV_KEYS) originalEnv.set(key, process.env[key]);

    server = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      async fetch(request: Request): Promise<Response> {
        const raw = await request.text();
        const decodificado =
          (JSON.parse(raw) as { messages?: Array<{ content?: string }> })
            .messages?.map((m) => m.content || '')
            .join('\n') || '';

        if (decodificado.includes('coordenador pedagógico e designer instrucional sênior')) {
          chamadas.planner.push(decodificado);
          return new Response(JSON.stringify({ choices: [{ message: { content: OUTLINE_MOCK } }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (decodificado.includes('Você redige os slides de UMA seção')) {
          chamadas.secao.push(decodificado);
          const m = decodificado.match(/SEÇÃO ATUAL \((\d+) de (\d+)\)/);
          const idx = m ? Number(m[1]) : 1;
          return new Response(JSON.stringify({ choices: [{ message: { content: secaoMock(idx) } }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    process.env.AI_PROVIDER = 'openai';
    process.env.AI_BASE_URL = `http://127.0.0.1:${server.port}/v1`;
    process.env.AI_API_KEY = 'chave-de-teste';
    process.env.AI_MODEL = 'modelo-mock-secoes';
    process.env.AI_FALLBACK_MODEL = '';
  });

  afterAll(() => {
    server?.stop(true);
    for (const [key, val] of originalEnv.entries()) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  test('gera capa, secoes encadeadas e fechamento com progresso incremental', async () => {
    const checkpoints: string[] = [];
    const res = await generateAulaOutlineAndContent({
      tema: 'Estruturas de repeticao em Python',
      checkpoint: async (prog: string) => {
        checkpoints.push(prog);
      },
    });

    expect(res.success).toBe(true);
    expect(chamadas.planner.length).toBe(1);
    expect(chamadas.secao.length).toBe(3);
    expect(res.avisos).toBeUndefined();

    expect(checkpoints.some((c) => c.includes('Redigindo seção 1 de 3'))).toBe(true);
    expect(checkpoints.some((c) => c.includes('Redigindo seção 3 de 3'))).toBe(true);
    expect(checkpoints.some((c) => c.startsWith('35%'))).toBe(true);

    const md = res.conteudo_md;
    expect(md.startsWith('---\nmarp: true')).toBe(true);
    expect(md).toContain('title: Estruturas de repeticao em Python');
    expect(md).toContain('# Estruturas de repeticao em Python');
    expect(md).toContain('# Secao 1 do conteudo');
    expect(md).toContain('# Secao 2 do conteudo');
    expect(md).toContain('# Secao 3 do conteudo');
    expect(md).toContain('## Sintese do percurso');
    expect(md).toContain('## Verifique o que voce aprendeu');
    expect(md).toContain('## Material Complementar');
    expect(md).toContain('1. Explique a diferenca entre while e for.');

    const secoes = chamadas.secao;
    expect(secoes[0]).toContain('SEÇÃO ATUAL (1 de 3): Conceito de iteracao');
    expect(secoes[1]).toContain('CONCEITOS JÁ COBERTOS (não repetir):');
    expect(secoes[1]).toContain('- iteracao');
    expect(secoes[2]).toContain('- range');
  });

  test('isCancelled entre secoes interrompe a geracao', async () => {
    let cancelado = false;
    await expect(
      generateAulaOutlineAndContent({
        tema: 'Cancelamento por secao',
        isCancelled: () => {
          const valor = cancelado;
          cancelado = true;
          return valor;
        },
      })
    ).rejects.toThrow('Job cancelado pelo usuário');
  });
});
