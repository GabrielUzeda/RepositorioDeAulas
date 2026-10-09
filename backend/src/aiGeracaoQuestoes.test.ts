import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { gerarQuestoesAi, interpretarQuestoesAi } from './aiGeracaoQuestoes';
import { carregarCasos, executarSuite, rodarCaso, type Caso } from '../eval/runEval';
import app from './routes';
import { adminToken, jsonHeaders } from './testHelpers';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['AI_PROVIDER', 'AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL', 'AI_FALLBACK_MODEL', 'AI_MODEL_QUESTOES'] as const;
const env = new Map<string, string | undefined>();
type Body = { model: string; messages: Array<{ role: string; content: string }> };
let server: ReturnType<typeof Bun.serve>;
let requests: Body[] = [];
let handler: (body: Body) => Response;
const questions = [{ title: 'Atualização de variável', content: 'Qual é o valor de x depois de x = 2 e x = x + 3?', options: [{ text: '2', correct: false }, { text: '3', correct: false }, { text: '5', correct: true }, { text: '6', correct: false }] }];
const caso: Caso = { caso: 'questoes-compartilhadas', tarefa: 'questoes', tipo: 'roleta', quantidade: 1, tema: 'Variáveis', expectativa: {} };

beforeAll(() => {
  for (const key of keys) env.set(key, process.env[key]);
  server = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(request) {
    const body = await request.json() as Body;
    requests.push(body);
    return handler(body);
  } });
  process.env.AI_PROVIDER = 'openai';
  process.env.AI_BASE_URL = `http://127.0.0.1:${server.port}/v1`;
  process.env.AI_API_KEY = 'chave-teste';
  process.env.AI_MODEL = 'modelo-geracao-base';
  process.env.AI_MODEL_QUESTOES = 'modelo-geracao-questoes';
  process.env.AI_FALLBACK_MODEL = 'reserva-nao-usado';
});

beforeEach(() => {
  requests = [];
  handler = () => Response.json({ choices: [{ message: { content: JSON.stringify(questions) } }] });
});

