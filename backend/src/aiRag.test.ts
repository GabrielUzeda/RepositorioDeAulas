import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { signJwt } from './auth';
import app from './routes';
import { db } from './db';

const ENV_KEYS = [
  'AI_PROVIDER',
  'AI_BASE_URL',
  'AI_API_KEY',
  'AI_MODEL',
  'AI_FALLBACK_MODEL',
  'AI_TIMEOUT_MS',
] as const;

const MARCADOR_DOC_DISCIPLINA = 'MARCADOR_DOC_DISCIPLINA_RAG_XYZ';
const MARCADOR_DOC_CURSO = 'MARCADOR_DOC_CURSO_RAG_XYZ';
const MARCADOR_CONTEUDO_AULA = 'MARCADOR_CONTEUDO_AULA_RAG_XYZ';

const SLUG_CURSO = 'rag-teste-xyz-unico';
const SLUG_DISCIPLINA = 'rag-teste-xyz-unico-disciplina';
const TITULO_AULA = 'Aula RAG XYZ';
const TITULO_DOC_DISCIPLINA = 'Doc Disc RAG XYZ';
const TITULO_DOC_CURSO = 'Doc Curso RAG XYZ';

const MODELO_MOCK = 'modelo-mock-rag';

const RESPOSTA_QUESTOES = JSON.stringify({ questions: [{ enunciado: 'Questao mock?', tipo: 'discursiva' }] });
const RESPOSTA_AULA = '# Aula Mock\n\n---\n\n## Slide 1\n\nConteudo da aula mock.';

const originalEnv = new Map<string, string | undefined>();
const capturados: string[] = [];

let server: ReturnType<typeof Bun.serve>;
let adminToken = '';
let cursoId = 0;
let disciplinaId = 0;
let aulaId = 0;
let docDisciplinaId = 0;
let docCursoId = 0;

function limparResiduos(): void {
  db.query('DELETE FROM documentos_orientadores WHERE titulo IN (?, ?)').run(
    TITULO_DOC_DISCIPLINA,
    TITULO_DOC_CURSO,
  );
  db.query('DELETE FROM aulas WHERE titulo = ?').run(TITULO_AULA);
  db.query('DELETE FROM disciplinas WHERE slug = ?').run(SLUG_DISCIPLINA);
  db.query('DELETE FROM cursos WHERE slug = ?').run(SLUG_CURSO);
}

function corpoCapturado(): string {
  if (capturados.length === 0) {
    throw new Error('Nenhuma requisicao chegou ao provider de IA mockado');
  }
  return capturados.join('\n');
}

