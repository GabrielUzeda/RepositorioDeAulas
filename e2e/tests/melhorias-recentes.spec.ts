import { test, expect } from '@playwright/test';
import {
  createCurso,
  createProfessor,
  setupAdminContext,
  cleanupEntities,
  loginViaUI,
  uniqueName
} from '../helpers';

test.describe('Melhorias Recentes — RAG, Deadlines, Preview do Aluno, Validador de Email e Status', () => {
  let adminToken: string;
  let profEmail: string;
  let profPassword: string;
  let professorId: number;
  let cursoId: number;
  let cursoNome: string;
  let discNome: string;

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
    const prof = await createProfessor(request, adminToken);
    profEmail = prof.email;
    profPassword = prof.password;
    professorId = prof.id;
    const curso = await createCurso(request, adminToken, [professorId]);
    cursoId = curso.id;
    cursoNome = curso.nome;
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) {
      await cleanupEntities(request, adminToken, cursoId, professorId);
    }
  });

  test('UI: Documentos RAG, Ciclo de Vida e Editor com Prévia em Tempo Real', async ({ page }) => {
    await loginViaUI(page, profEmail, profPassword, /\/professor/);
    await expect(page.getByRole('heading', { name: 'Painel do Professor' })).toBeVisible();

    // Seleciona o curso
    await page.locator('h3', { hasText: cursoNome }).click();

    // Cria uma disciplina
    discNome = uniqueName('DiscRecente');
    await page.getByRole('button', { name: 'Nova Disciplina' }).click();
    await page.getByLabel('Nome da Disciplina *').fill(discNome);
    await page.getByRole('button', { name: 'Salvar Disciplina' }).click();
    await expect(page.locator('h3', { hasText: discNome })).toBeVisible();

    // Entra na disciplina
    await page.locator('h3', { hasText: discNome }).click();
    await expect(page.getByRole('heading', { name: discNome })).toBeVisible();

    // 1. Abre e valida o Modal de Documentos Orientadores (RAG)
    const btnRag = page.getByRole('button', { name: /Documentos RAG/i });
    await expect(btnRag).toBeVisible();
    await btnRag.click();

    await expect(page.getByRole('heading', { name: 'Documentos Orientadores (RAG)' })).toBeVisible();
    await expect(page.getByText(/Anexar Documento (Geral do Curso|da Disciplina)/)).toBeVisible();
    const btnFecharRag = page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true });
    await expect(btnFecharRag).toBeVisible();
    await btnFecharRag.click();
    await expect(page.getByRole('heading', { name: 'Documentos Orientadores (RAG)' })).not.toBeVisible();

    // 2. Abre o Editor de Atividades e valida Deadlines e Prévia em Tempo Real
    await page.getByRole('button', { name: 'Nova Atividade' }).click();
    await expect(page.getByRole('heading', { name: 'Nova Atividade Interativa' })).toBeVisible();

    // Verifica campo de prazo de entrega (Deadline)
    await expect(page.getByLabel(/Data e Hora Limite de Entrega/i)).toBeVisible();

    const atvTitulo = uniqueName('AtvComPrazo');
    await page.getByLabel('Título da Atividade *').fill(atvTitulo);

    // Adiciona uma nova questão
    await page.getByRole('button', { name: 'Adicionar Pergunta' }).click();

    // Valida controles do Split View e Prévia do Aluno
    await expect(page.getByRole('button', { name: 'Lado a Lado' })).toBeVisible();
    await page.getByRole('button', { name: 'Lado a Lado' }).click();
    await expect(page.getByText('Prévia do Aluno')).toBeVisible();

    // Preenche enunciado e verifica renderização reativa no preview
    await page.getByPlaceholder('Digite o enunciado completo da questão para o aluno...').fill('Enunciado reativo de teste no preview');
    await expect(page.locator('div', { hasText: 'Enunciado reativo de teste no preview' }).first()).toBeVisible();

    // Salva atividade
    await page.getByRole('button', { name: 'Salvar Atividade' }).click();
    await expect(page.getByRole('heading', { name: 'Nova Atividade Interativa' })).not.toBeVisible();
    await expect(page.locator('h4', { hasText: atvTitulo })).toBeVisible();

    // 3. Valida Ciclo de Vida: Toggle de visibilidade da Atividade
    const btnOcultar = page.locator('button[title="Ocultar Atividade para Alunos"]').first();
    await expect(btnOcultar).toBeVisible();
    await btnOcultar.click();

    // Após ocultar, o botão deve alternar para 'Tornar Atividade Visível'
    const btnReativar = page.locator('button[title="Tornar Atividade Visível"]').first();
    await expect(btnReativar).toBeVisible();
    await btnReativar.click();
    await expect(page.locator('button[title="Ocultar Atividade para Alunos"]').first()).toBeVisible();
  });

  test('UI Aluno: Validação com Sugestão de Typo de E-mail', async ({ page }) => {
    // Acessa a área do aluno
    await page.goto('/');
    await expect(page.getByText('Área do Aluno')).toBeVisible();

    // Seleciona o curso criado
    await page.locator('h3', { hasText: cursoNome }).click();

    // Seleciona a disciplina criada no teste anterior (nome único evita clicar no curso por corrida)
    expect(discNome).toBeTruthy();
    await page.locator('h3', { hasText: discNome }).click();

    // Alterna para a aba Atividades (aguarda a aba ficar acionável)
    await page.getByRole('tab', { name: /Atividades/i }).click();

    // Clica na atividade
    const atvCard = page.locator('h3, h4').first();
    await atvCard.click();

    // Verifica modal da atividade aberto no passo 0 (Identificação)
    const inputEmail = page.getByLabel('Seu E-mail *');
    await expect(inputEmail).toBeVisible();

    // Digita e-mail com erro de digitação comum (typo)
    await inputEmail.fill('aluno@gmai.com');

    // Deve exibir imediatamente o alerta com a sugestão de correção
    await expect(page.getByText('Você quis dizer aluno@gmail.com?')).toBeVisible();

    // Clica no botão Corrigir
    await page.getByRole('button', { name: 'Corrigir' }).click();

    // O campo de e-mail deve ter sido atualizado com o valor corrigido
    await expect(inputEmail).toHaveValue('aluno@gmail.com');
  });
});
