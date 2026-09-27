#!/usr/bin/env node
/**
 * Smoke Test E2E de Produção (com cleanup)
 * Executa o fluxo completo em produção e remove os recursos criados ao final.
 *
 * Env: PROD_API_URL, ADMIN_EMAIL, ADMIN_PASSWORD, NOTIFY_EMAIL e
 *      SMOKE_SKIP_EMAIL=true (validação local: não dispara e-mails reais).
 */

const BASE = process.env.PROD_API_URL || 'https://aulas.uzedasolucoes.com.br/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@escola.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ProfessorUzeda!';
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'uzeda.dev@gmail.com';
const SKIP_EMAIL = process.env.SMOKE_SKIP_EMAIL === 'true';

async function main() {
  console.log(
    `\n[Smoke Test Prod] Iniciando validação em: ${BASE}${SKIP_EMAIL ? ' (SMOKE_SKIP_EMAIL=true: nenhum e-mail será enviado)' : ''}`
  );

  let adminToken = '';
  let profId = null;
  let cursoId = null;
  let disciplinaId = null;
  let aulaId = null;
  let atvId = null;
  let respostaId = null;

  try {
    // 1. Healthcheck
    console.log('1️⃣  Checando Healthcheck (/health)...');
    const healthRes = await fetch(`${BASE}/health`);
    if (!healthRes.ok) throw new Error(`Healthcheck falhou com status ${healthRes.status}`);
    const healthData = await healthRes.json();
    console.log('   ✅ Healthcheck OK:', healthData);

    // 2. Login Admin
    console.log('2️⃣  Autenticando Administrador...');
    const adminLoginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    if (!adminLoginRes.ok) throw new Error(`Login admin falhou com status ${adminLoginRes.status}`);
    const adminLoginData = await adminLoginRes.json();
    adminToken = adminLoginData.token;
    console.log('   ✅ Admin autenticado com sucesso.');

    // 3. Criar Professor Temporário
    console.log('3️⃣  Criando Professor Temporário...');
    const timestamp = Date.now();
    const profEmail = `smoke_prof_${timestamp}@uzedasolucoes.com.br`;
    const profSenha = `SmokePass_${timestamp}!`;
    const profNome = `Prof. Smoke Test ${timestamp}`;
    const profRes = await fetch(`${BASE}/professores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ nome: profNome, email: profEmail, password: profSenha }),
    });
    if (!profRes.ok) throw new Error(`Falha ao criar professor: ${profRes.status}`);
    const profData = await profRes.json();
    profId = profData.id;
    console.log(`   ✅ Professor criado com ID ${profId} (${profEmail})`);

    // 4. Criar Curso Temporário
    console.log('4️⃣  Criando Curso Temporário...');
    const cursoNome = `Curso Smoke Test ${timestamp}`;
    const cursoRes = await fetch(`${BASE}/cursos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        nome: cursoNome,
        descricao: 'Curso temporário para smoke test pós-deploy',
      }),
    });
    if (!cursoRes.ok) throw new Error(`Falha ao criar curso: ${cursoRes.status}`);
    const cursoData = await cursoRes.json();
    cursoId = cursoData.id;
    console.log(`   ✅ Curso criado com ID ${cursoId}`);

    // 5. Vincular Professor ao Curso
    console.log('5️⃣  Vinculando Professor ao Curso...');
    const vincRes = await fetch(`${BASE}/cursos/${cursoId}/professores`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ professor_ids: [profId] }),
    });
    if (!vincRes.ok) throw new Error(`Falha ao vincular professor: ${vincRes.status}`);
    console.log('   ✅ Professor vinculado com sucesso.');

    // 6. Login com o Professor Criado
    console.log('6️⃣  Autenticando Professor...');
    const profLoginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: profEmail, password: profSenha }),
    });
    if (!profLoginRes.ok) throw new Error(`Login do professor falhou: ${profLoginRes.status}`);
    const profLoginData = await profLoginRes.json();
    const profToken = profLoginData.token;
    console.log('   ✅ Professor autenticado.');

    // 7. Criar Disciplina com o Professor
    console.log('7️⃣  Criando Disciplina...');
    const discRes = await fetch(`${BASE}/disciplinas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${profToken}` },
      body: JSON.stringify({
        curso_id: cursoId,
        nome: 'Disciplina Smoke Test',
        cor: 'bg-indigo-600',
        icone: 'school',
        descricao: 'Disciplina automatizada',
      }),
    });
    if (!discRes.ok) throw new Error(`Falha ao criar disciplina: ${discRes.status}`);
    const discData = await discRes.json();
    disciplinaId = discData.id;
    console.log(`   ✅ Disciplina criada com ID ${disciplinaId}`);

    // 8. Criar Aula Marp
    console.log('8️⃣  Criando Aula (Marp)...');
    const aulaRes = await fetch(`${BASE}/aulas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${profToken}` },
      body: JSON.stringify({
        disciplina_id: disciplinaId,
        titulo: 'Aula Smoke Test 01',
        descricao: 'Validação de renderização Marp',
        conteudo_md:
          '# Smoke Test\n\n---\n\n## Pipeline de Produção Ativa\n\n- Deploy automático OK\n- Smoke test OK',
        ordem: 1,
      }),
    });
    if (!aulaRes.ok) throw new Error(`Falha ao criar aula: ${aulaRes.status}`);
    const aulaData = await aulaRes.json();
    aulaId = aulaData.id;
    console.log(`   ✅ Aula criada com ID ${aulaData.id}`);

    // 9. Criar Atividade Interativa (roleta, com o gabarito FORA da 1ª posição)
    console.log('9. Criando Atividades Interativas...');
    const correta = 'Sim, todos os serviços responderam com 200 OK';
    const atvRes = await fetch(`${BASE}/atividades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${profToken}` },
      body: JSON.stringify({
        disciplina_id: disciplinaId,
        titulo: 'Atividade Smoke Test',
        tipo: 'roleta',
        json_data: JSON.stringify({
          meta: { type: 'roleta', title: 'Smoke Test' },
          questions: [
            {
              title: 'Pergunta de Validação 1',
              content: 'O deploy automático em produção foi bem sucedido?',
              options: [
                { text: 'Não, houve falha no pipeline de deploy', correct: false },
                { text: correta, correct: true },
              ],
            },
          ],
        }),
        ordem: 1,
      }),
    });
    if (!atvRes.ok) throw new Error(`Falha ao criar atividade: ${atvRes.status}`);
    const atvData = await atvRes.json();
    atvId = atvData.id;
    console.log(`   OK Atividade criada com ID ${atvId}`);

    // 9b. Leitura anônima: roleta mantém o gabarito (feedback imediato no cliente)
    const atvAnonRes = await fetch(`${BASE}/atividades/${atvId}`);
    if (!atvAnonRes.ok) throw new Error(`GET anônimo da atividade falhou: ${atvAnonRes.status}`);
    const atvAnonRaw = await atvAnonRes.json();
    const atvAnonJson =
      typeof atvAnonRaw.json_data === 'string'
        ? JSON.parse(atvAnonRaw.json_data)
        : atvAnonRaw.json_data;
    const questoesAnon = atvAnonJson.questions;
    if (!questoesAnon[0].options.some((o) => o.correct === true)) {
      throw new Error(
        'Regressão: roleta deveria expor o gabarito para o feedback imediato do aluno'
      );
    }
    if (questoesAnon[0].options[0].correct === true) {
      throw new Error(
        'Gabarito caiu na 1ª posição — o smoke test perderia o poder de detectar isso'
      );
    }
    console.log('   OK Leitura anônima da roleta e gabarito fora da 1ª posição');

    // 9c. Prova: o gabarito NÃO pode vazar no endpoint público
    const provaRes = await fetch(`${BASE}/atividades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${profToken}` },
      body: JSON.stringify({
        disciplina_id: disciplinaId,
        titulo: 'Prova Smoke Test (gabarito protegido)',
        tipo: 'prova',
        json_data: JSON.stringify({
          meta: { type: 'prova', title: 'Smoke Test' },
          questions: [
            {
              title: 'Pergunta de Validação 2',
              content: 'O servidor protege o gabarito para o aluno anônimo?',
              options: [
                { text: 'Não', correct: false },
                { text: 'Sim, o campo correct não é enviado', correct: true },
              ],
            },
          ],
        }),
        ordem: 2,
      }),
    });
    if (!provaRes.ok) throw new Error(`Falha ao criar prova: ${provaRes.status}`);
    const provaData = await provaRes.json();
    const provaId = provaData.id;
    const provaAnonRes = await fetch(`${BASE}/atividades/${provaId}`);
    if (!provaAnonRes.ok) throw new Error(`GET anônimo da prova falhou: ${provaAnonRes.status}`);
    const provaAnonRaw = await provaAnonRes.json();
    const provaAnonJson =
      typeof provaAnonRaw.json_data === 'string'
        ? JSON.parse(provaAnonRaw.json_data)
        : provaAnonRaw.json_data;
    if (provaAnonJson.questions[0].options.some((o) => 'correct' in o)) {
      throw new Error('VAZAMENTO DE GABARITO: a prova expôs o campo "correct" para o aluno');
    }
    console.log(`   OK Prova criada com ID ${provaId} e gabarito protegido no endpoint público`);

    // 10. Aluno: Submissão de Resposta (correção + token LGPD + comprovante opcional)
    console.log('10. Aluno: Submetendo resposta...');
    const subRes = await fetch(`${BASE}/atividades/${atvId}/respostas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aluno_nome: 'Robô Smoke Test Produção',
        aluno_email: NOTIFY_EMAIL,
        enviar_email: !SKIP_EMAIL,
        respostas: {
          0: correta,
        },
      }),
    });
    if (!subRes.ok) throw new Error(`Falha ao submeter resposta: ${subRes.status}`);
    const subData = await subRes.json();
    respostaId = subData.id;
    if (subData.acertos !== 1 || subData.total !== 1 || subData.pontuacao !== 100) {
      throw new Error(
        `Correção objetiva incorreta: acertos=${subData.acertos}, total=${subData.total}, pontuacao=${subData.pontuacao}`
      );
    }
    if (!subData.consulta_token) throw new Error('Resposta submetida sem consulta_token (LGPD)');
    console.log(
      `   OK Resposta ${respostaId} corrigida (1/1, 100%)${SKIP_EMAIL ? ' — e-mail de comprovante ignorado (SMOKE_SKIP_EMAIL)' : ` e comprovante enviado para ${NOTIFY_EMAIL}`}`
    );

    // 10b. LGPD: o aluno consulta as próprias respostas com o token recebido
    const consultaRes = await fetch(
      `${BASE}/aluno/minhas-respostas?email=${encodeURIComponent(NOTIFY_EMAIL)}&token=${subData.consulta_token}`
    );
    if (!consultaRes.ok) throw new Error(`Consulta LGPD falhou: ${consultaRes.status}`);
    const consultaData = await consultaRes.json();
    if (!Array.isArray(consultaData) || !consultaData.some((r) => r.id === respostaId)) {
      throw new Error('Consulta LGPD não devolveu a resposta recém-enviada');
    }
    console.log('   OK Consulta LGPD com o token de consulta');

    // 11. Aluno: Código de rascunho por e-mail (dispensado em SMOKE_SKIP_EMAIL)
    if (SKIP_EMAIL) {
      console.log('11. Envio do código de rascunho ignorado (SMOKE_SKIP_EMAIL=true)');
    } else {
      console.log('11. Aluno: Testando envio do código de rascunho...');
      const rascunhoRes = await fetch(`${BASE}/atividades/${atvId}/rascunhos/enviar-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: NOTIFY_EMAIL,
          codigo: `SMOKE-${timestamp.toString().slice(-4)}`,
        }),
      });
      if (!rascunhoRes.ok)
        throw new Error(`Falha ao enviar código de rascunho: ${rascunhoRes.status}`);
      console.log(`   OK Código de rascunho enviado para ${NOTIFY_EMAIL}`);
    }

    console.log('\nTODOS OS TESTES EM PRODUÇÃO FORAM CONCLUÍDOS COM SUCESSO!');
  } finally {
    // Limpeza (Cleanup) em Produção
    console.log('\n🧹 [Cleanup] Iniciando limpeza dos dados de teste criados em produção...');
    if (!adminToken) {
      try {
        const loginRes = await fetch(`${BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
        });
        if (loginRes.ok) {
          const data = await loginRes.json();
          adminToken = data.token;
        }
      } catch (e) {
        console.warn('   ⚠️ Não foi possível obter token admin para cleanup:', e.message);
      }
    }

    if (adminToken) {
      async function removerAulasDoCurso(idCurso) {
        try {
          const discRes = await fetch(`${BASE}/cursos/${idCurso}/disciplinas`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          });
          if (!discRes.ok) return;
          const disciplinas = await discRes.json();
          for (const disciplina of disciplinas || []) {
            const aulasRes = await fetch(`${BASE}/aulas?disciplina_id=${disciplina.id}`, {
              headers: { Authorization: `Bearer ${adminToken}` },
            });
            if (!aulasRes.ok) continue;
            const aulas = await aulasRes.json();
            for (const aula of aulas || []) {
              await fetch(`${BASE}/aulas/${aula.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${adminToken}` },
              });
            }
          }
        } catch (e) {
          console.warn('   Aviso: erro ao remover aulas do curso', idCurso, '-', e.message);
        }
      }

      if (respostaId) {
        try {
          const res = await fetch(`${BASE}/respostas/${respostaId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${adminToken}` },
          });
          if (res.ok) console.log(`   🗑️  Resposta ID ${respostaId} excluída.`);
          else console.warn(`   ⚠️ Falha ao excluir resposta ${respostaId}: status ${res.status}`);
        } catch (e) {
          console.warn('   ⚠️ Erro ao excluir resposta:', e.message);
        }
      }

      if (aulaId) {
        try {
          const res = await fetch(`${BASE}/aulas/${aulaId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${adminToken}` },
          });
          if (res.ok) console.log(`   Aula ID ${aulaId} e arquivos .md/.html removidos.`);
          else console.warn(`   Falha ao excluir aula ${aulaId}: status ${res.status}`);
        } catch (e) {
          console.warn('   Erro ao excluir aula:', e.message);
        }
      }

      if (cursoId) {
        try {
          await removerAulasDoCurso(cursoId);
          const res = await fetch(`${BASE}/cursos/${cursoId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${adminToken}` },
          });
          if (res.ok)
            console.log(
              `   🗑️  Curso ID ${cursoId} (e disciplinas/aulas/atividades vinculadas) excluído.`
            );
          else console.warn(`   ⚠️ Falha ao excluir curso ${cursoId}: status ${res.status}`);
        } catch (e) {
          console.warn('   ⚠️ Erro ao excluir curso:', e.message);
        }
      }

      if (profId) {
        try {
          const res = await fetch(`${BASE}/professores/${profId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${adminToken}` },
          });
          if (res.ok) console.log(`   🗑️  Professor ID ${profId} excluído.`);
          else console.warn(`   ⚠️ Falha ao excluir professor ${profId}: status ${res.status}`);
        } catch (e) {
          console.warn('   ⚠️ Erro ao excluir professor:', e.message);
        }
      }

      // Cleanup defensivo de eventuais sobras antigas de smoke test
      try {
        const cursosRes = await fetch(`${BASE}/cursos`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (cursosRes.ok) {
          const cursos = await cursosRes.json();
          for (const c of cursos) {
            if (c.nome && c.nome.startsWith('Curso Smoke Test')) {
              await removerAulasDoCurso(c.id);
              await fetch(`${BASE}/cursos/${c.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${adminToken}` },
              });
              console.log(`   🗑️  Curso residual ${c.nome} (ID ${c.id}) removido.`);
            }
          }
        }

        const profsRes = await fetch(`${BASE}/professores`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (profsRes.ok) {
          const profs = await profsRes.json();
          for (const p of profs) {
            if (p.email && p.email.startsWith('smoke_prof_')) {
              await fetch(`${BASE}/professores/${p.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${adminToken}` },
              });
              console.log(`   🗑️  Professor residual ${p.nome} (ID ${p.id}) removido.`);
            }
          }
        }
      } catch (e) {
        console.warn('   ⚠️ Erro na varredura de resíduos:', e.message);
      }
    }
    console.log('✨ [Cleanup] Ambiente de produção limpo com sucesso!\n');
  }
}

main().catch((err) => {
  console.error('\n❌ ERRO NO SMOKE TEST DE PRODUÇÃO:', err);
  process.exit(1);
});
