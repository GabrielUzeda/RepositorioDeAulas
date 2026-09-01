<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/shared/stores/auth';
import { useCursoStore } from '@/shared/stores/curso';
import { apiClient } from '@/shared/api/client';
import DisciplinaFormModal from '@/professor/components/DisciplinaFormModal.vue';
import MarpEditorModal from '@/professor/components/MarpEditorModal.vue';
import JsonActivityEditorModal from '@/professor/components/JsonActivityEditorModal.vue';
import RespostasModal from '@/professor/components/RespostasModal.vue';
import FeedbackConsolidadoModal from '@/professor/components/FeedbackConsolidadoModal.vue';
import CursoCard from '@/aluno/components/CursoCard.vue';
import DisciplinaCard from '@/aluno/components/DisciplinaCard.vue';
import ThemeToggle from '@/shared/components/ThemeToggle.vue';
import BaseButton from '@/shared/components/BaseButton.vue';
import BaseBadge from '@/shared/components/BaseBadge.vue';
import BaseSkeleton from '@/shared/components/BaseSkeleton.vue';
import BackButton from '@/shared/components/BackButton.vue';
import BaseModal from '@/shared/components/BaseModal.vue';
import BaseSelect from '@/shared/components/BaseSelect.vue';
import ConfirmDialog from '../shared/components/ConfirmDialog.vue';
import EmptyState from '../shared/components/EmptyState.vue';
import type { Curso, Disciplina, Aula, Atividade } from '@/shared/types';

const router = useRouter();
const authStore = useAuthStore();
const cursoStore = useCursoStore();

const activeView = ref<'cursos' | 'disciplinas' | 'detalhes'>('cursos');
const selectedCurso = ref<Curso | null>(null);
const selectedDisciplina = ref<Disciplina | null>(null);

const showDisciplinaModal = ref(false);
const editingDisciplina = ref<Disciplina | null>(null);

const showMarpModal = ref(false);
const editingAula = ref<Aula | null>(null);

const showActivityEditorModal = ref(false);
const editingActivity = ref<Atividade | null>(null);

const showRespostasModal = ref(false);
const selectedRespostasAtividade = ref<Atividade | null>(null);

const showFeedbackConsolidadoModal = ref(false);

onMounted(async () => {
  await cursoStore.fetchCursos();
});

function logout() {
  authStore.logout();
  router.push('/login');
}

function handleOpenCurso(curso: Curso) {
  selectedCurso.value = curso;
  showDisciplinas();
}

async function showDisciplinas() {
  if (!selectedCurso.value) return;
  await cursoStore.fetchDisciplinas(selectedCurso.value.id);
  activeView.value = 'disciplinas';
}

import { executeWithFeedback } from '@/shared/api/requestHelper';

function handleOpenDisciplinaModal(disciplina?: Disciplina) {
  editingDisciplina.value = disciplina || null;
  showDisciplinaModal.value = true;
}

const isSavingDisciplina = ref(false);

async function handleSaveDisciplina(data: Partial<Disciplina>) {
  if (!selectedCurso.value || isSavingDisciplina.value) return;
  const isEditing = Boolean(editingDisciplina.value);
  const payload = { ...data, curso_id: selectedCurso.value.id };

  const res = await executeWithFeedback(
    () => isEditing && editingDisciplina.value
      ? apiClient.put(`/disciplinas/${editingDisciplina.value.id}`, payload)
      : apiClient.post('/disciplinas', payload),
    {
      loadingRef: isSavingDisciplina,
      successMessage: isEditing ? 'Disciplina atualizada com sucesso!' : 'Disciplina criada com sucesso!',
      errorMessage: isEditing ? 'Falha ao atualizar disciplina.' : 'Falha ao criar disciplina.'
    }
  );

  if (res.success) {
    showDisciplinaModal.value = false;
    await showDisciplinas();
  }
}

const showDelDisc = ref(false);
const delDiscId = ref<number | null>(null);

function handleDeleteDisciplina(disciplinaId: number) {
  delDiscId.value = disciplinaId;
  showDelDisc.value = true;
}

async function onConfirmDelDisc() {
  if (delDiscId.value == null) return;
  const res = await executeWithFeedback(
    () => apiClient.delete(`/disciplinas/${delDiscId.value}`),
    {
      successMessage: 'Disciplina excluída com sucesso!',
      errorMessage: 'Falha ao excluir disciplina.'
    }
  );
  if (res.success) {
    await showDisciplinas();
  }
}

function onCancelDelDisc() {}

async function handleOpenDisciplinaDetails(disciplina: Disciplina) {
  selectedDisciplina.value = disciplina;
  await cursoStore.loadDisciplinaContent(disciplina.id);
  activeView.value = 'detalhes';
}

function goBack() {
  if (activeView.value === 'detalhes') {
    activeView.value = 'disciplinas';
    selectedDisciplina.value = null;
  } else if (activeView.value === 'disciplinas') {
    activeView.value = 'cursos';
    selectedCurso.value = null;
  }
}

function handleOpenMarpModal(aula?: Aula) {
  editingAula.value = aula || null;
  showMarpModal.value = true;
}

const isSavingAula = ref(false);

async function handleSaveMarpAula(payload: { titulo: string; descricao: string; markdown: string }) {
  if (!selectedDisciplina.value || isSavingAula.value) return;
  const isEditing = Boolean(editingAula.value);
  const data: any = {
    disciplina_id: selectedDisciplina.value.id,
    titulo: payload.titulo,
    descricao: payload.descricao,
    markdown: payload.markdown
  };

  const res = await executeWithFeedback(
    () => {
      if (isEditing && editingAula.value) {
        return apiClient.put(`/aulas/${editingAula.value.id}`, { ...editingAula.value, ...data });
      } else {
        const maxOrdem = cursoStore.aulas.reduce((max, a) => Math.max(max, a.ordem ?? 0), -1);
        data.ordem = maxOrdem + 1;
        return apiClient.post('/aulas', data);
      }
    },
    {
      loadingRef: isSavingAula,
      successMessage: isEditing ? 'Aula atualizada com sucesso!' : 'Aula criada com sucesso!',
      errorMessage: isEditing ? 'Falha ao salvar aula.' : 'Falha ao criar aula.'
    }
  );

  if (res.success) {
    showMarpModal.value = false;
    await cursoStore.loadDisciplinaContent(selectedDisciplina.value.id);
  }
}

