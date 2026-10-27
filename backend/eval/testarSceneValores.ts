import '../src/env';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';

if (!process.argv.includes('--live')) throw new Error('Use --live para autorizar uma geração real com consumo de tokens.');
const modo = process.argv.includes('--decomposta') ? 'decomposta' : 'direta';
process.env.DATABASE_PATH ||= join(tmpdir(), 'scene-valores-eval-test.db');
assert(basename(process.env.DATABASE_PATH).includes('test'), 'Use DATABASE_PATH de teste, nunca o banco real.');

const { generateAulaOutlineAndContent } = await import('../src/ai');
const { generateMarpNextStandaloneHtml } = await import('../src/marp');
const { parseSlideInteractive } = await import('../src/slideInteractive');
const { validarAulaMarp, dividirEmSlides } = await import('../src/aiAula');
const { resolveConfig } = await import('../src/aiProvider');
const config = resolveConfig('aula');
console.log(JSON.stringify({ provider: config.provider, model: config.model, modo }));

const output = join(import.meta.dir, 'output/scene-valores-' + modo);
mkdirSync(output, { recursive: true });
const result = await generateAulaOutlineAndContent({
  modo,
  tema: 'Somar os pedidos da Ana e do Bruno',
  observacoes: (modo === 'direta' ? 'Teste de infraestrutura: produza somente um slide de conteúdo com título ##. ' : '') + 'Dados fixos para conferência: Pedido 1 (Ana) 130; Pedido 2 (Ana) 100; Pedido 3 (Bruno) 200. A soma dos pedidos da Ana é 230 e o total geral é 430. Use UM componente nativo scene que revele esses valores: rows com os três pedidos, campo value terminando em total 430 e um chart com os três valores. Inclua também code com SELECT AVG(valor) FROM pedidos e focus exatamente em SELECT AVG(valor) FROM pedidos, e uma sequência temporizada (next) que percorra as linhas. Não omita nenhum desses campos. Use a skill de interativos do motor. Sem style, script, imports ou controles HTML.' + (modo === 'direta' ? ' Não acrescente capa, exercícios ou referências neste teste pontual.' : ''),
}).catch((error: Error) => {
  writeFileSync(join(output, 'resultado.json'), JSON.stringify({
    provider: config.provider, model: config.model, modo, falha: error.message,
  }, null, 2));
  throw error;
});
writeFileSync(join(output, 'aula.md'), result.conteudo_md);
const html = generateMarpNextStandaloneHtml(result.titulo_sugerido, result.conteudo_md);
writeFileSync(join(output, 'aula.html'), html);
const tokens = new MarkdownIt().parse(result.conteudo_md, {});
const fences = tokens.filter(t => t.type === 'fence' && t.info.trim() === 'interactive');
const scenes = fences.map(t => parseSlideInteractive(t.content)).filter(c => c.type === 'scene');
const values = scenes.flatMap(c => c.type === 'scene' ? c.frames.map(f => f.value ?? '') : []);
const charts = scenes.flatMap(c => c.type === 'scene' ? c.frames.map(f => f.chart).filter(Boolean) : []);
const frames = scenes.flatMap(c => c.type === 'scene' ? c.frames : []);
const rowPairs = frames.flatMap(f => f.rows ?? []);
const checks = {
  estrutura: validarAulaMarp(result.conteudo_md).valido,
  cena_valida: scenes.length >= 1,
  sem_codigo_embutido: !/<(?:script|style|button)\b/i.test(result.conteudo_md),
  renderizado: html.includes('data-slide-widget="scene"') && !html.includes('language-interactive'),
  ...(modo === 'direta' ? { slide_unico: dividirEmSlides(result.conteudo_md).length === 1 } : {}),
  valores_dos_pedidos: ['130', '100', '200'].every(v => rowPairs.some(r => r.result === v)),
  soma_da_ana: rowPairs.some(r => /Ana/i.test(r.label) && r.result === '230') || frames.some(f => f.value === '230' && (
    /Ana/i.test([f.intro, f.text, f.valuePrefix].join(' ')) ||
    (f.rows ?? []).filter(r => /Ana/i.test(r.label)).reduce((sum, r) => sum + Number(r.result ?? 0), 0) === 230
  )),
  total_geral: values.includes('430'),
  focus_solicitado: frames.some(f => f.focus === 'SELECT AVG(valor) FROM pedidos' && f.code?.includes(f.focus)),
  sequencia_solicitada: frames.some(f => !!f.next),
  grafico_com_os_tres_valores: charts.some(ch => !!ch && [...ch.values].sort((a, b) => a - b).join(',') === '100,130,200' && ch.maximum >= 200),
};
const detalhes = {
  usou_value_tone: frames.some(f => f.valueTone !== undefined),
  usou_code_com_focus: frames.some(f => !!f.focus),
  usou_sequencia_temporizada: frames.some(f => !!f.next),
  quadros: frames.length,
  valores: values,
};
const report = { provider: config.provider, model: result.modelo_utilizado, modo, checks, detalhes, execucao: result.execucao, avisos: result.avisos ?? [] };
writeFileSync(join(output, 'resultado.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
assert(Object.values(checks).every(Boolean), 'A geração não cumpriu todos os critérios. Consulte os artefatos em ' + output);
console.log('Artefatos: ' + output);
