import { Hono, type Context } from 'hono';
import { professorAuth } from './auth';
import { db } from './db';
import { parseJsonOrNull } from './utils';
import { callAi, resolveConfig, resolveProvider, modelsUrl, type AiMessage } from './aiProvider';
import { obterContextoDocumentosSobDemanda } from './documentIndexer';
import { markdownParaContexto, distribuirOrcamentoContexto } from './aiContexto';
import {
  diagnosticarQuestoes,
  normalizarQuestoesComRubrica,
  montarPromptQuestoes,
} from './aiQuestoes';
import { getJob, cancelJob, createJob, registerJobProcessor, type JobCheckpointFn } from './aiJobs';
import { executarAvaliacaoEmLote } from './aiAvaliacao';
import { sintetizarFeedbackTurma } from './aiSintese';
import {
  SLIDES_TOTAIS_MAX,
  SLIDES_SECAO_MAX,
  diagnosticarOutline,
  dividirEmSlides,
  gerarFrontMatterEPrimeiroSlide,
  parseOutline,
  promptPlanejadorAula,
  promptSecaoAula,
  renderBlocoFechamento,
  repararSlidesDoConteudo,
  removerFrontMatterRestante,
  validarAulaMarp,
  validarSecaoMarp,
  type AulaOutline,
} from './aiAula';

const aiRouter = new Hono();

interface ModelCapability {
  vision?: boolean;
  reasoning?: boolean;
  contextWindow?: number;
  maxOutput?: number;
  upstreamProvider?: string;
}

interface AiModelItem {
  id: string;
  owned_by?: string;
  capabilities?: ModelCapability;
  context_length?: number;
  max_completion_tokens?: number;
}

