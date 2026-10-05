import { describe, test, expect, beforeEach } from 'bun:test';
import { secureSet, secureGet, secureRemove, clearAllAlunoSession, isAlunoSessionKey, FOUR_HOURS_MS } from '../src/shared/utils/storage';

class LocalStorageMock {
  private store = new Map<string, string>();
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
  removeItem(key: string) { this.store.delete(key); }
  get length() { return this.store.size; }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null; }
}

const lsMock = new LocalStorageMock();

(globalThis as any).window = { isSecureContext: false };
(globalThis as any).localStorage = lsMock;

describe('secure storage (modo plain sem contexto seguro)', () => {
  beforeEach(() => {
    lsMock.clear();
  });

  test('roundtrip grava e le com expiracao futura', async () => {
    await secureSet('curso_senha_1', 'segredo123');
    expect(await secureGet('curso_senha_1')).toBe('segredo123');
  });

  test('retorna null para chave inexistente', async () => {
    expect(await secureGet('chave_que_nao_existe')).toBeNull();
  });

  test('expiracao customizada negativa invalida imediatamente', async () => {
    await secureSet('k_exp', 'valor', -1000);
    expect(await secureGet('k_exp')).toBeNull();
    expect(lsMock.getItem('k_exp')).toBeNull();
  });

  test('JSON invalido no storage retorna null sem lancar', async () => {
    lsMock.setItem('k_ruim', 'nao-e-json{{{');
    expect(await secureGet('k_ruim')).toBeNull();
  });

  test('prefixo desconhecido retorna null', async () => {
    lsMock.setItem('k_prefix', JSON.stringify({ p: 'xyz:', data: 'abc' }));
    expect(await secureGet('k_prefix')).toBeNull();
  });

  test('payload plain expirado e removido com limpeza', async () => {
    const plain = JSON.stringify({ v: 'velho', exp: Date.now() - 5000 });
    lsMock.setItem('k_velho', JSON.stringify({ p: 'plain', data: plain }));
    expect(await secureGet('k_velho')).toBeNull();
    expect(lsMock.getItem('k_velho')).toBeNull();
  });

  test('payload plain sem exp numerico e tratado como expirado', async () => {
    lsMock.setItem('k_semexp', JSON.stringify({ p: 'plain', data: JSON.stringify({ v: 'x' }) }));
    expect(await secureGet('k_semexp')).toBeNull();
  });

  test('secureRemove apaga a chave', async () => {
    await secureSet('k_del', 'bye');
    expect(await secureGet('k_del')).toBe('bye');
    await secureRemove('k_del');
    expect(await secureGet('k_del')).toBeNull();
  });

  test('sobrescrever chave troca o valor', async () => {
    await secureSet('k_sub', 'v1');
    await secureSet('k_sub', 'v2');
    expect(await secureGet('k_sub')).toBe('v2');
  });

  test('chaves de senha de curso e chaves comuns coexistem', async () => {
    await secureSet('curso_senha_9', 's1');
    await secureSet('outra_chave', 's2');
    expect(await secureGet('curso_senha_9')).toBe('s1');
    expect(await secureGet('outra_chave')).toBe('s2');
  });

  test('valor com unicode sobrevive ao roundtrip', async () => {
    await secureSet('k_uni', 'senhaçãõ日本語');
    expect(await secureGet('k_uni')).toBe('senhaçãõ日本語');
  });

  test('isAlunoSessionKey identifica chaves de sessão e dados do aluno', () => {
    expect(isAlunoSessionKey('alunoNome')).toBe(true);
    expect(isAlunoSessionKey('alunoEmail')).toBe(true);
    expect(isAlunoSessionKey('aluno_qualquer')).toBe(true);
    expect(isAlunoSessionKey('curso_senha_123')).toBe(true);
    expect(isAlunoSessionKey('curso_access_123')).toBe(true);
    expect(isAlunoSessionKey('draft_456')).toBe(true);
    expect(isAlunoSessionKey('consulta_token_789')).toBe(true);
    expect(isAlunoSessionKey('outra_chave_qualquer')).toBe(false);
  });

  test('alunoNome e alunoEmail sao salvos com expiracao de 4 horas', async () => {
    await secureSet('alunoNome', 'Maria Silva');
    await secureSet('alunoEmail', 'maria@escola.com');

    expect(await secureGet('alunoNome')).toBe('Maria Silva');
    expect(await secureGet('alunoEmail')).toBe('maria@escola.com');

    const rawNome = lsMock.getItem('alunoNome') ?? '{}';
    const parsedNome = JSON.parse(rawNome);
    const plainNome = JSON.parse(parsedNome.data);
    expect(plainNome.exp).toBeGreaterThan(Date.now() + FOUR_HOURS_MS - 5000);
    expect(plainNome.exp).toBeLessThanOrEqual(Date.now() + FOUR_HOURS_MS + 1000);
  });

  test('dados do aluno expiram apos 4 horas e sao purgados automaticamente do storage', async () => {
    await secureSet('alunoNome', 'Joao Santos');
    await secureSet('alunoEmail', 'joao@escola.com');
    await secureSet('draft_99', JSON.stringify({ '0': 'Brasília' }));

    // Simula passagem de mais de 4 horas
    const rawNome = JSON.parse(lsMock.getItem('alunoNome') ?? '{}');
    const plainNome = JSON.parse(rawNome.data);
    plainNome.exp = Date.now() - 1000;
    rawNome.data = JSON.stringify(plainNome);
    lsMock.setItem('alunoNome', JSON.stringify(rawNome));

    const rawEmail = JSON.parse(lsMock.getItem('alunoEmail') ?? '{}');
    const plainEmail = JSON.parse(rawEmail.data);
    plainEmail.exp = Date.now() - 1000;
    rawEmail.data = JSON.stringify(plainEmail);
    lsMock.setItem('alunoEmail', JSON.stringify(rawEmail));

    const rawDraft = JSON.parse(lsMock.getItem('draft_99') ?? '{}');
    const plainDraft = JSON.parse(rawDraft.data);
    plainDraft.exp = Date.now() - 1000;
    rawDraft.data = JSON.stringify(plainDraft);
    lsMock.setItem('draft_99', JSON.stringify(rawDraft));

    // secureGet deve retornar null e remover os dados do localStorage
    expect(await secureGet('alunoNome')).toBeNull();
    expect(await secureGet('alunoEmail')).toBeNull();
    expect(await secureGet('draft_99')).toBeNull();

    expect(lsMock.getItem('alunoNome')).toBeNull();
    expect(lsMock.getItem('alunoEmail')).toBeNull();
    expect(lsMock.getItem('draft_99')).toBeNull();
  });

  test('drafts e tokens de consulta de atividades recebem expiracao de 4 horas por padrao', async () => {
    await secureSet('draft_123', '{"0":"opcao_a"}');
    await secureSet('consulta_token_123', 'tok_abc456');

    expect(await secureGet('draft_123')).toBe('{"0":"opcao_a"}');
    expect(await secureGet('consulta_token_123')).toBe('tok_abc456');

    const rawDraft = JSON.parse(lsMock.getItem('draft_123') ?? '{}');
    const plainDraft = JSON.parse(rawDraft.data);
    expect(plainDraft.exp).toBeGreaterThan(Date.now() + FOUR_HOURS_MS - 5000);
    expect(plainDraft.exp).toBeLessThanOrEqual(Date.now() + FOUR_HOURS_MS + 1000);

    const rawTok = JSON.parse(lsMock.getItem('consulta_token_123') ?? '{}');
    const plainTok = JSON.parse(rawTok.data);
    expect(plainTok.exp).toBeGreaterThan(Date.now() + FOUR_HOURS_MS - 5000);
    expect(plainTok.exp).toBeLessThanOrEqual(Date.now() + FOUR_HOURS_MS + 1000);
  });

  test('clearAllAlunoSession remove todas as informacoes de aluno preservando chaves de sistema', async () => {
    await secureSet('alunoNome', 'Carlos Lima');
    await secureSet('alunoEmail', 'carlos@escola.com');
    await secureSet('curso_senha_1', 'pass123');
    await secureSet('curso_access_1', 'granted');
    await secureSet('draft_10', '{"0":"resp"}');
    await secureSet('consulta_token_10', 'tok123');
    await secureSet('chave_professor_sistema', 'prof_data');

    await clearAllAlunoSession();

    expect(await secureGet('alunoNome')).toBeNull();
    expect(await secureGet('alunoEmail')).toBeNull();
    expect(await secureGet('curso_senha_1')).toBeNull();
    expect(await secureGet('curso_access_1')).toBeNull();
    expect(await secureGet('draft_10')).toBeNull();
    expect(await secureGet('consulta_token_10')).toBeNull();

    // Chave do professor/sistema nao e chave de sessao de aluno e permanece
    expect(await secureGet('chave_professor_sistema')).toBe('prof_data');
  });
});
