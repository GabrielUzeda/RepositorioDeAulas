export interface Professor {
  id: number;
  email: string;
  nome: string;
  role: string;
  total_cursos?: number;
}

export interface Curso {
  id: number;
  slug: string;
  nome: string;
  cor?: string;
  icone?: string;
  senha?: string;
  descricao?: string;
  criado_em?: string;
  atualizado_em?: string;
  total_disciplinas?: number;
  total_professores?: number;
}

export interface Disciplina {
  id: number;
  curso_id: number;
  slug: string;
  nome: string;
  cor?: string;
  icone?: string;
  descricao?: string;
  criado_em?: string;
  atualizado_em?: string;
}

export interface Aula {
  id: number;
  disciplina_id: number;
  titulo: string;
  caminho: string;
  icone?: string;
  descricao?: string;
  ordem?: number;
  conteudo_md?: string;
  criado_em?: string;
  atualizado_em?: string;
}

export interface QuestionOption {
  text: string;
  correct?: boolean;
  feedback?: string;
}

export type Option = QuestionOption;

export interface Question {
  id?: string | number;
  title?: string;
  content: string;
  options?: QuestionOption[];
}

export interface Atividade {
  id: number;
  disciplina_id: number;
  external_id?: string;
  slug?: string;
  titulo: string;
  descricao?: string;
  caminho: string;
  icone?: string;
  json_data?: string | { questions?: Question[]; meta?: any };
  tipo?: string;
  senha?: string | null;
  allow_password?: number | boolean;
  ordem?: number;
  criado_em?: string;
  atualizado_em?: string;
}

export interface RankingItem {
  id: number;
  atividade_id: number;
  nome_jogador: string;
  pontuacao: number;
  data_envio: string;
}

export type RespostasAlunoMap = Record<string, string>;

export interface RespostaAluno {
  id: number;
  atividade_id: number;
  aluno_nome: string;
  aluno_email: string;
  respostas: string | RespostasAlunoMap;
  nota?: number | null;
  feedback?: string | null;
  enviado_em?: string | null;
  criado_em: string;
}

export interface RespostaPayload {
  aluno_nome: string;
  aluno_email: string;
  respostas: RespostasAlunoMap;
  enviar_email?: boolean;
  senha_curso?: string;
  senha_atividade?: string;
}

export interface AtividadeFeedbackItem {
  id: number;
  atividade_id: number;
  atividade_titulo: string;
  nota: number | null;
  feedback: string | null;
  criado_em: string;
  enviado_em: string | null;
}

export interface AlunoFeedbackConsolidado {
  aluno_nome: string;
  aluno_email: string;
  feedback_geral: string;
  atividades: AtividadeFeedbackItem[];
  ja_enviado: boolean;
}

export interface DisciplinaFeedbackRelatorio {
  feedback_turma: string;
  alunos: AlunoFeedbackConsolidado[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}
