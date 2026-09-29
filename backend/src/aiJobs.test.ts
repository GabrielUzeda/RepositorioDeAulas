import { describe, test, expect, beforeEach } from 'bun:test';
import { db } from './db';
import {
  createJob,
  getJob,
  listJobs,
  updateJobStatus,
  saveJobCheckpoint,
  cancelJob,
  dispatchJob,
  waitForJob,
  registerJobProcessor,
  type AiJob,
} from './aiJobs';
import app from './routes';
import { signJwt } from './auth';

describe('AI Jobs Engine & Resiliência Assíncrona (backend/src/aiJobs.ts)', () => {
  beforeEach(() => {
    db.query('DELETE FROM ai_jobs').run();
  });

  test('createJob persiste job no SQLite com status pendente e parâmetros JSON', () => {
    const job = createJob('aula', { tema: 'Estruturas de Dados', slides: 10 }, false);

    expect(job).toBeDefined();
    expect(job.id).toBeDefined();
    expect(job.tipo).toBe('aula');
    expect(job.status).toBe('pendente');
    expect(job.parametros).toEqual({ tema: 'Estruturas de Dados', slides: 10 });
    expect(job.resultado).toBeNull();
    expect(job.erro).toBeNull();

    const retrieved = getJob(job.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(job.id);
    expect(retrieved?.status).toBe('pendente');
  });

  test('listJobs filtra corretamente por status e tipo', () => {
    createJob('aula', { tema: 'A' }, false);
    const j2 = createJob('atividade', { tema: 'B' }, false);
    const j3 = createJob('aula', { tema: 'C' }, false);

    updateJobStatus(j2.id, 'concluido', { resultado: { ok: true } });
    updateJobStatus(j3.id, 'processando', { progresso: '50%' });

    const all = listJobs();
    expect(all.length).toBe(3);

    const aulas = listJobs({ tipo: 'aula' });
    expect(aulas.length).toBe(2);

    const concluidos = listJobs({ status: 'concluido' });
    expect(concluidos.length).toBe(1);
    expect(concluidos[0].id).toBe(j2.id);

    const aulaProcessando = listJobs({ tipo: 'aula', status: 'processando' });
    expect(aulaProcessando.length).toBe(1);
    expect(aulaProcessando[0].id).toBe(j3.id);
  });

  test('saveJobCheckpoint atualiza progresso e resultado parcial sem finalizar o job', () => {
    const job = createJob('avaliacao_lote', { total: 5 }, false);
    updateJobStatus(job.id, 'processando');

    saveJobCheckpoint(job.id, '3/5 alunos avaliados', { parcial: [80, 90, 75] });

    const updated = getJob(job.id);
    expect(updated?.status).toBe('processando');
    expect(updated?.progresso).toBe('3/5 alunos avaliados');
    expect(updated?.resultado).toEqual({ parcial: [80, 90, 75] });
  });

  test('cancelJob altera status para cancelado e impede novo checkpoint', () => {
    const job = createJob('aula', { tema: 'Teste Cancel' }, false);
    expect(cancelJob(job.id)).toBe(true);

    const cancelled = getJob(job.id);
    expect(cancelled?.status).toBe('cancelado');

    expect(() => {
      saveJobCheckpoint(job.id, 'tentando continuar');
    }).toThrow(/cancelado/);

    expect(cancelJob(job.id)).toBe(false);
  });

  test('dispatchJob executa processador com checkpoints e conclui job com sucesso', async () => {
    registerJobProcessor('teste_sucesso', async (job, checkpoint) => {
      await checkpoint('50% em andamento', { etapa1: 'ok' });
      return { output: 'Gerado com sucesso para: ' + job.parametros.tema };
    });

    const job = createJob('teste_sucesso', { tema: 'Programação Concorrente' }, true);

    await waitForJob(job.id);

    const finished = getJob(job.id);
    expect(finished?.status).toBe('concluido');
    expect(finished?.resultado).toEqual({
      output: 'Gerado com sucesso para: Programação Concorrente',
    });
    expect(finished?.erro).toBeNull();
  });

  test('dispatchJob trata erros do processador e marca status como erro', async () => {
    registerJobProcessor('teste_falha', async () => {
      throw new Error('Falha de timeout simulada no modelo');
    });

    const job = createJob('teste_falha', { tema: 'Erro' }, true);

    await waitForJob(job.id);

    const failed = getJob(job.id);
    expect(failed?.status).toBe('erro');
    expect(failed?.erro).toContain('Falha de timeout simulada');
  });

  test('dispatchJob marca erro quando o tipo de job não possui processador', async () => {
    const job = createJob('tipo_inexistente_sem_handler', {}, true);

    await waitForJob(job.id);

    const failed = getJob(job.id);
    expect(failed?.status).toBe('erro');
    expect(failed?.erro).toContain('Nenhum processador registrado');
  });
});

describe('AI Jobs HTTP Endpoints (POST/GET/CANCEL /ai/jobs)', () => {
  let adminToken = '';

  beforeEach(async () => {
    adminToken = await signJwt({ sub: 1, email: 'admin@escola.com', role: 'admin' });
  });

  test('POST /ai/jobs rejeita requisição não autenticada com 401', async () => {
    const res = await app.request('/ai/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'aula', parametros: { tema: 'Sem Auth' } }),
    });

    expect(res.status).toBe(401);
  });

  test('POST /ai/jobs valida payload e cria job assíncrono retornando 202', async () => {
    const res = await app.request('/ai/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        tipo: 'aula',
        parametros: { tema: 'Banco de Dados SQL' },
      }),
    });

    expect(res.status).toBe(202);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.job_id).toBeDefined();
    expect(data.status).toBe('pendente');

    const jobInDb = getJob(data.job_id);
    expect(jobInDb).not.toBeNull();
  });

  test('GET /ai/jobs/:id retorna detalhes do job', async () => {
    const job = createJob('atividade', { tema: 'Algoritmos' }, false);
    updateJobStatus(job.id, 'processando', { progresso: '75%' });

    const res = await app.request(`/ai/jobs/${job.id}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.job.id).toBe(job.id);
    expect(data.job.status).toBe('processando');
    expect(data.job.progresso).toBe('75%');
  });

  test('POST /ai/jobs/:id/cancel cancela job existente', async () => {
    const job = createJob('aula', { tema: 'Cancelar via API' }, false);

    const res = await app.request(`/ai/jobs/${job.id}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);

    const cancelled = getJob(job.id);
    expect(cancelled?.status).toBe('cancelado');
  });
});
