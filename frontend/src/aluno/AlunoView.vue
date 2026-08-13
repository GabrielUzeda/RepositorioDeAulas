<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCursoStore } from '@/shared/stores/curso';
import { apiClient } from '@/shared/api/client';
import { secureGet, secureSet } from '@/shared/utils/storage';
import CursoCard from '@/aluno/components/CursoCard.vue';
import DisciplinaCard from '@/aluno/components/DisciplinaCard.vue';
import AulaCard from '@/aluno/components/AulaCard.vue';
import AtividadeCard from '@/aluno/components/AtividadeCard.vue';
import PasswordModal from '@/aluno/components/PasswordModal.vue';
import ActivityModal from '@/aluno/components/ActivityModal.vue';
import ReforcoModal from '@/aluno/components/ReforcoModal.vue';
import RoletaModal from '@/aluno/components/RoletaModal.vue';
import MinigameModal from '@/aluno/components/MinigameModal.vue';
import ThemeToggle from '@/shared/components/ThemeToggle.vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import type { Curso, Disciplina, Aula, Atividade, Question } from '@/shared/types';
import { useToast } from '@/shared/composables/useToast';

const cursoStore = useCursoStore();
const { error } = useToast();

const activeView = ref<'cursos' | 'disciplinas' | 'content'>('cursos');
const activeTab = ref<'aulas' | 'atividades'>('aulas');

const selectedCurso = ref<Curso | null>(null);
const selectedDisciplina = ref<Disciplina | null>(null);
const pendingActivity = ref<Atividade | null>(null);
const pendingCurso = ref<Curso | null>(null);

const showPasswordModal = ref(false);
const showActivityModal = ref(false);
const showReforcoModal = ref(false);
const showRoletaModal = ref(false);
const showMinigameModal = ref(false);

const activeActivity = ref<Atividade | null>(null);
const parsedQuestions = ref<Question[]>([]);
const cursoSenha = ref('');
const atividadeSenha = ref('');

onMounted(async () => {
  await cursoStore.fetchCursos();
});

async function handleSelectCurso(curso: Curso) {
  selectedCurso.value = curso;
  if (curso.senha) {
    const savedToken = await secureGet(`curso_access_${curso.id}`);
    if (savedToken !== 'granted') {
      pendingCurso.value = curso;
      showPasswordModal.value = true;
      return;
    }
  }
  await cursoStore.fetchDisciplinas(curso.id);
  activeView.value = 'disciplinas';
}

async function handleSelectDisciplina(disciplina: Disciplina) {
  selectedDisciplina.value = disciplina;

  // Verificar se o curso exige senha e se já está concedido
  if (selectedCurso.value?.senha) {
    const savedToken = await secureGet(`curso_access_${selectedCurso.value.id}`);
    if (savedToken !== 'granted') {
      pendingCurso.value = selectedCurso.value;
      showPasswordModal.value = true;
      return;
    }
  }

  let cursoPwd = selectedCurso.value?.senha || '';
  if (!cursoPwd && selectedCurso.value?.id) {
    cursoPwd = (await secureGet(`curso_senha_${selectedCurso.value.id}`)) || '';
  }
  cursoSenha.value = cursoPwd;

  const success = await cursoStore.loadDisciplinaContent(disciplina.id, cursoPwd);
  if (success) {
    activeView.value = 'content';
  } else {
    pendingCurso.value = selectedCurso.value;
    showPasswordModal.value = true;
  }
}

