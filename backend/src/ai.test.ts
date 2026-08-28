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
