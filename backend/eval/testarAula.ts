import '../src/env';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

function localizarBancoDados(): string {
  if (process.env.DATABASE_PATH && existsSync(process.env.DATABASE_PATH)) {
    return resolve(process.env.DATABASE_PATH);
  }
  const candidatos = [
    resolve(process.cwd(), 'data/app.db'),
    resolve(process.cwd(), 'backend/data/app.db'),
    resolve(import.meta.dir, '../data/app.db'),
    resolve(import.meta.dir, '../../backend/data/app.db'),
  ];
  for (const c of candidatos) {
    if (existsSync(c)) return c;
  }
  return resolve(import.meta.dir, '../data/app.db');
}

const DB_PATH = localizarBancoDados();
process.env.DATABASE_PATH = DB_PATH;

// Importações dinâmicas após fixar process.env.DATABASE_PATH
const { Database } = await import('bun:sqlite');
const { obterContextoDocumentosSobDemanda } = await import('../src/documentIndexer');
const { distribuirOrcamentoContexto } = await import('../src/aiContexto');
const {
  diagnosticarOutline,
  parseOutline,
  validarAulaMarp,
  dividirEmSlides,
  promptPlanejadorAula,
} = await import('../src/aiAula');
const { generateAulaOutlineAndContent } = await import('../src/ai');
const { generateMarpNextStandaloneHtml } = await import('../src/marp');
const { resolveConfig } = await import('../src/aiProvider');

const db = new Database(DB_PATH);

interface MetricasAula {
  totalSlides: number;
  slidesComAnimacao: number;
  pctAnimacao: string;
  totalTabelas: number;
  totalCodigos: number;
  totalMermaid: number;
  slidesComExcessoLinhas: number;
  slidesComExcessoCaracteres: number;
  temFrontMatterAnimacao: boolean;
  temCapaComCitacao: boolean;
  errosMarp: string[];
}

function calcularMetricas(markdown: string): MetricasAula {
  const slides = dividirEmSlides(markdown);
  const totalSlides = slides.length;
  let slidesComAnimacao = 0;
  let totalTabelas = 0;
  let totalCodigos = 0;
  let totalMermaid = 0;
  let slidesComExcessoLinhas = 0;
  let slidesComExcessoCaracteres = 0;

  for (const s of slides) {
    if (s.includes('<!-- animation: fade-up -->') || s.includes('animation: fade')) {
      slidesComAnimacao++;
    }
    if (/^\|.+?\|$/m.test(s)) {
      totalTabelas++;
    }
    if (/^```[a-zA-Z0-9_-]+/m.test(s) && !s.includes('```mermaid')) {
      totalCodigos++;
    }
    if (s.includes('```mermaid')) {
      totalMermaid++;
    }
    const linhas = s.split('\n').filter((l) => l.trim() !== '');
    if (linhas.length > 20) slidesComExcessoLinhas++;
    if (s.length > 1400) slidesComExcessoCaracteres++;
  }

  const temFrontMatterAnimacao =
    markdown.includes('animation: fade-up') || markdown.includes('animation-stagger');
  const temCapaComCitacao = slides[0] ? /^>\s*\*".+?"\*/m.test(slides[0]) : false;
  const { erros } = validarAulaMarp(markdown);

  return {
    totalSlides,
    slidesComAnimacao,
    pctAnimacao: totalSlides > 0 ? String(Math.round((slidesComAnimacao / totalSlides) * 100)) + '%' : '0%',
    totalTabelas,
    totalCodigos,
    totalMermaid,
    slidesComExcessoLinhas,
    slidesComExcessoCaracteres,
    temFrontMatterAnimacao,
    temCapaComCitacao,
    errosMarp: erros,
  };
}

