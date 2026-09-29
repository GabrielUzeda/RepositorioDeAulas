import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { hashPassword } from './auth';


const isTestEnv = process.env.NODE_ENV === 'test' || (typeof Bun !== 'undefined' && Array.isArray(Bun.argv) && Bun.argv.some(arg => arg.includes('test')));
if (isTestEnv && !process.env.FRONTEND_STATIC_DIR) {
  process.env.FRONTEND_STATIC_DIR = './data/frontend_static';
}
const dbPath = process.env.DATABASE_PATH || (isTestEnv ? './data/test.db' : './data/app.db');
const dbDir = dirname(dbPath);

if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);

// WAL mode: reads não bloqueiam writes (melhor concorrência); synchronous=NORMAL seguro para WAL
db.query('PRAGMA journal_mode = WAL;').run();
db.query('PRAGMA synchronous = NORMAL;').run();
// Ativa as Foreign Keys no SQLite
db.query('PRAGMA foreign_keys = ON;').run();

// [1] Criação das Tabelas Principais (se não existirem)
db.run(`
CREATE TABLE IF NOT EXISTS professores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'professor',
  status TEXT NOT NULL DEFAULT 'ativo',
  senha_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  criado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS cursos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  cor TEXT DEFAULT 'bg-indigo-600',
  icone TEXT DEFAULT 'school',
  senha TEXT,
  descricao TEXT,
  status TEXT DEFAULT 'ativo',
  criado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS curso_professores (
  curso_id INTEGER NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  professor_id INTEGER NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
  PRIMARY KEY (curso_id, professor_id)
);

CREATE TABLE IF NOT EXISTS disciplinas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  curso_id INTEGER NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  nome TEXT NOT NULL,
  cor TEXT DEFAULT 'bg-indigo-600',
  icone TEXT DEFAULT 'school',
  descricao TEXT,
  status TEXT DEFAULT 'ativo',
  criado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE(slug, curso_id)
);

CREATE TABLE IF NOT EXISTS aulas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  caminho TEXT NOT NULL,
  icone TEXT DEFAULT '00',
  descricao TEXT,
  ordem INTEGER DEFAULT 0,
  conteudo_md TEXT,
  criado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS atividades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
  aula_id INTEGER REFERENCES aulas(id) ON DELETE SET NULL,
  external_id TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  caminho TEXT NOT NULL,
  icone TEXT DEFAULT 'assignment',
  json_data TEXT,
  tipo TEXT DEFAULT 'normal',
  ordem INTEGER DEFAULT 0,
  senha TEXT,
  allow_password INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ativo',
  data_limite TEXT,
  criado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS respostas_alunos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  atividade_id INTEGER NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
  aluno_nome TEXT NOT NULL,
  aluno_email TEXT NOT NULL,
  aluno_email_hash TEXT NOT NULL,
  respostas TEXT NOT NULL,
  consulta_token_hash TEXT,
  nota REAL,
  feedback TEXT,
  entregue_com_atraso INTEGER DEFAULT 0,
  enviado_em TEXT,
  criado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS disciplina_feedbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
  aluno_email_hash TEXT,
  feedback_geral TEXT,
  enviado_em TEXT,
  criado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE(disciplina_id, aluno_email_hash)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_disciplina_feedbacks_turma_uniq 
ON disciplina_feedbacks(disciplina_id) 
WHERE aluno_email_hash IS NULL;

CREATE TABLE IF NOT EXISTS ranking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  atividade_id INTEGER NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
  nome_jogador TEXT NOT NULL,
  pontuacao INTEGER NOT NULL,
  data_envio TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER REFERENCES professores(id) ON DELETE SET NULL,
  usuario_email TEXT,
  acao TEXT NOT NULL,
  recurso TEXT NOT NULL,
  detalhes TEXT,
  ip TEXT,
  user_agent TEXT,
  criado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS rascunhos_atividades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_recuperacao TEXT UNIQUE NOT NULL,
  atividade_id INTEGER NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
  aluno_nome TEXT NOT NULL,
  aluno_email TEXT NOT NULL,
  aluno_email_hash TEXT NOT NULL,
  respostas_json TEXT NOT NULL,
  expira_em TEXT NOT NULL,
  criado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rascunho_atv_email ON rascunhos_atividades(atividade_id, aluno_email_hash);

CREATE TABLE IF NOT EXISTS rascunhos_editor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  professor_id INTEGER NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'normal',
  json_data TEXT NOT NULL DEFAULT '{}',
  expira_em TEXT NOT NULL,
  criado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS ai_jobs (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  status TEXT NOT NULL,
  progresso TEXT,
  parametros TEXT,
  resultado TEXT,
  erro TEXT,
  criado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
`);

