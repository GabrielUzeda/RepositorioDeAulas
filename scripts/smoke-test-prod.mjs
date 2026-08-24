#!/usr/bin/env node
/**
 * Smoke Test E2E de Produção (com cleanup)
 * Executa o fluxo completo em produção e remove os recursos criados ao final.
 */

const BASE = process.env.PROD_API_URL || 'https://aulas.uzedasolucoes.com.br/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'teste@admin.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'asdqwe123';
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'uzeda.dev@gmail.com';

async function main() {
  console.log(`\n🔍 [Smoke Test Prod] Iniciando validação em: ${BASE}`);

  let adminToken = '';
  let profId = null;
  let cursoId = null;
  let disciplinaId = null;
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
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
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
      body: JSON.stringify({ nome: profNome, email: profEmail, password: profSenha })
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
      body: JSON.stringify({ nome: cursoNome, descricao: 'Curso temporário para smoke test pós-deploy' })
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
      body: JSON.stringify({ professor_ids: [profId] })
    });
    if (!vincRes.ok) throw new Error(`Falha ao vincular professor: ${vincRes.status}`);
    console.log('   ✅ Professor vinculado com sucesso.');

    // 6. Login com o Professor Criado
    console.log('6️⃣  Autenticando Professor...');
    const profLoginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: profEmail, password: profSenha })
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
        descricao: 'Disciplina automatizada'
      })
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
        conteudo_md: '# Smoke Test\n\n---\n\n## Pipeline de Produção Ativa\n\n- Deploy automático OK\n- Smoke test OK',
        ordem: 1
      })
    });
    if (!aulaRes.ok) throw new Error(`Falha ao criar aula: ${aulaRes.status}`);
    const aulaData = await aulaRes.json();
    console.log(`   ✅ Aula criada com ID ${aulaData.id}`);

    // 9. Criar Atividade Interativa
    console.log('9️⃣  Criando Atividade Interativa...');
    const atvRes = await fetch(`${BASE}/atividades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${profToken}` },
      body: JSON.stringify({
        disciplina_id: disciplinaId,
        titulo: 'Atividade Smoke Test',
        tipo: 'normal',
        json_data: JSON.stringify({
          questions: [
            {
              title: 'Pergunta de Validação 1',
              content: 'O deploy automático em produção foi bem sucedido?',
              options: [
                { text: 'Sim, todos os serviços responderam com 200 OK', correct: true },
                { text: 'Não', correct: false }
              ]
            }
          ]
        }),
        ordem: 1
      })
    });
    if (!atvRes.ok) throw new Error(`Falha ao criar atividade: ${atvRes.status}`);
    const atvData = await atvRes.json();
    atvId = atvData.id;
    console.log(`   ✅ Atividade criada com ID ${atvId}`);

    // 10. Aluno: Submissão de Resposta com Envio de Comprovante
    console.log('🔟 Aluno: Submetendo resposta com comprovante por e-mail...');
    const subRes = await fetch(`${BASE}/atividades/${atvId}/respostas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aluno_nome: 'Robô Smoke Test Produção',
        aluno_email: NOTIFY_EMAIL,
        enviar_email: true,
        respostas: {
          '0': 'Sim, todos os serviços responderam com 200 OK'
        }
      })
    });
    if (!subRes.ok) throw new Error(`Falha ao submeter resposta: ${subRes.status}`);
    const subData = await subRes.json();
    respostaId = subData.id;
    console.log(`   ✅ Resposta submetida com ID ${respostaId} e comprovante enviado para ${NOTIFY_EMAIL}`);

    // 11. Aluno: Testar Rascunho Remoto
    console.log('1️⃣1️⃣ Aluno: Testando salvamento e envio de código de rascunho...');
    const rascunhoRes = await fetch(`${BASE}/atividades/${atvId}/rascunhos/enviar-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: NOTIFY_EMAIL,
        codigo: `SMOKE-${timestamp.toString().slice(-4)}`
      })
    });
    if (!rascunhoRes.ok) throw new Error(`Falha ao enviar código de rascunho: ${rascunhoRes.status}`);
    console.log(`   ✅ Código de rascunho enviado com sucesso para ${NOTIFY_EMAIL}`);

    console.log('\n🎉 TODOS OS TESTES EM PRODUÇÃO FORAM CONCLUÍDOS COM SUCESSO!');
  } finally {
    // Limpeza (Cleanup) em Produção
    console.log('\n🧹 [Cleanup] Iniciando limpeza dos dados de teste criados em produção...');
    if (adminToken) {
      if (respostaId) {
        try {
          await fetch(`${BASE}/respostas/${respostaId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${adminToken}` }
          });
          console.log(`   🗑️  Resposta ID ${respostaId} excluída.`);
        } catch (e) {
          console.warn('   ⚠️ Erro ao excluir resposta:', e.message);
        }
      }

      if (cursoId) {
        try {
          await fetch(`${BASE}/cursos/${cursoId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${adminToken}` }
          });
          console.log(`   🗑️  Curso ID ${cursoId} (e disciplinas/aulas/atividades vinculadas) excluído.`);
        } catch (e) {
          console.warn('   ⚠️ Erro ao excluir curso:', e.message);
        }
      }

      if (profId) {
        try {
          await fetch(`${BASE}/professores/${profId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${adminToken}` }
          });
          console.log(`   🗑️  Professor ID ${profId} excluído.`);
        } catch (e) {
          console.warn('   ⚠️ Erro ao excluir professor:', e.message);
        }
      }
    }
    console.log('✨ [Cleanup] Ambiente de produção limpo com sucesso!\n');
  }
}

main().catch((err) => {
  console.error('\n❌ ERRO NO SMOKE TEST DE PRODUÇÃO:', err);
  process.exit(1);
});
