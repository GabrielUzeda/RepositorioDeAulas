import { escaparHtml } from './sanitizeHtml';

export interface LinguagemCodigo {
  id: string;
  label: string;
}

export const LINGUAGENS_CODIGO: LinguagemCodigo[] = [
  { id: 'texto', label: 'Texto (sem realce)' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'sql', label: 'SQL' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'json', label: 'JSON' },
];

const IDS_LINGUAGEM = new Set(LINGUAGENS_CODIGO.map((item) => item.id));

const ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  python3: 'python',
  postgres: 'sql',
  postgresql: 'sql',
  mysql: 'sql',
  sqlite: 'sql',
  htm: 'html',
  vue: 'html',
  scss: 'css',
  less: 'css',
  jsonc: 'json',
  text: 'texto',
  plaintext: 'texto',
  nenhuma: 'texto',
};

export function normalizarLinguagem(valor: string | null | undefined): string {
  const bruto = String(valor ?? '').toLowerCase().trim();
  if (!bruto) return 'texto';
  if (IDS_LINGUAGEM.has(bruto)) return bruto;
  return ALIASES[bruto] ?? 'texto';
}

const ENTIDADES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&nbsp;': ' ',
  '&#039;': "'",
  '&#39;': "'",
  '&apos;': "'",
};

function codepointSeguro(valor: number, original: string): string {
  if (!Number.isFinite(valor) || valor < 0 || valor > 0x10ffff) return original;
  try {
    return String.fromCodePoint(valor);
  } catch {
    return original;
  }
}

export function desescaparHtml(texto: string): string {
  if (!texto) return '';
  return texto
    .replace(/&#x([0-9a-fA-F]{1,6});/g, (original, hex) => codepointSeguro(parseInt(hex, 16), original))
    .replace(/&#(\d{1,7});/g, (original, dec) => codepointSeguro(Number(dec), original))
    .replace(/&(lt|gt|quot|nbsp|#0?39|apos);/g, (original) => ENTIDADES[original] ?? original)
    .replace(/&amp;/g, '&');
}

const RE_BLOCO_CODIGO = /<pre\b[^>]*>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/i;
const RE_CLASSE_LINGUAGEM = /language-([a-z0-9+#._-]+)/i;

export interface CodigoExtraido {
  codigo: string;
  linguagem: string;
}

function normalizarMioloLegado(interno: string): string {
  if (!interno.includes('<')) return interno;
  return interno
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|p|li|h[2-4])>/gi, '\n')
    .replace(/<(?:div|p|li|h[2-4])\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}

export function extrairCodigoDoHtml(html: string | null | undefined): CodigoExtraido | null {
  if (!html) return null;
  const match = String(html).match(RE_BLOCO_CODIGO);
  if (!match) return null;

  const atributos = match[1] ?? '';
  const interno = match[2] ?? '';
  const classe = atributos.match(RE_CLASSE_LINGUAGEM);

  return {
    codigo: desescaparHtml(normalizarMioloLegado(interno)),
    linguagem: normalizarLinguagem(classe?.[1]),
  };
}

export function codigoParaHtml(codigo: string, linguagem: string): string {
  const lang = normalizarLinguagem(linguagem);
  const classe = lang === 'texto' ? '' : ` class="language-${lang}"`;
  return `<pre><code${classe}>${escaparHtml(codigo ?? '')}</code></pre>`;
}

export function ehRespostaEmCodigo(html: string | null | undefined): boolean {
  return extrairCodigoDoHtml(html) !== null;
}