// Migrações defensivas para colunas adicionadas e relacionamentos N:N
try {
  db.run('ALTER TABLE atividades ADD COLUMN aula_id INTEGER REFERENCES aulas(id) ON DELETE SET NULL');
} catch (_e) {
  // Ignora se a coluna já existir
}

try { db.run("ALTER TABLE cursos ADD COLUMN status TEXT DEFAULT 'ativo'"); } catch (_e) { /* coluna já existe */ }
try { db.run("ALTER TABLE disciplinas ADD COLUMN status TEXT DEFAULT 'ativo'"); } catch (_e) { /* coluna já existe */ }
try { db.run("ALTER TABLE atividades ADD COLUMN status TEXT DEFAULT 'ativo'"); } catch (_e) { /* coluna já existe */ }
try { db.run("ALTER TABLE atividades ADD COLUMN data_limite TEXT"); } catch (_e) { /* coluna já existe */ }
try { db.run("ALTER TABLE respostas_alunos ADD COLUMN entregue_com_atraso INTEGER DEFAULT 0"); } catch (_e) { /* coluna já existe */ }

try {
  db.run(`
    CREATE TABLE IF NOT EXISTS aula_atividades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aula_id INTEGER NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
      atividade_id INTEGER NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
      ordem INTEGER DEFAULT 0,
      criado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      UNIQUE(aula_id, atividade_id)
    )
  `);
  db.run(`
    INSERT OR IGNORE INTO aula_atividades (aula_id, atividade_id)
    SELECT aula_id, id FROM atividades WHERE aula_id IS NOT NULL
  `);
} catch (_e) {
  // Tabela/relacionamento já migrado
}

try {
  db.run(`
    CREATE TABLE IF NOT EXISTS documentos_orientadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      curso_id INTEGER REFERENCES cursos(id) ON DELETE CASCADE,
      disciplina_id INTEGER REFERENCES disciplinas(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      nome_arquivo TEXT NOT NULL,
      tipo TEXT CHECK(tipo IN ('ementa', 'plano_ensino', 'apostila', 'outro')) DEFAULT 'outro',
      conteudo_texto TEXT NOT NULL,
      tamanho_bytes INTEGER NOT NULL,
      criado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )
  `);
} catch (_e) {
  // Tabela já existente
}

try {
  db.run(`
    CREATE TABLE IF NOT EXISTS documento_secoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      documento_id INTEGER REFERENCES documentos_orientadores(id) ON DELETE CASCADE,
      disciplina_id INTEGER REFERENCES disciplinas(id) ON DELETE CASCADE,
      curso_id INTEGER REFERENCES cursos(id) ON DELETE CASCADE,
      titulo_secao TEXT NOT NULL,
      conteudo TEXT NOT NULL,
      ordem INTEGER DEFAULT 0,
      criado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS documento_secoes_fts USING fts5(
      secao_id UNINDEXED,
      documento_id UNINDEXED,
      disciplina_id UNINDEXED,
      curso_id UNINDEXED,
      titulo_secao,
      conteudo
    );
  `);
} catch (_e) {
  // Tabelas/FTS já existentes
}

