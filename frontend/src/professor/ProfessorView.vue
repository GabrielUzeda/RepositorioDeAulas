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

async function handleSaveDisciplina(data: Partial<Disciplina>) {
  if (!selectedCurso.value) return;
  const payload = { ...data, curso_id: selectedCurso.value.id };
  if (editingDisciplina.value) {
    await apiClient.put(`/disciplinas/${editingDisciplina.value.id}`, payload);
  } else {
    await apiClient.post('/disciplinas', payload);
  }
  showDisciplinaModal.value = false;
  await showDisciplinas();
}

async function handleDeleteDisciplina(disciplinaId: number) {
  if (confirm('Tem certeza que deseja excluir esta disciplina?')) {
    await apiClient.delete(`/disciplinas/${disciplinaId}`);
    await showDisciplinas();
  }
}

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

async function handleSaveMarpAula(payload: { titulo: string; descricao: string; markdown: string }) {
  if (!selectedDisciplina.value) return;

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
}

async function handleDeleteAula(aulaId: number) {
  if (confirm('Tem certeza que deseja excluir esta aula?')) {
    await apiClient.delete(`/aulas/${aulaId}`);
    if (selectedDisciplina.value) await cursoStore.loadDisciplinaContent(selectedDisciplina.value.id);
  }
}

function handleOpenActivityEditor(atividade?: Atividade) {
  editingActivity.value = atividade || null;
  showActivityEditorModal.value = true;
}

async function handleSaveActivity(payload: any) {
  if (!selectedDisciplina.value) return;

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
}

async function handleDeleteActivity(atividadeId: number) {
  if (confirm('Tem certeza que deseja excluir esta atividade?')) {
    await apiClient.delete(`/atividades/${atividadeId}`);
    if (selectedDisciplina.value) await cursoStore.loadDisciplinaContent(selectedDisciplina.value.id);
  }
}

