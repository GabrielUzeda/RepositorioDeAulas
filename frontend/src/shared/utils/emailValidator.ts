const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmeil.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.com.br': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmmail.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'outlook.com.br': 'outlook.com',
  'yahoo.com.b': 'yahoo.com.br',
  'yaho.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yaho.com.br': 'yahoo.com.br',
  'yahooo.com': 'yahoo.com',
  'iclod.com': 'icloud.com',
  'iclou.com': 'icloud.com',
  'uol.com': 'uol.com.br',
  'bol.com': 'bol.com.br'
};

export const KNOWN_DOMAINS = new Set([
  // Google
  'gmail.com',
  'googlemail.com',
  // Microsoft
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'outlook.com.br',
  'hotmail.com.br',
  'live.com.pt',
  // Yahoo
  'yahoo.com',
  'yahoo.com.br',
  'ymail.com',
  'myyahoo.com',
  // Apple
  'icloud.com',
  'me.com',
  'mac.com',
  // Provedores populares BR
  'uol.com.br',
  'bol.com.br',
  'terra.com.br',
  'ig.com.br',
  'globo.com',
  'globomail.com',
  'oi.com.br',
  'r7.com',
  'zipmail.com.br',
  // Outros provedores globais conhecidos
  'proton.me',
  'protonmail.com',
  'pm.me',
  'zoho.com',
  'zoho.eu',
  'aol.com',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'yandex.com'
]);

const KNOWN_INSTITUTIONAL_SUFFIXES = [
  '.edu.br',
  '.edu',
  '.gov.br',
  '.gov',
  '.mil.br',
  '.mil',
  '.org.br',
  '.org',
  '.ac.uk',
  '.school',
  '.ensino.br'
];

export interface EmailValidationResult {
  isValid: boolean;
  isKnownDomain?: boolean;
  suggestion?: string;
  warning?: string;
  error?: string;
}

export function isDomainKnown(domain: string): boolean {
  const d = (domain || '').toLowerCase().trim();
  if (KNOWN_DOMAINS.has(d)) return true;
  return KNOWN_INSTITUTIONAL_SUFFIXES.some(suffix => d.endsWith(suffix));
}

export function validateEmailWithTypo(email: string): EmailValidationResult {
  const trimmed = (email || '').trim().toLowerCase();
  if (!trimmed) {
    return { isValid: false, error: 'O e-mail é obrigatório.' };
  }

  const basicRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+$/;
  if (!basicRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Formato de e-mail inválido. Deve conter "@" e um domínio válido (ex: aluno@escola.com).'
    };
  }

  const parts = trimmed.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { isValid: false, error: 'Formato de e-mail inválido.' };
  }

  const user = parts[0];
  const domain = parts[1];

  const isLocalOrTestDomain = ['local', 'localhost', 'test', 'internal'].includes(domain);
  const domainRegex = /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*(?:\.[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)+$/;

  if (!isLocalOrTestDomain && !domainRegex.test(domain)) {
    return {
      isValid: false,
      error: 'Formato de e-mail inválido. O domínio deve conter uma extensão válida (ex: .com ou .edu.br).'
    };
  }

  // 1. Checagem de erros de digitação comuns nos domínios
  if (COMMON_DOMAIN_TYPOS[domain]) {
    const fixedDomain = COMMON_DOMAIN_TYPOS[domain];
    return {
      isValid: true,
      isKnownDomain: true,
      suggestion: `${user}@${fixedDomain}`,
      warning: `Você quis dizer @${fixedDomain}?`
    };
  }

  // 2. Ambientes locais de teste (e2e/dev)
  if (isLocalOrTestDomain) {
    return { isValid: true, isKnownDomain: true };
  }

  // 3. Checagem de domínio conhecido vs desconhecido
  const known = isDomainKnown(domain);
  if (!known) {
    return {
      isValid: true,
      isKnownDomain: false,
      warning: `Aviso: "@${domain}" não é um provedor comum (como Gmail, Outlook, Yahoo). Certifique-se de que o endereço está correto para não perder o comprovante e notas.`
    };
  }

  return { isValid: true, isKnownDomain: true };
}
