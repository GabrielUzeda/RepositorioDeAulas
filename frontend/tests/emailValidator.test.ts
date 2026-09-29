import { describe, expect, test } from 'bun:test';
import { validateEmailWithTypo, isDomainKnown, KNOWN_DOMAINS } from '../src/shared/utils/emailValidator';

describe('emailValidator', () => {
  describe('isDomainKnown', () => {
    test('reconhece domínios conhecidos', () => {
      expect(isDomainKnown('gmail.com')).toBe(true);
      expect(isDomainKnown('OUTLOOK.COM')).toBe(true);
      expect(isDomainKnown('uol.com.br')).toBe(true);
      expect(isDomainKnown('proton.me')).toBe(true);
    });

    test('reconhece sufixos institucionais (.edu.br, .gov.br, etc.)', () => {
      expect(isDomainKnown('escola.edu.br')).toBe(true);
      expect(isDomainKnown('prefeitura.gov.br')).toBe(true);
      expect(isDomainKnown('universidade.edu')).toBe(true);
      expect(isDomainKnown('ministerio.gov')).toBe(true);
    });

    test('retorna falso para domínios desconhecidos', () => {
      expect(isDomainKnown('desconhecido12345.com')).toBe(false);
      expect(isDomainKnown('')).toBe(false);
    });
  });

  describe('validateEmailWithTypo', () => {
    test('valida e-mails corretos e conhecidos', () => {
      const res = validateEmailWithTypo('aluno@gmail.com');
      expect(res.isValid).toBe(true);
      expect(res.isKnownDomain).toBe(true);
      expect(res.warning).toBeUndefined();
      expect(res.suggestion).toBeUndefined();
    });

    test('trata e-mails com espaços extras e letras maiúsculas', () => {
      const res = validateEmailWithTypo('  ALUNO@GMAIL.COM  ');
      expect(res.isValid).toBe(true);
      expect(res.isKnownDomain).toBe(true);
    });

    test('rejeita e-mails vazios ou nulos', () => {
      expect(validateEmailWithTypo('')).toEqual({
        isValid: false,
        error: 'O e-mail é obrigatório.',
      });
      expect(validateEmailWithTypo('   ')).toEqual({
        isValid: false,
        error: 'O e-mail é obrigatório.',
      });
      expect(validateEmailWithTypo(null as unknown as string)).toEqual({
        isValid: false,
        error: 'O e-mail é obrigatório.',
      });
    });

    test('rejeita formatos inválidos sem @ ou domínio', () => {
      const invalid = ['aluno', 'aluno@', '@gmail.com', 'aluno@.com', 'aluno@dominio'];
      for (const email of invalid) {
        const res = validateEmailWithTypo(email);
        expect(res.isValid).toBe(false);
        expect(res.error).toBeDefined();
      }
    });

    test('detecta e sugere correção para erros comuns de digitação em domínios', () => {
      const typos: Record<string, string> = {
        'aluno@gmai.com': 'aluno@gmail.com',
        'teste@gamil.com': 'teste@gmail.com',
        'user@hotmial.com': 'user@hotmail.com',
        'user@outlok.com': 'user@outlook.com',
        'user@yaho.com': 'user@yahoo.com',
        'user@iclod.com': 'user@icloud.com',
        'user@uol.com': 'user@uol.com.br',
        'user@bol.com': 'user@bol.com.br',
      };

      for (const [input, expectedSuggestion] of Object.entries(typos)) {
        const res = validateEmailWithTypo(input);
        expect(res.isValid).toBe(true);
        expect(res.isKnownDomain).toBe(true);
        expect(res.suggestion).toBe(expectedSuggestion);
        expect(res.warning).toBeDefined();
      }
    });

    test('permite domínios locais ou de teste (localhost, test, local, internal)', () => {
      const localEmails = ['user@localhost', 'user@test', 'user@local', 'admin@internal'];
      for (const email of localEmails) {
        const res = validateEmailWithTypo(email);
        expect(res.isValid).toBe(true);
        expect(res.isKnownDomain).toBe(true);
        expect(res.suggestion).toBeUndefined();
      }
    });

    test('avisa quando o domínio é válido mas não é um provedor comum', () => {
      const res = validateEmailWithTypo('usuario@meudominioespecial.com');
      expect(res.isValid).toBe(true);
      expect(res.isKnownDomain).toBe(false);
      expect(res.warning).toContain('não é um provedor comum');
    });

    test('rejeita e-mail com multiplos @ ou espacos internos', () => {
      for (const email of ['a@b@c.com', 'aluno @gmail.com', 'alu no@gmail.com']) {
        expect(validateEmailWithTypo(email).isValid).toBe(false);
      }
    });

    test('sugere correcao para typos a 1 de distancia em provedores populares', () => {
      const res = validateEmailWithTypo('user@outloo.com');
      expect(res.suggestion).toBe('user@outlook.com');
      const res2 = validateEmailWithTypo('user@hotmal.com');
      expect(res2.suggestion).toBe('user@hotmail.com');
      const res3 = validateEmailWithTypo('user@iclou.com');
      expect(res3.suggestion).toBe('user@icloud.com');
    });

    test('transposicoes distantes (gmial, yhoo) nao geram sugestao falsa', () => {
      for (const email of ['user@gmial.com', 'user@yhoo.com', 'user@gmal.com']) {
        const res = validateEmailWithTypo(email);
        expect(res.isValid).toBe(true);
        expect(res.suggestion).toBeUndefined();
      }
    });

    test('nao sugere para dominios desconhecidos distantes de conhecidos', () => {
      const res = validateEmailWithTypo('user@qwertyxyz123.com');
      expect(res.isValid).toBe(true);
      expect(res.suggestion).toBeUndefined();
    });

    test('trata undefined e tipos nao-string sem lancar', () => {
      expect(validateEmailWithTypo(undefined as unknown as string).isValid).toBe(false);
      expect(validateEmailWithTypo(123 as unknown as string).isValid).toBe(false);
    });

    test('e-mail com ponto e plus no local part e valido', () => {
      const res = validateEmailWithTypo('nome.sobrenome+tag@gmail.com');
      expect(res.isValid).toBe(true);
      expect(res.isKnownDomain).toBe(true);
    });
  });
});
