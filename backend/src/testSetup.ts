import { existsSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const testStatic = process.env.FRONTEND_STATIC_DIR || path.join(os.tmpdir(), 'repoaulas-test-static');
process.env.FRONTEND_STATIC_DIR = testStatic;
mkdirSync(testStatic, { recursive: true });

const testDb = process.env.DATABASE_PATH || './data/test.db';
const pareceBancoDeTeste =
  path.basename(testDb).toLowerCase().includes('test') ||
  testDb.startsWith('/tmp/') ||
  testDb.startsWith(os.tmpdir()) ||
  testDb.toLowerCase().includes('test');

if (!pareceBancoDeTeste && process.env.ALLOW_TEST_DB_RESET !== 'true') {
  console.error(
    `[testSetup] Recusando apagar "${testDb}": o nome do arquivo não indica um banco de teste. ` +
      'Aponte DATABASE_PATH para um arquivo com "test" no nome ou defina ALLOW_TEST_DB_RESET=true.'
  );
  process.exit(1);
}

for (const suffix of ['', '-wal', '-shm']) {
  const file = `${testDb}${suffix}`;
  if (existsSync(file)) rmSync(file);
}

process.env.DISABLE_RATE_LIMIT = 'true';
