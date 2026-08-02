<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useTurmaStore } from '@/stores/turma';
import { apiClient } from '@/api/client';
import TurmaFormModal from '@/components/TurmaFormModal.vue';
import MarpEditorModal from '@/components/MarpEditorModal.vue';
import JsonActivityEditorModal from '@/components/JsonActivityEditorModal.vue';
import type { Turma, Aula, Atividade } from '@/types';

const authStore = useAuthStore();
const turmaStore = useTurmaStore();

const emailInput = ref('');
const passwordInput = ref('');
const loginError = ref('');

const activeView = ref<'turmas' | 'detalhes'>('turmas');
const selectedTurma = ref<Turma | null>(null);

const showTurmaModal = ref(false);
const editingTurma = ref<Turma | null>(null);

const showMarpModal = ref(false);
const editingAula = ref<Aula | null>(null);

const showActivityEditorModal = ref(false);
const editingActivity = ref<Atividade | null>(null);

onMounted(async () => {
  const ok = await authStore.checkAuth();
  if (ok) {
    await turmaStore.fetchTurmas();
  }
});

async function handleLogin() {
  loginError.value = '';
  const result = await authStore.login(emailInput.value, passwordInput.value);
  if (result.success) {
    await turmaStore.fetchTurmas();
  } else {
    loginError.value = result.error || 'Falha na autenticação';
  }
}

function handleOpenTurmaModal(turma?: Turma) {
  editingTurma.value = turma || null;
  showTurmaModal.value = true;
}

async function handleSaveTurma(data: Partial<Turma>) {
  if (editingTurma.value) {
    await apiClient.put(`/turmas/${editingTurma.value.id}`, data);
  } else {
    await apiClient.post('/turmas', data);
  }
  showTurmaModal.value = false;
  await turmaStore.fetchTurmas();
}

async function handleDeleteTurma(turmaId: number) {
  if (confirm('Tem certeza que deseja excluir esta turma?')) {
    await apiClient.delete(`/turmas/${turmaId}`);
    await turmaStore.fetchTurmas();
  }
}

async function handleOpenTurmaDetails(turma: Turma) {
  selectedTurma.value = turma;
  await turmaStore.loadTurmaContent(turma.id);
  activeView.value = 'detalhes';
}

function handleOpenMarpModal(aula?: Aula) {
  editingAula.value = aula || null;
  showMarpModal.value = true;
}

async function handleSaveMarpAula(payload: { titulo: string; descricao: string; markdown: string }) {
  if (!selectedTurma.value) return;

  const data = {
    turma_id: selectedTurma.value.id,
    titulo: payload.titulo,
    descricao: payload.descricao,
    marp_markdown: payload.markdown,
    slug: payload.titulo.toLowerCase().replace(/\s+/g, '_'),
    ordem: turmaStore.aulas.length + 1
  };

  if (editingAula.value) {
    await apiClient.put(`/aulas/${editingAula.value.id}`, data);
  } else {
    await apiClient.post('/aulas', data);
  }

  showMarpModal.value = false;
  await turmaStore.loadTurmaContent(selectedTurma.value.id);
}

function handleOpenActivityEditor(atividade?: Atividade) {
  editingActivity.value = atividade || null;
  showActivityEditorModal.value = true;
}

async function handleSaveActivity(payload: Partial<Atividade>) {
  if (!selectedTurma.value) return;

  const data = {
    ...payload,
    turma_id: selectedTurma.value.id,
    ordem: turmaStore.atividades.length + 1
  };

  if (editingActivity.value) {
    await apiClient.put(`/atividades/${editingActivity.value.id}`, data);
  } else {
    await apiClient.post('/atividades', data);
  }

  showActivityEditorModal.value = false;
  await turmaStore.loadTurmaContent(selectedTurma.value.id);
}

async function handleDeleteAula(aulaId: number) {
  if (confirm('Tem certeza que deseja excluir esta aula?')) {
    await apiClient.delete(`/aulas/${aulaId}`);
    if (selectedTurma.value) {
      await turmaStore.loadTurmaContent(selectedTurma.value.id);
    }
  }
}