function imprimirTabelaComparativa(alvo: MetricasAula, gerada: MetricasAula) {
  console.log('\n============================================================');
  console.log('              COMPARAÇÃO DE MÉTRICAS PEDAGÓGICAS           ');
  console.log('============================================================');
  console.log('| Métrica                         | Alvo (Gabarito) | Aula Gerada   |');
  console.log('|---------------------------------|-----------------|---------------|');
  console.log('| Total de Slides                 | ' + alvo.totalSlides.toString().padEnd(15) + ' | ' + gerada.totalSlides.toString().padEnd(13) + ' |');
  console.log('| Slides com Animação (fade-up)   | ' + alvo.pctAnimacao.padEnd(15) + ' | ' + gerada.pctAnimacao.padEnd(13) + ' |');
  console.log('| Frontmatter com Diretiva Anim   | ' + (alvo.temFrontMatterAnimacao ? 'SIM' : 'NÃO').padEnd(15) + ' | ' + (gerada.temFrontMatterAnimacao ? 'SIM' : 'NÃO').padEnd(13) + ' |');
  console.log('| Capa com Gancho Reflexivo (>)   | ' + (alvo.temCapaComCitacao ? 'SIM' : 'NÃO').padEnd(15) + ' | ' + (gerada.temCapaComCitacao ? 'SIM' : 'NÃO').padEnd(13) + ' |');
  console.log('| Slides com Tabelas              | ' + alvo.totalTabelas.toString().padEnd(15) + ' | ' + gerada.totalTabelas.toString().padEnd(13) + ' |');
  console.log('| Slides com Blocos de Código     | ' + alvo.totalCodigos.toString().padEnd(15) + ' | ' + gerada.totalCodigos.toString().padEnd(13) + ' |');
  console.log('| Diagramas Mermaid               | ' + alvo.totalMermaid.toString().padEnd(15) + ' | ' + gerada.totalMermaid.toString().padEnd(13) + ' |');
  console.log('| Slides densos (>20 linhas)      | ' + alvo.slidesComExcessoLinhas.toString().padEnd(15) + ' | ' + gerada.slidesComExcessoLinhas.toString().padEnd(13) + ' |');
  console.log('| Erros Estruturais Marp          | ' + alvo.errosMarp.length.toString().padEnd(15) + ' | ' + gerada.errosMarp.length.toString().padEnd(13) + ' |');
  console.log('============================================================\n');

  if (gerada.errosMarp.length > 0) {
    console.log('AVISO: erros sintaticos Marp na aula gerada:');
    for (const err of gerada.errosMarp) {
      console.log('   - ' + err);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string, fallback = '') => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
  };
  const hasFlag = (flag: string) => args.includes(flag);

  const disciplinaId = Number(getArg('--disciplina', '36'));
  const cursoId = Number(getArg('--curso', '2'));
  const tema = getArg('--tema', 'Juntando e resumindo dados');
  const aulasContextoIdsRaw = getArg('--aulas', '53');
  const aulasContextoIds = aulasContextoIdsRaw
    ? aulasContextoIdsRaw.split(',').map((x) => Number(x.trim())).filter(Boolean)
    : [53];
  const fase = getArg('--fase', 'completa');
  const dryRun = hasFlag('--dry-run') || hasFlag('--inspecionar');
  const outputDir = join(import.meta.dir, 'output');
  mkdirSync(outputDir, { recursive: true });

  console.log('[PIPELINE DE TESTE LOCAL - GERACAO DE AULA]');
  console.log('Banco de Dados: ' + DB_PATH);
  console.log('Disciplina ID: ' + disciplinaId + ' | Curso ID: ' + cursoId);
  console.log('Tema Alvo: "' + tema + '"');
  console.log('Aulas de Contexto IDs: [' + aulasContextoIds.join(', ') + ']');
  console.log('Modo: ' + (dryRun ? 'DRY-RUN (inspecao de contexto/prompts)' : ('EXECUCAO (fase: ' + fase + ')')));

  const disciplinaRow = db.query('SELECT nome, slug FROM disciplinas WHERE id = ?').get(disciplinaId) as any;
  const cursoRow = db.query('SELECT nome, slug FROM cursos WHERE id = ?').get(cursoId) as any;
  console.log('Curso: ' + (cursoRow?.nome || 'N/A'));
  console.log('Disciplina: ' + (disciplinaRow?.nome || 'N/A'));

  console.log('\n[1/4] Extraindo contexto RAG sob demanda (SQLite FTS5)...');
  const docsContexto = obterContextoDocumentosSobDemanda({
    disciplinaId,
    cursoId,
    temaOuAssunto: tema + ' INNER JOIN LEFT JOIN GROUP BY ORDER BY',
    limiteTrechos: 4,
  });
  console.log('  - RAG recuperou ' + docsContexto.length + ' caracteres de contexto documental.');

  console.log('[2/4] Carregando aulas anteriores de referência...');
  let aulasContexto = '';
  if (aulasContextoIds.length > 0) {
    const idsJson = JSON.stringify(aulasContextoIds);
    const aulasRows = db
      .query('SELECT id, titulo, conteudo_md, ordem FROM aulas WHERE id IN (SELECT value FROM json_each(?)) ORDER BY ordem ASC')
      .all(idsJson) as { id: number; titulo: string; conteudo_md: string; ordem: number }[];

    console.log('  - ' + aulasRows.length + ' aula(s) de referencia carregada(s):');
    for (const a of aulasRows) {
      console.log('    - #' + a.id + ' (ordem ' + a.ordem + '): "' + a.titulo + '" (' + a.conteudo_md.length + ' chars)');
    }
    aulasContexto = distribuirOrcamentoContexto(aulasRows, 30000);
    console.log('  - Contexto das aulas orcado e compactado: ' + aulasContexto.length + ' chars.');
  }

  if (dryRun) {
    console.log('\n==================== PRÉVIA DO CONTEXTO RAG ====================');
    console.log(docsContexto.slice(0, 1500) + (docsContexto.length > 1500 ? '\n... [trecho truncado na prévia]' : ''));
    console.log('\n================= PRÉVIA DO CONTEXTO DE AULAS ==================');
    console.log(aulasContexto.slice(0, 1500) + (aulasContexto.length > 1500 ? '\n... [trecho truncado na prévia]' : ''));

    const { systemPrompt, userPrompt } = promptPlanejadorAula({
      tema,
      observacoes: 'Aula prática e progressiva com dados relacionais claros.',
      aulasContexto,
      docsContexto,
    });
    console.log('\n================= PROMPT SYSTEM DO PLANEJADOR ==================');
    console.log(systemPrompt.slice(0, 800) + '...\n');
    console.log('================== PROMPT USER DO PLANEJADOR ===================');
    console.log(userPrompt);

    const refPath = join(import.meta.dir, 'referencias', 'juntando_e_resumindo_dados.md');
    if (existsSync(refPath)) {
      const refMd = readFileSync(refPath, 'utf8');
      const metricasRef = calcularMetricas(refMd);
      console.log('\n================ MÉTRICAS DA AULA ALVO (GABARITO) ================');
      console.log('Total de slides: ' + metricasRef.totalSlides);
      console.log('Slides com animação: ' + metricasRef.pctAnimacao);
      console.log('Tabelas: ' + metricasRef.totalTabelas + ' | Códigos: ' + metricasRef.totalCodigos + ' | Mermaid: ' + metricasRef.totalMermaid);
      console.log('Frontmatter com animação: ' + metricasRef.temFrontMatterAnimacao);
      console.log('Capa com citação reflexiva: ' + metricasRef.temCapaComCitacao);
      console.log('Erros Marp: ' + metricasRef.errosMarp.length);
    }

    console.log('\nInspecao concluida com sucesso! Nenhum token foi consumido.');
    return;
  }

  let config: ReturnType<typeof resolveConfig>;
  try {
    config = resolveConfig('aula');
    console.log('\nProvedor de IA: ' + config.provider + ' | Modelo: ' + config.model + ' | Endpoint: ' + config.baseUrl);
  } catch (err: any) {
    console.error('Erro na configuracao do provedor de IA: ' + err.message);
    process.exit(1);
  }

  if (fase === 'outline') {
    console.log('\n[3/4] Executando Planejador Pedagógico (Fase 1)...');
    const { systemPrompt, userPrompt } = promptPlanejadorAula({
      tema,
      observacoes: 'Aula prática e progressiva com dados relacionais claros.',
      aulasContexto,
      docsContexto,
    });

    const { callAi } = await import('../src/aiProvider');
    const res = await callAi({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.35,
      task: 'aula',
    });

    const outline = parseOutline(res.content);
    if (!outline) {
      console.error('Falha ao parsear o JSON do outline retornado!');
      console.error(res.content);
      process.exit(1);
    }

    const diagnostico = diagnosticarOutline(outline);
    console.log('  - Outline estruturado: "' + outline.titulo + '" - ' + outline.secoes.length + ' seções.');
    if (diagnostico.length > 0) {
      console.log('  Alertas de diagnostico:');
      for (const d of diagnostico) {
        console.log('     - ' + d);
      }
    }
    const outlinePath = join(outputDir, 'outline_gerado.json');
    writeFileSync(outlinePath, JSON.stringify(outline, null, 2), 'utf8');
    console.log('Outline salvo em: ' + outlinePath);
    return;
  }

  console.log('\n[3/4] Executando pipeline completo de geração (Fases 1, 2 e 3)...');
  const inicio = performance.now();
  let resultado: Awaited<ReturnType<typeof generateAulaOutlineAndContent>>;

  try {
    resultado = await generateAulaOutlineAndContent({
      disciplina_id: disciplinaId,
      tema,
      aulas_contexto_ids: aulasContextoIds,
      continuar_sequencia: false,
      checkpoint: async (msg) => {
        console.log('  ⏳ ' + msg);
      },
    });
  } catch (err: any) {
    console.error('Erro durante a geracao da aula: ' + err.message);
    if (err.cause) console.error(err.cause);
    process.exit(1);
  }

  const duracao = ((performance.now() - inicio) / 1000).toFixed(1);
  console.log('\n[4/4] Concluído em ' + duracao + 's! Salvando e comparando artefatos...');

  const mdPath = join(outputDir, 'juntando_e_resumindo_dados_gerada.md');
  writeFileSync(mdPath, resultado.conteudo_md, 'utf8');
  console.log('Markdown salvo: ' + mdPath + ' (' + resultado.conteudo_md.length + ' chars)');

  const htmlPath = join(outputDir, 'juntando_e_resumindo_dados_gerada.html');
  const html = generateMarpNextStandaloneHtml(resultado.titulo_sugerido || tema, resultado.conteudo_md);
  writeFileSync(htmlPath, html, 'utf8');
  console.log('HTML interativo pronto para navegacao: ' + htmlPath + ' (' + html.length + ' bytes)');

  const refPath = join(import.meta.dir, 'referencias', 'juntando_e_resumindo_dados.md');
  if (existsSync(refPath)) {
    const refMd = readFileSync(refPath, 'utf8');
    const metricasRef = calcularMetricas(refMd);
    const metricasGerada = calcularMetricas(resultado.conteudo_md);
    imprimirTabelaComparativa(metricasRef, metricasGerada);
  } else {
    console.log('ℹ️ Arquivo de referência não encontrado para comparação.');
  }
}

main().catch((err) => {
  console.error('Erro inesperado no pipeline de teste:', err);
  process.exit(1);
});
