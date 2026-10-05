import { db } from './db';
import { decryptData } from './utils';

export interface AtividadeRelatorio {
  id: number;
  atividade_id: number;
  atividade_titulo: string;
  nota: number | null;
  feedback: string | null;
  criado_em: string;
  enviado_em: string | null;
}

export interface AlunoRelatorio {
  aluno_nome: string;
  aluno_email: string;
  feedback_geral: string;
  atividades: AtividadeRelatorio[];
  atividades_pendentes: Array<{ id: number; atividade_titulo: string }>;
  media_calculada: number | null;
  ja_enviado: boolean;
}

export interface DadosRelatorioDisciplina {
  feedback_turma: string;
  atividades_consideradas: Array<{ id: number; titulo: string }>;
  alunos: AlunoRelatorio[];
}

export async function obterDadosRelatorioDisciplina(
  disciplinaId: number | string
): Promise<DadosRelatorioDisciplina> {
  const disciplinaIdNum = Number(disciplinaId);

  const turmaFeedbackRow = db
    .query(
      'SELECT feedback_geral FROM disciplina_feedbacks WHERE disciplina_id = ? AND aluno_email_hash IS NULL'
    )
    .get(disciplinaIdNum) as { feedback_geral: string } | undefined;

  const alunosFeedbacksRows = db
    .query(
      'SELECT aluno_email_hash, feedback_geral, enviado_em FROM disciplina_feedbacks WHERE disciplina_id = ? AND aluno_email_hash IS NOT NULL'
    )
    .all(disciplinaIdNum) as Array<{
    aluno_email_hash: string;
    feedback_geral: string;
    enviado_em: string | null;
  }>;

  const alunoFeedbackMap = new Map<string, { feedback_geral: string; enviado_em: string | null }>();
  for (const f of alunosFeedbacksRows) {
    if (f.aluno_email_hash) {
      alunoFeedbackMap.set(f.aluno_email_hash, {
        feedback_geral: f.feedback_geral,
        enviado_em: f.enviado_em,
      });
    }
  }

  const atividadesConsideradas = db
    .query(
      `SELECT DISTINCT a.id, a.titulo, a.ordem
     FROM atividades a
     JOIN respostas_alunos r ON r.atividade_id = a.id
     WHERE a.disciplina_id = ?
     ORDER BY a.ordem ASC, a.id ASC`
    )
    .all(disciplinaIdNum) as Array<{ id: number; titulo: string; ordem: number }>;

  const rawRespostasRows = db
    .query(
      `SELECT r.id, r.atividade_id, r.aluno_nome, r.aluno_email, r.aluno_email_hash, r.nota, r.feedback, r.enviado_em, r.criado_em, a.titulo as atividade_titulo
     FROM respostas_alunos r
     JOIN atividades a ON a.id = r.atividade_id
     WHERE a.disciplina_id = ?
     ORDER BY r.aluno_email_hash, a.ordem, r.criado_em DESC`
    )
    .all(disciplinaIdNum) as Array<{
    id: number;
    atividade_id: number;
    aluno_nome: string;
    aluno_email: string;
    aluno_email_hash: string;
    nota: number | null;
    feedback: string | null;
    enviado_em: string | null;
    criado_em: string;
    atividade_titulo: string;
  }>;

  const respostasRows = await Promise.all(
    rawRespostasRows.map(async (r) => ({
      ...r,
      aluno_nome: (await decryptData(r.aluno_nome)) || '',
      aluno_email: (await decryptData(r.aluno_email)) || '',
    }))
  );

  const alunosMap = new Map<string, AlunoRelatorio>();

  for (const r of respostasRows) {
    const hashKey = r.aluno_email_hash;
    if (!alunosMap.has(hashKey)) {
      const fAluno = alunoFeedbackMap.get(hashKey);
      alunosMap.set(hashKey, {
        aluno_nome: r.aluno_nome,
        aluno_email: r.aluno_email,
        feedback_geral: fAluno?.feedback_geral || '',
        atividades: [],
        atividades_pendentes: [],
        media_calculada: null,
        ja_enviado: true,
      });
    }

    const alunoObj = alunosMap.get(hashKey);
    if (!alunoObj) continue;
    alunoObj.atividades.push({
      id: r.id,
      atividade_id: r.atividade_id,
      atividade_titulo: r.atividade_titulo,
      nota: r.nota,
      feedback: r.feedback,
      criado_em: r.criado_em,
      enviado_em: r.enviado_em,
    });

    if (!r.enviado_em) {
      alunoObj.ja_enviado = false;
    }
  }

  for (const aluno of alunosMap.values()) {
    const entreguesSet = new Set(aluno.atividades.map((a) => a.atividade_id));
    aluno.atividades_pendentes = atividadesConsideradas
      .filter((a) => !entreguesSet.has(a.id))
      .map((a) => ({ id: a.id, atividade_titulo: a.titulo }));

    const somaNotas = aluno.atividades.reduce((acc, a) => acc + (a.nota !== null ? a.nota : 0), 0);
    const totalConsideradas = atividadesConsideradas.length;
    aluno.media_calculada = totalConsideradas > 0 ? Math.round(somaNotas / totalConsideradas) : null;
  }

  return {
    feedback_turma: turmaFeedbackRow?.feedback_geral || '',
    atividades_consideradas: atividadesConsideradas.map((a) => ({ id: a.id, titulo: a.titulo })),
    alunos: Array.from(alunosMap.values()),
  };
}
