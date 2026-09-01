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
});
