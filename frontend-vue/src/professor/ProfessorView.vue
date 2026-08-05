<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/shared/stores/auth';
import { useCursoStore } from '@/shared/stores/curso';
import { apiClient } from '@/shared/api/client';
import MateriaFormModal from '@/professor/components/MateriaFormModal.vue';
import MarpEditorModal from '@/professor/components/MarpEditorModal.vue';
import JsonActivityEditorModal from '@/professor/components/JsonActivityEditorModal.vue';
import type { Curso, Materia, Aula, Atividade } from '@/shared/types';

const router = useRouter();
const authStore = useAuthStore();
const cursoStore = useCursoStore();

const activeView = ref<'cursos' | 'materias' | 'detalhes'>('cursos');
const selectedCurso = ref<Curso | null>(null);
const selectedMateria = ref<Materia | null>(null);

const showMateriaModal = ref(false);
const editingMateria = ref<Materia | null>(null);

const showMarpModal = ref(false);
const editingAula = ref<Aula | null>(null);

const showActivityEditorModal = ref(false);
const editingActivity = ref<Atividade | null>(null);

onMounted(async () => {
  await cursoStore.fetchCursos();
});

function logout() {
  authStore.logout();
  router.push('/login');
}

function handleOpenCurso(curso: Curso) {
  selectedCurso.value = curso;
  showMaterias();
}

async function showMaterias() {
  if (!selectedCurso.value) return;
  await cursoStore.fetchMaterias(selectedCurso.value.id);
  activeView.value = 'materias';
}

function handleOpenMateriaModal(materia?: Materia) {
  editingMateria.value = materia || null;
  showMateriaModal.value = true;
}

async function handleSaveMateria(data: Partial<Materia>) {
  if (!selectedCurso.value) return;
  const payload = { ...data, curso_id: selectedCurso.value.id };
  if (editingMateria.value) {
    await apiClient.put(`/materias/${editingMateria.value.id}`, payload);
  } else {
    await apiClient.post('/materias', payload);
  }
  showMateriaModal.value = false;
  await showMaterias();
}

async function handleDeleteMateria(materiaId: number) {
  if (confirm('Tem certeza que deseja excluir esta materia?')) {
    await apiClient.delete(`/materias/${materiaId}`);
    await showMaterias();
  }
}

async function handleOpenMateriaDetails(materia: Materia) {
  selectedMateria.value = materia;
  await cursoStore.loadMateriaContent(materia.id);
  activeView.value = 'detalhes';
}

function goBack() {
  if (activeView.value === 'detalhes') {
    activeView.value = 'materias';
    selectedMateria.value = null;
  } else if (activeView.value === 'materias') {
    activeView.value = 'cursos';
    selectedCurso.value = null;
  }
}

function handleOpenMarpModal(aula?: Aula) {
  editingAula.value = aula || null;
  showMarpModal.value = true;
}

async function handleSaveMarpAula(payload: { titulo: string; descricao: string; markdown: string }) {
  if (!selectedMateria.value) return;

  const data = {
    materia_id: selectedMateria.value.id,
    titulo: payload.titulo,
    descricao: payload.descricao,
    markdown: payload.markdown,
    marp_markdown: payload.markdown,
    slug: payload.titulo.toLowerCase().replace(/\s+/g, '_'),
    ordem: cursoStore.aulas.length + 1
  };

  if (editingAula.value) {
    await apiClient.put(`/aulas/${editingAula.value.id}`, data);
  } else {
    await apiClient.post('/aulas', data);
  }

  showMarpModal.value = false;
  await cursoStore.loadMateriaContent(selectedMateria.value.id);
}

function handleOpenActivityEditor(atividade?: Atividade) {
  editingActivity.value = atividade || null;
  showActivityEditorModal.value = true;
}

async function handleSaveActivity(payload: Partial<Atividade>) {
  if (!selectedMateria.value) return;

  const data = {
    ...payload,
    materia_id: selectedMateria.value.id,
    ordem: cursoStore.atividades.length + 1
  };

  if (editingActivity.value) {
    await apiClient.put(`/atividades/${editingActivity.value.id}`, data);
  } else {
    await apiClient.post('/atividades', data);
  }

  showActivityEditorModal.value = false;
  await cursoStore.loadMateriaContent(selectedMateria.value.id);
}

async function handleDeleteAula(aulaId: number) {
  if (confirm('Tem certeza que deseja excluir esta aula?')) {
    await apiClient.delete(`/aulas/${aulaId}`);
    if (selectedMateria.value) {
      await cursoStore.loadMateriaContent(selectedMateria.value.id);
    }
  }
}

