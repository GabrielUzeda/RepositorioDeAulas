import { defineConfig, devices } from '@playwright/test';

export const E2E_FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:15173';
export const E2E_BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:18080';
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.PROFESSOR_EMAIL || 'admin@escola.com';
const E2E_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.PROFESSOR_PASSWORD;
if (!E2E_PASSWORD) {
  throw new Error('E2E_ADMIN_PASSWORD (ou PROFESSOR_PASSWORD) deve ser definido para rodar os testes E2E.');
}
export const ADMIN_PASSWORD = E2E_PASSWORD;

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL: E2E_FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: process.env.CI || process.env.PLAYWRIGHT_CONTAINER
      ? {}
      : { executablePath: '/run/current-system/sw/bin/google-chrome' }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