afterAll(() => {
  server.stop(true);
  for (const [key, value] of env) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('Geração de questões e eval pelo caminho de produção', () => {
  test('parser preserva os formatos legados', () => {
    for (const field of ['questions', 'perguntas', 'questoes', 'itens', 'data']) {
      expect(interpretarQuestoesAi(JSON.stringify({ [field]: questions }))).toEqual(questions);
    }
    expect(interpretarQuestoesAi(`\`\`\`json\n${JSON.stringify(questions)}\n\`\`\``)).toEqual(questions);
  });

  test('API repara com diagnóstico, usa modelo por tarefa e mantém contrato', async () => {
    handler = () => Response.json({ choices: [{ message: { content: requests.length === 1 ? '[]' : JSON.stringify(questions) } }] });
    const token = await adminToken();
    const res = await app.request('/ai/generate-activity', { method: 'POST', headers: jsonHeaders(token), body: JSON.stringify({ tipo: 'roleta', quantidade: 1, tema: 'Variáveis' }) });
    const data = await res.json() as any;
    expect(res.status).toBe(200);
    expect(data).toMatchObject({ success: true, total_gerado: 1, modelo_utilizado: 'modelo-geracao-questoes' });
    expect(data.questions[0].options.filter((option: any) => option.correct)).toHaveLength(1);
    expect(data.execucao).toMatchObject({ estado: 'completed', chamadas: 2, reparos: 1, tarefa: 'questoes' });
    expect(requests[1].messages[3].content).toContain('JSON com as questões solicitadas');
  });

  test('eval e serviço de produção usam o mesmo prompt e validação', async () => {
    const params = { tipo: caso.tipo!, quantidade: caso.quantidade!, tema: caso.tema, titulo: caso.caso, observacoes: '', aulasContexto: '', docsContexto: '', questoes_existentes: [] };
    await gerarQuestoesAi(params);
    expect(await rodarCaso(caso)).toEqual([]);
    expect(requests).toHaveLength(2);
    expect(requests[0].messages).toEqual(requests[1].messages);
    expect(requests.map((request) => request.model)).toEqual(['modelo-geracao-questoes', 'modelo-geracao-questoes']);
  });

  test('fixtures cobrem os quatro fluxos sem executar rede ao carregar', () => {
    const casos = carregarCasos();
    expect(casos).toHaveLength(5);
    expect(new Set(casos.map((fixture) => fixture.tarefa))).toEqual(new Set(['aula', 'questoes', 'avaliacao', 'sintese']));
    expect(requests).toHaveLength(0);
  });

  test('eval executa avaliação e síntese com dados sintéticos pelo serviço real', async () => {
    handler = (body) => {
      const user = body.messages.find((message) => message.role === 'user')?.content || '';
      const content = user.includes('ALUNOS DO LOTE')
        ? JSON.stringify({ sinteses: [{ id: 'A01', feedback_individual: 'Continue praticando.' }, { id: 'A02', feedback_individual: 'Regularize as atividades pendentes.' }] })
        : user.includes('TOTAL DE ALUNOS:')
          ? '{"feedback_geral":"A turma progride.","pontos_fortes":["Prática"],"pontos_atencao":["Pendências"]}'
          : '{"nota":90,"feedback":"Explicação correta."}';
      return Response.json({ choices: [{ message: { content } }] });
    };
    for (const fixture of carregarCasos().filter((fixture) => ['avaliacao', 'sintese'].includes(fixture.tarefa))) {
      expect(await rodarCaso(fixture)).toEqual([]);
    }
    expect(requests).toHaveLength(3);
    expect(JSON.stringify(requests)).not.toContain('a01@example.invalid');
  });

  test('fixtures malformadas ou semanticamente inválidas falham antes de tocar a rede', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-eval-fixture-'));
    try {
      writeFileSync(join(dir, 'invalida.json'), '{');
      expect(() => carregarCasos(dir)).toThrow('Fixture inválida (invalida.json)');
      writeFileSync(join(dir, 'invalida.json'), JSON.stringify({ ...caso, quantidade: 0 }));
      expect(() => carregarCasos(dir)).toThrow('quantidade deve ser um inteiro positivo');
      for (const invalido of [
        { ...caso, quantidade: 0 },
        { ...caso, quantidade: 1.5 },
        { ...caso, quantidade: '1' },
        { ...caso, tema: 42 },
        { ...caso, expectativa: [] },
        { ...caso, tarefa: 'avaliacao', atividade: {}, respostas: {} },
        { ...caso, tarefa: 'sintese', alunos_detalhes: [{}] },
      ]) {
        await expect(rodarCaso(invalido as Caso)).rejects.toThrow(/Fixture inválida/);
      }
      expect(requests).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('falha parcial de provider na síntese interrompe os próximos casos do eval', async () => {
    const fixture = carregarCasos().find((fixture) => fixture.tarefa === 'sintese')!;
    handler = (body) => {
      const user = body.messages.find((message) => message.role === 'user')?.content || '';
      if (!user.includes('ALUNOS DO LOTE')) return new Response('offline', { status: 503 });
      return Response.json({ choices: [{ message: { content: JSON.stringify({ sinteses: [{ id: 'A01', feedback_individual: 'Continue praticando.' }, { id: 'A02', feedback_individual: 'Revise as pendências.' }] }) } }] });
    };
    const relatorio = await executarSuite([fixture, caso]);
    expect(relatorio.map((result) => result.status)).toEqual(['failed', 'not_run']);
    expect(requests).toHaveLength(2);
  });

  test('falha total de provider na síntese mantém causa e interrompe o eval', async () => {
    const fixture = carregarCasos().find((fixture) => fixture.tarefa === 'sintese')!;
    handler = () => new Response('offline', { status: 503 });
    const relatorio = await executarSuite([fixture, caso]);
    expect(relatorio.map((result) => result.status)).toEqual(['failed', 'not_run']);
    expect(requests).toHaveLength(1);
  });

  test('falha do provider na aula interrompe o eval e marca os demais not_run', async () => {
    handler = () => new Response('offline', { status: 503 });
    const relatorio = await executarSuite([{ ...caso, caso: 'aula-offline', tarefa: 'aula' }, caso]);
    expect(relatorio.map((result) => result.status)).toEqual(['failed', 'not_run']);
    expect(requests).toHaveLength(1);
  });
});
