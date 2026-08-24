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
  const inContainer = process.env.PLAYWRIGHT_CONTAINER === 'true';
  return inContainer ? 'http://mailhog:8025' : 'http://localhost:18025';
}

async function waitForComprovanteMail(toEmail: string, timeoutMs = 30000): Promise<any> {
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
          return subject.includes('[Comprovante]') && to.toLowerCase().includes(toEmail.toLowerCase());
        });
        if (found) return found;
      }
    } catch {
      // Mailhog ainda não pronto
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timeout aguardando e-mail de comprovante para ${toEmail} no Mailhog`);
}

function decodeQuotedPrintable(s: string): string {
  const cleaned = s.replace(/=\r?\n/g, '');
  const bin = cleaned.replace(/=([0-9A-Fa-f]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
  return Buffer.from(bin, 'binary').toString('utf-8');
}

test.describe('Aluno — Envio de Comprovante de Resposta por E-mail (Mailhog)', () => {
  let adminToken: string;
  let professorId: number;
  let cursoId: number;
  let materiaId: number;
  let atividadeId: number;
  let profToken: string;
  const alunoEmail = `aluno_comprovante_${Date.now()}@exemplo.com`;
  const alunoNome = 'Aluno Comprovante E2E';
  const atvTitulo = `Atividade Comprovante ${uniqueName('E2E')}`;

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
        titulo: atvTitulo,
        tipo: 'normal',
        json_data: JSON.stringify({
          questions: [
            {
              title: 'Pergunta Comprovante 1',
              content: 'Qual a resposta para o teste de comprovante?',
              options: [{ text: 'Resposta Correta 1', correct: true }]
            }
          ]
        })
      }
    });
    expect([200, 201]).toContain(atvRes.status());
    atividadeId = (await atvRes.json()).id;
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) await cleanupEntities(request, adminToken, cursoId, professorId);
  });

  test('envia e-mail de comprovante quando aluno solicita com checkbox marcada', async ({ request }) => {
    const subRes = await request.post(`${E2E_BACKEND_URL}/atividades/${atividadeId}/respostas`, {
      data: {
        aluno_nome: alunoNome,
        aluno_email: alunoEmail,
        enviar_email: true,
        respostas: { '0': 'Resposta Correta 1' }
      }
    });
    expect(subRes.ok()).toBeTruthy();

    const msg = await waitForComprovanteMail(alunoEmail);
    const headers = msg.Content?.Headers || {};
    const subject = (headers.Subject || []).join(' ');
    const to = (headers.To || []).join(' ');

    expect(subject).toContain('[Comprovante]');
    expect(subject).toContain(atvTitulo);
    expect(to.toLowerCase()).toContain(alunoEmail.toLowerCase());

    const rawBody: string = msg.Content?.Body || '';
    const body = decodeQuotedPrintable(rawBody);
    expect(body).toContain(alunoNome);
    expect(body).toContain(atvTitulo);
    expect(body).toContain('Resposta Correta 1');
    expect(body).toContain('Comprovante de Envio de Atividade');
  });

  test('envia e-mail com código de recuperação de rascunho via endpoint dedicado', async ({ request }) => {
    const draftEmail = `aluno_draft_${Date.now()}@exemplo.com`;
    // 1. Salva o rascunho
    const draftRes = await request.post(`${E2E_BACKEND_URL}/atividades/${atividadeId}/rascunhos`, {
      data: {
        nome: alunoNome,
        email: draftEmail,
        respostas: { '0': 'Resposta em rascunho' }
      }
    });
    expect(draftRes.ok()).toBeTruthy();
    const draftData = await draftRes.json();
    const codigo = draftData.codigo || draftData.codigo_recuperacao;
    expect(codigo).toBeTruthy();

    // 2. Dispara envio do código por e-mail pelo endpoint dedicado
    const sendMailRes = await request.post(`${E2E_BACKEND_URL}/atividades/${atividadeId}/rascunhos/enviar-email`, {
      data: {
        email: draftEmail,
        codigo
      }
    });
    expect(sendMailRes.ok()).toBeTruthy();

    // 3. Valida no Mailhog
    const deadline = Date.now() + 30000;
    let foundMsg: any = null;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${mailhogBaseUrl()}/api/v2/messages`);
        if (res.ok) {
          const data = await res.json();
          const items: any[] = data.items || [];
          foundMsg = items.find((m) => {
            const headers = m.Content?.Headers || {};
            const subject = (headers.Subject || []).join(' ');
            const to = (headers.To || []).join(' ');
            return subject.includes('[Rascunho]') && to.toLowerCase().includes(draftEmail.toLowerCase());
          });
          if (foundMsg) break;
        }
      } catch {
        // Mailhog retry
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    expect(foundMsg).toBeTruthy();
    const headers = foundMsg.Content?.Headers || {};
    const subject = (headers.Subject || []).join(' ');
    expect(subject).toContain('[Rascunho]');
    expect(subject).toContain(atvTitulo);

    const body = decodeQuotedPrintable(foundMsg.Content?.Body || '');
    expect(body).toContain(codigo);
    expect(body).toContain('Código de Recuperação de Rascunho');
  });
});
