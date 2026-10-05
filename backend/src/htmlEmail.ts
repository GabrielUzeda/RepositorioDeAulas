const TAGS_PERMITIDAS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'span',
  'div',
  'a',
]);

const TAGS_VAZIAS = new Set(['br']);

const ATRIBUTOS_PERMITIDOS: Record<string, Set<string>> = {
  a: new Set(['href']),
};

const PROTOCOLOS_PERMITIDOS = /^(https?:|mailto:)/i;

const ESTILO_PRE =
  'background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:10px;font-family:ui-monospace,Consolas,monospace;font-size:12px;white-space:pre-wrap;word-break:break-word;';
const ESTILO_CODE = 'font-family:ui-monospace,Consolas,monospace;font-size:12px;color:#0f172a;';

const RE_BLOCO_PERIGOSO =
  /<(script|style|iframe|object|embed|template|noscript|svg|math|form|textarea|title|head|applet|link|meta|base)\b[\s\S]*?<\/\1\s*>/gi;

const RE_TAG_PERIGOSA_SOLTA =
  /<\/?(script|style|iframe|object|embed|template|noscript|svg|math|form|textarea|title|head|applet|link|meta|base)\b[^>]*>/gi;

const RE_TAG = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

const RE_ATRIBUTO = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>`]+)))?/g;

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function removerTagsHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/<(p|div|li|h[2-4]|blockquote|pre|br|tr)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escaparTextoSeguro(texto: string): string {
  return texto
    .replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#x[0-9a-fA-F]{1,6});)/g, '&amp;')
    .replace(/</g, '&lt;');
}

function filtrarAtributos(nomeTag: string, bruto: string): string {
  if (nomeTag === 'pre') return ` style="${ESTILO_PRE}"`;
  if (nomeTag === 'code') return ` style="${ESTILO_CODE}"`;

  const permitidos = ATRIBUTOS_PERMITIDOS[nomeTag];
  if (!permitidos || permitidos.size === 0) return '';

  let saida = '';
  for (const match of bruto.matchAll(RE_ATRIBUTO)) {
    const nome = match[1].toLowerCase();
    const valor = String(match[2] ?? match[3] ?? match[4] ?? '').trim();
    if (!permitidos.has(nome)) continue;
    if (nome === 'href') {
      if (!PROTOCOLOS_PERMITIDOS.test(valor)) continue;
      if (temCaractereInvalido(valor)) continue;
      saida += ` href="${escapeHtml(valor)}"`;
    }
  }
  return saida;
}

function temCaractereInvalido(valor: string): boolean {
  for (const caractere of valor) {
    if (/\s/.test(caractere)) return true;
    if (caractere.charCodeAt(0) < 0x20) return true;
  }
  return false;
}

function normalizarTag(bruto: string, nomeCapturado: string): string {
  const nome = nomeCapturado.toLowerCase();
  if (!TAGS_PERMITIDAS.has(nome)) return '';

  if (bruto.startsWith('</')) return `</${nome}>`;

  if (TAGS_VAZIAS.has(nome) || bruto.endsWith('/>')) return `<${nome}/>`;

  const brutoAtributos = bruto.slice(1 + nomeCapturado.length, bruto.endsWith('/>') ? -2 : -1);
  return `<${nome}${filtrarAtributos(nome, brutoAtributos)}>`;
}

export function sanitizarHtmlEmail(html: string): string {
  if (!html) return '';

  let limpo = html.replace(RE_BLOCO_PERIGOSO, ' ');
  limpo = limpo.replace(RE_TAG_PERIGOSA_SOLTA, ' ');

  let saida = '';
  let ultimo = 0;
  for (const match of limpo.matchAll(RE_TAG)) {
    const indice = match.index ?? 0;
    saida += escaparTextoSeguro(limpo.slice(ultimo, indice));
    saida += normalizarTag(match[0], match[1]);
    ultimo = indice + match[0].length;
  }
  saida += escaparTextoSeguro(limpo.slice(ultimo));

  return saida;
}

export function renderEmailHtmlContent(text: string): string {
  if (!text) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return sanitizarHtmlEmail(text);
  }
  return escapeHtml(text).replace(/\n/g, '<br/>');
}
