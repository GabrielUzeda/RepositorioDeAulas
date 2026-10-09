import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { ExecucaoAi, diagnosticarAvaliacaoAi } from './aiExecucao';
import { db } from './db';

const keys = ['AI_PROVIDER', 'AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL', 'AI_FALLBACK_MODEL', 'AI_MODEL_QUESTOES'] as const;
const env = new Map<string, string | undefined>();
let server: ReturnType<typeof Bun.serve>;
let requests: Array<{ model: string; messages: Array<{ role: string; content: string }> }> = [];
let handler: () => Response;

function resposta(content: string, usage?: Record<string, number>): Response {
  return Response.json({ choices: [{ message: { content } }], ...(usage ? { usage } : {}) });
}

beforeAll(() => {
  for (const key of keys) env.set(key, process.env[key]);
  server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(request) {
      requests.push(await request.json() as typeof requests[number]);
      return handler();
    },
  });
  process.env.AI_PROVIDER = 'openai';
  process.env.AI_BASE_URL = `http://127.0.0.1:${server.port}/v1`;
  process.env.AI_API_KEY = 'chave-teste';
  process.env.AI_MODEL = 'modelo-execucao';
  process.env.AI_FALLBACK_MODEL = 'reserva-nao-autorizado';
});

beforeEach(() => {
  requests = [];
  delete process.env.AI_MODEL_QUESTOES;
  handler = () => resposta('valido');
});

