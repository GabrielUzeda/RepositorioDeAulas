<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useToast } from '@/shared/composables/useToast';
import { apiClient } from '@/shared/api/client';
import { secureGet, secureSet, secureRemove } from '@/shared/utils/storage';
import type { Atividade, Question, QuestionOption, RascunhoEditor, Aula } from '@/shared/types';
import BaseModal from '@/shared/components/BaseModal.vue';
import BaseButton from '@/shared/components/BaseButton.vue';
import BaseInput from '@/shared/components/BaseInput.vue';
import BaseTextarea from '@/shared/components/BaseTextarea.vue';
import BaseSelect from '@/shared/components/BaseSelect.vue';
import BaseBadge from '@/shared/components/BaseBadge.vue';
import BaseSpinner from '@/shared/components/BaseSpinner.vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue';
import AiActivityModal from '@/professor/components/AiActivityModal.vue';

const tipoOptions = [
  { label: 'Normal', value: 'normal' },
  { label: 'Prova', value: 'prova' },
  { label: 'Minigame de Naves', value: 'minigame' },
  { label: 'Roleta do Conhecimento', value: 'roleta' },
  { label: 'Reforço', value: 'reforco' },
];

const props = withDefaults(
  defineProps<{
    show: boolean;
    atividade?: Atividade | null;
    loading?: boolean;
    aulas?: Aula[];
    disciplinaId?: number;
  }>(),
  { loading: false, aulas: () => [] }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', payload: Partial<Atividade>): void;
}>();

const titulo = ref('');
const descricao = ref('');
const tipo = ref<'normal' | 'prova' | 'minigame' | 'roleta' | 'reforco'>('normal');
const allowPassword = ref(false);
const senha = ref('');
const questions = ref<Question[]>([]);
const isSaving = ref(false);
const activeQIndex = ref(0);
const showBasicInfo = ref(true);

const showAiModal = ref(false);
const showDraftsModal = ref(false);
const isLoadingDrafts = ref(false);
const isSavingDraft = ref(false);
const drafts = ref<RascunhoEditor[]>([]);
const currentDraftId = ref<number | null>(null);

const showConfirmClear = ref(false);
const isInitializing = ref(true);

const usesOptions = computed(() => tipo.value !== 'normal' && tipo.value !== 'prova');
const activeQuestion = computed(() => questions.value[activeQIndex.value] ?? null);

const draftStorageKey = computed(() => {
  if (props.atividade?.id && props.atividade.id > 0) {
    return `prof_editor_draft_atv_${props.atividade.id}`;
  }
  return `prof_editor_draft_new_${props.disciplinaId ?? 'global'}`;
});

function normalizeQuestion(q: any): Question {
  let options: QuestionOption[] | undefined;
  const rawOptions = Array.isArray(q?.options) ? q.options : Array.isArray(q?.alternativas) ? q.alternativas : null;
  if (rawOptions && rawOptions.length > 0) {
    options = rawOptions.map((opt: any) => ({
      text: String(opt?.text ?? opt?.label ?? ''),
      correct: !!opt?.correct,
      feedback: String(opt?.feedback ?? '')
    }));
  }
  if (q?.type === 'text') options = undefined;
  return {
    title: String(q?.title ?? ''),
    content: String(q?.content ?? ''),
    ...(options ? { options } : {})
  };
}

let autoSaveTimeout: any = null;
function scheduleAutoSave() {
  if (isInitializing.value || !props.show) return;
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(async () => {
    const draftData = {
      titulo: titulo.value,
      descricao: descricao.value,
      tipo: tipo.value,
      allowPassword: allowPassword.value,
      senha: senha.value,
      questions: questions.value,
      updatedAt: Date.now()
    };
    await secureSet(draftStorageKey.value, JSON.stringify(draftData));
  }, 400);
}

watch(
  [titulo, descricao, tipo, allowPassword, senha, questions],
  () => {
    scheduleAutoSave();
  },
  { deep: true }
);

