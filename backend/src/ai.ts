import { Hono } from 'hono';
import { professorAuth } from './auth';
import { db } from './db';

const aiRouter = new Hono();

const NINE_ROUTER_URL = process.env.NINE_ROUTER_URL || 'http://127.0.0.1:20128/v1';
const NINE_ROUTER_API_KEY = process.env.NINE_ROUTER_API_KEY || 'sk_local_9r';

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
    const body = await res.json();
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
    const placeholders = targetAulasIds.map(() => '?').join(',');
    let aulas: { id: number; titulo: string; conteudo_md: string }[] = [];

    if (professorRole === 'admin') {
      const query = `
        SELECT a.id, a.titulo, a.conteudo_md 
        FROM aulas a
        WHERE a.id IN (${placeholders})
        ORDER BY a.ordem ASC
      `;
      aulas = db.query(query).all(...targetAulasIds) as { id: number; titulo: string; conteudo_md: string }[];
    } else {
      const query = `
        SELECT a.id, a.titulo, a.conteudo_md 
        FROM aulas a
        JOIN disciplinas d ON a.disciplina_id = d.id
        JOIN curso_professores cp ON d.curso_id = cp.curso_id
        WHERE cp.professor_id = ? AND a.id IN (${placeholders})
        ORDER BY a.ordem ASC
      `;
      aulas = db.query(query).all(professorId, ...targetAulasIds) as { id: number; titulo: string; conteudo_md: string }[];
    }
    
    if (aulas.length > 0) {
      aulasContexto = aulas
        .map((a, idx) => `--- AULA ${idx + 1}: ${a.titulo} ---\n${(a.conteudo_md || '').slice(0, 15000)}`)
        .join('\n\n');
    }
  }

  const tipoInstrucao: Record<string, string> = {
    normal: 'Atividade padrão: Crie questões de múltipla escolha com 4 alternativas (A, B, C, D), marcando a correta e fornecendo feedback explicativo pedagógico conciso para cada alternativa.',
    prova: 'Avaliação formal/Prova: Questões objetivas rigorosas de múltipla escolha com 4 alternativas, marcando exatamente 1 como correta e fornecendo feedback explicativo conciso.',
    minigame: 'Minigame de Naves: Questões com enunciado direto e objetivo, com 4 alternativas curtas. NÃO inclua feedbacks nas alternativas (apenas text e correct).',
    roleta: 'Roleta do Conhecimento: Perguntas instigantes e dinâmicas de múltipla escolha com 4 alternativas e feedback explicativo.',
    reforco: 'Reforço Pedagógico: Questões formativas com 4 alternativas, onde cada alternativa incorreta explica claramente o equívoco no feedback pedagógico para auxiliar a fixação.'
  };

  const selectedTipoInstrucao = tipoInstrucao[tipo] || tipoInstrucao.normal;

  const systemPrompt = `Você é um assistente pedagógico de elite para professores do ensino técnico e superior.
Sua missão é gerar atividades avaliativas interativas de alta qualidade com base no conteúdo das aulas ministradas pelo professor.

DIRETRIZES FUNDAMENTAIS:
1. Mantenha todas as questões estritamente alinhadas ao conteúdo, conceitos, nomenclaturas e exemplos fornecidos no contexto das aulas.
2. Não invente conceitos fora do escopo do material didático fornecido.
3. Se observações específicas do professor forem passadas, siga-as com prioridade.
4. Tipo de Atividade solicitada: "${tipo}" (${selectedTipoInstrucao}).
5. Crie exatamente ${quantidade} questões.
6. A resposta DEVE ser estritamente um objeto JSON válido no formato especificado, sem blocos de código Markdown ao redor, sem texto antes ou depois.

FORMATO JSON OBRIGATÓRIO:
{
  "questions": [
    {
      "title": "Questão 1",
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

  let userPrompt = `TEMA PRINCIPAL: ${tema || titulo || 'Conteúdo das aulas fornecidas'}\n`;
  if (titulo) userPrompt += `TÍTULO DA ATIVIDADE: ${titulo}\n`;
  if (observacoes) userPrompt += `OBSERVAÇÕES DO PROFESSOR: ${observacoes}\n`;
  userPrompt += `QUANTIDADE DE QUESTÕES: ${quantidade}\n`;

  if (aulasContexto) {
    userPrompt += `\nCONTEÚDO DAS AULAS VINCULADAS:\n${aulasContexto}\n`;
  } else {
    userPrompt += `\n(Gere as questões com base no tema informado, mantendo rigor técnico e pedagógico.)\n`;
  }

  userPrompt += `\nGere as ${quantidade} questões no formato JSON especificado.`;

  // Fallback prioritário de modelos:
  // 1. DeepSeek V4 Flash (rápido e direto)
  // 2. Qwen 3.7 Plus (qualidade e raciocínio)
  // 3. Gemini 3.7 Flash Low (estável e rápido)
  const candidateModels = [
    'ocg/deepseek-v4-flash',
    'kimchi/deepseek-v4-flash',
    'deepseek-v4-flash',
    'ocg/qwen3.7-plus',
    'qwenproxy/qwen3.7-plus',
    'ag/gemini-3.7-flash-low',
  ];

  const modelsToTry = modelo && !candidateModels.includes(modelo)
    ? [modelo, ...candidateModels]
    : candidateModels;

  let lastError = 'Nenhum provedor de IA respondeu com sucesso';
  let successfulResponse: { questions: any[]; modelo: string } | null = null;

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
        signal: AbortSignal.timeout(45000)
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

    return {
      title: String(q.title || `Questão ${index + 1}`),
      content: String(q.content || q.enunciado || q.pergunta || '').trim(),
      options: options.length > 0 ? options : undefined
    };
  });

  return c.json({
    success: true,
    questions: normalizedQuestions,
    modelo_utilizado: successfulResponse.modelo,
    total_gerado: normalizedQuestions.length
  });
});

export { aiRouter };
