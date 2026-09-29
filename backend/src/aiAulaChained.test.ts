import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { signJwt } from './auth';
import app from './routes';
import { generateAulaOutlineAndContent } from './ai';
import { createJob, dispatchJob, getJob } from './aiJobs';
import { db } from './db';

describe('AI Chained 2-Step Lesson Generation with Checkpoints', () => {
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
      async fetch(request: Request): Promise<Response> {
        const bodyText = await request.text();
        const isPlanner = bodyText.includes('planejar a estrutura') || bodyText.includes('outline pedagógico');
        const content = isPlanner
          ? 'Outline detalhado da aula planejado com sucesso.'
          : '---\ntheme: default\ntitle: Aula Chained Test\n---\n\n# Titulo da Aula\n\n## Slide 1\n\nConteúdo gerado.';
        return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    process.env.AI_PROVIDER = 'openai';
    process.env.AI_BASE_URL = `http://127.0.0.1:${server.port}/v1`;
    process.env.AI_API_KEY = 'chave-teste';
    process.env.AI_MODEL = 'modelo-chained-test';
    process.env.AI_FALLBACK_MODEL = '';
  });

  afterAll(() => {
    server?.stop();
    for (const [key, val] of originalEnv.entries()) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  test('generateAulaOutlineAndContent executa 2 etapas e invoca checkpoints', async () => {
    const checkpoints: string[] = [];
    const checkpointFn = async (prog: string) => {
      checkpoints.push(prog);
    };

    const res = await generateAulaOutlineAndContent({
      tema: 'Programacao Assincrona',
      observacoes: 'Focar em Promises e async/await',
      checkpoint: checkpointFn,
    });

    expect(res.success).toBe(true);
    expect(res.conteudo_md).toContain('---');
    expect(res.titulo_sugerido).toBe('Aula Chained Test');
    expect(checkpoints.length).toBeGreaterThan(0);
    expect(checkpoints.some((c) => c.includes('35%'))).toBe(true);
    expect(checkpoints.some((c) => c.includes('85%'))).toBe(true);
  });

  test('generateAulaOutlineAndContent interrompe se isCancelled() retornar true', async () => {
    let callCount = 0;
    const isCancelledFn = () => {
      callCount++;
      return callCount > 1;
    };

    let errorThrown: any = null;
    try {
      await generateAulaOutlineAndContent({
        tema: 'Cancelamento Teste',
        isCancelled: isCancelledFn,
      });
    } catch (e) {
      errorThrown = e;
    }

    expect(errorThrown).not.toBeNull();
    expect(errorThrown.message).toContain('cancelado');
  });

  test('POST /ai/generate-aula com async: true retorna 202 e job_id', async () => {
    const adminToken = await signJwt({ sub: '1', email: 'admin@escola.com', role: 'admin' });
    const res = await app.request('/ai/generate-aula', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ tema: 'Assincronicidade', async: true }),
    });

    expect(res.status).toBe(202);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.job_id).toBeTruthy();
    expect(data.status).toBe('pendente');
  });

  test('Execução e conclusão de job do tipo aula via dispatchJob', async () => {
    const job = createJob('aula', { tema: 'Job Dispatch Test' }, false);
    expect(job).toBeTruthy();
    expect(job.status).toBe('pendente');

    await dispatchJob(job.id);
    const completedJob = getJob(job.id);
    expect(completedJob?.status).toBe('concluido');
    expect(completedJob?.resultado).toBeTruthy();
    expect(completedJob?.resultado.conteudo_md).toContain('---');
  });
});
