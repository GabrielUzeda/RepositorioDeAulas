import { Hono, type Context } from 'hono';
import { professorAuth } from './auth';
import { db } from './db';
import { decryptData } from './utils';

const aiRouter = new Hono();

const NINE_ROUTER_URL = process.env.NINE_ROUTER_URL || 'http://127.0.0.1:20128/v1';
const NINE_ROUTER_API_KEY = process.env.NINE_ROUTER_API_KEY || 'sk_local_9r';

const OPENCODE_API_KEY = process.env.OPENCODE_API_KEY || '';
const OPENCODE_BASE_URL = process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/go/v1';
const OPENCODE_DEFAULT_MODEL = process.env.OPENCODE_MODEL || 'deepseek-v4.1-flash';
const OPENCODE_UA = process.env.OPENCODE_UA || 'opencode/1.18.30';

function opencodeHeaders(): Record<string, string> {
  const rid = () => crypto.randomUUID().replace(/-/g, '');
  return {
    'User-Agent': OPENCODE_UA,
    'x-opencode-client': 'cli',
    'x-opencode-project': 'global',
    'x-opencode-session': `ses_${rid()}`,
    'x-opencode-request': `msg_${rid()}`,
    'x-request-id': `req_${rid()}`,
  };
}

async function fetchFromOpenCode(endpoint: string, options: RequestInit = {}) {
  if (!OPENCODE_API_KEY) throw new Error('OPENCODE_API_KEY not configured');
  const headers = new Headers(opencodeHeaders());
  new Headers(options.headers || {}).forEach((value, key) => headers.set(key, value));
  headers.set('Authorization', `Bearer ${OPENCODE_API_KEY}`);
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
  return fetch(`${OPENCODE_BASE_URL}${endpoint}`, { ...options, headers });
}

export interface ModelCapability {
  vision?: boolean;
  reasoning?: boolean;
  contextWindow?: number;
  maxOutput?: number;
  upstreamProvider?: string;
}

export interface AiModelItem {
  id: string;
  owned_by?: string;
  capabilities?: ModelCapability;
  context_length?: number;
  max_completion_tokens?: number;
}

async function fetchFrom9Router(endpoint: string, options: RequestInit = {}) {
  const customUrl = process.env.NINE_ROUTER_URL;
  const baseUrl = customUrl || 'http://127.0.0.1:20128/v1';
  const cleanBase = baseUrl.replace(/\/v1\/?$/, '');
  const url = endpoint.startsWith('http') ? endpoint : `${cleanBase}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${NINE_ROUTER_API_KEY}`);
  }
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  // Se estiver usando URL default 127.0.0.1, usa timeout inicial de 1.5s para fallback rápido no Docker dev
  const isDefaultLocal = !customUrl && url.includes('127.0.0.1:20128');
  const initialSignal = isDefaultLocal ? AbortSignal.timeout(1500) : options.signal;

  try {
    return await fetch(url, {
      ...options,
      headers,
      signal: initialSignal,
    });
  } catch (err) {
    if (isDefaultLocal) {
      const fallbackUrl = url.replace('127.0.0.1:20128', 'host.docker.internal:20128');
      try {
        return await fetch(fallbackUrl, {
          ...options,
          headers,
          signal: options.signal || AbortSignal.timeout(4000),
        });
      } catch {}
    }
    throw err;
  }
}

aiRouter.get('/health', professorAuth, async (c) => {
  try {
    const res = await fetchFrom9Router('/api/health', {
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({ ok: true }));
      return c.json({ ok: true, status: 'online', data });
    }
    return c.json({ ok: false, status: 'degraded', error: `HTTP ${res.status}` }, 502);
  } catch (e: any) {
    return c.json({ ok: false, status: 'offline', error: e.message || '9router unreachable' }, 503);
  }
});

aiRouter.get('/models', professorAuth, async (c) => {
  try {
    const res = await fetchFrom9Router('/v1/models', {
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) {
      return c.json({ success: false, error: `9router returned HTTP ${res.status}` }, 502);
    }
    const body = (await res.json()) as { data?: AiModelItem[] };
    const rawModels: AiModelItem[] = Array.isArray(body?.data) ? body.data : [];
    
    const formatted = rawModels.map((m) => ({
      id: m.id,
      name: m.id.split('/').pop() || m.id,
      provider: m.id.includes('/') ? m.id.split('/')[0] : (m.owned_by || 'other'),
      reasoning: !!m.capabilities?.reasoning,
      vision: !!m.capabilities?.vision,
      contextWindow: m.capabilities?.contextWindow || m.context_length || 0,
      maxOutput: m.capabilities?.maxOutput || m.max_completion_tokens || 0,
    }));

    return c.json({ success: true, models: formatted });
  } catch (e: any) {
    return c.json({ success: false, error: e.message || 'Failed to fetch models from 9router' }, 503);
  }
});

aiRouter.get('/opencode/health', professorAuth, async (c) => {
  if (!OPENCODE_API_KEY) {
    return c.json({ ok: false, status: 'unconfigured', error: 'OPENCODE_API_KEY não configurada' }, 503);
  }
  try {
    const res = await fetchFromOpenCode('/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model: OPENCODE_DEFAULT_MODEL,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
    });
    if (res.ok) {
      return c.json({ ok: true, status: 'online', model: OPENCODE_DEFAULT_MODEL, baseUrl: OPENCODE_BASE_URL });
    }
    const detail = await res.text().catch(() => '');
    const status = res.status === 401 ? 'unauthorized' : 'degraded';
    return c.json({ ok: false, status, error: `HTTP ${res.status}`, detail: detail.slice(0, 300) }, 502);
  } catch (e: any) {
    return c.json({ ok: false, status: 'offline', error: e.message || 'OpenCode unreachable' }, 503);
  }
});

