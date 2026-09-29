import { ref, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';

export interface UseAutoSaveOptions<T> {
  key: string | Ref<string> | ComputedRef<string> | (() => string);
  debounceMs?: number;
  onRestore?: (data: T) => void;
  notifyOnRestore?: boolean;
}

export interface AutoSavePayload<T> {
  data: T;
  savedAt: string;
}

export function useAutoSave<T extends Record<string, unknown>>(options: UseAutoSaveOptions<T>) {
  const debounceMs = options.debounceMs ?? 400;
  const isSaving = ref(false);
  const hasDraft = ref(false);
  const draftLastSaved = ref<Date | null>(null);
  const restoredDraft = ref<T | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function resolveKey(): string {
    if (typeof options.key === 'function') {
      return options.key();
    }
    if (typeof options.key === 'object' && options.key !== null && 'value' in options.key) {
      return options.key.value;
    }
    return String(options.key);
  }

  function checkHasDraft(): boolean {
    const key = resolveKey();
    if (!key || typeof window === 'undefined') {
      hasDraft.value = false;
      return false;
    }
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        hasDraft.value = false;
        draftLastSaved.value = null;
        return false;
      }
      const parsed = JSON.parse(raw) as AutoSavePayload<T>;
      if (parsed && typeof parsed === 'object' && 'data' in parsed) {
        hasDraft.value = true;
        draftLastSaved.value = parsed.savedAt ? new Date(parsed.savedAt) : null;
        return true;
      }
      hasDraft.value = false;
      draftLastSaved.value = null;
      return false;
    } catch {
      hasDraft.value = false;
      draftLastSaved.value = null;
      return false;
    }
  }

  function saveDraft(data: T): boolean {
    const key = resolveKey();
    if (!key || typeof window === 'undefined') return false;

    isSaving.value = true;
    try {
      const now = new Date();
      const payload: AutoSavePayload<T> = {
        data,
        savedAt: now.toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(payload));
      hasDraft.value = true;
      draftLastSaved.value = now;
      return true;
    } catch {
      return false;
    } finally {
      isSaving.value = false;
    }
  }

  function scheduleAutoSave(data: T): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      saveDraft(data);
    }, debounceMs);
  }

  function restoreDraft(): T | null {
    const key = resolveKey();
    if (!key || typeof window === 'undefined') return null;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        hasDraft.value = false;
        draftLastSaved.value = null;
        return null;
      }
      const parsed = JSON.parse(raw) as AutoSavePayload<T>;
      if (parsed && typeof parsed === 'object' && 'data' in parsed) {
        hasDraft.value = true;
        draftLastSaved.value = parsed.savedAt ? new Date(parsed.savedAt) : null;
        restoredDraft.value = parsed.data;
        if (options.onRestore) {
          options.onRestore(parsed.data);
        }
        return parsed.data;
      }
      return null;
    } catch {
      return null;
    }
  }

  function clearDraft(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    const key = resolveKey();
    if (!key || typeof window === 'undefined') return;

    try {
      localStorage.removeItem(key);
      hasDraft.value = false;
      draftLastSaved.value = null;
      restoredDraft.value = null;
    } catch {
      // Ignora erro ao limpar
    }
  }

  onBeforeUnmount(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  });

  // Checagem inicial
  checkHasDraft();

  return {
    isSaving,
    hasDraft,
    draftLastSaved,
    restoredDraft,
    saveDraft,
    scheduleAutoSave,
    restoreDraft,
    clearDraft,
    checkHasDraft,
  };
}
