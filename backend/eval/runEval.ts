import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gerarQuestoesAi } from '../src/aiGeracaoQuestoes';
import { diagnosticarQuestoes } from '../src/aiQuestoes';
import { generateAulaOutlineAndContent } from '../src/ai';
import { diagnosticarOutline, parseOutline, validarAulaMarp } from '../src/aiAula';
import { avaliarAlunoAtividade } from '../src/aiAvaliacao';
import { diagnosticarParecerTurma, sintetizarFeedbackTurma } from '../src/aiSintese';
import { ErroExecucaoAi } from '../src/aiExecucao';

export interface Caso {
  caso: string;
  tarefa: 'questoes' | 'aula' | 'avaliacao' | 'sintese';
  tipo?: string;
  quantidade?: number;
  tema: string;
  observacoes?: string;
  atividade?: Parameters<typeof avaliarAlunoAtividade>[0]['atividade'];
  respostas?: Record<string, string>;
  alunos_detalhes?: any[];
  expectativa: Record<string, unknown>;
}

function objeto(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

export function validarCaso(valor: unknown, nome = 'entrada'): asserts valor is Caso {
  const invalido: (motivo: string) => never = (motivo) => { throw new Error(`Fixture inválida (${nome}): ${motivo}`); };
  if (!objeto(valor)) invalido('o conteúdo deve ser um objeto.');
  for (const campo of ['caso', 'tema']) {
    if (typeof valor[campo] !== 'string' || !valor[campo].trim()) invalido(`${campo} deve ser texto não vazio.`);
  }
  if (typeof valor.tarefa !== 'string' || !['questoes', 'aula', 'avaliacao', 'sintese'].includes(valor.tarefa)) invalido('tarefa desconhecida.');
  if (!objeto(valor.expectativa)) invalido('expectativa deve ser um objeto.');
  if (valor.observacoes !== undefined && typeof valor.observacoes !== 'string') invalido('observacoes deve ser texto.');
  if (valor.tipo !== undefined && (typeof valor.tipo !== 'string' || !['normal', 'prova', 'roleta', 'reforco', 'minigame'].includes(valor.tipo))) invalido('tipo de atividade inválido.');
  if (valor.tarefa === 'questoes' && (typeof valor.quantidade !== 'number' || !Number.isInteger(valor.quantidade) || valor.quantidade < 1)) invalido('quantidade deve ser um inteiro positivo.');
  for (const campo of ['quantidade', 'alternativas', 'resposta_esperada_min_chars', 'rubrica_min_criterios', 'fixacao_min']) {
    const numero = valor.expectativa[campo];
    if (numero !== undefined && (typeof numero !== 'number' || !Number.isInteger(numero) || numero < 1)) invalido(`${campo} deve ser um inteiro positivo.`);
  }
  for (const campo of ['nota_min', 'nota_max']) {
    const nota = valor.expectativa[campo];
    if (nota !== undefined && (typeof nota !== 'number' || !Number.isFinite(nota) || nota < 0 || nota > 100)) invalido(`${campo} deve estar entre 0 e 100.`);
  }
  if (Number(valor.expectativa.nota_min ?? 0) > Number(valor.expectativa.nota_max ?? 100)) invalido('faixa de notas invertida.');
  if (valor.tarefa === 'questoes' && valor.expectativa.quantidade !== undefined && valor.expectativa.quantidade !== valor.quantidade) invalido('quantidade esperada diverge da solicitada.');
  if (valor.tarefa === 'avaliacao') {
    if (!objeto(valor.atividade) || typeof valor.atividade.id !== 'number' || !Number.isFinite(valor.atividade.id) || typeof valor.atividade.titulo !== 'string' || !valor.atividade.titulo.trim()) invalido('atividade inválida.');
    if (!objeto(valor.respostas) || !Object.values(valor.respostas).every((resposta) => typeof resposta === 'string')) invalido('respostas deve ser um objeto de textos.');
  }
  if (valor.tarefa === 'sintese') {
    if (!Array.isArray(valor.alunos_detalhes) || valor.alunos_detalhes.length === 0 || !valor.alunos_detalhes.every((aluno) => objeto(aluno) && typeof aluno.aluno_email === 'string' && aluno.aluno_email.trim() && Array.isArray(aluno.atividades) && aluno.atividades.every(objeto) && Array.isArray(aluno.atividades_pendentes) && aluno.atividades_pendentes.every(objeto))) invalido('alunos_detalhes deve conter trajetórias estruturadas com e-mail sintético.');
  }
}

export async function rodarCaso(caso: Caso): Promise<string[]> {
  validarCaso(caso);
  if (caso.tarefa === 'questoes') {
    const tipo = caso.tipo ?? 'normal';
    const quantidade = caso.quantidade!;
    const result = await gerarQuestoesAi({ tipo, quantidade, titulo: caso.caso, tema: caso.tema, observacoes: caso.observacoes || '', aulasContexto: '', docsContexto: '', questoes_existentes: [] });
    const erros = diagnosticarQuestoes(result.questions, { qtdSolicitada: quantidade, tipo });
    for (const question of result.questions) {
      if (caso.expectativa.alternativas !== undefined && (!Array.isArray(question.options) || question.options.length !== caso.expectativa.alternativas)) erros.push('Número de alternativas diferente do esperado.');
      if (caso.expectativa.resposta_esperada_min_chars !== undefined && String(question.resposta_esperada ?? '').length < Number(caso.expectativa.resposta_esperada_min_chars)) erros.push('Resposta esperada abaixo do tamanho mínimo.');
      if (caso.expectativa.rubrica_min_criterios !== undefined && (!Array.isArray(question.rubrica) || question.rubrica.length < Number(caso.expectativa.rubrica_min_criterios))) erros.push('Rubrica abaixo do mínimo de critérios.');
      if (Array.isArray(question.rubrica)) {
        const soma = question.rubrica.reduce((total: number, criterio: any) => total + criterio.peso, 0);
        if (Math.abs(soma - 100) > 0.01) erros.push('Pesos da rubrica não somam 100.');
      }
    }
    return erros;
  }
  if (caso.tarefa === 'aula') {
    const result = await generateAulaOutlineAndContent({ tema: caso.tema, observacoes: caso.observacoes });
    const outline = parseOutline(result.outline);
    const erros = [...diagnosticarOutline(outline), ...validarAulaMarp(result.conteudo_md).erros];
    if (outline && outline.fixacao.length < Number(caso.expectativa.fixacao_min ?? 0)) erros.push('Fixação abaixo do mínimo esperado.');
    return erros;
  }
  if (caso.tarefa === 'avaliacao') {
    if (!caso.atividade || !caso.respostas) throw new Error('Fixture de avaliação sem atividade/respostas sintéticas.');
    const result = await avaliarAlunoAtividade({ atividade: caso.atividade, respostasRaw: JSON.stringify(caso.respostas), observacoes: caso.observacoes });
    const min = Number(caso.expectativa.nota_min ?? 0);
    const max = Number(caso.expectativa.nota_max ?? 100);
    return Number.isFinite(result.nota) && result.nota >= min && result.nota <= max ? [] : [`Nota ${result.nota} fora da faixa esperada ${min}–${max}.`];
  }
  if (caso.tarefa === 'sintese') {
    if (!caso.alunos_detalhes?.length) throw new Error('Fixture de síntese sem alunos sintéticos.');
    const result = await sintetizarFeedbackTurma({ alunos_detalhes: caso.alunos_detalhes, disciplina_nome: caso.tema, observacoes: caso.observacoes });
    if (result.execucao?.estado === 'provider_failed' || result.execucao?.estado === 'timeout') {
      throw new ErroExecucaoAi(result.execucao.estado, 'A síntese teve falha de provedor ou timeout; os resultados parciais não autorizam continuar o eval.');
    }
    const erros = diagnosticarParecerTurma(JSON.stringify(result));
    if (result.alunos_sintese.length !== caso.alunos_detalhes.length) erros.push('Síntese individual incompleta.');
    if (result.falhas.length > 0) erros.push('A síntese contém falhas parciais.');
    return erros;
  }
  throw new Error('Tarefa de eval desconhecida.');
}

export function carregarCasos(dir = join(import.meta.dir, 'casos')): Caso[] {
  const arquivos = readdirSync(dir).filter((nome) => nome.endsWith('.json')).sort();
  if (arquivos.length === 0) throw new Error('Nenhum caso de eval configurado.');
  return arquivos.map((nome) => {
    let caso: unknown;
    try {
      caso = JSON.parse(readFileSync(join(dir, nome), 'utf8'));
    } catch (error) {
      throw new Error(`Fixture inválida (${nome}): não foi possível ler um JSON válido.`, { cause: error });
    }
    validarCaso(caso, nome);
    return caso;
  });
}

export async function executarSuite(casos: Caso[]) {
  const relatorio: Array<{ caso: string; status: 'passed' | 'failed' | 'not_run'; falhas: string[] }> = [];
  let providerBloqueado = false;
  for (const caso of casos) {
    if (providerBloqueado) {
      relatorio.push({ caso: caso.caso, status: 'not_run', falhas: ['Execução interrompida por falha do provedor ou timeout; escolha humana necessária antes de retomar.'] });
      continue;
    }
    try {
      const falhas = await rodarCaso(caso);
      relatorio.push({ caso: caso.caso, status: falhas.length === 0 ? 'passed' : 'failed', falhas });
    } catch (error) {
      const causa = error instanceof Error && error.cause instanceof ErroExecucaoAi ? error.cause : error;
      providerBloqueado = causa instanceof ErroExecucaoAi && ['provider_failed', 'timeout'].includes(causa.codigo);
      relatorio.push({ caso: caso.caso, status: 'failed', falhas: [error instanceof Error ? error.message : 'Erro desconhecido'] });
    }
  }
  return relatorio;
}

if (import.meta.main) {
  const relatorio = await executarSuite(carregarCasos());
  for (const resultado of relatorio) {
    console.log(`[${resultado.status}] ${resultado.caso}`);
    for (const falha of resultado.falhas) console.log(`  - ${falha}`);
  }
  console.log(`\nResumo: ${relatorio.filter((r) => r.status === 'passed').length}/${relatorio.length} casos passando`);
  if (!process.env.EVAL_SKIP_EXIT) process.exit(relatorio.length > 0 && relatorio.every((r) => r.status === 'passed') ? 0 : 1);
}