aiRouter.get('/opencode/models', professorAuth, async (c) => {
  if (!OPENCODE_API_KEY) {
    return c.json({ success: false, error: 'OPENCODE_API_KEY não configurada' }, 503);
  }
  try {
    const res = await fetchFromOpenCode('/models', {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return c.json({ success: false, error: `OpenCode returned HTTP ${res.status}` }, 502);
    }
    const body = (await res.json()) as { data?: AiModelItem[] };
    const rawModels: AiModelItem[] = Array.isArray(body?.data) ? body.data : [];

    return c.json({
      success: true,
      defaultModel: OPENCODE_DEFAULT_MODEL,
      models: rawModels.map((m) => ({
        id: m.id,
        name: m.id,
        provider: m.owned_by || 'opencode-go',
        contextWindow: m.capabilities?.contextWindow || m.context_length || 0,
        maxOutput: m.capabilities?.maxOutput || m.max_completion_tokens || 0,
      })),
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message || 'Failed to fetch models from OpenCode' }, 503);
  }
});

aiRouter.post('/opencode/chat', professorAuth, async (c) => {
  if (!OPENCODE_API_KEY) {
    return c.json({ success: false, error: 'OPENCODE_API_KEY não configurada' }, 503);
  }
  let body: { messages?: { role: string; content: string }[]; model?: string; temperature?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'JSON inválido' }, 400);
  }
  if (!Array.isArray(body?.messages) || body.messages.length === 0) {
    return c.json({ success: false, error: 'messages é obrigatório' }, 400);
  }
  try {
    const res = await fetchFromOpenCode('/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        model: body.model || OPENCODE_DEFAULT_MODEL,
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        stream: false,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return c.json({ success: false, error: `OpenCode returned HTTP ${res.status}`, detail: detail.slice(0, 500) }, 502);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string; reasoning_content?: string } }[];
      usage?: unknown;
    };
    const choice = data.choices?.[0];
    if (!choice?.message) {
      return c.json({ success: false, error: 'Resposta inesperada do OpenCode (sem choices)' }, 502);
    }
    return c.json({
      success: true,
      model: body.model || OPENCODE_DEFAULT_MODEL,
      content: choice.message.content || '',
      reasoning: choice.message.reasoning_content || '',
      usage: data.usage ?? null,
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message || 'OpenCode unreachable' }, 503);
  }
});

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
    modelo = 'qwenproxy/qwen3.8-max-thinking',
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
    return c.json({ success: false, error: 'Informe um tema, título ou selecione ao menos uma aula para contextualizar' }, 400);
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
      aulas = db.query(query).all(aulasIdsJson) as { id: number; titulo: string; conteudo_md: string }[];
    } else {
      const query = `
        SELECT a.id, a.titulo, a.conteudo_md 
        FROM aulas a
        JOIN disciplinas d ON a.disciplina_id = d.id
        JOIN curso_professores cp ON d.curso_id = cp.curso_id
        WHERE cp.professor_id = ? AND a.id IN (SELECT value FROM json_each(?))
        ORDER BY a.ordem ASC
      `;
      aulas = db.query(query).all(professorId, aulasIdsJson) as { id: number; titulo: string; conteudo_md: string }[];
    }
    
    if (aulas.length > 0) {
      aulasContexto = aulas
        .map((a, idx) => `--- AULA ${idx + 1}: ${a.titulo} ---\n${(a.conteudo_md || '').slice(0, 15000)}`)
        .join('\n\n');
    }
  }

  let docsContexto = '';
  let targetDisciplinaId = disciplina_id ? Number(disciplina_id) : null;
  if (!targetDisciplinaId && targetAulasIds.length > 0) {
    const row = db.query('SELECT disciplina_id FROM aulas WHERE id = ?').get(targetAulasIds[0]) as any;
    if (row?.disciplina_id) targetDisciplinaId = row.disciplina_id;
  }

  if (targetDisciplinaId) {
    const discRow = db.query('SELECT curso_id FROM disciplinas WHERE id = ?').get(targetDisciplinaId) as any;
    const targetCursoId = discRow?.curso_id ? Number(discRow.curso_id) : null;

    const docs = db.query(`
      SELECT titulo, tipo, conteudo_texto 
      FROM documentos_orientadores 
      WHERE disciplina_id = ? OR (curso_id = ? AND disciplina_id IS NULL)
      ORDER BY id ASC
    `).all(targetDisciplinaId, targetCursoId) as { titulo: string; tipo: string; conteudo_texto: string }[];

    if (docs.length > 0) {
      docsContexto = docs
        .map((d, idx) => `--- DOCUMENTO ORIENTADOR ${idx + 1} (${d.tipo.toUpperCase()}): ${d.titulo} ---\n${(d.conteudo_texto || '').slice(0, 5000)}`)
        .join('\n\n');
    }
  }

  const isDiscursive = tipo === 'normal' || tipo === 'prova';

  const tipoInstrucao: Record<string, string> = {
    normal: 'Atividade Discursiva (Normal): Crie questões abertas e dissertativas. NÃO gere alternativas. Cada questão deve ter apenas um enunciado claro que o aluno responderá com texto livre.',
    prova: 'Prova Discursiva: Crie questões dissertativas formais e rigorosas, sem alternativas. Cada questão deve exigir uma resposta elaborada e contextualizada do aluno.',
    minigame: 'Minigame de Naves: Questões com enunciado direto e objetivo, com 4 alternativas curtas. NÃO inclua feedbacks nas alternativas (apenas text e correct).',
    roleta: 'Roleta do Conhecimento: Perguntas instigantes e dinâmicas de múltipla escolha com 4 alternativas e feedback explicativo.',
    reforco: 'Reforço Pedagógico: Questões formativas com 4 alternativas, onde cada alternativa incorreta explica claramente o equívoco no feedback pedagógico para auxiliar a fixação.'
  };

  const selectedTipoInstrucao = tipoInstrucao[tipo] || tipoInstrucao.normal;

  const formatoJson = isDiscursive
    ? `{
  "questions": [
    {
      "title": "Conceito Central / Tópico Abordado",
      "content": "Enunciado claro e detalhado da questão dissertativa aqui..."
    }
  ]
}`
    : tipo === 'minigame'
    ? `{
  "questions": [
    {
      "title": "Conceito Central / Tópico Abordado",
      "content": "Enunciado direto e objetivo da questão aqui...",
      "options": [
        { "text": "Alternativa A", "correct": true },
        { "text": "Alternativa B", "correct": false },
        { "text": "Alternativa C", "correct": false },
        { "text": "Alternativa D", "correct": false }
      ]
    }
  ]
}`
    : `{
  "questions": [
    {
      "title": "Conceito Central / Tópico Abordado",
      "content": "Enunciado claro e detalhado da questão aqui...",
      "options": [
        { "text": "Texto da alternativa A", "correct": true, "feedback": "Justificativa pedagógica" },
        { "text": "Texto da alternativa B", "correct": false, "feedback": "Justificativa pedagógica" },
        { "text": "Texto da alternativa C", "correct": false, "feedback": "Justificativa pedagógica" },
        { "text": "Texto da alternativa D", "correct": false, "feedback": "Justificativa pedagógica" }
      ]
    }
  ]
}`;

  const systemPrompt = `Você é um assistente pedagógico de elite para professores do ensino técnico e superior.
Sua missão é gerar atividades avaliativas interativas de alta qualidade com base no conteúdo das aulas ministradas pelo professor.

DIRETRIZES FUNDAMENTAIS:
1. Mantenha todas as questões estritamente alinhadas ao conteúdo, conceitos, nomenclaturas e exemplos fornecidos no contexto das aulas.
2. Não invente conceitos fora do escopo do material didático fornecido.
3. Se observações específicas do professor forem passadas, siga-as com prioridade.
4. Tipo de Atividade solicitada: "${tipo}" (${selectedTipoInstrucao}).
5. Crie exatamente ${quantidade} questões.
6. A resposta DEVE ser estritamente um objeto JSON válido no formato especificado, sem blocos de código Markdown ao redor, sem texto antes ou depois.
7. DIRETRIZ OBRIGATÓRIA DE NOMENCLATURA: O campo "title" de cada questão DEVE conter o TEMA ou CONCEITO ESPECÍFICO avaliado (ex: "Declaração de Variáveis e Tipagem", "Recursão e Pilha de Chamadas", "Tratamento de Exceções em Python"). NUNCA use "Questão 1", "Questão 2", "Pergunta 1" ou títulos genéricos vazios.
${isDiscursive ? '8. IMPORTANTE: questões discursivas NÃO possuem alternativas. Gere apenas "title" e "content" por questão.' : ''}

FORMATO JSON OBRIGATÓRIO:
${formatoJson}`;

  let userPrompt = `TEMA PRINCIPAL: ${tema || titulo || 'Conteúdo das aulas fornecidas'}\n`;
  if (titulo) userPrompt += `TÍTULO DA ATIVIDADE: ${titulo}\n`;
  if (observacoes) userPrompt += `OBSERVAÇÕES DO PROFESSOR: ${observacoes}\n`;
  userPrompt += `QUANTIDADE DE QUESTÕES: ${quantidade}\n`;

  if (aulasContexto) {
    userPrompt += `\nCONTEÚDO DAS AULAS VINCULADAS:\n${aulasContexto}\n`;
  } else {
    userPrompt += `\n(Gere as questões com base no tema informado, mantendo rigor técnico e pedagógico.)\n`;
  }

  if (docsContexto) {
    userPrompt += `\nDOCUMENTOS ORIENTADORES DA DISCIPLINA (EMENTA / PLANO DE ENSINO / DIRETRIZES):\n${docsContexto}\n`;
  }

  if (Array.isArray(questoes_existentes) && questoes_existentes.length > 0) {
    userPrompt += `\nQUESTÕES JÁ EXISTENTES NESTA ATIVIDADE (É EXPRESSAMENTE PROIBIDO REPETIR ESTES ENUNCIADOS OU CONCEITOS):\n`;
    questoes_existentes.forEach((q: { title?: string; content?: string }, i: number) => {
      userPrompt += `${i + 1}. [${q.title || ''}] ${q.content || ''}\n`;
    });
    userPrompt += `\nGere ${quantidade} novas questões INÉDITAS, que complementem o aprendizado sem sobrepor o que já foi perguntado acima.\n`;
  }

  userPrompt += `\nGere as ${quantidade} questões no formato JSON especificado.`;

  // Fallback prioritário de modelos:
  // 1. DeepSeek V4 Flash (rápido e direto)
  // 2. Qwen 3.7 Plus (qualidade e raciocínio)
  // 3. Gemini 3.7 Flash Low (estável e rápido)
  const candidateModels = [
    'ag/gemini-3.7-flash-low',
    'qwenproxy/qwen3.8-max-thinking',
    'ocg/deepseek-v4-flash',
    'qwenproxy/qwen3.7-plus',
    'deepseek-v4-flash',
    'kimchi/deepseek-v4-flash',
    'ocg/qwen3.7-plus',
  ];

  const modelsToTry = modelo && !candidateModels.includes(modelo)
    ? [modelo, ...candidateModels]
    : candidateModels;

  let lastError = 'Nenhum provedor de IA respondeu com sucesso';
  let successfulResponse: { questions: any[]; modelo: string } | null = null;

  const atividadeTempoInicio = Date.now();
  const ATIVIDADE_TIMEOUT_GERAL_MS = 600000;

  for (const currentModel of modelsToTry) {
    const tempoDecorrido = Date.now() - atividadeTempoInicio;
    if (tempoDecorrido >= ATIVIDADE_TIMEOUT_GERAL_MS) break;
    try {
      const aiResponse = await fetchFrom9Router('/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: currentModel,
          stream: false,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3
        }),
        signal: AbortSignal.timeout(Math.min(180000, ATIVIDADE_TIMEOUT_GERAL_MS - tempoDecorrido))
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text().catch(() => '');
        lastError = `[${currentModel}] HTTP ${aiResponse.status}: ${errText.slice(0, 150)}`;
        continue;
      }

      const rawText = await aiResponse.text();
      let content = '';

      // 1. Tenta parse direto de JSON
      try {
        const aiData = JSON.parse(rawText);
        if (aiData?.error) {
          lastError = `[${currentModel}] ${aiData.error.message || JSON.stringify(aiData.error)}`;
          continue;
        }
        if (aiData?.choices?.[0]?.message?.content) {
          content = aiData.choices[0].message.content;
        }
      } catch {}

      // 2. Se não encontrou, processa chunks de SSE linha por linha
      if (!content) {
        const lines = rawText.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:') && !trimmed.includes('[DONE]')) {
            const jsonPart = trimmed.replace(/^data:\s*/, '');
            try {
              const parsed = JSON.parse(jsonPart);
              if (parsed?.choices?.[0]?.message?.content) {
                content = parsed.choices[0].message.content;
              } else if (parsed?.choices?.[0]?.delta?.content) {
                content += parsed.choices[0].delta.content;
              }
            } catch {}
          }
        }
      }

      // 3. Fallback: regex caso haja JSON bruto envolvido por marcadores
      if (!content) {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const aiData = JSON.parse(jsonMatch[0]);
            content = aiData?.choices?.[0]?.message?.content || '';
          } catch {
            content = '';
          }
        }
      }

      let parsedQuestions: any[] = [];
      try {
        const cleanJson = content
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();
        const parsed = JSON.parse(cleanJson);
        parsedQuestions = Array.isArray(parsed?.questions) ? parsed.questions : (Array.isArray(parsed) ? parsed : []);
      } catch {
        const objMatch = content.match(/\{[\s\S]*\}/);
        if (objMatch) {
          try {
            const parsed = JSON.parse(objMatch[0]);
            parsedQuestions = Array.isArray(parsed?.questions) ? parsed.questions : (Array.isArray(parsed) ? parsed : []);
          } catch {}
        }
        if (parsedQuestions.length === 0) {
          const arrMatch = content.match(/\[[\s\S]*\]/);
          if (arrMatch) {
            try {
              const parsed = JSON.parse(arrMatch[0]);
              if (Array.isArray(parsed)) parsedQuestions = parsed;
            } catch {}
          }
        }
      }

      if (parsedQuestions.length > 0) {
        successfulResponse = {
          questions: parsedQuestions,
          modelo: currentModel,
        };
        break;
      } else {
        lastError = `[${currentModel}] Resposta retornada sem formato JSON esperado.`;
      }
    } catch (e: any) {
      lastError = `[${currentModel}] ${e.message || 'Erro de conexão/timeout'}`;
    }
  }

  if (!successfulResponse) {
    return c.json({
      success: false,
      error: `Falha na geração com IA em todos os provedores: ${lastError}`,
    }, 502);
  }

  const normalizedQuestions = successfulResponse.questions.map((q: any, index: number) => {
    const result: any = {
      title: String(q.title || `Questão ${index + 1}`),
      content: String(q.content || q.enunciado || q.pergunta || '').trim(),
    };

    if (!isDiscursive) {
      const rawOptions = Array.isArray(q.options) ? q.options : (Array.isArray(q.alternativas) ? q.alternativas : []);
      const options = rawOptions.map((opt: any) => ({
        text: String(opt.text || opt.label || opt.opcao || '').trim(),
        correct: Boolean(opt.correct || opt.isCorrect || opt.correta),
        feedback: tipo === 'minigame' ? '' : String(opt.feedback || opt.justificativa || '').trim()
      }));

      const hasCorrect = options.some((o: any) => o.correct);
      if (!hasCorrect && options.length > 0) {
        options[0].correct = true;
      }

      if (options.length > 0) {
        result.options = options;
      }
    }

    return result;
  });

  return c.json({
    success: true,
    questions: normalizedQuestions,
    modelo_utilizado: successfulResponse.modelo,
    total_gerado: normalizedQuestions.length
  });
});

