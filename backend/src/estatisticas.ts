import type { Database } from 'bun:sqlite';
import { parseJsonOrNull, decryptData } from './utils';
import { executarEmFila } from './fila';

export interface CorrecaoQuestao {
  indice: number;
  ref: string;
  acertou: boolean;
}

export interface CorrecaoResultado {
  acertos: number;
  total: number;
  pontuacao: number;
  porQuestao: CorrecaoQuestao[];
}

export interface AjusteEstatisticas {
  atividadeId: number;
  porQuestao: CorrecaoQuestao[];
}

export interface RespostaArmazenada {
  atividade_id: number | string;
  respostas: string | null | undefined;
}

export const MIN_SUBMISSOES_ESTATISTICAS = 5;

export function serializarEstatisticas<T>(atividadeId: number, tarefa: () => Promise<T>): Promise<T> {
  return executarEmFila(`estat:${Number(atividadeId)}`, tarefa);
}

export function serializarEstatisticasMultiplas<T>(atividadeIds: number[], tarefa: () => Promise<T>): Promise<T> {
  const chaves = [...new Set(atividadeIds.map((id) => Number(id)))].sort((a, b) => a - b);
  const encadeado = chaves.reduceRight<() => Promise<T>>(
    (proxima, id) => () => executarEmFila(`estat:${id}`, proxima),
    tarefa
  );
  return encadeado();
}

export function extrairQuestoes(jsonData: string | null | undefined | any): any[] {
  const parsed = typeof jsonData === 'string' ? parseJsonOrNull<any>(jsonData) : jsonData;
  if (Array.isArray(parsed?.questions)) return parsed.questions;
  if (Array.isArray(parsed?.perguntas)) return parsed.perguntas;
  if (Array.isArray(parsed)) return parsed;
  return [];
}

export function refDaQuestao(questao: any, idx: number): string {
  return questao && questao.id !== undefined ? String(questao.id) : String(idx);
}

export function resolverRespostaDaQuestao(
  respostasMap: Record<string, any>,
  q: any,
  idx: number
): string | null {
  const keyId = refDaQuestao(q, idx);
  const keyTitle = typeof q?.title === 'string' ? q.title : '';
  const keyContent = typeof q?.content === 'string' ? q.content : '';
  const val = respostasMap[keyId] ?? respostasMap[String(idx)] ?? respostasMap[keyTitle] ?? respostasMap[keyContent];
  if (val === undefined || val === null) return null;
  return String(val);
}

export function corrigirObjetivas(jsonDataStr: string | null | undefined, respostasInput: any): CorrecaoResultado {
  const questions = extrairQuestoes(jsonDataStr);
  if (questions.length === 0) return { acertos: 0, total: 0, pontuacao: 0, porQuestao: [] };

  let acertos = 0;
  let totalObjetivas = 0;
  const porQuestao: CorrecaoQuestao[] = [];

  let respostasMap: Record<string, string> = {};
  if (typeof respostasInput === 'string') {
    respostasMap = parseJsonOrNull<Record<string, string>>(respostasInput) ?? { '0': respostasInput };
  } else if (typeof respostasInput === 'object' && respostasInput !== null) {
    if (Array.isArray(respostasInput)) {
      for (const item of respostasInput) {
        if (item && item.questao !== undefined) respostasMap[String(item.questao)] = String(item.resposta ?? '');
      }
    } else {
      respostasMap = respostasInput;
    }
  }

  questions.forEach((q: any, idx: number) => {
    if (Array.isArray(q?.options) && q.options.length > 0) {
      totalObjetivas++;
      const keyId = refDaQuestao(q, idx);
      const correta = q.options.find((opt: any) => opt && opt.correct === true);
      const respAluno = resolverRespostaDaQuestao(respostasMap, q, idx);

      const acertou =
        Boolean(correta) &&
        typeof correta.text === 'string' &&
        typeof respAluno === 'string' &&
        respAluno.trim().toLowerCase() === correta.text.trim().toLowerCase();

      if (acertou) acertos++;
      porQuestao.push({ indice: idx, ref: keyId, acertou });
    }
  });
  const pontuacao = totalObjetivas > 0 ? Math.round((acertos / totalObjetivas) * 100) : 0;
  return { acertos, total: totalObjetivas, pontuacao, porQuestao };
}

export function ajustarEstatisticas(db: Database, atividadeId: number, porQuestao: CorrecaoQuestao[], delta: number): void {
  if (porQuestao.length === 0) return;
  const upsert = db.query(`
    INSERT INTO estatisticas_questoes (atividade_id, questao_ref, acertos, erros)
    VALUES (?, ?, MAX(?, 0), MAX(?, 0))
    ON CONFLICT(atividade_id, questao_ref) DO UPDATE SET
      acertos = MAX(acertos + ?, 0),
      erros = MAX(erros + ?, 0),
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%SZ','now')
  `);
  for (const questao of porQuestao) {
    const dAcerto = questao.acertou ? delta : 0;
    const dErro = questao.acertou ? 0 : delta;
    upsert.run(atividadeId, questao.ref, dAcerto, dErro, dAcerto, dErro);
  }
}

export async function calcularAjustesDasRespostas(
  db: Database,
  respostas: RespostaArmazenada[]
): Promise<AjusteEstatisticas[]> {
  const jsonPorAtividade = new Map<number, any>();
  const ajustes: AjusteEstatisticas[] = [];
  for (const resposta of respostas) {
    const atividadeId = Number(resposta.atividade_id);
    if (!jsonPorAtividade.has(atividadeId)) {
      const atv = db.query('SELECT json_data FROM atividades WHERE id = ?').get(atividadeId) as any;
      jsonPorAtividade.set(atividadeId, atv?.json_data ?? null);
    }
    const decifradas = await decryptData(String(resposta.respostas ?? ''));
    ajustes.push({
      atividadeId,
      porQuestao: corrigirObjetivas(jsonPorAtividade.get(atividadeId), decifradas).porQuestao,
    });
  }
  return ajustes;
}

export function recomputarEstatisticasAtividade(db: Database, atividadeId: number): Promise<void> {
  return serializarEstatisticas(atividadeId, async () => {
    const atv = db.query('SELECT json_data FROM atividades WHERE id = ?').get(atividadeId) as any;
    const linhas = db.query('SELECT respostas FROM respostas_alunos WHERE atividade_id = ?').all(atividadeId) as any[];

    const acumulado = new Map<string, { acertos: number; erros: number }>();
    for (const linha of linhas) {
      const decifradas = await decryptData(String(linha?.respostas ?? ''));
      for (const questao of corrigirObjetivas(atv?.json_data, decifradas).porQuestao) {
        const atual = acumulado.get(questao.ref) ?? { acertos: 0, erros: 0 };
        if (questao.acertou) atual.acertos++;
        else atual.erros++;
        acumulado.set(questao.ref, atual);
      }
    }

    db.transaction(() => {
      db.query('DELETE FROM estatisticas_questoes WHERE atividade_id = ?').run(atividadeId);
      const inserir = db.query(
        'INSERT INTO estatisticas_questoes (atividade_id, questao_ref, acertos, erros) VALUES (?, ?, ?, ?)'
      );
      for (const [ref, contagem] of acumulado) {
        inserir.run(atividadeId, ref, contagem.acertos, contagem.erros);
      }
    })();
  });
}
