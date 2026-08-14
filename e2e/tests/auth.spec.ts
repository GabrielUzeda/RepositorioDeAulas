import { test, expect } from '@playwright/test';

test.describe('Autenticação & Controle de Acesso UI', () => {
  test('exibe mensagem de erro ao informar credenciais inválidas na tela de login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'RepositorioDeAulas' })).toBeVisible();

    await page.getByPlaceholder('professor@escola.edu').fill('usuario_inexistente@local');
    await page.getByPlaceholder('••••••••').fill('senha_errada');
    await page.getByRole('button', { name: 'Entrar' }).click();

    // Deve exibir o aviso de erro na tela sem navegar
    await expect(page.getByRole('alert')).toBeVisible();
    expect(page.url()).toContain('/login');
  });

  test('redireciona usuário não autenticado ao tentar acessar /admin ou /professor', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL((url) => url.pathname === '/login' && url.searchParams.get('redirect') === '/admin');
    await expect(page.getByRole('heading', { name: 'RepositorioDeAulas' })).toBeVisible();

    await page.goto('/professor');
    await page.waitForURL((url) => url.pathname === '/login' && url.searchParams.get('redirect') === '/professor');
    await expect(page.getByRole('heading', { name: 'RepositorioDeAulas' })).toBeVisible();
  });
});