aiRouter.get('/health', professorAuth, async (c) => {
  let config: ReturnType<typeof resolveConfig>;
  try {
    config = resolveConfig();
  } catch (e: any) {
    return c.json(
      { ok: false, status: 'offline', error: e.message || 'Configuração de IA inválida' },
      503
    );
  }

  if (!config.apiKey) {
    return c.json(
      {
        ok: false,
        status: 'unconfigured',
        provider: config.provider,
        model: config.model,
        error: 'AI_API_KEY nao configurada para o provider ' + config.provider,
      },
      503
    );
  }

  try {
    const provider = resolveProvider(config);
    const res = await fetch(modelsUrl(config), {
      headers: provider.buildHeaders(config.apiKey),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json().catch(() => undefined);
      return c.json({
        ok: true,
        status: 'online',
        provider: config.provider,
        model: config.model,
        baseUrl: config.baseUrl,
        ...(data !== undefined ? { data } : {}),
      });
    }
    return c.json(
      {
        ok: false,
        status: 'degraded',
        provider: config.provider,
        model: config.model,
        error: 'HTTP ' + res.status,
      },
      502
    );
  } catch (e: any) {
    return c.json(
      {
        ok: false,
        status: 'offline',
        provider: config.provider,
        model: config.model,
        error: e.message || 'Provider de IA indisponível',
      },
      503
    );
  }
});

aiRouter.get('/models', professorAuth, async (c) => {
  let config: ReturnType<typeof resolveConfig>;
  try {
    config = resolveConfig();
  } catch (e: any) {
    return c.json({ success: false, error: e.message || 'Configuração de IA inválida' }, 503);
  }

  if (!config.apiKey) {
    return c.json({ success: false, error: 'AI_API_KEY nao configurada' }, 503);
  }

  try {
    const provider = resolveProvider(config);
    const res = await fetch(modelsUrl(config), {
      headers: provider.buildHeaders(config.apiKey),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return c.json(
        { success: false, error: 'Provider ' + config.provider + ' retornou HTTP ' + res.status },
        502
      );
    }
    const body = (await res.json()) as { data?: AiModelItem[] };
    const rawModels: AiModelItem[] = Array.isArray(body?.data) ? body.data : [];

    const formatted = rawModels.map((m) => ({
      id: m.id,
      name: m.id,
      provider: config.provider,
      reasoning: !!m.capabilities?.reasoning,
      vision: !!m.capabilities?.vision,
      contextWindow: m.capabilities?.contextWindow || m.context_length || 0,
      maxOutput: m.capabilities?.maxOutput || m.max_completion_tokens || 0,
    }));

    return c.json({
      success: true,
      provider: config.provider,
      defaultModel: config.model,
      models: formatted,
    });
  } catch (e: any) {
    return c.json(
      { success: false, error: e.message || 'Falha ao consultar modelos do provider' },
      503
    );
  }
});

function extractQuestions(parsed: any): any[] {
  if (Array.isArray(parsed?.questions)) return parsed.questions;
  if (Array.isArray(parsed?.perguntas)) return parsed.perguntas;
  if (Array.isArray(parsed?.questoes)) return parsed.questoes;
  if (Array.isArray(parsed?.itens)) return parsed.itens;
  if (Array.isArray(parsed?.data)) return parsed.data;
  if (Array.isArray(parsed)) return parsed;
  return [];
}

function parseActivityQuestions(content: string): any[] {
  const cleanJson = content
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const candidates: string[] = [cleanJson];
  const objMatch = content.match(/\{[\s\S]*\}/);
  if (objMatch) candidates.push(objMatch[0]);
  const arrMatch = content.match(/\[[\s\S]*\]/);
  if (arrMatch) candidates.push(arrMatch[0]);

  let parsedQuestions: any[] = [];
  for (const candidate of candidates) {
    if (parsedQuestions.length > 0) break;
    parsedQuestions = extractQuestions(parseJsonOrNull(candidate));
  }
  return parsedQuestions;
}

aiRouter.post('/generate-activity', professorAuth, async (c) => {
  const professorId = Number(c.get('professorId'));
  const professorRole = c.get('professorRole') || 'professor';
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'JSON inválido' }, 400);
  }

  const {
    tipo = 'normal',
    titulo = '',
    tema = '',
    observacoes = '',
    quantidade = 5,
    disciplina_id,
    aulas_ids = [],
    aula_id,
    questoes_existentes = [],
  } = body;

  const targetAulasIds: number[] = Array.isArray(aulas_ids) ? [...aulas_ids.map(Number)] : [];
  if (aula_id && !targetAulasIds.includes(Number(aula_id))) {
    targetAulasIds.push(Number(aula_id));
  }

  if (!tema && !titulo && targetAulasIds.length === 0) {
    return c.json(
      {
        success: false,
        error: 'Informe um tema, título ou selecione ao menos uma aula para contextualizar',
      },
      400
    );
  }

  let aulasContexto = '';
  if (targetAulasIds.length > 0) {
    const aulasIdsJson = JSON.stringify(targetAulasIds);
    let aulas: { id: number; titulo: string; conteudo_md: string }[] = [];

    if (professorRole === 'admin') {
      const query = `
        SELECT a.id, a.titulo, a.conteudo_md 
        FROM aulas a
        WHERE a.id IN (SELECT value FROM json_each(?))
        ORDER BY a.ordem ASC
      `;
      aulas = db.query(query).all(aulasIdsJson) as {
        id: number;
        titulo: string;
        conteudo_md: string;
      }[];
    } else {
      const query = `
        SELECT a.id, a.titulo, a.conteudo_md 
        FROM aulas a
        JOIN disciplinas d ON a.disciplina_id = d.id
        JOIN curso_professores cp ON d.curso_id = cp.curso_id
        WHERE cp.professor_id = ? AND a.id IN (SELECT value FROM json_each(?))
        ORDER BY a.ordem ASC
      `;
      aulas = db.query(query).all(professorId, aulasIdsJson) as {
        id: number;
        titulo: string;
        conteudo_md: string;
      }[];
    }

    if (aulas.length > 0) {
      aulasContexto = distribuirOrcamentoContexto(aulas, 30000);
    }
  }

  let docsContexto = '';
  let targetDisciplinaId = disciplina_id ? Number(disciplina_id) : null;
  if (!targetDisciplinaId && targetAulasIds.length > 0) {
    const row = db
      .query('SELECT disciplina_id FROM aulas WHERE id = ?')
      .get(targetAulasIds[0]) as any;
    if (row?.disciplina_id) targetDisciplinaId = row.disciplina_id;
  }

  let targetCursoId: number | null = null;
  if (targetDisciplinaId) {
    const discRow = db
      .query('SELECT curso_id FROM disciplinas WHERE id = ?')
      .get(targetDisciplinaId) as any;
    if (discRow?.curso_id) targetCursoId = Number(discRow.curso_id);
  }

  if (targetDisciplinaId || targetCursoId) {
    docsContexto = obterContextoDocumentosSobDemanda({
      disciplinaId: targetDisciplinaId,
      cursoId: targetCursoId,
      temaOuAssunto: tema || titulo || 'Conteudo geral',
      limiteTrechos: 4,
    });
  }

  const { systemPrompt, userPrompt } = montarPromptQuestoes({
    tipo,
    titulo,
    tema,
    observacoes,
    quantidade,
    aulasContexto,
    docsContexto,
    questoes_existentes,
  });

  let content = '';
  let modeloUtilizado = '';
  try {
    const messages: AiMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    const result = await callAi({
      messages,
      temperature: 0.3,
      timeoutMs: 180000,
      validate: (content) => {
        const q = parseActivityQuestions(content);
        return q.length > 0 && diagnosticarQuestoes(q, { qtdSolicitada: quantidade, tipo }).length === 0;
      },
    });
    content = result.content;
    modeloUtilizado = result.modelUsed;
  } catch (e: any) {
    return c.json(
      {
        success: false,
        error: `Falha na geração com IA: ${e.message || 'Erro de conexão/timeout'}`,
      },
      502
    );
  }

  const parsedQuestions = parseActivityQuestions(content);

  if (parsedQuestions.length === 0) {
    return c.json({ success: false, error: 'A IA respondeu sem o formato JSON esperado' }, 502);
  }

  const normalizedQuestions = normalizarQuestoesComRubrica(parsedQuestions, tipo);

  return c.json({
    success: true,
    questions: normalizedQuestions,
    modelo_utilizado: modeloUtilizado,
    total_gerado: normalizedQuestions.length,
  });
});

