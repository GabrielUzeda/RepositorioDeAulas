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

  test('POST /auth/register and isolated professor materias', async () => {
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
    const profId = regBody.professor.id;

    // Admin cria um curso e atribui o professor 2 a ele
    const adminLogin = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@local',
        password: process.env.PROFESSOR_PASSWORD || 'ProfessorUzeda!',
      }),
    });
    const adminBody = await adminLogin.json();
    const adminToken = adminBody.token;

    const testSlug = `curso_prof2_${Date.now()}`;
    const createCursoRes = await app.request('/cursos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        slug: testSlug,
        nome: 'Curso do Professor 2',
        cor: 'bg-blue-500',
        icone: 'school',
      }),
    });
    expect(createCursoRes.status).toBe(201);
    const createdCurso = await createCursoRes.json();

    const assignRes = await app.request(`/cursos/${createdCurso.id}/professores`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ professor_ids: [profId] }),
    });
    expect(assignRes.status).toBe(200);

    // Register materia as prof2 no curso atribuído
    const createMateriaRes = await app.request('/materias', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        curso_id: createdCurso.id,
        slug: `materia_prof2_${Date.now()}`,
        nome: 'Materia do Professor 2',
        cor: 'bg-blue-500',
        icone: 'school',
      }),
    });
    expect(createMateriaRes.status).toBe(201);
    const createdMateria = await createMateriaRes.json();

    // Listar cursos autenticado como prof2 (deve ver apenas o atribuído)
    const listCursosRes = await app.request('/cursos', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const listBody = await listCursosRes.json();
    expect(listBody.length).toBeGreaterThanOrEqual(1);
    expect(listBody.some((c: any) => c.id === createdCurso.id)).toBeTruthy();

    // Test updateMateria (verify parameter order bug fix)
    const materiaId = createdMateria.id;
    const updateMateriaRes = await app.request(`/materias/${materiaId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        curso_id: createdCurso.id,
        slug: `materia_mod_${Date.now()}`,
        nome: 'Materia Modificada',
      }),
    });
    expect(updateMateriaRes.status).toBe(200);
    const updateBody = await updateMateriaRes.json();
    expect(updateBody.nome).toBe('Materia Modificada');

    // Test GET /aulas with Bearer token for protected materia
    const listAulasRes = await app.request(`/aulas?materia_id=${materiaId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listAulasRes.status).toBe(200);

    // Test GET /atividades with Bearer token for protected materia
    const listAtividadesRes = await app.request(`/atividades?materia_id=${materiaId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listAtividadesRes.status).toBe(200);
  });

  test('Security Headers present on responses', async () => {
    const res = await app.request('/cursos', { method: 'GET' });
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
    for (let i = 0; i < 100; i++) {
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