watch(
  () => props.show,
  async (val) => {
    isSaving.value = false;
    activeQIndex.value = 0;
    showBasicInfo.value = true;
    currentDraftId.value = null;
    isInitializing.value = true;
    if (val) {
      if (props.atividade) {
        titulo.value = props.atividade.titulo || '';
        descricao.value = props.atividade.descricao || '';
        tipo.value = (props.atividade.tipo as any) || 'normal';
        allowPassword.value = !!props.atividade.allow_password;
        senha.value = props.atividade.senha || '';
        if (props.atividade.json_data) {
          try {
            const parsed = typeof props.atividade.json_data === 'string'
              ? JSON.parse(props.atividade.json_data)
              : props.atividade.json_data;
            questions.value = (Array.isArray(parsed?.questions) ? parsed.questions : []).map(normalizeQuestion);
          } catch {
            questions.value = [];
          }
        } else {
          questions.value = [];
        }
      } else {
        const savedDraft = await secureGet(draftStorageKey.value);
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft);
            titulo.value = parsed.titulo || '';
            descricao.value = parsed.descricao || '';
            tipo.value = parsed.tipo || 'normal';
            allowPassword.value = !!parsed.allowPassword;
            senha.value = parsed.senha || '';
            questions.value = (Array.isArray(parsed.questions) ? parsed.questions : []).map(normalizeQuestion);
            if (questions.value.length > 0) {
              showBasicInfo.value = false;
            }
          } catch {
            resetToEmpty();
          }
        } else {
          resetToEmpty();
        }
      }
      setTimeout(() => {
        isInitializing.value = false;
      }, 50);
    }
  }
);

function resetToEmpty() {
  titulo.value = '';
  descricao.value = '';
  tipo.value = 'normal';
  allowPassword.value = false;
  senha.value = '';
  questions.value = [];
  activeQIndex.value = 0;
  showBasicInfo.value = true;
}

function addQuestion() {
  const base = { title: `Questão ${questions.value.length + 1}`, content: '' };
  const newQ: Question = usesOptions.value
    ? { ...base, options: [{ text: 'Opção 1', correct: true, feedback: 'Correto!' }, { text: 'Opção 2', correct: false, feedback: 'Incorreto.' }] }
    : base;
  questions.value.push(newQ);
  activeQIndex.value = questions.value.length - 1;
  showBasicInfo.value = false;
}

function handleTypeChange() {
  questions.value = [];
  activeQIndex.value = 0;
}

function removeQuestion(index: number) {
  questions.value.splice(index, 1);
  if (activeQIndex.value >= questions.value.length) {
    activeQIndex.value = Math.max(0, questions.value.length - 1);
  }
}

function moveQuestion(index: number, direction: 'up' | 'down') {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target >= 0 && target < questions.value.length) {
    const temp = questions.value[index];
    questions.value[index] = questions.value[target];
    questions.value[target] = temp;
    activeQIndex.value = target;
  }
}

function addOption(qIndex: number) {
  const q = questions.value[qIndex];
  if (!q.options) q.options = [];
  q.options.push({ text: `Opção ${q.options.length + 1}`, correct: false, feedback: '' });
}

function removeOption(qIndex: number, oIndex: number) {
  questions.value[qIndex].options?.splice(oIndex, 1);
}

function setCorrectOption(qIndex: number, oIndex: number) {
  const opts = questions.value[qIndex].options;
  if (opts) opts.forEach((o, idx) => { o.correct = idx === oIndex; });
}

async function handleClearAll() {
  resetToEmpty();
  await secureRemove(draftStorageKey.value);
  useToast().success('Editor limpo com sucesso!');
}

async function handleSave() {
  if (isSaving.value || props.loading) return;
  isSaving.value = true;
  await secureRemove(draftStorageKey.value);
  emit('save', {
    titulo: titulo.value,
    descricao: descricao.value,
    tipo: tipo.value,
    allow_password: allowPassword.value,
    senha: allowPassword.value ? senha.value : null,
    caminho: titulo.value.toLowerCase().replace(/\s+/g, '_'),
    json_data: JSON.stringify({ questions: questions.value })
  });
}

async function handleSaveDraft() {
  if (isSavingDraft.value) return;
  isSavingDraft.value = true;
  try {
    const payload = {
      rascunho_id: currentDraftId.value,
      titulo: titulo.value || 'Sem título',
      descricao: descricao.value,
      tipo: tipo.value,
      json_data: { questions: questions.value }
    };
    const res = await apiClient.post<{ id: number; expira_em: string; success: boolean }>('/professor/rascunhos-editor', payload);
    if (res.success && res.data) {
      currentDraftId.value = res.data.id;
      useToast().success('Rascunho salvo na nuvem com validade de 30 dias!');
      await fetchDrafts();
    } else {
      useToast().error(res.error || 'Erro ao salvar rascunho');
    }
  } catch (e: any) {
    useToast().error(e?.message || 'Erro ao salvar rascunho');
  } finally {
    isSavingDraft.value = false;
  }
}

