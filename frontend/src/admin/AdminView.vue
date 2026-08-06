<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/shared/stores/auth';
import { apiClient } from '@/shared/api/client';
import ProfessorFormModal from '@/admin/components/ProfessorFormModal.vue';
import CursoFormModal from '@/admin/components/CursoFormModal.vue';
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

async function handleSaveProfessor(payload: { nome: string; email: string; password: string; role: string }) {
  if (editingProfessor.value) {
    const res = await apiClient.put(`/professores/${editingProfessor.value.id}`, payload);
    if (!res.success) {
      error.value = res.error || 'Falha ao atualizar professor.';
      return;
    }
  } else {
    const res = await apiClient.post('/professores', payload);
    if (!res.success) {
      error.value = res.error || 'Falha ao criar professor.';
      return;
    }
  }
  showProfessorModal.value = false;
  await fetchProfessores();
}

async function handleDeleteProfessor(prof: Professor) {
  if (!confirm(`Tem certeza que deseja excluir "${prof.nome}"? As materias associadas também serão removidas.`)) return;
  const res = await apiClient.delete(`/professores/${prof.id}`);
  if (!res.success) {
    error.value = res.error || 'Falha ao excluir professor.';
    return;
  }
  await fetchProfessores();
}

function openCreateCurso() {
  editingCurso.value = null;
  showCursoModal.value = true;
}

function openEditCurso(curso: Curso) {
  editingCurso.value = curso;
  showCursoModal.value = true;
}

async function handleSaveCurso(payload: { nome: string; descricao: string; cor: string; icone: string; professor_ids: number[] }) {
  if (editingCurso.value) {
    const res = await apiClient.put(`/cursos/${editingCurso.value.id}`, payload);
    if (!res.success) {
      error.value = res.error || 'Falha ao atualizar curso.';
      return;
    }
    await apiClient.put(`/cursos/${editingCurso.value.id}/professores`, { professor_ids: payload.professor_ids });
  } else {
    const res = await apiClient.post('/cursos', payload);
    if (!res.success) {
      error.value = res.error || 'Falha ao criar curso.';
      return;
    }
    await apiClient.put(`/cursos/${res.data.id}/professores`, { professor_ids: payload.professor_ids });
  }
  showCursoModal.value = false;
  await fetchCursos();
}

async function handleDeleteCurso(curso: Curso) {
  if (!confirm(`Tem certeza que deseja excluir o curso "${curso.nome}"? As materias dele também serão removidas.`)) return;
  const res = await apiClient.delete(`/cursos/${curso.id}`);
  if (!res.success) {
    error.value = res.error || 'Falha ao excluir curso.';
    return;
  }
  await fetchCursos();
}

