import { parseJsonOrNull } from './utils';
import { ExecucaoAi } from './aiExecucao';
import { diagnosticarQuestoes, montarPromptQuestoes, normalizarQuestoesComRubrica } from './aiQuestoes';

export function interpretarQuestoesAi(content: string): any[] {
  const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
  const candidates = [cleaned];
  const objectMatch = content.match(/\{[\s\S]*\}/);
  const arrayMatch = content.match(/\[[\s\S]*\]/);
  if (objectMatch) candidates.push(objectMatch[0]);
  if (arrayMatch) candidates.push(arrayMatch[0]);
  for (const candidate of candidates) {
    const parsed = parseJsonOrNull<any>(candidate);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    for (const field of ['questions', 'perguntas', 'questoes', 'itens', 'data']) {
      if (Array.isArray(parsed?.[field]) && parsed[field].length > 0) return parsed[field];
    }
  }
  return [];
}

export async function gerarQuestoesAi(params: Parameters<typeof montarPromptQuestoes>[0]) {
  const execucao = new ExecucaoAi('questoes', { prazoMs: 540000 });
  const prompt = montarPromptQuestoes(params);
  const result = await execucao.executar({
    messages: [
      { role: 'system', content: prompt.systemPrompt },
      { role: 'user', content: prompt.userPrompt },
    ],
    temperature: 0.3,
    timeoutMs: 180000,
    diagnose: (content) => {
      const questions = interpretarQuestoesAi(content);
      if (questions.length === 0) return ['Retorne um JSON com as questões solicitadas.'];
      return diagnosticarQuestoes(questions, { qtdSolicitada: params.quantidade, tipo: params.tipo });
    },
  });
  const questions = normalizarQuestoesComRubrica(interpretarQuestoesAi(result.content), params.tipo);
  return {
    success: true,
    questions,
    modelo_utilizado: result.modelUsed,
    total_gerado: questions.length,
    execucao: execucao.concluir(),
  };
}
