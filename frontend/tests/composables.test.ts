import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { useAutoSave } from '../src/shared/composables/useAutoSave';
import { useAiJob } from '../src/shared/composables/useAiJob';
import { apiClient } from '../src/shared/api/client';

// Setup Mock Environment
class LocalStorageMock {
  private store: Map<string, string> = new Map();
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
  removeItem(key: string) { this.store.delete(key); }
  get length() { return this.store.size; }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null; }
}

const lsMock = new LocalStorageMock();
const listeners = new Map<string, Set<EventListener>>();

const mockWindow = {
  localStorage: lsMock,
  addEventListener: (event: string, cb: EventListener) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(cb);
  },
  removeEventListener: (event: string, cb: EventListener) => {
    listeners.get(event)?.delete(cb);
  },
  dispatchEvent: (event: Event) => {
    const set = listeners.get(event.type);
    if (set) {
      for (const cb of set) {
        cb(event);
      }
    }
    return true;
  },
};

(globalThis as any).window = mockWindow;
(globalThis as any).localStorage = lsMock;
(globalThis as any).navigator = { onLine: true };

describe('useAutoSave composable', () => {
  const testKey = 'test:autosave:key_1';

  beforeEach(() => {
    lsMock.clear();
  });

  afterEach(() => {
    lsMock.clear();
  });

  test('salva e restaura rascunho corretamente no localStorage', () => {
    const { saveDraft, restoreDraft, hasDraft, draftLastSaved } = useAutoSave<{ title: string; count: number }>({
      key: testKey,
    });

    expect(hasDraft.value).toBe(false);
    expect(draftLastSaved.value).toBeNull();

    const payload = { title: 'Aula de TypeScript', count: 10 };
    const saved = saveDraft(payload);
    expect(saved).toBe(true);
    expect(hasDraft.value).toBe(true);
    expect(draftLastSaved.value).not.toBeNull();

    const restored = restoreDraft();
    expect(restored).toEqual(payload);
  });

  test('limpa rascunho com clearDraft', () => {
    const { saveDraft, restoreDraft, clearDraft, hasDraft } = useAutoSave<{ prompt: string }>({
      key: testKey,
    });

    saveDraft({ prompt: 'Gerar 5 perguntas' });
    expect(hasDraft.value).toBe(true);

    clearDraft();
    expect(hasDraft.value).toBe(false);
    expect(restoreDraft()).toBeNull();
    expect(lsMock.getItem(testKey)).toBeNull();
  });

  test('executa onRestore callback quando restoreDraft é chamado', () => {
    let restoredCallbackData: any = null;
    const { saveDraft, restoreDraft } = useAutoSave<{ theme: string }>({
      key: testKey,
      onRestore: (data) => {
        restoredCallbackData = data;
      },
    });

    saveDraft({ theme: 'dark' });
    const restored = restoreDraft();

    expect(restored).toEqual({ theme: 'dark' });
    expect(restoredCallbackData).toEqual({ theme: 'dark' });
  });

  test('agenda auto-save com debounce', async () => {
    const { scheduleAutoSave, restoreDraft } = useAutoSave<{ content: string }>({
      key: testKey,
      debounceMs: 50,
    });

    scheduleAutoSave({ content: 'primeira versao' });
    scheduleAutoSave({ content: 'segunda versao' });

    expect(restoreDraft()).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(restoreDraft()).toEqual({ content: 'segunda versao' });
  });

  test('isolamento de rascunhos entre chaves diferentes', () => {
    const autoSave1 = useAutoSave<{ text: string }>({ key: 'autosave:disc_1' });
    const autoSave2 = useAutoSave<{ text: string }>({ key: 'autosave:disc_2' });

    autoSave1.saveDraft({ text: 'Rascunho disciplina 1' });
    autoSave2.saveDraft({ text: 'Rascunho disciplina 2' });

    expect(autoSave1.restoreDraft()).toEqual({ text: 'Rascunho disciplina 1' });
    expect(autoSave2.restoreDraft()).toEqual({ text: 'Rascunho disciplina 2' });

    autoSave1.clearDraft();
    expect(autoSave1.hasDraft.value).toBe(false);
    expect(autoSave2.hasDraft.value).toBe(true);
    expect(autoSave2.restoreDraft()).toEqual({ text: 'Rascunho disciplina 2' });
  });
});