function logout() {
  authStore.logout();
  router.push('/login');
}
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-slate-100">
    <header class="bg-slate-800 border-b border-slate-700 py-4 px-8">
      <div class="max-w-6xl mx-auto flex justify-between items-center">
        <div class="flex items-center space-x-3">
          <span class="material-icons text-indigo-400 text-3xl">shield</span>
          <div>
            <h1 class="text-xl font-bold">Painel do Administrador</h1>
            <p class="text-slate-400 text-xs">{{ authStore.professor?.email || 'Administrador' }}</p>
          </div>
        </div>

        <div class="flex items-center space-x-4">
          <router-link to="/" class="text-slate-300 hover:text-white text-sm font-medium">Ver Área do Aluno</router-link>
          <button @click="logout" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition">Sair</button>
        </div>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-8 py-8">
      <div v-if="error" class="mb-6 p-3 bg-rose-900/50 border border-rose-700 text-rose-200 text-sm rounded-xl">
        {{ error }}
      </div>

      <!-- Tabs -->
      <div class="flex bg-slate-800 p-1 rounded-xl mb-6 w-fit border border-slate-700">
        <button
          @click="activeTab = 'professores'"
          :class="['px-5 py-2 rounded-lg text-sm font-bold transition', activeTab === 'professores' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white']"
        >
          Professores
        </button>
        <button
          @click="activeTab = 'cursos'"
          :class="['px-5 py-2 rounded-lg text-sm font-bold transition', activeTab === 'cursos' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white']"
        >
          Cursos
        </button>
      </div>

      <!-- Professores Tab -->
      <div v-if="activeTab === 'professores'">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-white">Professores</h2>
          <button @click="openCreateProfessor" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg flex items-center space-x-2">
            <span class="material-icons text-sm">add</span>
            <span>Novo Professor</span>
          </button>
        </div>

        <div class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-slate-700/50 text-left text-slate-300">
                <th class="px-6 py-3 font-semibold">Nome</th>
                <th class="px-6 py-3 font-semibold">E-mail</th>
                <th class="px-6 py-3 font-semibold">Perfil</th>
                <th class="px-6 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="4" class="px-6 py-8 text-center text-slate-400">Carregando...</td>
              </tr>
              <tr v-else-if="professores.length === 0">
                <td colspan="4" class="px-6 py-8 text-center text-slate-400">Nenhum professor cadastrado.</td>
              </tr>
              <tr v-for="prof in professores" :key="prof.id" class="border-t border-slate-700 hover:bg-slate-700/40">
                <td class="px-6 py-3 text-white font-medium">{{ prof.nome }}</td>
                <td class="px-6 py-3 text-slate-300">{{ prof.email }}</td>
                <td class="px-6 py-3">
                  <span :class="prof.role === 'admin' ? 'bg-indigo-600/30 text-indigo-300' : 'bg-slate-700 text-slate-300'" class="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase">
                    {{ prof.role }}
                  </span>
                </td>
                <td class="px-6 py-3">
                  <div class="flex justify-end space-x-1">
                    <button @click="openEditProfessor(prof)" class="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
                      <span class="material-icons text-sm">edit</span>
                    </button>
                    <button @click="handleDeleteProfessor(prof)" class="p-2 text-rose-400 hover:text-rose-300 hover:bg-slate-700 rounded-lg">
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
          <h2 class="text-2xl font-bold text-white">Cursos</h2>
          <button @click="openCreateCurso" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg flex items-center space-x-2">
            <span class="material-icons text-sm">add</span>
            <span>Novo Curso</span>
          </button>
        </div>

        <div v-if="loading" class="text-center py-12 text-slate-400">Carregando...</div>
        <div v-else-if="cursos.length === 0" class="text-center py-12 bg-slate-800 rounded-2xl border border-slate-700 text-slate-400">
          Nenhum curso cadastrado.
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="curso in cursos"
            :key="curso.id"
            class="bg-slate-800 rounded-2xl p-6 border border-slate-700 hover:border-slate-600 transition shadow-lg flex flex-col justify-between"
          >
            <div>
              <div class="flex justify-between items-start mb-4">
                <div :class="[curso.cor || 'bg-indigo-600', 'p-3 rounded-full w-12 h-12 flex items-center justify-center text-white font-bold']">
                  <span class="material-icons">{{ curso.icone || 'school' }}</span>
                </div>
                <div class="flex space-x-1">
                  <button @click="openEditCurso(curso)" class="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
                    <span class="material-icons text-sm">edit</span>
                  </button>
                  <button @click="handleDeleteCurso(curso)" class="p-2 text-rose-400 hover:text-rose-300 hover:bg-slate-700 rounded-lg">
                    <span class="material-icons text-sm">delete</span>
                  </button>
                </div>
              </div>

              <h3 class="text-lg font-bold text-white">{{ curso.nome }}</h3>
              <p class="text-slate-400 text-sm mt-1 line-clamp-2">{{ curso.descricao || 'Sem descrição.' }}</p>
              <div class="flex items-center space-x-4 mt-3 text-xs text-slate-500">
                <span>{{ curso.total_materias ?? 0 }} matérias</span>
                <span>{{ curso.total_professores ?? 0 }} professores</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <ProfessorFormModal :show="showProfessorModal" :professor="editingProfessor" @close="showProfessorModal = false" @submit="handleSaveProfessor" />
    <CursoFormModal :show="showCursoModal" :curso="editingCurso" @close="showCursoModal = false" @submit="handleSaveCurso" />
  </div>
</template>