const showDelAula = ref(false);
const delAulaId = ref<number | null>(null);

function handleDeleteAula(aulaId: number) {
  delAulaId.value = aulaId;
  showDelAula.value = true;
}

async function onConfirmDelAula() {
  if (delAulaId.value == null) return;
  const res = await executeWithFeedback(
    () => apiClient.delete(`/aulas/${delAulaId.value}`),
    {
      successMessage: 'Aula excluída com sucesso!',
      errorMessage: 'Falha ao excluir aula.'
    }
  );
  if (res.success && selectedDisciplina.value) {
    await cursoStore.loadDisciplinaContent(selectedDisciplina.value.id);
  }
}

function onCancelDelAula() {}

const selectedDefaultAulaId = ref<number | null>(null);

function handleOpenActivityEditor(atividade?: Atividade, defaultAulaId?: number) {
  editingActivity.value = atividade || null;
  selectedDefaultAulaId.value = defaultAulaId ?? null;
  showActivityEditorModal.value = true;
}

const isSavingActivity = ref(false);

async function handleSaveActivity(payload: any) {
  if (!selectedDisciplina.value || isSavingActivity.value) return;
  const isEditing = Boolean(editingActivity.value && editingActivity.value.id && editingActivity.value.id > 0);
  const data = {
    ...payload,
    disciplina_id: selectedDisciplina.value.id
  };

  const res = await executeWithFeedback(
    () => {
      if (isEditing && editingActivity.value) {
        return apiClient.put(`/atividades/${editingActivity.value.id}`, { ...editingActivity.value, ...data });
      } else {
        const maxOrdem = cursoStore.atividades.reduce((max, a) => Math.max(max, a.ordem ?? 0), -1);
        data.ordem = maxOrdem + 1;
        return apiClient.post('/atividades', data);
      }
    },
    {
      loadingRef: isSavingActivity,
      successMessage: isEditing ? 'Atividade atualizada com sucesso!' : 'Atividade criada com sucesso!',
      errorMessage: isEditing ? 'Falha ao salvar atividade.' : 'Falha ao criar atividade.'
    }
  );

  if (res.success) {
    showActivityEditorModal.value = false;
    await cursoStore.loadDisciplinaContent(selectedDisciplina.value.id);
  }
}

const showDelAtiv = ref(false);
const delAtivId = ref<number | null>(null);

function handleDeleteActivity(atividadeId: number) {
  delAtivId.value = atividadeId;
  showDelAtiv.value = true;
}

async function onConfirmDelAtiv() {
  if (delAtivId.value == null) return;
  const res = await executeWithFeedback(
    () => apiClient.delete(`/atividades/${delAtivId.value}`),
    {
      successMessage: 'Atividade excluída com sucesso!',
      errorMessage: 'Falha ao excluir atividade.'
    }
  );
  if (res.success && selectedDisciplina.value) {
    await cursoStore.loadDisciplinaContent(selectedDisciplina.value.id);
  }
}

function onCancelDelAtiv() {}

// Modo de Reordenação
const isReordering = ref(false);
const isSavingOrders = ref(false);

const localAulas = ref<Aula[]>([]);
const localAtividades = ref<Atividade[]>([]);

watch(() => cursoStore.aulas, (val) => {
  localAulas.value = [...val];
}, { immediate: true });

watch(() => cursoStore.atividades, (val) => {
  localAtividades.value = [...val];
}, { immediate: true });

const atividadesGerais = computed(() => {
  const aulaIds = new Set(localAulas.value.map((a) => a.id));
  return localAtividades.value.filter((atv) => {
    const hasAulaIds = atv.aula_ids && Array.isArray(atv.aula_ids) && atv.aula_ids.length > 0;
    if (hasAulaIds) {
      return !atv.aula_ids!.some((id) => aulaIds.has(id));
    }
    return !atv.aula_id || !aulaIds.has(atv.aula_id);
  });
});

function getAulaAtividades(aulaId: number): Atividade[] {
  return localAtividades.value.filter((atv) => {
    if (atv.aula_ids && Array.isArray(atv.aula_ids)) {
      return atv.aula_ids.includes(aulaId);
    }
    return atv.aula_id === aulaId;
  });
}

// Modal e ações de Vinculação de Atividades a Aula (N:N)
const showVincularModal = ref(false);
const targetAulaParaVincular = ref<Aula | null>(null);
const selectedAtividadeIdsParaAula = ref<number[]>([]);
const isSavingVinculos = ref(false);

function handleOpenVincularModal(aula: Aula) {
  targetAulaParaVincular.value = aula;
  selectedAtividadeIdsParaAula.value = getAulaAtividades(aula.id).map((a: Atividade) => a.id);
  showVincularModal.value = true;
}

function getAtividadeStatusVinculo(atv: Atividade, targetAulaId?: number): { text: string; badgeClass: string } {
  const ids = atv.aula_ids && atv.aula_ids.length > 0 ? atv.aula_ids : (atv.aula_id ? [atv.aula_id] : []);
  if (ids.length === 0) {
    return { text: 'Geral', badgeClass: 'text-secondary bg-surface border border-line' };
  }
  if (targetAulaId && ids.includes(targetAulaId)) {
    if (ids.length > 1) {
      return { text: `Nesta Aula (+${ids.length - 1} ${ids.length - 1 === 1 ? 'outra' : 'outras'})`, badgeClass: 'text-accent bg-accent/15' };
    }
    return { text: 'Nesta Aula', badgeClass: 'text-accent bg-accent/15' };
  }
  if (ids.length === 1) {
    const found = localAulas.value.find((a: Aula) => a.id === ids[0]);
    return { text: found ? found.titulo : 'Outra aula', badgeClass: 'text-muted bg-surface border border-line' };
  }
  return { text: `Em ${ids.length} aulas`, badgeClass: 'text-muted bg-surface border border-line' };
}

