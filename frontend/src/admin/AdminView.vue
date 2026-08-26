<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/shared/stores/auth';
import { apiClient } from '@/shared/api/client';
import ProfessorFormModal from '@/admin/components/ProfessorFormModal.vue';
import CursoFormModal from '@/admin/components/CursoFormModal.vue';
import CursoCard from '@/aluno/components/CursoCard.vue';
import ThemeToggle from '@/shared/components/ThemeToggle.vue';
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import BaseButton from '@/shared/components/BaseButton.vue';
import BaseBadge from '@/shared/components/BaseBadge.vue';
import BaseSkeleton from '@/shared/components/BaseSkeleton.vue';
import BackButton from '@/shared/components/BackButton.vue';
import type { Professor, Curso } from '@/shared/types';

const router = useRouter();
const authStore = useAuthStore();

const activeTab = ref<'professores' | 'cursos'>('professores');

const professores = ref<Professor[]>([]);
const cursos = ref<Curso[]>([]);
const loadingProfessores = ref(false);
const loadingCursos = ref(false);
const error = ref('');

const showProfessorModal = ref(false);
const editingProfessor = ref<Professor | null>(null);

const showCursoModal = ref(false);
const editingCurso = ref<Curso | null>(null);

onMounted(() => {
  fetchProfessores();
  fetchCursos();
});

async function fetchProfessores() {
  loadingProfessores.value = true;
  error.value = '';
  try {
    const res = await apiClient.get<Professor[]>('/professores');
    if (res.success && res.data) {
      professores.value = res.data;
    } else {
      error.value = res.error || 'Falha ao carregar professores.';
    }
  } finally {
    loadingProfessores.value = false;
  }
}

async function fetchCursos() {
  loadingCursos.value = true;
  error.value = '';
  try {
    const res = await apiClient.get<Curso[]>('/cursos');
    if (res.success && res.data) {
      cursos.value = res.data;
    } else {
      error.value = res.error || 'Falha ao carregar cursos.';
    }
  } finally {
    loadingCursos.value = false;
  }
}

import { executeWithFeedback } from '@/shared/api/requestHelper';

function openCreateProfessor() {
  editingProfessor.value = null;
  showProfessorModal.value = true;
}

function openEditProfessor(prof: Professor) {
  editingProfessor.value = prof;
  showProfessorModal.value = true;
}

async function handleSaveProfessor(payload: { nome: string; email: string; password: string; role: string; curso_ids: number[] }) {
  let profId = editingProfessor.value?.id;
  const isEditing = Boolean(editingProfessor.value);

  const res = await executeWithFeedback(async () => {
    if (isEditing && editingProfessor.value) {
      return apiClient.put(`/professores/${editingProfessor.value.id}`, payload);
    } else {
      const createRes = await apiClient.post<Professor>('/professores', payload);
      if (createRes.success && createRes.data) {
        profId = createRes.data.id;
      }
      return createRes;
    }
  }, {
    successMessage: isEditing ? 'Professor atualizado com sucesso!' : 'Professor criado com sucesso!',
    errorMessage: isEditing ? 'Falha ao atualizar professor.' : 'Falha ao criar professor.'
  });

  if (!res.success) return;

  if (profId && payload.role !== 'admin' && Array.isArray(payload.curso_ids)) {
    const resCursos = await executeWithFeedback(
      () => apiClient.put(`/professores/${profId}/cursos`, { curso_ids: payload.curso_ids }),
      {
        showSuccessToast: false,
        errorMessage: 'Falha ao vincular cursos ao professor.'
      }
    );
    if (!resCursos.success) return;
  }

  showProfessorModal.value = false;
  await fetchProfessores();
}

const showConfirmProf = ref(false);
const deleteTargetProf = ref<Professor | null>(null);

function onDeleteProfessorClick(prof: Professor) {
  deleteTargetProf.value = prof;
  showConfirmProf.value = true;
}

async function onConfirmProf() {
  const prof = deleteTargetProf.value;
  if (!prof) return;
  const res = await executeWithFeedback(
    () => apiClient.delete(`/professores/${prof.id}`),
    {
      successMessage: 'Professor excluído com sucesso!',
      errorMessage: 'Falha ao excluir professor.'
    }
  );
  if (res.success) {
    await fetchProfessores();
  }
}

