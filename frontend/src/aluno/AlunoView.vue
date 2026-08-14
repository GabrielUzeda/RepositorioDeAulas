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
import BaseSkeleton from '@/shared/components/BaseSkeleton.vue';
import BackButton from '@/shared/components/BackButton.vue';
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

  if (selectedCurso.value?.senha) {
    const savedToken = await secureGet(`curso_access_${selectedCurso.value.id}`);
    if (savedToken !== 'granted') {
      pendingCurso.value = selectedCurso.value;
      showPasswordModal.value = true;
      return;
    }
  }

  let cursoPwd = cursoSenha.value || selectedCurso.value?.senha || '';
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

const isCheckingPassword = ref(false);

async function handlePasswordSubmit(password: string) {
  if (isCheckingPassword.value) return;
  isCheckingPassword.value = true;

  try {
    if (pendingCurso.value) {
      const res = await apiClient.post(`/cursos/${pendingCurso.value.id}/verificar-senha`, { senha: password });
      if (res.success) {
        await secureSet(`curso_senha_${pendingCurso.value.id}`, password);
        await secureSet(`curso_access_${pendingCurso.value.id}`, 'granted');
        cursoSenha.value = password;
        showPasswordModal.value = false;
        const curso = pendingCurso.value;
        pendingCurso.value = null;

        if (selectedDisciplina.value && (selectedDisciplina.value.curso_id === curso.id || selectedCurso.value?.id === curso.id)) {
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
  } finally {
    isCheckingPassword.value = false;
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
  <div class="min-h-screen bg-canvas">

    <!-- ── Header ──────────────────────────────────────── -->
    <header class="sticky top-0 z-30 border-b border-line bg-header-bg/80 backdrop-blur-md">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

        <!-- Logo -->
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="flex-shrink-0 w-8 h-8 rounded-md bg-accent flex items-center justify-center">
            <span class="material-icons text-white text-[18px]">school</span>
          </div>
          <div class="min-w-0 hidden sm:block">
            <p class="text-sm font-semibold text-primary leading-none truncate">Área do Aluno</p>
            <p class="text-xs text-muted leading-none mt-0.5 truncate">Repositório de Aulas</p>
          </div>
        </div>

        <!-- Breadcrumb de navegação — visibilidade do estado (NNGroup heurística #1) -->
        <nav
          v-if="activeView !== 'cursos'"
          class="flex-1 flex items-center gap-1.5 text-xs text-muted overflow-hidden px-2"
          aria-label="Navegação"
        >
          <button
            @click="() => { activeView = 'cursos'; selectedCurso = null; selectedDisciplina = null; }"
            class="hover:text-accent transition-colors duration-base truncate flex-shrink-0"
          >Cursos</button>

          <span class="material-icons text-[14px] flex-shrink-0" aria-hidden="true">chevron_right</span>

          <template v-if="selectedCurso">
            <button
              v-if="activeView === 'content'"
              @click="() => { activeView = 'disciplinas'; selectedDisciplina = null; }"
              class="hover:text-accent transition-colors duration-base truncate"
            >{{ selectedCurso.nome }}</button>
            <span v-else class="truncate text-primary font-medium">{{ selectedCurso.nome }}</span>
          </template>

          <template v-if="activeView === 'content' && selectedDisciplina">
            <span class="material-icons text-[14px] flex-shrink-0" aria-hidden="true">chevron_right</span>
            <span class="truncate text-primary font-medium">{{ selectedDisciplina.nome }}</span>
          </template>
        </nav>

        <!-- Actions -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <ThemeToggle />
          <router-link
            to="/login"
            class="inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface px-3 py-1.5 text-xs font-medium text-secondary hover:border-line-strong hover:text-primary transition-all duration-base"
          >
            <span class="material-icons text-[14px]">lock</span>
            <span class="hidden sm:inline">Área Restrita</span>
          </router-link>
        </div>
      </div>
    </header>

    <!-- ── Main ───────────────────────────────────────── -->
    <main class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <transition name="page-fade" mode="out-in">
        <!-- ─ Cursos ─ -->
        <section v-if="activeView === 'cursos'" key="cursos" class="space-y-6">
          <div>
            <h1 class="text-xl font-bold text-primary tracking-tight">Selecione seu Curso</h1>
            <p class="text-sm text-muted mt-0.5">Escolha o curso que deseja acessar</p>
          </div>

          <!-- Skeletons durante carregamento -->
          <div v-if="cursoStore.loadingCursos" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-label="Carregando cursos">
            <div
              v-for="n in 6"
              :key="n"
              class="bg-surface-alt rounded-lg border border-line p-5 flex flex-col gap-4 overflow-hidden"
            >
              <div class="flex items-center gap-3">
                <BaseSkeleton width="w-9" height="h-9" rounded="rounded-md" />
                <div class="flex-1 space-y-1.5">
                  <BaseSkeleton height="h-4" width="w-3/4" />
                  <BaseSkeleton height="h-3" width="w-1/2" />
                </div>
              </div>
              <div class="space-y-1.5 py-1">
                <BaseSkeleton height="h-3" width="w-full" />
                <BaseSkeleton height="h-3" width="w-4/5" />
              </div>
              <div class="flex items-center justify-between pt-3 border-t border-line">
                <BaseSkeleton height="h-3" width="w-24" />
                <BaseSkeleton height="h-3" width="w-16" />
              </div>
            </div>
          </div>

          <EmptyState
            v-else-if="cursoStore.cursos.length === 0"
            icon="school"
            title="Nenhum curso disponível"
            message="Não há cursos publicados no momento. Verifique com seu professor."
          />

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <CursoCard
              v-for="curso in cursoStore.cursos"
              :key="curso.id"
              :curso="curso"
              @select="handleSelectCurso"
            />
          </div>
        </section>

        <!-- ─ Disciplinas ─ -->
        <section v-else-if="activeView === 'disciplinas'" key="disciplinas" class="space-y-6">
          <!-- Cabeçalho da seção com botão voltar -->
          <div class="flex items-center gap-3">
            <BackButton @click="goBack" />
            <div class="min-w-0">
              <h1 class="text-xl font-bold text-primary tracking-tight truncate">{{ selectedCurso?.nome }}</h1>
              <p v-if="selectedCurso?.descricao" class="text-xs text-muted mt-0.5 line-clamp-1">{{ selectedCurso.descricao }}</p>
            </div>
          </div>

          <!-- Skeletons durante carregamento -->
          <div v-if="cursoStore.loadingDisciplinas" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-label="Carregando disciplinas">
            <div
              v-for="n in 6"
              :key="n"
              class="bg-surface-alt rounded-lg border border-line p-5 flex flex-col gap-4 overflow-hidden"
            >
              <div class="flex items-center gap-3">
                <BaseSkeleton width="w-9" height="h-9" rounded="rounded-md" />
                <div class="flex-1 space-y-1.5">
                  <BaseSkeleton height="h-4" width="w-3/4" />
                  <BaseSkeleton height="h-3" width="w-1/2" />
                </div>
              </div>
              <div class="space-y-1.5 py-1">
                <BaseSkeleton height="h-3" width="w-full" />
                <BaseSkeleton height="h-3" width="w-4/5" />
              </div>
              <div class="flex items-center justify-between pt-3 border-t border-line">
                <BaseSkeleton height="h-3" width="w-24" />
                <BaseSkeleton height="h-3" width="w-16" />
              </div>
            </div>
          </div>

          <EmptyState
            v-else-if="cursoStore.disciplinas.length === 0"
            icon="menu_book"
            title="Nenhuma disciplina"
            message="Este curso ainda não possui disciplinas publicadas."
          />

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DisciplinaCard
              v-for="disciplina in cursoStore.disciplinas"
              :key="disciplina.id"
              :disciplina="disciplina"
              @select="handleSelectDisciplina"
            />
          </div>
        </section>

        <!-- ─ Conteúdo (Aulas & Atividades) ─ -->
        <section v-else key="content" class="space-y-6">
          <!-- Header com tabs -->
          <div class="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
            <div class="flex items-center gap-3">
              <BackButton @click="goBack" />
              <div class="min-w-0">
                <h1 class="text-xl font-bold text-primary tracking-tight truncate">{{ selectedDisciplina?.nome }}</h1>
                <p v-if="selectedDisciplina?.descricao" class="text-xs text-muted mt-0.5 line-clamp-1">{{ selectedDisciplina.descricao }}</p>
              </div>
            </div>

            <!-- Tab bar — destaque de aba ativo com underline (mais claro que bg) -->
            <div
              class="flex items-center gap-1 bg-surface rounded-md p-1 border border-line self-start sm:self-auto flex-shrink-0"
              role="tablist"
              aria-label="Tipo de conteúdo"
            >
              <button
                role="tab"
                :aria-selected="activeTab === 'aulas'"
                @click="activeTab = 'atividades' === activeTab ? 'aulas' : 'aulas'"
                class="relative px-4 py-1.5 rounded text-xs font-semibold transition-all duration-base"
                :class="activeTab === 'aulas'
                  ? 'bg-surface-alt text-primary shadow-xs'
                  : 'text-muted hover:text-secondary'"
              >
                Aulas
                <span
                  class="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  :class="activeTab === 'aulas'
                    ? 'bg-accent-light text-accent-text'
                    : 'bg-surface text-muted'"
                >{{ cursoStore.aulas.length }}</span>
              </button>

              <button
                role="tab"
                :aria-selected="activeTab === 'atividades'"
                @click="activeTab = 'atividades'"
                class="relative px-4 py-1.5 rounded text-xs font-semibold transition-all duration-base"
                :class="activeTab === 'atividades'
                  ? 'bg-surface-alt text-primary shadow-xs'
                  : 'text-muted hover:text-secondary'"
              >
                Atividades
                <span
                  class="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  :class="activeTab === 'atividades'
                    ? 'bg-accent-light text-accent-text'
                    : 'bg-surface text-muted'"
                >{{ cursoStore.atividades.length }}</span>
              </button>
            </div>
          </div>

          <transition name="page-fade" mode="out-in">
            <!-- Aba: Aulas -->
            <div v-if="activeTab === 'aulas'" key="aulas" role="tabpanel" aria-label="Aulas">
              <div v-if="cursoStore.loadingContent" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-label="Carregando aulas">
                <div
                  v-for="n in 6"
                  :key="n"
                  class="bg-surface-alt rounded-lg border border-line p-5 flex flex-col gap-4 overflow-hidden"
                >
                  <div class="flex items-center gap-3">
                    <BaseSkeleton width="w-9" height="h-9" rounded="rounded-md" />
                    <div class="flex-1 space-y-1.5">
                      <BaseSkeleton height="h-4" width="w-3/4" />
                      <BaseSkeleton height="h-3" width="w-1/2" />
                    </div>
                  </div>
                  <div class="space-y-1.5 py-1">
                    <BaseSkeleton height="h-3" width="w-full" />
                    <BaseSkeleton height="h-3" width="w-4/5" />
                  </div>
                  <div class="flex items-center justify-between pt-3 border-t border-line">
                    <BaseSkeleton height="h-3" width="w-24" />
                    <BaseSkeleton height="h-3" width="w-16" />
                  </div>
                </div>
              </div>
              <EmptyState
                v-else-if="cursoStore.aulas.length === 0"
                icon="play_lesson"
                title="Nenhuma aula"
                message="Ainda não há aulas publicadas nesta disciplina."
              />
              <!-- Grid de cards para aulas -->
              <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AulaCard
                  v-for="aula in cursoStore.aulas"
                  :key="aula.id"
                  :aula="aula"
                  @open="handleOpenAula"
                />
              </div>
            </div>

            <!-- Aba: Atividades -->
            <div v-else key="atividades" role="tabpanel" aria-label="Atividades">
              <div v-if="cursoStore.loadingContent" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-label="Carregando atividades">
                <div
                  v-for="n in 6"
                  :key="n"
                  class="bg-surface-alt rounded-lg border border-line p-5 flex flex-col gap-4 overflow-hidden"
                >
                  <div class="flex items-center gap-3">
                    <BaseSkeleton width="w-9" height="h-9" rounded="rounded-md" />
                    <div class="flex-1 space-y-1.5">
                      <BaseSkeleton height="h-4" width="w-3/4" />
                      <BaseSkeleton height="h-3" width="w-1/2" />
                    </div>
                  </div>
                  <div class="space-y-1.5 py-1">
                    <BaseSkeleton height="h-3" width="w-full" />
                    <BaseSkeleton height="h-3" width="w-4/5" />
                  </div>
                  <div class="flex items-center justify-between pt-3 border-t border-line">
                    <BaseSkeleton height="h-3" width="w-24" />
                    <BaseSkeleton height="h-3" width="w-16" />
                  </div>
                </div>
              </div>
              <EmptyState
                v-else-if="cursoStore.atividades.length === 0"
                icon="assignment"
                title="Nenhuma atividade"
                message="Ainda não há atividades publicadas nesta disciplina."
              />
              <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AtividadeCard
                  v-for="atividade in cursoStore.atividades"
                  :key="atividade.id"
                  :atividade="atividade"
                  :is-locked="!!atividade.allow_password && !cursoStore.isUnlocked(atividade.id)"
                  @click="handleOpenAtividade"
                />
              </div>
            </div>
          </transition>
        </section>
      </transition>
    </main>

    <!-- ── Modals ─────────────────────────────────────── -->
    <PasswordModal
      :show="showPasswordModal"
      :loading="isCheckingPassword"
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
