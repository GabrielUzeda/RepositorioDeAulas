import nodemailer from 'nodemailer';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface MailRequest {
  to: string;
  subject: string;
  template?: string;
  variables?: Record<string, string>;
}

interface MailJob {
  req: MailRequest;
  resolve: (resp: { success: boolean; message: string }) => void;
}

const MAX_QUEUE = 100;
let queue: MailJob[] = [];
let running = false;

function resolveTemplatesDir(): string {
  if (process.env.TEMPLATES_DIR) return process.env.TEMPLATES_DIR;
  if (existsSync('/app/templates')) return '/app/templates';
  return path.join(import.meta.dir, '..', 'templates');
}

export function initMailer() {
  // Kept for parity with the original startup sequence; queue starts lazily.
}

export async function sendMail(req: MailRequest): Promise<{ success: boolean; message: string }> {
  if (queue.length >= MAX_QUEUE) {
    return { success: false, message: 'Erro ao enfileirar email' };
  }

  return new Promise((resolve) => {
    queue.push({ req, resolve });
    if (!running) {
      running = true;
      void drain();
    }
  });
}

async function drain() {
  while (queue.length > 0) {
    const job = queue.shift()!;
    try {
      await processMail(job.req);
      job.resolve({ success: true, message: 'Email enviado com sucesso' });
    } catch (err: any) {
      console.error(`Erro ao enviar email: ${err?.message}`);
      job.resolve({ success: false, message: `Erro ao enviar email: ${err?.message}` });
    }
    const delay = 1200 + Math.floor(Math.random() * 801);
    await Bun.sleep(delay);
  }
  running = false;
}

async function processMail(req: MailRequest): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASSWORD;
  const mailFrom = process.env.MAIL_FROM;

  if (!host || !port || !user || !pass || !mailFrom) {
    throw new Error('SMTP não configurado');
  }

  const templateName = req.template || 'default.txt';
  if (templateName.includes('/') || templateName.includes('\\') || templateName.includes('..')) {
    throw new Error('Invalid template name');
  }

  const templatePath = path.join(resolveTemplatesDir(), templateName);
  let body = readFileSync(templatePath, 'utf8');

  if (req.variables) {
    for (const [k, v] of Object.entries(req.variables)) {
      body = body.replaceAll(`{{${k}}}`, v);
    }
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const message: Record<string, string> = {
    from: mailFrom,
    to: req.to,
    subject: req.subject,
  };
  if (templateName.endsWith('.html')) {
    message.html = body;
  } else {
    message.text = body;
  }

  await transporter.sendMail(message);
}