async function handleSalvarVinculos() {
  if (!targetAulaParaVincular.value || !selectedDisciplina.value || isSavingVinculos.value) return;
  const targetId = targetAulaParaVincular.value.id;
  const selectedSet = new Set(selectedAtividadeIdsParaAula.value);

  const res = await executeWithFeedback(
    async () => {
      const promises: Promise<any>[] = [];

      for (const atv of cursoStore.atividades) {
        const isSelected = selectedSet.has(atv.id);
        const currentIds = new Set<number>(atv.aula_ids && atv.aula_ids.length > 0 ? atv.aula_ids : (atv.aula_id ? [atv.aula_id] : []));
        const wasLinked = currentIds.has(targetId);

        if (isSelected && !wasLinked) {
          currentIds.add(targetId);
          promises.push(apiClient.put(`/atividades/${atv.id}`, { ...atv, aula_ids: Array.from(currentIds) }));
        } else if (!isSelected && wasLinked) {
          currentIds.delete(targetId);
          promises.push(apiClient.put(`/atividades/${atv.id}`, { ...atv, aula_ids: Array.from(currentIds) }));
        }
      }

      const results = await Promise.all(promises);
      const failed = results.find((r) => r && !r.success);
      if (failed) {
        return { success: false, status: failed.status, error: failed.error || 'Erro ao salvar vínculo' };
      }
      return { success: true, status: 200 };
    },
    {
      loadingRef: isSavingVinculos,
      successMessage: 'Vínculos de atividades atualizados com sucesso!',
      errorMessage: 'Falha ao atualizar vínculos de atividades.'
    }
  );

  if (res.success) {
    showVincularModal.value = false;
    await cursoStore.loadDisciplinaContent(selectedDisciplina.value.id);
  }
}

async function handleDesvincularAtividade(atv: Atividade, aulaId?: number) {
  if (!selectedDisciplina.value) return;
  const targetAulaId = aulaId ?? atv.aula_id;
  const currentIds = (atv.aula_ids && atv.aula_ids.length > 0 ? atv.aula_ids : (atv.aula_id ? [atv.aula_id] : [])).filter((id) => id !== targetAulaId);
  const res = await executeWithFeedback(
    () => apiClient.put(`/atividades/${atv.id}`, { ...atv, aula_ids: currentIds }),
    {
      successMessage: 'Atividade desvinculada da aula com sucesso!',
      errorMessage: 'Falha ao desvincular atividade.'
    }
  );
  if (res.success) {
    await cursoStore.loadDisciplinaContent(selectedDisciplina.value.id);
  }
}

// Modal de Vinculação Rápida de Atividade Específica (usado nos cards de Atividades Gerais)
const showVincularAtividadeModal = ref(false);
const targetAtividadeParaVincular = ref<Atividade | null>(null);
const selectedDestinoAulaId = ref<string>('');
const isSavingAtividadeDestino = ref(false);

const aulaSelectOptions = computed(() => {
  const opts = [{ value: '', label: 'Atividade Geral (Sem aula vinculada)' }];
  for (const aula of localAulas.value) {
    opts.push({ value: String(aula.id), label: aula.titulo });
  }
  return opts;
});

function handleOpenVincularAtividadeEspecifica(atv: Atividade) {
  targetAtividadeParaVincular.value = atv;
  selectedDestinoAulaId.value = atv.aula_id ? String(atv.aula_id) : '';
  showVincularAtividadeModal.value = true;
}

async function handleSalvarDestinoAtividade() {
  if (!targetAtividadeParaVincular.value || !selectedDisciplina.value || isSavingAtividadeDestino.value) return;
  const atv = targetAtividadeParaVincular.value;
  const newAulaId = selectedDestinoAulaId.value ? Number(selectedDestinoAulaId.value) : null;

  const res = await executeWithFeedback(
    () => apiClient.put(`/atividades/${atv.id}`, { ...atv, aula_id: newAulaId }),
    {
      loadingRef: isSavingAtividadeDestino,
      successMessage: newAulaId ? 'Atividade vinculada à aula com sucesso!' : 'Atividade definida como Geral com sucesso!',
      errorMessage: 'Falha ao vincular atividade.'
    }
  );

  if (res.success) {
    showVincularAtividadeModal.value = false;
    await cursoStore.loadDisciplinaContent(selectedDisciplina.value.id);
  }
}

function getActivityTypeBadge(tipo?: string) {
  switch (tipo) {
    case 'minigame':
      return { label: 'Minigame', icon: 'sports_esports', badgeClass: 'bg-cat-minigame-bg text-cat-minigame' };
    case 'roleta':
      return { label: 'Roleta', icon: 'casino', badgeClass: 'bg-cat-roleta-bg text-cat-roleta' };
    case 'reforco':
      return { label: 'Reforço', icon: 'psychology', badgeClass: 'bg-cat-reforco-bg text-cat-reforco' };
    case 'prova':
      return { label: 'Prova', icon: 'quiz', badgeClass: 'bg-cat-default-bg text-cat-default' };
    default:
      return { label: 'Normal', icon: 'assignment', badgeClass: 'bg-cat-default-bg text-cat-default' };
  }
}

function toggleReorder() {
  if (isReordering.value) {
    saveOrders();
  } else {
    isReordering.value = true;
  }
}

async function saveOrders() {
  if (isSavingOrders.value) return;

  const res = await executeWithFeedback(
    async () => {
      for (let i = 0; i < localAulas.value.length; i++) {
        const item = localAulas.value[i];
        if (item.ordem !== i) {
          await apiClient.put(`/aulas/${item.id}`, { ...item, ordem: i });
        }
      }
      for (let i = 0; i < localAtividades.value.length; i++) {
        const item = localAtividades.value[i];
        if (item.ordem !== i) {
          await apiClient.put(`/atividades/${item.id}`, { ...item, ordem: i });
        }
      }
      return { success: true, status: 200 };
    },
    {
      loadingRef: isSavingOrders,
      successMessage: 'Nova organização das aulas e atividades salva com sucesso!',
      errorMessage: 'Falha ao salvar a nova ordem.'
    }
  );

  isReordering.value = false;
  if (res.success && selectedDisciplina.value) {
    await cursoStore.loadDisciplinaContent(selectedDisciplina.value.id);
  }
}

