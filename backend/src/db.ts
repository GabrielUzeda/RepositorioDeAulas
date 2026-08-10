import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { hashPassword } from './auth';

const dbPath = process.env.DATABASE_PATH || './data/app.db';
const dbDir = dirname(dbPath);

if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);

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
`);

// [2] Índices para alta performance
db.run(`
CREATE INDEX IF NOT EXISTS idx_ranking_atividade_pontuacao ON ranking(atividade_id, pontuacao DESC);
CREATE INDEX IF NOT EXISTS idx_respostas_atividade ON respostas_alunos(atividade_id);
CREATE INDEX IF NOT EXISTS idx_respostas_aluno_email_hash ON respostas_alunos(aluno_email_hash);
CREATE INDEX IF NOT EXISTS idx_respostas_aluno_email ON respostas_alunos(aluno_email);
CREATE INDEX IF NOT EXISTS idx_disciplinas_curso ON disciplinas(curso_id);
CREATE INDEX IF NOT EXISTS idx_disciplina_feedbacks_disc ON disciplina_feedbacks(disciplina_id);
CREATE INDEX IF NOT EXISTS idx_curso_professores_professor ON curso_professores(professor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_criado_em ON audit_logs(criado_em);
`);

// [3] Função de Seed Automático para ambiente Demo
export async function seedDemoData() {
  const countCursos = db.query('SELECT COUNT(*) as total FROM cursos').get() as { total: number };
  if (countCursos.total > 0) return;

  const email = process.env.PROFESSOR_EMAIL || 'admin@escola.com';
  const rawPass = process.env.PROFESSOR_PASSWORD || 'MudeEstaSenha!';
  const { hash, salt } = await hashPassword(rawPass);

  const insertAdmin = db.query(
    `INSERT INTO professores (email, nome, role, status, senha_hash, salt) VALUES (?, ?, 'admin', 'ativo', ?, ?)`
  );
  insertAdmin.run(email, 'Administrador Demo', hash, salt);

  const admin = db.query('SELECT id FROM professores WHERE email = ?').get(email) as any;
  const adminId = Number(admin.id);

  const insertCurso = db.query(
    `INSERT INTO cursos (slug, nome, cor, icone, descricao, senha) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const cursoResult = insertCurso.run(
    'demo-course',
    'Curso de Demonstração',
    'bg-indigo-600',
    'school',
    'Curso de exemplo com disciplinas variadas.\n- Web Mobile 2026\n- Web Mobile 2025\nA senha de acesso é "asdf1234".\nEste curso contém os seguintes exemplos:\n- Aulas (conteúdo teórico)\n- Provas (avaliação)\n- Minigames (simulação tática)\n- Roleta (sorteio de perguntas)\n- Reforço (exercícios extras)',
    'asdf1234'
  );
  const cursoId = Number(cursoResult.lastInsertRowid);

  db.query('INSERT INTO curso_professores (curso_id, professor_id) VALUES (?, ?)').run(cursoId, adminId);

  const insertDisciplina = db.query(
    `INSERT INTO disciplinas (curso_id, slug, nome, cor, icone, descricao) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const disciplinaResult = insertDisciplina.run(
    cursoId,
    'demo-class',
    'Disciplina de Demonstração',
    'bg-indigo-600',
    'school',
    'Clique aqui para entrar na disciplina. A senha de acesso ao curso é "asdf1234".\nEsta disciplina contém os seguintes exemplos:\n- Aulas (conteúdo teórico)\n- Provas (avaliação)\n- Minigames (simulação tática)\n- Roleta (sorteio de perguntas)\n- Reforço (exercícios extras)'
  );
  const disciplinaId = Number(disciplinaResult.lastInsertRowid);

  const insertAula = db.query(
    `INSERT INTO aulas (disciplina_id, titulo, caminho, icone, descricao, ordem, conteudo_md) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  insertAula.run(
    disciplinaId,
    'Boas-vindas ao Sistema',
    '/static/boas-vindas.html',
    '00',
    'Comece por aqui: Entenda como navegar e usar o sistema.',
    1,
    '# Bem-vindo ao Repositório de Aulas!\nEste sistema foi desenvolvido para facilitar o acesso a materiais didáticos e atividades interativas.\n### Como usar:\n1. Navegue pelas guias "Aulas" e "Atividades".\n2. Clique nos cards para abrir o conteúdo.\n3. Acompanhe seu progresso e divirta-se aprendendo!'
  );

  const insertAtividade = db.query(
    `INSERT INTO atividades (disciplina_id, external_id, titulo, descricao, caminho, icone, tipo, ordem, senha, allow_password, json_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const atividades = [
    {
      external_id: 'demo-minigame',
      titulo: 'Minigame: Batalha Naval de Redes (Exemplo)',
      descricao: 'Teste seus conhecimentos táticos em Redes de Computadores eliminando navios inimigos!',
      caminho: '/static/atividades/minigame.html',
      icone: 'sports_esports',
      tipo: 'minigame',
      ordem: 1,
      senha: null,
      allow_password: 0,
      json_data:
        '{"meta":{"type":"minigame","title":"Batalha Naval de Redes"},"questions":[{"content":"Qual protocolo é utilizado para transferência segura de arquivos cifrados via SSH?","options":[{"text":"FTP","correct":false,"feedback":"FTP é inseguro (texto claro)."},{"text":"SFTP","correct":true,"feedback":"Excelente! SFTP roda sobre SSH (porta 22)."},{"text":"HTTP","correct":false,"feedback":"HTTP não usa criptografia por padrão."}]},{"content":"Qual tecnologia cria um túnel criptografado sobre uma rede pública?","options":[{"text":"NAT","correct":false,"feedback":"NAT apenas traduz endereços IP."},{"text":"VPN","correct":true,"feedback":"Perfeito! VPN provê confidencialidade e integridade."}]}]}',
    },
    {
      external_id: 'demo-roleta',
      titulo: 'Roleta do Conhecimento: Hardware (Exemplo)',
      descricao: 'Gire a roleta e responda a perguntas sorteadas de Arquitetura de Computadores!',
      caminho: '/static/atividades/roleta.html',
      icone: 'casino',
      tipo: 'roleta',
      ordem: 2,
      senha: null,
      allow_password: 0,
      json_data:
        '{"meta":{"type":"roleta","title":"Roleta do Conhecimento"},"questions":[{"content":"Qual é a função da memória cache L1/L2/L3 na CPU?","options":[{"text":"Reduzir o tempo de acesso a dados frequentes da RAM","correct":true,"feedback":"Correto! A cache é extremamente rápida e fica próxima dos núcleos."},{"text":"Armazenar arquivos permanentemente","correct":false,"feedback":"Incorreto. Cache é volátil e temporária."}]},{"content":"Qual componente é responsável pelo processamento gráfico vetorial em paralelo?","options":[{"text":"GPU","correct":true,"feedback":"Exato! Placa de vídeo/GPU possui milhares de núcleos para cálculo paralelo."},{"text":"Fonte ATX","correct":false,"feedback":"A fonte apenas fornece energia elétrica."}]}]}',
    },
    {
      external_id: 'demo-prova',
      titulo: 'Prova 01: Fundamentos de TI (Exemplo)',
      descricao: 'Avaliação formal cobrindo conceitos de Sistemas Operacionais, Hardware e Redes.',
      caminho: '/static/atividades/prova.html',
      icone: 'assignment_turned_in',
      tipo: 'prova',
      ordem: 3,
      senha: '123',
      allow_password: 1,
      json_data:
        '{"meta":{"type":"prova","title":"Prova 01: Fundamentos de TI"},"questions":[{"content":"Qual sistema operacional é baseado no Kernel Linux?","options":[{"text":"Ubuntu","correct":true,"feedback":"Correto! Ubuntu é uma distribuição Linux."},{"text":"Windows 11","correct":false,"feedback":"Windows possui kernel próprio (NT)."}]}]}',
    },
    {
      external_id: 'demo-reforco',
      titulo: 'Reforço: Prática de Fixação (Exemplo)',
      descricao: 'Exercícios práticos adaptativos para consolidar o aprendizado.',
      caminho: '/static/atividades/reforco.html',
      icone: 'psychology',
      tipo: 'reforco',
      ordem: 4,
      senha: null,
      allow_password: 0,
      json_data:
        '{"meta":{"type":"reforco","title":"Prática de Fixação"},"questions":[{"content":"Hardware é a parte física, Software é a parte lógica.","options":[{"text":"Verdadeiro","correct":true,"feedback":"Isso mesmo! Hardware é tocável, software não."},{"text":"Falso","correct":false,"feedback":"Incorreto. A definição de HW/SW segue essa base."}]},{"content":"A Memória RAM é não-volátil (não perde dados se faltar energia).","options":[{"text":"Falso","correct":true,"feedback":"Correto! A RAM é volátil."},{"text":"Verdadeiro","correct":false,"feedback":"Incorreto. A memória não-volátil é a ROM ou o Disco."}]}]}',
    },
    {
      external_id: 'demo-normal',
      titulo: 'Atividade Aberta: Questionário Geral (Exemplo)',
      descricao: 'Responda com suas palavras as perguntas sobre os tópicos estudados.',
      caminho: '/static/atividades/normal.html',
      icone: 'edit_note',
      tipo: 'normal',
      ordem: 5,
      senha: null,
      allow_password: 0,
      json_data:
        '{"questions":[{"content":"Descreva a diferença entre IPv4 e IPv6."},{"content":"Explique a importância da segurança da informação na empresa."}]}',
    },
  ];

  for (const atv of atividades) {
    insertAtividade.run(
      disciplinaId,
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
  }
}

await seedDemoData().catch((e) => console.error('seed failed:', e));

// [4] Retenção LGPD (Art. 15/16): purga de dados pessoais antigos.
export function runDataRetentionPurge(): { respostas: number; ranking: number } {
  const result = { respostas: 0, ranking: 0 };
  const raw = Number(process.env.RETENTION_DAYS);
  const days = Number.isInteger(raw) && raw > 0 ? raw : 365;

  try {
    const cutoffRow = db
      .query(`SELECT strftime('%Y-%m-%dT%H:%M:%SZ','now', ?) AS c`)
      .get(`-${days} days`) as { c: string };
    const cutoff = cutoffRow?.c;
    if (!cutoff) return result;

    while (true) {
      const res = db
        .query(`DELETE FROM respostas_alunos WHERE id IN (SELECT id FROM respostas_alunos WHERE criado_em < ? LIMIT 500)`)
        .run(cutoff);
      result.respostas += res.changes;
      if (res.changes < 500) break;
    }

    while (true) {
      const res = db
        .query(`DELETE FROM ranking WHERE id IN (SELECT id FROM ranking WHERE data_envio < ? LIMIT 500)`)
        .run(cutoff);
      result.ranking += res.changes;
      if (res.changes < 500) break;
    }

    return result;
  } catch (e) {
    console.error('Erro no expurgo LGPD:', e);
    return result;
  }
}
