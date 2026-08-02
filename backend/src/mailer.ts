import nodemailer from 'nodemailer';
import { existsSync } from 'node:fs';
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
let templatesDirCache: string | null = null;
let transporterCache: nodemailer.Transporter | null = null;

function resolveTemplatesDir(): string {
  if (templatesDirCache) return templatesDirCache;
  if (process.env.TEMPLATES_DIR) {
    templatesDirCache = process.env.TEMPLATES_DIR;
  } else if (existsSync('/app/src/templates')) {
    templatesDirCache = '/app/src/templates';
  } else {
    templatesDirCache = path.join(import.meta.dir, 'templates');
  }
  return templatesDirCache;
}

function getTransporter(): nodemailer.Transporter {
  if (transporterCache) return transporterCache;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !port || !user || !pass) {
    throw new Error('SMTP não configurado');
  }

  transporterCache = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporterCache;
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
      void drain().catch((err) => {
        console.error('Fatal queue drain error:', err);
        running = false;
      });
    }
  });
}

async function drain() {
  try {
    while (queue.length > 0) {
      const job = queue.shift()!;
      try {
        await processMail(job.req);
        job.resolve({ success: true, message: 'Email enviado com sucesso' });
      } catch (err: any) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Erro ao enviar email: ${errMsg}`);
        job.resolve({ success: false, message: `Erro ao enviar email: ${errMsg}` });
      }
      if (queue.length > 0) {
        const delay = 1200 + Math.floor(Math.random() * 801);
        await Bun.sleep(delay);
      }
    }
  } finally {
    running = false;
  }
}

async function processMail(req: MailRequest): Promise<void> {
  const mailFrom = process.env.MAIL_FROM;
  if (!mailFrom) {
    throw new Error('SMTP não configurado');
  }

  const templateName = req.template || 'default.txt';
  if (
    templateName.includes('..') ||
    templateName.includes('/') ||
    templateName.includes('\\') ||
    path.basename(templateName) !== templateName
  ) {
    throw new Error('Invalid template name');
  }

  const templatePath = path.join(resolveTemplatesDir(), templateName);
  const file = Bun.file(templatePath);
  if (!(await file.exists())) {
    throw new Error('Template file not found');
  }
  let body = await file.text();

  if (req.variables) {
    for (const [k, v] of Object.entries(req.variables)) {
      body = body.replaceAll(`{{${k}}}`, () => v);
    }
  }

  const transporter = getTransporter();

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
