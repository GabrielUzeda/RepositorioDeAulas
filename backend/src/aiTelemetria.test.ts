import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { db } from './db';
import { registrarTelemetriaAi } from './aiTelemetria';
import { callAi } from './aiProvider';

const ENV_KEYS = [
  'AI_PROVIDER',
  'AI_BASE_URL',
  'AI_API_KEY',
  'AI_MODEL',
  'AI_FALLBACK_MODEL',
] as const;

const originalEnv = new Map<string, string | undefined>();
let server: ReturnType<typeof Bun.serve>;

beforeAll(() => {
  for (const key of ENV_KEYS) originalEnv.set(key, process.env[key]);

  server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(): Promise<Response> {
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"ok": true}' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    },
  });

  process.env.AI_PROVIDER = 'openai';
  process.env.AI_BASE_URL = `http://127.0.0.1:${server.port}/v1`;
  process.env.AI_API_KEY = 'chave-de-teste';
  process.env.AI_MODEL = 'modelo-telemetria';
  process.env.AI_FALLBACK_MODEL = '';
});

afterAll(() => {
  server.stop(true);
  for (const [key, val] of originalEnv.entries()) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
  db.query("DELETE FROM ai_geracoes WHERE tarefa IN ('teste-telemetria', 'default', 'questoes') AND modelo = 'modelo-telemetria'").run();
});

describe('aiTelemetria: registro sem PII (MT-11)', () => {
  test('registrarTelemetriaAi grava metricas agregadas sem nenhum conteudo textual', () => {
    registrarTelemetriaAi({
      tarefa: 'teste-telemetria',
      modelo: 'modelo-x',
      prompt_chars: 1234,
      tokens_prompt: 100,
      tokens_completion: 50,
      duracao_ms: 987,
      valido: true,
      reparos: 1,
    });

    const row = db
      .query(
        "SELECT tarefa, modelo, prompt_chars, tokens_prompt, tokens_completion, duracao_ms, valido, reparos FROM ai_geracoes WHERE tarefa = 'teste-telemetria' ORDER BY id DESC LIMIT 1"
      )
      .get() as any;

    expect(row.tarefa).toBe('teste-telemetria');
    expect(row.modelo).toBe('modelo-x');
    expect(row.prompt_chars).toBe(1234);
    expect(row.tokens_prompt).toBe(100);
    expect(row.tokens_completion).toBe(50);
    expect(row.duracao_ms).toBe(987);
    expect(row.valido).toBe(1);
    expect(row.reparos).toBe(1);

    const colunas = db.query('PRAGMA table_info(ai_geracoes)').all() as Array<{ name: string }>;
    const nomes = colunas.map((c) => c.name).join(',');
    expect(nomes).not.toMatch(/prompt$|resposta|content|texto/i);
  });

  test('callAi bem-sucedida registra linha com a tarefa e o modelo usados', async () => {
    const res = await callAi({
      messages: [
        { role: 'system', content: 'Sistema' },
        { role: 'user', content: 'Pergunta de teste' },
      ],
      temperature: 0.3,
      task: 'questoes',
    });
    expect(res.content).toContain('ok');

    const row = db
      .query(
        "SELECT tarefa, modelo, valido FROM ai_geracoes WHERE tarefa = 'questoes' ORDER BY id DESC LIMIT 1"
      )
      .get() as any;
    expect(row.tarefa).toBe('questoes');
    expect(row.modelo).toBe('modelo-telemetria');
    expect(row.valido).toBe(1);
  });

  test('runDataRetentionPurge inclui expurgo de ai_geracoes', async () => {
    const { runDataRetentionPurge } = await import('./db');
    const res = await runDataRetentionPurge();
    expect(res).toHaveProperty('ai_geracoes');
    expect(typeof res.ai_geracoes).toBe('number');
  });
});
