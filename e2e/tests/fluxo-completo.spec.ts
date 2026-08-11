import { test, expect, Page, APIRequestContext, BrowserContext } from '@playwright/test';
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

async function api(request: APIRequestContext, method: 'get' | 'post' | 'put' | 'delete', path: string, token: string, data?: any) {
  const res = await request[method](`${E2E_BACKEND_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data
  });
  return res;
}

test.describe('Fluxo completo: professor → aula/atividade → aluno → avaliação → relatório de feedback', () => {
  let adminToken: string;
  let professorId: number;
  let cursoId: number;
  let materiaId: number;
  let profEmail: string;
  let profPassword: string;
  let cursoNome: string;
  let materiaNome: string;
  let aulaTitulo: string;
  let aulaCaminho: string;
  let atvTitulo: string;
  let atvId: number;
  let alunoNome = 'Aluno E2E';
  let alunoEmail = `${uniqueName('aluno')}@local`;
  let feedbackTurma = 'Turma excelente! Continuem assim.';
  let feedbackAluno = 'Parabéns pelo desempenho. Estude o material novamente.';
  let notaEsperada = 85;
  let feedbackAtividade = 'Muito bom trabalho, resposta correta e bem elaborada.';

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
    const prof = await createProfessor(request, adminToken);
    professorId = prof.id;
    profEmail = prof.email;
    profPassword = prof.password;
    const profToken = await profLogin(request, profEmail, profPassword);
    const curso = await createCurso(request, adminToken, [professorId]);
    cursoId = curso.id;
    cursoNome = curso.nome;
    const materia = await createMateria(request, profToken, cursoId);
    materiaId = materia.id;
    materiaNome = materia.nome;

    // --- Professor cria AULA (Marp Markdown) via API ---
    aulaTitulo = `Aula ${uniqueName('FULL')}`;
    const aulaRes = await api(request, 'post', '/aulas', profToken, {
      materia_id: materiaId,
      titulo: aulaTitulo,
      descricao: 'Aula de integração E2E',
      markdown: [
        '# Introdução à Aula E2E',
        '',
        'Este parágrafo foi gerado pelo teste E2E para validar o HTML produzido pelo Marp.',
        '',
        '---',
        '',
        '# Exercícios',
        '',
        'Responda a atividade disponível ao final desta aula.'
      ].join('\n')
    });
    expect([200, 201]).toContain(aulaRes.status());
    const aulaBody = await aulaRes.json();
    aulaCaminho = aulaBody.caminho;
    expect(aulaCaminho).toContain('/materias/');

    // --- Professor cria ATIVIDADE (normal, 1 questão objetiva) via API ---
    atvTitulo = `Atividade ${uniqueName('FULL')}`;
    const atvRes = await api(request, 'post', '/atividades', profToken, {
      materia_id: materiaId,
      titulo: atvTitulo,
      tipo: 'normal',
      allow_password: false,
      slug: uniqueName('atv'),
      json_data: JSON.stringify({
        questions: [
          {
            title: 'Questão 1',
            content: 'Qual é a capital do Brasil?',
            options: [
              { text: 'Brasília', correct: true, feedback: 'Correto!' },
              { text: 'Rio de Janeiro', correct: false, feedback: 'Tente de novo.' }
            ]
          }
        ]
      })
    });
    expect([200, 201]).toContain(atvRes.status());
    const atvBody = await atvRes.json();
    atvId = atvBody.id;
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) {
      await cleanupEntities(request, adminToken, cursoId, professorId);
    }
  });

  test('aluno anônimo acessa a aula (HTML gerado faz sentido) e responde a atividade', async ({ page, context }) => {
    // --- HOME: lista cursos ---
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Área do Aluno' })).toBeVisible();
    await expect(page.locator('h3', { hasText: cursoNome })).toBeVisible();

    // --- Seleciona curso → lista disciplinas ---
    await page.locator('h3', { hasText: cursoNome }).click();
    await expect(page.locator('h3', { hasText: materiaNome })).toBeVisible();

    // --- Seleciona disciplina (curso sem senha → conteúdo direto) ---
    await page.locator('h3', { hasText: materiaNome }).click();
    await expect(page.getByRole('heading', { name: materiaNome })).toBeVisible();

    // --- Aba Aulas: abre a aula em popup e valida o HTML gerado ---
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('h3', { hasText: aulaTitulo }).click()
    ]);
    await popup.waitForLoadState('load');
    await expect(popup).toHaveURL(/\/materias\//);
    const html = await popup.content();
    // O HTML gerado pelo Marp deve conter o título da aula e o conteúdo dos slides.
    expect(html).toContain('Introdução à Aula E2E');
    expect(html).toContain('validar o HTML produzido pelo Marp');
    expect(html).toContain('Exercícios');
    expect(html).toContain('class="slide');
    await popup.close();

    // --- Aba Atividades: abre e responde ---
    await page.getByRole('button', { name: /Atividades/ }).click();
    await page.locator('h3', { hasText: atvTitulo }).click();
    await page.getByLabel('Seu Nome *').fill(alunoNome);
    await page.getByLabel('Seu E-mail *').fill(alunoEmail);
    await page.getByRole('button', { name: 'Brasília' }).click();
    await page.getByRole('button', { name: 'Enviar Resposta' }).click();
    await expect(page.getByRole('heading', { name: 'Resposta Enviada com Sucesso!' })).toBeVisible();
    await expect(page.getByText(/Correção do servidor/)).toContainText('1 / 1');
  });

  test('professor avalia o aluno com nota e feedback (respostas da atividade)', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('professor@local').fill(profEmail);
    await page.getByPlaceholder('••••••••').fill(profPassword);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/professor/);
    await expect(page.getByRole('heading', { name: 'Painel do Professor' })).toBeVisible();

    // Navega: curso → disciplina → detalhes
    await page.locator('h3', { hasText: cursoNome }).click();
    const gerenciarBtn = page.getByRole('button', { name: 'Gerenciar Aulas & Atividades' });
    await expect(gerenciarBtn).toBeVisible();
    await gerenciarBtn.click();
    await expect(page.getByRole('heading', { name: materiaNome })).toBeVisible();

    // Abre respostas da atividade
    await page.getByRole('button', { name: 'Ver Respostas dos Alunos' }).click();
    await expect(page.getByText('Respostas dos Alunos')).toBeVisible();
    await expect(page.getByText(`Total de Envios: 1`)).toBeVisible();

    // Avalia
    await page.getByRole('button', { name: 'Avaliar / Ver' }).first().click();
    await page.getByPlaceholder('Ex: 85').fill(String(notaEsperada));
    await page.getByPlaceholder('Escreva um comentário pedagógico para este aluno...').fill(feedbackAtividade);
    await page.getByRole('button', { name: 'Salvar Avaliação' }).click();
    await expect(page.getByText('Avaliação Salva!')).toBeVisible();
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  });

  test('professor gera o relatório de feedback da turma com feedback geral e individual', async ({ page, request }) => {
    await page.goto('/login');
    await page.getByPlaceholder('professor@local').fill(profEmail);
    await page.getByPlaceholder('••••••••').fill(profPassword);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/professor/);
    await expect(page.getByRole('heading', { name: 'Painel do Professor' })).toBeVisible();

    // Navega até os detalhes da disciplina
    await page.locator('h3', { hasText: cursoNome }).click();
    const gerenciarBtn = page.getByRole('button', { name: 'Gerenciar Aulas & Atividades' });
    await expect(gerenciarBtn).toBeVisible();
    await gerenciarBtn.click();
    await expect(page.getByRole('heading', { name: materiaNome })).toBeVisible();

    // Abre o relatório consolidado
    await page.getByText('Gerar Feedback da Disciplina').click();
    await expect(page.getByRole('heading', { name: 'Relatório de Feedback da Disciplina' })).toBeVisible();

    // Feedback geral da turma — deve conter a nota/feedback da atividade já persistidos
    await expect(page.getByText('Atividades Enviadas & Notas:')).toBeVisible();
    await expect(page.getByText(`${notaEsperada}/100`)).toBeVisible();

    // Salva feedback da TURMA
    await page.getByPlaceholder('Digite um comunicado ou feedback geral para toda a turma nesta disciplina...').fill(feedbackTurma);
    await page.getByRole('button', { name: 'Salvar Feedback da Turma' }).click();
    await expect(page.getByText('Feedback Geral da Turma salvo com sucesso!')).toBeVisible();

    // Salva feedback INDIVIDUAL do aluno
    await page.getByPlaceholder('Escreva observações pedagógicas gerais para este aluno...').fill(feedbackAluno);
    await page.getByRole('button', { name: 'Salvar Feedback', exact: true }).click();
    await expect(page.getByText(`Feedback para ${alunoNome} salvo!`)).toBeVisible();

    // VALIDAÇÃO via API: relatório consolidado com turma + aluno + nota + feedback
    const profToken = await profLogin(request, profEmail, profPassword);
    const relRes = await api(request, 'get', `/disciplinas/${materiaId}/relatorio-feedback`, profToken);
    expect(relRes.ok()).toBeTruthy();
    const relBody = await relRes.json();
    expect(relBody.success).toBeTruthy();
    expect(relBody.data.feedback_turma).toBe(feedbackTurma);
    expect(relBody.data.alunos).toHaveLength(1);
    const alunoRow = relBody.data.alunos[0];
    expect(alunoRow.aluno_nome).toBe(alunoNome);
    expect(alunoRow.aluno_email).toBe(alunoEmail);
    expect(alunoRow.feedback_geral).toBe(feedbackAluno);
    expect(alunoRow.ja_enviado).toBeFalsy();
    expect(alunoRow.atividades).toHaveLength(1);
    expect(alunoRow.atividades[0].atividade_titulo).toBe(atvTitulo);
    expect(alunoRow.atividades[0].nota).toBe(notaEsperada);
    expect(alunoRow.atividades[0].feedback).toBe(feedbackAtividade);
  });
});