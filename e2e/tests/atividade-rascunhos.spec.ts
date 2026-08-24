import { test, expect } from '@playwright/test';
import {
  createCurso,
  createMateria,
  createProfessor,
  setupAdminContext,
  cleanupEntities,
  E2E_BACKEND_URL,
  uniqueName
} from '../helpers';

test.describe('Aluno — Salvar e Restaurar Rascunho de Atividade por Código', () => {
  let adminToken: string;
  let professorId: number;
  let cursoId: number;
  let materiaId: number;
  let profEmail: string;
  let profPassword: string;
  let cursoNome: string;
  let materiaNome: string;
  let atvTitulo: string;
  let atvId: number;
  let alunoNome = 'Aluno Rascunho';
  let alunoEmail = `${uniqueName('rascunho')}@local`;

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
    const prof = await createProfessor(request, adminToken);
    professorId = prof.id;
    profEmail = prof.email;
    profPassword = prof.password;

    const profRes = await request.post(`${E2E_BACKEND_URL}/auth/login`, { data: { email: profEmail, password: profPassword } });
    const profToken = (await profRes.json()).token;

    const curso = await createCurso(request, adminToken, [professorId]);
    cursoId = curso.id;
    cursoNome = curso.nome;

    const materia = await createMateria(request, profToken, cursoId);
    materiaId = materia.id;
    materiaNome = materia.nome;

    atvTitulo = `Atividade Rascunho ${uniqueName('E2E')}`;
    const atvRes = await request.post(`${E2E_BACKEND_URL}/atividades`, {
      headers: { Authorization: `Bearer ${profToken}` },
      data: {
        materia_id: materiaId,
        titulo: atvTitulo,
        tipo: 'normal',
        allow_password: false,
        slug: uniqueName('atv-rascunho'),
        json_data: JSON.stringify({
          questions: [
            { title: 'Pergunta 1', content: 'Descreva a importância da segurança.' }
          ]
        })
      }
    });
    expect(atvRes.ok()).toBeTruthy();
    const atvBody = await atvRes.json();
    atvId = atvBody.id;
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) {
      await cleanupEntities(request, adminToken, cursoId, professorId);
    }
  });

  test('aluno preenche respostas, salva rascunho remoto, restaura por código e submete', async ({ page }) => {
    await page.goto('/');
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await page.getByRole('tab', { name: /Atividades/ }).click();
    await page.locator('h3', { hasText: atvTitulo }).click();

    // Passo 0: Preenche identificação
    await page.getByLabel('Seu Nome *').fill(alunoNome);
    await page.getByLabel('Seu E-mail *').fill(alunoEmail);
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Passo 1: Digita resposta no editor
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible();
    await editor.fill('Texto de rascunho E2E para teste de preservação.');

    // Salvar Rascunho via API para obter código sem depender de alert
    const rascunhoRes = await page.request.post(`${E2E_BACKEND_URL}/atividades/${atvId}/rascunhos`, {
      data: {
        nome: alunoNome,
        email: alunoEmail,
        respostas: { "0": "Texto de rascunho E2E para teste de preservação." }
      }
    });
    expect(rascunhoRes.ok()).toBeTruthy();
    const rascunhoData = await rascunhoRes.json();
    const codigo = rascunhoData.codigo || rascunhoData.codigo_recuperacao;
    expect(codigo).toBeTruthy();
    expect(codigo.length).toBe(12);

    // Recarrega página (simulando acesso posterior/outro dispositivo)
    await page.reload();
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();
    await page.getByRole('tab', { name: /Atividades/ }).click();
    await page.locator('h3', { hasText: atvTitulo }).click();

    // Passo 0: Restaura o rascunho utilizando o código gerado
    await page.getByPlaceholder('Código (ex: R8K9X2)').fill(codigo);
    await page.getByRole('button', { name: 'Restaurar' }).click();
    await expect(page.getByLabel('Seu Nome *')).toHaveValue(alunoNome);
    await expect(page.getByLabel('Seu E-mail *')).toHaveValue(alunoEmail);

    // Avança para a pergunta e verifica que a resposta restaurada está lá
    await page.getByRole('button', { name: 'Próximo' }).click();
    await expect(editor).toContainText('Texto de rascunho E2E para teste de preservação.');

    // Finaliza e Envia
    await page.getByRole('button', { name: 'Próximo' }).click();
    await page.getByRole('button', { name: 'Enviar Resposta' }).click();
    await expect(page.getByRole('heading', { name: 'Resposta Enviada com Sucesso!' })).toBeVisible({ timeout: 10000 });
  });
});
