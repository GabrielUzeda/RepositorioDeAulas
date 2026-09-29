import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test';
import { signJwt } from './auth';
import app from './routes';
import { generateAulaOutlineAndContent } from './ai';
import { createJob, dispatchJob, getJob, updateJobStatus } from './aiJobs';
import { db } from './db';
import { indexarDocumento } from './documentIndexer';

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
  let globalTestMode = '';

  beforeAll(() => {
    for (const key of ENV_KEYS) originalEnv.set(key, process.env[key]);

    server = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      async fetch(request: Request): Promise<Response> {
        const bodyText = await request.text();
        if (globalTestMode === 'fail_outline' && (bodyText.includes('planejar a estrutura') || bodyText.includes('outline pedagógico'))) {
          return new Response('Internal Server Error', { status: 500 });
        }
        if (globalTestMode === 'fail_slides' && bodyText.includes('Marp Next')) {
          return new Response('Bad Request', { status: 400 });
        }

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

  beforeEach(() => {
    globalTestMode = '';
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

  // Novo Caso 1: RAG context e Aulas anteriores integrados na geração
  test('Caso 1: RAG context e Aulas anteriores integrados na geração', async () => {
    const cursoRes = db.query('INSERT INTO cursos (slug, nome, senha) VALUES (?, ?, NULL)').run('curso-rag-chained-new', 'Curso RAG Chained New');
    const cursoId = Number(cursoRes.lastInsertRowid);
    const discRes = db.query('INSERT INTO disciplinas (curso_id, slug, nome) VALUES (?, ?, ?)').run(cursoId, 'disc-rag-chained-new', 'Disc RAG Chained New');
    const disciplinaId = Number(discRes.lastInsertRowid);
    const aulaRes = db.query("INSERT INTO aulas (disciplina_id, titulo, caminho, descricao, ordem, conteudo_md) VALUES (?, ?, '', '', 1, ?)").run(disciplinaId, 'Aula Anterior RAG', '# Aula Anterior\n\nConceito base.');
    const aulaId = Number(aulaRes.lastInsertRowid);
    const docRes = db.query('INSERT INTO documentos_orientadores (curso_id, disciplina_id, titulo, nome_arquivo, tipo, conteudo_texto, tamanho_bytes) VALUES (NULL, ?, ?, ?, ?, ?, ?)').run(disciplinaId, 'Plano de Ensino RAG', 'plano.txt', 'plano_ensino', 'Conteúdo orientador para IA.', 100);
    const docId = Number(docRes.lastInsertRowid);
    indexarDocumento(docId, null, disciplinaId, 'Plano de Ensino RAG', 'Conteúdo orientador para IA.');

    try {
      const res = await generateAulaOutlineAndContent({
        disciplina_id: disciplinaId,
        tema: 'Avançando com RAG',
        continuar_sequencia: true,
      });
      expect(res.success).toBe(true);
      expect(res.conteudo_md).toBeTruthy();
    } finally {
      db.query('DELETE FROM documento_secoes WHERE documento_id = ?').run(docId);
      db.query('DELETE FROM documentos_orientadores WHERE id = ?').run(docId);
      db.query('DELETE FROM aulas WHERE id = ?').run(aulaId);
      db.query('DELETE FROM disciplinas WHERE id = ?').run(disciplinaId);
      db.query('DELETE FROM cursos WHERE id = ?').run(cursoId);
    }
  });

  // Novo Caso 2: Resiliência da Fase 1 (Fallback de Outline)
  test('Caso 2: Resiliência da Fase 1 (Fallback de Outline)', async () => {
    globalTestMode = 'fail_outline';
    const res = await generateAulaOutlineAndContent({
      tema: 'Fallback Outline Test',
    });
    expect(res.success).toBe(true);
    expect(res.conteudo_md).toContain('---');
    expect(res.outline).toBe('Fallback Outline Test');
  });

  // Novo Caso 3: Tratamento de erro na Fase 2
  test('Caso 3: Tratamento de erro na Fase 2', async () => {
    globalTestMode = 'fail_slides';
    let errorThrown: any = null;
    try {
      await generateAulaOutlineAndContent({
        tema: 'Erro Fase 2 Test',
      });
    } catch (e) {
      errorThrown = e;
    }
    expect(errorThrown).not.toBeNull();
    expect(errorThrown.message).toContain('Falha na expansão de slides com IA');
  });

  // Novo Caso 4: Parsing numérico de progresso no endpoint HTTP GET /ai/jobs/:id
  test('Caso 4: Parsing numérico de progresso no endpoint HTTP GET /ai/jobs/:id', async () => {
    const job = createJob('aula', { tema: 'Job Progress HTTP Test' }, false);
    updateJobStatus(job.id, 'processando', { progresso: '35% - Planejando estrutura...' });
    const adminToken = await signJwt({ sub: '1', email: 'admin@escola.com', role: 'admin' });
    const res = await app.request(`/ai/jobs/${job.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.progress).toBe(35);
    expect(data.step_message).toBe('35% - Planejando estrutura...');
  });

  // Novo Caso 5: Cancelamento de job via endpoint HTTP POST /ai/jobs/:id/cancel
  test('Caso 5: Cancelamento de job via endpoint HTTP POST /ai/jobs/:id/cancel', async () => {
    const job = createJob('aula', { tema: 'Job Cancel HTTP Test' }, false);
    const adminToken = await signJwt({ sub: '1', email: 'admin@escola.com', role: 'admin' });
    const res = await app.request(`/ai/jobs/${job.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    const jobInDb = getJob(job.id);
    expect(jobInDb?.status).toBe('cancelado');
  });

  // Novo Caso 6: Validação de entradas no POST /ai/generate-aula
  test('Caso 6: Validação de entradas no POST /ai/generate-aula', async () => {
    const adminToken = await signJwt({ sub: '1', email: 'admin@escola.com', role: 'admin' });
    const res = await app.request('/ai/generate-aula', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ tema: '', aulas_contexto_ids: [] }),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.success).toBe(false);
    expect(data.error).toContain('Informe um tema');
  });
});
