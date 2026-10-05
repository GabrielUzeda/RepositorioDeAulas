import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { generateAulaOutlineAndContent } from './ai';

describe('aiAula: geracao por secoes (MT-10)', () => {
  const ENV_KEYS = [
    'AI_PROVIDER',
    'AI_BASE_URL',
    'AI_API_KEY',
    'AI_MODEL',
    'AI_FALLBACK_MODEL',
  ] as const;

  const originalEnv = new Map<string, string | undefined>();
  let server: ReturnType<typeof Bun.serve>;
  const chamadas: { planner: string[]; secao: string[]; escritorUnico: string[] } = {
    planner: [],
    secao: [],
    escritorUnico: [],
  };

  const secaoMock = (prefixo: string) =>
    `# ${prefixo} do conteudo\n\n## Abertura da secao\nTexto balanceado com *lista fragmentada*.\n\n---\n\n## Fechamento da secao\nOutro texto curto.\n`;

  const outlineMock = JSON.stringify({
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
        ],
      },
    ],
    fixacao: ['Explique a diferenca entre while e for.', 'Quando usar cada estrutura?', 'Como evitar um loop infinito?'],
  });

  beforeAll(() => {
    for (const key of ENV_KEYS) originalEnv.set(key, process.env[key]);

    server = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      async fetch(request: Request): Promise<Response> {
        const raw = await request.text();
        const decodificado = (JSON.parse(raw) as { messages?: Array<{ content?: string }> })
          .messages?.map((m) => m.content || '')
          .join('\n') || '';

        if (decodificado.includes('planejar a estrutura')) {
          chamadas.planner.push(decodificado);
          return new Response(
            JSON.stringify({ choices: [{ message: { content: outlineMock } }] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (decodificado.includes('APENAS os slides da seção')) {
          chamadas.secao.push(decodificado);
          const m = decodificado.match(/SEÇÃO ATUAL \((\d+) de (\d+)\)/);
          const idx = m ? Number(m[1]) : 1;
          return new Response(
            JSON.stringify({
              choices: [{ message: { content: secaoMock(`Secao ${idx}`) } }],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        chamadas.escritorUnico.push(decodificado);
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '---\nmarp: true\n---\n# Unica\n' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
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

  test('gera capa, secoes encadeadas e fixacao com progresso incremental', async () => {
    const checkpoints: string[] = [];
    const res = await generateAulaOutlineAndContent({
      tema: 'Estruturas de repeticao em Python',
      checkpoint: async (prog: string) => {
        checkpoints.push(prog);
      },
    });

    expect(res.success).toBe(true);
    expect(chamadas.planner.length).toBe(1);
    expect(chamadas.secao.length).toBe(2);
    expect(chamadas.escritorUnico.length).toBe(0);

    expect(checkpoints.some((c) => c.includes('Redigindo seção 1 de 2'))).toBe(true);
    expect(checkpoints.some((c) => c.includes('Redigindo seção 2 de 2'))).toBe(true);
    expect(checkpoints.some((c) => c.startsWith('35%'))).toBe(true);
    expect(checkpoints.some((c) => c.startsWith('58%'))).toBe(true);

    expect(res.outline).toContain('Lacos contados');
    expect(res.avisos).toBeUndefined();

    const md = res.conteudo_md;
    expect(md.startsWith('---\nmarp: true')).toBe(true);
    expect(md).toContain('title: Estruturas de repeticao em Python');
    expect(md).toContain('# Estruturas de repeticao em Python');
    expect(md).toContain('# Secao 1 do conteudo');
    expect(md).toContain('# Secao 2 do conteudo');
    expect(md).toContain('## Verifique o que você aprendeu');
    expect(md).toContain('- Explique a diferenca entre while e for.');

    const resumo = res as { titulo_sugerido?: string };
    expect(resumo.titulo_sugerido).toBe('Estruturas de repeticao em Python');

    const secoes = chamadas.secao;
    expect(secoes[0]).toContain('SEÇÃO ATUAL (1 de 2): Conceito de iteracao');
    expect(secoes[1]).toContain('SEÇÃO ATUAL (2 de 2): Lacos contados');
    expect(secoes[1]).toContain('A estrutura for');
    expect(secoes[1]).not.toContain('CONCEITOS JÁ COBERTOS (não repetir):\n- \n');
    expect(secoes[1]).toContain('- iteracao');
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
