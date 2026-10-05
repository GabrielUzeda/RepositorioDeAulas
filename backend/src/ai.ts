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
  SLIDES_TOTAIS_MIN,
  SLIDES_TOTAIS_MAX,
  FIXACAO_MIN,
  FIXACAO_MAX,
  diagnosticarOutline,
  gerarFrontMatterEPrimeiroSlide,
  parseOutline,
  promptSecaoAula,
  removerFrontMatterRestante,
  validarAulaMarp,
  validarSlideMarp,
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

  // FASE 1: Agente Planejador / Outline estruturado
  const plannerSystemPrompt = `Você é um coordenador pedagógico e designer instrucional sênior. Sua tarefa é planejar a estrutura detalhada (outline) de uma aula completa de ${SLIDES_TOTAIS_MIN} a ${SLIDES_TOTAIS_MAX} slides sobre o tema fornecido.

Retorne ESTRITAMENTE um objeto JSON no formato:
{
  "titulo": "Título principal da aula",
  "subtitulo": "Subtítulo contextual",
  "objetivos": ["Objetivo de aprendizagem..."],
  "prerequisitos": ["Pré-requisito..."],
  "secoes": [
    {
      "titulo": "Título da seção",
      "slides": [
        { "titulo": "Título do slide", "objetivo": "Objetivo pedagógico do slide", "conceitos_novos": ["Conceito apresentado neste slide"], "recurso": "texto|codigo|tabela|mermaid|katex" }
      ]
    }
  ],
  "fixacao": ["Pergunta reflexiva 1", "Pergunta reflexiva 2", "Pergunta reflexiva 3"]
}

Regras:
1. Total de ${SLIDES_TOTAIS_MIN} a ${SLIDES_TOTAIS_MAX} slides somando todas as seções (excluindo capa e fixação).
2. Progressão pedagógica: do concreto ao abstrato; cada slide cobre um conceito novo (conceitos_novos nunca repete conceito de outro slide).
3. Abertura com checagem de pré-requisitos e chamada freiriana.
4. ${FIXACAO_MIN} a ${FIXACAO_MAX} perguntas de fixação.
5. Fundamente nos documentos e aulas de referência; se não cobrirem o tema, não invente conceitos.
6. Responda apenas com o JSON puro, sem formatação markdown.`;

  let plannerUserPrompt = `TEMA: ${tema || 'Conteúdo geral'}\n`;
  if (observacoes) plannerUserPrompt += `OBSERVAÇÕES: ${observacoes}\n`;
  if (aulasContexto) plannerUserPrompt += `\nAULAS DE REFERÊNCIA:\n${aulasContexto}\n`;
  if (docsContexto) plannerUserPrompt += `\nDOCUMENTOS ORIENTADORES:\n${docsContexto}\n`;
  plannerUserPrompt += `Gere o outline pedagógico estruturado para esta aula.`;

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
      maxRepairs: 1,
      diagnose: (conteudoPlanner) => {
        const parsed = parseOutline(conteudoPlanner);
        if (!parsed) return ['A resposta não contém o objeto JSON do outline esperado.'];
        return diagnosticarOutline(parsed);
      },
    });
    outline = parseOutline(pRes.content);
    modeloUtilizado = pRes.modelUsed;
  } catch (_e: any) {
    outline = null;
  }

  if (outline) {
    outlineResult = JSON.stringify(outline);
  } else {
    outlineResult = tema || 'Outline gerado automaticamente';
    avisos.push(
      'Falha ao planejar o outline estruturado; a aula foi gerada em chamada única a partir do tema.'
    );
  }

  if (isCancelled?.()) throw new Error('Job cancelado pelo usuário');

  await checkpoint?.('35% - Planejando estrutura pedagógica e tópicos...', { fase: 'outline', outline: outlineResult });

  if (isCancelled?.()) throw new Error('Job cancelado pelo usuário');

  let content = '';

  if (outline && Array.isArray(outline.secoes) && outline.secoes.length > 0) {
    // FASE 2A: Redação por seção (D3-B)
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
      await checkpoint?.(
        `${pctSecao}% - Redigindo seção ${i + 1} de ${totalSecoes}: ${secao.titulo}...`,
        { fase: 'secoes', secao: i + 1, total: totalSecoes }
      );

      const { systemPrompt: secSys, userPrompt: secUser } = promptSecaoAula({
        outline,
        indiceSecao: i,
        conceitosJaCobertos,
        titulosSlidesAnteriores,
        contextoLimpo: aulasContexto,
      });

      try {
        const resSecao = await callAi({
          messages: [
            { role: 'system', content: secSys },
            { role: 'user', content: secUser },
          ],
          temperature: 0.45,
          timeoutMs: 180000,
          task: 'aula',
          maxRepairs: 1,
          diagnose: (conteudoSecao) => validarSlideMarp(conteudoSecao),
        });
        modeloUtilizado = resSecao.modelUsed || modeloUtilizado;
        const secaoLimpa = removerFrontMatterRestante(resSecao.content);

        const errosValidacao = validarAulaMarp(secaoLimpa);
        if (!errosValidacao.valido) {
          avisos.push(`Seção ${i + 1} (${secao.titulo}): ${errosValidacao.erros.join(' ')}`);
        }

        secoesMd.push(secaoLimpa);
        for (const linha of secaoLimpa.split('\n')) {
          const mTitulo = linha.match(/^#{1,2}\s+(.*)/);
          if (mTitulo) titulosSlidesAnteriores.push(mTitulo[1].trim());
        }
        for (const slide of secao.slides || []) {
          conceitosJaCobertos.push(...(slide.conceitos_novos || []).filter(Boolean));
        }
      } catch (e: any) {
        throw new Error(
          `Falha ao redigir a seção ${i + 1} (${secao.titulo}) com IA: ${e.message || 'Erro de conexão/timeout'}`
        );
      }
    }

    if (isCancelled?.()) throw new Error('Job cancelado pelo usuário');

    const fixacaoItens = (outline.fixacao || []).map((q) => `- ${q}`).join('\n');
    const blocoFixacao = fixacaoItens
      ? `\n\n---\n\n## Verifique o que você aprendeu\n\n${fixacaoItens}\n`
      : '';
    content = [capa, secoesMd.join('\n\n---\n\n')].join('\n\n---\n\n') + blocoFixacao;
  } else {
    // FASE 2B: Redação em chamada única (fallback, sem outline estruturado)
  const MARP_SYSTEM_PROMPT = `<INSTRUCOES>
Você é um especialista em didática, design instrucional e metodologias de ensino inclusivo para adolescentes e adultos.
Você é ótimo combinando clareza formal com narrativas, analogias e educação preventiva.
Sua tarefa é gerar conteúdo didático no formato do motor Marp Next a partir de um tema e outline estruturado.
Lembre-se: slides também são materiais de estudo, portanto podem conter explicações detalhadas, desde que com tom formal, clareza e organização.
Responda somente com a aula gerada.
</INSTRUCOES>

<REGRAS>
1. Formato obrigatório: Marp Next Markdown (front-matter YAML delimitado por ---).
2. Todo slide começa com --- como separador (exceto o primeiro).
3. Use diretivas de animação em comentários HTML <!-- animation: fade-up --> antes do conteúdo do slide quando pertinente.
4. Não repita conteúdo já presente nas aulas de referência fornecidas.
5. Mantenha progressão pedagógica: do concreto ao abstrato, do simples ao complexo. NUNCA mencione um termo técnico antes de tê-lo explicado; a aula é uma construção linear e acumulativa — cada slide apoia-se apenas no que já foi apresentado. Antes de construir o conteúdo, faça a checagem de pré-requisitos: identifique o que o aluno precisa já saber para entender esta aula, verifique se isso consta nas aulas anteriores fornecidas como contexto e, se constar, abra o desenvolvimento com uma recapitulação curta desse pré-requisito (sem repetir o conteúdo todo) para a nova aula se apoiar nela.
6. Use KaTeX para fórmulas matemáticas quando necessário (delimitadores $...$ inline, $$...$$ bloco).
7. Use blocos de código com linguagem especificada quando houver exemplos de código.
8. Use tabelas Markdown para comparações e sínteses.
9. Use Mermaid (blocos mermaid) para diagramas, fluxos e relações. Os slides são exibidos em paisagem (landscape), com espaço vertical limitado: tenha preferência por diagramas que ocupem mais largura do que altura, mantendo o fluxo achatado e horizontal (ex.: orientações LR/RL, sequências); evite gráficos altos que estourem a altura do slide. Escolha a orientação conforme a clareza, desde que respeite a limitação vertical.
10. A última seção deve conter 3 a 5 perguntas reflexivas de fixação do conteúdo.
11. Máximo de 10 frases por slide; controle rigoroso do volume de texto, priorizando visual limpo e legível.
12. Use listas fragmentadas: listas com * ou 1. aparecem item a item ao avançar os slides (progressão gradual de ideias).
13. Incorpore narrativas, analogias e prevenção de erros comuns de forma integrada e natural.
14. Não infantilize o texto nem use termos demasiadamente lúdicos; mantenha tom formal e acessível.
15. Em Material Complementar, cite livros comuns da área e links de documentação/sites de referência para aprofundamento no tema.
16. Nunca use placeholders de imagem (ex.: [Image of ...]); só inclua imagem se houver URL/caminho real.
17. NÃO rotule nada como nível de dificuldade (ex.: "Introdutório", "Intermediário", "Avançado", "para iniciantes") — etiquetas assim podem gerar desânimo; trate todos os estudantes como capazes.
18. NÃO cite termos pedagógicos técnicos no texto dos slides (ex.: "Educação Preventiva", "Autoavaliação", "avaliação formativa", "zona de desenvolvimento proximal"); prefira a linguagem natural correspondente (ex.: "erros comuns", "fixação", "verifique o que você aprendeu").
19. NUNCA comprima múltiplos conceitos distintos em um único slide; cada novo conceito, mecanismo ou variação ganha slide próprio — não apresse o raciocínio.
20. Gere slides suficientes para cobrir o tema com profundidade real: o mínimo é 12 slides de conteúdo (excluindo título e fixação). Não resuma em poucos slides um assunto que merece ser construído passo a passo.
21. NUNCA use títulos ou callouts chamativos do tipo "Regra de Ouro:", "Dica de Ouro:", "Segredo:", "Atenção:", "Importante:" — eles soam mecânicos e quebram a imersão. Prefira títulos descritivos do conteúdo (ex.: "O problema do trabalho repetitivo" em vez de "Regra de Ouro: automatize tarefas").
22. Use o cabeçalho '#' (título) SOMENTE para marcar grandes blocos da aula: no slide de título da aula e ao iniciar uma nova seção/tema com troca drástica de conteúdo (marcação de novo bloco). Nos slides regulares do desenvolvimento, demarque o que se está vendo com o subtítulo '##' (ex.: '## Estrutura while em Python'), não com '#' — evite que cada slide vire um título. NUNCA escreva as palavras 'Subtítulo:' ou 'Título:' em texto corrido. Se a aula percorre várias estruturas/fenômenos (ex.: for, while, do-while), cada um recebe seu próprio slide/sequência demarcado com '##' que nomeie exatamente o elemento, para o aluno saber onde está e o que dominar a cada passo.
23. Use negrito (**texto**) sempre que possível para demarcar as informações mais importantes de cada slide, destacando os pontos-chave que merecem atenção do aluno.
24. Compatibilidade com Dark Mode em HTML/CSS: Os slides suportam alternância entre modo claro e modo escuro (dark mode), o que altera as cores do slide (fundo, textos e bordas). Ao gerar elementos em HTML/CSS customizados, considere sempre essas alterações de tema: defina pares contrastantes explícitos de fundo e texto ou use as variáveis de tema (como var(--text-primary), var(--text-secondary), var(--slide-bg), var(--border)) para garantir que o HTML interno não fique invisível nem sofra perda de contraste ao alternar para o dark mode.
</REGRAS>`;

  let writerUserPrompt = `TEMA / ASSUNTO DA AULA: ${tema}\n\n`;
  if (outlineResult) writerUserPrompt += `OUTLINE ESTRUTURAL PLANEJADO:\n${outlineResult}\n\n`;
  if (observacoes) writerUserPrompt += `OBSERVAÇÕES DO PROFESSOR: ${observacoes}\n\n`;
  if (aulasContexto) writerUserPrompt += `AULAS ANTERIORES DE REFERÊNCIA:\n\n${aulasContexto}\n\n`;
  if (docsContexto) writerUserPrompt += `DOCUMENTOS ORIENTADORES:\n\n${docsContexto}\n\n`;
  writerUserPrompt += 'Gere a aula completa no formato Marp Next Markdown seguindo rigorosamente o outline e as instruções. Responda APENAS com o markdown da aula, sem nenhum texto introdutório ou explicativo.';

  try {
    const messages: AiMessage[] = [
      { role: 'system', content: MARP_SYSTEM_PROMPT },
      { role: 'user', content: writerUserPrompt },
    ];
    const result = await callAi({
      messages,
      temperature: 0.55,
      timeoutMs: 180000,
      task: 'aula',
      validate: (conteudoUnico) => normalizeMarpMarkdown(conteudoUnico).includes('---'),
    });
    content = result.content;
    modeloUtilizado = result.modelUsed || modeloUtilizado;
  } catch (e: any) {
    throw new Error(`Falha na expansão de slides com IA: ${e.message || 'Erro de conexão/timeout'}`);
  }
  }

  if (isCancelled?.()) throw new Error('Job cancelado pelo usuário');

  await checkpoint?.('85% - Expandindo slides e diagramas Marp...', { fase: 'slides' });

  if (isCancelled?.()) throw new Error('Job cancelado pelo usuário');

  // FASE 3: Validação & Limpeza
  const cleaned = normalizeMarpMarkdown(content);

  if (!cleaned || !cleaned.includes('---')) {
    throw new Error('A IA não retornou Markdown Marp válido');
  }

  const titulo_sugerido = outline
    ? outline.titulo.trim()
    : (cleaned.match(/^---[\s\S]*?title:\s*(.+)/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '') || tema || 'Nova Aula');

  return {
    success: true,
    conteudo_md: cleaned,
    titulo_sugerido,
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
