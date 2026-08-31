import { test, expect, APIRequestContext } from '@playwright/test';
import {
  createCurso,
  createMateria,
  createProfessor,
  setupAdminContext,
  cleanupEntities,
  loginViaUI,
  uniqueName,
  E2E_BACKEND_URL
} from '../helpers';

async function profLogin(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${E2E_BACKEND_URL}/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).token as string;
}

test.describe('Professor — Modal de Geração de Atividades por IA (9router)', () => {
  let adminToken: string;
  let profEmail: string;
  let profPassword: string;
  let professorId: number;
  let cursoId: number;
  let cursoNome: string;
  let materiaNome: string;

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
    const prof = await createProfessor(request, adminToken);
    profEmail = prof.email;
    profPassword = prof.password;
    professorId = prof.id;
    const curso = await createCurso(request, adminToken, [professorId]);
    cursoId = curso.id;
    cursoNome = curso.nome;
    const profToken = await profLogin(request, profEmail, profPassword);
    const materia = await createMateria(request, profToken, cursoId);
    // Criar uma aula de apoio via API
    await request.post(`${E2E_BACKEND_URL}/aulas`, {
      headers: { Authorization: `Bearer ${profToken}` },
      data: {
        disciplina_id: materia.id,
        titulo: 'Aula de Algoritmos 1',
        descricao: 'Introdução a algoritmos e lógica',
        ordem: 1,
        conteudo_md: '# Introdução\n\nConceitos fundamentais de lógica.'
      }
    });
    materiaNome = materia.nome;
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) await cleanupEntities(request, adminToken, cursoId, professorId);
  });

  test('verifica simplificação e automação do gerador de IA por aulas vinculadas', async ({ page }) => {
    await loginViaUI(page, profEmail, profPassword, /\/professor/);
    await expect(page.getByRole('heading', { name: 'Painel do Professor' })).toBeVisible();
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.getByRole('heading', { name: materiaNome })).toBeVisible();

    // 1. Abrir o editor para Nova Atividade (Geral - sem aula vinculada inicialmente)
    await page.getByRole('button', { name: 'Nova Atividade' }).first().click();

    // Validar painel de IA integrado na aba Geral: sem aula vinculada, campo de tema é OBRIGATÓRIO
    await expect(page.getByRole('heading', { name: 'Gerador de Questões por IA' })).toBeVisible();
    await expect(page.getByText('Tema / Tópico Específico *')).toBeVisible();
    await expect(page.getByText('Observações ou Instruções Pedagógicas para a IA')).toBeVisible();
    await expect(page.getByRole('button', { name: /Gerar e Adicionar Questões na Atividade/i })).toBeVisible();

    // 2. Ao vincular a uma aula pelo select, o campo de tema desaparece e surge o banner de contexto automático
    await page.getByLabel('Vincular a uma Aula (Opcional)').selectOption({ label: 'Aula de Algoritmos 1' });
    await expect(page.getByText('Contexto Automático por Aula')).toBeVisible();
    await expect(page.locator('span', { hasText: 'Aula de Algoritmos 1' })).toBeVisible();
    await expect(page.getByText('Tema / Tópico Específico *')).not.toBeVisible();

    // 3. Ao desvincular de volta para Atividade Geral, o campo obrigatório de tema reaparece
    await page.getByLabel('Vincular a uma Aula (Opcional)').selectOption({ label: 'Nenhuma (Atividade Geral)' });
    await expect(page.getByText('Tema / Tópico Específico *')).toBeVisible();
    await expect(page.getByText('Contexto Automático por Aula')).not.toBeVisible();

    // Fechar o editor
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { name: materiaNome })).toBeVisible();
  });
});
