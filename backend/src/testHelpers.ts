import app from './routes';
import { signJwt } from './auth';

export const ADMIN_SEED_EMAIL = 'admin@escola.com';
export const ADMIN_SEED_PASSWORD = process.env.PROFESSOR_PASSWORD || 'MudeEstaSenha!';
export const ADMIN_ID = 1;

export function unique(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function jsonHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function readBody(res: Response): Promise<any> {
  const type = res.headers.get('content-type') || '';
  if (type.includes('application/json')) return res.json();
  return res.text();
}

export async function adminToken(): Promise<string> {
  return signJwt({ sub: String(ADMIN_ID), role: 'admin' });
}

export async function login(email: string, password: string) {
  const res = await app.request('/auth/login', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const body = await readBody(res);
  return { res, body, token: (body?.token as string) || '' };
}

export async function createProfessor(admin: string, senha = 'SenhaForte123!') {
  const email = `${unique('prof')}@example.com`;
  const register = await app.request('/auth/register', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password: senha, nome: 'Professor de Teste' }),
  });
  const registered = await readBody(register);
  const id = Number(registered?.professor?.id);
  await app.request(`/professores/${id}`, {
    method: 'PUT',
    headers: jsonHeaders(admin),
    body: JSON.stringify({ status: 'ativo' }),
  });
  const { token } = await login(email, senha);
  return { id, email, senha, token, register };
}

export async function linkProfessorToCurso(admin: string, professorId: number, cursoId: number) {
  return app.request(`/professores/${professorId}/cursos`, {
    method: 'PUT',
    headers: jsonHeaders(admin),
    body: JSON.stringify({ curso_ids: [cursoId] }),
  });
}

export async function createCurso(admin: string, options: { senha?: string; nome?: string } = {}) {
  const res = await app.request('/cursos', {
    method: 'POST',
    headers: jsonHeaders(admin),
    body: JSON.stringify({
      slug: unique('curso'),
      nome: options.nome || 'Curso de Teste',
      cor: 'bg-blue-500',
      icone: 'school',
      ...(options.senha ? { senha: options.senha } : {}),
    }),
  });
  const body = await readBody(res);
  return {
    id: Number(body?.id),
    slug: body?.slug as string,
    nome: body?.nome as string,
    possui_senha: Number(body?.possui_senha),
    res,
  };
}

export async function createDisciplina(token: string, cursoId: number, nome = 'Disciplina de Teste') {
  const res = await app.request('/disciplinas', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({
      curso_id: cursoId,
      nome: unique(nome),
      cor: 'bg-emerald-600',
      icone: 'school',
      descricao: 'Disciplina criada por teste automatizado',
    }),
  });
  const body = await readBody(res);
  return { id: Number(body?.id), slug: body?.slug as string, nome: body?.nome as string, res };
}

export async function createAula(token: string, disciplinaId: number, titulo = 'Aula de Teste') {
  const res = await app.request('/aulas', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({
      disciplina_id: disciplinaId,
      titulo: unique(titulo),
      caminho: `aulas/${unique('aula')}.html`,
      descricao: 'Aula criada por teste automatizado',
      ordem: 1,
    }),
  });
  const body = await readBody(res);
  return { id: Number(body?.id), res };
}

export async function createAtividade(
  token: string,
  disciplinaId: number,
  payload: Record<string, unknown> = {}
) {
  const res = await app.request('/atividades', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({
      disciplina_id: disciplinaId,
      titulo: unique('Atividade'),
      tipo: 'roleta',
      json_data: { questions: [] },
      ...payload,
    }),
  });
  const body = await readBody(res);
  return { id: Number(body?.id), body, res };
}

export async function deleteCurso(admin: string, cursoId: number) {
  return app.request(`/cursos/${cursoId}`, { method: 'DELETE', headers: authHeaders(admin) });
}

export async function deleteProfessor(admin: string, professorId: number) {
  return app.request(`/professores/${professorId}`, { method: 'DELETE', headers: authHeaders(admin) });
}

export interface RoletaQuestion {
  content: string;
  options: Array<{ text: string; correct?: boolean; [k: string]: unknown }>;
  [k: string]: unknown;
}

export function roletaJson(questions: RoletaQuestion[]) {
  return { meta: { type: 'roleta', title: 'Roleta de Teste' }, questions };
}
