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
  const cleanBase = NINE_ROUTER_URL.replace(/\/v1\/?$/, '');
  const url = endpoint.startsWith('http') ? endpoint : `${cleanBase}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${NINE_ROUTER_API_KEY}`);
  }
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

aiRouter.get('/health', professorAuth, async (c) => {
  try {
    const res = await fetchFrom9Router('/api/health', {
      signal: AbortSignal.timeout(5000),
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
      signal: AbortSignal.timeout(8000),
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
  } = body;

  if (!tema && !titulo && aulas_ids.length === 0) {
    return c.json({ success: false, error: 'Informe um tema, título ou selecione ao menos uma aula para contextualizar' }, 400);
  }

  let aulasContexto = '';
  if (Array.isArray(aulas_ids) && aulas_ids.length > 0) {
    const placeholders = aulas_ids.map(() => '?').join(',');
    let aulas: { id: number; titulo: string; conteudo_md: string }[] = [];

    if (professorRole === 'admin') {
      const query = `
        SELECT a.id, a.titulo, a.conteudo_md 
        FROM aulas a
        WHERE a.id IN (${placeholders})
        ORDER BY a.ordem ASC
      `;
      aulas = db.query(query).all(...aulas_ids) as { id: number; titulo: string; conteudo_md: string }[];
    } else {
      const query = `
        SELECT a.id, a.titulo, a.conteudo_md 
        FROM aulas a
        JOIN disciplinas d ON a.disciplina_id = d.id
        JOIN curso_professores cp ON d.curso_id = cp.curso_id
        WHERE cp.professor_id = ? AND a.id IN (${placeholders})
        ORDER BY a.ordem ASC
      `;
      aulas = db.query(query).all(professorId, ...aulas_ids) as { id: number; titulo: string; conteudo_md: string }[];
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

  try {
    const aiResponse = await fetchFrom9Router('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: modelo,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3
      }),
      signal: AbortSignal.timeout(90000)
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text().catch(() => '');
      return c.json({ success: false, error: `Erro na IA (${aiResponse.status}): ${errText.slice(0, 120)}` }, 502);
    }

    let rawText = await aiResponse.text();
    let content = '';

    // 1. Tenta parse direto de JSON
    try {
      const aiData = JSON.parse(rawText);
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

    if (parsedQuestions.length === 0) {
      return c.json({
        success: false,
        error: 'A IA respondeu mas não foi possível estruturar as questões em formato compatível.',
        raw_output: content.slice(0, 500)
      }, 502);
    }

    const normalizedQuestions = parsedQuestions.map((q: any, index: number) => {
      const rawOptions = Array.isArray(q.options) ? q.options : (Array.isArray(q.alternativas) ? q.alternativas : []);
      const options = rawOptions.map((opt: any) => ({
        text: String(opt.text || opt.label || opt.opcao || '').trim(),
        correct: Boolean(opt.correct || opt.isCorrect || opt.correta),
        feedback: tipo === 'minigame' ? '' : String(opt.feedback || opt.justificativa || '').trim()
      }));

      const hasCorrect = options.some(o => o.correct);
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
      modelo_utilizado: modelo,
      total_gerado: normalizedQuestions.length
    });

  } catch (e: any) {
    return c.json({ success: false, error: e.message || 'Falha na comunicação com o provedor de IA' }, 500);
  }
});

export { aiRouter };
