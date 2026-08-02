import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import app from './routes';
import { initMailer } from './mailer';

const rootEnv = path.join(import.meta.dir, '..', '..', '.env');
if (existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, 'utf8').split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

initMailer();

console.log('🚀 Servidor Bun rodando em 0.0.0.0:8080');
console.log('📧 Endpoint: POST /send-mail');
console.log('📁 Templates disponíveis em: /app/templates/');
console.log('🗄️  SQLite disponível via DB_PATH');
console.log('🌐 CORS habilitado para desenvolvimento');

export default {
  port: 8080,
  hostname: '0.0.0.0',
  fetch: app.fetch,
};