function onCancelProf() {}

function openCreateCurso() {
  editingCurso.value = null;
  showCursoModal.value = true;
}

function openEditCurso(curso: Curso) {
  editingCurso.value = curso;
  showCursoModal.value = true;
}

async function handleSaveCurso(payload: { nome: string; descricao: string; cor: string; icone: string; professor_ids: number[] }) {
  let cursoId = editingCurso.value?.id;
  const isEditing = Boolean(editingCurso.value);

  const res = await executeWithFeedback(async () => {
    if (isEditing && editingCurso.value) {
      return apiClient.put(`/cursos/${editingCurso.value.id}`, payload);
    } else {
      const createRes = await apiClient.post<Curso>('/cursos', payload);
      if (createRes.success && createRes.data) {
        cursoId = createRes.data.id;
      }
      return createRes;
    }
  }, {
    successMessage: isEditing ? 'Curso atualizado com sucesso!' : 'Curso criado com sucesso!',
    errorMessage: isEditing ? 'Falha ao atualizar curso.' : 'Falha ao criar curso.'
  });

  if (!res.success) return;

  if (cursoId && Array.isArray(payload.professor_ids)) {
    const resProfs = await executeWithFeedback(
      () => apiClient.put(`/cursos/${cursoId}/professores`, { professor_ids: payload.professor_ids }),
      {
        showSuccessToast: false,
        errorMessage: 'Falha ao vincular professores ao curso.'
      }
    );
    if (!resProfs.success) return;
  }

  showCursoModal.value = false;
  await fetchCursos();
}

const showConfirmCurso = ref(false);
const deleteTargetCurso = ref<Curso | null>(null);

function onDeleteCursoClick(curso: Curso) {
  deleteTargetCurso.value = curso;
  showConfirmCurso.value = true;
}

async function onConfirmCurso() {
  const curso = deleteTargetCurso.value;
  if (!curso) return;
  const res = await executeWithFeedback(
    () => apiClient.delete(`/cursos/${curso.id}`),
    {
      successMessage: 'Curso excluído com sucesso!',
      errorMessage: 'Falha ao excluir curso.'
    }
  );
  if (res.success) {
    await fetchCursos();
  }
}

function onCancelCurso() {}

function logout() {
  authStore.logout();
  router.push('/login');
}
</script>

