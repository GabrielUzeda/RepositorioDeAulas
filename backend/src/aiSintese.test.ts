import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { signJwt } from './auth';
import app from './routes';
import { db } from './db';
import { hashEmail, encryptData } from './utils';

const ENV_KEYS = [
  'AI_PROVIDER',
  'AI_BASE_URL',
  'AI_API_KEY',
  'AI_MODEL',
  'AI_FALLBACK_MODEL',
  'AI_TIMEOUT_MS',
] as const;

const SLUG_CURSO = 'sintese-teste-xyz-unico';
const SLUG_DISCIPLINA = 'sintese-teste-xyz-unico-disciplina';
const TITULO_ATIVIDADE = 'Atividade Sintese XYZ';

const MODELO_MOCK = 'modelo-mock-sintese';

const RESPOSTA_LOTE = JSON.stringify({
  sinteses: [
    { id: 'A01', feedback_individual: 'Você evoluiu bem ao longo das atividades.' },
    { id: 'A02', feedback_individual: 'Você precisa revisar os conceitos iniciais.' },
  ],
});
const RESPOSTA_REDUCE = JSON.stringify({
  feedback_geral: 'A turma apresentou progresso consistente no tema.',
  pontos_fortes: ['Participação'],
  pontos_atencao: ['Distratores conceituais'],
});

const originalEnv = new Map<string, string | undefined>();
const capturados: string[] = [];

let server: ReturnType<typeof Bun.serve>;
let adminToken = '';
let cursoId = 0;
let disciplinaId = 0;
let atividadeId = 0;

function limparResiduos(): void {
  db.query('DELETE FROM respostas_alunos WHERE atividade_id = ?').run(atividadeId);
  db.query('DELETE FROM estatisticas_questoes WHERE atividade_id = ?').run(atividadeId);
  db.query('DELETE FROM atividades WHERE titulo = ?').run(TITULO_ATIVIDADE);
  db.query(
    'DELETE FROM disciplina_feedbacks WHERE disciplina_id = ?'
  ).run(disciplinaId);
  db.query('DELETE FROM disciplinas WHERE slug = ?').run(SLUG_DISCIPLINA);
  db.query('DELETE FROM cursos WHERE slug = ?').run(SLUG_CURSO);
}

