import '../src/env';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import MarkdownIt from 'markdown-it';

if (!process.argv.includes('--live')) throw new Error('Use --live para autorizar consumo de tokens.');
process.env.DATABASE_PATH ||= join(tmpdir(), 'catalogo-interativos-test.db');
assert(basename(process.env.DATABASE_PATH).includes('test'), 'Use um banco de teste.');
const { generateAulaOutlineAndContent } = await import('../src/ai');
const { generateMarpNextStandaloneHtml } = await import('../src/marp');
const { parseSlideInteractive } = await import('../src/slideInteractive');
const { dividirEmSlides } = await import('../src/aiAula');
const types = ['steps', 'compare', 'bars', 'scan', 'group', 'reference'];
const result = await generateAulaOutlineAndContent({
  modo: 'direta',
  tema: 'Subconsultas com dados de uma lanchonete',
  observacoes: 'Teste de capacidade do catálogo do motor. Gere exatamente 6 slides curtos de conteúdo, um para cada tipo nativo: steps (código destacado e contador), compare (NULL/COALESCE com linhas e chips), bars (AVG/MAX com operadores e novo pedido de 300), scan (EXISTS/COUNT com parada no primeiro achado), group (pedidos de Ana 130 e 100; Bruno 200), reference (tabelas clientes/pedidos no tooltip). Um fence interactive por slide. Use a skill; sem CSS, JS, imports ou controles HTML. Não acrescente capa, síntese ou exercícios neste teste.',
});
const output = join(import.meta.dir, 'output/catalogo-direta');
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'aula.md'), result.conteudo_md);
writeFileSync(join(output, 'aula.html'), generateMarpNextStandaloneHtml(result.titulo_sugerido, result.conteudo_md));
const widgets = new MarkdownIt().parse(result.conteudo_md, {}).filter(t => t.type === 'fence' && t.info.trim() === 'interactive').map(t => parseSlideInteractive(t.content));
const checks = {
  seis_slides: dividirEmSlides(result.conteudo_md).length === 6,
  seis_componentes: widgets.length === 6,
  todos_os_tipos: types.every(type => widgets.some(w => w.type === type)),
  sem_scripts_estilos: !/<(?:script|style|button)\b/i.test(result.conteudo_md),
};
const report = { checks, tipos: widgets.map(w => w.type), modelo: result.modelo_utilizado, execucao: result.execucao, avisos: result.avisos ?? [] };
writeFileSync(join(output, 'resultado.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
assert(Object.values(checks).every(Boolean), 'A via direta não cumpriu o teste completo; consulte ' + output);
