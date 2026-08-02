import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const rootEnv = path.join(import.meta.dir, '..', '..', '.env');
if (existsSync(rootEnv)) {
  for (const raw of readFileSync(rootEnv, 'utf8').split('\n')) {
    const line = raw.replace(/\r$/, '').replace(/^export\s+/, '');
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && !(m[1] in process.env)) {
      let value = m[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[m[1]] = value;
    }
  }
}
