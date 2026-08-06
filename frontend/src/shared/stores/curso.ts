import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiClient } from '@/shared/api/client';
import type { Curso, Materia, Aula, Atividade } from '@/shared/types';

export const useCursoStore = defineStore('curso', () => {
  const cursos = ref<Curso[]>([]);
  const currentCurso = ref<Curso | null>(null);
  const materias = ref<Materia[]>([]);
  const currentMateria = ref<Materia | null>(null);
  const aulas = ref<Aula[]>([]);
  const atividades = ref<Atividade[]>([]);
  const unlockedActivities = ref<Set<number>>(new Set());
  const isLoading = ref<boolean>(false);

  async function fetchCursos(): Promise<void> {
    isLoading.value = true;
    const res = await apiClient.get<Curso[]>('/cursos');
    isLoading.value = false;
    if (res.success && res.data) {
      cursos.value = res.data;
    }
  }

  async function fetchMaterias(cursoId: number): Promise<void> {
    isLoading.value = true;
    const res = await apiClient.get<Materia[]>(`/cursos/${cursoId}/materias`);
    isLoading.value = false;
    if (res.success && res.data) {
      materias.value = res.data;
    }
  }

  async function loadMateriaContent(materiaId: number, password?: string): Promise<boolean> {
    isLoading.value = true;
    const pwdParam = password ? `&senha=${encodeURIComponent(password)}` : '';

    const [aulasRes, atvRes] = await Promise.all([
      apiClient.get<Aula[]>(`/aulas?materia_id=${materiaId}${pwdParam}`),
      apiClient.get<Atividade[]>(`/atividades?materia_id=${materiaId}${pwdParam}`)
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
    cursos,
    currentCurso,
    materias,
    currentMateria,
    aulas,
    atividades,
    unlockedActivities,
    isLoading,
    fetchCursos,
    fetchMaterias,
    loadMateriaContent,
    unlockActivity,
    isUnlocked
  };
});
