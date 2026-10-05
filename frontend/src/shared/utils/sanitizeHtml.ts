export const TAGS_PERMITIDAS = new Set([
  'HTML', 'HEAD', 'BODY',
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'H2', 'H3', 'H4',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'SPAN', 'DIV'
]);

const ATRIBUTOS_PERMITIDOS: Record<string, Set<string>> = {
  PRE: new Set(['class']),
  CODE: new Set(['class']),
  SPAN: new Set(['class'])
};

export function sanitizarHtml(html: string): string {
  if (!html) return '';

  if (typeof DOMParser === 'undefined') {
    return escaparHtml(html);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const perigosas = doc.querySelectorAll('script, iframe, object, embed, form, input, button, select, textarea, svg, math, template, noscript, style, link, meta, base, applet, audio, video');
  for (const el of Array.from(perigosas)) {
    el.remove();
  }

  const sanitizarNo = (node: Node): void => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toUpperCase();

      if (!TAGS_PERMITIDAS.has(tagName)) {
        const parent = el.parentNode;
        while (el.firstChild) {
          parent?.insertBefore(el.firstChild, el);
        }
        parent?.removeChild(el);
        return;
      }

      const permitidosParaTag = ATRIBUTOS_PERMITIDOS[tagName] || new Set<string>();
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const attrName = attr.name.toLowerCase();
        const attrValue = attr.value.trim().toLowerCase();

        if (
          attrName.startsWith('on') ||
          attrValue.startsWith('javascript:') ||
          attrValue.startsWith('data:') ||
          attrValue.startsWith('vbscript:') ||
          !permitidosParaTag.has(attrName)
        ) {
          el.removeAttribute(attr.name);
        }
      }
    }

    const filhos = Array.from(node.childNodes);
    for (const filho of filhos) {
      sanitizarNo(filho);
    }
  };

  sanitizarNo(doc.body);
  return doc.body.innerHTML;
}

export function htmlParaTexto(html: string | null | undefined): string {
  if (!html) return '';
  if (!contemHtml(html)) return html;

  const comQuebras = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/(p|h[2-4]|li|blockquote|pre|div)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  return comQuebras
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function contemHtml(texto: string | null | undefined): boolean {
  if (!texto) return false;
  return /<\/?(p|br|strong|b|em|i|u|s|h[2-4]|ul|ol|li|blockquote|pre|code|span|div)\b[^>]*>/i.test(texto);
}

export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
