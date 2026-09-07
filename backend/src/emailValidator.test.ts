import { describe, expect, test } from 'bun:test';
import { validateEmailWithTypo, isDomainKnown, KNOWN_DOMAINS } from './emailValidator';

describe('Email Validator (MEL-05)', () => {
  test('rejeita e-mails vazios ou sem formato válido', () => {
    expect(validateEmailWithTypo('').isValid).toBe(false);
    expect(validateEmailWithTypo('invalido').isValid).toBe(false);
    expect(validateEmailWithTypo('aluno@').isValid).toBe(false);
    expect(validateEmailWithTypo('aluno@dominio').isValid).toBe(false);
    expect(validateEmailWithTypo('aluno@.com').isValid).toBe(false);
  });

  test('detecta erros comuns de digitação em provedores populares (sugestão)', () => {
    const res1 = validateEmailWithTypo('aluno@gmai.com');
    expect(res1.isValid).toBe(true);
    expect(res1.suggestion).toBe('aluno@gmail.com');
    expect(res1.warning).toContain('gmail.com');

    const res2 = validateEmailWithTypo('maria@hotmial.com');
    expect(res2.isValid).toBe(true);
    expect(res2.suggestion).toBe('maria@hotmail.com');

    const res3 = validateEmailWithTypo('joao@outlok.com');
    expect(res3.isValid).toBe(true);
    expect(res3.suggestion).toBe('joao@outlook.com');
  });

  test('reconhece provedores conhecidos sem aviso de domínio desconhecido', () => {
    const resGmail = validateEmailWithTypo('aluno@gmail.com');
    expect(resGmail.isValid).toBe(true);
    expect(resGmail.isKnownDomain).toBe(true);
    expect(resGmail.warning).toBeUndefined();

    const resOutlook = validateEmailWithTypo('prof@outlook.com');
    expect(resOutlook.isValid).toBe(true);
    expect(resOutlook.isKnownDomain).toBe(true);
    expect(resOutlook.warning).toBeUndefined();

    const resEdu = validateEmailWithTypo('estudante@universidade.edu.br');
    expect(resEdu.isValid).toBe(true);
    expect(resEdu.isKnownDomain).toBe(true);
    expect(resEdu.warning).toBeUndefined();
  });

  test('emite feedback de aviso quando o domínio não é um provedor comum conhecido', () => {
    const resDesconhecido = validateEmailWithTypo('usuario@provedorexotico123.com');
    expect(resDesconhecido.isValid).toBe(true);
    expect(resDesconhecido.isKnownDomain).toBe(false);
    expect(resDesconhecido.warning).toBeDefined();
    expect(resDesconhecido.warning).toContain('não é um provedor comum');
  });
});
