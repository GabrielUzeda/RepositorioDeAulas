import './env';
import app from './routes';
import { initMailer } from './mailer';
import { runDataRetentionPurge } from './db';

initMailer();

// [4.4] Retenção LGPD (Art. 15/16): purga de dados antigos na inicialização e
// diariamente. `.unref()` evita que o timer impeça o encerramento do processo.
runDataRetentionPurge();
setInterval(runDataRetentionPurge, 24 * 60 * 60 * 1000).unref();

console.log(`🚀 Servidor Bun rodando em ${process.env.HOST || '0.0.0.0'}:${Number(process.env.PORT) || 8080}`);
console.log('📧 Endpoint: POST /send-mail');
console.log('📁 Templates disponíveis em: /app/src/templates/');
console.log('🗄️  SQLite disponível via DB_PATH');
console.log(`🌐 CORS restrito por CORS_ORIGIN (fallback: http://localhost) — ${process.env.CORS_ORIGIN ? 'configurado' : 'não definido (dev)'}`);

export default {
  port: Number(process.env.PORT) || 8080,
  hostname: process.env.HOST || '0.0.0.0',
  fetch: app.fetch,
};
