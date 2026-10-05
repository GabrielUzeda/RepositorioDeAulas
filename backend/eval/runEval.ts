import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { callAi } from '../src/aiProvider';
import { diagnosticarQuestoes, normalizarQuestoesComRubrica } from '../src/aiQuestoes';
import { diagnosticarOutline, validarAulaMarp, type AulaOutline } from '../src/aiAula';

interface Caso {
  caso: string;
  tarefa: 'questoes' | 'aula';
  tipo?: string;
  quantidade?: number;
  tema: string;
  observacoes?: string;
  expectativa: Record<string, unknown>;
}

const DIR = import.meta.dir;

function parseJsonConteudo(content: string): any | null {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function rodarCasoQuestoes(caso: Caso): Promise<falhaDeCaso> {
  const retornoDeCaso: string[] = [];
  const systemPrompt = `Você é um especialista em elaboração de questões educacionais.
Gere ${caso.quantidade} questões do tipo "${caso.tipo}" sobre "${caso.tema}".
Objetivas: exatamente 4 alternativas, exatamente 1 correta, distratores plausíveis, posição da correta variada.
Discursivas: resposta_esperada (3 a 6 frases) e rubrica com 2 a 4 critérios com pesos somando 100.
Responda apenas com um array JSON de questões.`;

  const res = await callAi({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Tema: ${caso.tema}\nObservações: ${caso.observacoes || 'Nenhuma'}` },
    ],
    temperature: 0.3,
    task: 'questoes',
  });

  const parsed = parseJsonConteudo(res.content);
  const questoes = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : [];
  if (questoes.length !== caso.quantidade) {
    retornoDeCaso.push(`Quantidade gerada (${questoes.length}) diferente da esperada (${caso.quantidade}).`);
  }

  const erros = diagnosticarQuestoes(questoes, {
    qtdSolicitada: caso.quantidade || 0,
    tipo: caso.tipo || 'normal',
  });
  for (const erro of erros) retornoDeCaso.push(erro);

  const normalizadas = normalizarQuestoesComRubrica(questoes, caso.tipo || 'normal');
  for (const q of normalizadas) {
    if (Array.isArray(q.rubrica)) {
      const soma = q.rubrica.reduce((acc: number, c: any) => acc + (Number(c.peso) || 0), 0);
      if (Math.abs(soma - 100) > 0.01) retornoDeCaso.push(`${q.title || 'Questão'}: pesos da rubrica somam ${soma}.`);
    }
  }

  return retornoDeCaso;
}

async function rodarCasoAula(caso: Caso): Promise<falhaDeCaso> {
  const retornoDeCaso: string[] = [];

  const plannerRes = await callAi({
    messages: [
      {
        role: 'system',
        content:
          'Você é um coordenador pedagógico sênior. Planeje o outline JSON de uma aula Marp com seções e slides. Responda apenas com o JSON.',
      },
      { role: 'user', content: `Tema: ${caso.tema}\nObservações: ${caso.observacoes || 'Nenhuma'}` },
    ],
    temperature: 0.4,
    task: 'aula',
  });

  const outline = parseJsonConteudo(plannerRes.content) as AulaOutline | null;
  if (!outline || typeof outline !== 'object' || Array.isArray(outline)) {
    return ['Outline retornado não é um objeto JSON.'];
  }
  const errosOutline = diagnosticarOutline(outline);
  for (const erro of errosOutline) retornoDeCaso.push(`outline: ${erro}`);

  const writerRes = await callAi({
    messages: [
      {
        role: 'system',
        content:
          'Você escreve aulas em Marp Next Markdown (front-matter ---, separadores ---). Responda apenas com o markdown.',
      },
      {
        role: 'user',
        content: `Escreva uma aula Marp sobre ${caso.tema} seguindo este outline:\n${JSON.stringify(outline)}`,
      },
    ],
    temperature: 0.45,
    task: 'aula',
  });
  const valida = validarAulaMarp(writerRes.content);
  if (!valida.valido) {
    for (const erro of valida.erros.slice(0, 10)) retornoDeCaso.push(`marp: ${erro}`);
  }

  return retornoDeCaso;
}

type falhaDeCaso = string[];

function carregarCasos(): Caso[] {
  const arquivos = readdirSync(join(DIR, 'casos'), { withFileTypes: true }).filter(
    (d) => d.isFile() && d.name.endsWith('.json')
  );
  const casos: Caso[] = [];
  for (const d of arquivos) {
    try {
      casos.push(JSON.parse(readFileSync(join(DIR, 'casos', d.name), 'utf8')) as Caso);
    } catch (e) {
      console.log(`[FALHA] Carregando caso ${d.name}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return casos;
}

const relatorio: Array<{ caso: string; ok: boolean; falhas: string[] }> = [];

for (const caso of carregarCasos()) {
  try {
    const falhas = caso.tarefa === 'aula' ? await rodarCasoAula(caso) : await rodarCasoQuestoes(caso);
    relatorio.push({ caso: caso.caso, ok: falhas.length === 0, falhas });
  } catch (e: any) {
    relatorio.push({ caso: caso.caso, ok: false, falhas: [e?.message || 'Erro desconhecido'] });
  }
}

let okGeral = true;
for (const r of relatorio) {
  console.log(`[${r.ok ? 'OK' : 'FALHA'}] ${r.caso}`);
  for (const f of r.falhas) {
    console.log(`  - ${f}`);
    okGeral = false;
  }
}
console.log(`\nResumo: ${relatorio.filter((r) => r.ok).length}/${relatorio.length} casos passando`);

if (process.argv[1]?.includes('runEval') && !process.env.EVAL_SKIP_EXIT) {
  process.exit(okGeral ? 0 : 1);
}
