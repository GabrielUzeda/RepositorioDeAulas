export function diagnosticarQuestoes(
  questoes: any[],
  params: { qtdSolicitada: number; tipo: string }
): string[] {
  const erros: string[] = [];

  if (!Array.isArray(questoes)) {
    return ['O retorno não é um array de questões válido.'];
  }

  if (questoes.length !== params.qtdSolicitada) {
    erros.push(
      `Quantidade gerada (${questoes.length}) diferente da solicitada (${params.qtdSolicitada})`
    );
  }

  for (let i = 0; i < questoes.length; i++) {
    const q = questoes[i];
    const prefix = `Questão ${i + 1}`;

    if (!q || typeof q !== 'object') {
      erros.push(`${prefix}: formato inválido.`);
      continue;
    }

    if (!q.title || /^(quest[aã]o|pergunta|item)\s*\d+/i.test(q.title.trim()) || q.title.trim() === '') {
      erros.push(`Título genérico ou vazio na questão: ${q.title}`);
    }

    if (!q.content || typeof q.content !== 'string' || q.content.trim().length < 10) {
      erros.push(`${prefix}: Enunciado muito curto ou vazio`);
    }

    const tipo = (params.tipo || '').toLowerCase();
    const isDiscursiva = tipo === 'normal' || tipo === 'prova' || (!q.options && !Array.isArray(q.options));

    if (isDiscursiva) {
      if (!q.resposta_esperada || typeof q.resposta_esperada !== 'string' || q.resposta_esperada.trim().length < 15) {
        erros.push(`${prefix}: resposta_esperada ausente ou com menos de 15 caracteres`);
      }
      if (!Array.isArray(q.rubrica) || q.rubrica.length < 2) {
        erros.push(`${prefix}: rubrica deve ser um array com ao menos 2 critérios`);
      } else {
        for (const crit of q.rubrica) {
          if (!crit || typeof crit.peso !== 'number' || typeof crit.criterio !== 'string') {
            erros.push(`${prefix}: critério de rubrica inválido (necessita 'criterio' e 'peso')`);
          }
        }
      }
    } else {
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        erros.push(`${prefix}: Array options deve ter exatamente 4 alternativas`);
      } else {
        const correctOptions = q.options.filter((opt: any) => opt && opt.correct === true);
        if (correctOptions.length !== 1) {
          erros.push(`${prefix}: Exatamente 1 alternativa deve ter correct === true (encontradas: ${correctOptions.length})`);
        }

        const seenTexts = new Set<string>();
        for (const opt of q.options) {
          if (!opt || !opt.text || typeof opt.text !== 'string' || opt.text.trim() === '') {
            erros.push(`${prefix}: Alternativa com texto vazio`);
          } else {
            const normalizedText = opt.text.trim().toLowerCase();
            if (seenTexts.has(normalizedText)) {
              erros.push(`${prefix}: Alternativa duplicada encontrada`);
            }
            seenTexts.add(normalizedText);
          }
        }

        if (tipo === 'reforco') {
          for (const opt of q.options) {
            if (opt && opt.correct !== true) {
              if (!opt.feedback || typeof opt.feedback !== 'string' || opt.feedback.trim() === '') {
                erros.push(`${prefix}: Alternativa incorreta sem feedback explicativo preenchido`);
              }
            }
          }
        }
      }
    }
  }

  return erros;
}