<template>
  <div class="min-h-screen bg-canvas text-primary">
    <!-- Header -->
    <header class="sticky top-0 z-30 border-b border-line bg-header-bg/80 backdrop-blur-md">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-md bg-accent flex items-center justify-center text-white">
            <span class="material-icons text-[18px]">shield</span>
          </div>
          <div>
            <h1 class="text-sm font-semibold text-primary leading-none">Painel Administrador</h1>
            <p class="text-xs text-muted leading-none mt-0.5">{{ authStore.professor?.email || 'Administrador' }}</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <BackButton label="Área do Aluno" @click="router.push('/')" />
          <ThemeToggle />
          <BaseButton variant="secondary" size="xs" @click="logout">
            <span class="material-icons text-[14px]">logout</span>
            <span>Sair</span>
          </BaseButton>
        </div>
      </div>
    </header>

    <!-- Main Container -->
    <main class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div v-if="error" class="mb-6 p-3.5 bg-danger-light border border-danger text-danger-text text-xs rounded-md flex items-center gap-2" role="alert">
        <span class="material-icons text-[16px]">error</span>
        <span>{{ error }}</span>
      </div>

      <!-- Tabs Bar -->
      <div class="flex items-center gap-1 bg-surface-alt rounded-md p-1 border border-line mb-6 w-fit" role="tablist">
        <button
          role="tab"
          :aria-selected="activeTab === 'professores'"
          @click="activeTab = 'professores'"
          class="px-4 py-1.5 rounded text-xs font-semibold transition-all duration-base"
          :class="activeTab === 'professores' ? 'bg-surface text-primary shadow-xs' : 'text-muted hover:text-secondary'"
        >
          Professores ({{ professores.length }})
        </button>

        <button
          role="tab"
          :aria-selected="activeTab === 'cursos'"
          @click="activeTab = 'cursos'"
          class="px-4 py-1.5 rounded text-xs font-semibold transition-all duration-base"
          :class="activeTab === 'cursos' ? 'bg-surface text-primary shadow-xs' : 'text-muted hover:text-secondary'"
        >
          Cursos ({{ cursos.length }})
        </button>
      </div>

      <!-- Professores Tab -->
      <div v-if="activeTab === 'professores'" class="space-y-4">
        <div class="flex justify-between items-center">
          <div>
            <h2 class="text-xl font-bold text-primary tracking-tight">Professores Cadastrados</h2>
            <p class="text-xs text-muted mt-0.5">Gerencie os acessos e permissões da equipe docente</p>
          </div>
          <BaseButton variant="primary" size="sm" @click="openCreateProfessor">
            <span class="material-icons text-[16px]">add</span>
            <span>Novo Professor</span>
          </BaseButton>
        </div>

        <!-- Skeleton da tabela de professores durante o carregamento -->
        <div v-if="loadingProfessores" class="bg-surface-alt rounded-md border border-line overflow-hidden shadow-xs" aria-busy="true" aria-label="Carregando professores">
          <table class="w-full text-xs text-left">
            <thead>
              <tr class="bg-surface border-b border-line text-muted font-semibold uppercase tracking-wider">
                <th class="px-5 py-3">Nome</th>
                <th class="px-5 py-3">E-mail</th>
                <th class="px-5 py-3">Perfil</th>
                <th class="px-5 py-3">Cursos</th>
                <th class="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr v-for="n in 5" :key="n">
                <td class="px-5 py-3.5"><BaseSkeleton height="h-3.5" width="w-28" /></td>
                <td class="px-5 py-3.5"><BaseSkeleton height="h-3.5" width="w-40" /></td>
                <td class="px-5 py-3.5"><BaseSkeleton height="h-5" width="w-16" rounded="rounded-full" /></td>
                <td class="px-5 py-3.5"><BaseSkeleton height="h-5" width="w-20" rounded="rounded-full" /></td>
                <td class="px-5 py-3.5 text-right">
                  <div class="flex justify-end gap-1">
                    <BaseSkeleton height="h-6" width="w-6" rounded="rounded-md" />
                    <BaseSkeleton height="h-6" width="w-6" rounded="rounded-md" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <EmptyState
          v-else-if="professores.length === 0"
          icon="people"
          title="Nenhum professor cadastrado"
          message="Clique no botão acima para adicionar o primeiro professor."
        />

        <div v-else class="bg-surface-alt rounded-md border border-line overflow-hidden shadow-xs">
          <table class="w-full text-xs text-left">
            <thead>
              <tr class="bg-surface border-b border-line text-muted font-semibold uppercase tracking-wider">
                <th class="px-5 py-3">Nome</th>
                <th class="px-5 py-3">E-mail</th>
                <th class="px-5 py-3">Perfil</th>
                <th class="px-5 py-3">Cursos</th>
                <th class="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr v-for="prof in professores" :key="prof.id" class="hover:bg-surface/50 transition-colors">
                <td class="px-5 py-3 font-semibold text-primary">{{ prof.nome }}</td>
                <td class="px-5 py-3 text-secondary">{{ prof.email }}</td>
                <td class="px-5 py-3">
                  <BaseBadge :variant="prof.role === 'admin' ? 'accent' : 'secondary'">
                    {{ prof.role }}
                  </BaseBadge>
                </td>
                <td class="px-5 py-3">
                  <BaseBadge v-if="prof.role === 'admin'" variant="accent" :dot="true">
                    Acesso Total
                  </BaseBadge>
                  <BaseBadge v-else variant="neutral">
                    {{ prof.total_cursos ?? 0 }} {{ prof.total_cursos === 1 ? 'curso' : 'cursos' }}
                  </BaseBadge>
                </td>
                <td class="px-5 py-3 text-right">
                  <div class="flex justify-end gap-1">
                    <button
                      @click="openEditProfessor(prof)"
                      class="p-1.5 rounded text-muted hover:text-primary hover:bg-surface transition-colors"
                      title="Editar professor"
                    >
                      <span class="material-icons text-[16px]">edit</span>
                    </button>
                    <button
                      @click="onDeleteProfessorClick(prof)"
                      class="p-1.5 rounded text-muted hover:text-danger hover:bg-surface transition-colors"
                      title="Excluir professor"
                    >
                      <span class="material-icons text-[16px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Cursos Tab -->
      <div v-else class="space-y-4">
        <div class="flex justify-between items-center">
          <div>
            <h2 class="text-xl font-bold text-primary tracking-tight">Cursos Disponíveis</h2>
            <p class="text-xs text-muted mt-0.5">Gerencie os cursos e atribua professores responsáveis</p>
          </div>
          <BaseButton variant="primary" size="sm" @click="openCreateCurso">
            <span class="material-icons text-[16px]">add</span>
            <span>Novo Curso</span>
          </BaseButton>
        </div>

        <!-- Skeleton dos cards de cursos durante o carregamento -->
        <div v-if="loadingCursos" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-label="Carregando cursos">
          <div
            v-for="n in 6"
            :key="n"
            class="bg-surface-alt rounded-md border border-line p-5 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div class="flex justify-between items-start mb-3">
                <BaseSkeleton width="w-10" height="h-10" rounded="rounded-md" />
                <div class="flex gap-1">
                  <BaseSkeleton width="w-6" height="h-6" rounded="rounded-md" />
                  <BaseSkeleton width="w-6" height="h-6" rounded="rounded-md" />
                </div>
              </div>
              <div class="space-y-2">
                <BaseSkeleton height="h-4" width="w-3/4" />
                <BaseSkeleton height="h-3" width="w-full" />
                <BaseSkeleton height="h-3" width="w-2/3" />
              </div>
            </div>
            <div class="flex items-center gap-3 pt-3 mt-4 border-t border-line">
              <BaseSkeleton height="h-3" width="w-20" />
              <BaseSkeleton height="h-3" width="w-20" />
            </div>
          </div>
        </div>

        <EmptyState
          v-else-if="cursos.length === 0"
          icon="school"
          title="Nenhum curso cadastrado"
          message="Clique no botão acima para criar o primeiro curso."
        />

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <CursoCard
            v-for="curso in cursos"
            :key="curso.id"
            :curso="curso"
            action-text=""
          >
            <template #header-actions>
              <div class="flex gap-1" @click.stop>
                <button
                  @click="openEditCurso(curso)"
                  class="p-1.5 rounded text-muted hover:text-primary hover:bg-surface transition-colors"
                  title="Editar curso"
                >
                  <span class="material-icons text-[16px]">edit</span>
                </button>
                <button
                  @click="onDeleteCursoClick(curso)"
                  class="p-1.5 rounded text-muted hover:text-danger hover:bg-surface transition-colors"
                  title="Excluir curso"
                >
                  <span class="material-icons text-[16px]">delete</span>
                </button>
              </div>
            </template>
          </CursoCard>
        </div>
      </div>
    </main>

    <!-- Modals -->
    <ProfessorFormModal :show="showProfessorModal" :professor="editingProfessor" @close="showProfessorModal = false" @submit="handleSaveProfessor" />
    <CursoFormModal :show="showCursoModal" :curso="editingCurso" :professores="professores" @close="showCursoModal = false" @submit="handleSaveCurso" />

    <ConfirmDialog
      v-model="showConfirmProf"
      title="Excluir Professor"
      :message="`Tem certeza que deseja excluir &quot;${deleteTargetProf?.nome}&quot;? As disciplinas associadas também serão removidas.`"
      :danger="true"
      confirm-text="Excluir"
      cancel-text="Cancelar"
      @confirm="onConfirmProf"
      @cancel="onCancelProf"
    />

    <ConfirmDialog
      v-model="showConfirmCurso"
      title="Excluir Curso"
      :message="`Tem certeza que deseja excluir o curso &quot;${deleteTargetCurso?.nome}&quot;? As disciplinas dele também serão removidas.`"
      :danger="true"
      confirm-text="Excluir"
      cancel-text="Cancelar"
      @confirm="onConfirmCurso"
      @cancel="onCancelCurso"
    />
  </div>
</template>