afterAll(() => {
  server.stop(true);
  for (const [key, value] of env) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const etapa = { messages: [{ role: 'user' as const, content: 'gere' }], diagnose: (content: string) => content === 'valido' ? [] : ['campo obrigatório ausente'] };

describe('ExecucaoAi: orçamento, evidência e falhas explícitas', () => {
  test('repara com diagnóstico e compartilha dois reparos entre etapas sem reiniciar', async () => {
    handler = () => resposta(requests.length % 2 === 1 ? 'invalido' : 'valido');
    const execucao = new ExecucaoAi('questoes', { maxChamadas: 8 });
    await execucao.executar(etapa);
    await execucao.executar(etapa);
    await expect(execucao.executar(etapa)).rejects.toThrow(/Orçamento global de reparos esgotado/);
    expect(requests).toHaveLength(5);
    expect(requests[1].messages[1].content).toBe('invalido');
    expect(requests[1].messages[2].content).toContain('campo obrigatório ausente');
    expect(new Set(requests.map((request) => request.model))).toEqual(new Set(['modelo-execucao']));
    expect(execucao.resumo()).toMatchObject({ estado: 'repair_exhausted', chamadas: 5, reparos: 2 });
    await expect(execucao.executar(etapa)).rejects.toThrow(/Orçamento global/);
    expect(requests).toHaveLength(5);
  });

  test('concorrência não multiplica o orçamento de reparos', async () => {
    handler = () => resposta('invalido');
    const execucao = new ExecucaoAi('sintese', { maxChamadas: 10 });
    const resultados = await Promise.allSettled([execucao.executar(etapa), execucao.executar(etapa)]);
    expect(resultados.every((resultado) => resultado.status === 'rejected')).toBe(true);
    expect(execucao.resumo().reparos).toBe(2);
    expect(requests.length).toBeLessThanOrEqual(4);
  });

  test('429 não faz retry nem fallback e bloqueia chamadas posteriores', async () => {
    handler = () => Response.json({ error: { message: 'quota' } }, { status: 429 });
    const execucao = new ExecucaoAi('avaliacao');
    await expect(execucao.executar(etapa)).rejects.toThrow(/Nenhum modelo substituto/);
    await expect(execucao.executar(etapa)).rejects.toThrow(/Nenhum modelo substituto/);
    expect(requests).toHaveLength(1);
    expect(execucao.resumo()).toMatchObject({ estado: 'provider_failed', reparos: 0 });
  });

  test('modelo por tarefa fica fixo mesmo se o ambiente mudar entre etapas', async () => {
    process.env.AI_MODEL_QUESTOES = 'modelo-questoes';
    const execucao = new ExecucaoAi('questoes', { maxChamadas: 2 });
    await execucao.executar(etapa);
    process.env.AI_MODEL_QUESTOES = 'outro-modelo';
    await execucao.executar(etapa);
    expect(requests.map((request) => request.model)).toEqual(['modelo-questoes', 'modelo-questoes']);
    expect(execucao.concluir().estado).toBe('completed');
    await expect(execucao.executar(etapa)).rejects.toThrow(/já concluída/);
  });

  test('tokens ausentes são null e a telemetria registra falha estrutural sem duplicar', async () => {
    handler = () => resposta(requests.length === 1 ? 'invalido' : 'valido');
    const execucao = new ExecucaoAi('questoes');
    const antes = db.query("SELECT COUNT(*) AS total FROM ai_geracoes WHERE modelo = 'modelo-execucao'").get() as { total: number };
    await execucao.executar(etapa);
    const depois = db.query("SELECT valido, reparos, tokens_prompt FROM ai_geracoes WHERE modelo = 'modelo-execucao' ORDER BY id DESC LIMIT 2").all() as Array<{ valido: number; reparos: number; tokens_prompt: number | null }>;
    const total = db.query("SELECT COUNT(*) AS total FROM ai_geracoes WHERE modelo = 'modelo-execucao'").get() as { total: number };
    expect(total.total - antes.total).toBe(2);
    expect(depois).toEqual([{ valido: 1, reparos: 1, tokens_prompt: null }, { valido: 0, reparos: 0, tokens_prompt: null }]);
    expect(execucao.concluir().tokens_prompt).toBeNull();
  });

  test('tokens conhecidos somam as tentativas e zero conhecido é preservado', async () => {
    handler = () => resposta(requests.length === 1 ? 'invalido' : 'valido', { prompt_tokens: 10, completion_tokens: 0 });
    const execucao = new ExecucaoAi('questoes');
    await execucao.executar(etapa);
    expect(execucao.concluir()).toMatchObject({ tokens_prompt: 20, tokens_completion: 0 });
  });

  test('limite de chamadas e de contexto bloqueiam sem truncar nem chamar o provider', async () => {
    const contexto = new ExecucaoAi('questoes', { maxPromptChars: 2 });
    await expect(contexto.executar(etapa)).rejects.toThrow(/contexto excedeu/);
    expect(requests).toHaveLength(0);
    const chamadas = new ExecucaoAi('questoes', { maxChamadas: 1 });
    await chamadas.executar(etapa);
    await expect(chamadas.executar(etapa)).rejects.toThrow(/Limite global/);
    expect(requests).toHaveLength(1);
  });

  test('cancelamento anterior à chamada não toca a rede', async () => {
    const execucao = new ExecucaoAi('aula', { isCancelled: () => true });
    await expect(execucao.executar(etapa)).rejects.toThrow('Job cancelado pelo usuário');
    expect(requests).toHaveLength(0);
    expect(execucao.resumo().estado).toBe('cancelled');
  });

  test('timeout cobre a leitura do corpo e não só os headers', async () => {
    handler = () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); } }));
    const execucao = new ExecucaoAi('aula', { prazoMs: 1000 });
    await expect(execucao.executar({ ...etapa, timeoutMs: 30 })).rejects.toThrow(/prazo permitido/);
    expect(requests).toHaveLength(1);
    expect(execucao.resumo().estado).toBe('timeout');
  });

  test('cancelamento interrompe uma chamada em andamento', async () => {
    handler = () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); } }));
    let cancelled = false;
    const execucao = new ExecucaoAi('aula', { isCancelled: () => cancelled });
    const pending = execucao.executar({ ...etapa, timeoutMs: 2000 });
    cancelled = true;
    await expect(pending).rejects.toThrow('Job cancelado pelo usuário');
    expect(execucao.resumo().estado).toBe('cancelled');
  });

  test('SSE Anthropic combina message_start e message_delta, incluindo zero informado', async () => {
    const providerAnterior = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = 'anthropic';
    try {
      for (const entrada of [42, 0]) {
        handler = () => new Response([
          `data: ${JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: entrada, output_tokens: 0 } } })}`,
          `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'valido' } })}`,
          `data: ${JSON.stringify({ type: 'message_delta', usage: { output_tokens: 7 } })}`,
          'data: [DONE]',
        ].join('\n\n'), { headers: { 'Content-Type': 'text/event-stream' } });
        const execucao = new ExecucaoAi('questoes');
        expect((await execucao.executar(etapa)).content).toBe('valido');
        expect(execucao.concluir()).toMatchObject({ tokens_prompt: entrada, tokens_completion: 7 });
      }
      expect(requests).toHaveLength(2);
    } finally {
      if (providerAnterior === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = providerAnterior;
    }
  });

  test('diagnóstico de avaliação rejeita notas inválidas e feedback vazio, aceita zero real', () => {
    expect(diagnosticarAvaliacaoAi('{"nota":101,"feedback":""}')).toHaveLength(2);
    expect(diagnosticarAvaliacaoAi('{"nota":"80","feedback":"bom"}')).toHaveLength(1);
    expect(diagnosticarAvaliacaoAi('{"nota":0,"feedback":"Resposta incorreta."}')).toEqual([]);
  });
});
