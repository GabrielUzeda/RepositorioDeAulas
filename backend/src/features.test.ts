import { describe, expect, test, beforeAll } from 'bun:test';
import { db } from './db';
import app from './routes';
import { signJwt } from './auth';
import { extractTextFromBuffer } from './documentParser';

describe('Novos Fluxos de Negócio (RAG, Deadlines, Ciclo de Vida e Feedbacks)', () => {
  let adminToken: string;

  beforeAll(async () => {
    // Gera token administrativo diretamente via JWT sem acionar rate limit de login HTTP
    adminToken = await signJwt({ sub: 1, role: 'admin' });
  });

  // ---------- 1. Documentos Orientadores (RAG - MEL-03) ----------
  describe('Documentos Orientadores (RAG - MEL-03)', () => {
    test('extractTextFromBuffer processa markdown, txt, csv e json corretamente', async () => {
      const encoder = new TextEncoder();

      const mdText = '# Titulo da Ementa\n- Topico 1\n- Topico 2';
      const parsedMd = await extractTextFromBuffer(encoder.encode(mdText), 'ementa.md');
      expect(parsedMd).toContain('Titulo da Ementa');
      expect(parsedMd).toContain('Topico 1');

      const jsonText = JSON.stringify({ disciplina: 'Logica', carga_horaria: 60 });
      const parsedJson = await extractTextFromBuffer(encoder.encode(jsonText), 'dados.json');
      expect(parsedJson).toContain('Logica');

      const csvText = 'topico,horas\nvariaveis,4\nfuncoes,8';
      const parsedCsv = await extractTextFromBuffer(encoder.encode(csvText), 'plano.csv');
      expect(parsedCsv).toContain('variaveis');
    });

    test('CRUD de documentos orientadores via rotas HTTP protegidas', async () => {
      const disc = db.query('SELECT id, curso_id FROM disciplinas LIMIT 1').get() as any;
      expect(disc).toBeDefined();

      // 1. Inserir documento via JSON
      const createRes = await app.request(`/disciplinas/${disc.id}/documentos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          titulo: 'Plano de Ensino 2026',
          tipo: 'plano_ensino',
          nome_arquivo: 'plano.txt',
          conteudo_texto: 'Competencias: Estruturas condicionais e de repeticao.'
        })
      });
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      expect(created.id).toBeDefined();
      expect(created.titulo).toBe('Plano de Ensino 2026');
      expect(created.tipo).toBe('plano_ensino');

      // 2. Listar documentos da disciplina
      const listRes = await app.request(`/disciplinas/${disc.id}/documentos`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(listRes.status).toBe(200);
      const docs = await listRes.json();
      expect(Array.isArray(docs)).toBe(true);
      const found = docs.find((d: any) => d.id === created.id);
      expect(found).toBeDefined();
      expect(found.titulo).toBe('Plano de Ensino 2026');

      // 3. Usuário anônimo não pode acessar documentos
      const anonRes = await app.request(`/disciplinas/${disc.id}/documentos`, { method: 'GET' });
      expect(anonRes.status).toBe(401);

      // 4. Excluir documento
      const delRes = await app.request(`/disciplinas/${disc.id}/documentos/${created.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(delRes.status).toBe(204);

      // 5. Verificar remoção
      const checkDoc = db.query('SELECT id FROM documentos_orientadores WHERE id = ?').get(created.id);
      expect(checkDoc).toBeNull();
    });

    test('CRUD de documentos orientadores de CURSO (RAG Geral do Curso)', async () => {
      const curso = db.query('SELECT id FROM cursos LIMIT 1').get() as any;
      expect(curso).toBeDefined();

      // 1. Inserir documento geral do curso
      const createRes = await app.request(`/cursos/${curso.id}/documentos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          titulo: 'Diretrizes Gerais do Curso 2026',
          tipo: 'outro',
          nome_arquivo: 'diretrizes.txt',
          conteudo_texto: 'Regras de avaliacao institucional e criterios pedagogicos gerais.'
        })
      });
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      expect(created.id).toBeDefined();
      expect(created.curso_id).toBe(curso.id);
      expect(created.disciplina_id).toBeNull();

      // 2. Listar documentos do curso
      const listRes = await app.request(`/cursos/${curso.id}/documentos`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(listRes.status).toBe(200);
      const docs = await listRes.json();
      const found = docs.find((d: any) => d.id === created.id);
      expect(found).toBeDefined();
      expect(found.titulo).toBe('Diretrizes Gerais do Curso 2026');

      // 3. Excluir documento do curso
      const delRes = await app.request(`/cursos/${curso.id}/documentos/${created.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(delRes.status).toBe(204);

      const checkDoc = db.query('SELECT id FROM documentos_orientadores WHERE id = ?').get(created.id);
      expect(checkDoc).toBeNull();
    });
  });

  // ---------- 2. Prazos de Entrega e Detecção de Atraso (MEL-06) ----------
  describe('Prazos de Entrega (Deadlines) e Flag de Atraso (MEL-06)', () => {
    test('Submissão antes do prazo registra entregue_com_atraso = 0', async () => {
      const disc = db.query('SELECT id, curso_id FROM disciplinas LIMIT 1').get() as any;
      const prazoFuturo = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const atvRes = await app.request('/atividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          disciplina_id: disc.id,
          titulo: 'Atividade Prazo Futuro',
          tipo: 'normal',
          data_limite: prazoFuturo,
          json_data: JSON.stringify([{ id: 'q1', type: 'open', title: 'Q1' }])
        })
      });
      expect(atvRes.status).toBe(201);
      const atv = await atvRes.json();

      const subRes = await app.request(`/atividades/${atv.id}/respostas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aluno_nome: 'Aluno Pontual',
          aluno_email: 'pontual@escola.com',
          respostas: { q1: 'resposta no prazo' },
          senha_curso: 'asdf1234'
        })
      });
      expect([200, 201]).toContain(subRes.status);
      const sub = await subRes.json();

      const row = db.query('SELECT entregue_com_atraso FROM respostas_alunos WHERE id = ?').get(sub.id) as any;
      expect(row.entregue_com_atraso).toBe(0);
    });

    test('Submissão após o prazo registra entregue_com_atraso = 1', async () => {
      const disc = db.query('SELECT id, curso_id FROM disciplinas LIMIT 1').get() as any;
      const prazoPassado = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const atvRes = await app.request('/atividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          disciplina_id: disc.id,
          titulo: 'Atividade Prazo Expirado',
          tipo: 'normal',
          data_limite: prazoPassado,
          json_data: JSON.stringify([{ id: 'q1', type: 'open', title: 'Q1' }])
        })
      });
      expect(atvRes.status).toBe(201);
      const atv = await atvRes.json();

      const subRes = await app.request(`/atividades/${atv.id}/respostas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aluno_nome: 'Aluno Atrasado',
          aluno_email: 'atrasado@escola.com',
          respostas: { q1: 'resposta com atraso' },
          senha_curso: 'asdf1234'
        })
      });
      expect([200, 201]).toContain(subRes.status);
      const sub = await subRes.json();

      const row = db.query('SELECT entregue_com_atraso FROM respostas_alunos WHERE id = ?').get(sub.id) as any;
      expect(row.entregue_com_atraso).toBe(1);
    });
  });

  // ---------- 3. Ciclo de Vida de Entidades (DT-05) ----------
  describe('Ciclo de Vida de Entidades (status: ativo/oculto/arquivado - DT-05)', () => {
    test('PATCH status e bloqueio de envio para atividade oculta', async () => {
      const disc = db.query('SELECT id, curso_id FROM disciplinas LIMIT 1').get() as any;

      const atvRes = await app.request('/atividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          disciplina_id: disc.id,
          titulo: 'Atividade Ciclo de Vida',
          tipo: 'normal',
          status: 'ativo',
          json_data: JSON.stringify([{ id: 'q1', type: 'open', title: 'Q1' }])
        })
      });
      const atv = await atvRes.json();

      // Altera status para oculto
      const patchRes = await app.request(`/atividades/${atv.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'oculto' })
      });
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.status).toBe('oculto');

      // Aluno anônimo tentando listar atividades não deve vê-la
      const listAnonRes = await app.request(`/atividades?disciplina_id=${disc.id}&senha=asdf1234`);
      expect(listAnonRes.status).toBe(200);
      const anonAtvs = await listAnonRes.json();
      expect(anonAtvs.find((a: any) => a.id === atv.id)).toBeUndefined();

      // Aluno tentando submeter resposta para atividade oculta deve ser rejeitado com 403
      const subRes = await app.request(`/atividades/${atv.id}/respostas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aluno_nome: 'Aluno Teste',
          aluno_email: 'teste.oculto@escola.com',
          respostas: { q1: 'tentando enviar' },
          senha_curso: 'asdf1234'
        })
      });
      expect(subRes.status).toBe(403);
      const errText = await subRes.text();
      expect(errText).toContain('não está disponível para envio');

      // Reativa a atividade
      const reativaRes = await app.request(`/atividades/${atv.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'ativo' })
      });
      expect(reativaRes.status).toBe(200);
    });

    test('PATCH status de curso arquiva e reativa curso', async () => {
      const curso = db.query('SELECT id FROM cursos LIMIT 1').get() as any;

      const patchRes = await app.request(`/cursos/${curso.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'arquivado' })
      });
      expect(patchRes.status).toBe(200);

      // Reverte para ativo
      const revertRes = await app.request(`/cursos/${curso.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'ativo' })
      });
      expect(revertRes.status).toBe(200);
    });
  });

  // ---------- 4. Feedbacks em Lote com Partial Index (MEL-04 / Audit) ----------
  describe('Feedbacks da Disciplina em Lote e Upsert Parcial (MEL-04)', () => {
    test('Salva feedback da turma e feedbacks individuais simultaneamente', async () => {
      const disc = db.query('SELECT id FROM disciplinas LIMIT 1').get() as any;

      const payload = {
        feedbacks: [
          { aluno_email: null, feedback_geral: 'Comunicado geral: Parabens turma pelo empenho!' },
          { aluno_email: 'aluno1@escola.com', feedback_geral: 'Otima participacao nas atividades.' },
          { aluno_email: 'aluno2@escola.com', feedback_geral: 'Sugiro revisar o modulo de recursao.' }
        ]
      };

      const res = await app.request(`/disciplinas/${disc.id}/salvar-feedback-geral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(payload)
      });
      expect(res.status).toBe(200);
      const resData = await res.json();
      expect(resData.success).toBe(true);

      // Validação do feedback geral da turma no SQLite (aluno_email_hash IS NULL)
      const turmaFb = db.query(
        'SELECT feedback_geral FROM disciplina_feedbacks WHERE disciplina_id = ? AND aluno_email_hash IS NULL'
      ).get(disc.id) as any;
      expect(turmaFb).toBeDefined();
      expect(turmaFb.feedback_geral).toContain('Parabens turma');

      // Idempotência: rodar novamente não deve duplicar o registro da turma
      const res2 = await app.request(`/disciplinas/${disc.id}/salvar-feedback-geral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          feedbacks: [
            { aluno_email: null, feedback_geral: 'Comunicado atualizado: Nova data de prova!' }
          ]
        })
      });
      expect(res2.status).toBe(200);

      const totalTurmaRows = db.query(
        'SELECT count(*) as total FROM disciplina_feedbacks WHERE disciplina_id = ? AND aluno_email_hash IS NULL'
      ).get(disc.id) as any;
      expect(totalTurmaRows.total).toBe(1);

      const turmaFbAtualizado = db.query(
        'SELECT feedback_geral FROM disciplina_feedbacks WHERE disciplina_id = ? AND aluno_email_hash IS NULL'
      ).get(disc.id) as any;
      expect(turmaFbAtualizado.feedback_geral).toContain('Nova data de prova!');
    });
  });

  // ---------- 5. Salvamento em Lote de Avaliações ----------
  describe('Salvamento em Lote de Avaliações (POST /atividades/:id/salvar-avaliacoes)', () => {
    test('salva notas e feedbacks de múltiplos alunos em lote', async () => {
      const disc = db.query('SELECT id FROM disciplinas LIMIT 1').get() as any;

      const atvRes = await app.request('/atividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          disciplina_id: disc.id,
          titulo: 'Atividade Teste Lote',
          tipo: 'normal',
          status: 'ativo'
        })
      });
      const atv = await atvRes.json();

      // Cria 2 respostas de alunos
      const r1 = await app.request(`/atividades/${atv.id}/respostas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aluno_nome: 'Aluno Um',
          aluno_email: 'aluno1@escola.com',
          respostas: { q1: 'resposta 1' },
          senha_curso: 'asdf1234'
        })
      });
      expect([200, 201]).toContain(r1.status);
      const r1Data = await r1.json();

      const r2 = await app.request(`/atividades/${atv.id}/respostas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aluno_nome: 'Aluno Dois',
          aluno_email: 'aluno2@escola.com',
          respostas: { q1: 'resposta 2' },
          senha_curso: 'asdf1234'
        })
      });
      expect([200, 201]).toContain(r2.status);
      const r2Data = await r2.json();

      // Salva em lote
      const batchRes = await app.request(`/atividades/${atv.id}/salvar-avaliacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          avaliacoes: [
            { id: r1Data.id, nota: 95, feedback: 'Excelente raciocínio!' },
            { id: r2Data.id, nota: 70, feedback: 'Bom esforço, revisar conceito X.' }
          ]
        })
      });

      expect(batchRes.status).toBe(200);
      const batchData = await batchRes.json();
      expect(batchData.success).toBe(true);
      expect(batchData.total).toBe(2);

      // Valida no banco
      const saved1 = db.query('SELECT nota, feedback FROM respostas_alunos WHERE id = ?').get(r1Data.id) as any;
      expect(saved1.nota).toBe(95);
      expect(saved1.feedback).toBe('Excelente raciocínio!');

      const saved2 = db.query('SELECT nota, feedback FROM respostas_alunos WHERE id = ?').get(r2Data.id) as any;
      expect(saved2.nota).toBe(70);
      expect(saved2.feedback).toBe('Bom esforço, revisar conceito X.');
    });
  });

  // ---------- 6. Relatório Consolidado de Feedback (MT-01) ----------
  describe('Relatório de Feedback com Atividades Consideradas e Médias (MT-01)', () => {
    test('retorna atividades_consideradas, atividades_pendentes e media_calculada por aluno', async () => {
      const curso = db.query('SELECT id FROM cursos LIMIT 1').get() as any;

      // Cria disciplina isolada para o teste
      const testSlug = `materia-mt01-${Date.now()}`;
      const discRes = await app.request('/disciplinas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          curso_id: curso.id,
          nome: 'Matéria MT-01 Teste',
          slug: testSlug
        })
      });
      const disc = await discRes.json();

      // Atividade 1
      const atv1Res = await app.request('/atividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ disciplina_id: disc.id, titulo: 'Atividade 1', ordem: 1 })
      });
      const atv1 = await atv1Res.json();

      // Atividade 2
      const atv2Res = await app.request('/atividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ disciplina_id: disc.id, titulo: 'Atividade 2', ordem: 2 })
      });
      const atv2 = await atv2Res.json();

      // Atividade 3 sem nenhuma resposta (não deve ser considerada)
      await app.request('/atividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ disciplina_id: disc.id, titulo: 'Atividade 3 Sem Respostas', ordem: 3 })
      });

      // Aluno Completo responde Atv 1 e Atv 2
      const r1 = await app.request(`/atividades/${atv1.id}/respostas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aluno_nome: 'Aluno Completo',
          aluno_email: 'completo@teste.com',
          respostas: { q1: 'r1' },
          senha_curso: 'asdf1234'
        })
      });
      const r1Data = await r1.json();

      const r2 = await app.request(`/atividades/${atv2.id}/respostas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aluno_nome: 'Aluno Completo',
          aluno_email: 'completo@teste.com',
          respostas: { q1: 'r2' },
          senha_curso: 'asdf1234'
        })
      });
      const r2Data = await r2.json();

      // Aluno Parcial responde apenas Atv 1
      const r3 = await app.request(`/atividades/${atv1.id}/respostas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aluno_nome: 'Aluno Parcial',
          aluno_email: 'parcial@teste.com',
          respostas: { q1: 'r3' },
          senha_curso: 'asdf1234'
        })
      });
      const r3Data = await r3.json();

      // Atribui notas
      await app.request(`/atividades/${atv1.id}/salvar-avaliacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          avaliacoes: [
            { id: r1Data.id, nota: 80, feedback: 'Bom' },
            { id: r3Data.id, nota: 100, feedback: 'Perfeito' }
          ]
        })
      });

      await app.request(`/atividades/${atv2.id}/salvar-avaliacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          avaliacoes: [
            { id: r2Data.id, nota: 60, feedback: 'Regular' }
          ]
        })
      });

      // Consulta relatório
      const relRes = await app.request(`/disciplinas/${disc.id}/relatorio-feedback`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(relRes.status).toBe(200);
      const relData = await relRes.json();
      expect(relData.success).toBe(true);

      // Atividades consideradas: deve conter apenas Atv 1 e Atv 2
      expect(relData.data.atividades_consideradas).toEqual([
        { id: atv1.id, titulo: 'Atividade 1' },
        { id: atv2.id, titulo: 'Atividade 2' }
      ]);

      const alunoCompleto = relData.data.alunos.find((a: any) => a.aluno_email === 'completo@teste.com');
      expect(alunoCompleto).toBeDefined();
      expect(alunoCompleto.atividades).toHaveLength(2);
      expect(alunoCompleto.atividades_pendentes).toEqual([]);
      // Média: (80 + 60) / 2 = 70
      expect(alunoCompleto.media_calculada).toBe(70);

      const alunoParcial = relData.data.alunos.find((a: any) => a.aluno_email === 'parcial@teste.com');
      expect(alunoParcial).toBeDefined();
      expect(alunoParcial.atividades).toHaveLength(1);
      expect(alunoParcial.atividades_pendentes).toEqual([
        { id: atv2.id, atividade_titulo: 'Atividade 2' }
      ]);
      // Média: 100 / 2 = 50 (atividade 2 não entregue vale 0)
      expect(alunoParcial.media_calculada).toBe(50);
    });
  });
});