function moveAula(index: number, direction: 'up' | 'down') {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= localAulas.value.length) return;
  const list = [...localAulas.value];
  const item = list.splice(index, 1)[0];
  list.splice(target, 0, item);
  localAulas.value = list;
}

function moveAtividadeInGroup(atvId: number, direction: 'up' | 'down') {
  const atvIndex = localAtividades.value.findIndex((a: Atividade) => a.id === atvId);
  if (atvIndex === -1) return;
  const atv = localAtividades.value[atvIndex];
  const group = atv.aula_id ? getAulaAtividades(atv.aula_id) : atividadesGerais.value;
  const groupIndex = group.findIndex((a: Atividade) => a.id === atvId);
  const targetGroupIndex = direction === 'up' ? groupIndex - 1 : groupIndex + 1;
  if (targetGroupIndex < 0 || targetGroupIndex >= group.length) return;
  const otherAtv = group[targetGroupIndex];
  const otherIndex = localAtividades.value.findIndex((a: Atividade) => a.id === otherAtv.id);
  if (otherIndex === -1) return;

  const list = [...localAtividades.value];
  list[atvIndex] = otherAtv;
  list[otherIndex] = atv;
  localAtividades.value = list;
}

function handleOpenRespostas(atividade: Atividade) {
  selectedRespostasAtividade.value = atividade;
  showRespostasModal.value = true;
}
</script>

