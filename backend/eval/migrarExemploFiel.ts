import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseSlideInteractive } from '../src/slideInteractive';

const dir = join(import.meta.dir, 'referencias');
export const originalExemplo = readFileSync(join(dir, 'examplo-original.md'), 'utf8');
export const cenasExemplo = JSON.parse(readFileSync(join(dir, 'examplo-cenas.json'), 'utf8')) as {
  widgets: { id: string; config: unknown; snapshots: { id: string; text: string; keys: string[] }[] }[];
};
const reference = JSON.parse(readFileSync(join(dir, 'interativos-subconsultas.json'), 'utf8')).reference;

const tons: Record<string, Record<string, 'success' | 'danger'>> = {
  'subq-ord': { f1: 'danger', f2: 'success' },
};

export function ajustarTom(widget: { id: string; config: unknown }): Record<string, unknown> {
  const tones = tons[widget.id];
  if (!tones) return widget.config as Record<string, unknown>;
  const scene = widget.config as { frames: { id: string; valueTone?: string }[] };
  scene.frames.forEach(frame => {
    const tone = tones[frame.id];
    if (tone) frame.valueTone = tone;
  });
  return scene as Record<string, unknown>;
}

export function substituirWidgets(source: string, replacement: (id: string, index: number) => string): string {
  let markdown = source;
  for (const [index, widget] of cenasExemplo.widgets.entries()) {
    const start = markdown.indexOf('<div class="subq" id="' + widget.id + '">');
    assert(start >= 0, widget.id);
    const tags = /<div\b[^>]*>|<\/div>/gi;
    tags.lastIndex = start;
    let depth = 0, end = -1;
    for (let m = tags.exec(markdown); m; m = tags.exec(markdown)) {
      depth += m[0].startsWith('</') ? -1 : 1;
      if (!depth) { end = tags.lastIndex; break; }
    }
    assert(end > start, widget.id);
    markdown = markdown.slice(0, start) + replacement(widget.id, index) + markdown.slice(end);
  }
  return markdown;
}

export function migrarExemploFiel(): string {
  let markdown = substituirWidgets(originalExemplo, (id) => {
    const json = JSON.stringify(ajustarTom(cenasExemplo.widgets.find(widget => widget.id === id)!));
    parseSlideInteractive(json);
    return '\n\n```interactive\n' + json + '\n```\n\n';
  });
  const annotation = JSON.stringify({ ...reference, annotationOnly: true });
  parseSlideInteractive(annotation);
  let referenceInserted = false;
  markdown = markdown.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, () => {
    if (referenceInserted) return '';
    referenceInserted = true;
    return '\n\n```interactive\n' + annotation + '\n```\n\n';
  });
  assert(referenceInserted);
  assert(!/<(?:script|style)\b/i.test(markdown));
  return markdown;
}

if (import.meta.main) {
  const markdown = migrarExemploFiel();
  const target = join(import.meta.dir, '../../examplo.md');
  if (process.argv.includes('--check')) assert.equal(readFileSync(target, 'utf8'), markdown);
  else writeFileSync(target, markdown);
  process.env.DATABASE_PATH ||= '/tmp/examplo-fiel-test.db';
  const { generateMarpNextStandaloneHtml } = await import('../src/marp');
  const output = join(import.meta.dir, 'output/fiel');
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, 'original.html'), generateMarpNextStandaloneHtml('Subconsultas em Banco de Dados', originalExemplo));
  writeFileSync(join(output, 'aula.html'), generateMarpNextStandaloneHtml('Subconsultas em Banco de Dados', markdown));
  console.log(JSON.stringify({ markdown: target, html: join(output, 'aula.html'), widgets: cenasExemplo.widgets.length }, null, 2));
}
