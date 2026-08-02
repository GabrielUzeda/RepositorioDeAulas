import { describe, expect, test } from 'bun:test';
import { hashPassword, verifyPassword, signJwt, verifyJwt } from './auth';
import app from './routes';

describe('Auth Module & Multi-Professor System', () => {
  test('Password Hashing & Verification', async () => {
    const password = 'SecretPassword123!';
    const { hash, salt } = await hashPassword(password);
    expect(hash).toBeDefined();
    expect(salt).toBeDefined();

    const isValid = await verifyPassword(password, hash, salt);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword('WrongPassword', hash, salt);
    expect(isInvalid).toBe(false);
  });

  test('JWT Sign & Verify', async () => {
    const payload = { sub: 123, role: 'admin' };
    const token = await signJwt(payload);
    expect(token).toBeDefined();

    const verified = await verifyJwt(token);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe(123);
    expect(verified?.role).toBe('admin');
  });

  test('POST /auth/login with admin seed credentials', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@local',
        password: process.env.PROFESSOR_PASSWORD || 'ProfessorUzeda!',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(body.professor.email).toBe('admin@local');
  });

  test('GET /check-auth with Bearer token', async () => {
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@local',
        password: process.env.PROFESSOR_PASSWORD || 'ProfessorUzeda!',
      }),
    });
    const loginBody = await loginRes.json();

    const authRes = await app.request('/check-auth', {
      method: 'GET',
      headers: { Authorization: `Bearer ${loginBody.token}` },
    });

    expect(authRes.status).toBe(200);
    const authBody = await authRes.json();
    expect(authBody.id).toBeDefined();
    expect(authBody.role).toBe('admin');
  });

  test('POST /auth/register and isolated professor turmas', async () => {
    const uniqueEmail = `prof_${Date.now()}@local`;
    const regRes = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'Password123!',
        nome: 'Professor Dois',
      }),
    });

    expect(regRes.status).toBe(201);
    const regBody = await regRes.json();
    expect(regBody.token).toBeDefined();
    const token = regBody.token;

    // Register turma as prof2
    const createTurmaRes = await app.request('/turmas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        slug: 'turma-prof2',
        nome: 'Turma do Professor 2',
        cor: 'bg-blue-500',
        icone: 'school',
      }),
    });
    expect(createTurmaRes.status).toBe(201);
    const createdTurma = await createTurmaRes.json();

    // Get turmas as prof2 (should see only own turma)
    const listTurmasRes = await app.request('/turmas', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const listBody = await listTurmasRes.json();
    expect(listBody.length).toBe(1);
    expect(listBody[0].slug).toBe('turma_prof2');

    // Test updateTurma (verify parameter order bug fix)
    const turmaId = createdTurma.id;
    const updateTurmaRes = await app.request(`/turmas/${turmaId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        slug: 'turma-prof2-mod',
        nome: 'Turma Modificada',
      }),
    });
    expect(updateTurmaRes.status).toBe(200);
    const updateBody = await updateTurmaRes.json();
    expect(updateBody.nome).toBe('Turma Modificada');

    // Test GET /aulas with Bearer token for protected turma
    const listAulasRes = await app.request(`/aulas?turma_id=${turmaId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listAulasRes.status).toBe(200);

    // Test GET /atividades with Bearer token for protected turma
    const listAtividadesRes = await app.request(`/atividades?turma_id=${turmaId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listAtividadesRes.status).toBe(200);
  });

  test('Security Headers present on responses', async () => {
    const res = await app.request('/turmas', { method: 'GET' });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBeDefined();
  });

  test('Input validation rejects invalid emails', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email-without-at', password: '123' }),
    });
    expect(res.status).toBe(400);
  });

  test('Rate Limiter blocks excessive login requests', async () => {
    for (let i = 0; i < 10; i++) {
      await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.168.1.99' },
        body: JSON.stringify({ email: 'fake@local', password: '123' }),
      });
    }
    const blockedRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.168.1.99' },
      body: JSON.stringify({ email: 'fake@local', password: '123' }),
    });
    expect(blockedRes.status).toBe(429);
  });
});