async function handleDeleteAtividade(atividadeId: number) {
  if (confirm('Tem certeza que deseja excluir esta atividade?')) {
    await apiClient.delete(`/atividades/${atividadeId}`);
    if (selectedMateria.value) {
      await cursoStore.loadMateriaContent(selectedMateria.value.id);
    }
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-slate-100">
    <!-- Dashboard View -->
    <div class="min-h-screen">
      <!-- Header -->
      <header class="bg-slate-800 border-b border-slate-700 py-4 px-8">
        <div class="max-w-6xl mx-auto flex justify-between items-center">
          <div class="flex items-center space-x-3">
            <span class="material-icons text-indigo-400 text-3xl">dashboard</span>
            <div>
              <h1 class="text-xl font-bold">Painel de Gestão</h1>
              <p class="text-slate-400 text-xs">Professor: {{ authStore.professor?.email || 'Autenticado' }}</p>
            </div>
          </div>

          <div class="flex items-center space-x-4">
            <router-link to="/" class="text-slate-300 hover:text-white text-sm font-medium">Ver Área do Aluno</router-link>
            <button @click="logout" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition">Sair</button>
          </div>
        </div>
      </header>

      <!-- Main Body -->
      <main class="max-w-6xl mx-auto px-8 py-8">
        <!-- Cursos List View -->
        <div v-if="activeView === 'cursos'" class="space-y-6">
          <div class="flex justify-between items-center">
            <h2 class="text-2xl font-bold text-white">Meus Cursos</h2>
          </div>

          <div v-if="cursoStore.cursos.length === 0" class="text-center py-12 bg-slate-800 rounded-2xl border border-slate-700">
            <p class="text-slate-400">Você ainda não foi atribuído a nenhum curso.</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div
              v-for="curso in cursoStore.cursos"
              :key="curso.id"
              class="bg-slate-800 rounded-2xl p-6 border border-slate-700 hover:border-slate-600 transition shadow-lg flex flex-col justify-between"
            >
              <div>
                <div class="flex justify-between items-start mb-4">
                  <div :class="[curso.cor || 'bg-indigo-600', 'p-3 rounded-full w-12 h-12 flex items-center justify-center text-white font-bold']">
                    <span class="material-icons">{{ curso.icone || 'school' }}</span>
                  </div>
                  <div class="flex space-x-1">
                    <span class="px-2.5 py-0.5 bg-slate-700 text-indigo-300 text-xs font-bold rounded-md uppercase">{{ curso.total_materias ?? 0 }} matérias</span>
                  </div>
                </div>

                <h3 class="text-lg font-bold text-white">{{ curso.nome }}</h3>
                <p class="text-slate-400 text-sm mt-1 line-clamp-2">{{ curso.descricao || 'Sem descrição.' }}</p>
              </div>

              <button @click="handleOpenCurso(curso)" class="mt-6 w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold rounded-xl transition">
                Gerenciar Materias
              </button>
            </div>
          </div>
        </div>

        <!-- Materias List View -->
        <div v-else-if="activeView === 'materias'" class="space-y-6">
          <div class="flex items-center space-x-4 border-b border-slate-800 pb-4">
            <button @click="goBack" class="p-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-xl text-white">
              <span class="material-icons">arrow_back</span>
            </button>
            <div class="flex-1 flex justify-between items-center">
              <div>
                <h2 class="text-2xl font-bold text-white">{{ selectedCurso?.nome }}</h2>
                <p class="text-slate-400 text-xs mt-0.5">{{ selectedCurso?.descricao }}</p>
              </div>
              <button @click="handleOpenMateriaModal()" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg flex items-center space-x-2">
                <span class="material-icons text-sm">add</span>
                <span>Nova Materia</span>
              </button>
            </div>
          </div>

          <div v-if="cursoStore.materias.length === 0" class="text-center py-12 bg-slate-800 rounded-2xl border border-slate-700">
            <p class="text-slate-400">Nenhuma materia cadastrada neste curso.</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div
              v-for="materia in cursoStore.materias"
              :key="materia.id"
              class="bg-slate-800 rounded-2xl p-6 border border-slate-700 hover:border-slate-600 transition shadow-lg flex flex-col justify-between"
            >
              <div>
                <div class="flex justify-between items-start mb-4">
                  <div :class="[materia.cor || 'bg-indigo-600', 'p-3 rounded-full w-12 h-12 flex items-center justify-center text-white font-bold']">
                    <span class="material-icons">{{ materia.icone || 'school' }}</span>
                  </div>
                  <div class="flex space-x-1">
                    <button @click="handleOpenMateriaModal(materia)" class="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
                      <span class="material-icons text-sm">edit</span>
                    </button>
                    <button @click="handleDeleteMateria(materia.id)" class="p-2 text-rose-400 hover:text-rose-300 hover:bg-slate-700 rounded-lg">
                      <span class="material-icons text-sm">delete</span>
                    </button>
                  </div>
                </div>

                <h3 class="text-lg font-bold text-white">{{ materia.nome }}</h3>
                <p class="text-slate-400 text-sm mt-1 line-clamp-2">{{ materia.descricao || 'Sem descrição.' }}</p>
              </div>

              <button @click="handleOpenMateriaDetails(materia)" class="mt-6 w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold rounded-xl transition">
                Gerenciar Aulas & Atividades
              </button>
            </div>
          </div>
        </div>

        <!-- Materia Details View -->
        <div v-else class="space-y-6">
          <div class="flex items-center space-x-4 border-b border-slate-800 pb-4">
            <button @click="goBack" class="p-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-xl text-white">
              <span class="material-icons">arrow_back</span>
            </button>
            <div>
              <h2 class="text-2xl font-bold text-white">{{ selectedMateria?.nome }}</h2>
              <p class="text-slate-400 text-xs mt-0.5">{{ selectedMateria?.descricao }}</p>
            </div>
          </div>

          <div class="flex justify-between items-center">
            <h3 class="text-xl font-bold text-slate-200">Aulas Cadastradas ({{ cursoStore.aulas.length }})</h3>
            <button @click="handleOpenMarpModal()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md flex items-center space-x-2">
              <span class="material-icons text-sm">add</span>
              <span>Criar Aula (Marp)</span>
            </button>
          </div>

          <div class="space-y-3">
            <div v-for="aula in cursoStore.aulas" :key="aula.id" class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
              <div>
                <p class="font-bold text-white">{{ aula.titulo }}</p>
                <p class="text-xs text-slate-400">{{ aula.descricao }}</p>
              </div>
              <div class="flex space-x-1">
                <button @click="handleOpenMarpModal(aula)" class="p-2 text-indigo-400 hover:bg-slate-700 rounded-lg" title="Editar Aula">
                  <span class="material-icons text-sm">edit</span>
                </button>
                <button @click="handleDeleteAula(aula.id)" class="p-2 text-rose-400 hover:bg-slate-700 rounded-lg" title="Excluir Aula">
                  <span class="material-icons text-sm">delete</span>
                </button>
              </div>
            </div>
          </div>

          <div class="flex justify-between items-center pt-6 border-t border-slate-800">
            <h3 class="text-xl font-bold text-slate-200">Atividades Cadastradas ({{ cursoStore.atividades.length }})</h3>
            <button @click="handleOpenActivityEditor()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md flex items-center space-x-2">
              <span class="material-icons text-sm">add</span>
              <span>Criar Atividade</span>
            </button>
          </div>

          <div class="space-y-3">
            <div v-for="atv in cursoStore.atividades" :key="atv.id" class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
              <div>
                <div class="flex items-center space-x-2">
                  <span class="px-2.5 py-0.5 bg-slate-700 text-indigo-300 text-xs font-bold rounded-md uppercase">{{ atv.tipo }}</span>
                  <p class="font-bold text-white">{{ atv.titulo }}</p>
                </div>
                <p class="text-xs text-slate-400 mt-1">{{ atv.descricao }}</p>
              </div>
              <div class="flex space-x-1">
                <button @click="handleOpenActivityEditor(atv)" class="p-2 text-indigo-400 hover:bg-slate-700 rounded-lg" title="Editar Atividade">
                  <span class="material-icons text-sm">edit</span>
                </button>
                <button @click="handleDeleteAtividade(atv.id)" class="p-2 text-rose-400 hover:bg-slate-700 rounded-lg" title="Excluir Atividade">
                  <span class="material-icons text-sm">delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- Modals -->
      <MateriaFormModal :show="showMateriaModal" :materia="editingMateria" @close="showMateriaModal = false" @submit="handleSaveMateria" />
      <MarpEditorModal :show="showMarpModal" :titulo="editingAula?.titulo" :descricao="editingAula?.descricao" :markdown="editingAula?.marp_markdown" @close="showMarpModal = false" @save="handleSaveMarpAula" />
      <JsonActivityEditorModal :show="showActivityEditorModal" :atividade="editingActivity" @close="showActivityEditorModal = false" @save="handleSaveActivity" />
    </div>
  </div>
</template>
