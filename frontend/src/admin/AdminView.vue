<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/shared/stores/auth';
import { apiClient } from '@/shared/api/client';
import ProfessorFormModal from '@/admin/components/ProfessorFormModal.vue';
import CursoFormModal from '@/admin/components/CursoFormModal.vue';
import ThemeToggle from '../shared/components/ThemeToggle.vue';
import ConfirmDialog from '../shared/components/ConfirmDialog.vue';
import EmptyState from '../shared/components/EmptyState.vue';
import type { Professor, Curso } from '@/shared/types';

const router = useRouter();
const authStore = useAuthStore();

const activeTab = ref<'professores' | 'cursos'>('professores');

const professores = ref<Professor[]>([]);
const cursos = ref<Curso[]>([]);
const loading = ref(false);
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
  loading.value = true;
  error.value = '';
  const res = await apiClient.get<Professor[]>('/professores');
  loading.value = false;
  if (res.success && res.data) {
    professores.value = res.data;
  } else {
    error.value = res.error || 'Falha ao carregar professores.';
  }
}

async function fetchCursos() {
  loading.value = true;
  error.value = '';
  const res = await apiClient.get<Curso[]>('/cursos');
  loading.value = false;
  if (res.success && res.data) {
    cursos.value = res.data;
  } else {
    error.value = res.error || 'Falha ao carregar cursos.';
  }
}

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
  if (editingProfessor.value) {
    const res = await apiClient.put(`/professores/${editingProfessor.value.id}`, payload);
    if (!res.success) {
      error.value = res.error || 'Falha ao atualizar professor.';
      return;
    }
  } else {
    const res = await apiClient.post<Professor>('/professores', payload);
    if (!res.success || !res.data) {
      error.value = res.error || 'Falha ao criar professor.';
      return;
    }
    profId = res.data.id;
  }
  if (profId && payload.role !== 'admin' && Array.isArray(payload.curso_ids)) {
    const resCursos = await apiClient.put(`/professores/${profId}/cursos`, { curso_ids: payload.curso_ids });
    if (!resCursos.success) {
      error.value = resCursos.error || 'Falha ao vincular cursos ao professor.';
      return;
    }
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
  const res = await apiClient.delete(`/professores/${prof.id}`);
  if (!res.success) {
    error.value = res.error || 'Falha ao excluir professor.';
    return;
  }
  await fetchProfessores();
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
  if (editingCurso.value) {
    const res = await apiClient.put(`/cursos/${editingCurso.value.id}`, payload);
    if (!res.success) {
      error.value = res.error || 'Falha ao atualizar curso.';
      return;
    }
  } else {
    const res = await apiClient.post<Curso>('/cursos', payload);
    if (!res.success || !res.data) {
      error.value = res.error || 'Falha ao criar curso.';
      return;
    }
    cursoId = res.data.id;
  }

  if (cursoId && Array.isArray(payload.professor_ids)) {
    const resProfs = await apiClient.put(`/cursos/${cursoId}/professores`, { professor_ids: payload.professor_ids });
    if (!resProfs.success) {
      error.value = resProfs.error || 'Falha ao vincular professores ao curso.';
      return;
    }
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
  const res = await apiClient.delete(`/cursos/${curso.id}`);
  if (!res.success) {
    error.value = res.error || 'Falha ao excluir curso.';
    return;
  }
  await fetchCursos();
}

function onCancelCurso() {}

function logout() {
  authStore.logout();
  router.push('/login');
}
</script>

<template>
  <div class="min-h-screen bg-surface text-primary">
    <header class="bg-surface-alt border-b border-line py-4 px-8">
      <div class="max-w-6xl mx-auto flex justify-between items-center">
        <div class="flex items-center space-x-3">
          <span class="material-icons text-accent text-3xl">shield</span>
          <div>
            <h1 class="text-xl font-bold">Painel do Administrador</h1>
            <p class="text-secondary text-xs">{{ authStore.professor?.email || 'Administrador' }}</p>
          </div>
        </div>

        <div class="flex items-center space-x-4">
          <router-link to="/" class="text-secondary hover:text-primary text-sm font-medium">Ver Área do Aluno</router-link>
          <button @click="logout" class="px-4 py-2 bg-surface hover:bg-surface-alt rounded-xl text-sm font-semibold transition text-primary">Sair</button>
          <ThemeToggle />
        </div>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-8 py-8">
      <div v-if="error" class="mb-6 p-3 bg-surface-alt border border-danger text-danger text-sm rounded-xl">
        {{ error }}
      </div>

      <!-- Tabs -->
      <div class="flex bg-surface-alt p-1 rounded-xl mb-6 w-fit border border-line">
        <button
          @click="activeTab = 'professores'"
          :class="['px-5 py-2 rounded-lg text-sm font-bold transition', activeTab === 'professores' ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary']"
        >
          Professores
        </button>
        <button
          @click="activeTab = 'cursos'"
          :class="['px-5 py-2 rounded-lg text-sm font-bold transition', activeTab === 'cursos' ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary']"
        >
          Cursos
        </button>
      </div>

      <!-- Professores Tab -->
      <div v-if="activeTab === 'professores'">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-primary">Professores</h2>
          <button @click="openCreateProfessor" class="px-5 py-2.5 bg-accent hover:opacity-90 text-white font-bold rounded-xl shadow-lg flex items-center space-x-2">
            <span class="material-icons text-sm">add</span>
            <span>Novo Professor</span>
          </button>
        </div>

        <div class="bg-surface-alt rounded-2xl border border-line overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-surface text-left text-secondary">
                <th class="px-6 py-3 font-semibold">Nome</th>
                <th class="px-6 py-3 font-semibold">E-mail</th>
                <th class="px-6 py-3 font-semibold">Perfil</th>
                <th class="px-6 py-3 font-semibold">Cursos</th>
                <th class="px-6 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="5" class="px-6 py-8 text-center text-secondary">Carregando...</td>
              </tr>
              <tr v-else-if="professores.length === 0">
                <td colspan="5" class="px-6 py-8 text-center text-secondary">Nenhum professor cadastrado.</td>
              </tr>
              <tr v-for="prof in professores" :key="prof.id" class="border-t border-line hover:bg-surface">
                <td class="px-6 py-3 text-primary font-medium">{{ prof.nome }}</td>
                <td class="px-6 py-3 text-secondary">{{ prof.email }}</td>
                <td class="px-6 py-3">
                  <span :class="prof.role === 'admin' ? 'bg-accent text-white' : 'bg-surface text-secondary'" class="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase">
                    {{ prof.role }}
                  </span>
                </td>
                <td class="px-6 py-3">
                  <span v-if="prof.role === 'admin'" class="px-2.5 py-0.5 bg-surface-alt border border-line text-secondary text-xs font-bold rounded-md uppercase">
                    Acesso Total
                  </span>
                  <span v-else class="px-2.5 py-0.5 bg-surface border border-line text-accent text-xs font-bold rounded-md uppercase">
                    {{ prof.total_cursos ?? 0 }} {{ prof.total_cursos === 1 ? 'curso' : 'cursos' }}
                  </span>
                </td>
                <td class="px-6 py-3">
                  <div class="flex justify-end space-x-1">
                    <button @click="openEditProfessor(prof)" class="p-2 text-secondary hover:text-primary hover:bg-surface rounded-lg">
                      <span class="material-icons text-sm">edit</span>
                    </button>
                    <button @click="onDeleteProfessorClick(prof)" class="p-2 text-danger hover:text-danger hover:bg-surface rounded-lg">
                      <span class="material-icons text-sm">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Cursos Tab -->
      <div v-else>
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-primary">Cursos</h2>
          <button @click="openCreateCurso" class="px-5 py-2.5 bg-accent hover:opacity-90 text-white font-bold rounded-xl shadow-lg flex items-center space-x-2">
            <span class="material-icons text-sm">add</span>
            <span>Novo Curso</span>
          </button>
        </div>

        <div v-if="loading" class="text-center py-12 text-secondary">Carregando...</div>
        <EmptyState v-else-if="cursos.length === 0" message="Nenhum curso cadastrado." />

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="curso in cursos"
            :key="curso.id"
            class="bg-surface-alt rounded-2xl p-6 border border-line hover:border-accent transition shadow-lg flex flex-col justify-between"
          >
            <div>
              <div class="flex justify-between items-start mb-4">
                <div :class="[curso.cor || 'bg-accent', 'p-3 rounded-full w-12 h-12 flex items-center justify-center text-white font-bold']">
                  <span class="material-icons">{{ curso.icone || 'school' }}</span>
                </div>
                <div class="flex space-x-1">
                  <button @click="openEditCurso(curso)" class="p-2 text-secondary hover:text-primary hover:bg-surface rounded-lg">
                    <span class="material-icons text-sm">edit</span>
                  </button>
                  <button @click="onDeleteCursoClick(curso)" class="p-2 text-danger hover:text-danger hover:bg-surface rounded-lg">
                    <span class="material-icons text-sm">delete</span>
                  </button>
                </div>
              </div>

              <h3 class="text-lg font-bold text-primary">{{ curso.nome }}</h3>
              <p class="text-secondary text-sm mt-1 line-clamp-2">{{ curso.descricao || 'Sem descrição.' }}</p>
              <div class="flex items-center space-x-4 mt-3 text-xs text-secondary">
                <span>{{ curso.total_disciplinas ?? 0 }} disciplinas</span>
                <span>{{ curso.total_professores ?? 0 }} professores</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

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
