import { describe, test, expect, beforeEach } from 'bun:test';
import { secureSet, secureGet, secureRemove } from '../src/shared/utils/storage';

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
});