async function openDraftsModal() {
  showDraftsModal.value = true;
  await fetchDrafts();
}

async function fetchDrafts() {
  isLoadingDrafts.value = true;
  try {
    const res = await apiClient.get<RascunhoEditor[]>('/professor/rascunhos-editor');
    if (res.success && Array.isArray(res.data)) {
      drafts.value = res.data;
    } else {
      drafts.value = [];
    }
  } catch {
    drafts.value = [];
  } finally {
    isLoadingDrafts.value = false;
  }
}

function getDaysRemaining(expiraEm: string): number {
  const diff = new Date(expiraEm).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

function handleLoadDraft(draft: RascunhoEditor) {
  try {
    const parsed = typeof draft.json_data === 'string' ? JSON.parse(draft.json_data) : draft.json_data;
    const raw = Array.isArray(parsed?.questions) ? parsed.questions : Array.isArray(parsed?.perguntas) ? parsed.perguntas : [];
    titulo.value = draft.titulo || '';
    descricao.value = draft.descricao || '';
    tipo.value = ((draft.tipo === 'game' ? 'minigame' : draft.tipo) as any) || 'normal';
    questions.value = raw.map(normalizeQuestion);
    currentDraftId.value = draft.id;
    activeQIndex.value = 0;
    showBasicInfo.value = false;
    showDraftsModal.value = false;
    useToast().success('Rascunho carregado no editor!');
  } catch {
    useToast().error('Erro ao processar dados do rascunho.');
  }
}

async function handleDeleteDraft(draftId: number) {
  const res = await apiClient.delete(`/professor/rascunhos-editor/${draftId}`);
  if (res.success) {
    if (currentDraftId.value === draftId) {
      currentDraftId.value = null;
    }
    drafts.value = drafts.value.filter((d) => d.id !== draftId);
    useToast().success('Rascunho excluído com sucesso!');
  } else {
    useToast().error(res.error || 'Erro ao excluir rascunho.');
  }
}

function handleApplyAiQuestions(payload: { questions: Question[]; tipo?: 'normal' | 'prova' | 'minigame' | 'roleta' | 'reforco' } | Question[]) {
  const generatedQuestions = Array.isArray(payload) ? payload : payload.questions;
  const appliedTipo = !Array.isArray(payload) && payload.tipo ? payload.tipo : undefined;
  
  if (!generatedQuestions || generatedQuestions.length === 0) return;
  if (appliedTipo) {
    tipo.value = appliedTipo;
  }
  questions.value = generatedQuestions.map(normalizeQuestion);
  activeQIndex.value = 0;
  showBasicInfo.value = false;
  useToast().success(`${generatedQuestions.length} questões geradas por IA (${appliedTipo || tipo.value}) foram inseridas no editor!`);
}
</script>

<template>
  <BaseModal :model-value="props.show" @close="emit('close')" max-width="max-w-6xl" no-padding>
    <!-- Header fixo -->
    <template #header>
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-md bg-accent flex items-center justify-center text-white shadow-xs shrink-0">
            <span class="material-icons text-[20px]">quiz</span>
          </div>
          <div>
            <h2 class="text-lg font-bold text-primary leading-tight">{{ (props.atividade && props.atividade.id && props.atividade.id > 0) ? 'Editar Atividade' : 'Nova Atividade Interativa' }}</h2>
            <p class="text-xs text-secondary flex items-center gap-1.5 mt-0.5">
              <span>{{ questions.length }} pergunta{{ questions.length !== 1 ? 's' : '' }} · {{ tipo }}</span>
              <span class="text-line">|</span>
              <span class="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Rascunho automático ativo
              </span>
            </p>
          </div>
        </div>

        <div class="flex items-center flex-wrap gap-2">
          <BaseButton variant="secondary" size="sm" @click="showAiModal = true">
            <span class="material-icons text-sm text-accent">auto_awesome</span>
            <span>Gerar com IA</span>
          </BaseButton>
          <BaseButton variant="secondary" size="sm" @click="openDraftsModal">
            <span class="material-icons text-sm">folder_open</span>
            <span>Rascunhos</span>
          </BaseButton>
          <BaseButton variant="danger" size="sm" @click="showConfirmClear = true" title="Limpar todo o formulário e perguntas">
            <span class="material-icons text-sm">delete_sweep</span>
            <span>Limpar Tudo</span>
          </BaseButton>
          <BaseButton variant="primary" size="sm" :loading="props.loading || isSaving" @click="handleSave">Salvar Atividade</BaseButton>
        </div>
      </div>
    </template>

    <!-- Layout split: sidebar esq + painel dir -->
    <div class="flex h-full min-h-0" style="height: calc(90vh - 130px)">

      <!-- Sidebar: informações + lista de perguntas -->
      <aside class="w-64 shrink-0 flex flex-col border-r border-line bg-surface overflow-y-auto">
        <!-- Info básica collapsible -->
        <button
          class="flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-wider text-secondary hover:bg-surface-alt transition-colors border-b border-line"
          @click="showBasicInfo = !showBasicInfo; activeQIndex = -1"
        >
          <span class="flex items-center gap-1.5">
            <span class="material-icons text-sm text-accent">info</span>
            Informações
          </span>
          <span class="material-icons text-sm transition-transform" :class="showBasicInfo ? 'rotate-180' : ''">expand_more</span>
        </button>

        <!-- Lista de perguntas -->
        <div class="flex-1 overflow-y-auto">
          <div class="px-3 pt-3 pb-1 flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-secondary">Perguntas</span>
            <span class="text-xs text-secondary bg-surface-alt px-1.5 py-0.5 rounded-full">{{ questions.length }}</span>
          </div>

          <EmptyState v-if="questions.length === 0" icon="help_outline" message="Nenhuma pergunta ainda." class="py-6 px-3" />

          <div
            v-for="(q, idx) in questions"
            :key="idx"
            class="group mx-2 mb-1 rounded-lg border cursor-pointer transition-all"
            :class="activeQIndex === idx && !showBasicInfo
              ? 'border-accent bg-accent/10 shadow-sm'
              : 'border-transparent hover:border-line hover:bg-surface-alt'"
            @click="activeQIndex = idx; showBasicInfo = false"
          >
            <div class="px-3 py-2.5 flex items-start gap-2">
              <span class="mt-0.5 w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0"
                :class="activeQIndex === idx && !showBasicInfo ? 'bg-accent text-white' : 'bg-surface-alt text-secondary'">
                {{ idx + 1 }}
              </span>
              <p class="text-xs text-primary leading-snug line-clamp-2 flex-1">{{ q.content || q.title || 'Sem enunciado' }}</p>
            </div>
          </div>
        </div>

        <!-- Botão adicionar -->
        <div class="shrink-0 p-3 border-t border-line">
          <BaseButton variant="primary" size="sm" block @click="addQuestion">
            <span class="material-icons text-sm">add</span>
            <span>Adicionar Pergunta</span>
          </BaseButton>
        </div>
      </aside>

      <!-- Painel direito -->
      <main class="flex-1 min-w-0 overflow-y-auto px-6 py-5 space-y-5">

        <!-- Painel: informações básicas -->
        <div v-if="showBasicInfo" class="space-y-4">
          <div v-if="!usesOptions" class="p-3 bg-surface-alt border border-line rounded-lg text-secondary text-xs flex items-center gap-2">
            <span class="material-icons text-base text-accent">edit_note</span>
            <span>Tipo <strong class="text-primary">{{ tipo }}</strong>: perguntas <strong class="text-primary">discursivas</strong> (resposta livre).</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BaseInput v-model="titulo" type="text" label="Título da Atividade *" placeholder="Ex: Avaliação de Algoritmos" />
            <BaseSelect v-model="tipo" :options="tipoOptions" label="Tipo de Atividade" @change="handleTypeChange" />
            <div class="md:col-span-2">
              <BaseTextarea v-model="descricao" :rows="4" label="Descrição / Orientações" placeholder="Breve resumo ou instruções da atividade para os alunos..." />
            </div>
            <div class="md:col-span-2 flex items-center gap-3">
              <input type="checkbox" id="allowPassword" v-model="allowPassword" class="w-4 h-4 text-accent rounded border-line bg-surface" />
              <label for="allowPassword" class="text-sm font-medium text-secondary cursor-pointer">Exigir senha individual de acesso para os alunos</label>
            </div>
            <div v-if="allowPassword" class="md:col-span-2">
              <BaseInput v-model="senha" type="password" label="Senha da Atividade *" placeholder="Digite a senha exclusiva" />
            </div>
          </div>
        </div>

        <!-- Painel: pergunta ativa -->
        <template v-else-if="activeQuestion !== null">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 flex-1 min-w-0">
              <span class="w-7 h-7 rounded-md bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-xs">{{ activeQIndex + 1 }}</span>
              <span v-if="tipo === 'minigame'" class="font-semibold text-primary text-sm">Pergunta {{ activeQIndex + 1 }}</span>
              <input
                v-else
                v-model="activeQuestion.title"
                placeholder="Título/Tema da Questão (Ex: Questão 1)"
                class="w-full bg-surface-alt px-3.5 py-2 rounded-md border border-line font-semibold text-primary text-sm outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
              />
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <BaseButton variant="ghost" size="sm" :disabled="activeQIndex === 0" title="Mover para cima" @click="moveQuestion(activeQIndex, 'up')">
                <span class="material-icons text-sm">arrow_upward</span>
              </BaseButton>
              <BaseButton variant="ghost" size="sm" :disabled="activeQIndex === questions.length - 1" title="Mover para baixo" @click="moveQuestion(activeQIndex, 'down')">
                <span class="material-icons text-sm">arrow_downward</span>
              </BaseButton>
              <BaseButton variant="danger" size="sm" title="Excluir questão" @click="removeQuestion(activeQIndex)">
                <span class="material-icons text-sm">delete</span>
              </BaseButton>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="block text-xs font-semibold uppercase tracking-wider text-secondary">Enunciado da Pergunta *</label>
            <BaseTextarea
              v-model="activeQuestion.content"
              :rows="6"
              class="w-full"
              placeholder="Digite o enunciado completo da questão para o aluno..."
            />
          </div>

          <!-- Alternativas -->
          <div v-if="usesOptions" class="space-y-3">
            <div class="flex justify-between items-center">
              <label class="text-xs font-semibold uppercase tracking-wider text-secondary">Alternativas de Resposta</label>
              <BaseButton variant="ghost" size="sm" @click="addOption(activeQIndex)">
                <span class="material-icons text-xs mr-1">add</span> + Adicionar Opção
              </BaseButton>
            </div>

            <div class="space-y-2">
              <div
                v-for="(opt, oIndex) in activeQuestion.options"
                :key="oIndex"
                class="flex items-start gap-3 p-3 rounded-lg border transition-colors"
                :class="opt.correct ? 'border-success/50 bg-success/5' : 'border-line bg-surface'"
              >
                <div class="flex items-center gap-2 pt-1 shrink-0">
                  <input
                    type="radio"
                    :name="`correct_${activeQIndex}`"
                    :checked="opt.correct"
                    @change="setCorrectOption(activeQIndex, oIndex)"
                    title="Marcar como alternativa correta"
                    class="w-4 h-4 text-success bg-surface border-line cursor-pointer"
                  />
                  <span class="text-xs font-bold" :class="opt.correct ? 'text-success' : 'text-secondary'">{{ String.fromCharCode(65 + oIndex) }}</span>
                </div>
                <div class="flex-1 min-w-0 space-y-2">
                  <input
                    v-model="opt.text"
                    placeholder="Texto da alternativa..."
                    class="w-full bg-surface-alt px-3 py-1.5 rounded-md border border-line text-primary text-sm outline-none focus:border-accent"
                  />
                  <input
                    v-if="tipo !== 'minigame'"
                    v-model="opt.feedback"
                    placeholder="Feedback pedagógico (opcional)..."
                    class="w-full bg-surface-alt px-3 py-1.5 rounded-md text-xs text-secondary border border-line outline-none focus:border-accent"
                  />
                </div>
                <button
                  type="button"
                  class="p-1 text-secondary hover:text-danger rounded hover:bg-surface-alt transition-colors shrink-0 mt-1"
                  title="Remover opção"
                  @click="removeOption(activeQIndex, oIndex)"
                >
                  <span class="material-icons text-sm">close</span>
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- Estado vazio (nenhuma pergunta, tela inicial de perguntas) -->
        <EmptyState v-else-if="!showBasicInfo && questions.length === 0" icon="help_outline" title="Nenhuma pergunta adicionada." message="Clique em &quot;Adicionar Pergunta&quot; para começar." />
      </main>
    </div>

    <!-- Modal de Rascunhos -->
    <BaseModal :model-value="showDraftsModal" @close="showDraftsModal = false" title="Rascunhos de Atividades" max-width="max-w-2xl">
      <div v-if="isLoadingDrafts" class="py-12 flex justify-center items-center">
        <BaseSpinner size="lg" />
      </div>

      <div v-else class="space-y-4">
        <!-- Banner informativo LGPD / Expiração de 30 dias -->
        <div class="p-3.5 bg-surface-alt border border-line rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div class="space-y-0.5">
            <div class="flex items-center gap-1.5 font-semibold text-primary">
              <span class="material-icons text-base text-accent">schedule</span>
              <span>Rascunhos salvos por até 30 dias</span>
            </div>
            <p class="text-secondary">Os rascunhos na nuvem expiram automaticamente após 30 dias de inatividade.</p>
          </div>

          <BaseButton variant="primary" size="sm" :loading="isSavingDraft" class="shrink-0" @click="handleSaveDraft">
            <span class="material-icons text-sm">bookmark_add</span>
            <span>Salvar Rascunho Atual</span>
          </BaseButton>
        </div>

        <div v-if="drafts.length === 0" class="py-6">
          <EmptyState
            icon="folder_open"
            title="Nenhum rascunho salvo na nuvem"
            message="O editor salva suas alterações localmente em tempo real. Você também pode clicar no botão acima para guardar este rascunho na nuvem por 30 dias."
          />
        </div>

        <div v-else class="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
          <div class="flex items-center justify-between text-xs text-secondary px-1 pb-1">
            <span>Rascunhos salvos: <strong class="text-primary">{{ drafts.length }}/20</strong></span>
            <span>Validade máxima: 30 dias</span>
          </div>

          <div
            v-for="draft in drafts"
            :key="draft.id"
            class="p-4 bg-surface border border-line rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-accent/40 transition-colors"
          >
            <div class="space-y-1 min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="text-sm font-semibold text-primary truncate">{{ draft.titulo || 'Sem título' }}</h4>
                <BaseBadge variant="secondary">{{ draft.tipo }}</BaseBadge>
              </div>
              <div class="flex items-center gap-2 text-xs text-secondary flex-wrap">
                <span>Atualizado em: {{ formatDate(draft.atualizado_em) }}</span>
                <span>·</span>
                <span class="text-accent font-medium">Expira em {{ getDaysRemaining(draft.expira_em) }} dias</span>
              </div>
              <p v-if="draft.descricao" class="text-xs text-secondary line-clamp-1 mt-1">{{ draft.descricao }}</p>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <BaseButton variant="primary" size="sm" @click="handleLoadDraft(draft)">
                <span class="material-icons text-sm">file_download</span>
                <span>Carregar</span>
              </BaseButton>
              <BaseButton variant="danger" size="sm" @click="handleDeleteDraft(draft.id)">
                <span class="material-icons text-sm">delete</span>
                <span>Excluir</span>
              </BaseButton>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <BaseButton variant="secondary" size="sm" @click="showDraftsModal = false">Fechar</BaseButton>
        </div>
      </template>
    </BaseModal>

    <!-- Diálogo de confirmação para Limpar Tudo -->
    <ConfirmDialog
      v-model="showConfirmClear"
      title="Limpar Tudo"
      message="Tem certeza de que deseja limpar todos os campos e perguntas do editor? Esta ação não pode ser desfeita."
      :danger="true"
      confirm-text="Limpar Tudo"
      cancel-text="Cancelar"
      @confirm="handleClearAll"
    />

    <!-- Modal de Geração por IA -->
    <AiActivityModal
      :show="showAiModal"
      :tipo="tipo"
      :titulo="titulo"
      :aulas="props.aulas"
      :disciplina-id="props.disciplinaId"
      @close="showAiModal = false"
      @apply="handleApplyAiQuestions"
    />
  </BaseModal>
</template>
