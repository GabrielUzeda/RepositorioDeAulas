import { db } from './db';

export function sanitizarTermoFts5(termo: string): string {
  if (!termo || !termo.trim()) return '';
  const cleaned = termo
    .replace(/["\*\^\(\)\+\-\&\|]/g, ' ')
    .replace(/\b(AND|OR|NOT|NEAR)\b/gi, ' ')
    .replace(/[^\w\sÀ-ÿ]/g, ' ')
    .trim();

  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return '';
  return words.join(' OR ');
}

function chunkTextFixed(text: string, maxLen: number = 1500, hardMax: number = 1800): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();
  while (remaining.length > 0) {
    if (remaining.length <= hardMax) {
      chunks.push(remaining);
      break;
    }
    let sliceIndex = hardMax;
    const searchWindow = remaining.slice(0, hardMax);
    const lastNewline = searchWindow.lastIndexOf('\n');
    const lastSpace = searchWindow.lastIndexOf(' ');
    const lastPunct = Math.max(
      searchWindow.lastIndexOf('.'),
      searchWindow.lastIndexOf(';'),
      searchWindow.lastIndexOf(','),
      searchWindow.lastIndexOf('!'),
      searchWindow.lastIndexOf('?')
    );

    if (lastNewline > maxLen - 500 && lastNewline < hardMax) {
      sliceIndex = lastNewline + 1;
    } else if (lastPunct > maxLen - 500 && lastPunct < hardMax) {
      sliceIndex = lastPunct + 1;
    } else if (lastSpace > maxLen - 500 && lastSpace < hardMax) {
      sliceIndex = lastSpace + 1;
    }

    const chunk = remaining.slice(0, sliceIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(sliceIndex).trim();
  }
  return chunks;
}

export function fatiarEmSecoes(texto: string, tituloDoc: string): { titulo: string; conteudo: string }[] {
  if (!texto || !texto.trim()) {
    return [{ titulo: tituloDoc, conteudo: '' }];
  }

  const lines = texto.split('\n');
  const sections: { titulo: string; conteudo: string }[] = [];
  let currentTitle = tituloDoc;
  let currentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const isMarkdownHeader = /^#{1,4}\s+(.+)$/.test(trimmed);
    const isNamedSection = trimmed.length < 50 && !trimmed.endsWith('.') && /^(unidade|módulo|modulo|capítulo|capitulo|seção|secao|tópico|topico)\s+\d+/i.test(trimmed);

    if (isMarkdownHeader || isNamedSection) {
      if (currentLines.length > 0) {
        sections.push({ titulo: currentTitle, conteudo: currentLines.join('\n') });
        currentLines = [];
      }
      if (isMarkdownHeader) {
        const match = trimmed.match(/^#{1,4}\s+(.+)$/);
        currentTitle = match ? match[1].trim() : trimmed;
      } else {
        currentTitle = trimmed;
      }
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0 || sections.length === 0) {
    sections.push({ titulo: currentTitle, conteudo: currentLines.join('\n') });
  }

  const result: { titulo: string; conteudo: string }[] = [];
  for (const sec of sections) {
    const content = sec.conteudo.trim();
    if (content.length <= 1800) {
      if (content.length > 0 || result.length === 0) {
        result.push({ titulo: sec.titulo, conteudo: content });
      }
    } else {
      const paragraphs = content.split(/\n\s*\n/);
      let chunk = '';
      let partIdx = 1;
      for (const p of paragraphs) {
        if (p.length > 1800) {
          if (chunk.trim().length > 0) {
            result.push({ titulo: partIdx > 1 ? `${sec.titulo} (Parte ${partIdx++})` : sec.titulo, conteudo: chunk.trim() });
            chunk = '';
          }
          const subChunks = chunkTextFixed(p, 1500, 1800);
          for (const sub of subChunks) {
            result.push({ titulo: `${sec.titulo} (Parte ${partIdx++})`, conteudo: sub });
          }
        } else if ((chunk + '\n\n' + p).length > 1500 && chunk.length > 0) {
          result.push({ titulo: partIdx > 1 ? `${sec.titulo} (Parte ${partIdx++})` : sec.titulo, conteudo: chunk.trim() });
          chunk = p;
        } else {
          chunk = chunk ? `${chunk}\n\n${p}` : p;
        }
      }
      if (chunk.trim().length > 0) {
        result.push({ titulo: partIdx > 1 ? `${sec.titulo} (Parte ${partIdx})` : sec.titulo, conteudo: chunk.trim() });
      }
    }
  }

  const finalResult: { titulo: string; conteudo: string }[] = [];
  let strictPartIdx = 1;
  for (const r of result) {
    if (r.conteudo.length <= 1800) {
      finalResult.push(r);
    } else {
      const forcedChunks = chunkTextFixed(r.conteudo, 1500, 1800);
      for (const fc of forcedChunks) {
        finalResult.push({ titulo: `${r.titulo} (Parte ${strictPartIdx++})`, conteudo: fc });
      }
    }
  }

  if (finalResult.length === 0) {
    finalResult.push({ titulo: tituloDoc, conteudo: texto });
  }

  return finalResult;
}

export function removerIndiceDocumento(docId: number): void {
  db.query('DELETE FROM documento_secoes_fts WHERE documento_id = ?').run(docId);
  db.query('DELETE FROM documento_secoes WHERE documento_id = ?').run(docId);
}

export function indexarDocumento(
  docId: number,
  cursoId: number | null,
  disciplinaId: number | null,
  titulo: string,
  conteudoTexto: string
): void {
  const runTx = db.transaction(() => {
    removerIndiceDocumento(docId);
    const secoes = fatiarEmSecoes(conteudoTexto, titulo);

    let ordem = 0;
    for (const sec of secoes) {
      ordem++;
      const insertSec = db.query(`
        INSERT INTO documento_secoes (documento_id, disciplina_id, curso_id, titulo_secao, conteudo, ordem)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id
      `).get(docId, disciplinaId, cursoId, sec.titulo, sec.conteudo, ordem) as { id: number };

      if (insertSec?.id) {
        db.query(`
          INSERT INTO documento_secoes_fts (secao_id, documento_id, disciplina_id, curso_id, titulo_secao, conteudo)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(insertSec.id, docId, disciplinaId, cursoId, sec.titulo, sec.conteudo);
      }
    }
  });
  runTx();
}

export function backfillDocumentosLegados(): void {
  try {
    const docsLegados = db.query(`
      SELECT id, curso_id, disciplina_id, titulo, conteudo_texto 
      FROM documentos_orientadores 
      WHERE id NOT IN (SELECT DISTINCT documento_id FROM documento_secoes)
    `).all() as { id: number; curso_id: number | null; disciplina_id: number | null; titulo: string; conteudo_texto: string }[];

    for (const doc of docsLegados) {
      try {
        indexarDocumento(doc.id, doc.curso_id, doc.disciplina_id, doc.titulo, doc.conteudo_texto);
      } catch (e) {
        console.error(`Erro ao indexar documento legado ${doc.id}:`, e);
      }
    }
  } catch (e) {
    console.error('Erro no backfill de documentos legados:', e);
  }
}

export function buscarTrechosDocumento(opts: {
  disciplinaId?: number | null;
  cursoId?: number | null;
  termo: string;
  limite?: number;
}): { titulo_secao: string; conteudo: string }[] {
  if (!opts.disciplinaId && !opts.cursoId) {
    return [];
  }

  const limite = opts.limite || 5;
  const trechos: { titulo_secao: string; conteudo: string }[] = [];
  const seenIds = new Set<number>();

  const termoLimpo = sanitizarTermoFts5(opts.termo);

  let whereClause = '1=1';
  const baseParams: any[] = [];
  if (opts.disciplinaId) {
    whereClause = '(ds.disciplina_id = ? OR (ds.curso_id = ? AND ds.disciplina_id IS NULL))';
    baseParams.push(opts.disciplinaId, opts.cursoId || null);
  } else if (opts.cursoId) {
    whereClause = 'ds.curso_id = ?';
    baseParams.push(opts.cursoId);
  }

  if (termoLimpo) {
    try {
      let query = `
        SELECT ds.id, ds.titulo_secao, ds.conteudo
        FROM documento_secoes ds
        JOIN documento_secoes_fts fts ON ds.id = fts.secao_id
        WHERE documento_secoes_fts MATCH ? AND (${whereClause})
      `;
      const params: any[] = [termoLimpo, ...baseParams];
      query += ` ORDER BY rank LIMIT ?`;
      params.push(limite);

      const rows = db.query(query).all(...params) as { id: number; titulo_secao: string; conteudo: string }[];
      for (const r of rows) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          trechos.push({ titulo_secao: r.titulo_secao, conteudo: r.conteudo });
        }
      }
    } catch (e) {
      console.error('FTS5 search error:', e);
    }
  }

  if (trechos.length < limite) {
    let query = `
      SELECT ds.id, ds.titulo_secao, ds.conteudo
      FROM documento_secoes ds
      WHERE ${whereClause}
    `;
    const params: any[] = [...baseParams];
    query += ` ORDER BY ds.id ASC LIMIT ?`;
    params.push(limite);

    try {
      const rows = db.query(query).all(...params) as { id: number; titulo_secao: string; conteudo: string }[];
      for (const r of rows) {
        if (!seenIds.has(r.id) && trechos.length < limite) {
          seenIds.add(r.id);
          trechos.push({ titulo_secao: r.titulo_secao, conteudo: r.conteudo });
        }
      }
    } catch (e) {
      console.error(`[documentIndexer] Falha ao obter contexto de documentos sob demanda: ${e instanceof Error ? e.message : e}`);
    }
  }

  return trechos;
}

export function obterMapaDocumentos(opts: {
  disciplinaId?: number | null;
  cursoId?: number | null;
}): string {
  if (!opts.disciplinaId && !opts.cursoId) {
    return '';
  }

  let whereClause = '1=1';
  const baseParams: any[] = [];
  if (opts.disciplinaId) {
    whereClause = '(ds.disciplina_id = ? OR (ds.curso_id = ? AND ds.disciplina_id IS NULL))';
    baseParams.push(opts.disciplinaId, opts.cursoId || null);
  } else if (opts.cursoId) {
    whereClause = 'ds.curso_id = ?';
    baseParams.push(opts.cursoId);
  }

  try {
    let query = `
      SELECT d.titulo as doc_titulo, ds.titulo_secao
      FROM documento_secoes ds
      JOIN documentos_orientadores d ON ds.documento_id = d.id
      WHERE ${whereClause}
      ORDER BY d.id ASC, ds.ordem ASC
    `;

    const rows = db.query(query).all(...baseParams) as { doc_titulo: string; titulo_secao: string }[];
    if (rows.length === 0) return '';

    const docMap = new Map<string, string[]>();
    for (const r of rows) {
      if (!docMap.has(r.doc_titulo)) {
        docMap.set(r.doc_titulo, []);
      }
      docMap.get(r.doc_titulo)!.push(r.titulo_secao);
    }

    let mapaStr = 'MAPA DE TÓPICOS DOS DOCUMENTOS ORIENTADORES:\n';
    let sectionsAdded = 0;
    let totalAddedChars = mapaStr.length;
    let totalSeasonsAvailable = rows.length;
    let stopped = false;

    for (const [docTitulo, secoes] of docMap.entries()) {
      if (stopped) break;
      const docHeader = `- Documento: "${docTitulo}"\n`;
      if (totalAddedChars + docHeader.length > 1200 && sectionsAdded > 0) {
        stopped = true;
        break;
      }
      mapaStr += docHeader;
      totalAddedChars += docHeader.length;

      for (const sec of secoes) {
        if (sectionsAdded >= 15 || totalAddedChars > 1200) {
          stopped = true;
          break;
        }
        const secLine = `  * ${sec}\n`;
        mapaStr += secLine;
        totalAddedChars += secLine.length;
        sectionsAdded++;
      }
    }

    const remainingCount = totalSeasonsAvailable - sectionsAdded;
    if (remainingCount > 0) {
      mapaStr += `... (+ ${remainingCount} seções adicionais disponíveis)\n`;
    }
    return mapaStr.trim();
  } catch {
    return '';
  }
}

export function obterContextoDocumentosSobDemanda(opts: {
  disciplinaId?: number | null;
  cursoId?: number | null;
  temaOuAssunto: string;
  limiteTrechos?: number;
}): string {
  let resolvedCursoId = opts.cursoId || null;
  if (opts.disciplinaId && !resolvedCursoId) {
    try {
      const disc = db.query('SELECT curso_id FROM disciplinas WHERE id = ?').get(opts.disciplinaId) as any;
      if (disc?.curso_id) resolvedCursoId = disc.curso_id;
    } catch (e) {
      console.error(`[documentIndexer] Falha ao obter contexto de documentos sob demanda: ${e instanceof Error ? e.message : e}`);
    }
  }

  const mapa = obterMapaDocumentos({ disciplinaId: opts.disciplinaId, cursoId: resolvedCursoId });
  const trechos = buscarTrechosDocumento({
    disciplinaId: opts.disciplinaId,
    cursoId: resolvedCursoId,
    termo: opts.temaOuAssunto,
    limite: opts.limiteTrechos || 4,
  });

  let contexto = '';
  if (mapa) {
    contexto += `${mapa}\n`;
  }

  if (trechos.length > 0) {
    contexto += `TRECHOS RECUPERADOS POR RELEVANCIA (SOB DEMANDA):\n`;
    trechos.forEach((t, i) => {
      contexto += `\n[Trecho ${i + 1} - ${t.titulo_secao}]\n${t.conteudo}\n`;
    });
  }

  return contexto.trim();
}