// [2] Índices para alta performance
db.run(`
CREATE INDEX IF NOT EXISTS idx_documentos_orientadores_disc ON documentos_orientadores(disciplina_id);
CREATE INDEX IF NOT EXISTS idx_documentos_orientadores_curso ON documentos_orientadores(curso_id);
CREATE INDEX IF NOT EXISTS idx_documento_secoes_doc ON documento_secoes(documento_id);
CREATE INDEX IF NOT EXISTS idx_documento_secoes_disc ON documento_secoes(disciplina_id);
CREATE INDEX IF NOT EXISTS idx_ranking_atividade_pontuacao ON ranking(atividade_id, pontuacao DESC);
CREATE INDEX IF NOT EXISTS idx_respostas_atividade ON respostas_alunos(atividade_id);
CREATE INDEX IF NOT EXISTS idx_respostas_aluno_email_hash ON respostas_alunos(aluno_email_hash);
CREATE INDEX IF NOT EXISTS idx_respostas_aluno_email ON respostas_alunos(aluno_email);
CREATE INDEX IF NOT EXISTS idx_disciplinas_curso ON disciplinas(curso_id);
CREATE INDEX IF NOT EXISTS idx_disciplina_feedbacks_disc ON disciplina_feedbacks(disciplina_id);
CREATE INDEX IF NOT EXISTS idx_curso_professores_professor ON curso_professores(professor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_criado_em ON audit_logs(criado_em);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_criado_em ON ai_jobs(criado_em);
CREATE INDEX IF NOT EXISTS idx_rascunhos_editor_professor ON rascunhos_editor(professor_id);
CREATE INDEX IF NOT EXISTS idx_rascunhos_editor_expira_em ON rascunhos_editor(expira_em);
CREATE INDEX IF NOT EXISTS idx_atividades_aula ON atividades(aula_id);
CREATE INDEX IF NOT EXISTS idx_aula_atividades_aula ON aula_atividades(aula_id);
CREATE INDEX IF NOT EXISTS idx_aula_atividades_atv ON aula_atividades(atividade_id);

CREATE TRIGGER IF NOT EXISTS trg_delete_documento_secoes_fts
AFTER DELETE ON documento_secoes
BEGIN
  DELETE FROM documento_secoes_fts WHERE secao_id = old.id;
END;
`);

