import { existsSync, rmSync } from 'node:fs';

const testDb = process.env.DATABASE_PATH || './data/test.db';

for (const suffix of ['', '-wal', '-shm']) {
  const file = `${testDb}${suffix}`;
  if (existsSync(file)) rmSync(file);
}

process.env.DISABLE_RATE_LIMIT = 'true';