async function handlePasswordSubmit(password: string) {
  if (pendingCurso.value) {
    const res = await apiClient.post(`/cursos/${pendingCurso.value.id}/verificar-senha`, { senha: password });
    if (res.success) {
      await secureSet(`curso_senha_${pendingCurso.value.id}`, password);
      await secureSet(`curso_access_${pendingCurso.value.id}`, 'granted');
      cursoSenha.value = password;
      showPasswordModal.value = false;
      const curso = pendingCurso.value;
      pendingCurso.value = null;

      // Se já estava selecionando uma disciplina específica
      if (selectedDisciplina.value && selectedDisciplina.value.curso_id === curso.id) {
        await handleSelectDisciplina(selectedDisciplina.value);
      } else {
        await handleSelectCurso(curso);
      }
    } else {
      error('Senha do curso incorreta!');
    }
  } else if (pendingActivity.value) {
    const res = await apiClient.get<Atividade>(`/atividades/${pendingActivity.value.id}?senha=${encodeURIComponent(password)}`);
    if (res.success && res.data && res.data.json_data) {
      cursoStore.unlockActivity(pendingActivity.value.id);
      atividadeSenha.value = password;
      showPasswordModal.value = false;
      const unlockedAtv = res.data;
      pendingActivity.value = null;
      handleOpenAtividade(unlockedAtv);
    } else {
      error('Senha da atividade incorreta!');
    }
  }
}

async function handleOpenAula(aula: Aula) {
  let url = aula.caminho;
  if (selectedCurso.value?.id) {
    let senha = selectedCurso.value.senha || (await secureGet(`curso_senha_${selectedCurso.value.id}`)) || undefined;
    if (senha) {
      const sep = url.includes('?') ? '&' : '?';
      url += `${sep}senha=${encodeURIComponent(senha)}`;
    }
  }
  window.open(url, '_blank');
}

function handleOpenAtividade(atividade: Atividade) {
  if (atividade.allow_password && !cursoStore.isUnlocked(atividade.id)) {
    pendingActivity.value = atividade;
    showPasswordModal.value = true;
    return;
  }

  activeActivity.value = atividade;

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
    activeView.value = 'disciplinas';
    selectedDisciplina.value = null;
  } else if (activeView.value === 'disciplinas') {
    activeView.value = 'cursos';
    selectedCurso.value = null;
  }
}
</script>

