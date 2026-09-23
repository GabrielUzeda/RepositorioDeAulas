const ORDER_SENSITIVE_PATTERNS = [
  /\b(nenhuma|nenhum|todas|todos)\b/i,
  /\balternativas?\b/i,
  /\bopç(ão|ões)\b/i,
  /\b(itens?|acima|abaixo|anteriores|seguintes|respectivamente)\b/i,
  /\b(verdadeiro|falso|afirmativas?|assertivas?)\b/i,
  /^(i{1,3}|iv|v|vi{0,3}|ix|x|xi{0,3})$/i,
  /\b(I{1,3}|IV|V|VI{0,3}|IX|X|XI{0,3})\b/,
];

export function shuffleArray<T>(items: readonly T[]): T[] {
  const out = [...(items || [])];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
}

export function isOrderSensitiveOption(option: { text?: string } | string | null | undefined): boolean {
  const text = typeof option === 'string' ? option : option?.text;
  if (!text) return false;
  const normalized = String(text).trim();
  return ORDER_SENSITIVE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function shuffleQuestionOptions<T extends { options?: any[] }>(questions: readonly T[] | null | undefined): T[] {
  return [...(questions || [])].map((question) => {
    const options = question?.options;
    if (!Array.isArray(options) || options.length < 2) return question;
    if (options.some(isOrderSensitiveOption)) return question;
    return { ...question, options: shuffleArray(options) };
  });
}
