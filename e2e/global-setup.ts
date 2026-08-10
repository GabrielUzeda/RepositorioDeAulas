import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execSync } from 'node:child_process';

const E2E_FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:15173';
const E2E_BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:18080';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, '..');
const testDbPath = path.join(repoRoot, 'backend', 'data', 'e2e-test.db');

function composeE2E(...args: string[]) {
  execSync(`docker compose -f docker-compose.e2e.yml ${args.join(' ')}`, {
    cwd: repoRoot,
    stdio: 'inherit'
  });
}

async function waitFor(url: string, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

export default async function globalSetup() {
  if (process.env.PLAYWRIGHT_CONTAINER) {
    console.log('[e2e] Rodando dentro do container Playwright. Aguardando serviços...');
    await waitFor(`${E2E_BACKEND_URL}/cursos`);
    await waitFor(E2E_FRONTEND_URL);
    console.log('[e2e] Serviços prontos.');
    return;
  }
  console.log('[e2e] Resetando DB de teste...');
  composeE2E('down', '--remove-orphans');
  for (const suffix of ['', '-wal', '-shm']) {
    const p = `${testDbPath}${suffix}`;
    if (existsSync(p)) rmSync(p, { force: true });
  }
  console.log('[e2e] Subindo stack isolado...');
  composeE2E('up', '-d', 'bun-server', 'vite');
  await waitFor(`${E2E_BACKEND_URL}/db-test`);
  await waitFor(E2E_FRONTEND_URL);
  console.log('[e2e] Stack pronto.');
}