<template>
  <div class="min-h-screen bg-surface">
    <!-- Header -->
    <header class="bg-accent text-white shadow-lg py-6 px-4 sm:px-8">
      <div class="max-w-6xl mx-auto flex justify-between items-center">
        <div class="flex items-center space-x-3">
          <span class="material-icons text-3xl">school</span>
          <span>
            <h1 class="text-2xl font-bold tracking-tight">Área do Aluno</h1>
            <p class="text-secondary text-xs mt-0.5">Repositório de Aulas e Atividades Interativas</p>
          </span>
        </div>
        <div class="flex items-center space-x-2">
          <ThemeToggle />
          <router-link to="/login" class="px-4 py-2 bg-accent hover:opacity-90 rounded-xl text-white text-sm font-semibold transition flex items-center space-x-2">
          <span class="material-icons text-sm">admin_panel_settings</span>
          <span>Área Restrita</span>
        </router-link>
      </div>
      </div>
    </header>

    <!-- Main Container -->
    <main class="max-w-6xl mx-auto px-4 sm:px-8 py-8">
      <!-- Cursos View -->
      <section v-if="activeView === 'cursos'" class="space-y-6">
        <h2 class="text-2xl font-bold text-primary">Selecione seu Curso</h2>

        <div v-if="cursoStore.isLoading" class="text-center py-12 text-secondary">
          <span class="material-icons animate-spin text-3xl">sync</span>
          <p class="mt-2 text-sm">Carregando cursos...</p>
        </div>

        <EmptyState v-else-if="cursoStore.cursos.length === 0" message="Nenhum curso disponível no momento." />

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <CursoCard
            v-for="curso in cursoStore.cursos"
            :key="curso.id"
            :curso="curso"
            @select="handleSelectCurso"
          />
        </div>
      </section>

      <!-- Disciplinas View -->
      <section v-else-if="activeView === 'disciplinas'" class="space-y-6">
        <div class="flex items-center space-x-4 border-b pb-4">
          <button @click="goBack" class="p-2 bg-surface-alt border border-line hover:bg-surface rounded-xl text-secondary transition flex items-center">
            <span class="material-icons">arrow_back</span>
          </button>
          <div>
            <h2 class="text-2xl font-bold text-primary">{{ selectedCurso?.nome }}</h2>
            <p class="text-secondary text-xs mt-0.5">{{ selectedCurso?.descricao }}</p>
          </div>
        </div>

        <div v-if="cursoStore.isLoading" class="text-center py-12 text-secondary">
          <span class="material-icons animate-spin text-3xl">sync</span>
          <p class="mt-2 text-sm">Carregando disciplinas...</p>
        </div>

        <EmptyState v-else-if="cursoStore.disciplinas.length === 0" message="Nenhuma disciplina disponível neste curso." />

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <DisciplinaCard
            v-for="disciplina in cursoStore.disciplinas"
            :key="disciplina.id"
            :disciplina="disciplina"
            @select="handleSelectDisciplina"
          />
        </div>
      </section>

      <!-- Content View (Aulas & Atividades) -->
      <section v-else class="space-y-6">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
          <div class="flex items-center space-x-4">
          <button @click="goBack" class="p-2 bg-surface-alt border border-line hover:bg-surface rounded-xl text-secondary transition flex items-center">
              <span class="material-icons">arrow_back</span>
            </button>
            <div>
            <h2 class="text-2xl font-bold text-primary">{{ selectedDisciplina?.nome }}</h2>
            <p class="text-secondary text-xs mt-0.5">{{ selectedDisciplina?.descricao }}</p>
            </div>
          </div>

          <!-- Tabs -->
          <div class="flex bg-surface-alt p-1 rounded-xl">
            <button
              @click="activeTab = 'aulas'"
              :class="['px-5 py-2 rounded-lg text-sm font-bold transition', activeTab === 'aulas' ? 'bg-surface-alt text-accent shadow-sm' : 'text-secondary hover:text-primary']"
            >
              Aulas ({{ cursoStore.aulas.length }})
            </button>
            <button
              @click="activeTab = 'atividades'"
              :class="['px-5 py-2 rounded-lg text-sm font-bold transition', activeTab === 'atividades' ? 'bg-surface-alt text-accent shadow-sm' : 'text-secondary hover:text-primary']"
            >
              Atividades ({{ cursoStore.atividades.length }})
            </button>
          </div>
        </div>

        <!-- Aulas Tab -->
        <div v-if="activeTab === 'aulas'">
          <EmptyState v-if="cursoStore.aulas.length === 0" message="Nenhuma aula disponível nesta disciplina." />
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
          <EmptyState v-if="cursoStore.atividades.length === 0" message="Nenhuma atividade disponível nesta disciplina." />
          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AtividadeCard
              v-for="atividade in cursoStore.atividades"
              :key="atividade.id"
              :atividade="atividade"
              :is-locked="!!atividade.allow_password && !cursoStore.isUnlocked(atividade.id)"
              @click="handleOpenAtividade"
            />
          </div>
        </div>
      </section>
    </main>

    <!-- Modals -->
    <PasswordModal
      :show="showPasswordModal"
      @close="showPasswordModal = false"
      @submit="handlePasswordSubmit"
    />

    <ActivityModal
      :show="showActivityModal"
      :atividade="activeActivity"
      :senha-curso="cursoSenha"
      :senha-atividade="atividadeSenha"
      @close="showActivityModal = false"
    />

    <ReforcoModal
      :show="showReforcoModal"
      :atividade="activeActivity"
      :questions="parsedQuestions"
      :senha-curso="cursoSenha"
      :senha-atividade="atividadeSenha"
      @close="showReforcoModal = false"
    />

    <RoletaModal
      :show="showRoletaModal"
      :atividade="activeActivity"
      :questions="parsedQuestions"
      :senha-curso="cursoSenha"
      :senha-atividade="atividadeSenha"
      @close="showRoletaModal = false"
    />

    <MinigameModal
      :show="showMinigameModal"
      :atividade="activeActivity"
      :questions="parsedQuestions"
      :senha-curso="cursoSenha"
      :senha-atividade="atividadeSenha"
      @close="showMinigameModal = false"
    />
  </div>
</template>
