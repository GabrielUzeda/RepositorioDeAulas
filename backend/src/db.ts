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
      titulo: 'Minigame: Simulação Tática (Exemplo)',
      descricao: 'Teste seus conhecimentos táticos em Redes de Computadores abatendo ameaças virtuais!',
      caminho: '/static/atividades/minigame.html',
      icone: 'sports_esports',
      tipo: 'minigame',
      ordem: 1,
      senha: null,
      allow_password: 0,
      json_data:
        '{"meta":{"type":"minigame","title":"Simulação Tática: Defesa de Redes"},"questions":[{"content":"Qual protocolo é utilizado para transferência segura de arquivos cifrados via SSH?","options":[{"text":"SFTP","correct":true,"feedback":"Excelente! SFTP roda sobre SSH (porta 22)."},{"text":"FTP","correct":false,"feedback":"FTP transmite dados em texto claro (inseguro)."},{"text":"HTTP","correct":false,"feedback":"HTTP não utiliza criptografia por padrão."},{"text":"Telnet","correct":false,"feedback":"Telnet é não criptografado."}]},{"content":"Qual tecnologia cria um túnel criptografado seguro sobre uma rede pública?","options":[{"text":"VPN","correct":true,"feedback":"Perfeito! VPN provê confidencialidade e integridade."},{"text":"NAT","correct":false,"feedback":"NAT apenas traduz endereços IP."},{"text":"DNS","correct":false,"feedback":"DNS apenas resolve nomes de domínio."},{"text":"DHCP","correct":false,"feedback":"DHCP distribui endereços IP dinamicamente."}]},{"content":"Qual porta padrão é utilizada pelo protocolo seguro HTTPS?","options":[{"text":"443","correct":true,"feedback":"Correto! HTTPS opera por padrão na porta 443 com TLS/SSL."},{"text":"80","correct":false,"feedback":"Porta 80 é utilizada pelo HTTP não criptografado."},{"text":"21","correct":false,"feedback":"Porta 21 é utilizada pelo FTP."},{"text":"22","correct":false,"feedback":"Porta 22 é utilizada pelo SSH."}]}]}',
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
        '{"meta":{"type":"roleta","title":"Roleta do Conhecimento: Hardware"},"questions":[{"content":"Qual é a principal função da memória cache L1/L2/L3 na CPU?","options":[{"text":"Reduzir o tempo de acesso a dados frequentes da RAM","correct":true,"feedback":"Correto! A cache é extremamente rápida e fica próxima dos núcleos."},{"text":"Armazenar arquivos permanentemente após desligar","correct":false,"feedback":"Incorreto. A memória cache é volátil."},{"text":"Gerenciar o tráfego da placa de rede local","correct":false,"feedback":"Incorreto. Tráfego de rede é gerenciado pela NIC/Kernel."},{"text":"Resfriar os núcleos do processador sob alta carga","correct":false,"feedback":"Incorreto. O resfriamento é realizado pelo cooler."}]},{"content":"Qual componente é responsável pelo processamento gráfico vetorial em paralelo?","options":[{"text":"GPU","correct":true,"feedback":"Exato! A GPU possui milhares de núcleos para cálculo paralelo."},{"text":"Fonte ATX","correct":false,"feedback":"A fonte de alimentação apenas fornece energia elétrica."},{"text":"Chipset Ponte Sul (Southbridge)","correct":false,"feedback":"O chipset ponte sul gerencia barramentos de I/O lentos."},{"text":"Memória ROM","correct":false,"feedback":"A ROM armazena firmware como a BIOS/UEFI."}]},{"content":"O que significa a sigla SSD em dispositivos de armazenamento de dados?","options":[{"text":"Solid State Drive","correct":true,"feedback":"Perfeito! SSD utiliza memória flash sem partes mecânicas."},{"text":"Super Speed Disk","correct":false,"feedback":"Incorreto. Trata-se de Solid State Drive."},{"text":"System Storage Data","correct":false,"feedback":"Incorreto. Trata-se de Solid State Drive."},{"text":"Synchronous Serial Device","correct":false,"feedback":"Incorreto. Trata-se de Solid State Drive."}]}]}',
    },
    {
      external_id: 'demo-prova',
      titulo: 'Prova 01: Fundamentos de TI (Exemplo)',
      descricao: 'Avaliação formal cobrindo conceitos de Sistemas Operacionais, Hardware e Redes.',
      caminho: '/static/atividades/prova.html',
      icone: 'quiz',
      tipo: 'prova',
      ordem: 3,
      senha: '123',
      allow_password: 1,
      json_data:
        '{"meta":{"type":"prova","title":"Prova 01: Fundamentos de TI"},"questions":[{"content":"Qual sistema operacional de código aberto é baseado no Kernel Linux?","options":[{"text":"Ubuntu","correct":true,"feedback":"Correto! Ubuntu é uma distribuição Linux."},{"text":"Windows 11","correct":false,"feedback":"Windows utiliza o kernel proprietário Windows NT."},{"text":"macOS Sonoma","correct":false,"feedback":"macOS é baseado na família BSD/Darwin."},{"text":"MS-DOS","correct":false,"feedback":"MS-DOS é um sistema legado monocamada."}]},{"content":"Em arquitetura de computadores, o que caracteriza a memória RAM?","options":[{"text":"Leitura/escrita rápida e volatilidade ao desligar","correct":true,"feedback":"Correto! A RAM perde todo o conteúdo sem alimentação elétrica."},{"text":"Armazenamento óptico não gravável","correct":false,"feedback":"Incorreto. Mídias ópticas são CDs/DVDs."},{"text":"Armazenamento magnético permanente","correct":false,"feedback":"Incorreto. Discos rígidos (HDDs) utilizam armazenamento magnético."},{"text":"Execução exclusiva de instruções da BIOS","correct":false,"feedback":"Incorreto. A BIOS é mantida em memória ROM/Flash."}]}]}',
    },
    {
      external_id: 'demo-reforco',
      titulo: 'Reforço: Prática de Fixação (Exemplo)',
      descricao: 'Exercícios práticos adaptativos com feedback explicativo imediato para consolidar o aprendizado.',
      caminho: '/static/atividades/reforco.html',
      icone: 'fitness_center',
      tipo: 'reforco',
      ordem: 4,
      senha: null,
      allow_password: 0,
      json_data:
        '{"meta":{"type":"reforco","title":"Reforço: Prática de Fixação"},"questions":[{"content":"Qual é a diferença fundamental entre Hardware e Software em um sistema computacional?","options":[{"text":"Hardware é a parte física (equipamentos); Software é a parte lógica (programas)","correct":true,"feedback":"Isso mesmo! Hardware é a infraestrutura tangível, enquanto o Software consiste nas instruções de código."},{"text":"Hardware executa apenas arquivos de texto; Software gerencia a memória física","correct":false,"feedback":"Incorreto. Hardware refere-se aos componentes físicos do computador."},{"text":"Software é o gabinete e periféricos; Hardware são os algoritmos da aplicação","correct":false,"feedback":"Incorreto. Os papéis estão invertidos nessa afirmação."},{"text":"Não há diferença; ambos representam o mesmo conceito em TI","correct":false,"feedback":"Incorreto. Trata-se de conceitos distintos mas complementares."}]},{"content":"A memória RAM é classificada como volátil porque:","options":[{"text":"Perde todo o seu conteúdo armazenado ao interromper o fornecimento de energia","correct":true,"feedback":"Correto! Por ser volátil, exige corrente contínua para preservar o estado dos transistores."},{"text":"Armazena dados indefinidamente em chips semicondutores selados","correct":false,"feedback":"Incorreto. Dispositivos não-voláteis como SSDs mantêm dados sem energia."},{"text":"Pode ser lida apenas uma vez durante a inicialização do sistema","correct":false,"feedback":"Incorreto. A RAM permite leitura e escrita ilimitadas enquanto energizada."},{"text":"É imune a falhas elétricas ou quedas de tensão","correct":false,"feedback":"Incorreto. Qualquer interrupção elétrica apaga a RAM."}]}]}',
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

// [5] Retenção LGPD (Art. 15/16): purga de dados pessoais antigos e ranking (30 dias).
export function runDataRetentionPurge(): { respostas: number; ranking: number } {
  const result = { respostas: 0, ranking: 0 };
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
    return result;
  } catch (e) {
    console.error('Erro no expurgo LGPD:', e);
    return result;
  }
}
