import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { sanitizeSlug } from './utils';

export function resolveFrontendDir(): string {
  if (process.env.FRONTEND_STATIC_DIR) return process.env.FRONTEND_STATIC_DIR;
  if (existsSync('/app/frontend_static')) return '/app/frontend_static';
  return path.join(import.meta.dir, '..', '..', 'frontend', 'src');
}

function resolveMarp(): { cmd: string; args: string[] } {
  const inPath = Bun.which('marp');
  if (inPath) return { cmd: inPath, args: [] };
  const cliJs = path.join(import.meta.dir, '..', 'node_modules', '@marp-team', 'marp-cli', 'marp-cli.js');
  if (existsSync(cliJs)) {
    const bun = Bun.which('bun');
    if (bun) return { cmd: bun, args: [cliJs] };
  }
  const local = path.join(import.meta.dir, '..', 'node_modules', '.bin', 'marp');
  if (existsSync(local)) return { cmd: local, args: [] };
  throw new Error('marp not found');
}

export function processMarpContent(
  materiaSlug: string,
  titulo: string,
  mdContent: string
): { caminho?: string; error?: string } {
  const slug = sanitizeSlug(titulo);
  if (materiaSlug.includes('/') || materiaSlug.includes('\\') || materiaSlug.includes('..')) {
    return { error: 'Invalid materia slug' };
  }
  const baseDir = path.join(resolveFrontendDir(), 'materias', materiaSlug, 'aulas');
  mkdirSync(baseDir, { recursive: true });

  const mdPath = path.join(baseDir, `${slug}.md`);
  const htmlPath = path.join(baseDir, `${slug}.html`);

  let content = mdContent;
  if (!content.includes('mermaid.initialize')) {
    content +=
      '\n\n<script type="module">\n  import mermaid from "https://esm.sh/mermaid@10";\n  mermaid.initialize({ startOnLoad: true, theme: \'default\' });\n</script>';
  }
  content = content.replace(/```mermaid\s*([\s\S]*?)```/g, (_, code) => `<div class="mermaid">${code}</div>`);

  try {
    writeFileSync(mdPath, content);
  } catch (e: any) {
    return { error: `Failed to write MD file: ${e.message}` };
  }

  let output;
  try {
    const { cmd, args } = resolveMarp();
    output = spawnSync(cmd, [...args, mdPath, '--html', '-o', htmlPath], {
      encoding: 'utf8',
      timeout: 30000,
    });
  } catch (e: any) {
    return { error: `Failed to execute marp: ${e.message}` };
  }

  if (output.error) {
    return { error: `Failed to execute marp: ${output.error.message}` };
  }
  if (output.status !== 0) {
    const detail = output.stderr || (output.signal ? `Terminated by signal ${output.signal}` : 'Unknown process error');
    return { error: `Marp failed: ${detail}` };
  }
  if (!existsSync(htmlPath)) {
    return { error: 'Marp completed but HTML output file was not created.' };
  }

  return { caminho: `materias/${materiaSlug}/aulas/${slug}.html` };
}
