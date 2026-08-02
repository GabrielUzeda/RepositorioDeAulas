import './env';
import app from './routes';
import { initMailer } from './mailer';

initMailer();

console.log(`🚀 Servidor Bun rodando em ${process.env.HOST || '0.0.0.0'}:${Number(process.env.PORT) || 8080}`);
console.log('📧 Endpoint: POST /send-mail');
console.log('📁 Templates disponíveis em: /app/src/templates/');
console.log('🗄️  SQLite disponível via DB_PATH');
console.log('🌐 CORS habilitado para desenvolvimento');

export default {
  port: Number(process.env.PORT) || 8080,
  hostname: process.env.HOST || '0.0.0.0',
  fetch: app.fetch,
};
