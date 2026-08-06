<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCursoStore } from '@/shared/stores/curso';
import { apiClient } from '@/shared/api/client';
import CursoCard from '@/aluno/components/CursoCard.vue';
import MateriaCard from '@/aluno/components/MateriaCard.vue';
import AulaCard from '@/aluno/components/AulaCard.vue';
import AtividadeCard from '@/aluno/components/AtividadeCard.vue';
import PasswordModal from '@/aluno/components/PasswordModal.vue';
import ActivityModal from '@/aluno/components/ActivityModal.vue';
import ReforcoModal from '@/aluno/components/ReforcoModal.vue';
import RoletaModal from '@/aluno/components/RoletaModal.vue';
import MinigameModal from '@/aluno/components/MinigameModal.vue';
import type { Curso, Materia, Aula, Atividade, Question } from '@/shared/types';

const cursoStore = useCursoStore();

const activeView = ref<'cursos' | 'materias' | 'content'>('cursos');
const activeTab = ref<'aulas' | 'atividades'>('aulas');

const selectedCurso = ref<Curso | null>(null);
const selectedMateria = ref<Materia | null>(null);
const pendingActivity = ref<Atividade | null>(null);

const showPasswordModal = ref(false);
const showActivityModal = ref(false);
const showReforcoModal = ref(false);
const showRoletaModal = ref(false);
const showMinigameModal = ref(false);

const activeActivity = ref<Atividade | null>(null);
const parsedQuestions = ref<Question[]>([]);

onMounted(async () => {
  await cursoStore.fetchCursos();
});

async function handleSelectCurso(curso: Curso) {
  selectedCurso.value = curso;
  await cursoStore.fetchMaterias(curso.id);
  activeView.value = 'materias';
}

async function handleSelectMateria(materia: Materia) {
  selectedMateria.value = materia;
  const success = await cursoStore.loadMateriaContent(materia.id);
  if (success) {
    activeView.value = 'content';
  } else {
    showPasswordModal.value = true;
  }
}

async function handlePasswordSubmit(password: string) {
  if (pendingActivity.value) {
    const res = await apiClient.get<Atividade>(`/atividades/${pendingActivity.value.id}?senha=${encodeURIComponent(password)}`);
    if (res.success && res.data && res.data.json_data) {
      cursoStore.unlockActivity(pendingActivity.value.id);
      showPasswordModal.value = false;
      const unlockedAtv = res.data;
      pendingActivity.value = null;
      handleOpenAtividade(unlockedAtv);
    } else {
      alert('Senha da atividade incorreta!');
    }
  } else if (selectedMateria.value) {
    const success = await cursoStore.loadMateriaContent(selectedMateria.value.id, password);
    if (success) {
      showPasswordModal.value = false;
      activeView.value = 'content';
    } else {
      alert('Senha incorreta!');
    }
  }
}

function handleOpenAula(aula: Aula) {
  window.open(aula.caminho, '_blank');
}

function handleOpenAtividade(atividade: Atividade) {
  if (atividade.allow_password && !cursoStore.isUnlocked(atividade.id)) {
    pendingActivity.value = atividade;
    showPasswordModal.value = true;
    return;
  }

  activeActivity.value = atividade;

  // Extract questions if available
  if (atividade.json_data) {
    try {
      const parsed = typeof atividade.json_data === 'string'
        ? JSON.parse(atividade.json_data)
        : atividade.json_data;
      parsedQuestions.value = parsed.questions || [];
    } catch {
      parsedQuestions.value = [];
    }
  } else {
    parsedQuestions.value = [];
  }

  if (atividade.tipo === 'reforco') {
    showReforcoModal.value = true;
  } else if (atividade.tipo === 'roleta') {
    showRoletaModal.value = true;
  } else if (atividade.tipo === 'minigame') {
    showMinigameModal.value = true;
  } else {
    showActivityModal.value = true;
  }
}