function handleOpenRespostas(atividade: Atividade) {
  selectedRespostasAtividade.value = atividade;
  showRespostasModal.value = true;
}
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
    <!-- Header -->
    <header class="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <span class="material-icons text-indigo-400 text-2xl">school</span>
        <h1 class="text-xl font-bold text-white tracking-tight">Painel do Professor</h1>
      </div>

      <div class="flex items-center space-x-4">
        <span class="text-xs text-slate-400">Olá, <strong class="text-slate-200">{{ authStore.professor?.nome }}</strong></span>
        <button @click="logout" class="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition">
          <span class="material-icons text-sm">logout</span>
        </button>
      </div>
    </header>

    <!-- Main Container -->
    <main class="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
      <!-- Cursos View -->
      <section v-if="activeView === 'cursos'" class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-bold text-white">Seus Cursos</h2>
            <p class="text-slate-400 text-xs mt-1">Selecione um curso para gerenciar suas disciplinas e conteúdos.</p>
          </div>
        </div>

        <div v-if="cursoStore.cursos.length === 0" class="p-12 text-center border border-slate-800 rounded-3xl bg-slate-950 text-slate-500">
          Você não possui acesso a nenhum curso no momento.
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="curso in cursoStore.cursos"
            :key="curso.id"
            @click="handleOpenCurso(curso)"
            class="p-6 bg-slate-800/60 border border-slate-700/60 rounded-3xl hover:border-indigo-500/50 hover:bg-slate-800 transition cursor-pointer flex flex-col justify-between space-y-4 group"
          >
            <div class="flex items-start justify-between">
              <div class="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <span class="material-icons text-2xl">{{ curso.icone || 'school' }}</span>
              </div>
              <span class="material-icons text-slate-500 group-hover:text-white transition">arrow_forward</span>
            </div>

            <div>
              <h3 class="text-lg font-bold text-white group-hover:text-indigo-400 transition">{{ curso.nome }}</h3>
              <p class="text-slate-400 text-xs line-clamp-2 mt-1">{{ curso.descricao }}</p>
            </div>

            <div class="pt-4 border-t border-slate-700/40 flex items-center justify-between text-xs text-slate-400">
              <span>{{ curso.total_disciplinas ?? 0 }} disciplinas</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Disciplinas View -->
      <section v-else-if="activeView === 'disciplinas'" class="space-y-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <button @click="goBack" class="p-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-xl text-slate-300 transition">
              <span class="material-icons text-sm">arrow_back</span>
            </button>
            <div>
              <h2 class="text-2xl font-bold text-white">{{ selectedCurso?.nome }}</h2>
              <p class="text-slate-400 text-xs mt-0.5">Gerencie as disciplinas associadas a este curso.</p>
            </div>
          </div>

          <button @click="handleOpenDisciplinaModal()" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 text-xs transition flex items-center space-x-2">
            <span class="material-icons text-sm">add</span>
            <span>Nova Disciplina</span>
          </button>
        </div>

        <div v-if="cursoStore.disciplinas.length === 0" class="p-12 text-center border border-slate-800 rounded-3xl bg-slate-950 text-slate-500">
          Nenhuma disciplina cadastrada neste curso.
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="disciplina in cursoStore.disciplinas"
            :key="disciplina.id"
            class="p-6 bg-slate-800/60 border border-slate-700/60 rounded-3xl flex flex-col justify-between space-y-4 hover:border-slate-600 transition"
          >
            <div class="flex items-start justify-between">
              <div class="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <span class="material-icons text-2xl">{{ disciplina.icone || 'school' }}</span>
              </div>
              <div class="flex items-center space-x-1">
                <button @click="handleOpenDisciplinaModal(disciplina)" class="p-2 text-slate-400 hover:text-white rounded-lg">
                  <span class="material-icons text-sm">edit</span>
                </button>
                <button @click="handleDeleteDisciplina(disciplina.id)" class="p-2 text-slate-400 hover:text-rose-400 rounded-lg">
                  <span class="material-icons text-sm">delete</span>
                </button>
              </div>
            </div>

            <div>
              <h3 class="text-lg font-bold text-white">{{ disciplina.nome }}</h3>
              <p class="text-slate-400 text-xs line-clamp-2 mt-1">{{ disciplina.descricao }}</p>
            </div>

            <button @click="handleOpenDisciplinaDetails(disciplina)" class="w-full py-2.5 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-xl font-bold text-xs transition">
              Gerenciar Aulas & Atividades
            </button>
          </div>
        </div>
      </section>

      <!-- Content View (Aulas e Atividades) -->
      <section v-else class="space-y-6">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
          <div class="flex items-center space-x-4">
            <button @click="goBack" class="p-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-xl text-slate-300 transition">
              <span class="material-icons text-sm">arrow_back</span>
            </button>
            <div>
              <h2 class="text-2xl font-bold text-white">{{ selectedDisciplina?.nome }}</h2>
              <p class="text-slate-400 text-xs mt-0.5">{{ selectedDisciplina?.descricao }}</p>
            </div>
          </div>

          <button
            @click="showFeedbackConsolidadoModal = true"
            class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 text-xs transition flex items-center space-x-2"
          >
            <span class="material-icons text-sm">mark_email_read</span>
            <span>Gerar Feedback da Disciplina</span>
          </button>
        </div>

        <!-- Aulas -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-bold text-white">Aulas (Marp Markdown)</h3>
            <button @click="handleOpenMarpModal()" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center space-x-1.5">
              <span class="material-icons text-sm">add</span>
              <span>Nova Aula</span>
            </button>
          </div>

          <div v-if="cursoStore.aulas.length === 0" class="p-6 text-center border border-slate-800 rounded-2xl text-slate-500 text-xs">
            Nenhuma aula cadastrada nesta disciplina.
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="aula in cursoStore.aulas" :key="aula.id" class="p-4 bg-slate-800/40 border border-slate-700/50 rounded-2xl flex items-center justify-between">
              <div class="flex items-center space-x-3 truncate">
                <span class="material-icons text-indigo-400 text-lg shrink-0">slideshow</span>
                <div class="truncate">
                  <p class="text-white text-xs font-bold truncate">{{ aula.titulo }}</p>
                  <p class="text-slate-400 text-[10px] truncate">{{ aula.descricao }}</p>
                </div>
              </div>
              <div class="flex items-center space-x-1 shrink-0 ml-2">
                <button @click="handleOpenMarpModal(aula)" class="p-1.5 text-slate-400 hover:text-white">
                  <span class="material-icons text-sm">edit</span>
                </button>
                <button @click="handleDeleteAula(aula.id)" class="p-1.5 text-slate-400 hover:text-rose-400">
                  <span class="material-icons text-sm">delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Atividades -->
        <div class="space-y-4 pt-4 border-t border-slate-800">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-bold text-white">Atividades & Avaliações</h3>
            <button @click="handleOpenActivityEditor()" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center space-x-1.5">
              <span class="material-icons text-sm">add</span>
              <span>Nova Atividade</span>
            </button>
          </div>

          <div v-if="cursoStore.atividades.length === 0" class="p-6 text-center border border-slate-800 rounded-2xl text-slate-500 text-xs">
            Nenhuma atividade cadastrada nesta disciplina.
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="atv in cursoStore.atividades" :key="atv.id" class="p-4 bg-slate-800/40 border border-slate-700/50 rounded-2xl flex flex-col justify-between space-y-3">
              <div class="flex items-start justify-between">
                <div class="flex items-center space-x-3 truncate">
                  <span class="material-icons text-indigo-400 text-lg shrink-0">assignment</span>
                  <div class="truncate">
                    <p class="text-white text-xs font-bold truncate">{{ atv.titulo }}</p>
                    <p class="text-slate-400 text-[10px] truncate">{{ atv.tipo || 'normal' }}</p>
                  </div>
                </div>
                <div class="flex items-center space-x-1 shrink-0 ml-2">
                  <button @click="handleOpenActivityEditor(atv)" class="p-1.5 text-slate-400 hover:text-white">
                    <span class="material-icons text-sm">edit</span>
                  </button>
                  <button @click="handleDeleteActivity(atv.id)" class="p-1.5 text-slate-400 hover:text-rose-400">
                    <span class="material-icons text-sm">delete</span>
                  </button>
                </div>
              </div>

              <button @click="handleOpenRespostas(atv)" class="w-full py-2 bg-slate-800 hover:bg-indigo-950/60 border border-slate-700 hover:border-indigo-500/50 text-indigo-300 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5">
                <span class="material-icons text-xs">analytics</span>
                <span>Ver Respostas dos Alunos</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- Modals -->
    <DisciplinaFormModal
      :show="showDisciplinaModal"
      :disciplina="editingDisciplina"
      @close="showDisciplinaModal = false"
      @submit="handleSaveDisciplina"
    />

    <!-- Marp Editor Modal -->
    <MarpEditorModal
      :show="showMarpModal"
      :titulo="editingAula?.titulo"
      :descricao="editingAula?.descricao"
      :markdown="editingAula?.conteudo_md"
      @close="showMarpModal = false"
      @save="handleSaveMarpAula"
    />

    <!-- JSON Activity Editor Modal -->
    <JsonActivityEditorModal
      :show="showJsonActivityModal"
      :atividade="editingActivity"
      @close="showJsonActivityModal = false"
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
  </div>
</template>
