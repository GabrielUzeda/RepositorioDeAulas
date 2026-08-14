import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
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

  const loadingCursos = ref(false);
  const loadingDisciplinas = ref(false);
  const loadingContent = ref(false);
  const isLoading = computed(() => loadingCursos.value || loadingDisciplinas.value || loadingContent.value);

  async function fetchCursos(): Promise<void> {
    loadingCursos.value = true;
    try {
      const res = await apiClient.get<Curso[]>('/cursos');
      if (res.success && res.data) {
        cursos.value = res.data;
      }
    } finally {
      loadingCursos.value = false;
    }
  }

  async function fetchDisciplinas(cursoId: number): Promise<void> {
    loadingDisciplinas.value = true;
    try {
      const res = await apiClient.get<Disciplina[]>(`/cursos/${cursoId}/disciplinas`);
      if (res.success && res.data) {
        disciplinas.value = res.data;
      }
    } finally {
      loadingDisciplinas.value = false;
    }
  }

  async function loadDisciplinaContent(disciplinaId: number, password?: string): Promise<boolean> {
    loadingContent.value = true;
    try {
      const pwdParam = password ? `&senha=${encodeURIComponent(password)}` : '';
      const [aulasRes, atvRes] = await Promise.all([
        apiClient.get<Aula[]>(`/aulas?disciplina_id=${disciplinaId}${pwdParam}`),
        apiClient.get<Atividade[]>(`/atividades?disciplina_id=${disciplinaId}${pwdParam}`)
      ]);
      if (aulasRes.success && atvRes.success) {
        aulas.value = aulasRes.data || [];
        atividades.value = atvRes.data || [];
        return true;
      }
      return false;
    } finally {
      loadingContent.value = false;
    }
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
    loadingCursos,
    loadingDisciplinas,
    loadingContent,
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