beforeAll(async () => {
  for (const key of ENV_KEYS) originalEnv.set(key, process.env[key]);

  server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(request: Request): Promise<Response> {
      const raw = await request.text();
      capturados.push(raw);
      const conteudo = raw.includes('ALUNOS DO LOTE') ? RESPOSTA_LOTE : RESPOSTA_REDUCE;
      return new Response(JSON.stringify({ choices: [{ message: { content: conteudo } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  process.env.AI_PROVIDER = 'openai';
  process.env.AI_BASE_URL = `http://127.0.0.1:${server.port}/v1`;
  process.env.AI_API_KEY = 'chave-de-teste';
  process.env.AI_MODEL = MODELO_MOCK;
  process.env.AI_FALLBACK_MODEL = '';
  process.env.AI_TIMEOUT_MS = '';

  adminToken = await signJwt({ sub: '1', email: 'admin@escola.com', role: 'admin' });

  limparResiduos();

  const curso = db
    .query('INSERT INTO cursos (slug, nome, senha) VALUES (?, ?, NULL)')
    .run(SLUG_CURSO, 'Curso Sintese Teste XYZ');
  cursoId = Number(curso.lastInsertRowid);

  const disciplina = db
    .query('INSERT INTO disciplinas (curso_id, slug, nome) VALUES (?, ?, ?)')
    .run(cursoId, SLUG_DISCIPLINA, 'Disciplina Sintese Teste XYZ');
  disciplinaId = Number(disciplina.lastInsertRowid);

  const atividade = db
    .query(
      "INSERT INTO atividades (disciplina_id, titulo, caminho, icone, tipo, ordem) VALUES (?, ?, '', 'assignment', 'normal', 1)"
    )
    .run(disciplinaId, TITULO_ATIVIDADE);
  atividadeId = Number(atividade.lastInsertRowid);

  const nomeA = await encryptData('Maria Silva');
  const emailA = await encryptData('maria@teste.com');
  const nomeB = await encryptData('Joao Souza');
  const emailB = await encryptData('joao@teste.com');

  const hashA = await hashEmail('maria@teste.com');
  const hashB = await hashEmail('joao@teste.com');

  db.query(
    `INSERT INTO respostas_alunos (atividade_id, aluno_nome, aluno_email, aluno_email_hash, respostas, nota, feedback, enviado_em, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now'))`
  ).run(atividadeId, nomeA, emailA, hashA, await encryptData('{}'), 80, 'Maria Silva acertou os pontos principais. Joao Souza tambem.');

  db.query(
    `INSERT INTO respostas_alunos (atividade_id, aluno_nome, aluno_email, aluno_email_hash, respostas, nota, feedback, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))`
  ).run(atividadeId, nomeB, emailB, hashB, await encryptData('{}'), 40, null);
});

afterAll(() => {
  limparResiduos();
  server.stop(true);
  for (const [key, value] of originalEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});


function corpoCapturado(): string {
  if (capturados.length === 0) {
    throw new Error('Nenhuma requisicao chegou ao provider de IA mockado');
  }
  return capturados
    .map((raw) => {
      try {
        const parsed = JSON.parse(raw) as { messages?: Array<{ content?: string }> };
        return (parsed.messages || []).map((m) => m.content || '').join('\n');
      } catch {
        return raw;
      }
    })
    .join('\n');
}

beforeEach(() => {
  capturados.length = 0;
});

describe('aiSintese: pseudonimizacao, remapeamento e sintese com disciplina_id', () => {
  test('synthesize-class-feedback com disciplina_id nao envia nome/email de aluno ao provider', async () => {
    const res = await app.request('/ai/synthesize-class-feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ disciplina_id: disciplinaId }),
    });
    const textoResposta = await res.text();
    if (res.status !== 200) {
      throw new Error(`POST /ai/synthesize-class-feedback retornou ${res.status}: ${textoResposta}`);
    }
    expect(res.status).toBe(200);

    const corpo = corpoCapturado();
    expect(corpo).not.toContain('Maria Silva');
    expect(corpo).not.toContain('maria@teste.com');
    expect(corpo).not.toContain('Joao Souza');
    expect(corpo).not.toContain('joao@teste.com');
    expect(corpo).toContain('"A01"');
  });

  test('resposta mantem contrato retrocompativel com aluno_email remapeado e sem identificador Axx', async () => {
    const res = await app.request('/ai/synthesize-class-feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ disciplina_id: disciplinaId }),
    });
    expect(res.status).toBe(200);
    const data = JSON.parse(await res.text());

    expect(data.success).toBe(true);
    expect(typeof data.feedback_geral).toBe('string');
    expect(Array.isArray(data.pontos_fortes)).toBe(true);
    expect(Array.isArray(data.pontos_atencao)).toBe(true);
    expect(Array.isArray(data.alunos_sintese)).toBe(true);

    const emails = data.alunos_sintese.map((s: any) => s.aluno_email).sort();
    expect(emails).toEqual(['joao@teste.com', 'maria@teste.com']);
    for (const s of data.alunos_sintese) {
      expect(s.feedback_individual).not.toMatch(/\bA\d{2,3}\b/);
      expect(s.feedback_individual.trim()).not.toBe('');
    }
  });

  test('pontos de atencao usam estatisticas da disciplina apenas acima do minimo de respondentes', async () => {
    const res = await app.request('/ai/synthesize-class-feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ disciplina_id: disciplinaId }),
    });
    expect(res.status).toBe(200);

    const corpo = corpoCapturado();
    expect(corpo).toContain('QUESTÕES COM MAIOR TAXA DE ERRO: []');
    expect(corpo).toContain('QUESTÕES COM MAIOR TAXA DE ACERTO: []');

    db.query(
      'INSERT INTO estatisticas_questoes (atividade_id, questao_ref, acertos, erros) VALUES (?, ?, ?, ?)'
    ).run(atividadeId, '1', 2, 4);

    try {
      capturados.length = 0;
      const res2 = await app.request('/ai/synthesize-class-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ disciplina_id: disciplinaId }),
      });
      expect(res2.status).toBe(200);
      const corpo2 = corpoCapturado();
      expect(corpo2).toContain('QUESTÕES COM MAIOR TAXA DE ERRO: [{"questao":');
      expect(corpo2).toContain('"taxa_erro":66.7');
    } finally {
      db.query('DELETE FROM estatisticas_questoes WHERE atividade_id = ?').run(atividadeId);
    }
  });

  test('professor sem vínculo com o curso recebe 403 ao passar disciplina_id alheia', async () => {
    const intruso = db
      .query(
        "INSERT INTO professores (nome, email, senha_hash, salt, role, status) VALUES ('Intruso Sintese', ?, 'x', 'y', 'professor', 'ativo')"
      )
      .run('intruso-sintese@teste.com');
    const intrusoId = Number(intruso.lastInsertRowid);
    const token = await signJwt({ sub: String(intrusoId), email: 'intruso-sintese@teste.com', role: 'professor' });

    try {
      const res = await app.request('/ai/synthesize-class-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ disciplina_id: disciplinaId }),
      });
      expect(res.status).toBe(403);
    } finally {
      db.query('DELETE FROM professores WHERE id = ?').run(intrusoId);
    }
  });

  test('payload legado (alunos_detalhes) continua funcionando com pseudonimizacao', async () => {
    const res = await app.request('/ai/synthesize-class-feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        disciplina_nome: 'Disciplina Legado',
        alunos_detalhes: [
          {
            aluno_nome: 'Maria Silva',
            aluno_email: 'maria@teste.com',
            media_calculada: 75,
            atividades: [
              { atividade_titulo: TITULO_ATIVIDADE, nota: 75, feedback: 'Maria Silva progrediu.' },
            ],
            atividades_pendentes: [],
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const data = JSON.parse(await res.text());
    expect(data.success).toBe(true);

    const corpo = corpoCapturado();
    expect(corpo).not.toContain('Maria Silva');
    expect(corpo).toContain('"A01"');
    expect(data.alunos_sintese[0].aluno_email).toBe('maria@teste.com');
  });

  test('sem disciplina_id e sem alunos retorna 400', async () => {
    const res = await app.request('/ai/synthesize-class-feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ observacoes: 'nada' }),
    });
    expect(res.status).toBe(400);
  });
});