beforeAll(async () => {
  for (const key of ENV_KEYS) originalEnv.set(key, process.env[key]);

  server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(request: Request): Promise<Response> {
      const raw = await request.text();
      capturados.push(raw);
      const fluxoAula = raw.includes('Marp Next');
      const conteudo = fluxoAula ? RESPOSTA_AULA : RESPOSTA_QUESTOES;
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
    .run(SLUG_CURSO, 'Curso RAG Teste XYZ');
  cursoId = Number(curso.lastInsertRowid);

  const disciplina = db
    .query('INSERT INTO disciplinas (curso_id, slug, nome) VALUES (?, ?, ?)')
    .run(cursoId, SLUG_DISCIPLINA, 'Disciplina RAG Teste XYZ');
  disciplinaId = Number(disciplina.lastInsertRowid);

  const aula = db
    .query("INSERT INTO aulas (disciplina_id, titulo, caminho, descricao, ordem, conteudo_md) VALUES (?, ?, '', '', 1, ?)")
    .run(disciplinaId, TITULO_AULA, `Conteudo base da aula. ${MARCADOR_CONTEUDO_AULA}.`);
  aulaId = Number(aula.lastInsertRowid);

  const docDisciplina = db
    .query(
      'INSERT INTO documentos_orientadores (curso_id, disciplina_id, titulo, nome_arquivo, tipo, conteudo_texto, tamanho_bytes) VALUES (NULL, ?, ?, ?, ?, ?, ?)',
    )
    .run(disciplinaId, TITULO_DOC_DISCIPLINA, 'd.txt', 'plano_ensino', `Ementa da disciplina. ${MARCADOR_DOC_DISCIPLINA}.`, 100);
  docDisciplinaId = Number(docDisciplina.lastInsertRowid);

  const docCurso = db
    .query(
      'INSERT INTO documentos_orientadores (curso_id, disciplina_id, titulo, nome_arquivo, tipo, conteudo_texto, tamanho_bytes) VALUES (?, NULL, ?, ?, ?, ?, ?)',
    )
    .run(cursoId, TITULO_DOC_CURSO, 'c.txt', 'outro', `Diretrizes gerais do curso. ${MARCADOR_DOC_CURSO}.`, 100);
  docCursoId = Number(docCurso.lastInsertRowid);
});

afterAll(() => {
  db.query('DELETE FROM documentos_orientadores WHERE id IN (?, ?)').run(docDisciplinaId, docCursoId);
  db.query('DELETE FROM aulas WHERE id = ?').run(aulaId);
  db.query('DELETE FROM disciplinas WHERE id = ?').run(disciplinaId);
  db.query('DELETE FROM cursos WHERE id = ?').run(cursoId);

  server.stop(true);

  for (const key of ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  capturados.length = 0;
});

describe('RAG: contexto de documentos e aulas chega ao prompt de IA', () => {
  test('generate-activity recebe documentos de disciplina e de curso e o conteudo das aulas', async () => {
    const res = await app.request('/ai/generate-activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        tipo: 'normal',
        tema: 'Tema de teste',
        quantidade: 1,
        disciplina_id: disciplinaId,
        aulas_ids: [aulaId],
      }),
    });
    const textoResposta = await res.text();
    if (res.status !== 200) {
      throw new Error(`POST /ai/generate-activity retornou ${res.status}: ${textoResposta}`);
    }
    expect(res.status).toBe(200);
    const data = JSON.parse(textoResposta) as { success?: boolean; questions?: unknown[] };
    expect(data.success).toBe(true);
    expect(Array.isArray(data.questions)).toBe(true);

    const corpo = corpoCapturado();
    expect(corpo).toContain(MARCADOR_DOC_DISCIPLINA);
    expect(corpo).toContain(MARCADOR_DOC_CURSO);
    expect(corpo).toContain(MARCADOR_CONTEUDO_AULA);
  });

  test('generate-aula recebe o conteudo das aulas de referencia', async () => {
    const res = await app.request('/ai/generate-aula', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        tema: 'Tema de teste',
        disciplina_id: disciplinaId,
        aulas_contexto_ids: [aulaId],
      }),
    });
    const textoResposta = await res.text();
    if (res.status !== 200) {
      throw new Error(`POST /ai/generate-aula retornou ${res.status}: ${textoResposta}`);
    }
    expect(res.status).toBe(200);
    const data = JSON.parse(textoResposta) as { success?: boolean };
    expect(data.success).toBe(true);

    const corpo = corpoCapturado();
    expect(corpo).toContain(MARCADOR_CONTEUDO_AULA);
  });

  test('generate-activity sem ids de contexto nao vaza nenhum marcador de RAG', async () => {
    const res = await app.request('/ai/generate-activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ tipo: 'normal', tema: 'Tema de teste', quantidade: 1 }),
    });
    const textoResposta = await res.text();
    if (res.status !== 200) {
      throw new Error(`POST /ai/generate-activity sem contexto retornou ${res.status}: ${textoResposta}`);
    }
    expect(res.status).toBe(200);

    const corpo = corpoCapturado();
    expect(corpo).not.toContain(MARCADOR_DOC_DISCIPLINA);
    expect(corpo).not.toContain(MARCADOR_DOC_CURSO);
    expect(corpo).not.toContain(MARCADOR_CONTEUDO_AULA);
  });
});