describe('useAiJob composable', () => {
  let originalPost: any;
  let originalGet: any;

  beforeEach(() => {
    originalPost = apiClient.post;
    originalGet = apiClient.get;
    (globalThis as any).navigator = { onLine: true };
  });

  afterEach(() => {
    apiClient.post = originalPost;
    apiClient.get = originalGet;
  });

  test('startJob lida com resposta direta com sucesso', async () => {
    apiClient.post = mock(async () => {
      return {
        success: true,
        data: {
          conteudo_md: '# Slide 1\n---\n# Slide 2',
          titulo_sugerido: 'Aula Teste',
          modelo_utilizado: 'deepseek-v4.1',
        },
        status: 200,
      };
    }) as any;

    const { startJob, status, progress, result, isRunning } = useAiJob<{
      conteudo_md: string;
      titulo_sugerido: string;
    }>();

    expect(isRunning.value).toBe(false);

    const promise = startJob('/ai/generate-aula', { tema: 'TypeScript' });

    const res = await promise;

    expect(status.value).toBe('completed');
    expect(progress.value).toBe(100);
    expect(isRunning.value).toBe(false);
    expect(res?.titulo_sugerido).toBe('Aula Teste');
    expect(result.value?.conteudo_md).toContain('Slide 1');
  });

  test('startJob realiza polling inteligente quando recebe job_id', async () => {
    let pollCount = 0;

    apiClient.post = mock(async () => {
      return {
        success: true,
        data: { job_id: 'job-abc-123' },
        status: 200,
      };
    }) as any;

    apiClient.get = mock(async (endpoint: string) => {
      expect(endpoint).toBe('/ai/jobs/job-abc-123');
      pollCount++;
      if (pollCount === 1) {
        return {
          success: true,
          data: {
            status: 'processing',
            progress: 50,
            step_message: 'Sintetizando tópicos...',
          },
          status: 200,
        };
      }
      return {
        success: true,
        data: {
          status: 'completed',
          progress: 100,
          result: { feedback_geral: 'Excelente turma' },
        },
        status: 200,
      };
    }) as any;

    const { startJob, status, progress, result } = useAiJob<{
      feedback_geral: string;
    }>();

    const res = await startJob('/ai/synthesize-class-feedback', {}, { pollIntervalMs: 20 });

    expect(status.value).toBe('completed');
    expect(progress.value).toBe(100);
    expect(res?.feedback_geral).toBe('Excelente turma');
    expect(result.value?.feedback_geral).toBe('Excelente turma');
    expect(pollCount).toBe(2);
  });

  test('entra em modo reconnecting quando a rede oscila e retoma sem cancelar', async () => {
    let callCount = 0;

    apiClient.post = mock(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          success: false,
          error: 'Erro de conexão',
          status: 0,
        };
      }
      return {
        success: true,
        data: {
          success: true,
          questions: [{ title: 'Q1', content: 'Enunciado' }],
        },
        status: 200,
      };
    }) as any;

    const { startJob, status, isReconnecting, result } = useAiJob<{
      questions: Array<{ title: string }>;
    }>();

    const jobPromise = startJob('/ai/generate-activity', { tema: 'Rede' });

    // Logo após a falha de rede inicial
    await new Promise((r) => setTimeout(r, 10));
    expect(status.value).toBe('reconnecting');
    expect(isReconnecting.value).toBe(true);

    // Simula disparo do evento online
    mockWindow.dispatchEvent({ type: 'online' } as Event);

    const res = await jobPromise;
    expect(status.value).toBe('completed');
    expect(isReconnecting.value).toBe(false);
    expect(res?.questions?.length).toBe(1);
    expect(result.value?.questions?.[0]?.title).toBe('Q1');
  });

  test('cancelJob aborta processamento pendente', async () => {
    apiClient.post = mock(async () => {
      return {
        success: true,
        data: { job_id: 'job-never-finish' },
        status: 200,
      };
    }) as any;

    apiClient.get = mock(async () => {
      return {
        success: true,
        data: { status: 'processing', progress: 30 },
        status: 200,
      };
    }) as any;

    const { startJob, cancelJob, status, isRunning } = useAiJob();

    const jobPromise = startJob('/ai/generate-aula', {}, { pollIntervalMs: 50 });
    await new Promise((r) => setTimeout(r, 15));

    cancelJob();

    const res = await jobPromise;
    expect(res).toBeNull();
    expect(status.value).toBe('cancelled');
    expect(isRunning.value).toBe(false);
  });

  test('pollJob lida com status failed e erro durante o polling', async () => {
    apiClient.post = mock(async () => ({
      success: true,
      data: { job_id: 'job-fail-poll' },
      status: 200,
    })) as any;

    apiClient.get = mock(async () => ({
      success: true,
      data: { status: 'failed', error: 'Falha simulada na IA' },
      status: 200,
    })) as any;

    let errorCallbackCalled = false;
    let errorMessage = '';

    const { startJob, status, error } = useAiJob();
    const res = await startJob('/ai/generate-aula', {}, {
      pollIntervalMs: 15,
      onError: (err) => {
        errorCallbackCalled = true;
        errorMessage = err;
      },
    });

    expect(res).toBeNull();
    expect(status.value).toBe('failed');
    expect(error.value).toContain('Falha simulada na IA');
    expect(errorCallbackCalled).toBe(true);
    expect(errorMessage).toContain('Falha simulada na IA');
  });

  test('pollJob esgota tentativas de polling (maxPollAttempts)', async () => {
    apiClient.post = mock(async () => ({
      success: true,
      data: { job_id: 'job-timeout-poll' },
      status: 200,
    })) as any;

    apiClient.get = mock(async () => ({
      success: true,
      data: { status: 'processing', progress: 20, step_message: 'Processando...' },
      status: 200,
    })) as any;

    let errorCalled = false;
    const { startJob, status, error } = useAiJob();
    const res = await startJob('/ai/generate-aula', {}, {
      pollIntervalMs: 10,
      maxPollAttempts: 2,
      onError: () => { errorCalled = true; },
    });

    expect(res).toBeNull();
    expect(status.value).toBe('failed');
    expect(error.value).toBe('Tempo limite de processamento atingido.');
    expect(errorCalled).toBe(true);
  });

  test('pollJob dispara callback onProgress', async () => {
    apiClient.post = mock(async () => ({
      success: true,
      data: { job_id: 'job-progress' },
      status: 200,
    })) as any;

    let pollCalls = 0;
    apiClient.get = mock(async () => {
      pollCalls++;
      if (pollCalls === 1) {
        return {
          success: true,
          data: { status: 'processing', progress: 40, step_message: '40% - Etapa 1' },
          status: 200,
        };
      }
      return {
        success: true,
        data: { status: 'completed', progress: 100, result: { ok: true } },
        status: 200,
      };
    }) as any;

    const progressUpdates: number[] = [];
    const { startJob } = useAiJob();
    await startJob('/ai/generate-aula', {}, {
      pollIntervalMs: 15,
      onProgress: (pct) => {
        progressUpdates.push(pct);
      },
    });

    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates).toContain(40);
  });
});