// [3] Função de Seed Automático para ambiente Demo
export async function seedDemoData() {
  const adminEmail = process.env.PROFESSOR_EMAIL || 'admin@escola.com';
  const rawPass = process.env.PROFESSOR_PASSWORD || 'MudeEstaSenha!';
  const { hash, salt } = await hashPassword(rawPass);

  const adminRow = db.query('SELECT id FROM professores WHERE email = ?').get(adminEmail) as any;
  let adminId: number;
  if (adminRow) {
    adminId = Number(adminRow.id);
  } else {
    const res = db.query(
      `INSERT INTO professores (email, nome, role, status, senha_hash, salt) VALUES (?, ?, 'admin', 'ativo', ?, ?)`
    ).run(adminEmail, 'Administrador Demo', hash, salt);
    adminId = Number(res.lastInsertRowid);
  }

  const countCursos = db.query('SELECT COUNT(*) as total FROM cursos').get() as { total: number };
  if (countCursos.total > 0 && !isTestEnv) return;

  const cursoRow = db.query('SELECT id FROM cursos WHERE slug = ?').get('demo-course') as any;
  let cursoId = cursoRow ? Number(cursoRow.id) : null;
  if (!cursoId) {
    const insertCurso = db.query(
      `INSERT INTO cursos (slug, nome, cor, icone, descricao, senha) VALUES (?, ?, ?, ?, ?, ?)`
    );
    const cursoResult = insertCurso.run(
      'demo-course',
      'Curso de Demonstração',
      'bg-indigo-600',
      'school',
      'Curso de exemplo com disciplinas variadas.',
      'asdf1234'
    );
    cursoId = Number(cursoResult.lastInsertRowid);
  }
  db.query('INSERT OR IGNORE INTO curso_professores (curso_id, professor_id) VALUES (?, ?)').run(cursoId, adminId);

  const discRow = db.query('SELECT id FROM disciplinas WHERE curso_id = ? AND slug = ?').get(cursoId, 'demo-class') as any;
  let disciplinaId = discRow ? Number(discRow.id) : null;
  if (!disciplinaId) {
    const insertDisciplina = db.query(
      `INSERT INTO disciplinas (curso_id, slug, nome, cor, icone, descricao) VALUES (?, ?, ?, ?, ?, ?)`
    );
    const disciplinaResult = insertDisciplina.run(
      cursoId,
      'demo-class',
      'Disciplina de Demonstração',
      'bg-indigo-600',
      'school',
      'Disciplina de exemplo.'
    );
    disciplinaId = Number(disciplinaResult.lastInsertRowid);

    const insertAula = db.query(
      `INSERT INTO aulas (disciplina_id, titulo, caminho, icone, descricao, ordem, conteudo_md) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const aulaRes = insertAula.run(
      disciplinaId,
      'Boas-vindas ao Sistema',
      'materias/demo-class/aulas/boas-vindas.html',
      '00',
      'Comece por aqui.',
      1,
      '# Bem-vindo!'
    );
    const aulaId = Number(aulaRes.lastInsertRowid);

    const atividades = [
      {
        external_id: 'demo-roleta',
        titulo: 'Roleta do Conhecimento: Quiz Rápido de TI',
        descricao: 'Gire a roleta e responda à pergunta sorteada!',
        caminho: '/static/atividades/roleta.html',
        icone: 'casino',
        tipo: 'roleta',
        ordem: 1,
        senha: null,
        allow_password: 0,
        json_data: '{"questions":[{"title":"TI","content":"O que é HTML?","options":[{"text":"Linguagem de marcação","correct":true},{"text":"Sistema operacional","correct":false}]}]}'
      },
      {
        external_id: 'demo-minigame',
        titulo: 'Minigame Espacial: Batalha de Perguntas',
        descricao: 'Teste seus reflexos e conhecimentos neste minigame espacial.',
        caminho: '/static/atividades/minigame.html',
        icone: 'sports_esports',
        tipo: 'minigame',
        ordem: 2,
        senha: null,
        allow_password: 0,
        json_data: '{"questions":[{"content":"Qual protocolo é seguro para transferência de arquivos?","options":[{"text":"FTP","correct":false},{"text":"SFTP","correct":true},{"text":"HTTP","correct":false}]}]}'
      },
      {
        external_id: 'demo-prova',
        titulo: 'Prova 01: Fundamentos de TI',
        descricao: 'Avaliação formal de conhecimentos. Senha de acesso: 123',
        caminho: '/static/atividades/prova.html',
        icone: 'quiz',
        tipo: 'prova',
        ordem: 3,
        senha: '123',
        allow_password: 1,
        json_data: '{"meta":{"title":"Prova 01"},"questions":[{"content":"Explique a arquitetura cliente-servidor."}]}'
      },
      {
        external_id: 'demo-reforco',
        titulo: 'Reforço: Prática de Fixação',
        descricao: 'Exercícios extras para praticar com feedback imediato.',
        caminho: '/static/atividades/reforco.html',
        icone: 'psychology',
        tipo: 'reforco',
        ordem: 4,
        senha: null,
        allow_password: 0,
        json_data: '{"meta":{"type":"reforco","title":"Prática de Fixação"},"questions":[{"content":"Hardware é a parte física.","options":[{"text":"Verdadeiro","correct":true},{"text":"Falso","correct":false}]}]}'
      },
      {
        external_id: 'demo-normal',
        titulo: 'Atividade Aberta: Questionário Geral',
        descricao: 'Responda as questões e envie para avaliação.',
        caminho: '/static/atividades/normal.html',
        icone: 'edit_note',
        tipo: 'normal',
        ordem: 5,
        senha: null,
        allow_password: 0,
        json_data: '{"questions":[{"content":"Questão 1"}]}'
      }
    ];

    const insertAtividade = db.query(
      `INSERT INTO atividades (disciplina_id, aula_id, external_id, titulo, descricao, caminho, icone, tipo, ordem, senha, allow_password, json_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertAulaAtividade = db.query(
      `INSERT OR IGNORE INTO aula_atividades (aula_id, atividade_id) VALUES (?, ?)`
    );

    for (const atv of atividades) {
      const resAtv = insertAtividade.run(
        disciplinaId,
        aulaId,
        atv.external_id,
        atv.titulo,
        atv.descricao,
        atv.caminho,
        atv.icone,
        atv.tipo,
        atv.ordem,
        atv.senha,
        atv.allow_password,
        atv.json_data
      );
      const atvId = Number(resAtv.lastInsertRowid);
      insertAulaAtividade.run(aulaId, atvId);
    }
  }
}

await seedDemoData().catch((e) => console.error('seed failed:', e));

// [4] Expurgo de ranking antigo (Gatilho automático de 30 dias)
export function purgeOldRanking(days: number = 30): number {
  const rawRankingDays = Number(process.env.RANKING_RETENTION_DAYS);
  const targetDays = Number.isInteger(rawRankingDays) && rawRankingDays > 0 ? rawRankingDays : days;
  try {
    const cutoffRow = db
      .query(`SELECT strftime('%Y-%m-%dT%H:%M:%SZ','now', ?) AS c`)
      .get(`-${targetDays} days`) as { c: string };
    const cutoff = cutoffRow?.c;
    if (!cutoff) return 0;

    let totalDeleted = 0;
    while (true) {
      const res = db
        .query(`DELETE FROM ranking WHERE id IN (SELECT id FROM ranking WHERE data_envio < ? LIMIT 500)`)
        .run(cutoff);
      totalDeleted += res.changes;
      if (res.changes < 500) break;
    }
    return totalDeleted;
  } catch (e) {
    console.error('Erro ao expurgar ranking antigo:', e);
    return 0;
  }
}

// [4.1] Expurgo de jobs de IA antigos (Gatilho automático de 7 dias)
export function purgeOldAiJobs(days: number = 7): number {
  const rawAiJobsDays = Number(process.env.AI_JOBS_RETENTION_DAYS);
  const targetDays = Number.isInteger(rawAiJobsDays) && rawAiJobsDays > 0 ? rawAiJobsDays : days;
  try {
    const cutoffRow = db
      .query(`SELECT strftime('%Y-%m-%dT%H:%M:%SZ','now', ?) AS c`)
      .get(`-${targetDays} days`) as { c: string };
    const cutoff = cutoffRow?.c;
    if (!cutoff) return 0;

    let totalDeleted = 0;
    while (true) {
      const res = db
        .query(`DELETE FROM ai_jobs WHERE id IN (SELECT id FROM ai_jobs WHERE criado_em < ? LIMIT 500)`)
        .run(cutoff);
      totalDeleted += res.changes;
      if (res.changes < 500) break;
    }
    return totalDeleted;
  } catch (e) {
    console.error('Erro ao expurgar jobs de IA antigos:', e);
    return 0;
  }
}

// [5] Retenção LGPD (Art. 15/16): purga de dados pessoais antigos e ranking (30 dias).
export function runDataRetentionPurge(): { respostas: number; ranking: number; ai_jobs: number } {
  const result = { respostas: 0, ranking: 0, ai_jobs: 0 };
  const raw = Number(process.env.RETENTION_DAYS);
  const days = Number.isInteger(raw) && raw > 0 ? raw : 365;

  try {
    const cutoffRow = db
      .query(`SELECT strftime('%Y-%m-%dT%H:%M:%SZ','now', ?) AS c`)
      .get(`-${days} days`) as { c: string };
    const cutoff = cutoffRow?.c;

    if (cutoff) {
      while (true) {
        const res = db
          .query(`DELETE FROM respostas_alunos WHERE id IN (SELECT id FROM respostas_alunos WHERE criado_em < ? LIMIT 500)`)
          .run(cutoff);
        result.respostas += res.changes;
        if (res.changes < 500) break;
      }

      // [LGPD] Purgar rascunhos expirados e feedbacks individuais antigos do mesmo titular.
      while (true) {
        const resR = db
          .query(`DELETE FROM rascunhos_atividades WHERE id IN (SELECT id FROM rascunhos_atividades WHERE expira_em < ? LIMIT 500)`)
          .run(cutoff);
        if (resR.changes < 500) break;
      }
      while (true) {
        const resF = db
          .query(`DELETE FROM disciplina_feedbacks WHERE id IN (SELECT id FROM disciplina_feedbacks WHERE aluno_email_hash IS NOT NULL AND atualizado_em < ? LIMIT 500)`)
          .run(cutoff);
        if (resF.changes < 500) break;
      }
    }

    result.ranking = purgeOldRanking(30);
    result.ai_jobs = purgeOldAiJobs(7);
    return result;
  } catch (e) {
    console.error('Erro no expurgo LGPD:', e);
    return result;
  }
}
