import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import MarkdownIt from 'markdown-it';
import { parseSlideInteractive } from '../src/slideInteractive';

const dir = join(import.meta.dir, 'referencias');
const fixture = JSON.parse(readFileSync(join(dir, 'interativos-subconsultas.json'), 'utf8')) as {
  widgets: { id: string; source: string; config: unknown }[];
  reference: unknown;
};
const original = readFileSync(join(dir, 'examplo-original.md'), 'utf8');
let markdown = original.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const block = (value: unknown) => {
  const json = JSON.stringify(value);
  parseSlideInteractive(json);
  return '\n\n```interactive\n' + json + '\n```\n\n';
};
for (const widget of fixture.widgets) {
  const start = markdown.indexOf('<div class="subq" id="' + widget.id + '">');
  assert(start >= 0, 'Widget não encontrado: ' + widget.id);
  const tags = /<div\b[^>]*>|<\/div>/gi;
  tags.lastIndex = start;
  let depth = 0, end = -1;
  for (let match = tags.exec(markdown); match; match = tags.exec(markdown)) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) { end = tags.lastIndex; break; }
  }
  assert(end > start, 'Estrutura sem fechamento: ' + widget.id);
  markdown = markdown.slice(0, start) + block(widget.config) + markdown.slice(end);
}
const marker = '\n---\n\n## O problema: uma resposta depende da outra';
assert(markdown.includes(marker));
markdown = markdown.replace(marker, '\n---\n\n## Os dados continuam à mão\n' + block(fixture.reference) + marker);
assert(!/<(?:script|style)\b/i.test(markdown));
assert(!/class="subq"|subq\./.test(markdown));
const tokens = new MarkdownIt({ html: true }).parse(markdown, {});
const widgets = tokens.filter(t => t.type === 'fence' && t.info.trim() === 'interactive');
assert.equal(widgets.length, 19);
widgets.forEach(t => { parseSlideInteractive(t.content); });
writeFileSync(join(dir, 'subconsultas-modular.md'), markdown);
process.env.DATABASE_PATH ||= '/tmp/subconsultas-modular-test.db';
const { generateMarpNextStandaloneHtml } = await import('../src/marp');
const output = join(import.meta.dir, 'output/subconsultas-modular');
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'aula.html'), generateMarpNextStandaloneHtml('Subconsultas — motor nativo', markdown));
console.log(JSON.stringify({ widgets: widgets.length, original_bytes: original.length, modular_bytes: markdown.length, html: join(output, 'aula.html') }, null, 2));
