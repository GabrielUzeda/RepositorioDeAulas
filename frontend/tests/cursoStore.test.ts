import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { setActivePinia, createPinia } from 'pinia';
import { useCursoStore } from '../src/shared/stores/curso';

class StorageMock {
  private store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
  removeItem(key: string) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

(globalThis as any).sessionStorage = new StorageMock();

const originalFetch = globalThis.fetch;

function stubFetch(status: number, body: unknown = {}) {
  (globalThis as any).fetch = async () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  setActivePinia(createPinia());
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('cursoStore devolve o status HTTP (falha != senha incorreta)', () => {
  test('401 identifica senha de curso inválida', async () => {
    stubFetch(401, { error: 'Senha do curso incorreta' });
    expect(await useCursoStore().fetchDisciplinas(1, 'errada')).toBe(401);
  });

  test('500 nao se confunde com senha invalida', async () => {
    stubFetch(500, { error: 'boom' });
    expect(await useCursoStore().fetchDisciplinas(1, 'devweb25')).toBe(500);
  });

  test('200 popula as disciplinas', async () => {
    stubFetch(200, [{ id: 7, nome: 'Disciplina' }]);
    const store = useCursoStore();
    expect(await store.fetchDisciplinas(1, 'devweb25')).toBe(200);
    expect(store.disciplinas.length).toBe(1);
  });

  test('falha de rede devolve 0 sem apagar a senha guardada no cliente', async () => {
    (globalThis as any).fetch = async () => {
      throw new Error('sem rede');
    };
    const store = useCursoStore();
    expect(await store.fetchDisciplinas(1, 'devweb25')).toBe(0);
    expect(store.disciplinas.length).toBe(0);
  });

  test('loadDisciplinaContent devolve o pior status do par de requisicoes', async () => {
    let call = 0;
    (globalThis as any).fetch = async () => {
      call += 1;
      return new Response(JSON.stringify(call === 1 ? [] : { error: 'x' }), {
        status: call === 1 ? 200 : 401,
        headers: { 'content-type': 'application/json' },
      });
    };
    expect(await useCursoStore().loadDisciplinaContent(3, 'devweb25')).toBe(401);
  });
});
