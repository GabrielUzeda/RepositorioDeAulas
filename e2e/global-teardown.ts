import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execSync } from 'node:child_process';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, '..');

function composeE2E(...args: string[]) {
  execSync(`docker compose -f docker-compose.e2e.yml ${args.join(' ')}`, {
    cwd: repoRoot,
    stdio: 'inherit'
  });
}

export default async function globalTeardown() {
  if (process.env.PLAYWRIGHT_CONTAINER) {
    return;
  }
  composeE2E('down', '--remove-orphans');
}
