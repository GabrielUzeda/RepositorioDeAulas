import '../src/env';
import assert from 'node:assert/strict';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import MarkdownIt from 'markdown-it';

const args = process.argv.slice(2);
const modo = args.includes('--decomposta') ? 'decomposta' : 'direta';
const rodada = args.find(a => a.startsWith('--rodada='))?.slice(9) ?? 'baseline';
assert(/^[a-z0-9_-]+$/i.test(rodada), 'Rodada inválida.');
assert(args.includes('--live'), 'Use --live para autorizar consumo de tokens.');
process.env.DATABASE_PATH ||= join(tmpdir(), 'aula-aprovada-eval-test.db');
assert(basename(process.env.DATABASE_PATH).includes('test'), 'Banco de teste obrigatório.');

const { generateAulaOutlineAndContent } = await import('../src/ai');
const { dividirEmSlides, validarAulaMarp } = await import('../src/aiAula');
const { parseSlideInteractive } = await import('../src/slideInteractive');
const { generateMarpNextStandaloneHtml } = await import('../src/marp');
const { promptAulaDireta, promptPlanejadorAula, promptSecaoAula } = await import('../src/aiAula');
const md = new MarkdownIt();
const referenciaPath = join(import.meta.dir, '../../examplo.md');
const referencia = readFileSync(referenciaPath, 'utf8');
const tema = 'Subconsultas para responder perguntas no relatório de uma cafeteria';
const observacoes = 'Aula para iniciantes que já conhecem SELECT, WHERE e JOIN simples. Use uma única cafeteria de bairro, da Dona Lúcia, e estes dados em toda a aula: clientes(id,nome) = (1,Ana),(2,Bruno),(3,Carla); pedidos(id,id_cliente,valor,status) = (1,1,130,PAGO),(2,1,100,PAGO),(3,2,200,PAGO). Ana tem 230, Bruno 200, Carla nenhum pedido; média 430/3. Percurso: a PRIMEIRA pergunta é quais PEDIDOS têm valor acima da média dos PEDIDOS (média 430/3, só o pedido 3 passa); não transforme essa pergunta em média dos totais por cliente. Depois desenvolva a tentativa com AVG no WHERE e correção; subconsulta escalar; IN e NOT IN com armadilha NULL e correção; EXISTS/NOT EXISTS e correlação; tabela derivada, resumir antes de juntar, LEFT JOIN e COALESCE. Introduza explicitamente quaisquer dados novos. Use analogias ligadas à mesma história, perguntas antes de revelar resultados, exercícios com gabarito recolhível e interativos nativos que expliquem os processos. Não use scripts ou CSS próprios. Neste experimento mantenha o escopo da aula aprovada: não introduza média de totais por cliente nem novos clientes. Transferência final: pedidos abaixo da média, cliente com pedido acima de 150 e total por cliente acima de 210. Dados adicionais só em experiências locais anunciadas e restauradas antes de calcular os resultados dos dados-base. Para este percurso completo, busque cerca de 40 slides curtos e 9–12 demonstrações interativas distribuídas, sem transformar cada slide em interativo. A referência tem 47 slides: queremos profundidade e participação próximas, não uma sinopse. Não copie uma aula existente; desenvolva o percurso completo e revise a aritmética.';
const output = join(import.meta.dir, 'output/aula-aprovada', rodada, modo);
assert(!existsSync(output), 'Rodada já existe; use outro nome para preservar os resultados.');
mkdirSync(output, { recursive: true });

function metricas(markdown: string) {
  const slides = dividirEmSlides(markdown);
  const tokens = md.parse(markdown, {});
  const widgets = tokens.filter(t => t.type === 'fence' && t.info.trim() === 'interactive').map(t => parseSlideInteractive(t.content));
  const visible = slides.map(s => s.replace(/```interactive[\s\S]*?```/g, '').replace(/<[^>]+>/g, ' '));
  return {
    slides: slides.length,
    titulos: slides.map(s => s.match(/^#{1,2}\s+(.+)$/m)?.[1] ?? ''),
    interativos: widgets.map(w => ({ tipo: w.type, titulo: w.title })),
    slidesComColunas: slides.filter(s => /class="(?:cols-[234]|grid)[^"]*"/.test(s)).length,
    perguntasDistribuidas: visible.filter(s => /\?/.test(s)).length,
    gabaritos: (markdown.match(/<details\b[^>]*class="gab"/g) ?? []).length,
    blocosSql: tokens.filter(t => t.type === 'fence' && t.info.trim() === 'sql').length,
    tabelas: tokens.filter(t => t.type === 'table_open').length,
    palavrasVisiveisPorSlide: visible.map(s => s.split(/\s+/).filter(Boolean).length),
    errosEstruturais: validarAulaMarp(markdown).erros,
    nota: 'Contagens são indicadores, não uma nota de didática ou correção semântica.',
  };
}
writeFileSync(join(output, 'entrada.json'), JSON.stringify({ tema, observacoes, modo, referenciaPath }, null, 2));
writeFileSync(join(output, 'prompts.json'), JSON.stringify({
  direta: promptAulaDireta({ tema, observacoes }),
  planejador: promptPlanejadorAula({ tema, observacoes }),
}, null, 2));
try {
  const result = await generateAulaOutlineAndContent({ modo, tema, observacoes });
  writeFileSync(join(output, 'aula.md'), result.conteudo_md);
  writeFileSync(join(output, 'aula.html'), generateMarpNextStandaloneHtml(result.titulo_sugerido, result.conteudo_md));
  writeFileSync(join(output, 'outline.json'), result.outline);
  if (modo === 'decomposta') {
    const outline = JSON.parse(result.outline);
    writeFileSync(join(output, 'prompts-secoes.json'), JSON.stringify(outline.secoes.map((_: import('../src/aiAula').AulaOutlineSecao, indiceSecao: number) => promptSecaoAula({ outline, indiceSecao, observacoes })), null, 2));
  }
  const report = { modo, rodada, modelo: result.modelo_utilizado, execucao: result.execucao, avisos: result.avisos ?? [], referencia: metricas(referencia), gerada: metricas(result.conteudo_md) };
  writeFileSync(join(output, 'comparacao.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert(report.gerada.errosEstruturais.length === 0);
} catch (error) {
  writeFileSync(join(output, 'falha.txt'), String(error));
  throw error;
}
