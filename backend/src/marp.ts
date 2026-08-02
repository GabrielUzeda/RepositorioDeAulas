import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { sanitizeSlug } from './utils';

function resolveFrontendDir(): string {
  if (process.env.FRONTEND_STATIC_DIR) return process.env.FRONTEND_STATIC_DIR;
  if (existsSync('/app/frontend_static')) return '/app/frontend_static';
  return path.join(import.meta.dir, '..', '..', 'frontend');
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
  turmaSlug: string,
  titulo: string,
  mdContent: string
): { caminho?: string; error?: string } {
  const slug = sanitizeSlug(titulo);
  const baseDir = path.join(resolveFrontendDir(), 'turmas', turmaSlug, 'aulas');
  mkdirSync(baseDir, { recursive: true });

  const mdPath = path.join(baseDir, `${slug}.md`);
  const htmlPath = path.join(baseDir, `${slug}.html`);

  let content = mdContent;
  if (!content.includes('mermaid.initialize')) {
    content +=
      '\n\n<script type="module">\n  import mermaid from "https://esm.sh/mermaid@10";\n  mermaid.initialize({ startOnLoad: true, theme: \'default\' });\n</script>';
  }
  content = content.replace(/```mermaid\s*([\s\S]*?)```/g, '<div class="mermaid">$1</div>');

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
    });
  } catch (e: any) {
    return { error: `Failed to execute marp: ${e.message}` };
  }

  if (output.error) {
    return { error: `Failed to execute marp: ${output.error.message}` };
  }
  if (output.status !== 0) {
    return { error: `Marp failed: ${output.stderr}` };
  }

  return { caminho: `turmas/${turmaSlug}/aulas/${slug}.html` };
}
