import { APIRequestContext, expect, Page } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, E2E_BACKEND_URL } from './playwright.config';

export { ADMIN_EMAIL, ADMIN_PASSWORD, E2E_BACKEND_URL };

function unique(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

// ---------- API helpers (direct to backend, no /api prefix) ----------

async function loginApi(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${E2E_BACKEND_URL}/auth/login`, {
    data: { email, password }
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.token as string;
}

async function api(context: APIRequestContext, method: 'get' | 'post' | 'put' | 'delete', path: string, token: string, data?: any) {
  const res = await context[method](`${E2E_BACKEND_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data
  });
  return res;
}

export interface CreatedProfessor {
  id: number;
  nome: string;
  email: string;
  password: string;
}

export interface CreatedCurso {
  id: number;
  nome: string;
  slug: string;
  senha?: string;
}

export interface CreatedMateria {
  id: number;
  nome: string;
  slug: string;
  senha: string;
}

/** Cria professor + curso (atribuído) via API e retorna tokens/ids para limpeza. */
export async function setupAdminContext(request: APIRequestContext) {
  const adminToken = await loginApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  return { adminToken };
}

export async function createProfessor(request: APIRequestContext, adminToken: string): Promise<CreatedProfessor> {
  const prof = {
    nome: `Professor ${unique('E2E')}`,
    email: `${unique('prof')}@local`,
    password: 'senha12345',
    role: 'professor'
  };
  const res = await api(request, 'post', '/professores', adminToken, prof);
  expect([200, 201]).toContain(res.status());
  const body = await res.json();
  return { id: body.id, nome: body.nome, email: body.email, password: prof.password };
}

export async function createCurso(
  request: APIRequestContext,
  adminToken: string,
  professorIds: number[] = [],
  options?: { senha?: string }
): Promise<CreatedCurso> {
  const curso = {
    nome: `Curso ${unique('E2E')}`,
    descricao: 'Curso criado pelo teste E2E',
    cor: 'bg-red-500',
    icone: 'school',
    senha: options?.senha || ''
  };
  const res = await api(request, 'post', '/cursos', adminToken, curso);
  expect([200, 201]).toContain(res.status());
  const body = await res.json();
  if (professorIds.length > 0) {
    const assign = await api(request, 'put', `/cursos/${body.id}/professores`, adminToken, { professor_ids: professorIds });
    expect(assign.ok()).toBeTruthy();
  }
  return { id: body.id, nome: body.nome, slug: body.slug, senha: options?.senha };
}

export async function createMateria(request: APIRequestContext, profToken: string, cursoId: number): Promise<CreatedMateria> {
  const mat = {
    curso_id: cursoId,
    nome: `Materia ${unique('E2E')}`,
    descricao: 'Materia criada pelo teste E2E',
    slug: unique('materia'),
    senha: 'materia123',
    cor: 'bg-blue-500',
    icone: 'book'
  };
  const res = await api(request, 'post', '/materias', profToken, mat);
  expect([200, 201]).toContain(res.status());
  const body = await res.json();
  return { id: body.id, nome: body.nome, slug: body.slug, senha: mat.senha };
}

export async function cleanupEntities(request: APIRequestContext, adminToken: string, cursoId?: number, professorId?: number) {
  if (cursoId != null) {
    await api(request, 'delete', `/cursos/${cursoId}`, adminToken).catch(() => {});
  }
  if (professorId != null) {
    await api(request, 'delete', `/professores/${professorId}`, adminToken).catch(() => {});
  }
}

// ---------- UI helpers ----------

/** Faz login pela UI no /login e espera a rota destino. */
export async function loginViaUI(page: Page, email: string, password: string, expectedUrl: RegExp | string) {
  await page.goto('/login');
  await page.getByPlaceholder('professor@local').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(expectedUrl);
}

export function uniqueName(prefix: string): string {
  return unique(prefix);
}
