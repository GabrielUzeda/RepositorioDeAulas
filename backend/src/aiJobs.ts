import { db } from './db';

export type AiJobType = 'aula' | 'atividade' | 'avaliacao_lote' | 'sintese_turma' | string;
export type AiJobStatus = 'pendente' | 'processando' | 'concluido' | 'erro' | 'cancelado';

export interface AiJob {
  id: string;
  tipo: AiJobType;
  status: AiJobStatus;
  progresso: string | null;
  parametros: any;
  resultado: any | null;
  erro: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type JobCheckpointFn = (progresso: string, partialResult?: any) => Promise<void> | void;
export type JobProcessorFn = (
  job: AiJob,
  checkpoint: JobCheckpointFn,
  isCancelled: () => boolean
) => Promise<any>;

const processors = new Map<string, JobProcessorFn>();
const activeJobPromises = new Map<string, Promise<void>>();
const cancelledJobIds = new Set<string>();

function safeParseJson(value: unknown): any {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function safeStringify(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function mapRowToJob(row: any): AiJob {
  return {
    id: String(row.id),
    tipo: row.tipo,
    status: row.status as AiJobStatus,
    progresso: row.progresso ?? null,
    parametros: safeParseJson(row.parametros),
    resultado: safeParseJson(row.resultado),
    erro: row.erro ?? null,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
  };
}

export function registerJobProcessor(tipo: AiJobType, processor: JobProcessorFn): void {
  processors.set(tipo, processor);
}

export function getRegisteredProcessors(): string[] {
  return Array.from(processors.keys());
}

export function getJob(id: string): AiJob | null {
  if (!id) return null;
  const row = db.query('SELECT id, tipo, status, progresso, parametros, resultado, erro, criado_em, atualizado_em FROM ai_jobs WHERE id = ?').get(id) as any;
  if (!row) return null;
  return mapRowToJob(row);
}

export function listJobs(options?: {
  status?: AiJobStatus;
  tipo?: AiJobType;
  limit?: number;
}): AiJob[] {
  const limit = options?.limit && options.limit > 0 ? options.limit : 50;

  if (options?.status && options?.tipo) {
    const rows = db
      .query(
        'SELECT id, tipo, status, progresso, parametros, resultado, erro, criado_em, atualizado_em FROM ai_jobs WHERE status = ? AND tipo = ? ORDER BY criado_em DESC LIMIT ?'
      )
      .all(options.status, options.tipo, limit) as any[];
    return rows.map(mapRowToJob);
  }

  if (options?.status) {
    const rows = db
      .query(
        'SELECT id, tipo, status, progresso, parametros, resultado, erro, criado_em, atualizado_em FROM ai_jobs WHERE status = ? ORDER BY criado_em DESC LIMIT ?'
      )
      .all(options.status, limit) as any[];
    return rows.map(mapRowToJob);
  }

  if (options?.tipo) {
    const rows = db
      .query(
        'SELECT id, tipo, status, progresso, parametros, resultado, erro, criado_em, atualizado_em FROM ai_jobs WHERE tipo = ? ORDER BY criado_em DESC LIMIT ?'
      )
      .all(options.tipo, limit) as any[];
    return rows.map(mapRowToJob);
  }

  const rows = db
    .query(
      'SELECT id, tipo, status, progresso, parametros, resultado, erro, criado_em, atualizado_em FROM ai_jobs ORDER BY criado_em DESC LIMIT ?'
    )
    .all(limit) as any[];
  return rows.map(mapRowToJob);
}

export function updateJobStatus(
  id: string,
  status: AiJobStatus,
  updates?: { progresso?: string | null; resultado?: any; erro?: string | null }
): void {
  const progressoVal = updates?.progresso !== undefined ? updates.progresso : null;
  const hasProgresso = updates?.progresso !== undefined ? 1 : 0;

  const resultadoVal = updates?.resultado !== undefined ? safeStringify(updates.resultado) : null;
  const hasResultado = updates?.resultado !== undefined ? 1 : 0;

  const erroVal = updates?.erro !== undefined ? updates.erro : null;
  const hasErro = updates?.erro !== undefined ? 1 : 0;

  db.query(`
    UPDATE ai_jobs
    SET
      status = ?,
      progresso = CASE WHEN ? = 1 THEN ? ELSE progresso END,
      resultado = CASE WHEN ? = 1 THEN ? ELSE resultado END,
      erro = CASE WHEN ? = 1 THEN ? ELSE erro END,
      atualizado_em = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    WHERE id = ?
  `).run(
    status,
    hasProgresso,
    progressoVal,
    hasResultado,
    resultadoVal,
    hasErro,
    erroVal,
    id
  );
}

export function saveJobCheckpoint(id: string, progresso: string, partialResult?: any): void {
  if (isJobCancelled(id)) {
    throw new Error(`Job ${id} foi cancelado`);
  }

  const resultadoVal = partialResult !== undefined ? safeStringify(partialResult) : null;
  const hasResultado = partialResult !== undefined ? 1 : 0;

  db.query(`
    UPDATE ai_jobs
    SET
      progresso = ?,
      resultado = CASE WHEN ? = 1 THEN ? ELSE resultado END,
      atualizado_em = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    WHERE id = ?
  `).run(progresso, hasResultado, resultadoVal, id);
}

export function isJobCancelled(id: string): boolean {
  if (cancelledJobIds.has(id)) return true;
  const row = db.query('SELECT status FROM ai_jobs WHERE id = ?').get(id) as any;
  return row?.status === 'cancelado';
}

export function cancelJob(id: string): boolean {
  const current = getJob(id);
  if (!current) return false;
  if (current.status === 'concluido' || current.status === 'erro' || current.status === 'cancelado') {
    return false;
  }

  cancelledJobIds.add(id);
  updateJobStatus(id, 'cancelado', { erro: 'Job cancelado pelo usuário' });
  return true;
}

export async function dispatchJob(id: string): Promise<void> {
  const job = getJob(id);
  if (!job || job.status !== 'pendente') return;

  const processor = processors.get(job.tipo);
  if (!processor) {
    updateJobStatus(id, 'erro', {
      erro: `Nenhum processador registrado para o tipo de job: ${job.tipo}`,
    });
    return;
  }

  updateJobStatus(id, 'processando');

  const executePromise = (async () => {
    try {
      const isCancelledFn = () => isJobCancelled(id);
      const checkpointFn: JobCheckpointFn = async (progresso: string, partialResult?: any) => {
        saveJobCheckpoint(id, progresso, partialResult);
      };

      const result = await processor(job, checkpointFn, isCancelledFn);

      if (isCancelledFn()) {
        updateJobStatus(id, 'cancelado', { erro: 'Job cancelado durante execução' });
      } else {
        updateJobStatus(id, 'concluido', {
          resultado: result,
          progresso: '100% concluído',
          erro: null,
        });
      }
    } catch (err: any) {
      if (isJobCancelled(id) || err.message?.includes('cancelado')) {
        updateJobStatus(id, 'cancelado', { erro: 'Job cancelado durante execução' });
      } else {
        updateJobStatus(id, 'erro', {
          erro: err.message || 'Erro desconhecido ao processar job',
        });
      }
    } finally {
      cancelledJobIds.delete(id);
      activeJobPromises.delete(id);
    }
  })();

  activeJobPromises.set(id, executePromise);
  return executePromise;
}

export function waitForJob(id: string): Promise<void> | undefined {
  return activeJobPromises.get(id);
}

export function createJob(
  tipo: AiJobType,
  parametros: any,
  autoDispatch: boolean = true
): AiJob {
  const id = crypto.randomUUID();
  const rawParams = safeStringify(parametros);

  db.query(
    `INSERT INTO ai_jobs (id, tipo, status, progresso, parametros, resultado, erro)
     VALUES (?, ?, 'pendente', '0% aguardando processamento', ?, NULL, NULL)`
  ).run(id, tipo, rawParams);

  if (autoDispatch) {
    const p = dispatchJob(id).catch((e) => console.error(`[AI-Jobs] Erro ao despachar job ${id}:`, e));
    activeJobPromises.set(id, p);
  }

  return getJob(id)!;
}
