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
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'outlook.com.br': 'outlook.com',
  'yahoo.com.b': 'yahoo.com.br',
  'yaho.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'iclod.com': 'icloud.com',
  'iclou.com': 'icloud.com'
};

export interface EmailValidationResult {
  isValid: boolean;
  suggestion?: string;
  error?: string;
}

export function validateEmailWithTypo(email: string): EmailValidationResult {
  const trimmed = (email || '').trim().toLowerCase();
  if (!trimmed) {
    return { isValid: false, error: 'O e-mail é obrigatório.' };
  }

  const basicRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicRegex.test(trimmed)) {
    return { isValid: false, error: 'Formato de e-mail inválido. Deve conter "@" e domínio com ponto (ex: aluno@escola.com).' };
  }

  const parts = trimmed.split('@');
  if (parts.length === 2) {
    const user = parts[0];
    const domain = parts[1];

    if (COMMON_DOMAIN_TYPOS[domain]) {
      const fixedDomain = COMMON_DOMAIN_TYPOS[domain];
      return {
        isValid: true,
        suggestion: `${user}@${fixedDomain}`
      };
    }
  }

  return { isValid: true };
}
