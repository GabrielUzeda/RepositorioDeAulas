import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiClient } from '@/api/client';
import type { Turma, Aula, Atividade } from '@/types';

export const useTurmaStore = defineStore('turma', () => {
  const turmas = ref<Turma[]>([]);
  const currentTurma = ref<Turma | null>(null);
  const aulas = ref<Aula[]>([]);
  const atividades = ref<Atividade[]>([]);
  const unlockedActivities = ref<Set<number>>(new Set());
  const isLoading = ref<boolean>(false);

  async function fetchTurmas(): Promise<void> {
    isLoading.value = true;
    const res = await apiClient.get<Turma[]>('/turmas');
    isLoading.value = false;
    if (res.success && res.data) {
      turmas.value = res.data;
    }
  }

  async function loadTurmaContent(turmaId: number, password?: string): Promise<boolean> {
    isLoading.value = true;
    const pwdParam = password ? `&senha=${encodeURIComponent(password)}` : '';

    const [aulasRes, atvRes] = await Promise.all([
      apiClient.get<Aula[]>(`/aulas?turma_id=${turmaId}${pwdParam}`),
      apiClient.get<Atividade[]>(`/atividades?turma_id=${turmaId}${pwdParam}`)
    ]);

    isLoading.value = false;

    if (aulasRes.success && atvRes.success) {
      aulas.value = aulasRes.data || [];
      atividades.value = atvRes.data || [];
      return true;
    }
    return false;
  }

  function unlockActivity(atividadeId: number) {
    unlockedActivities.value.add(atividadeId);
  }

  function isUnlocked(atividadeId: number): boolean {
    return unlockedActivities.value.has(atividadeId);
  }

  return {
    turmas,
    currentTurma,
    aulas,
    atividades,
    unlockedActivities,
    isLoading,
    fetchTurmas,
    loadTurmaContent,
    unlockActivity,
    isUnlocked
  };
});
