import { test, expect, APIRequestContext } from '@playwright/test';
import {
  createCurso,
  createMateria,
  createProfessor,
  setupAdminContext,
  cleanupEntities,
  E2E_BACKEND_URL,
  uniqueName
} from '../helpers';

async function profLogin(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${E2E_BACKEND_URL}/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.token as string;
}

async function createAtividadeApi(request: APIRequestContext, token: string, payload: any) {
  const res = await request.post(`${E2E_BACKEND_URL}/atividades`, {
    headers: { Authorization: `Bearer ${token}` },
    data: payload
  });
  expect([200, 201]).toContain(res.status());
  return res.json();
}

test.describe('Aluno — Atividades Avançadas & Modalidades Interativas', () => {
  let adminToken: string;
  let professorId: number;
  let profToken: string;
  let cursoId: number;
  let materiaId: number;
  let cursoNome: string;
  let materiaNome: string;

  let reforcoAtv: any;
  let roletaAtv: any;
  let minigameAtv: any;
  let protectedAtv: any;
  const protectedAtvSenha = 'senha-atv-123';

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
    const prof = await createProfessor(request, adminToken);
    professorId = prof.id;
    profToken = await profLogin(request, prof.email, prof.password);

    const curso = await createCurso(request, adminToken, [professorId]);
    cursoId = curso.id;
    cursoNome = curso.nome;

    const materia = await createMateria(request, profToken, cursoId);
    materiaId = materia.id;
    materiaNome = materia.nome;

    // 1. Atividade Reforço
    reforcoAtv = await createAtividadeApi(request, profToken, {
      materia_id: materiaId,
      titulo: `Reforço ${uniqueName('E2E')}`,
      tipo: 'reforco',
      json_data: JSON.stringify({
        questions: [
          {
            title: 'Reforço 1',
            content: 'Quanto é 2 + 2?',
            options: [
              { text: '4', correct: true, feedback: 'Correto!' },
              { text: '5', correct: false, feedback: 'Errado!' }
            ]
          }
        ]
      })
    });

    // 2. Atividade Roleta
    roletaAtv = await createAtividadeApi(request, profToken, {
      materia_id: materiaId,
      titulo: `Roleta ${uniqueName('E2E')}`,
      tipo: 'roleta',
      json_data: JSON.stringify({
        questions: [
          {
            title: 'Questão Roleta',
            content: 'Qual a linguagem usada no Vue.js?',
            options: [
              { text: 'JavaScript/TypeScript', correct: true, feedback: 'Correto!' },
              { text: 'Python', correct: false, feedback: 'Incorreto.' }
            ]
          }
        ]
      })
    });

    // 3. Atividade Minigame
    minigameAtv = await createAtividadeApi(request, profToken, {
      materia_id: materiaId,
      titulo: `Minigame ${uniqueName('E2E')}`,
      tipo: 'minigame',
      json_data: JSON.stringify({
        config: { theme: 'space' }
      })
    });

    // 4. Atividade com Senha Individual (allow_password)
    protectedAtv = await createAtividadeApi(request, profToken, {
      materia_id: materiaId,
      titulo: `Protegida ${uniqueName('E2E')}`,
      tipo: 'normal',
      allow_password: true,
      senha: protectedAtvSenha,
      json_data: JSON.stringify({
        questions: [
          {
            title: 'Conteúdo Secreto',
            content: 'Qual o código secreto?',
            options: [{ text: '1234', correct: true, feedback: 'OK' }]
          }
        ]
      })
    });
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) {
      await cleanupEntities(request, adminToken, cursoId, professorId);
    }
  });

  test('interage com atividade do tipo Reforço', async ({ page }) => {
    await page.goto('/');
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();

    // Desbloqueia matéria
    await page.getByPlaceholder('Digite a senha').fill('materia123');
    await page.getByRole('button', { name: 'Confirmar' }).click();

    // Vai para aba Atividades
    await page.getByRole('button', { name: /Atividades/ }).click();
    await expect(page.locator('h3', { hasText: reforcoAtv.titulo })).toBeVisible();

    // Abre modal de Reforço
    await page.locator('h3', { hasText: reforcoAtv.titulo }).click();
    await expect(page.getByText('Modo Reforço')).toBeVisible();
    await expect(page.getByText('Quanto é 2 + 2?')).toBeVisible();

    // Seleciona opção '4' (correta)
    await page.getByRole('button', { name: '4', exact: true }).click();
    await expect(page.getByText('Correto!')).toBeVisible();

    // Finaliza modal
    await page.getByRole('button', { name: 'Finalizar' }).click();
    await expect(page.getByText('Modo Reforço')).toHaveCount(0);
  });

  test('interage com atividade protegida por Senha Individual', async ({ page }) => {
    await page.goto('/');
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();

    await page.getByPlaceholder('Digite a senha').fill('materia123');
    await page.getByRole('button', { name: 'Confirmar' }).click();

    await page.getByRole('button', { name: /Atividades/ }).click();
    await expect(page.locator('h3', { hasText: protectedAtv.titulo })).toBeVisible();

    // Abre a atividade protegida por senha individual
    await page.locator('h3', { hasText: protectedAtv.titulo }).click();
    await expect(page.getByText('Acesso Restrito')).toBeVisible();

    // Testa senha da atividade errada
    page.on('dialog', (d) => d.accept());
    await page.getByPlaceholder('Digite a senha').fill('senha-errada');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('Acesso Restrito')).toBeVisible();

    // Digita senha da atividade correta
    await page.getByPlaceholder('Digite a senha').fill(protectedAtvSenha);
    await page.getByRole('button', { name: 'Confirmar' }).click();

    // Atividade desbloqueada
    await expect(page.getByText('Perguntas da Atividade')).toBeVisible();
    await expect(page.getByText('Qual o código secreto?')).toBeVisible();
  });

  test('interage com atividade tipo Minigame e envia/consulta Ranking', async ({ page, request }) => {
    await page.goto('/');
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();

    await page.getByPlaceholder('Digite a senha').fill('materia123');
    await page.getByRole('button', { name: 'Confirmar' }).click();

    await page.getByRole('button', { name: /Atividades/ }).click();
    await expect(page.locator('h3', { hasText: minigameAtv.titulo })).toBeVisible();

    // Abre o minigame
    await page.locator('h3', { hasText: minigameAtv.titulo }).click();
    await expect(page.locator('#mg-modal-container')).toBeVisible();

    // Envia pontuação no ranking via API
    const postRank = await request.post(`${E2E_BACKEND_URL}/ranking`, {
      data: {
        atividade_id: minigameAtv.id,
        nome_jogador: 'Jogador E2E',
        pontuacao: 9500
      }
    });
    expect(postRank.ok()).toBeTruthy();

    // Consulta o ranking
    const getRank = await request.get(`${E2E_BACKEND_URL}/ranking/${minigameAtv.id}`);
    expect(getRank.ok()).toBeTruthy();
    const rankList = await getRank.json();
    expect(rankList.length).toBeGreaterThan(0);
    expect(rankList[0].nome_jogador).toBe('Jogador E.');
    expect(rankList[0].pontuacao).toBe(9500);

    // Fecha o modal do minigame
    await page.locator('button', { hasText: 'close' }).click();
    await expect(page.locator('#mg-modal-container')).toHaveCount(0);
  });

  test('interage com atividade tipo Roleta pela UI', async ({ page }) => {
    await page.goto('/');
    await page.locator('h3', { hasText: cursoNome }).click();
    await page.locator('h3', { hasText: materiaNome }).click();

    await page.getByPlaceholder('Digite a senha').fill('materia123');
    await page.getByRole('button', { name: 'Confirmar' }).click();

    await page.getByRole('button', { name: /Atividades/ }).click();
    await expect(page.locator('h3', { hasText: roletaAtv.titulo })).toBeVisible();

    // Abre modal da Roleta
    await page.locator('h3', { hasText: roletaAtv.titulo }).click();
    await expect(page.getByText('Roleta do Conhecimento')).toBeVisible();

    // Clica no botão "GIRAR ROLETA"
    await page.getByRole('button', { name: 'GIRAR ROLETA' }).click();

    // Aguarda a animação da roleta terminar e exibir a pergunta
    await expect(page.getByText('Qual a linguagem usada no Vue.js?')).toBeVisible({ timeout: 15_000 });

    // Seleciona a opção de resposta
    await page.getByRole('button', { name: 'JavaScript/TypeScript' }).click();
    await page.getByRole('button', { name: 'Confirmar Resposta' }).click();

    // Clica em Continuar
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Parabéns! Atividade Concluída!')).toBeVisible();

    // Fecha o modal da roleta
    await page.locator('button', { hasText: 'close' }).first().click();
    await expect(page.getByText('Roleta do Conhecimento')).toHaveCount(0);
  });
});
