export interface Professor {
  id: number;
  email: string;
  nome: string;
  role: string;
}

export interface Turma {
  id: number;
  slug: string;
  nome: string;
  cor: string;
  icone: string;
  senha?: string;
  descricao?: string;
  criado_em?: string;
  atualizado_em?: string;
}

export interface Aula {
  id: number;
  turma_id: number;
  slug: string;
  titulo: string;
  caminho: string;
  icone?: string;
  descricao?: string;
  ordem: number;
  marp_markdown?: string;
}

export interface Option {
  text: string;
  correct: boolean;
  feedback?: string;
}

export interface Question {
  title?: string;
  content: string;
  options?: Option[];
}

export interface Atividade {
  id: number;
  turma_id: number;
  slug: string;
  tipo: 'normal' | 'prova' | 'minigame' | 'roleta' | 'reforco';
  titulo: string;
  caminho: string;
  icone?: string;
  descricao?: string;
  ordem: number;
  senha?: string | null;
  allow_password?: boolean;
  json_data?: string | { questions: Question[] } | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
}
