import { describe, expect, test } from 'bun:test';
import { signJwt } from './auth';
import app from './routes';

describe('AI Module & 9router Integration', () => {
  test('GET /ai/health returns status', async () => {
    const adminToken = await signJwt({ sub: '1', email: 'admin@escola.com', role: 'admin' });
    const res = await app.request('/ai/health', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect([200, 502, 503]).toContain(res.status);
    const data = await res.json() as any;
    expect(data).toHaveProperty('status');
  });

  test('GET /ai/models lists models or handles offline gracefully', async () => {
    const adminToken = await signJwt({ sub: '1', email: 'admin@escola.com', role: 'admin' });
    const res = await app.request('/ai/models', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect([200, 502, 503]).toContain(res.status);
    const data = await res.json() as any;
    expect(data).toHaveProperty('success');
  });

  test.each([
    ['normal', 'questão discursiva sem alternativas'],
    ['prova', 'prova discursiva sem alternativas'],
    ['minigame', 'objetiva sem feedback'],
    ['roleta', 'objetiva com feedback'],
    ['reforco', 'objetiva com feedback'],
  ] as const)('POST /ai/generate-activity (%s) gera %s', async (tipo, _label) => {
    const adminToken = await signJwt({ sub: '1', email: 'admin@escola.com', role: 'admin' });
    const res = await app.request('/ai/generate-activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ tipo, tema: 'Fundamentos de redes de computadores', quantidade: 1 })
    });
    if ([502, 503].includes(res.status)) return;

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(Array.isArray(data.questions)).toBe(true);
    expect(data.questions.length).toBeGreaterThan(0);

    const isDiscursive = tipo === 'normal' || tipo === 'prova';
    for (const q of data.questions) {
      expect(q.content).toBeTruthy();
      if (isDiscursive) {
        expect(q.options).toBeUndefined();
      } else {
        expect(Array.isArray(q.options)).toBe(true);
        expect(q.options.length).toBeGreaterThan(0);
        if (tipo === 'minigame') {
          for (const o of q.options) expect(o.feedback).toBe('');
          expect(q.options.some((o: any) => o.correct)).toBe(true);
        }
        expect(q.options.some((o: any) => o.correct)).toBe(true);
      }
    }
  }, 180000);

  test('POST /ai/generate-activity rejects without credentials or payload', async () => {
    const resNoAuth = await app.request('/ai/generate-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tema: 'Teste' })
    });
    expect(resNoAuth.status).toBe(401);

    const adminToken = await signJwt({ sub: '1', email: 'admin@escola.com', role: 'admin' });
    const resEmpty = await app.request('/ai/generate-activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({})
    });
    expect(resEmpty.status).toBe(400);
  });

  test('POST /ai/evaluate-response validates payload and auth', async () => {
    const resNoAuth = await app.request('/ai/evaluate-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questao_enunciado: 'Q1', resposta_aluno: 'R1' })
    });
    expect(resNoAuth.status).toBe(401);

    const adminToken = await signJwt({ sub: '1', email: 'admin@escola.com', role: 'admin' });
    const resNoPayload = await app.request('/ai/evaluate-response', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({})
    });
    expect(resNoPayload.status).toBe(400);
  });

  test('POST /ai/synthesize-class-feedback validates auth and structure', async () => {
    const resNoAuth = await app.request('/ai/synthesize-class-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disciplina_nome: 'Algoritmos' })
    });
    expect(resNoAuth.status).toBe(401);

    const adminToken = await signJwt({ sub: '1', email: 'admin@escola.com', role: 'admin' });
    const resAuth = await app.request('/ai/synthesize-class-feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        disciplina_nome: 'Algoritmos',
        total_envios: 1,
        alunos_detalhes: [
          {
            aluno_nome: 'Aluno Teste',
            aluno_email: 'aluno@teste.com',
            media: 90,
            atividades: [
              { atividade_titulo: 'Atv 1', nota: 90, feedback: 'Bom trabalho com laços' }
            ]
          }
        ]
      })
    });
    expect([200, 502, 503]).toContain(resAuth.status);
    if (resAuth.status === 200) {
      const data = await resAuth.json() as any;
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('feedback_geral');
      expect(Array.isArray(data.pontos_fortes)).toBe(true);
      expect(Array.isArray(data.pontos_atencao)).toBe(true);
      expect(Array.isArray(data.alunos_sintese)).toBe(true);
    }
  });

  test('POST /ai/evaluate-activity-responses validates auth and payload', async () => {
    const resNoAuth = await app.request('/ai/evaluate-activity-responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atividade_id: 1 })
    });
    expect(resNoAuth.status).toBe(401);

    const adminToken = await signJwt({ sub: '1', email: 'admin@escola.com', role: 'admin' });
    const resNoPayload = await app.request('/ai/evaluate-activity-responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({})
    });
    expect(resNoPayload.status).toBe(400);

    const resNotFound = await app.request('/ai/evaluate-activity-responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ atividade_id: 999999 })
    });
    expect(resNotFound.status).toBe(404);
  });

  test('POST /ai/evaluate-activity-responses handles empty submissions gracefully', async () => {
    const adminToken = await signJwt({ sub: '1', email: 'admin@escola.com', role: 'admin' });
    const res = await app.request('/ai/evaluate-activity-responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ atividade_id: 2 })
    });
    expect([200, 502]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.total).toBe(0);
      expect(data.avaliados).toBe(0);
      expect(Array.isArray(data.sucessos)).toBe(true);
      expect(Array.isArray(data.falhas)).toBe(true);
      expect(Array.isArray(data.avaliacoes)).toBe(true);
    }
  });

  test('POST /atividades/:id/avaliar-respostas-ia delegates to evaluate-activity-responses', async () => {
    const adminToken = await signJwt({ sub: '1', email: 'admin@escola.com', role: 'admin' });
    const res = await app.request('/atividades/2/avaliar-respostas-ia', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({})
    });
    expect([200, 502]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.total).toBe(0);
    }
  });

  test('POST /ai/evaluate-activity-responses accepts severidade and observacoes payload', async () => {
    const adminToken = await signJwt({ sub: '1', email: 'admin@escola.com', role: 'admin' });
    const res = await app.request('/ai/evaluate-activity-responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        atividade_id: 2,
        severidade: 'rigoroso',
        observacoes: 'Penalizar falta de unidades de medida.'
      })
    });
    expect([200, 502]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.total).toBe(0);
    }
  });
});
