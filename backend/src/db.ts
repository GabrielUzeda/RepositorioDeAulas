import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.join(import.meta.dir, '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'app.db');

export const db = new Database(DB_PATH, { create: true });
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS turmas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  cor TEXT,
  icone TEXT,
  senha TEXT,
  descricao TEXT,
  criado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  atualizado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS aulas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  turma_id INTEGER REFERENCES turmas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  caminho TEXT NOT NULL,
  icone TEXT,
  descricao TEXT,
  ordem INTEGER DEFAULT 0,
  conteudo_md TEXT,
  criado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  atualizado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS atividades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  turma_id INTEGER REFERENCES turmas(id) ON DELETE CASCADE,
  external_id TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  caminho TEXT NOT NULL,
  icone TEXT,
  json_data TEXT,
  tipo TEXT DEFAULT 'normal',
  senha TEXT,
  allow_password INTEGER DEFAULT 0,
  ordem INTEGER DEFAULT 0,
  criado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  atualizado_em TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS ranking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  atividade_id INTEGER NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
  nome_jogador TEXT NOT NULL,
  pontuacao INTEGER NOT NULL,
  data_envio TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_ranking_atividade_pontuacao ON ranking(atividade_id, pontuacao DESC);
`;

db.exec(SCHEMA);
seedDemoData();

function seedDemoData() {
  const seed = db.transaction(() => {
  const existing = db.query('SELECT id FROM turmas WHERE slug = ?').get('demo-class');
  if (existing) return;

  const insertTurma = db.query(
    `INSERT INTO turmas (slug, nome, cor, icone, senha, descricao) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const turmaResult = insertTurma.run(
    'demo-class',
    'Turma de Demonstração',
    'bg-indigo-600',
    'school',
    'asdf1234',
    'Clique aqui para entrar na turma. A senha de acesso é "asdf1234".\n\n\n\nEsta turma contém os seguintes exemplos:\n- Aulas (conteúdo teórico)\n- Provas (avaliação)\n- Minigames (simulação tática)\n- Roleta (sorteio de perguntas)\n- Reforço (exercícios extras)'
  );
  const turmaId = Number(turmaResult.lastInsertRowid);

  const insertAula = db.query(
    `INSERT INTO aulas (turma_id, titulo, caminho, icone, descricao, ordem, conteudo_md) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  insertAula.run(
    turmaId,
    'Boas-vindas ao Sistema',
    '/apresentacoes/boas-vindas.html',
    '00',
    'Comece por aqui: Entenda como navegar e usar o sistema.',
    1,
    '# Bem-vindo ao Repositório de Aulas!\n\nEste sistema foi desenvolvido para facilitar o acesso a materiais didáticos e atividades interativas.\n\n### Como usar:\n1. Navegue pelas guias "Aulas" e "Atividades".\n2. Clique nos cards para abrir o conteúdo.\n3. Acompanhe seu progresso e divirta-se aprendendo!'
  );

  const insertAtividade = db.query(
    `INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone, tipo, ordem, senha, allow_password, json_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const atividades = [
    {
      external_id: 'demo-minigame',
      titulo: 'Simulação Tática: Defesa Cibernética',
      descricao: 'Teste seus reflexos e conhecimentos neste minigame de nave.',
      icone: '01',
      tipo: 'minigame',
      ordem: 1,
      senha: null,
      allow_password: 0,
      json_data:
        '{"questions":[{"content":"Qual protocolo é seguro para transferência de arquivos?","options":[{"text":"FTP","correct":false},{"text":"SFTP","correct":true},{"text":"HTTP","correct":false}]},{"content":"O que significa a sigla VPN?","options":[{"text":"Virtual Private Network","correct":true},{"text":"Very Public Network","correct":false},{"text":"Visual Point Node","correct":false}]}]}',
    },
    {
      external_id: 'demo-roleta',
      titulo: 'Roleta do Conhecimento',
      descricao: 'Gire a roleta e responda à pergunta sorteada!',
      icone: '02',
      tipo: 'roleta',
      ordem: 2,
      senha: null,
      allow_password: 0,
      json_data:
        '{"questions":[{"title":"Conceitos Básicos","content":"O que é um algoritmo?","options":[{"text":"Sequência de passos lógicos","correct":true,"feedback":"Correto! Um algoritmo é uma receita para resolver problemas passo a passo."},{"text":"Uma peça de hardware","correct":false,"feedback":"Incorreto. O hardware é a parte física (como teclado e monitor). Um algoritmo é lógico/software."}]},{"title":"Hardware","content":"Cite 3 componentes de entrada.","options":[{"text":"Teclado, Mouse, Microfone","correct":true,"feedback":"Excelente! Esses são exemplos clássicos de hardware de entrada de dados."},{"text":"Monitor, Caixa de Som","correct":false,"feedback":"Incorreto. Monitor e caixa de som são exemplos de dispositivos de SAÍDA de dados."}]},{"title":"Software","content":"Qual a diferença entre SO e Aplicativo?","options":[{"text":"O SO gerencia tudo, o aplicativo faz tarefas específicas.","correct":true,"feedback":"Isso mesmo! O Sistema Operacional controla o computador, e o aplicativo atende ao usuário."},{"text":"Ambos são a mesma coisa fisicamente","correct":false,"feedback":"Incorreto. Ambos são softwares e servem a propósitos distindos (gerenciamento vs tarefas específicas)."}]},{"title":"Redes","content":"Qual a utilidade do IP?","options":[{"text":"Identificar uma máquina na rede","correct":true,"feedback":"Exatamente! O IP é como o endereço residencial de um computador na rede."},{"text":"Proteger contra vírus","correct":false,"feedback":"Incorreto. A proteção contra vírus é feita por antivírus e firewalls, não pelo protocolo IP."}]},{"title":"Segurança","content":"O que é Phishing?","options":[{"text":"Um tipo de ataque de engenharia social","correct":true,"feedback":"Correto! É quando tentam enganar você para que forneça dados sensíveis."},{"text":"Um programa de edição de imagem","correct":false,"feedback":"Incorreto. Programas de edição de imagem nada têm a ver com Phishing."}]},{"title":"Geral","content":"O que significa WWW?","options":[{"text":"World Wide Web","correct":true,"feedback":"Exatamente! Essa é a grande rede mundial de computadores."},{"text":"Wild World Web","correct":false,"feedback":"Incorreto. Apesar do trocadilho divertido, o correto é World Wide Web."}]}]}',
    },
    {
      external_id: 'demo-prova',
      titulo: 'Avaliação Diagnóstica',
      descricao: 'Teste seus conhecimentos iniciais. Senha de acesso: avaliação',
      icone: '03',
      tipo: 'prova',
      ordem: 3,
      senha: 'avaliação',
      allow_password: 1,
      json_data:
        '{"meta":{"title":"Avaliação Diagnóstica"},"questions":[{"content":"Qual a função da Memória RAM no processamento de dados do computador?"},{"content":"Descreva como funciona o fluxo de informação entre o processador, a memória e o disco de armazenamento."},{"content":"Disserte sobre a importância dos sistemas operacionais e como eles ajudam o usuário comum."}]}',
    },
    {
      external_id: 'demo-reforco',
      titulo: 'Atividade de Reforço',
      descricao: 'Exercícios extras para praticar.',
      icone: '04',
      tipo: 'reforco',
      ordem: 4,
      senha: null,
      allow_password: 0,
      json_data:
        '{"meta":{"type":"reforco","title":"Prática de Fixação"},"questions":[{"content":"Hardware é a parte física, Software é a parte lógica.","options":[{"text":"Verdadeiro","correct":true,"feedback":"Isso mesmo! Hardware é tocável, software não."},{"text":"Falso","correct":false,"feedback":"Incorreto. A definição de HW/SW segue essa base."}]},{"content":"A Memória RAM é não-volátil (não perde dados se faltar energia).","options":[{"text":"Falso","correct":true,"feedback":"Correto! A RAM é volátil."},{"text":"Verdadeiro","correct":false,"feedback":"Incorreto. A memória não-volátil é a ROM ou o Disco."}]},{"content":"Um navegador web atua como um Hardware.","options":[{"text":"Falso","correct":true,"feedback":"Excelente! O navegador é um software."},{"text":"Verdadeiro","correct":false,"feedback":"Incorreto. É um aplicativo, portanto, software."}]},{"content":"Para salvar um documento de texto permanentemente usamos:","options":[{"text":"O Disco (SSD/HD)","correct":true,"feedback":"Perfeito! O armazenamento em massa é persistente."},{"text":"A CPU","correct":false,"feedback":"Incorreto. CPU processa, não armazena permanentemente."}]}]}',
    },
    {
      external_id: 'demo-normal',
      titulo: 'Atividade Normal',
      descricao: 'Responda as questões discursivas e envie para avaliação.',
      icone: '05',
      tipo: 'normal',
      ordem: 5,
      senha: null,
      allow_password: 0,
      json_data:
        '{"meta":{"title":"Questionário Teórico","description":"Responda as questões discrusivas utilizando o editor."},"questions":[{"content":"Explique com suas palavras as três principais etapas de qualquer algoritmo na computação."},{"content":"Qual é a principal função da Placa-Mãe em relação aos demais Hardwares?"}]}',
    },
  ];

  for (const atv of atividades) {
    insertAtividade.run(
      turmaId,
      atv.external_id,
      atv.titulo,
      atv.descricao,
      '#',
      atv.icone,
      atv.tipo,
      atv.ordem,
      atv.senha,
      atv.allow_password,
      atv.json_data
    );
  }
  });
  seed();
}
