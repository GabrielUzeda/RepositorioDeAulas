<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/shared/stores/auth';
import { useCursoStore } from '@/shared/stores/curso';
import { apiClient } from '@/shared/api/client';
import DisciplinaFormModal from '@/professor/components/DisciplinaFormModal.vue';
import MarpEditorModal from '@/professor/components/MarpEditorModal.vue';
import JsonActivityEditorModal from '@/professor/components/JsonActivityEditorModal.vue';
import RespostasModal from '@/professor/components/RespostasModal.vue';
import FeedbackConsolidadoModal from '@/professor/components/FeedbackConsolidadoModal.vue';
import ThemeToggle from '@/shared/components/ThemeToggle.vue';
import BaseButton from '@/shared/components/BaseButton.vue';
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

function handleOpenDisciplinaModal(disciplina?: Disciplina) {
  editingDisciplina.value = disciplina || null;
  showDisciplinaModal.value = true;
}

const isSavingDisciplina = ref(false);

async function handleSaveDisciplina(data: Partial<Disciplina>) {
  if (!selectedCurso.value || isSavingDisciplina.value) return;
  isSavingDisciplina.value = true;
  try {
    const payload = { ...data, curso_id: selectedCurso.value.id };
    if (editingDisciplina.value) {
      await apiClient.put(`/disciplinas/${editingDisciplina.value.id}`, payload);
    } else {
      await apiClient.post('/disciplinas', payload);
    }
    showDisciplinaModal.value = false;
    await showDisciplinas();
  } finally {
    isSavingDisciplina.value = false;
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
  await apiClient.delete(`/disciplinas/${delDiscId.value}`);
  await showDisciplinas();
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
  isSavingAula.value = true;

  try {
    const data = {
      disciplina_id: selectedDisciplina.value.id,
      titulo: payload.titulo,
      descricao: payload.descricao,
      markdown: payload.markdown
    };

    if (editingAula.value) {
      await apiClient.put(`/aulas/${editingAula.value.id}`, data);
    } else {
      await apiClient.post('/aulas', data);
    }

    showMarpModal.value = false;
    await cursoStore.loadDisciplinaContent(selectedDisciplina.value.id);
  } finally {
    isSavingAula.value = false;
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
  await apiClient.delete(`/aulas/${delAulaId.value}`);
  if (selectedDisciplina.value) await cursoStore.loadDisciplinaContent(selectedDisciplina.value.id);
}

function onCancelDelAula() {}

function handleOpenActivityEditor(atividade?: Atividade) {
  editingActivity.value = atividade || null;
  showActivityEditorModal.value = true;
}

const isSavingActivity = ref(false);

async function handleSaveActivity(payload: any) {
  if (!selectedDisciplina.value || isSavingActivity.value) return;
  isSavingActivity.value = true;

  try {
    const data = {
      ...payload,
      disciplina_id: selectedDisciplina.value.id
    };

    if (editingActivity.value) {
      await apiClient.put(`/atividades/${editingActivity.value.id}`, data);
    } else {
      await apiClient.post('/atividades', data);
    }

    showActivityEditorModal.value = false;
    await cursoStore.loadDisciplinaContent(selectedDisciplina.value.id);
  } finally {
    isSavingActivity.value = false;
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
  await apiClient.delete(`/atividades/${delAtivId.value}`);
  if (selectedDisciplina.value) await cursoStore.loadDisciplinaContent(selectedDisciplina.value.id);
}

function onCancelDelAtiv() {}

async function moveAula(index: number, direction: 'up' | 'down') {
  const list = cursoStore.aulas;
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= list.length) return;
  const a = list.splice(index, 1)[0];
  list.splice(target, 0, a);
  await apiClient.put(`/aulas/${a.id}`, { ordem: target });
  const b = list[index];
  if (b) await apiClient.put(`/aulas/${b.id}`, { ordem: index });
}

async function moveAtividade(index: number, direction: 'up' | 'down') {
  const list = cursoStore.atividades;
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= list.length) return;
  const a = list.splice(index, 1)[0];
  list.splice(target, 0, a);
  await apiClient.put(`/atividades/${a.id}`, { ordem: target });
  const b = list[index];
  if (b) await apiClient.put(`/atividades/${b.id}`, { ordem: index });
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
            <div
              v-for="curso in cursoStore.cursos"
              :key="curso.id"
              @click="handleOpenCurso(curso)"
              class="p-6 bg-surface-alt border border-line rounded-3xl hover:border-accent hover:bg-surface-alt transition cursor-pointer flex flex-col justify-between space-y-4 group"
            >
              <div class="flex items-start justify-between">
                <div class="w-12 h-12 rounded-2xl bg-surface text-accent border border-line flex items-center justify-center">
                  <span class="material-icons text-2xl">{{ curso.icone || 'school' }}</span>
                </div>
                <span class="material-icons text-secondary group-hover:text-primary transition">arrow_forward</span>
              </div>

              <div>
                <h3 class="text-lg font-bold text-primary group-hover:text-accent transition">{{ curso.nome }}</h3>
                <p class="text-secondary text-xs line-clamp-2 mt-1">{{ curso.descricao }}</p>
              </div>

              <div class="pt-4 border-t border-line flex items-center justify-between text-xs text-secondary">
                <span>{{ curso.total_disciplinas ?? 0 }} disciplinas</span>
              </div>
            </div>
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
            <div
              v-for="disciplina in cursoStore.disciplinas"
              :key="disciplina.id"
              class="p-6 bg-surface-alt border border-line rounded-3xl flex flex-col justify-between space-y-4 hover:border-secondary transition"
            >
              <div class="flex items-start justify-between">
                <div class="w-12 h-12 rounded-2xl bg-surface text-accent border border-line flex items-center justify-center">
                  <span class="material-icons text-2xl">{{ disciplina.icone || 'school' }}</span>
                </div>
                <div class="flex items-center space-x-1">
                  <button @click="handleOpenDisciplinaModal(disciplina)" title="Editar Disciplina" class="p-2 text-secondary hover:text-primary rounded-lg">
                    <span class="material-icons text-sm">edit</span>
                  </button>
                  <button @click="handleDeleteDisciplina(disciplina.id)" title="Excluir Disciplina" class="p-2 text-secondary hover:text-danger rounded-lg">
                    <span class="material-icons text-sm">delete</span>
                  </button>
                </div>
              </div>

              <div>
                <h3 class="text-lg font-bold text-primary">{{ disciplina.nome }}</h3>
                <p class="text-secondary text-xs line-clamp-2 mt-1">{{ disciplina.descricao }}</p>
              </div>

              <BaseButton variant="secondary" size="xs" block @click="handleOpenDisciplinaDetails(disciplina)">
                Gerenciar Aulas & Atividades
              </BaseButton>
            </div>
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
              @click="showFeedbackConsolidadoModal = true"
            >
              <span class="material-icons text-sm">mark_email_read</span>
              <span>Gerar Feedback da Disciplina</span>
            </BaseButton>
          </div>

          <!-- Aulas -->
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold text-primary">Aulas (Marp Markdown)</h3>
              <BaseButton variant="primary" size="sm" @click="handleOpenMarpModal()">
                <span class="material-icons text-sm">add</span>
                <span>Nova Aula</span>
              </BaseButton>
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

            <EmptyState v-else-if="cursoStore.aulas.length === 0" message="Nenhuma aula cadastrada nesta disciplina." />

            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div v-for="(aula, idx) in cursoStore.aulas" :key="aula.id" class="p-4 bg-surface-alt border border-line rounded-2xl flex items-center justify-between">
                <div class="flex items-center space-x-3 truncate">
                  <span class="material-icons text-accent text-lg shrink-0">slideshow</span>
                  <div class="truncate">
                    <p class="text-primary text-xs font-bold truncate">{{ aula.titulo }}</p>
                    <p class="text-secondary text-[10px] truncate">{{ aula.descricao }}</p>
                  </div>
                </div>
                <div class="flex items-center space-x-1 shrink-0 ml-2">
                  <div class="flex flex-col mr-1">
                    <button @click="moveAula(idx, 'up')" :disabled="idx === 0" title="Mover para cima" class="text-secondary hover:text-accent disabled:opacity-30 disabled:pointer-events-none">
                      <span class="material-icons text-sm">keyboard_arrow_up</span>
                    </button>
                    <button @click="moveAula(idx, 'down')" :disabled="idx === cursoStore.aulas.length - 1" title="Mover para baixo" class="text-secondary hover:text-accent disabled:opacity-30 disabled:pointer-events-none">
                      <span class="material-icons text-sm">keyboard_arrow_down</span>
                    </button>
                  </div>
                  <button @click="handleOpenMarpModal(aula)" title="Editar Aula" class="p-1.5 text-secondary hover:text-primary">
                    <span class="material-icons text-sm">edit</span>
                  </button>
                  <button @click="handleDeleteAula(aula.id)" title="Excluir Aula" class="p-1.5 text-secondary hover:text-danger">
                    <span class="material-icons text-sm">delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Atividades -->
          <div class="space-y-4 pt-4 border-t border-line">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold text-primary">Atividades & Avaliações</h3>
              <BaseButton variant="primary" size="sm" @click="handleOpenActivityEditor()">
                <span class="material-icons text-sm">add</span>
                <span>Nova Atividade</span>
              </BaseButton>
            </div>

            <div v-if="cursoStore.loadingContent" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-label="Carregando atividades">
              <div v-for="n in 3" :key="n" class="p-4 bg-surface-alt border border-line rounded-2xl flex flex-col justify-between space-y-3">
                <div class="flex items-center space-x-3 w-full">
                  <BaseSkeleton width="w-6" height="h-6" rounded="rounded-md" />
                  <div class="flex-1 space-y-1.5">
                    <BaseSkeleton height="h-3.5" width="w-3/4" />
                    <BaseSkeleton height="h-2.5" width="w-1/2" />
                  </div>
                </div>
                <BaseSkeleton height="h-7" width="w-full" rounded="rounded-control" />
              </div>
            </div>

            <EmptyState v-else-if="cursoStore.atividades.length === 0" message="Nenhuma atividade cadastrada nesta disciplina." />

            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div v-for="(atv, idx) in cursoStore.atividades" :key="atv.id" class="p-4 bg-surface-alt border border-line rounded-2xl flex flex-col justify-between space-y-3">
                <div class="flex items-start justify-between">
                  <div class="flex items-center space-x-3 truncate">
                    <span class="material-icons text-accent text-lg shrink-0">assignment</span>
                    <div class="truncate">
                      <p class="text-primary text-xs font-bold truncate">{{ atv.titulo }}</p>
                      <p class="text-secondary text-[10px] truncate">{{ atv.tipo || 'normal' }}</p>
                    </div>
                  </div>
                  <div class="flex items-center space-x-1 shrink-0 ml-2">
                    <div class="flex flex-col mr-1">
                      <button @click="moveAtividade(idx, 'up')" :disabled="idx === 0" title="Mover para cima" class="text-secondary hover:text-accent disabled:opacity-30 disabled:pointer-events-none">
                        <span class="material-icons text-sm">keyboard_arrow_up</span>
                      </button>
                      <button @click="moveAtividade(idx, 'down')" :disabled="idx === cursoStore.atividades.length - 1" title="Mover para baixo" class="text-secondary hover:text-accent disabled:opacity-30 disabled:pointer-events-none">
                        <span class="material-icons text-sm">keyboard_arrow_down</span>
                      </button>
                    </div>
                    <button @click="handleOpenActivityEditor(atv)" title="Editar Atividade" class="p-1.5 text-secondary hover:text-primary">
                      <span class="material-icons text-sm">edit</span>
                    </button>
                    <button @click="handleDeleteActivity(atv.id)" title="Excluir Atividade" class="p-1.5 text-secondary hover:text-danger">
                      <span class="material-icons text-sm">delete</span>
                    </button>
                  </div>
                </div>

                <BaseButton variant="secondary" size="xs" block @click="handleOpenRespostas(atv)">
                  <span class="material-icons text-xs">analytics</span>
                  <span>Ver Respostas dos Alunos</span>
                </BaseButton>
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