aiRouter.post('/generate-aula', professorAuth, async (c) => {
  const professorId = Number(c.get('professorId'));
  const professorRole = c.get('professorRole') || 'professor';
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'JSON inválido' }, 400);
  }

  const {
    modelo,
    disciplina_id,
    tema = '',
    aulas_contexto_ids = [],
    continuar_sequencia = false,
    observacoes = '',
  } = body;

  const targetAulasIds: number[] = Array.isArray(aulas_contexto_ids)
    ? aulas_contexto_ids.map(Number).filter(Boolean)
    : [];

  if (continuar_sequencia && disciplina_id) {
    let ultimaAula: { id: number } | undefined;
    if (professorRole === 'admin') {
      ultimaAula = db.query(
        `SELECT a.id FROM aulas a WHERE a.disciplina_id = ? ORDER BY a.ordem DESC LIMIT 1`
      ).get(disciplina_id) as { id: number } | undefined;
    } else {
      ultimaAula = db.query(
        `SELECT a.id FROM aulas a
         JOIN disciplinas d ON a.disciplina_id = d.id
         JOIN curso_professores cp ON d.curso_id = cp.curso_id
         WHERE cp.professor_id = ? AND a.disciplina_id = ?
         ORDER BY a.ordem DESC LIMIT 1`
      ).get(professorId, disciplina_id) as { id: number } | undefined;
    }
    if (ultimaAula && !targetAulasIds.includes(ultimaAula.id)) {
      targetAulasIds.push(ultimaAula.id);
    }
  }

  if (!tema && targetAulasIds.length === 0) {
    return c.json({ success: false, error: 'Informe um tema ou selecione aulas de referência para contextualizar a geração' }, 400);
  }

  let aulasContexto = '';
  if (targetAulasIds.length > 0) {
    const aulasIdsJson = JSON.stringify(targetAulasIds);
    let aulas: { id: number; titulo: string; conteudo_md: string; ordem: number }[] = [];

    if (professorRole === 'admin') {
      aulas = db.query(
        `SELECT a.id, a.titulo, a.conteudo_md, a.ordem FROM aulas a WHERE a.id IN (SELECT value FROM json_each(?)) ORDER BY a.ordem ASC`
      ).all(aulasIdsJson) as { id: number; titulo: string; conteudo_md: string; ordem: number }[];
    } else {
      aulas = db.query(
        `SELECT a.id, a.titulo, a.conteudo_md, a.ordem FROM aulas a
         JOIN disciplinas d ON a.disciplina_id = d.id
         JOIN curso_professores cp ON d.curso_id = cp.curso_id
         WHERE cp.professor_id = ? AND a.id IN (SELECT value FROM json_each(?))
         ORDER BY a.ordem ASC`
      ).all(professorId, aulasIdsJson) as { id: number; titulo: string; conteudo_md: string; ordem: number }[];
    }

    if (aulas.length > 0) {
      aulasContexto = aulas
        .map((a, idx) => `--- AULA DE REFERÊNCIA ${idx + 1}: ${a.titulo} ---\n${(a.conteudo_md || '').slice(0, 18000)}`)
        .join('\n\n');
    }
  }

  const MARP_SYSTEM_PROMPT = `<INSTRUCOES>
Você é um especialista em didática, design instrucional e metodologias de ensino inclusivo para adolescentes e adultos.
Você é ótimo combinando clareza formal com narrativas, analogias e educação preventiva.
Sua tarefa é gerar conteúdo didático no formato do motor Marp Next a partir de um tema.
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
</REGRAS>

<PRINCIPIOS_PEDAGOGICOS_REFERENCIA>
Fundamento didático para aprimorar a qualidade pedagógica da aula:
- ABERTURA FREIRIANA obrigatória: os primeiros slides (antes de qualquer conceito técnico) devem partir do mundo vivido do aluno. Use uma história curta, analogia ou situação cotidiana concreta que responda de forma autossuficiente às perguntas "por que isso existe?", "qual problema resolve?", "para que vou usar isso?". O aluno não deve chegar ao conteúdo técnico com essas dúvidas em aberto.
- Construção linear e acumulativa: a aula é uma escada — cada degrau apoia-se exclusivamente nos anteriores. Não cite conceito antes de construí-lo. Não pule etapas. Não pressuponha conhecimento que ainda não foi apresentado nesta aula.
- Checagem de pré-requisitos antes de cada conteúdo novo: pergunte-se "o que é necessário de conhecimento prévio para entender este conteúdo?" e "isso já foi dado nas aulas passadas relacionadas?". Se sim, recapture a base em um slide de conexão antes do tema novo (ex.: ensinar laços de repetição exige um contexto bom de índices; recupere índices brevemente antes de falar de loops). A aula nova se apoia nas anteriores sem repeti-las.
- Coloque o estudante no centro do processo: além de expor conteúdo, proponha situações em que ele constrói o conhecimento — problemas, casos, perguntas reflexivas.
- Parta do "aqui e agora" e do saber prévio do aluno: conecte cada conceito novo a algo que o aluno já conhece ou vive no cotidiano, usando exemplos reais antes do formalismo.
- Progressão do concreto ao abstrato e do cotidiano ao científico: apoie a explicação formal em analogias e situações concretas; facilite a transição para a notação/simbolismo quando pertinente.
- Use estratégias ativas integradas ao expositivo: perguntas que provoquem reflexão e transferência para a vida real ao longo dos slides, não só no fim.
- Contextualização à generalização: ancore o conhecimento poderoso em fenômenos do cotidiano e da realidade do aluno; favoreça conexões cognitivas e emocionais com o que já é relevante para ele.
- Aprendizagem significativa: relacione cada tópico ao que o aluno já sabe; proponha perguntas e verificações ao longo da aula para engajar a curiosidade e fixar o aprendizado.
- Antecipe erros comuns e armadilhas típicas do tema em slide(s) dedicado(s), explicando por que ocorrem e como evitá-los — sem nomeá-los como "Erros Comuns", integre-os naturalmente.
- Linguagem inclusiva e acessível: clareza formal sem infantilização, adaptável a adolescentes e adultos.
</PRINCIPIOS_PEDAGOGICOS_REFERENCIA>

<ESTRUTURA_OBRIGATORIA>
A aula é uma CONSTRUÇÃO PROGRESSIVA. Cada seção prepara o terreno para a próxima. Nunca apresse. Nunca salte etapas. O total mínimo é 14 slides (excluindo fixação e material complementar).

1. Slide de título — '#' título e '##' subtítulo contextual (use cabeçalhos Markdown, nunca as palavras "Título:"/"Subtítulo:" em texto corrido).

2. Abertura contextual (1 a 2 slides) — SEM nenhum termo técnico ainda. Use analogia ou situação do cotidiano que responda "por que esse assunto existe?", "qual problema resolve no mundo real?", "onde o aluno vai encontrar isso?". O objetivo é criar vínculo emocional e motivacional com o tema antes de qualquer definição.

3. Objetivos da aula (1 slide) — lista de bullets curtos e mensuráveis do que o aluno será capaz de fazer ao final, em linguagem de resultado prático (ex.: "Diferenciar os mecanismos de repetição condicionada e contada."). Sem jargão acadêmico; foque em competências concretas.

3b. Recapitulação de pré-requisitos (1 slide, SOMENTE se houver aulas anteriores fornecidas como referência) — antes de apresentar o conteúdo novo, identifique o conhecimento prévio necessário para entender esta aula ("o que eu preciso já saber para aprender isso?"). Se esse conhecimento já foi dado nas aulas anteriores relacionadas, faça um recapitulação breve e objetiva (um slide) desse pré-requisito, usando linguagem que conecte: "lembrando o que já vimos em [tema anterior]...". NÃO repita o conteúdo integral; apenas recapture a base necessária para o novo assunto se apoiar nela.

4. Desenvolvimento linear — mínimo de 10 slides, um conceito ou mecanismo por slide:
   - Cada slide introduz APENAS um novo elemento.
   - Conceitos mais simples primeiro; complexidade cresce gradualmente.
   - Use exemplos práticos, analogias, diagramas (Mermaid), código comentado, HTML/CSS animado quando ilustrativo.
   - Inclua perguntas de reflexão ao longo do desenvolvimento (não só no fim).
   - Quando pertinente, dedique um slide a armadilhas e erros comuns ligados ao conceito recém-apresentado.

5. Aplicação prática / estudo de caso (1 a 2 slides) — mostre o conteúdo completo funcionando em um contexto real ou próximo do real. O aluno deve ver "o todo" depois de ter aprendido "as partes".

5b. Reflexão (1 slide) — 2 a 3 perguntas abertas e provocativas que conectem o conteúdo ao mundo do aluno (ex.: "Pense em uma tarefa repetitiva do seu dia a dia: como você descreveria ao computador o momento exato de parar?"). Diferente das perguntas de fixação (que checam compreensão técnica), a reflexão convida o aluno a transferir o conhecimento para a própria experiência.

6. Síntese visual (1 slide) — resumo do caminho percorrido, diagrama ou tabela unindo os conceitos.

7. Verifique o que você aprendeu (1 slide) — 3 a 5 perguntas reflexivas de fixação do conteúdo.

8. Material Complementar (1 slide) — livros, documentações e links de referência para aprofundamento.
</ESTRUTURA_OBRIGATORIA>

<FERRAMENTAS_DISPONIVEIS>
- KaTeX: fórmulas matemáticas ($...$ inline, $$...$$ bloco)
- Mermaid: diagramas de fluxo, sequência, ER, Gantt (bloco mermaid; slides em paisagem com espaço vertical limitado — prefira diagramas mais largos que altos, fluxo achatado/horizontal, evitando gráficos que estourem a altura do slide)
- HTML/CSS/JS inline: pode usar HTML + <style> + <script> embutidos nos slides para exemplos ilustrativos vivos. RECOMENDAÇÃO: ouse criar animações didáticas quando elas ajudarem a visualizar mecanismos dinâmicos (ex.: destacar iterativamente cada item de um vetor com caixas que "acendem" em sequência via @keyframes com animation-delay escalonado, simulando o passo a passo de um laço/percurso). Padrão de referência para animar "leitura sequencial" de um vetor:

<div style="text-align:center"><div class="index-grid">
  <div class="index-box scanner-1"><div class="box-index">ÍNDICE 0</div><div class="box-value">A</div></div>
  <div class="index-box scanner-2"><div class="box-index">ÍNDICE 1</div><div class="box-value">B</div></div>
  <div class="index-box scanner-3"><div class="box-index">ÍNDICE 2</div><div class="box-value">C</div></div>
  <div class="index-box scanner-4"><div class="box-index">ÍNDICE 3</div><div class="box-value">D</div></div>
</div></div>
<style>
  .index-grid{display:flex;gap:20px;justify-content:center;margin:30px 0}
  .index-box{width:110px;height:130px;border:2px solid #ced4da;border-radius:12px;display:flex;flex-direction:column;overflow:hidden;font-family:monospace;background:#f8f9fa;transition:all .3s ease}
  .box-index{background:#343a40;color:#fff;padding:8px;font-weight:bold;text-align:center;font-size:.9em;letter-spacing:1px}
  .box-value{flex:1;display:flex;align-items:center;justify-content:center;font-size:2.5em}
  @keyframes loopScanner{0%,15%{background-color:#0d6efd;border-color:#0d6efd;transform:scale(1.08);box-shadow:0 0 20px rgba(13,110,253,.6)}16%,100%{background-color:#f8f9fa;border-color:#ced4da;transform:scale(1);box-shadow:none}}
  .scanner-1{animation:loopScanner 5s infinite;animation-delay:0s}
  .scanner-2{animation:loopScanner 5s infinite;animation-delay:1.25s}
  .scanner-3{animation:loopScanner 5s infinite;animation-delay:2.5s}
  .scanner-4{animation:loopScanner 5s infinite;animation-delay:3.75s}
</style>

Tome liberdade de adaptar cores, tamanhos e delays ao contexto. Importar bibliotecas externas via CDN também é permitido e recomendável quando derem animações mais sofisticadas — ex.: GSAP (https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js) para animações sincronizadas e Lottie (https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js) para ilustrações animadas em JSON — sempre via <script src>. Mantenha as animações simples, robustas a replay e que não dependam de interação do usuário para provocar o efeito (o slide deve se explicar sozinho em loop). IMPORTANTE: Considere sempre as alterações de cores do dark mode nos slides; garanta que elementos HTML internos possuam contraste adequado tanto no tema claro quanto no escuro (definindo pares explícitos de background/color ou utilizando variáveis CSS do slide).
- Tabelas Markdown
- Blocos de código com highlight de sintaxe
- Classes Marp: centered, split, invert
- Animações: fade, fade-up, slide-up, zoom-in, flip-y etc (via diretiva: <!-- animation: NOME -->)
</FERRAMENTAS_DISPONIVEIS>

<FRONT_MATTER_PADRAO>
---
theme: default
title: [TÍTULO DA AULA]
animation: fade-up
animation-stagger: 0.12s
animation-duration: 0.5s
---
</FRONT_MATTER_PADRAO>`;

  const candidateModels = [
    'ag/gemini-3.7-flash-low',
    'qwenproxy/qwen3.8-max-thinking',
    'ocg/deepseek-v4-flash',
    'qwenproxy/qwen3.7-plus',
    'deepseek-v4-flash',
    'kimchi/deepseek-v4-flash',
    'ocg/qwen3.7-plus',
  ];

  const modelsToTry = modelo && !candidateModels.includes(modelo)
    ? [modelo, ...candidateModels]
    : candidateModels;

  let userPrompt = '';
  if (tema) userPrompt += `TEMA / ASSUNTO DA AULA: ${tema}\n\n`;
  if (observacoes) userPrompt += `OBSERVAÇÕES DO PROFESSOR (requisitos específicos que DEVEM ser respeitados na geração): ${observacoes}\n\n`;
  if (aulasContexto) {
    userPrompt += `AULAS ANTERIORES DE REFERÊNCIA (NÃO repita este conteúdo; use como base para dar sequência pedagógica sem sobreposição):\n\n${aulasContexto}\n\n`;
  }
  userPrompt += 'Gere a aula completa no formato Marp Next Markdown conforme as instruções. Responda APENAS com o markdown da aula, sem nenhum texto introdutório ou explicativo antes ou depois do bloco de slides.';

  let lastError = 'Nenhum provedor de IA respondeu com sucesso';
  let successResponse: { conteudo_md: string; titulo_sugerido: string; modelo: string } | null = null;

  const aulaTempoInicio = Date.now();
  const AULA_TIMEOUT_GERAL_MS = 600000;

  for (const currentModel of modelsToTry) {
    const tempoDecorrido = Date.now() - aulaTempoInicio;
    if (tempoDecorrido >= AULA_TIMEOUT_GERAL_MS) break;
    try {
      const aiResponse = await fetchFrom9Router('/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: currentModel,
          stream: false,
          messages: [
            { role: 'system', content: MARP_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.55,
        }),
        signal: AbortSignal.timeout(Math.min(180000, AULA_TIMEOUT_GERAL_MS - tempoDecorrido)),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text().catch(() => '');
        lastError = `[${currentModel}] HTTP ${aiResponse.status}: ${errText.slice(0, 150)}`;
        continue;
      }

      const rawText = await aiResponse.text();
      let content = '';

      try {
        const aiData = JSON.parse(rawText);
        if (aiData?.error) {
          lastError = `[${currentModel}] ${aiData.error.message || JSON.stringify(aiData.error)}`;
          continue;
        }
        if (aiData?.choices?.[0]?.message?.content) {
          content = aiData.choices[0].message.content;
        }
      } catch {}

      if (!content) {
        const lines = rawText.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:') && !trimmed.includes('[DONE]')) {
            const jsonPart = trimmed.replace(/^data:\s*/, '');
            try {
              const parsed = JSON.parse(jsonPart);
              if (parsed?.choices?.[0]?.message?.content) {
                content = parsed.choices[0].message.content;
              } else if (parsed?.choices?.[0]?.delta?.content) {
                content += parsed.choices[0].delta.content;
              }
            } catch {}
          }
        }
      }

      const cleaned = content
        .replace(/^```(?:markdown|md)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

      if (cleaned && cleaned.includes('---')) {
        const titleMatch = cleaned.match(/^---[\s\S]*?title:\s*(.+)/m);
        const titulo_sugerido = titleMatch
          ? titleMatch[1].trim().replace(/^['"]|['"]$/g, '')
          : (tema || 'Nova Aula');

        successResponse = { conteudo_md: cleaned, titulo_sugerido, modelo: currentModel };
        break;
      } else {
        lastError = `[${currentModel}] Resposta não contém Markdown Marp válido (sem separadores ---).`;
      }
    } catch (e: any) {
      lastError = `[${currentModel}] ${e.message || 'Erro de conexão/timeout'}`;
    }
  }

  if (!successResponse) {
    return c.json({ success: false, error: `Falha na geração de aula em todos os provedores: ${lastError}` }, 502);
  }

  return c.json({
    success: true,
    conteudo_md: successResponse.conteudo_md,
    titulo_sugerido: successResponse.titulo_sugerido,
    modelo_utilizado: successResponse.modelo,
  });
});

export const EVAL_CANDIDATE_MODELS: readonly string[] = [
  'ocg/deepseek-v4-flash',
  'qwenproxy/qwen3.8-max',
  'qwenproxy/qwen3.7-plus',
  'ag/gemini-3-flash-agent',
  'ag/gemini-3.7-flash-low',
  'qwenproxy/qwen3.8-max-thinking',
  'deepseek-v4-flash',
];

export async function evaluateStudentResponse({
  questao_enunciado,
  resposta_aluno,
  gabarito,
  criterios,
  modelo,
  observacoes,
  severidade = 'moderado',
}: {
  questao_enunciado: string;
  resposta_aluno: string;
  gabarito?: string;
  criterios?: string;
  modelo?: string;
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
      severidadeInstrucao = 'Nível de severidade: BRANDO. Seja encorajador e flexível. Valorize a intenção, raciocínio e conceitos parciais, relevando pequenos desvios de sintaxe, formatação ou pontuação.';
      break;
    case 'rigoroso':
      severidadeInstrucao = 'Nível de severidade: RIGOROSO. Exija precisão conceitual, clareza técnica e rigor na demonstração dos pontos solicitados. Penalize omissões conceituais ou imprecisões.';
      break;
    case 'sistematico':
      severidadeInstrucao = 'Nível de severidade: SISTEMÁTICO. Avalie item a item com método estrito e analítico, pontuando cada aspecto de forma pragmática e fundamentada.';
      break;
    case 'moderado':
    default:
      severidadeInstrucao = 'Nível de severidade: MODERADO. Mantenha um equilíbrio justo entre rigor técnico e acolhimento pedagógico construtivo.';
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
  if (observacoes && observacoes.trim()) userPrompt += `OBSERVAÇÕES DO PROFESSOR:\n${observacoes.trim()}\n\n`;
  userPrompt += `RESPOSTA SUBMETIDA PELO ALUNO:\n${resposta_aluno}`;

  const candidateModels = [...EVAL_CANDIDATE_MODELS];

  const modelsToTry = modelo && candidateModels.includes(modelo)
    ? [modelo, ...candidateModels.filter((m) => m !== modelo)]
    : candidateModels;

  let evaluationResult: any = null;
  let lastError = '';

  for (const currentModel of modelsToTry) {
    try {
      const aiResponse = await fetchFrom9Router('/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: currentModel,
          stream: false,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (!aiResponse.ok) continue;

      const aiData: any = await aiResponse.json();
      let content = aiData?.choices?.[0]?.message?.content || '';
      content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

      const parsed = JSON.parse(content);
      if (typeof parsed.nota_sugerida === 'number' && parsed.feedback) {
        evaluationResult = {
          nota_sugerida: Math.min(100, Math.max(0, Math.round(parsed.nota_sugerida))),
          feedback: String(parsed.feedback).trim(),
          justificativa: String(parsed.justificativa || '').trim(),
          modelo_utilizado: currentModel
        };
        break;
      }
    } catch (e: any) {
      lastError = e.message;
    }
  }

  if (!evaluationResult) {
    throw new Error(`Falha na avaliação por IA: ${lastError || 'Não foi possível obter resposta válida'}`);
  }

  return evaluationResult;
}

aiRouter.post('/evaluate-response', professorAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { questao_enunciado, resposta_aluno, gabarito, criterios, modelo, observacoes, severidade } = body;

  if (!questao_enunciado || !resposta_aluno) {
    return c.json({ success: false, error: 'questao_enunciado e resposta_aluno são obrigatórios.' }, 400);
  }

  try {
    const result = await evaluateStudentResponse({ questao_enunciado, resposta_aluno, gabarito, criterios, modelo, observacoes, severidade });
    return c.json({ success: true, ...result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 502);
  }
});

export async function handleEvaluateActivityResponses(c: Context, forcedAtividadeId?: number) {
  const body = await c.req.json().catch(() => ({}));
  const atividade_id = forcedAtividadeId !== undefined
    ? Number(forcedAtividadeId)
    : Number(body.atividade_id || body.atividadeId);

  if (!atividade_id || isNaN(atividade_id)) {
    return c.json({ success: false, error: 'atividade_id é obrigatório.' }, 400);
  }

  const atv = db.query('SELECT id, disciplina_id, titulo, descricao, json_data FROM atividades WHERE id = ?').get(atividade_id) as any;
  if (!atv) {
    return c.json({ success: false, error: 'Atividade não encontrada.' }, 404);
  }

  const profId = c.get('professorId');
  const profRole = c.get('professorRole');
  if (profRole !== 'admin') {
    const d = db.query('SELECT curso_id FROM disciplinas WHERE id = ?').get(atv.disciplina_id) as any;
    if (!d) return c.text('Access denied', 403);
    const hasPerm = db.query('SELECT 1 FROM curso_professores WHERE curso_id = ? AND professor_id = ?').get(d.curso_id, Number(profId));
    if (!hasPerm) return c.text('Access denied', 403);
  }

  const rows = db.query('SELECT id, respostas, nota, feedback FROM respostas_alunos WHERE atividade_id = ? ORDER BY criado_em ASC').all(atividade_id) as any[];

  if (rows.length === 0) {
    return c.json({
      success: true,
      total: 0,
      avaliados: 0,
      falhas_count: 0,
      sucessos: [],
      falhas: [],
      avaliacoes: []
    });
  }

  let questions: any[] = [];
  if (atv.json_data) {
    try {
      const data = typeof atv.json_data === 'string' ? JSON.parse(atv.json_data) : atv.json_data;
      questions = data.questions || [];
    } catch {}
  }

  const modeloSafe = typeof body.modelo === 'string' && EVAL_CANDIDATE_MODELS.includes(body.modelo)
    ? body.modelo
    : undefined;

  const observacoes = typeof body.observacoes === 'string' ? body.observacoes.trim() : undefined;
  const severidade = typeof body.severidade === 'string' ? body.severidade.trim() : 'moderado';

  const sucessos: any[] = [];
  const falhas: any[] = [];

  const CONCURRENCY = 3;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (row) => {
        try {
          const decryptedRespostas = await decryptData(row.respostas);

          let mapObj: Record<string, unknown> | null = null;
          if (typeof decryptedRespostas === 'string') {
            try {
              const parsed = JSON.parse(decryptedRespostas);
              if (typeof parsed === 'object' && parsed !== null) mapObj = parsed;
            } catch {}
          } else if (typeof decryptedRespostas === 'object' && decryptedRespostas !== null) {
            mapObj = decryptedRespostas;
          }

          let questoesTexto = '';
          let respostasTexto = '';

          if (mapObj) {
            const entries = Object.entries(mapObj);
            questoesTexto = entries.map(([key]) => {
              const qIdx = Number(key);
              const q = !isNaN(qIdx) ? questions[qIdx] : null;
              return `Questão ${isNaN(qIdx) ? key : qIdx + 1}: ${q?.content || q?.title || `Questão ${isNaN(qIdx) ? key : qIdx + 1}`}`;
            }).join('\n\n');
            respostasTexto = entries.map(([key, val], idx) => `Resposta ${idx + 1}: ${String(val)}`).join('\n\n');
          } else {
            questoesTexto = atv.titulo + (atv.descricao ? `\n${atv.descricao}` : '');
            respostasTexto = String(decryptedRespostas || '');
          }

          const evalRes = await evaluateStudentResponse({
            questao_enunciado: questoesTexto || atv.titulo || 'Atividade',
            resposta_aluno: respostasTexto || '(Sem resposta)',
            criterios: atv.descricao || undefined,
            modelo: modeloSafe,
            observacoes,
            severidade
          });

          db.query('UPDATE respostas_alunos SET nota = ?, feedback = ? WHERE id = ?').run(
            evalRes.nota_sugerida,
            evalRes.feedback,
            row.id
          );

          sucessos.push({
            id: row.id,
            nota: evalRes.nota_sugerida,
            feedback: evalRes.feedback,
            justificativa: evalRes.justificativa
          });
        } catch (err: any) {
          falhas.push({
            id: row.id,
            erro: err.message || 'Erro ao avaliar resposta'
          });
        }
      })
    );
  }

  // LGPD: Minimização de dados. Retorna apenas IDs, notas e feedbacks atualizados (sem payload bruto de respostas)
  const updatedRows = db.query('SELECT id, nota, feedback FROM respostas_alunos WHERE atividade_id = ? ORDER BY criado_em DESC').all(atividade_id) as any[];

  return c.json({
    success: true,
    total: rows.length,
    avaliados: sucessos.length,
    falhas_count: falhas.length,
    sucessos,
    falhas,
    avaliacoes: updatedRows
  });
}

aiRouter.post('/evaluate-activity-responses', professorAuth, async (c) => {
  return handleEvaluateActivityResponses(c);
});

aiRouter.post('/synthesize-class-feedback', professorAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { disciplina_nome, total_envios, respostas_resumo, alunos_detalhes, modelo, observacoes, severidade } = body;

  const observacoesLimpo = typeof observacoes === 'string' ? observacoes.trim().slice(0, 2000) : undefined;
  const severidadeSafe = typeof severidade === 'string' ? severidade.trim() : 'moderado';

  let severidadeInstrucao = '';
  switch (severidadeSafe) {
    case 'brando':
      severidadeInstrucao = 'Nível de severidade: BRANDO. Seja acolhedor e encorajador, valorizando o esforço e a participação dos alunos.';
      break;
    case 'rigoroso':
      severidadeInstrucao = 'Nível de severidade: RIGOROSO. Seja criterioso e exigente, destacando omissões conceituais, atividades pendentes e necessidade de maior comprometimento.';
      break;
    case 'sistematico':
      severidadeInstrucao = 'Nível de severidade: SISTEMÁTICO. Analise detalhadamente com método pragmático, objetivo e estruturado item a item.';
      break;
    default:
      severidadeInstrucao = 'Nível de severidade: MODERADO. Mantenha equilíbrio justo entre rigor pedagógico e acolhimento construtivo.';
      break;
  }

  let systemPrompt = `Você é um coordenador pedagógico sênior especializado em síntese avaliativa e devolutiva formativa.
Sua missão é analisar o conjunto de desempenhos, notas e todos os N feedbacks individuais que cada aluno recebeu nas atividades ao longo da disciplina e produzir:
1. Um parecer consolidado para a turma ("feedback_geral", "pontos_fortes", "pontos_atencao").
2. Uma síntese individual e longitudinal para CADA aluno informado ("alunos_sintese"), consolidando os N feedbacks que ele recebeu nas atividades da disciplina para orientar sua evolução pedagógica.

${severidadeInstrucao}

Retorne ESTRITAMENTE um objeto JSON no formato:
{
  "feedback_geral": "Texto fluido e encorajador para ser compartilhado com toda a turma...",
  "pontos_fortes": ["Ponto forte 1", "Ponto forte 2"],
  "pontos_atencao": ["Tópico onde a turma apresentou dúvidas..."],
  "alunos_sintese": [
    {
      "aluno_email": "email@do.aluno",
      "feedback_individual": "Síntese individual personalizada para o aluno, destacando sua progressão através das atividades e sugestões de aprimoramento..."
    }
  ]
}

Regras:
1. O texto geral e os individuais devem ser motivadores, claros e pedagógicos.
2. Na lista "alunos_sintese", gere uma entrada para cada aluno informado com seu respectivo email e feedback_individual sintetizado a partir de seus desempenhos nas atividades.
3. Importante sobre a média e atividades pendentes: a média geral da disciplina considera nota 0 para atividades que a turma realizou mas o aluno NÃO entregou. Se o aluno possuir atividades pendentes/não entregues, mencione isso construtivamente em sua devolutiva individual, incentivando-o a regularizar suas pendências.
4. Responda apenas com o JSON puro sem formatação markdown.`;

  if (observacoesLimpo) {
    systemPrompt += `\n\nOBSERVAÇÕES E DIRETRIZES DO PROFESSOR (DEVEM SER ESTRITAMENTE RESPEITADAS):\n${observacoesLimpo}`;
  }

  let userPrompt = `DISCIPLINA: ${disciplina_nome || 'Geral'}\nTOTAL DE ALUNOS/ENVIOS: ${total_envios || 0}\n`;
  if (observacoesLimpo) {
    userPrompt += `ORIENTAÇÕES DO PROFESSOR: ${observacoesLimpo}\n`;
  }
  userPrompt += `\n`;

  const alunosLista = Array.isArray(alunos_detalhes) && alunos_detalhes.length > 0
    ? alunos_detalhes
    : Array.isArray(respostas_resumo) ? respostas_resumo : [];

  if (alunosLista.length > 0) {
    userPrompt += `HISTÓRICO DE ATIVIDADES E FEEDBACKS POR ALUNO:\n`;
    alunosLista.slice(0, 30).forEach((item: any, idx: number) => {
      const nome = item.aluno_nome || item.aluno || 'Anônimo';
      const email = item.aluno_email || '';
      const emailInfo = email ? ` (${email})` : '';
      const mediaVal = item.media_calculada !== undefined && item.media_calculada !== null
        ? item.media_calculada
        : (item.media !== undefined && item.media !== null ? item.media : (item.nota !== undefined ? item.nota : null));
      const media = mediaVal !== null ? ` | Média Geral da Disciplina: ${mediaVal}/100` : '';
      userPrompt += `\n[ALUNO ${idx + 1}] ${nome}${emailInfo}${media}:\n`;
      if (Array.isArray(item.atividades) && item.atividades.length > 0) {
        item.atividades.forEach((atv: any, atvIdx: number) => {
          const notaStr = atv.nota !== null && atv.nota !== undefined ? `Nota: ${atv.nota}/100` : 'Sem nota';
          const feedStr = atv.feedback ? `Feedback: "${atv.feedback}"` : 'Sem comentários';
          userPrompt += `  - Atividade entregue "${atv.atividade_titulo || `Atividade ${atvIdx + 1}`}": ${notaStr} | ${feedStr}\n`;
        });
      } else if (item.feedback || item.respostas_principais) {
        userPrompt += `  - Feedbacks anteriores: ${item.feedback || item.respostas_principais}\n`;
      } else {
        userPrompt += `  - Nenhuma atividade entregue com feedbacks preliminares.\n`;
      }

      if (Array.isArray(item.atividades_pendentes) && item.atividades_pendentes.length > 0) {
        userPrompt += `  - Atividades NÃO ENTREGUES nesta disciplina (contabilizadas com nota 0 na média geral):\n`;
        item.atividades_pendentes.forEach((pend: any) => {
          userPrompt += `    * "${pend.atividade_titulo || pend.titulo || 'Atividade pendente'}" (Pendente/Não entregue)\n`;
        });
      }
    });
  }

  const candidateModels = [
    'ag/gemini-3.7-flash-low',
    'qwenproxy/qwen3.8-max-thinking',
    'ocg/deepseek-v4-flash',
    'deepseek-v4-flash',
    'qwenproxy/qwen3.7-plus',
  ];

  const modelsToTry = modelo && !candidateModels.includes(modelo)
    ? [modelo, ...candidateModels]
    : candidateModels;

  let synthesisResult: any = null;
  let lastError = '';

  for (const currentModel of modelsToTry) {
    try {
      const aiResponse = await fetchFrom9Router('/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: currentModel,
          stream: false,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3
        }),
        signal: AbortSignal.timeout(60000)
      });

      if (!aiResponse.ok) continue;

      const aiData: any = await aiResponse.json();
      let content = aiData?.choices?.[0]?.message?.content || '';
      content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

      const parsed = JSON.parse(content);
      if (parsed.feedback_geral) {
        synthesisResult = {
          feedback_geral: String(parsed.feedback_geral).trim(),
          pontos_fortes: Array.isArray(parsed.pontos_fortes) ? parsed.pontos_fortes : [],
          pontos_atencao: Array.isArray(parsed.pontos_atencao) ? parsed.pontos_atencao : [],
          alunos_sintese: Array.isArray(parsed.alunos_sintese) ? parsed.alunos_sintese.map((s: any) => ({
            aluno_email: String(s.aluno_email || '').trim().toLowerCase(),
            feedback_individual: String(s.feedback_individual || '').trim()
          })) : [],
          modelo_utilizado: currentModel
        };
        break;
      }
    } catch (e: any) {
      lastError = e.message;
    }
  }

  if (!synthesisResult) {
    return c.json({ success: false, error: `Falha na síntese por IA: ${lastError || 'Não foi possível obter resposta'}` }, 502);
  }

  return c.json({ success: true, ...synthesisResult });
});

export { aiRouter };

