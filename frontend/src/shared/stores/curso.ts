import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiClient } from '@/shared/api/client';
import type { Curso, Disciplina, Aula, Atividade } from '@/shared/types';

export const useCursoStore = defineStore('curso', () => {
  const cursos = ref<Curso[]>([]);
  const currentCurso = ref<Curso | null>(null);
  const disciplinas = ref<Disciplina[]>([]);
  const currentDisciplina = ref<Disciplina | null>(null);
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

  async function fetchDisciplinas(cursoId: number): Promise<void> {
    isLoading.value = true;
    const res = await apiClient.get<Disciplina[]>(`/cursos/${cursoId}/disciplinas`);
    isLoading.value = false;
    if (res.success && res.data) {
      disciplinas.value = res.data;
    }
  }

  async function loadDisciplinaContent(disciplinaId: number, password?: string): Promise<boolean> {
    isLoading.value = true;
    const pwdParam = password ? `&senha=${encodeURIComponent(password)}` : '';

    const [aulasRes, atvRes] = await Promise.all([
      apiClient.get<Aula[]>(`/aulas?disciplina_id=${disciplinaId}${pwdParam}`),
      apiClient.get<Atividade[]>(`/atividades?disciplina_id=${disciplinaId}${pwdParam}`)
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
    disciplinas,
    materias: disciplinas, // alias de compatibilidade
    currentDisciplina,
    currentMateria: currentDisciplina,
    aulas,
    atividades,
    unlockedActivities,
    isLoading,
    fetchCursos,
    fetchDisciplinas,
    fetchMaterias: fetchDisciplinas,
    loadDisciplinaContent,
    loadMateriaContent: loadDisciplinaContent,
    unlockActivity,
    isUnlocked
  };
});