function goBack() {
  if (activeView.value === 'content') {
    activeView.value = 'materias';
    selectedMateria.value = null;
  } else if (activeView.value === 'materias') {
    activeView.value = 'cursos';
    selectedCurso.value = null;
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Header -->
    <header class="bg-indigo-600 text-white shadow-lg py-6 px-4 sm:px-8">
      <div class="max-w-6xl mx-auto flex justify-between items-center">
        <div class="flex items-center space-x-3">
          <span class="material-icons text-3xl">school</span>
          <div>
            <h1 class="text-2xl font-bold tracking-tight">Área do Aluno</h1>
            <p class="text-indigo-200 text-xs mt-0.5">Repositório de Aulas e Atividades Interativas</p>
          </div>
        </div>
        <router-link to="/professor" class="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 rounded-xl text-sm font-semibold transition flex items-center space-x-2">
          <span class="material-icons text-sm">admin_panel_settings</span>
          <span>Área do Professor</span>
        </router-link>
      </div>
    </header>

    <!-- Main Container -->
    <main class="max-w-6xl mx-auto px-4 sm:px-8 py-8">
      <!-- Cursos View -->
      <section v-if="activeView === 'cursos'" class="space-y-6">
        <h2 class="text-2xl font-bold text-slate-800">Selecione seu Curso</h2>

        <div v-if="cursoStore.isLoading" class="text-center py-12 text-slate-500">
          <span class="material-icons animate-spin text-3xl">sync</span>
          <p class="mt-2 text-sm">Carregando cursos...</p>
        </div>

        <div v-else-if="cursoStore.cursos.length === 0" class="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <p class="text-slate-500">Nenhum curso disponível no momento.</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <CursoCard
            v-for="curso in cursoStore.cursos"
            :key="curso.id"
            :curso="curso"
            @select="handleSelectCurso"
          />
        </div>
      </section>

      <!-- Materias View -->
      <section v-else-if="activeView === 'materias'" class="space-y-6">
        <div class="flex items-center space-x-4 border-b pb-4">
          <button @click="goBack" class="p-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-700 transition flex items-center">
            <span class="material-icons">arrow_back</span>
          </button>
          <div>
            <h2 class="text-2xl font-bold text-slate-800">{{ selectedCurso?.nome }}</h2>
            <p class="text-slate-500 text-xs mt-0.5">{{ selectedCurso?.descricao }}</p>
          </div>
        </div>

        <div v-if="cursoStore.isLoading" class="text-center py-12 text-slate-500">
          <span class="material-icons animate-spin text-3xl">sync</span>
          <p class="mt-2 text-sm">Carregando matérias...</p>
        </div>

        <div v-else-if="cursoStore.materias.length === 0" class="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <p class="text-slate-500">Nenhuma materia disponível neste curso.</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <MateriaCard
            v-for="materia in cursoStore.materias"
            :key="materia.id"
            :materia="materia"
            @select="handleSelectMateria"
          />
        </div>
      </section>

      <!-- Content View (Aulas & Atividades) -->
      <section v-else class="space-y-6">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
          <div class="flex items-center space-x-4">
            <button @click="goBack" class="p-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-700 transition flex items-center">
              <span class="material-icons">arrow_back</span>
            </button>
            <div>
              <h2 class="text-2xl font-bold text-slate-800">{{ selectedMateria?.nome }}</h2>
              <p class="text-slate-500 text-xs mt-0.5">{{ selectedMateria?.descricao }}</p>
            </div>
          </div>

          <!-- Tabs -->
          <div class="flex bg-slate-200/60 p-1 rounded-xl">
            <button
              @click="activeTab = 'aulas'"
              :class="['px-5 py-2 rounded-lg text-sm font-bold transition', activeTab === 'aulas' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900']"
            >
              Aulas ({{ cursoStore.aulas.length }})
            </button>
            <button
              @click="activeTab = 'atividades'"
              :class="['px-5 py-2 rounded-lg text-sm font-bold transition', activeTab === 'atividades' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900']"
            >
              Atividades ({{ cursoStore.atividades.length }})
            </button>
          </div>
        </div>

        <!-- Aulas Tab -->
        <div v-if="activeTab === 'aulas'">
          <div v-if="cursoStore.aulas.length === 0" class="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-500">
            Nenhuma aula disponível nesta materia.
          </div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AulaCard
              v-for="aula in cursoStore.aulas"
              :key="aula.id"
              :aula="aula"
              @open="handleOpenAula"
            />
          </div>
        </div>

        <!-- Atividades Tab -->
        <div v-else>
          <div v-if="cursoStore.atividades.length === 0" class="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-500">
            Nenhuma atividade disponível nesta materia.
          </div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AtividadeCard
              v-for="atv in cursoStore.atividades"
              :key="atv.id"
              :atividade="atv"
              :is-locked="!!atv.allow_password && !cursoStore.isUnlocked(atv.id)"
              @click="handleOpenAtividade"
            />
          </div>
        </div>
      </section>
    </main>

    <!-- Modals -->
    <PasswordModal :show="showPasswordModal" @close="showPasswordModal = false" @submit="handlePasswordSubmit" />
    <ActivityModal :show="showActivityModal" :atividade="activeActivity" @close="showActivityModal = false" />
    <ReforcoModal :show="showReforcoModal" :questions="parsedQuestions" :title="activeActivity?.titulo || ''" :atividade="activeActivity" @close="showReforcoModal = false" />
    <RoletaModal :show="showRoletaModal" :questions="parsedQuestions" :title="activeActivity?.titulo || ''" :atividade="activeActivity" @close="showRoletaModal = false" />
    <MinigameModal :show="showMinigameModal" :atividade="activeActivity" @close="showMinigameModal = false" />
  </div>
</template>