<template>
  <div class="min-h-screen bg-surface text-primary flex flex-col">
    <!-- Header -->
    <header class="border-b border-line bg-header-bg/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <span class="material-icons text-accent text-2xl">school</span>
        <h1 class="text-xl font-bold text-primary tracking-tight">Painel do Professor</h1>
      </div>

      <div class="flex items-center space-x-4">
        <span class="text-xs text-secondary">Olá, <strong class="text-primary">{{ authStore.professor?.nome }}</strong></span>
        <ThemeToggle />
        <button @click="logout" class="p-2 text-secondary hover:text-danger hover:bg-surface rounded-xl transition">
          <span class="material-icons text-sm">logout</span>
        </button>
      </div>
    </header>

    <!-- Main Container -->
    <main class="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
      <transition name="page-fade" mode="out-in">
        <!-- Cursos View -->
        <section v-if="activeView === 'cursos'" key="cursos" class="space-y-6">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-2xl font-bold text-primary">Seus Cursos</h2>
              <p class="text-secondary text-xs mt-1">Selecione um curso para gerenciar suas disciplinas e conteúdos.</p>
            </div>
          </div>

          <div v-if="cursoStore.loadingCursos" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true" aria-label="Carregando cursos">
            <div
              v-for="n in 6"
              :key="n"
              class="p-6 bg-surface-alt border border-line rounded-3xl flex flex-col justify-between space-y-4"
            >
              <div class="flex items-start justify-between">
                <BaseSkeleton width="w-12" height="h-12" rounded="rounded-2xl" />
                <BaseSkeleton width="w-5" height="h-5" rounded="rounded-md" />
              </div>

              <div class="space-y-2">
                <BaseSkeleton height="h-5" width="w-3/4" />
                <BaseSkeleton height="h-3" width="w-full" />
                <BaseSkeleton height="h-3" width="w-2/3" />
              </div>

              <div class="pt-4 border-t border-line flex items-center justify-between">
                <BaseSkeleton height="h-3" width="w-24" />
              </div>
            </div>
          </div>

          <EmptyState v-else-if="cursoStore.cursos.length === 0" message="Você não possui acesso a nenhum curso no momento." />

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CursoCard
              v-for="curso in cursoStore.cursos"
              :key="curso.id"
              :curso="curso"
              action-text="Ver disciplinas"
              @select="handleOpenCurso(curso)"
            />
          </div>
        </section>

        <!-- Disciplinas View -->
        <section v-else-if="activeView === 'disciplinas'" key="disciplinas" class="space-y-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <BackButton @click="goBack" />
              <div>
                <h2 class="text-2xl font-bold text-primary">{{ selectedCurso?.nome }}</h2>
                <p class="text-secondary text-xs mt-0.5">Gerencie as disciplinas associadas a este curso.</p>
              </div>
            </div>

            <BaseButton variant="primary" size="sm" @click="handleOpenDisciplinaModal()">
              <span class="material-icons text-sm">add</span>
              <span>Nova Disciplina</span>
            </BaseButton>
          </div>

          <div v-if="cursoStore.loadingDisciplinas" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true" aria-label="Carregando disciplinas">
            <div
              v-for="n in 6"
              :key="n"
              class="p-6 bg-surface-alt border border-line rounded-3xl flex flex-col justify-between space-y-4"
            >
              <div class="flex items-start justify-between">
                <BaseSkeleton width="w-12" height="h-12" rounded="rounded-2xl" />
                <div class="flex space-x-1">
                  <BaseSkeleton width="w-7" height="h-7" rounded="rounded-lg" />
                  <BaseSkeleton width="w-7" height="h-7" rounded="rounded-lg" />
                </div>
              </div>

              <div class="space-y-2">
                <BaseSkeleton height="h-5" width="w-3/4" />
                <BaseSkeleton height="h-3" width="w-full" />
                <BaseSkeleton height="h-3" width="w-2/3" />
              </div>

              <BaseSkeleton height="h-8" width="w-full" rounded="rounded-control" />
            </div>
          </div>

          <EmptyState v-else-if="cursoStore.disciplinas.length === 0" message="Nenhuma disciplina cadastrada neste curso." />

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <DisciplinaCard
              v-for="disciplina in cursoStore.disciplinas"
              :key="disciplina.id"
              :disciplina="disciplina"
              action-text="Gerenciar Aulas & Atividades"
              @select="handleOpenDisciplinaDetails(disciplina)"
            >
              <template #header-actions>
                <div class="flex items-center space-x-1" @click.stop>
                  <button @click="handleOpenDisciplinaModal(disciplina)" title="Editar Disciplina" class="p-1.5 text-secondary hover:text-primary rounded-lg">
                    <span class="material-icons text-sm">edit</span>
                  </button>
                  <button @click="handleDeleteDisciplina(disciplina.id)" title="Excluir Disciplina" class="p-1.5 text-secondary hover:text-danger rounded-lg">
                    <span class="material-icons text-sm">delete</span>
                  </button>
                </div>
              </template>
            </DisciplinaCard>
          </div>
        </section>

        <!-- Content View (Aulas e Atividades Integradas) -->
        <section v-else key="detalhes" class="space-y-6">
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-line pb-4 gap-4">
            <div class="flex items-center gap-3 min-w-0">
              <BackButton @click="goBack" />
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h2 class="text-2xl font-bold text-primary truncate">{{ selectedDisciplina?.nome }}</h2>
                  <BaseBadge variant="accent" size="sm">{{ selectedCurso?.nome }}</BaseBadge>
                </div>
                <p v-if="selectedDisciplina?.descricao" class="text-secondary text-xs mt-0.5 line-clamp-1">{{ selectedDisciplina?.descricao }}</p>
              </div>
            </div>

            <div class="flex items-center flex-wrap gap-2 shrink-0">
              <BaseButton
                variant="secondary"
                size="sm"
                class="inline-flex items-center gap-1.5"
                @click="showFeedbackConsolidadoModal = true"
              >
                <span class="material-icons text-sm">mark_email_read</span>
                <span>Gerar Feedback da Disciplina</span>
              </BaseButton>

              <BaseButton
                v-if="cursoStore.aulas.length > 1 || cursoStore.atividades.length > 1"
                :variant="isReordering ? 'primary' : 'secondary'"
                size="sm"
                :disabled="isSavingOrders"
                @click="toggleReorder"
              >
                <span class="material-icons text-sm">{{ isReordering ? 'save' : 'swap_vert' }}</span>
                <span>{{ isSavingOrders ? 'Salvando...' : (isReordering ? 'Salvar Ordem' : 'Reordenar') }}</span>
              </BaseButton>

              <BaseButton
                variant="secondary"
                size="sm"
                @click="handleOpenActivityEditor()"
              >
                <span class="material-icons text-sm">assignment_add</span>
                <span>Nova Atividade</span>
              </BaseButton>

              <BaseButton
                variant="primary"
                size="sm"
                @click="handleOpenMarpModal()"
              >
                <span class="material-icons text-sm">add</span>
                <span>Nova Aula</span>
              </BaseButton>
            </div>
          </div>

          <!-- Loading state -->
          <div v-if="cursoStore.loadingContent" class="space-y-4" aria-busy="true" aria-label="Carregando conteúdo da disciplina">
            <div v-for="n in 3" :key="n" class="p-5 bg-surface-alt border border-line rounded-xl space-y-3">
              <div class="flex items-center space-x-3 w-full">
                <BaseSkeleton width="w-9" height="h-9" rounded="rounded-md" />
                <div class="flex-1 space-y-1.5">
                  <BaseSkeleton height="h-4" width="w-1/3" />
                  <BaseSkeleton height="h-3" width="w-1/2" />
                </div>
              </div>
              <BaseSkeleton height="h-12" width="w-full" rounded="rounded-lg" />
            </div>
          </div>

          <!-- Empty State total -->
          <EmptyState
            v-else-if="localAulas.length === 0 && localAtividades.length === 0"
            icon="school"
            title="Nenhum conteúdo cadastrado"
            message="Comece criando a primeira aula (Marp Markdown) ou atividade interativa desta disciplina."
          >
            <template #action>
              <div class="flex items-center gap-3">
                <BaseButton variant="primary" size="sm" @click="handleOpenMarpModal()">
                  <span class="material-icons text-sm">add</span>
                  <span>Criar Primeira Aula</span>
                </BaseButton>
                <BaseButton variant="secondary" size="sm" @click="handleOpenActivityEditor()">
                  <span class="material-icons text-sm">assignment_add</span>
                  <span>Criar Atividade Geral</span>
                </BaseButton>
              </div>
            </template>
          </EmptyState>

          <div v-else class="space-y-6">
            <!-- Informação de modo de reordenação se ativo -->
            <div v-if="isReordering" class="p-3.5 bg-accent/10 border border-accent/30 rounded-xl text-xs text-accent flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div class="flex items-center gap-2">
                <span class="material-icons text-base shrink-0">swap_vert</span>
                <span class="font-medium">Modo de Reordenação Ativo: Organize as aulas e atividades usando as setas de subir e descer.</span>
              </div>
              <div class="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <BaseButton variant="primary" size="xs" :disabled="isSavingOrders" @click="toggleReorder">
                  <span class="material-icons text-xs">{{ isSavingOrders ? 'sync' : 'save' }}</span>
                  <span>{{ isSavingOrders ? 'Salvando...' : 'Salvar Nova Ordem' }}</span>
                </BaseButton>
              </div>
            </div>

            <!-- Lista de Aulas e suas Atividades Vinculadas -->
            <div :class="[ isReordering ? 'space-y-4' : 'grid grid-cols-1 xl:grid-cols-2 gap-5 items-start' ]">
              <div
                v-for="(aula, idx) in localAulas"
                :key="aula.id"
                class="bg-surface-alt rounded-xl border border-line flex flex-col overflow-hidden transition-all duration-base shadow-card"
                :class="{ 'border-accent/60 shadow-md': isReordering }"
              >
                <!-- Top accent bar -->
                <div class="h-1 w-full bg-accent" />

                <!-- Header da Aula -->
                <div class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-alt">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="flex-shrink-0 w-9 h-9 rounded-md bg-accent flex items-center justify-center text-white shadow-xs">
                      <span class="material-icons text-[18px]">
                        {{ aula.icone || 'slideshow' }}
                      </span>
                    </div>

                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <h4 class="text-sm font-semibold text-primary leading-snug truncate">{{ aula.titulo }}</h4>
                        <span
                          v-if="getAulaAtividades(aula.id).length > 0"
                          class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface border border-line text-secondary"
                        >
                          {{ getAulaAtividades(aula.id).length }} {{ getAulaAtividades(aula.id).length === 1 ? 'atividade' : 'atividades' }}
                        </span>
                      </div>
                      <p class="text-xs text-secondary leading-relaxed truncate mt-0.5">
                        {{ aula.descricao || 'Apresentação em slides Marp Markdown' }}
                      </p>
                    </div>
                  </div>

                  <!-- Ações da Aula -->
                  <div class="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
                    <template v-if="isReordering">
                      <button
                        @click="moveAula(idx, 'up')"
                        :disabled="idx === 0"
                        title="Mover para cima"
                        class="w-8 h-8 flex items-center justify-center text-secondary hover:text-accent hover:bg-accent/10 disabled:opacity-30 disabled:pointer-events-none rounded-md transition-colors"
                      >
                        <span class="material-icons text-base">arrow_upward</span>
                      </button>
                      <button
                        @click="moveAula(idx, 'down')"
                        :disabled="idx === localAulas.length - 1"
                        title="Mover para baixo"
                        class="w-8 h-8 flex items-center justify-center text-secondary hover:text-accent hover:bg-accent/10 disabled:opacity-30 disabled:pointer-events-none rounded-md transition-colors"
                      >
                        <span class="material-icons text-base">arrow_downward</span>
                      </button>
                    </template>
                    <template v-else>
                      <BaseButton
                        variant="secondary"
                        size="xs"
                        @click="handleOpenActivityEditor(undefined, aula.id)"
                        title="Criar nova atividade para esta aula"
                        class="mr-1"
                      >
                        <span class="material-icons text-xs">add</span>
                        <span>Nova Atividade</span>
                      </BaseButton>
                      <BaseButton
                        variant="ghost"
                        size="xs"
                        @click="handleOpenVincularModal(aula)"
                        title="Vincular atividades existentes a esta aula"
                        class="mr-1 text-secondary hover:text-primary"
                      >
                        <span class="material-icons text-xs">link</span>
                        <span>Vincular</span>
                      </BaseButton>
                      <button
                        @click="handleOpenMarpModal(aula)"
                        title="Editar Aula"
                        class="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary rounded-md hover:bg-surface transition-colors"
                      >
                        <span class="material-icons text-sm">edit</span>
                      </button>
                      <button
                        @click="handleDeleteAula(aula.id)"
                        title="Excluir Aula"
                        class="w-8 h-8 flex items-center justify-center text-secondary hover:text-danger rounded-md hover:bg-danger/10 transition-colors"
                      >
                        <span class="material-icons text-sm">delete</span>
                      </button>
                    </template>
                  </div>
                </div>

                <!-- Sub-bloco de Atividades da Aula -->
                <div v-if="getAulaAtividades(aula.id).length > 0" class="border-t border-line bg-surface/60 p-3 sm:p-4 space-y-2">
                  <div class="flex items-center justify-between px-1">
                    <div class="text-[11px] font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
                      <span class="material-icons text-xs text-accent">assignment</span>
                      <span>Atividades Desta Aula ({{ getAulaAtividades(aula.id).length }})</span>
                    </div>
                    <button
                      v-if="!isReordering"
                      type="button"
                      class="text-[11px] text-accent hover:underline font-semibold flex items-center gap-1"
                      @click="handleOpenVincularModal(aula)"
                    >
                      <span class="material-icons text-xs">link</span>
                      <span>Gerenciar Vínculos</span>
                    </button>
                  </div>

                  <div class="space-y-2">
                    <div
                      v-for="(atv, atvIdx) in getAulaAtividades(aula.id)"
                      :key="atv.id"
                      class="bg-surface-alt border border-line rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-line-strong hover:shadow-xs transition-all"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <div
                          class="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                          :class="getActivityTypeBadge(atv.tipo).badgeClass"
                        >
                          <span class="material-icons text-base">
                            {{ atv.icone || getActivityTypeBadge(atv.tipo).icon }}
                          </span>
                        </div>
                        <div class="min-w-0">
                          <div class="flex items-center gap-2">
                            <h4 class="text-sm font-semibold text-primary leading-snug truncate">{{ atv.titulo }}</h4>
                            <span
                              class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                              :class="getActivityTypeBadge(atv.tipo).badgeClass"
                            >
                              {{ getActivityTypeBadge(atv.tipo).label }}
                            </span>
                          </div>
                          <p v-if="atv.descricao" class="text-xs text-secondary leading-relaxed truncate mt-0.5">
                            {{ atv.descricao }}
                          </p>
                        </div>
                      </div>

                      <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <template v-if="isReordering">
                          <button
                            @click="moveAtividadeInGroup(atv.id, 'up')"
                            :disabled="atvIdx === 0"
                            title="Mover para cima"
                            class="w-8 h-8 flex items-center justify-center text-secondary hover:text-accent hover:bg-accent/10 disabled:opacity-30 disabled:pointer-events-none rounded-md transition-colors"
                          >
                            <span class="material-icons text-base">arrow_upward</span>
                          </button>
                          <button
                            @click="moveAtividadeInGroup(atv.id, 'down')"
                            :disabled="atvIdx === getAulaAtividades(aula.id).length - 1"
                            title="Mover para baixo"
                            class="w-8 h-8 flex items-center justify-center text-secondary hover:text-accent hover:bg-accent/10 disabled:opacity-30 disabled:pointer-events-none rounded-md transition-colors"
                          >
                            <span class="material-icons text-base">arrow_downward</span>
                          </button>
                        </template>
                        <template v-else>
                          <BaseButton variant="secondary" size="xs" @click="handleOpenRespostas(atv)">
                            <span class="material-icons text-xs">analytics</span>
                            <span>Ver Respostas dos Alunos</span>
                          </BaseButton>
                          <button
                            @click="handleDesvincularAtividade(atv, aula.id)"
                            title="Desvincular desta aula (tornar atividade geral)"
                            class="w-8 h-8 flex items-center justify-center text-secondary hover:text-amber-500 rounded-md hover:bg-amber-500/10 transition-colors"
                          >
                            <span class="material-icons text-sm">link_off</span>
                          </button>
                          <button
                            @click="handleOpenActivityEditor(atv)"
                            title="Editar Atividade"
                            class="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary rounded-md hover:bg-surface transition-colors"
                          >
                            <span class="material-icons text-sm">edit</span>
                          </button>
                          <button
                            @click="handleDeleteActivity(atv.id)"
                            title="Excluir Atividade"
                            class="w-8 h-8 flex items-center justify-center text-secondary hover:text-danger rounded-md hover:bg-danger/10 transition-colors"
                          >
                            <span class="material-icons text-sm">delete</span>
                          </button>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Estado sutil quando não há atividades na aula -->
                <div
                  v-else-if="!isReordering"
                  class="border-t border-dashed border-line bg-surface/30 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-secondary"
                >
                  <span class="flex items-center gap-1.5 text-muted">
                    <span class="material-icons text-sm">info_outline</span>
                    <span>Nenhuma atividade vinculada a esta aula.</span>
                  </span>
                  <div class="flex items-center gap-2">
                    <BaseButton
                      variant="ghost"
                      size="xs"
                      @click="handleOpenVincularModal(aula)"
                      class="text-secondary hover:text-primary font-semibold"
                      title="Vincular atividades já criadas"
                    >
                      <span class="material-icons text-xs">link</span>
                      <span>Vincular existente</span>
                    </BaseButton>
                    <BaseButton
                      variant="ghost"
                      size="xs"
                      @click="handleOpenActivityEditor(undefined, aula.id)"
                      class="text-accent hover:text-accent-hover font-semibold"
                    >
                      <span class="material-icons text-xs">add</span>
                      <span>Criar nova</span>
                    </BaseButton>
                  </div>
                </div>
              </div>
            </div>

            <!-- Seção: Atividades Gerais (Sem Aula Vinculada) -->
            <div
              v-if="atividadesGerais.length > 0"
              class="bg-surface-alt rounded-xl border border-line flex flex-col overflow-hidden transition-all duration-base shadow-card mt-6"
            >
              <div class="h-1 w-full bg-secondary/40" />

              <div class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-alt border-b border-line">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="flex-shrink-0 w-9 h-9 rounded-md bg-secondary/15 text-secondary flex items-center justify-center shadow-xs">
                    <span class="material-icons text-[18px]">inventory_2</span>
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h3 class="text-sm font-semibold text-primary leading-snug">Atividades Gerais & Revisão</h3>
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface border border-line text-secondary">
                        {{ atividadesGerais.length }} {{ atividadesGerais.length === 1 ? 'atividade' : 'atividades' }}
                      </span>
                    </div>
                    <p class="text-xs text-secondary leading-relaxed mt-0.5">
                      Atividades pedagógicas gerais, de encerramento ou não vinculadas a uma aula específica
                    </p>
                  </div>
                </div>

                <div v-if="!isReordering" class="shrink-0 self-end sm:self-center">
                  <BaseButton
                    variant="secondary"
                    size="xs"
                    @click="handleOpenActivityEditor()"
                  >
                    <span class="material-icons text-xs">add</span>
                    <span>Criar Atividade Geral</span>
                  </BaseButton>
                </div>
              </div>

              <div class="p-3 sm:p-4 bg-surface/30">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    v-for="(atv, atvIdx) in atividadesGerais"
                    :key="atv.id"
                    class="bg-surface-alt border border-line rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-line-strong transition-all"
                  >
                    <div class="flex items-center gap-3 min-w-0">
                      <div
                        class="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                        :class="getActivityTypeBadge(atv.tipo).badgeClass"
                      >
                        <span class="material-icons text-base">
                          {{ atv.icone || getActivityTypeBadge(atv.tipo).icon }}
                        </span>
                      </div>
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <h4 class="text-sm font-semibold text-primary leading-snug truncate">{{ atv.titulo }}</h4>
                          <span
                            class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                            :class="getActivityTypeBadge(atv.tipo).badgeClass"
                          >
                            {{ getActivityTypeBadge(atv.tipo).label }}
                          </span>
                        </div>
                        <p v-if="atv.descricao" class="text-xs text-secondary leading-relaxed truncate mt-0.5">
                          {{ atv.descricao }}
                        </p>
                      </div>
                    </div>

                    <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <template v-if="isReordering">
                        <button
                          @click="moveAtividadeInGroup(atv.id, 'up')"
                          :disabled="atvIdx === 0"
                          title="Mover para cima"
                          class="w-8 h-8 flex items-center justify-center text-secondary hover:text-accent hover:bg-accent/10 disabled:opacity-30 disabled:pointer-events-none rounded-md transition-colors"
                        >
                          <span class="material-icons text-base">arrow_upward</span>
                        </button>
                        <button
                          @click="moveAtividadeInGroup(atv.id, 'down')"
                          :disabled="atvIdx === atividadesGerais.length - 1"
                          title="Mover para baixo"
                          class="w-8 h-8 flex items-center justify-center text-secondary hover:text-accent hover:bg-accent/10 disabled:opacity-30 disabled:pointer-events-none rounded-md transition-colors"
                        >
                          <span class="material-icons text-base">arrow_downward</span>
                        </button>
                      </template>
                      <template v-else>
                        <BaseButton variant="secondary" size="xs" @click="handleOpenRespostas(atv)">
                          <span class="material-icons text-xs">analytics</span>
                          <span>Ver Respostas dos Alunos</span>
                        </BaseButton>
                        <button
                          v-if="localAulas.length > 0"
                          @click="handleOpenVincularAtividadeEspecifica(atv)"
                          title="Vincular a uma aula"
                          class="w-8 h-8 flex items-center justify-center text-secondary hover:text-accent rounded-md hover:bg-accent/10 transition-colors"
                        >
                          <span class="material-icons text-sm">link</span>
                        </button>
                        <button
                          @click="handleOpenActivityEditor(atv)"
                          title="Editar Atividade"
                          class="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary rounded-md hover:bg-surface transition-colors"
                        >
                          <span class="material-icons text-sm">edit</span>
                        </button>
                        <button
                          @click="handleDeleteActivity(atv.id)"
                          title="Excluir Atividade"
                          class="w-8 h-8 flex items-center justify-center text-secondary hover:text-danger rounded-md hover:bg-danger/10 transition-colors"
                        >
                          <span class="material-icons text-sm">delete</span>
                        </button>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </transition>
    </main>

    <!-- Modals -->
    <DisciplinaFormModal
      :show="showDisciplinaModal"
      :disciplina="editingDisciplina"
      :loading="isSavingDisciplina"
      @close="showDisciplinaModal = false"
      @submit="handleSaveDisciplina"
    />

    <!-- Marp Editor Modal -->
    <MarpEditorModal
      :show="showMarpModal"
      :titulo="editingAula?.titulo"
      :descricao="editingAula?.descricao"
      :markdown="editingAula?.conteudo_md"
      :loading="isSavingAula"
      :aulas="cursoStore.aulas"
      :disciplina-id="selectedDisciplina?.id"
      @close="showMarpModal = false"
      @save="handleSaveMarpAula"
    />

    <!-- JSON Activity Editor Modal -->
    <JsonActivityEditorModal
      :show="showActivityEditorModal"
      :atividade="editingActivity"
      :default-aula-id="selectedDefaultAulaId"
      :loading="isSavingActivity"
      :aulas="cursoStore.aulas"
      :disciplina-id="selectedDisciplina?.id"
      @close="showActivityEditorModal = false"
      @save="handleSaveActivity"
    />

    <RespostasModal
      :show="showRespostasModal"
      :atividade="selectedRespostasAtividade"
      @close="showRespostasModal = false"
    />

    <FeedbackConsolidadoModal
      :show="showFeedbackConsolidadoModal"
      :disciplina-id="selectedDisciplina?.id || null"
      :disciplina-nome="selectedDisciplina?.nome"
      @close="showFeedbackConsolidadoModal = false"
    />

    <ConfirmDialog
      v-model="showDelDisc"
      message="Tem certeza que deseja excluir esta disciplina?"
      :danger="true"
      confirm-text="Excluir"
      cancel-text="Cancelar"
      @confirm="onConfirmDelDisc"
      @cancel="onCancelDelDisc"
    />

    <ConfirmDialog
      v-model="showDelAula"
      message="Tem certeza que deseja excluir esta aula?"
      :danger="true"
      confirm-text="Excluir"
      cancel-text="Cancelar"
      @confirm="onConfirmDelAula"
      @cancel="onCancelDelAula"
    />

    <ConfirmDialog
      v-model="showDelAtiv"
      message="Tem certeza que deseja excluir esta atividade?"
      :danger="true"
      confirm-text="Excluir"
      cancel-text="Cancelar"
      @confirm="onConfirmDelAtiv"
      @cancel="onCancelDelAtiv"
    />

    <!-- Modal de Vinculação de Atividades à Aula -->
    <BaseModal
      :model-value="showVincularModal"
      :title="'Vincular Atividades: ' + (targetAulaParaVincular?.titulo || '')"
      max-width="max-w-xl"
      @close="showVincularModal = false"
    >
      <div class="space-y-4">
        <p class="text-xs text-secondary leading-relaxed">
          Selecione quais atividades devem pertencer a esta aula. Atividades marcadas serão aninhadas no módulo desta aula.
        </p>

        <div v-if="cursoStore.atividades.length === 0" class="p-6 text-center text-muted text-xs bg-surface-alt rounded-xl border border-line">
          Nenhuma atividade cadastrada na disciplina ainda.
        </div>

        <div v-else class="space-y-2 max-h-80 overflow-y-auto pr-1">
          <label
            v-for="atv in cursoStore.atividades"
            :key="atv.id"
            :class="[
              'p-3 rounded-lg border cursor-pointer flex items-center justify-between gap-3 transition-all select-none',
              selectedAtividadeIdsParaAula.includes(atv.id)
                ? 'bg-accent/10 border-accent/50 ring-1 ring-accent/30'
                : 'bg-surface-alt border-line hover:border-line-strong'
            ]"
          >
            <div class="flex items-center gap-3 min-w-0">
              <input
                type="checkbox"
                v-model="selectedAtividadeIdsParaAula"
                :value="atv.id"
                :aria-label="atv.titulo"
                class="w-4 h-4 text-accent border-line rounded focus:ring-accent cursor-pointer shrink-0"
              />
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-semibold text-primary truncate">{{ atv.titulo }}</span>
                  <span
                    class="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded"
                    :class="getActivityTypeBadge(atv.tipo).badgeClass"
                  >
                    {{ getActivityTypeBadge(atv.tipo).label }}
                  </span>
                </div>
                <p v-if="atv.descricao" class="text-xs text-secondary truncate mt-0.5">{{ atv.descricao }}</p>
              </div>
            </div>

            <div class="shrink-0 text-right">
              <span
                :class="['text-[10px] font-medium px-2 py-0.5 rounded-full', getAtividadeStatusVinculo(atv, targetAulaParaVincular?.id).badgeClass]"
              >
                {{ getAtividadeStatusVinculo(atv, targetAulaParaVincular?.id).text }}
              </span>
            </div>
          </label>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" size="sm" @click="showVincularModal = false">
            Cancelar
          </BaseButton>
          <BaseButton
            variant="primary"
            size="sm"
            :loading="isSavingVinculos"
            @click="handleSalvarVinculos"
          >
            Salvar Vínculos
          </BaseButton>
        </div>
      </template>
    </BaseModal>

    <!-- Modal de Vinculação Rápida de Atividade Específica -->
    <BaseModal
      :model-value="showVincularAtividadeModal"
      :title="'Vincular Atividade: ' + (targetAtividadeParaVincular?.titulo || '')"
      max-width="max-w-md"
      @close="showVincularAtividadeModal = false"
    >
      <div class="space-y-4">
        <p class="text-xs text-secondary leading-relaxed">
          Escolha a aula à qual esta atividade deve pertencer ou mantenha-a como atividade geral de revisão.
        </p>
        <BaseSelect
          v-model="selectedDestinoAulaId"
          label="Aula de Destino"
          :options="aulaSelectOptions"
        />
      </div>

      <template #footer>
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" size="sm" @click="showVincularAtividadeModal = false">
            Cancelar
          </BaseButton>
          <BaseButton
            variant="primary"
            size="sm"
            :loading="isSavingAtividadeDestino"
            @click="handleSalvarDestinoAtividade"
          >
            Salvar
          </BaseButton>
        </div>
      </template>
    </BaseModal>
  </div>
</template>
