export function extractTextFromBuffer(buffer: Uint8Array, filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (['txt', 'md', 'markdown', 'json', 'csv', 'yaml', 'yml'].includes(ext)) {
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer).trim();
  }

  if (ext === 'pdf') {
    return extractTextFromPdf(buffer);
  }

  // Fallback UTF-8 decode
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  return decoded.replace(/[^\x20-\x7E\n\r\t\u00A0-\u00FF\u0100-\u017F]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function extractTextFromPdf(buffer: Uint8Array): string {
  const raw = new TextDecoder('latin1').decode(buffer);
  const textChunks: string[] = [];

  const tjRegex = /\(([^)]*)\)\s*Tj/g;
  let match: RegExpExecArray | null = tjRegex.exec(raw);
  while (match !== null) {
    if (match[1]?.trim()) {
      textChunks.push(cleanPdfString(match[1]));
    }
    match = tjRegex.exec(raw);
  }

  const arrayTjRegex = /\[(.*?)\]\s*TJ/g;
  match = arrayTjRegex.exec(raw);
  while (match !== null) {
    const inner = match[1] || '';
    const innerRegex = /\(([^)]*)\)/g;
    let innerMatch: RegExpExecArray | null = innerRegex.exec(inner);
    let combined = '';
    while (innerMatch !== null) {
      combined += innerMatch[1] || '';
      innerMatch = innerRegex.exec(inner);
    }
    if (combined.trim()) {
      textChunks.push(cleanPdfString(combined));
    }
    match = arrayTjRegex.exec(raw);
  }

  if (textChunks.length > 0) {
    return textChunks.join(' ').replace(/\s+/g, ' ').trim();
  }

  const readable = raw.replace(/[^\x20-\x7E\n\r\t\u00A0-\u00FF\u0100-\u017F]/g, ' ');
  return readable.replace(/\s+/g, ' ').trim();
}

function cleanPdfString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}
