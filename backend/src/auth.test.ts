import { describe, expect, test } from 'bun:test';
import { unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';
import { hashPassword, verifyPassword, signJwt, verifyJwt } from './auth';
import { resolveFrontendDir, generateMarpNextStandaloneHtml } from './marp';
import { db, runDataRetentionPurge, purgeOldRanking } from './db';
import app from './routes';

const ADMIN_SEED_PASSWORD = process.env.PROFESSOR_PASSWORD || 'MudeEstaSenha!';

function senhasDaAtividade(atividadeId: number): { senha_curso: string; senha_atividade: string } {
  const row = db
    .query(
      `SELECT c.senha AS curso_senha, a.senha AS atv_senha, a.allow_password
       FROM cursos c
       JOIN disciplinas d ON d.curso_id = c.id
       JOIN atividades a ON a.disciplina_id = d.id
       WHERE a.id = ?`
    )
    .get(atividadeId) as any;
  return {
    senha_curso: (row && row.curso_senha) || '',
    senha_atividade: (row && row.allow_password && row.atv_senha) ? row.atv_senha : '',
  };
}

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
        email: 'admin@escola.com',
        password: ADMIN_SEED_PASSWORD,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(body.professor.email).toBe('admin@escola.com');
  });

  test('GET /check-auth with Bearer token', async () => {
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@escola.com',
        password: ADMIN_SEED_PASSWORD,
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
    expect(regBody.token).toBeUndefined();
    expect(regBody.professor.status).toBe('pendente');
    const profId = regBody.professor.id;

    // Login com professor pendente deve ser negado (aguardando aprovação)
    const pendingLogin = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail, password: 'Password123!' }),
    });
    expect(pendingLogin.status).toBe(403);

    // Admin cria um curso e atribui o professor 2 a ele
    const adminLogin = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@escola.com',
        password: ADMIN_SEED_PASSWORD,
      }),
    });
    const adminBody = await adminLogin.json();
    const adminToken = adminBody.token;

    // Admin aprova o professor pendente
    const approveRes = await app.request(`/professores/${profId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'ativo' }),
    });
    expect(approveRes.status).toBe(200);

    // Login agora funciona
    const profLogin = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail, password: 'Password123!' }),
    });
    expect(profLogin.status).toBe(200);
    const profLoginBody = await profLogin.json();
    const token = profLoginBody.token;

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
    const cData = await createCursoRes.json();
    const curso2Id = cData.id;

    // Vincular prof2 ao curso2
    await app.request(`/professores/${profId}/cursos`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ curso_ids: [curso2Id] }),
    });

    // POST /disciplinas enviando apenas nome (sem slug)
    const createDiscRes = await app.request('/disciplinas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        nome: 'Programacao Web',
        descricao: 'Aula de programacao',
        cor: 'bg-emerald-600',
        icone: 'school',
        curso_id: curso2Id,
      }),
    });
    expect(createDiscRes.status).toBe(201);
    const discData = await createDiscRes.json();
    expect(discData.slug).toBe('programacao_web');

    const assignRes = await app.request(`/cursos/${cData.id}/professores`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ professor_ids: [profId] }),
    });
    expect(assignRes.status).toBe(200);

    // Register disciplina as prof2 no curso atribuído
    const createMateriaRes = await app.request('/disciplinas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        curso_id: cData.id,
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
    expect(listBody.some((c: any) => c.id === cData.id)).toBeTruthy();

    // Test updateDisciplina (verify parameter order bug fix)
    const materiaId = createdMateria.id;
    const updateMateriaRes = await app.request(`/disciplinas/${materiaId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        curso_id: cData.id,
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

  test('Materia senha aceita via header x-materia-senha e via ?senha= (item 2.6)', async () => {
    const materia = db.query(`SELECT id, curso_id FROM disciplinas WHERE slug = 'demo-class'`).get() as any;
    expect(materia).toBeDefined();
    const materiaId = materia.id;
    const curso = db.query(`SELECT senha FROM cursos WHERE id = ?`).get(materia.curso_id) as any;
    const senha = curso?.senha || 'asdf1234';

    const viaHeader = await app.request(`/aulas?materia_id=${materiaId}`, {
      method: 'GET',
      headers: { 'x-materia-senha': senha },
    });
    expect(viaHeader.status).toBe(200);

    const viaQuery = await app.request(`/aulas?materia_id=${materiaId}&senha=${encodeURIComponent(senha)}`, {
      method: 'GET',
    });
    expect(viaQuery.status).toBe(200);
  });

  test('CSP header present on marp HTML served by GET /materias/* (item 3.9)', async () => {
    const materia = db.query(`SELECT id FROM disciplinas WHERE slug = 'demo-class'`).get() as any;
    const adminLogin = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.3' },
      body: JSON.stringify({ email: 'admin@escola.com', password: ADMIN_SEED_PASSWORD }),
    });
    const { token } = await adminLogin.json();

    const createRes = await app.request('/aulas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        materia_id: materia.id,
        titulo: `CSP Teste ${Date.now()}`,
        markdown: '# Slide 1\n```mermaid\ngraph TD\nA-->B\n```',
      }),
    });
    expect(createRes.status).toBe(201);
    const aula = await createRes.json();
    expect(aula.caminho).toMatch(/\.html$/);

    const res = await app.request(`/${aula.caminho}`, {
      method: 'GET',
      headers: { 'x-materia-senha': 'asdf1234' },
    });
    expect(res.status).toBe(200);
    const csp = res.headers.get('content-security-policy');
    expect(csp).toBeDefined();
    expect(csp).toContain('script-src');

    const htmlAbs = path.join(resolveFrontendDir(), aula.caminho);
    const mdAbs = htmlAbs.replace(/\.html$/, '.md');
    for (const f of [htmlAbs, mdAbs]) {
      if (existsSync(f)) unlinkSync(f);
    }
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

  test('Submeter, listar e excluir respostas de alunos (LGPD)', async () => {
    const atv = db.query('SELECT id FROM atividades LIMIT 1').get() as any;
    const targetAtvId = atv ? atv.id : 1;
    const senhas = senhasDaAtividade(targetAtvId);

    const submitRes = await app.request('/submeter-resposta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.2' },
      body: JSON.stringify({
        atividade_id: targetAtvId,
        aluno_nome: 'João Silva',
        aluno_email: 'joao.silva@exemplo.com',
        respostas: 'Resposta 1: A\nResposta 2: B',
        senha_curso: senhas.senha_curso,
        senha_atividade: senhas.senha_atividade,
      }),
    });
    expect([200, 201]).toContain(submitRes.status);
    const createdResp = await submitRes.json();
    expect(createdResp.aluno_nome).toBe('João Silva');

    const adminLogin = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.2' },
      body: JSON.stringify({ email: 'admin@escola.com', password: ADMIN_SEED_PASSWORD }),
    });
    const { token } = await adminLogin.json();

    const listRes = await app.request(`/atividades/${targetAtvId}/respostas`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.some((r: any) => r.id === createdResp.id)).toBeTruthy();

    // Consulta do próprio aluno aos seus dados (Art. 18 LGPD) — exige token de consulta
    const consultaToken = createdResp.consulta_token;
    expect(typeof consultaToken).toBe('string');
    expect(consultaToken.length).toBeGreaterThan(0);

    const alunoSelfRes = await app.request(`/aluno/minhas-respostas?email=joao.silva@exemplo.com&token=${encodeURIComponent(consultaToken)}`, {
      method: 'GET',
    });
    expect(alunoSelfRes.status).toBe(200);
    const alunoSelfData = await alunoSelfRes.json();
    expect(alunoSelfData.some((r: any) => r.id === createdResp.id)).toBeTruthy();

    // Sem token, a consulta deve ser negada
    const alunoSemToken = await app.request('/aluno/minhas-respostas?email=joao.silva@exemplo.com', { method: 'GET' });
    expect(alunoSemToken.status).toBe(401);

    // Token errado também é negado
    const alunoTokenErrado = await app.request('/aluno/minhas-respostas?email=joao.silva@exemplo.com&token=token_invalido_qualquer', { method: 'GET' });
    expect(alunoTokenErrado.status).toBe(401);

    const delRes = await app.request(`/respostas/${createdResp.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(delRes.status).toBe(204);
  });

  test('Retenção: runDataRetentionPurge remove só dados antigos (item 4.4)', async () => {
    const atv = db.query('SELECT id FROM atividades LIMIT 1').get() as any;
    const atvId = atv ? atv.id : 1;

    const old = db
      .query(
        `INSERT INTO respostas_alunos (atividade_id, aluno_nome, aluno_email, aluno_email_hash, respostas, criado_em)
         VALUES (?, ?, ?, ?, ?, datetime('now','-730 days')) RETURNING id`
      )
      .get(atvId, 'Antigo Aluno', 'antigo@exemplo.com', 'hash_antigo', 'x') as any;

    const fresh = db
      .query(
        `INSERT INTO respostas_alunos (atividade_id, aluno_nome, aluno_email, aluno_email_hash, respostas)
         VALUES (?, ?, ?, ?, ?) RETURNING id`
      )
      .get(atvId, 'Aluno Novo', 'novo@exemplo.com', 'hash_novo', 'y') as any;

    runDataRetentionPurge();

    expect(db.query('SELECT id FROM respostas_alunos WHERE id = ?').get(old.id)).toBeNull();
    expect(db.query('SELECT id FROM respostas_alunos WHERE id = ?').get(fresh.id)).toBeDefined();
  });

  test('Retenção de Ranking: expurga registros com mais de 30 dias', async () => {
    const atv = db.query('SELECT id FROM atividades LIMIT 1').get() as any;
    const atvId = atv ? atv.id : 1;

    const oldRank = db
      .query(
        `INSERT INTO ranking (atividade_id, nome_jogador, pontuacao, data_envio)
         VALUES (?, ?, ?, datetime('now','-35 days')) RETURNING id`
      )
      .get(atvId, 'Piloto Antigo', 1500) as any;

    const freshRank = db
      .query(
        `INSERT INTO ranking (atividade_id, nome_jogador, pontuacao)
         VALUES (?, ?, ?) RETURNING id`
      )
      .get(atvId, 'Piloto Recente', 2000) as any;

    purgeOldRanking(30);

    expect(db.query('SELECT id FROM ranking WHERE id = ?').get(oldRank.id)).toBeNull();
    expect(db.query('SELECT id FROM ranking WHERE id = ?').get(freshRank.id)).toBeDefined();
  });

  test('Correção objetiva no servidor retorna acertos/total/pontuacao (item 3.6)', async () => {
    const atv = db
      .query("SELECT id, json_data FROM atividades WHERE json_data IS NOT NULL AND json_data LIKE '%\\\"correct\\\"%' LIMIT 1")
      .get() as any;
    const atvId = atv ? atv.id : 1;
    const senhas = senhasDaAtividade(atvId);

    const submitRes = await app.request('/submeter-resposta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.3' },
      body: JSON.stringify({
        atividade_id: atvId,
        aluno_nome: 'Teste 3.6',
        aluno_email: 'teste36@exemplo.com',
        respostas: JSON.stringify([{ questao: 'SFTP', resposta: 'SFTP' }]),
        senha_curso: senhas.senha_curso,
        senha_atividade: senhas.senha_atividade,
      }),
    });
    expect([200, 201]).toContain(submitRes.status);
    const data = await submitRes.json();
    expect(data).toHaveProperty('acertos');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('pontuacao');
    expect(typeof data.acertos).toBe('number');
    expect(typeof data.pontuacao).toBe('number');
  });

  test('Criptografia em repouso e Audit Logs (itens 5.1 e 5.4)', async () => {
    const atv = db.query('SELECT id FROM atividades LIMIT 1').get() as any;
    const atvId = atv ? atv.id : 1;
    const senhas = senhasDaAtividade(atvId);

    const emailTest = 'aluno.lgpd@exemplo.com';
    const nomeTest = 'Aluno LGPD Cripto';
    const respTest = 'Resposta confidencial LGPD';

    const res = await app.request('/submeter-resposta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.99' },
      body: JSON.stringify({
        atividade_id: atvId,
        aluno_nome: nomeTest,
        aluno_email: emailTest,
        respostas: respTest,
        senha_curso: senhas.senha_curso,
        senha_atividade: senhas.senha_atividade,
      }),
    });
    expect([200, 201]).toContain(res.status);
    const resData = await res.json();
    expect(resData.aluno_nome).toBe(nomeTest);

    // Verificação no SQLite: dados devem estar encriptados com prefixo enc:v1:
    const rawRow = db.query('SELECT * FROM respostas_alunos WHERE id = ?').get(resData.id) as any;
    expect(rawRow.aluno_nome).not.toBe(nomeTest);
    expect(rawRow.aluno_nome.startsWith('enc:v1:')).toBe(true);
    expect(rawRow.aluno_email.startsWith('enc:v1:')).toBe(true);
    expect(rawRow.respostas.startsWith('enc:v1:')).toBe(true);
    expect(rawRow.aluno_email_hash).toBeDefined();

    // Verificação de Audit Log registrado no DB
    const auditRow = db.query("SELECT * FROM audit_logs WHERE acao = 'submeter_resposta' ORDER BY id DESC LIMIT 1").get() as any;
    expect(auditRow).toBeDefined();
    expect(auditRow.recurso).toBe(`atividade:${atvId}`);
    expect(auditRow.ip).toBe('10.0.0.99');
  });

  test('Marp Standalone HTML: aspect-ratio 16:9, highlight.js, Font Awesome, mobile rotate-prompt e delegação de eventos', async () => {
    const md = `---
title: Aula Teste Marp
theme: dark
---

# Slide 1

:fa-rocket: Teste de Ícone Font Awesome
<i class="fa fa-user"></i> Usuário

\`\`\`javascript
const x = 42;
console.log(x);
\`\`\`

---

# Slide 2

<button class="custom-btn">Botão Interativo</button>
`;
    const html = generateMarpNextStandaloneHtml('Aula Teste Marp', md);
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('highlight.min.js');
    expect(html).toContain('fontawesome-free');
    expect(html).toContain('fa-rocket');
    expect(html).toContain('id="landscape-modal"');
    expect(html).toContain('isInteractiveElement');
    expect(html).toContain('--c-code-bg');
    expect(html).toContain('width: 100vw;');
    expect(html).toContain('height: 100vh;');
    expect(html).toContain('safeNavigate');
    
    // Validar que os blocos de script compilam sem SyntaxError
    const allScripts = Array.from(html.matchAll(/<script(?![^>]*src=)>([\s\S]*?)<\/script>/g));
    expect(allScripts.length).toBeGreaterThan(0);
    for (const match of allScripts) {
      expect(() => new Function(match[1])).not.toThrow();
    }
  });

  test('Acesso a slide protegido sem senha ou com senha incorreta renderiza página HTML de senha amigável com status 401', async () => {
    const materia = db.query(`SELECT id FROM disciplinas WHERE slug = 'demo-class'`).get() as any;
    const adminLogin = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.9' },
      body: JSON.stringify({ email: 'admin@escola.com', password: ADMIN_SEED_PASSWORD }),
    });
    const { token } = await adminLogin.json();

    const createRes = await app.request('/aulas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        materia_id: materia.id,
        titulo: `Senha Prompt Teste ${Date.now()}`,
        markdown: '# Slide Protegido\nConteudo da aula',
      }),
    });
    expect(createRes.status).toBe(201);
    const aula = await createRes.json();

    // 1. Acesso anônimo sem senha -> 401 com página HTML e input de senha
    const noSenhaRes = await app.request(`/${aula.caminho}`, {
      method: 'GET',
    });
    expect(noSenhaRes.status).toBe(401);
    const noSenhaHtml = await noSenhaRes.text();
    expect(noSenhaHtml).toContain('Acesso Restrito');
    expect(noSenhaHtml).toContain('name="senha"');
    expect(noSenhaHtml).not.toContain('Senha incorreta');

    // 2. Acesso anônimo com senha incorreta -> 401 com mensagem de erro
    const wrongSenhaRes = await app.request(`/${aula.caminho}?senha=senha_errada_123`, {
      method: 'GET',
    });
    expect(wrongSenhaRes.status).toBe(401);
    const wrongSenhaHtml = await wrongSenhaRes.text();
    expect(wrongSenhaHtml).toContain('Acesso Restrito');
    expect(wrongSenhaHtml).toContain('Senha incorreta');

    // 3. Acesso com senha correta -> 200 com conteúdo do slide
    const correctSenhaRes = await app.request(`/${aula.caminho}?senha=asdf1234`, {
      method: 'GET',
    });
    expect(correctSenhaRes.status).toBe(200);
    const correctHtml = await correctSenhaRes.text();
    expect(correctHtml).toContain('Slide Protegido');

    // Limpeza
    const htmlAbs = path.join(resolveFrontendDir(), aula.caminho);
    const mdAbs = htmlAbs.replace(/\.html$/, '.md');
    for (const f of [htmlAbs, mdAbs]) {
      if (existsSync(f)) unlinkSync(f);
    }
  });
});
