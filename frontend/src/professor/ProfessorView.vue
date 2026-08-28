<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
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

function handleOpenActivityEditor(atividade?: Atividade) {
  editingActivity.value = atividade || null;
  showActivityEditorModal.value = true;
}

const isSavingActivity = ref(false);

async function handleSaveActivity(payload: any) {
  if (!selectedDisciplina.value || isSavingActivity.value) return;
  const isEditing = Boolean(editingActivity.value);
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

// Modo de Reordenação e Drag & Drop
const isReorderingAulas = ref(false);
const isReorderingAtividades = ref(false);
const isSavingOrders = ref(false);

const localAulas = ref<Aula[]>([]);
const localAtividades = ref<Atividade[]>([]);

watch(() => cursoStore.aulas, (val) => {
  localAulas.value = [...val];
}, { immediate: true });

watch(() => cursoStore.atividades, (val) => {
  localAtividades.value = [...val];
}, { immediate: true });

function toggleReorderAulas() {
  if (isReorderingAulas.value) {
    saveAulasOrder();
  } else {
    isReorderingAulas.value = true;
  }
}

async function saveAulasOrder() {
  if (isSavingOrders.value) return;

  const res = await executeWithFeedback(
    async () => {
      for (let i = 0; i < localAulas.value.length; i++) {
        const item = localAulas.value[i];
        if (item.ordem !== i) {
          await apiClient.put(`/aulas/${item.id}`, { ...item, ordem: i });
        }
      }
      return { success: true, status: 200 };
    },
    {
      loadingRef: isSavingOrders,
      successMessage: 'Ordem das aulas atualizada com sucesso!',
      errorMessage: 'Falha ao salvar a nova ordem das aulas.'
    }
  );

  isReorderingAulas.value = false;
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

function toggleReorderAtividades() {
  if (isReorderingAtividades.value) {
    saveAtividadesOrder();
  } else {
    isReorderingAtividades.value = true;
  }
}

async function saveAtividadesOrder() {
  if (isSavingOrders.value) return;

  const res = await executeWithFeedback(
    async () => {
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
      successMessage: 'Ordem das atividades atualizada com sucesso!',
      errorMessage: 'Falha ao salvar a nova ordem das atividades.'
    }
  );

  isReorderingAtividades.value = false;
  if (res.success && selectedDisciplina.value) {
    await cursoStore.loadDisciplinaContent(selectedDisciplina.value.id);
  }
}

function moveAtividade(index: number, direction: 'up' | 'down') {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= localAtividades.value.length) return;
  const list = [...localAtividades.value];
  const item = list.splice(index, 1)[0];
  list.splice(target, 0, item);
  localAtividades.value = list;
}

// Drag and drop HTML5 Nativo
let draggedType: 'aula' | 'atividade' | null = null;
let draggedIndex: number | null = null;

function onDragStart(type: 'aula' | 'atividade', index: number, e: DragEvent) {
  draggedType = type;
  draggedIndex = index;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
}

function onDrop(type: 'aula' | 'atividade', targetIndex: number, e: DragEvent) {
  e.preventDefault();
  if (draggedType !== type || draggedIndex === null || draggedIndex === targetIndex) return;
  
  if (type === 'aula') {
    const list = [...localAulas.value];
    const item = list.splice(draggedIndex, 1)[0];
    list.splice(targetIndex, 0, item);
    localAulas.value = list;
  } else {
    const list = [...localAtividades.value];
    const item = list.splice(draggedIndex, 1)[0];
    list.splice(targetIndex, 0, item);
    localAtividades.value = list;
  }
  draggedType = null;
  draggedIndex = null;
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

        <!-- Content View (Aulas e Atividades) -->
        <section v-else key="detalhes" class="space-y-6">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-line pb-4 gap-4">
            <div class="flex items-center gap-3">
              <BackButton @click="goBack" />
              <div>
                <h2 class="text-2xl font-bold text-primary">{{ selectedDisciplina?.nome }}</h2>
                <p class="text-secondary text-xs mt-0.5">{{ selectedDisciplina?.descricao }}</p>
              </div>
            </div>

            <BaseButton
              variant="primary"
              size="sm"
              class="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
              @click="showFeedbackConsolidadoModal = true"
            >
              <span class="material-icons text-sm">mark_email_read</span>
              <span>Gerar Feedback da Disciplina</span>
            </BaseButton>
          </div>

          <!-- Aulas -->
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold text-primary flex items-center gap-2">
                <span>Aulas (Marp Markdown)</span>
                <span v-if="isReorderingAulas" class="text-xs font-normal text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                  Arraste ou use as setas para reordenar
                </span>
              </h3>
              <div class="flex items-center space-x-2">
                <BaseButton
                  v-if="cursoStore.aulas.length > 1"
                  :variant="isReorderingAulas ? 'primary' : 'secondary'"
                  size="sm"
                  :disabled="isSavingOrders"
                  @click="toggleReorderAulas"
                >
                  <span class="material-icons text-sm">{{ isReorderingAulas ? 'save' : 'swap_vert' }}</span>
                  <span>{{ isSavingOrders ? 'Salvando...' : (isReorderingAulas ? 'Salvar Ordem' : 'Reordenar') }}</span>
                </BaseButton>

                <BaseButton variant="primary" size="sm" @click="handleOpenMarpModal()">
                  <span class="material-icons text-sm">add</span>
                  <span>Nova Aula</span>
                </BaseButton>
              </div>
            </div>

            <div v-if="cursoStore.loadingContent" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-label="Carregando aulas">
              <div v-for="n in 3" :key="n" class="p-4 bg-surface-alt border border-line rounded-2xl flex items-center justify-between">
                <div class="flex items-center space-x-3 w-full">
                  <BaseSkeleton width="w-6" height="h-6" rounded="rounded-md" />
                  <div class="flex-1 space-y-1.5">
                    <BaseSkeleton height="h-3.5" width="w-3/4" />
                    <BaseSkeleton height="h-2.5" width="w-1/2" />
                  </div>
                </div>
              </div>
            </div>

            <EmptyState v-else-if="localAulas.length === 0" message="Nenhuma aula cadastrada nesta disciplina." />

            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                v-for="(aula, idx) in localAulas"
                :key="aula.id"
                :draggable="isReorderingAulas"
                @dragstart="onDragStart('aula', idx, $event)"
                @dragover="onDragOver($event)"
                @drop="onDrop('aula', idx, $event)"
                class="group relative bg-surface-alt rounded-lg border border-line flex flex-col overflow-hidden transition-all duration-base"
                :class="{
                  'border-accent/60 cursor-grab active:cursor-grabbing shadow-card': isReorderingAulas,
                  'hover:border-line-strong hover:shadow-card': !isReorderingAulas
                }"
              >
                <!-- Top accent bar -->
                <div class="h-1.5 w-full bg-accent" />

                <div class="p-4 flex flex-col gap-3 flex-1">
                  <div class="flex items-center gap-3">
                    <div class="flex-shrink-0 w-9 h-9 rounded-md bg-accent flex items-center justify-center text-white shadow-xs">
                      <span class="material-icons text-[18px]">
                        {{ isReorderingAulas ? 'drag_indicator' : (aula.icone || 'slideshow') }}
                      </span>
                    </div>

                    <div class="flex-1 min-w-0">
                      <h4 class="text-sm font-semibold text-primary leading-snug truncate">{{ aula.titulo }}</h4>
                      <p class="text-xs text-secondary leading-relaxed truncate">{{ aula.descricao || 'Apresentação em slides Marp' }}</p>
                    </div>

                    <div class="flex items-center space-x-1 shrink-0 ml-2">
                      <div v-if="isReorderingAulas" class="flex items-center space-x-1">
                        <button @click="moveAula(idx, 'up')" :disabled="idx === 0" title="Mover para cima" class="p-1 text-secondary hover:text-accent disabled:opacity-30 disabled:pointer-events-none rounded">
                          <span class="material-icons text-base">arrow_upward</span>
                        </button>
                        <button @click="moveAula(idx, 'down')" :disabled="idx === localAulas.length - 1" title="Mover para baixo" class="p-1 text-secondary hover:text-accent disabled:opacity-30 disabled:pointer-events-none rounded">
                          <span class="material-icons text-base">arrow_downward</span>
                        </button>
                      </div>
                      <template v-else>
                        <button @click="handleOpenMarpModal(aula)" title="Editar Aula" class="p-1.5 text-secondary hover:text-primary rounded-lg hover:bg-surface transition-colors">
                          <span class="material-icons text-sm">edit</span>
                        </button>
                        <button @click="handleDeleteAula(aula.id)" title="Excluir Aula" class="p-1.5 text-secondary hover:text-danger rounded-lg hover:bg-surface transition-colors">
                          <span class="material-icons text-sm">delete</span>
                        </button>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Atividades -->
          <div class="space-y-4 pt-4 border-t border-line">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold text-primary flex items-center gap-2">
                <span>Atividades & Avaliações</span>
                <span v-if="isReorderingAtividades" class="text-xs font-normal text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                  Arraste ou use as setas para reordenar
                </span>
              </h3>
              <div class="flex items-center space-x-2">
                <BaseButton
                  v-if="cursoStore.atividades.length > 1"
                  :variant="isReorderingAtividades ? 'primary' : 'secondary'"
                  size="sm"
                  :disabled="isSavingOrders"
                  @click="toggleReorderAtividades"
                >
                  <span class="material-icons text-sm">{{ isReorderingAtividades ? 'save' : 'swap_vert' }}</span>
                  <span>{{ isSavingOrders ? 'Salvando...' : (isReorderingAtividades ? 'Salvar Ordem' : 'Reordenar') }}</span>
                </BaseButton>

                <BaseButton variant="primary" size="sm" @click="handleOpenActivityEditor()">
                  <span class="material-icons text-sm">add</span>
                  <span>Nova Atividade</span>
                </BaseButton>
              </div>
            </div>

            <div v-if="cursoStore.loadingContent" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-label="Carregando atividades">
              <div v-for="n in 3" :key="n" class="p-4 bg-surface-alt border border-line rounded-lg flex flex-col justify-between space-y-3">
                <div class="flex items-center space-x-3 w-full">
                  <BaseSkeleton width="w-9" height="h-9" rounded="rounded-md" />
                  <div class="flex-1 space-y-1.5">
                    <BaseSkeleton height="h-3.5" width="w-3/4" />
                    <BaseSkeleton height="h-2.5" width="w-1/2" />
                  </div>
                </div>
                <BaseSkeleton height="h-7" width="w-full" rounded="rounded-control" />
              </div>
            </div>

            <EmptyState v-else-if="localAtividades.length === 0" message="Nenhuma atividade cadastrada nesta disciplina." />

            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                v-for="(atv, idx) in localAtividades"
                :key="atv.id"
                :draggable="isReorderingAtividades"
                @dragstart="onDragStart('atividade', idx, $event)"
                @dragover="onDragOver($event)"
                @drop="onDrop('atividade', idx, $event)"
                class="group relative bg-surface-alt rounded-lg border border-line flex flex-col overflow-hidden transition-all duration-base"
                :class="{
                  'border-accent/60 cursor-grab active:cursor-grabbing shadow-card': isReorderingAtividades,
                  'hover:border-line-strong hover:shadow-card': !isReorderingAtividades
                }"
              >
                <!-- Top accent bar -->
                <div class="h-1.5 w-full bg-accent" />

                <div class="p-4 flex flex-col gap-3 flex-1 justify-between">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="flex-shrink-0 w-9 h-9 rounded-md bg-accent flex items-center justify-center text-white shadow-xs">
                        <span class="material-icons text-[18px]">
                          {{ isReorderingAtividades ? 'drag_indicator' : (atv.icone || 'assignment') }}
                        </span>
                      </div>
                      <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                          <h4 class="text-sm font-semibold text-primary leading-snug truncate">{{ atv.titulo }}</h4>
                        </div>
                        <p class="text-xs text-secondary leading-relaxed truncate">{{ atv.descricao || 'Atividade interativa' }}</p>
                      </div>
                    </div>

                    <div class="flex items-center space-x-1 shrink-0 ml-2">
                      <div v-if="isReorderingAtividades" class="flex items-center space-x-1">
                        <button @click="moveAtividade(idx, 'up')" :disabled="idx === 0" title="Mover para cima" class="p-1 text-secondary hover:text-accent disabled:opacity-30 disabled:pointer-events-none rounded">
                          <span class="material-icons text-base">arrow_upward</span>
                        </button>
                        <button @click="moveAtividade(idx, 'down')" :disabled="idx === localAtividades.length - 1" title="Mover para baixo" class="p-1 text-secondary hover:text-accent disabled:opacity-30 disabled:pointer-events-none rounded">
                          <span class="material-icons text-base">arrow_downward</span>
                        </button>
                      </div>
                      <template v-else>
                        <button @click="handleOpenActivityEditor(atv)" title="Editar Atividade" class="p-1.5 text-secondary hover:text-primary rounded-lg hover:bg-surface transition-colors">
                          <span class="material-icons text-sm">edit</span>
                        </button>
                        <button @click="handleDeleteActivity(atv.id)" title="Excluir Atividade" class="p-1.5 text-secondary hover:text-danger rounded-lg hover:bg-surface transition-colors">
                          <span class="material-icons text-sm">delete</span>
                        </button>
                      </template>
                    </div>
                  </div>

                  <div v-if="!isReorderingAtividades" class="pt-2 border-t border-line">
                    <BaseButton variant="secondary" size="xs" block @click="handleOpenRespostas(atv)">
                      <span class="material-icons text-xs">analytics</span>
                      <span>Ver Respostas dos Alunos</span>
                    </BaseButton>
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
      @close="showMarpModal = false"
      @save="handleSaveMarpAula"
    />

    <!-- JSON Activity Editor Modal -->
    <JsonActivityEditorModal
      :show="showActivityEditorModal"
      :atividade="editingActivity"
      :loading="isSavingActivity"
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
  </div>
</template>