async function handleDeleteAtividade(atividadeId: number) {
  if (confirm('Tem certeza que deseja excluir esta atividade?')) {
    await apiClient.delete(`/atividades/${atividadeId}`);
    if (selectedTurma.value) {
      await turmaStore.loadTurmaContent(selectedTurma.value.id);
    }
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-slate-100">
    <!-- Unauthenticated Login View -->
    <div v-if="!authStore.isAuthenticated" class="min-h-screen flex items-center justify-center p-4">
      <div class="bg-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-700 space-y-6">
        <div class="text-center space-y-2">
          <span class="material-icons text-5xl text-indigo-400">admin_panel_settings</span>
          <h2 class="text-2xl font-bold text-white">Painel do Professor</h2>
          <p class="text-slate-400 text-sm">Digite suas credenciais para gerenciar turmas e aulas.</p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">E-mail</label>
            <input v-model="emailInput" required type="email" placeholder="professor@local" class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Senha</label>
            <input v-model="passwordInput" required type="password" placeholder="••••••••" class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div v-if="loginError" class="p-3 bg-rose-900/50 border border-rose-700 text-rose-200 text-sm rounded-xl">
            {{ loginError }}
          </div>

          <button type="submit" :disabled="authStore.isLoading" class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition">
            {{ authStore.isLoading ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>

        <div class="text-center pt-2">
          <router-link to="/" class="text-indigo-400 hover:text-indigo-300 text-sm font-medium">← Voltar para Área do Aluno</router-link>
        </div>
      </div>
    </div>

    <!-- Authenticated Dashboard View -->
    <div v-else class="min-h-screen">
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
            <button @click="authStore.logout" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition">Sair</button>
          </div>
        </div>
      </header>

      <!-- Main Body -->
      <main class="max-w-6xl mx-auto px-8 py-8">
        <!-- Turmas List View -->
        <div v-if="activeView === 'turmas'" class="space-y-6">
          <div class="flex justify-between items-center">
            <h2 class="text-2xl font-bold text-white">Minhas Turmas</h2>
            <button @click="handleOpenTurmaModal()" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg flex items-center space-x-2">
              <span class="material-icons text-sm">add</span>
              <span>Nova Turma</span>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div
              v-for="turma in turmaStore.turmas"
              :key="turma.id"
              class="bg-slate-800 rounded-2xl p-6 border border-slate-700 hover:border-slate-600 transition shadow-lg flex flex-col justify-between"
            >
              <div>
                <div class="flex justify-between items-start mb-4">
                  <div :class="[turma.cor || 'bg-indigo-600', 'p-3 rounded-full w-12 h-12 flex items-center justify-center text-white font-bold']">
                    <span class="material-icons">{{ turma.icone || 'school' }}</span>
                  </div>
                  <div class="flex space-x-1">
                    <button @click="handleOpenTurmaModal(turma)" class="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
                      <span class="material-icons text-sm">edit</span>
                    </button>
                    <button @click="handleDeleteTurma(turma.id)" class="p-2 text-rose-400 hover:text-rose-300 hover:bg-slate-700 rounded-lg">
                      <span class="material-icons text-sm">delete</span>
                    </button>
                  </div>
                </div>

                <h3 class="text-lg font-bold text-white">{{ turma.nome }}</h3>
                <p class="text-slate-400 text-sm mt-1 line-clamp-2">{{ turma.descricao || 'Sem descrição.' }}</p>
              </div>

              <button @click="handleOpenTurmaDetails(turma)" class="mt-6 w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold rounded-xl transition">
                Gerenciar Aulas & Atividades
              </button>
            </div>
          </div>
        </div>

        <!-- Turma Details View -->
        <div v-else class="space-y-6">
          <div class="flex items-center space-x-4 border-b border-slate-800 pb-4">
            <button @click="activeView = 'turmas'" class="p-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-xl text-white">
              <span class="material-icons">arrow_back</span>
            </button>
            <div>
              <h2 class="text-2xl font-bold text-white">{{ selectedTurma?.nome }}</h2>
              <p class="text-slate-400 text-xs mt-0.5">{{ selectedTurma?.descricao }}</p>
            </div>
          </div>

          <div class="flex justify-between items-center">
            <h3 class="text-xl font-bold text-slate-200">Aulas Cadastradas ({{ turmaStore.aulas.length }})</h3>
            <button @click="handleOpenMarpModal()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md flex items-center space-x-2">
              <span class="material-icons text-sm">add</span>
              <span>Criar Aula (Marp)</span>
            </button>
          </div>

          <div class="space-y-3">
            <div v-for="aula in turmaStore.aulas" :key="aula.id" class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
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
            <h3 class="text-xl font-bold text-slate-200">Atividades Cadastradas ({{ turmaStore.atividades.length }})</h3>
            <button @click="handleOpenActivityEditor()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md flex items-center space-x-2">
              <span class="material-icons text-sm">add</span>
              <span>Criar Atividade</span>
            </button>
          </div>

          <div class="space-y-3">
            <div v-for="atv in turmaStore.atividades" :key="atv.id" class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
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
      <TurmaFormModal :show="showTurmaModal" :turma="editingTurma" @close="showTurmaModal = false" @submit="handleSaveTurma" />
      <MarpEditorModal :show="showMarpModal" :titulo="editingAula?.titulo" :descricao="editingAula?.descricao" :markdown="editingAula?.marp_markdown" @close="showMarpModal = false" @save="handleSaveMarpAula" />
      <JsonActivityEditorModal :show="showActivityEditorModal" :atividade="editingActivity" @close="showActivityEditorModal = false" @save="handleSaveActivity" />
    </div>
  </div>
</template>
