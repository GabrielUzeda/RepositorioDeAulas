import '../src/env';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';

if (!process.argv.includes('--live')) throw new Error('Use --live para autorizar uma geração real com consumo de tokens.');
process.env.DATABASE_PATH ||= join(tmpdir(), 'slide-interactive-eval-test.db');
assert(basename(process.env.DATABASE_PATH).includes('test'), 'Use DATABASE_PATH de teste, nunca o banco real.');

const { generateAulaOutlineAndContent } = await import('../src/ai');
const { generateMarpNextStandaloneHtml } = await import('../src/marp');
const { parseSlideInteractive } = await import('../src/slideInteractive');
const { validarAulaMarp, dividirEmSlides } = await import('../src/aiAula');
const { resolveConfig } = await import('../src/aiProvider');
const config = resolveConfig('aula');
console.log(JSON.stringify({ provider: config.provider, model: config.model, modo: 'direta' }));

const output = join(import.meta.dir, 'output/interativo-direta');
mkdirSync(output, { recursive: true });
const result = await generateAulaOutlineAndContent({
  modo: 'direta',
  tema: 'Diferença entre NULL e zero em um relatório de pedidos',
  observacoes: 'Teste de infraestrutura: produza somente um slide de conteúdo com título ## e um componente nativo compare. Compare Sem COALESCE e Com COALESCE para Carla, cliente sem pedidos. Use a skill de interativos do motor, sem style, script, imports ou controles HTML. Inclua SELECT NULL e SELECT COALESCE(NULL, 0) nos campos code. Não acrescente capa, exercícios ou referências neste teste pontual.',
});
writeFileSync(join(output, 'slide.md'), result.conteudo_md);
const html = generateMarpNextStandaloneHtml(result.titulo_sugerido, result.conteudo_md);
writeFileSync(join(output, 'slide.html'), html);
const tokens = new MarkdownIt().parse(result.conteudo_md, {});
const widgets = tokens.filter(t => t.type === 'fence' && t.info.trim() === 'interactive');
const checks = {
  estrutura: validarAulaMarp(result.conteudo_md).valido,
  componente: widgets.length === 1 && widgets.every(t => parseSlideInteractive(t.content).type === 'compare'),
  sem_codigo_embutido: !/<(?:script|style|button)\b/i.test(result.conteudo_md),
  renderizado: html.includes('data-slide-widget="compare"') && !html.includes('language-interactive'),
  slide_unico: dividirEmSlides(result.conteudo_md).length === 1,
};
const report = { provider: config.provider, model: result.modelo_utilizado, checks, execucao: result.execucao, avisos: result.avisos ?? [] };
writeFileSync(join(output, 'resultado.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
assert(Object.values(checks).every(Boolean), 'A geração não cumpriu todos os critérios. Consulte os artefatos em ' + output);
console.log('Artefatos: ' + output);
