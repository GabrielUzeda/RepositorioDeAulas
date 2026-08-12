import { test, expect } from '@playwright/test';
import {
  createCurso,
  createMateria,
  createProfessor,
  setupAdminContext,
  cleanupEntities,
  E2E_BACKEND_URL,
  uniqueName
} from '../helpers';

function mailhogBaseUrl(): string {
  // Dentro do container Playwright a rede é 'mailhog:8025'; no host (rodando localmente)
  // o compose mapeia a porta 8025 do mailhog para 18025.
  const inContainer = process.env.PLAYWRIGHT_CONTAINER === 'true';
  return inContainer ? 'http://mailhog:8025' : 'http://localhost:18025';
}

async function waitForFeedbackMail(toEmail: string, timeoutMs = 30000): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${mailhogBaseUrl()}/api/v2/messages`);
      if (res.ok) {
        const data = await res.json();
        const items: any[] = data.items || [];
        const found = items.find((m) => {
          const headers = m.Content?.Headers || {};
          const subject = (headers.Subject || []).join(' ');
          const to = (headers.To || []).join(' ');
          return subject.includes('Feedback') && to.toLowerCase().includes(toEmail.toLowerCase());
        });
        if (found) return found;
      }
    } catch {
      // mailhog ainda não está pronto
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timeout aguardando e-mail de feedback para ${toEmail} no Mailhog`);
}

test.describe('Professor — Entrega real de e-mail de Feedback (Mailhog)', () => {
  let adminToken: string;
  let professorId: number;
  let cursoId: number;
  let materiaId: number;
  let atividadeId: number;
  let profToken: string;
  const alunoEmail = `aluno_feedback_${Date.now()}@exemplo.com`;
  const alunoNome = 'Aluno Feedback E2E';

  test.beforeAll(async ({ request }) => {
    ({ adminToken } = await setupAdminContext(request));
    const prof = await createProfessor(request, adminToken);
    professorId = prof.id;

    const loginRes = await request.post(`${E2E_BACKEND_URL}/auth/login`, {
      data: { email: prof.email, password: prof.password }
    });
    expect(loginRes.ok()).toBeTruthy();
    profToken = (await loginRes.json()).token;

    const curso = await createCurso(request, adminToken, [professorId]);
    cursoId = curso.id;

    const materia = await createMateria(request, profToken, cursoId);
    materiaId = materia.id;

    const atvRes = await request.post(`${E2E_BACKEND_URL}/atividades`, {
      headers: { Authorization: `Bearer ${profToken}` },
      data: {
        materia_id: materiaId,
        titulo: `Atividade Feedback ${uniqueName('E2E')}`,
        tipo: 'normal',
        json_data: JSON.stringify({
          questions: [
            {
              title: 'Questão Feedback',
              content: 'Pergunta de avaliação?',
              options: [{ text: 'Opção 1', correct: true }]
            }
          ]
        })
      }
    });
    expect([200, 201]).toContain(atvRes.status());
    atividadeId = (await atvRes.json()).id;

    // Submeter resposta do aluno (anônima)
    const subRes = await request.post(`${E2E_BACKEND_URL}/submeter-resposta`, {
      data: {
        atividade_id: atividadeId,
        aluno_nome: alunoNome,
        aluno_email: alunoEmail,
        respostas: { '0': 'Opção 1' }
      }
    });
    expect(subRes.ok()).toBeTruthy();
    const respId = (await subRes.json()).id;

    // Professor salva avaliação (nota + feedback)
    const avalRes = await request.put(`${E2E_BACKEND_URL}/respostas/${respId}/avaliacao`, {
      headers: { Authorization: `Bearer ${profToken}` },
      data: { nota: 90, feedback: 'Muito bom!' }
    });
    expect(avalRes.ok()).toBeTruthy();

    // Disparar envio dos e-mails de feedback
    const envioRes = await request.post(
      `${E2E_BACKEND_URL}/disciplinas/${materiaId}/enviar-emails-feedback`,
      {
        headers: { Authorization: `Bearer ${profToken}` },
        data: {}
      }
    );
    expect(envioRes.ok()).toBeTruthy();
    const envioJson = await envioRes.json();
    expect(envioJson.enviados).toBeGreaterThan(0);
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) await cleanupEntities(request, adminToken, cursoId, professorId);
  });

  function decodeRfc2047(s: string): string {
    const re = /=\?UTF-8\?Q\?(.*?)\?=/g;
    let out = '';
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      out += s.slice(lastIndex, m.index);
      const enc = m[1] as string;
      const bin = enc
        .replace(/_/g, ' ')
        .replace(/=([0-9A-Fa-f]{2})/g, (_x, h) => String.fromCharCode(parseInt(h, 16)));
      out += Buffer.from(bin, 'binary').toString('utf-8');
      lastIndex = re.lastIndex;
      // RFC2047: espaço entre dois encoded-words é descartado (não exibido)
      if (s[lastIndex] === ' ' && s.startsWith('=?UTF-8?Q?', lastIndex + 1)) {
        lastIndex += 1;
      }
    }
    out += s.slice(lastIndex);
    return out;
  }

  function decodeQuotedPrintable(s: string): string {
    const cleaned = s.replace(/=\r?\n/g, '');
    const bin = cleaned.replace(/=([0-9A-Fa-f]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
    return Buffer.from(bin, 'binary').toString('utf-8');
  }

  test('e-mail de feedback é entregue e possui assunto/conteúdo corretos', async () => {
    const msg = await waitForFeedbackMail(alunoEmail);
    const headers = msg.Content?.Headers || {};
    const subject = decodeRfc2047((headers.Subject || []).join(' '));
    const to = (headers.To || []).join(' ');

    expect(subject).toContain('Feedback');
    expect(subject).toContain('Relatório de Avaliação');
    expect(to.toLowerCase()).toContain(alunoEmail.toLowerCase());

    const rawBody: string = msg.Content?.Body || '';
    const body = decodeQuotedPrintable(rawBody);
    expect(body).toContain(alunoNome);
    expect(body).toContain('Relatório de Feedback');
  });
});