export function normalizarQuestoesComRubrica(questoes: any[], tipo: string): any[] {
  if (!Array.isArray(questoes)) return [];

  return questoes.map((q) => {
    if (!q || typeof q !== 'object') return q;
    const copia = { ...q };

    const isDiscursiva = tipo === 'normal' || tipo === 'prova' || (!copia.options && !Array.isArray(copia.options));

    if (isDiscursiva) {
      if (Array.isArray(copia.rubrica) && copia.rubrica.length > 0) {
        const somaPesos = copia.rubrica.reduce((acc: number, c: any) => acc + (Number(c.peso) || 0), 0);
        if (somaPesos > 0 && somaPesos !== 100) {
          copia.rubrica = copia.rubrica.map((c: any) => ({
            ...c,
            peso: Number((((Number(c.peso) || 0) / somaPesos) * 100).toFixed(2)),
          }));
        }
      }
    } else {
      if (Array.isArray(copia.options)) {
        copia.options = copia.options.map((opt: any) => ({
          text: String(opt?.text || ''),
          correct: Boolean(opt?.correct),
          feedback: opt?.feedback ? String(opt.feedback) : undefined,
        }));
      }
    }

    return copia;
  });
}

export function montarPromptQuestoes(params: {
  tipo: string;
  titulo: string;
  tema: string;
  observacoes: string;
  quantidade: number;
  aulasContexto: string;
  docsContexto: string;
  questoes_existentes: any[];
}): { systemPrompt: string; userPrompt: string } {
  const {
    tipo,
    titulo,
    tema,
    observacoes,
    quantidade,
    aulasContexto,
    docsContexto,
    questoes_existentes,
  } = params;

  const isDiscursiva = tipo === 'normal' || tipo === 'prova';

  const systemPrompt = `Você é um especialista em elaboração de questões educacionais rigorosas e alinhadas pedagogicamente.
Sua tarefa é gerar exatamente ${quantidade} questões do tipo "${tipo}" sobre o tema "${tema}".

Diretrizes pedagógicas estritas:
1. Distratores baseados em equívocos conceituais comuns dos alunos.
2. Proibição absoluta de alternativas do tipo "todas as anteriores" ou "nenhuma das anteriores".
3. Alternativas de comprimentos homogêneos e gramaticalmente consistentes.
4. Nível cognitivo balanceado (lembrar, aplicar, analisar).
5. Posicione a alternativa correta aleatoriamente (em A, B, C ou D), sem padrão repetitivo.
${
  isDiscursiva
    ? '6. Para questões discursivas, exija "resposta_esperada" detalhada (mínimo 15 caracteres) e "rubrica" com ao menos 2 critérios conceituais avaliáveis com pesos numéricos somando 100.'
    : '6. Para questões objetivas, forneça exatamente 4 alternativas, sendo exatamente 1 correta (correct: true).'
}

Retorne ESTRITAMENTE um array JSON puro (sem markdown extra, sem comentários) contendo os objetos de questão.
Exemplo de formato para objetiva:
[
  {
    "title": "Conceito X",
    "content": "Enunciado claro e contextualizado da questão?",
    "options": [
      { "text": "Alternativa A incorreta com distrator conceitual.", "correct": false, "feedback": "Explicação do erro A." },
      { "text": "Alternativa B correta.", "correct": true },
      { "text": "Alternativa C incorreta.", "correct": false, "feedback": "Explicação do erro C." },
      { "text": "Alternativa D incorreta.", "correct": false, "feedback": "Explicação do erro D." }
    ]
  }
]
Exemplo de formato para discursiva:
[
  {
    "title": "Análise Y",
    "content": "Explique o funcionamento de Y no contexto abordado.",
    "resposta_esperada": "Espera-se que o aluno mencione os pontos A, B e C de forma estruturada.",
    "rubrica": [
      { "criterio": "Menção correta ao ponto A", "peso": 50 },
      { "criterio": "Explicação do impacto B", "peso": 50 }
    ]
  }
]`;

  const userPrompt = `Gere ${quantidade} questões para a atividade "${titulo}" sobre o tema "${tema}".
Observações adicionais: ${observacoes || 'Nenhuma'}

Contexto das aulas:
${aulasContexto || 'Nenhum'}

Documentos de referência:
${docsContexto || 'Nenhum'}

Questões já existentes (evitar duplicar):
${JSON.stringify(questoes_existentes || [], null, 2)}`;

  return { systemPrompt, userPrompt };
}
