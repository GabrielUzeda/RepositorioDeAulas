import { describe, expect, test, beforeAll, beforeEach, afterAll } from 'bun:test';
import { db } from './db';
import {
  fatiarEmSecoes,
  indexarDocumento,
  removerIndiceDocumento,
  buscarTrechosDocumento,
  obterMapaDocumentos,
  obterContextoDocumentosSobDemanda,
  sanitizarTermoFts5,
} from './documentIndexer';

describe('Document Indexer & Agentic RAG', () => {
  beforeAll(() => {
    db.query('DELETE FROM documento_secoes').run();
    db.query('DELETE FROM documentos_orientadores').run();
  });

  beforeEach(() => {
    db.query('DELETE FROM documento_secoes').run();
    db.query('DELETE FROM documentos_orientadores').run();
  });

  afterAll(() => {
    db.query('DELETE FROM documento_secoes').run();
    db.query('DELETE FROM documentos_orientadores').run();
  });

  test('fatiarEmSecoes fatiat texto corretamente por cabeçalhos e blocos', () => {
    const texto = `# Unidade 1: Introducao\nConteudo da unidade um.\n\n## Topico A\nConteudo do topico A com bastante texto explicativo sobre programacao e algoritmos estruturados para testar o fatiamento automatico de parágrafos extensos na base documental da plataforma de ensino e aulas.`;
    const secoes = fatiarEmSecoes(texto, 'Documento Teste');
    expect(secoes.length).toBeGreaterThan(0);
    expect(secoes[0].titulo).toContain('Unidade 1');
    expect(secoes[0].conteudo).toContain('Conteudo da unidade um');
  });

  test('fatiamento de texto continuo de 50KB sem quebras de linha respeita o teto de 1800 caracteres', () => {
    const text50k = 'A'.repeat(50000);
    const secoes = fatiarEmSecoes(text50k, 'Documento 50KB');
    expect(secoes.length).toBeGreaterThan(0);
    for (const sec of secoes) {
      expect(sec.conteudo.length).toBeLessThanOrEqual(1800);
    }
  });

  test('trigger de limpeza do FTS5 em cascata remove entradas da tabela fts', () => {
    const docRes = db.query(`
      INSERT INTO documentos_orientadores (curso_id, disciplina_id, titulo, nome_arquivo, tipo, conteudo_texto, tamanho_bytes)
      VALUES (NULL, 1, 'Doc FTS Trigger', 'doc.txt', 'apostila', 'Conteudo para teste de trigger fts.', 100)
      RETURNING id
    `).get() as { id: number };
    const docId = docRes.id;
    indexarDocumento(docId, null, 1, 'Doc FTS Trigger', 'Conteudo para teste de trigger fts.');

    const secao = db.query('SELECT id FROM documento_secoes WHERE documento_id = ?').get(docId) as { id: number };
    expect(secao).toBeDefined();

    db.query('DELETE FROM documento_secoes WHERE id = ?').run(secao.id);

    const ftsMatch = db.query('SELECT * FROM documento_secoes_fts WHERE secao_id = ?').get(secao.id);
    expect(ftsMatch).toBeNull();

    db.query('DELETE FROM documentos_orientadores WHERE id = ?').run(docId);
  });

  test('sanitizacao de termo FTS5 remove operadores reservados e simbolos', () => {
    const termoComplexo = 'C++ & Python (3.10) OR NOT "teste"';
    const sanitizado = sanitizarTermoFts5(termoComplexo);
    expect(sanitizado).toContain('C');
    expect(sanitizado).toContain('Python');
    expect(sanitizado).not.toContain('&');
    expect(sanitizado).not.toContain('"');
    expect(sanitizado).not.toContain('(');
    expect(sanitizado).not.toContain(')');
  });

  test('busca sem disciplinaId e sem cursoId retorna vazio imediatamente', () => {
    const trechos = buscarTrechosDocumento({ disciplinaId: null, cursoId: null, termo: 'teste' });
    expect(trechos).toEqual([]);

    const mapa = obterMapaDocumentos({ disciplinaId: null, cursoId: null });
    expect(mapa).toBe('');
  });

  test('busca FTS5 utiliza MATCH corretamente', () => {
    const conteudoDoc = `# Secao 1\nSECAO_OUTRA_GIRAFA conteudo sobre animais selvagens.\n\n# Secao 2\nSECAO_ALVO_XILOFONE conteudo sobre instrumentos musicais.`;
    const docRes = db.query(`
      INSERT INTO documentos_orientadores (curso_id, disciplina_id, titulo, nome_arquivo, tipo, conteudo_texto, tamanho_bytes)
      VALUES (NULL, 1, 'Doc MATCH Teste', 'doc2.txt', 'apostila', ?, 150)
      RETURNING id
    `).get(conteudoDoc) as { id: number };
    const docId = docRes.id;
    indexarDocumento(docId, null, 1, 'Doc MATCH Teste', conteudoDoc);

    const trechos = buscarTrechosDocumento({ disciplinaId: 1, termo: 'XILOFONE', limite: 1 });
    expect(trechos.length).toBeGreaterThan(0);
    expect(trechos.some(t => t.conteudo.includes('SECAO_ALVO_XILOFONE'))).toBe(true);
    expect(trechos.some(t => t.conteudo.includes('SECAO_OUTRA_GIRAFA'))).toBe(false);

    const trechosInexistente = buscarTrechosDocumento({ disciplinaId: 1, termo: 'TERMO_TOTALMENTE_INEXISTENTE_XYZ' });
    for (const t of trechosInexistente) {
      expect(t.conteudo).not.toContain('TERMO_TOTALMENTE_INEXISTENTE_XYZ');
    }

    removerIndiceDocumento(docId);
    db.query('DELETE FROM documentos_orientadores WHERE id = ?').run(docId);
  });

  test('indexacao, busca FTS5 e remocao funcionam em banco', () => {
    const docRes = db.query(`
      INSERT INTO documentos_orientadores (curso_id, disciplina_id, titulo, nome_arquivo, tipo, conteudo_texto, tamanho_bytes)
      VALUES (NULL, 1, 'Ementa de Algoritmos', 'ementa.txt', 'ementa', 'Unidade 1: Logica de Programacao. Conceitos de variaveis, funcoes e estruturas de decisao.', 100)
      RETURNING id
    `).get() as { id: number };

    const docId = docRes.id;
    indexarDocumento(docId, null, 1, 'Ementa de Algoritmos', 'Unidade 1: Logica de Programacao. Conceitos de variaveis, funcoes e estruturas de decisao.');

    const trechos = buscarTrechosDocumento({ disciplinaId: 1, termo: 'variaveis' });
    expect(trechos.length).toBeGreaterThan(0);
    expect(trechos[0].conteudo).toContain('variaveis');

    const mapa = obterMapaDocumentos({ disciplinaId: 1 });
    expect(mapa).toContain('Ementa de Algoritmos');

    const contexto = obterContextoDocumentosSobDemanda({
      disciplinaId: 1,
      temaOuAssunto: 'variaveis',
    });
    expect(contexto).toContain('MAPA DE TÓPICOS');
    expect(contexto).toContain('TRECHOS RECUPERADOS');

    removerIndiceDocumento(docId);
    db.query('DELETE FROM documentos_orientadores WHERE id = ?').run(docId);

    const trechosAposRemocao = buscarTrechosDocumento({ disciplinaId: 1, termo: 'variaveis' });
    expect(trechosAposRemocao.length).toBe(0);
  });
});