export function repairRawHtmlBlocks(content: string): string {
  const tagPatterns: Array<{ open: RegExp; close: RegExp; tag: string }> = [
    { open: /<style\b[^>]*>/gi, close: /<\/style>/gi, tag: 'style' },
    { open: /<script\b[^>]*>/gi, close: /<\/script>/gi, tag: 'script' },
    { open: /<template\b[^>]*>/gi, close: /<\/template>/gi, tag: 'template' },
    { open: /<textarea\b[^>]*>/gi, close: /<\/textarea>/gi, tag: 'textarea' },
  ];
  let result = content;
  for (const { open, close, tag } of tagPatterns) {
    const openCount = (result.match(open) || []).length;
    const closeCount = (result.match(close) || []).length;
    if (openCount > closeCount) {
      result += `\n</${tag}>\n`;
    }
  }
  return result;
}

export function repairUnclosedCodeBlocks(content: string): string {
  const matches = content.match(/```/g);
  if (matches && matches.length % 2 !== 0) {
    return `${content}\n\`\`\`\n`;
  }
  return content;
}

export function normalizeMarpMarkdown(content: string): string {
  let cleaned = content
    .replace(/^```(?:markdown|md)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  cleaned = repairUnclosedCodeBlocks(cleaned);
  cleaned = repairRawHtmlBlocks(cleaned);
  return cleaned;
}

export async function generateAulaOutlineAndContent(options: {
  disciplina_id?: number;
  tema?: string;
  aulas_contexto_ids?: number[];
  continuar_sequencia?: boolean;
  observacoes?: string;
  professorId?: number;
  professorRole?: string;
  checkpoint?: JobCheckpointFn;
  isCancelled?: () => boolean;
}) {
  const {
    disciplina_id,
    tema = '',
    aulas_contexto_ids = [],
    continuar_sequencia = false,
    observacoes = '',
    professorId = 1,
    professorRole = 'admin',
    checkpoint,
    isCancelled,
  } = options;

  const targetAulasIds: number[] = Array.isArray(aulas_contexto_ids)
    ? aulas_contexto_ids.map(Number).filter(Boolean)
    : [];

  if (continuar_sequencia && disciplina_id) {
    let ultimaAula: { id: number } | undefined;
    if (professorRole === 'admin') {
      ultimaAula = db
        .query(`SELECT a.id FROM aulas a WHERE a.disciplina_id = ? ORDER BY a.ordem DESC LIMIT 1`)
        .get(disciplina_id) as { id: number } | undefined;
    } else {
      ultimaAula = db
        .query(
          `SELECT a.id FROM aulas a
         JOIN disciplinas d ON a.disciplina_id = d.id
         JOIN curso_professores cp ON d.curso_id = cp.curso_id
         WHERE cp.professor_id = ? AND a.disciplina_id = ?
         ORDER BY a.ordem DESC LIMIT 1`
        )
        .get(professorId, disciplina_id) as { id: number } | undefined;
    }
    if (ultimaAula && !targetAulasIds.includes(ultimaAula.id)) {
      targetAulasIds.push(ultimaAula.id);
    }
  }

  if (!tema && targetAulasIds.length === 0) {
    throw new Error('Informe um tema ou selecione aulas de referência para contextualizar a geração');
  }

  let aulasContexto = '';
  if (targetAulasIds.length > 0) {
    const aulasIdsJson = JSON.stringify(targetAulasIds);
    let aulas: { id: number; titulo: string; conteudo_md: string; ordem: number }[] = [];

    if (professorRole === 'admin') {
      aulas = db
        .query(
          `SELECT a.id, a.titulo, a.conteudo_md, a.ordem FROM aulas a WHERE a.id IN (SELECT value FROM json_each(?)) ORDER BY a.ordem ASC`
        )
        .all(aulasIdsJson) as { id: number; titulo: string; conteudo_md: string; ordem: number }[];
    } else {
      aulas = db
        .query(
          `SELECT a.id, a.titulo, a.conteudo_md, a.ordem FROM aulas a
         JOIN disciplinas d ON a.disciplina_id = d.id
         JOIN curso_professores cp ON d.curso_id = cp.curso_id
         WHERE cp.professor_id = ? AND a.id IN (SELECT value FROM json_each(?))
         ORDER BY a.ordem ASC`
        )
        .all(professorId, aulasIdsJson) as {
        id: number;
        titulo: string;
        conteudo_md: string;
        ordem: number;
      }[];
    }

    if (aulas.length > 0) {
      aulasContexto = distribuirOrcamentoContexto(aulas, 30000);
    }
  }

  let targetDisciplinaId = disciplina_id ? Number(disciplina_id) : null;
  if (!targetDisciplinaId && targetAulasIds.length > 0) {
    const row = db
      .query('SELECT disciplina_id FROM aulas WHERE id = ?')
      .get(targetAulasIds[0]) as any;
    if (row?.disciplina_id) targetDisciplinaId = row.disciplina_id;
  }

  let targetCursoId: number | null = null;
  if (targetDisciplinaId) {
    const discRow = db
      .query('SELECT curso_id FROM disciplinas WHERE id = ?')
      .get(targetDisciplinaId) as any;
    if (discRow?.curso_id) targetCursoId = Number(discRow.curso_id);
  }

  let docsContexto = '';
  if (targetDisciplinaId) {
    docsContexto = obterContextoDocumentosSobDemanda({
      disciplinaId: targetDisciplinaId,
      cursoId: targetCursoId,
      temaOuAssunto: tema || 'Conteudo geral',
      limiteTrechos: 4,
    });
  }

  if (isCancelled?.()) throw new Error('Job cancelado pelo usuário');

  const { systemPrompt: plannerSystemPrompt, userPrompt: plannerUserPrompt } = promptPlanejadorAula({
    tema,
    observacoes,
    aulasContexto,
    docsContexto,
  });

  let outline: AulaOutline | null = null;
  let outlineResult = '';
  let modeloUtilizado = '';
  const avisos: string[] = [];

  try {
    const plannerMessages: AiMessage[] = [
      { role: 'system', content: plannerSystemPrompt },
      { role: 'user', content: plannerUserPrompt },
    ];
    const pRes = await callAi({
      messages: plannerMessages,
      temperature: 0.4,
      timeoutMs: 120000,
      task: 'aula',
      maxRepairs: 2,
      diagnose: (conteudoPlanner) => {
        const parsed = parseOutline(conteudoPlanner);
        if (!parsed) return ['A resposta não contém o objeto JSON do outline esperado.'];
        return diagnosticarOutline(parsed);
      },
    });
    outline = parseOutline(pRes.content);
    modeloUtilizado = pRes.modelUsed;
  } catch (e: any) {
    throw new Error(
      `Falha ao planejar a estrutura da aula com IA: ${e.message || 'Erro de conexão/timeout'}. Tente novamente.`
    );
  }

  if (!outline) {
    throw new Error('A IA não retornou um outline pedagógico válido. Tente novamente.');
  }

  outlineResult = JSON.stringify(outline);

  if (isCancelled?.()) throw new Error('Job cancelado pelo usuário');

  await checkpoint?.('35% - Planejando estrutura pedagógica e tópicos...', { fase: 'outline', outline: outlineResult });

  if (isCancelled?.()) throw new Error('Job cancelado pelo usuário');

  let autor = '';
  if (professorId) {
    const profRow = db.query('SELECT nome FROM professores WHERE id = ?').get(professorId) as
      | { nome: string }
      | undefined;
    autor = profRow?.nome || '';
  }

  const capa = gerarFrontMatterEPrimeiroSlide(outline, autor);
  const conceitosJaCobertos: string[] = [];
  const titulosSlidesAnteriores: string[] = [];
  const secoesMd: string[] = [];
  const totalSecoes = outline.secoes.length;

  for (let i = 0; i < totalSecoes; i++) {
    if (isCancelled?.()) throw new Error('Job cancelado pelo usuário');
    const secao = outline.secoes[i];
    const pctSecao = 35 + Math.round((i / totalSecoes) * 45);
    await checkpoint?.(`${pctSecao}% - Redigindo seção ${i + 1} de ${totalSecoes}: ${secao.titulo}...`, {
      fase: 'secoes',
      secao: i + 1,
      total: totalSecoes,
    });

    const { systemPrompt: secSys, userPrompt: secUser } = promptSecaoAula({
      outline,
      indiceSecao: i,
      conceitosJaCobertos,
      titulosSlidesAnteriores,
      contextoLimpo: aulasContexto,
    });

    let secaoLimpa = '';
    let ultimosErros: string[] = [];

    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const correcao =
        ultimosErros.length > 0
          ? `\n\nCORRIJA OS PROBLEMAS DA TENTATIVA ANTERIOR, mantendo o conteúdo:\n- ${ultimosErros.join('\n- ')}`
          : '';
      try {
        const resSecao = await callAi({
          messages: [
            { role: 'system', content: secSys },
            { role: 'user', content: secUser + correcao },
          ],
          temperature: 0.45,
          timeoutMs: 180000,
          task: 'aula',
          maxRepairs: 1,
          diagnose: (conteudo) => validarSecaoMarp(removerFrontMatterRestante(conteudo)),
        });
        modeloUtilizado = resSecao.modelUsed || modeloUtilizado;
        secaoLimpa = repararSlidesDoConteudo(removerFrontMatterRestante(resSecao.content));
        ultimosErros = validarSecaoMarp(secaoLimpa);
      } catch (e: any) {
        ultimosErros = [e.message || 'Erro de conexão/timeout ao redigir a seção.'];
      }

      const qtdSlides = dividirEmSlides(secaoLimpa).length;
      if (ultimosErros.length === 0 && qtdSlides > SLIDES_SECAO_MAX) {
        ultimosErros.push(
          `A seção ficou com ${qtdSlides} slides; comprima para no máximo ${SLIDES_SECAO_MAX}, mantendo um conceito por slide.`
        );
      }
      if (ultimosErros.length === 0) break;
    }

    if (ultimosErros.length > 0) {
      throw new Error(
        `Não foi possível gerar a seção ${i + 1} (${secao.titulo}) sem problemas de estrutura: ${ultimosErros.join(' ')}`
      );
    }

    secoesMd.push(secaoLimpa);
    for (const linha of secaoLimpa.split('\n')) {
      const mTitulo = linha.match(/^#{1,2}\s+(.*)/);
      if (mTitulo) titulosSlidesAnteriores.push(mTitulo[1].trim());
    }
    conceitosJaCobertos.push(...secao.conceitos);
  }

  if (isCancelled?.()) throw new Error('Job cancelado pelo usuário');

  const fechamento = renderBlocoFechamento(outline);
  const content = [capa, ...secoesMd, fechamento].filter(Boolean).join('\n\n---\n\n');

  if (isCancelled?.()) throw new Error('Job cancelado pelo usuário');

  await checkpoint?.('85% - Validando e finalizando a aula...', { fase: 'validacao' });

  if (isCancelled?.()) throw new Error('Job cancelado pelo usuário');

  const cleaned = repararSlidesDoConteudo(normalizeMarpMarkdown(content));

  if (!cleaned || !cleaned.includes('---')) {
    throw new Error('A IA não retornou Markdown Marp válido');
  }

  const validacaoFinal = validarAulaMarp(cleaned);
  if (!validacaoFinal.valido) {
    throw new Error(
      `A aula gerada ficou com problemas de estrutura: ${validacaoFinal.erros.slice(0, 5).join(' ')}`
    );
  }

  const totalSlides = dividirEmSlides(cleaned).length;
  if (totalSlides > SLIDES_TOTAIS_MAX) {
    avisos.push(
      `A aula ficou com ${totalSlides} slides (acima de ${SLIDES_TOTAIS_MAX}); considere dividi-la em duas aulas.`
    );
  }

  return {
    success: true,
    conteudo_md: cleaned,
    titulo_sugerido: outline.titulo.trim(),
    modelo_utilizado: modeloUtilizado,
    outline: outlineResult,
    ...(avisos.length > 0 ? { avisos } : {}),
  };
}

registerJobProcessor('aula', async (job, checkpoint, isCancelled) => {
  return generateAulaOutlineAndContent({ ...job.parametros, checkpoint, isCancelled });
});

aiRouter.post('/generate-aula', professorAuth, async (c) => {
  const professorId = Number(c.get('professorId'));
  const professorRole = c.get('professorRole') || 'professor';
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const { tema = '', aulas_contexto_ids = [] } = body;
  const targetAulasIds = Array.isArray(aulas_contexto_ids) ? aulas_contexto_ids.map(Number).filter(Boolean) : [];
  if (!tema && targetAulasIds.length === 0) {
    return c.json(
      {
        success: false,
        error: 'Informe um tema ou selecione aulas de referência para contextualizar a geração',
      },
      400
    );
  }

  const isAsync = body.async === true || c.req.query('async') === 'true';

  if (isAsync) {
    const job = createJob('aula', { ...body, professorId, professorRole }, true);
    return c.json({ success: true, job_id: job.id, status: 'pendente' }, 202);
  }

  try {
    const result = await generateAulaOutlineAndContent({
      ...body,
      professorId,
      professorRole,
    });
    return c.json(result);
  } catch (e: any) {
    return c.json(
      {
        success: false,
        error: e.message || 'Falha na geração de aula com IA',
      },
      502
    );
  }
});

function parseEvaluationResult(
  content: string
): { nota_sugerida: number; feedback: string; justificativa: string } | null {
  try {
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.nota_sugerida !== 'number' || !parsed.feedback) return null;
    return {
      nota_sugerida: parsed.nota_sugerida,
      feedback: parsed.feedback,
      justificativa: parsed.justificativa,
    };
  } catch {
    return null;
  }
}

async function evaluateStudentResponse({
  questao_enunciado,
  resposta_aluno,
  gabarito,
  criterios,
  observacoes,
  severidade = 'moderado',
}: {
  questao_enunciado: string;
  resposta_aluno: string;
  gabarito?: string;
  criterios?: string;
  observacoes?: string;
  severidade?: 'brando' | 'moderado' | 'rigoroso' | 'sistematico' | string;
}): Promise<{
  nota_sugerida: number;
  feedback: string;
  justificativa?: string;
  modelo_utilizado?: string;
}> {
  let severidadeInstrucao = '';
  switch (severidade) {
    case 'brando':
      severidadeInstrucao =
        'Nível de severidade: BRANDO. Seja encorajador e flexível. Valorize a intenção, raciocínio e conceitos parciais, relevando pequenos desvios de sintaxe, formatação ou pontuação.';
      break;
    case 'rigoroso':
      severidadeInstrucao =
        'Nível de severidade: RIGOROSO. Exija precisão conceitual, clareza técnica e rigor na demonstração dos pontos solicitados. Penalize omissões conceituais ou imprecisões.';
      break;
    case 'sistematico':
      severidadeInstrucao =
        'Nível de severidade: SISTEMÁTICO. Avalie item a item com método estrito e analítico, pontuando cada aspecto de forma pragmática e fundamentada.';
      break;
    case 'moderado':
    default:
      severidadeInstrucao =
        'Nível de severidade: MODERADO. Mantenha um equilíbrio justo entre rigor técnico e acolhimento pedagógico construtivo.';
      break;
  }

  const systemPrompt = `Você é um avaliador pedagógico sênior. Avalie a resposta do aluno com base no enunciado da questão, nos critérios ou gabarito (se houver).
${severidadeInstrucao}
Retorne ESTRITAMENTE um objeto JSON no formato:
{
  "nota_sugerida": 85,
  "feedback": "Comentário pedagógico detalhado e construtivo diretamente para o aluno...",
  "justificativa": "Breve justificativa técnica da pontuação para o professor..."
}
Regras:
1. "nota_sugerida" deve ser um número inteiro entre 0 e 100.
2. O "feedback" deve ser empático, apontar os acertos, explicar eventuais equívocos e orientar a melhoria.
3. Responda apenas com o JSON puro, sem blocos markdown.`;

  let userPrompt = `ENUNCIADO DA QUESTÃO:\n${questao_enunciado}\n\n`;
  if (gabarito) userPrompt += `GABARITO / EXPECTATIVA DE RESPOSTA:\n${gabarito}\n\n`;
  if (criterios) userPrompt += `CRITÉRIOS DE CORREÇÃO:\n${criterios}\n\n`;
  if (observacoes && observacoes.trim())
    userPrompt += `OBSERVAÇÕES DO PROFESSOR:\n${observacoes.trim()}\n\n`;
  userPrompt += `RESPOSTA SUBMETIDA PELO ALUNO:\n${resposta_aluno}`;

  try {
    const result = await callAi({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      timeoutMs: 30000,
      validate: (content) => parseEvaluationResult(content) !== null,
    });
    const parsed = parseEvaluationResult(result.content);
    if (!parsed) {
      throw new Error('Falha na avaliação por IA: resposta sem formato JSON esperado');
    }
    return {
      nota_sugerida: Math.min(100, Math.max(0, Math.round(parsed.nota_sugerida))),
      feedback: String(parsed.feedback).trim(),
      justificativa: String(parsed.justificativa || '').trim(),
      modelo_utilizado: result.modelUsed,
    };
  } catch (e: any) {
    throw new Error('Falha na avaliação por IA: ' + (e.message || 'Erro desconhecido'));
  }
}

aiRouter.post('/evaluate-response', professorAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { questao_enunciado, resposta_aluno, gabarito, criterios, observacoes, severidade } = body;

  if (!questao_enunciado || !resposta_aluno) {
    return c.json(
      { success: false, error: 'questao_enunciado e resposta_aluno são obrigatórios.' },
      400
    );
  }

  try {
    const result = await evaluateStudentResponse({
      questao_enunciado,
      resposta_aluno,
      gabarito,
      criterios,
      observacoes,
      severidade,
    });
    return c.json({ success: true, ...result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 502);
  }
});

export async function handleEvaluateActivityResponses(c: Context, forcedAtividadeId?: number) {
  const body = await c.req.json().catch(() => ({}));
  const atividade_id =
    forcedAtividadeId !== undefined
      ? Number(forcedAtividadeId)
      : Number(body.atividade_id || body.atividadeId);

  if (!atividade_id || isNaN(atividade_id)) {
    return c.json({ success: false, error: 'atividade_id é obrigatório.' }, 400);
  }

  const atv = db
    .query('SELECT id, disciplina_id, titulo, descricao, json_data FROM atividades WHERE id = ?')
    .get(atividade_id) as any;
  if (!atv) {
    return c.json({ success: false, error: 'Atividade não encontrada.' }, 404);
  }

  const profId = c.get('professorId');
  const profRole = c.get('professorRole');
  if (profRole !== 'admin') {
    const d = db
      .query('SELECT curso_id FROM disciplinas WHERE id = ?')
      .get(atv.disciplina_id) as any;
    if (!d) return c.text('Access denied', 403);
    const hasPerm = db
      .query('SELECT 1 FROM curso_professores WHERE curso_id = ? AND professor_id = ?')
      .get(d.curso_id, Number(profId));
    if (!hasPerm) return c.text('Access denied', 403);
  }

  const escopo = body.escopo === 'todas' ? 'todas' : 'pendentes';
  const observacoes = typeof body.observacoes === 'string' ? body.observacoes.trim() : undefined;
  const severidade = typeof body.severidade === 'string' ? body.severidade.trim() : 'moderado';

  return executarAvaliacaoEmLote(c, atividade_id, { escopo, observacoes, severidade });
}

aiRouter.post('/evaluate-activity-responses', professorAuth, async (c) => {
  return handleEvaluateActivityResponses(c);
});

aiRouter.post('/synthesize-class-feedback', professorAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const {
    disciplina_id,
    disciplina_nome,
    total_envios,
    respostas_resumo,
    alunos_detalhes,
    observacoes,
    severidade,
  } = body;

  const observacoesLimpo =
    typeof observacoes === 'string' ? observacoes.trim().slice(0, 2000) : undefined;
  const severidadeSafe = typeof severidade === 'string' ? severidade.trim() : 'moderado';

  const targetDisciplinaId = disciplina_id ? Number(disciplina_id) : null;
  const professorId = Number(c.get('professorId'));
  const professorRole = c.get('professorRole') || 'professor';

  if (targetDisciplinaId) {
    if (!Number.isInteger(targetDisciplinaId)) {
      return c.json({ success: false, error: 'disciplina_id inválido.' }, 400);
    }
    if (professorRole !== 'admin') {
      const d = db
        .query('SELECT curso_id FROM disciplinas WHERE id = ?')
        .get(targetDisciplinaId) as any;
      if (!d) return c.text('Access denied', 403);
      const hasPerm = db
        .query('SELECT 1 FROM curso_professores WHERE curso_id = ? AND professor_id = ?')
        .get(d.curso_id, professorId);
      if (!hasPerm) return c.text('Access denied', 403);
    }
  }

  if (!targetDisciplinaId && !Array.isArray(alunos_detalhes) && !Array.isArray(respostas_resumo)) {
    return c.json(
      { success: false, error: 'Informe disciplina_id ou a lista de alunos para a síntese.' },
      400
    );
  }

  try {
    const resultado = await sintetizarFeedbackTurma({
      disciplina_id: targetDisciplinaId,
      alunos_detalhes: Array.isArray(alunos_detalhes)
        ? alunos_detalhes
        : Array.isArray(respostas_resumo)
          ? respostas_resumo
          : undefined,
      observacoes: observacoesLimpo,
      severidade: severidadeSafe,
      disciplina_nome: typeof disciplina_nome === 'string' ? disciplina_nome : '',
    });

    return c.json({
      success: true,
      ...resultado,
      total_envios: targetDisciplinaId ? undefined : total_envios || 0,
    });
  } catch (e: any) {
    return c.json(
      { success: false, error: e?.message || 'Falha na síntese por IA' },
      502
    );
  }
});

aiRouter.post('/jobs', professorAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { tipo, parametros } = body;
  if (!tipo || typeof tipo !== 'string') {
    return c.json({ success: false, error: 'O campo "tipo" é obrigatório.' }, 400);
  }
  const job = createJob(tipo, parametros || {}, true);
  return c.json(
    {
      success: true,
      job_id: job.id,
      status: 'pendente',
      job: {
        id: job.id,
        tipo: job.tipo,
        status: job.status,
        progresso: job.progresso,
      },
    },
    202
  );
});

aiRouter.get('/jobs/:id', professorAuth, async (c) => {
  const id = c.req.param('id') || '';
  const job = getJob(id);
  if (!job) {
    return c.json({ success: false, error: 'Job não encontrado.' }, 404);
  }
  const pctMatch = job.progresso?.match(/^(\d+)%/);
  const progressNum = pctMatch ? parseInt(pctMatch[1], 10) : (job.status === 'concluido' ? 100 : 0);

  return c.json({
    success: true,
    job: {
      id: job.id,
      tipo: job.tipo,
      status: job.status,
      progresso: job.progresso,
      parametros: job.parametros,
      resultado: job.resultado,
      erro: job.erro,
      criado_em: job.criado_em,
      atualizado_em: job.atualizado_em,
    },
    job_id: job.id,
    tipo: job.tipo,
    status:
      job.status === 'concluido'
        ? 'completed'
        : job.status === 'erro'
          ? 'failed'
          : job.status === 'cancelado'
            ? 'cancelled'
            : 'processing',
    progress: progressNum,
    step_message: job.progresso,
    result: job.resultado,
    error: job.erro,
    criado_em: job.criado_em,
    atualizado_em: job.atualizado_em,
  });
});

aiRouter.post('/jobs/:id/cancel', professorAuth, async (c) => {
  const id = c.req.param('id') || '';
  const cancelled = cancelJob(id);
  return c.json({ success: true, cancelled });
});

export { aiRouter };
