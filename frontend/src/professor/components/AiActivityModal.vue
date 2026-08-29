<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useToast } from '@/shared/composables/useToast';
import { apiClient } from '@/shared/api/client';
import type { Aula, Question, AiModel } from '@/shared/types';
import BaseModal from '@/shared/components/BaseModal.vue';
import BaseButton from '@/shared/components/BaseButton.vue';
import BaseInput from '@/shared/components/BaseInput.vue';
import BaseTextarea from '@/shared/components/BaseTextarea.vue';
import BaseSelect from '@/shared/components/BaseSelect.vue';
import BaseBadge from '@/shared/components/BaseBadge.vue';
import BaseSpinner from '@/shared/components/BaseSpinner.vue';
import EmptyState from '@/shared/components/EmptyState.vue';

const props = defineProps<{
  show: boolean;
  tipo: 'normal' | 'prova' | 'minigame' | 'roleta' | 'reforco';
  titulo?: string;
  aulas: Aula[];
  disciplinaId?: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'apply', payload: { questions: Question[]; tipo: 'normal' | 'prova' | 'minigame' | 'roleta' | 'reforco' } | Question[]): void;
}>();

const { success, error, info } = useToast();

const tipoOptions = [
  { label: 'Normal', value: 'normal' },
  { label: 'Prova', value: 'prova' },
  { label: 'Minigame de Naves', value: 'minigame' },
  { label: 'Roleta do Conhecimento', value: 'roleta' },
  { label: 'Reforço', value: 'reforco' },
];

const selectedTipo = ref<'normal' | 'prova' | 'minigame' | 'roleta' | 'reforco'>('normal');
const activityTitle = ref('');
const tema = ref('');
const observacoes = ref('');
const quantidadeStr = ref('5');
const selectedAulas = ref<number[]>([]);
const selectedModel = ref('qwenproxy/qwen3.8-max-thinking');

const models = ref<AiModel[]>([]);
const isLoadingModels = ref(false);
const isGenerating = ref(false);
const generatedQuestions = ref<Question[]>([]);
const previewIndex = ref(0);
const is9RouterOnline = ref<boolean | null>(null);

const modelOptions = computed(() => {
  if (models.value.length === 0) {
    return [
      { label: 'Qwen 3.8 Max Thinking (Padrão)', value: 'qwenproxy/qwen3.8-max-thinking' },
      { label: 'DeepSeek V4 Flash', value: 'kimchi/deepseek-v4-flash' },
      { label: 'Gemini 3.7 Flash High', value: 'ag/gemini-3.7-flash-high' },
      { label: 'Claude Sonnet 4.6', value: 'ag/claude-sonnet-4-6' },
      { label: 'Kimi K2.7', value: 'kimchi/kimi-k2.7' },
    ];
  }
  return models.value.map((m) => {
    const badges: string[] = [];
    if (m.reasoning) badges.push('Raciocínio');
    if (m.vision) badges.push('Visão');
    const badgeText = badges.length > 0 ? ` [${badges.join(', ')}]` : '';
    return {
      label: `${m.name} (${m.provider})${badgeText}`,
      value: m.id,
    };
  });
});

watch(
  () => props.show,
  async (val) => {
    if (val) {
      selectedTipo.value = props.tipo || 'normal';
      activityTitle.value = props.titulo || '';
      tema.value = '';
      observacoes.value = '';
      quantidadeStr.value = '5';
      selectedAulas.value = props.aulas.map((a) => a.id);
      generatedQuestions.value = [];
      previewIndex.value = 0;
      await fetchModelsAndHealth();
    }
  }
);

async function fetchModelsAndHealth() {
  isLoadingModels.value = true;
  try {
    const [healthRes, modelsRes] = await Promise.allSettled([
      apiClient.get<{ ok: boolean; status: string }>('/ai/health'),
      apiClient.get<{ success: boolean; models: AiModel[] }>('/ai/models'),
    ]);

    if (healthRes.status === 'fulfilled' && healthRes.value?.success) {
      is9RouterOnline.value = true;
    } else {
      is9RouterOnline.value = false;
    }

    if (modelsRes.status === 'fulfilled' && modelsRes.value?.success && Array.isArray(modelsRes.value.data?.models)) {
      models.value = modelsRes.value.data.models;
      if (models.value.length > 0 && !models.value.some((m) => m.id === selectedModel.value)) {
        const preferred = models.value.find((m) => m.id.includes('qwen3.8') || m.reasoning) || models.value[0];
        selectedModel.value = preferred.id;
      }
    }
  } catch {
    is9RouterOnline.value = false;
  } finally {
    isLoadingModels.value = false;
  }
}

async function handleSyncModels() {
  info('Sincronizando modelos com 9router...');
  await fetchModelsAndHealth();
  if (is9RouterOnline.value) {
    success(`9router online! ${models.value.length} modelos disponíveis.`);
  } else {
    error('9router inacessível no momento.');
  }
}

function toggleAula(aulaId: number) {
  const idx = selectedAulas.value.indexOf(aulaId);
  if (idx > -1) {
    selectedAulas.value.splice(idx, 1);
  } else {
    selectedAulas.value.push(aulaId);
  }
}

function selectAllAulas() {
  if (selectedAulas.value.length === props.aulas.length) {
    selectedAulas.value = [];
  } else {
    selectedAulas.value = props.aulas.map((a) => a.id);
  }
}

async function handleGenerate() {
  if (isGenerating.value) return;
  if (!tema.value.trim() && !activityTitle.value.trim() && selectedAulas.value.length === 0) {
    error('Por favor, informe um tema, título ou selecione ao menos uma aula para contextualizar a IA.');
    return;
  }

  isGenerating.value = true;
  generatedQuestions.value = [];

  try {
    const payload = {
      modelo: selectedModel.value,
      tipo: selectedTipo.value,
      titulo: activityTitle.value.trim(),
      tema: tema.value.trim(),
      observacoes: observacoes.value.trim(),
      quantidade: Number(quantidadeStr.value) || 5,
      disciplina_id: props.disciplinaId,
      aulas_ids: selectedAulas.value,
    };

    const res = await apiClient.post<{
      success: boolean;
      questions: Question[];
      modelo_utilizado: string;
      total_gerado: number;
    }>('/ai/generate-activity', payload);

    if (res.success && Array.isArray(res.data?.questions) && res.data.questions.length > 0) {
      generatedQuestions.value = res.data.questions;
      previewIndex.value = 0;
      success(`Sucesso! ${res.data.questions.length} questões geradas.`);
    } else {
      error(res.error || 'A IA não retornou questões compatíveis.');
    }
  } catch (e: any) {
    error(e?.message || 'Falha ao comunicar com o serviço de IA.');
  } finally {
    isGenerating.value = false;
  }
}

function handleApplyQuestions() {
  if (generatedQuestions.value.length === 0) return;
  emit('apply', { questions: generatedQuestions.value, tipo: selectedTipo.value });
  emit('close');
}
</script>

<template>
  <BaseModal :model-value="props.show" @close="emit('close')" max-width="max-w-5xl" no-padding>
    <!-- Header fixo -->
    <template #header>
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-md bg-accent flex items-center justify-center text-white shadow-xs shrink-0">
            <span class="material-icons text-[20px]">auto_awesome</span>
          </div>
          <div>
            <h2 class="text-lg font-bold text-primary leading-tight flex items-center gap-2">
              <span>Gerador de Atividades por IA</span>
              <span
                class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                :class="is9RouterOnline ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="is9RouterOnline ? 'bg-emerald-500' : 'bg-amber-500'"></span>
                {{ is9RouterOnline ? '9router Conectado' : 'Status 9router' }}
              </span>
            </h2>
            <p class="text-xs text-secondary">Crie questões contextualizadas usando o conteúdo das aulas da disciplina</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <BaseButton variant="secondary" size="sm" :loading="isLoadingModels" @click="handleSyncModels">
            <span class="material-icons text-sm">sync</span>
            <span>Atualizar Modelos</span>
          </BaseButton>
          <BaseButton variant="ghost" size="sm" @click="emit('close')">Cancelar</BaseButton>
        </div>
      </div>
    </template>

    <!-- Layout Dividido: Parâmetros (Esq) vs Pré-visualização (Dir) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 min-h-[540px] max-h-[75vh] divide-y lg:divide-y-0 lg:divide-x divide-line bg-surface">
      <!-- Coluna Esquerda: Configuração e Prompt -->
      <div class="lg:col-span-6 p-6 overflow-y-auto space-y-5">
        <!-- Seleção do Modelo -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-secondary mb-1.5 flex items-center justify-between">
            <span>Modelo de IA (9router)</span>
            <span class="text-[11px] font-normal text-secondary lowercase">compatível com raciocínio</span>
          </label>
          <BaseSelect
            v-model="selectedModel"
            :options="modelOptions"
            :disabled="isGenerating || isLoadingModels"
          />
        </div>

        <!-- Tipo e Quantidade de Questões -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-secondary mb-1.5">
              Tipo de Atividade
            </label>
            <BaseSelect
              v-model="selectedTipo"
              :options="tipoOptions"
              :disabled="isGenerating"
            />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-secondary mb-1.5">
              Qtd. de Questões
            </label>
            <BaseInput
              v-model="quantidadeStr"
              type="number"
              min="1"
              max="20"
              placeholder="Ex: 5"
              :disabled="isGenerating"
            />
          </div>
        </div>

        <!-- Tema e Título -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-secondary mb-1.5">
            Tema / Tópico Principal *
          </label>
          <BaseInput
            v-model="tema"
            placeholder="Ex: Estruturas de Repetição em Python (for e while)"
            :disabled="isGenerating"
          />
        </div>

        <!-- Observações do Professor -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-secondary mb-1.5">
            Observações ou Instruções Pedagógicas
          </label>
          <BaseTextarea
            v-model="observacoes"
            :rows="3"
            placeholder="Ex: Priorize exemplos práticos de código, evite termos muito complexos e elabore questões de nível intermediário..."
            :disabled="isGenerating"
          />
        </div>

        <!-- Contexto das Aulas Vinculadas -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-xs font-bold uppercase tracking-wider text-secondary">
              Aulas para Contexto da IA ({{ selectedAulas.length }}/{{ props.aulas.length }})
            </label>
            <button
              type="button"
              class="text-xs text-accent hover:underline font-medium"
              :disabled="isGenerating || props.aulas.length === 0"
              @click="selectAllAulas"
            >
              {{ selectedAulas.length === props.aulas.length ? 'Desmarcar todas' : 'Selecionar todas' }}
            </button>
          </div>

          <div v-if="props.aulas.length === 0" class="p-3 bg-surface-alt rounded-lg text-xs text-secondary text-center">
            Nenhuma aula cadastrada nesta disciplina. O tema será gerado sem contexto específico de slides.
          </div>

          <div v-else class="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            <div
              v-for="aula in props.aulas"
              :key="aula.id"
              class="flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors"
              :class="selectedAulas.includes(aula.id) ? 'border-accent/40 bg-accent/5 text-primary' : 'border-line bg-surface hover:bg-surface-alt text-secondary'"
              @click="toggleAula(aula.id)"
            >
              <input
                type="checkbox"
                :checked="selectedAulas.includes(aula.id)"
                class="rounded border-line text-accent focus:ring-accent"
                @click.stop="toggleAula(aula.id)"
              />
              <span class="material-icons text-sm text-secondary">slideshow</span>
              <span class="font-medium truncate flex-1">{{ aula.titulo }}</span>
            </div>
          </div>
        </div>

        <!-- Botão Principal de Geração -->
        <div class="pt-2">
          <BaseButton
            variant="primary"
            size="lg"
            block
            :loading="isGenerating"
            :disabled="isGenerating || (!tema.trim() && selectedAulas.length === 0)"
            @click="handleGenerate"
          >
            <span class="material-icons text-lg">auto_awesome</span>
            <span>{{ isGenerating ? 'Gerando Questões com IA...' : 'Gerar Questões com IA' }}</span>
          </BaseButton>
        </div>
      </div>

      <!-- Coluna Direita: Pré-visualização das Questões Geradas -->
      <div class="lg:col-span-6 p-6 flex flex-col bg-surface-alt/40 overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
            <span class="material-icons text-base text-accent">preview</span>
            <span>Pré-visualização ({{ generatedQuestions.length }} geradas)</span>
          </h3>

          <div v-if="generatedQuestions.length > 0" class="flex items-center gap-2">
            <BaseButton variant="primary" size="sm" @click="handleApplyQuestions">
              <span class="material-icons text-sm">check_circle</span>
              <span>Usar no Editor</span>
            </BaseButton>
          </div>
        </div>

        <!-- Estado de Carregamento da IA -->
        <div v-if="isGenerating" class="my-auto flex flex-col items-center justify-center p-8 text-center space-y-4">
          <BaseSpinner size="lg" />
          <div class="space-y-1">
            <p class="text-sm font-semibold text-primary">Processando e sintetizando o material didático...</p>
            <p class="text-xs text-secondary">A IA está analisando as aulas e construindo as alternativas com feedback pedagógico.</p>
          </div>
        </div>

        <!-- Estado Vazio (Antes de Gerar) -->
        <div v-else-if="generatedQuestions.length === 0" class="my-auto">
          <EmptyState
            icon="psychology"
            title="Nenhuma questão gerada ainda"
            description="Configure o tema, observações e as aulas de referência ao lado e clique em 'Gerar Questões com IA'."
          />
        </div>

        <!-- Lista e Navegação das Questões Geradas -->
        <div v-else class="flex-1 flex flex-col space-y-4">
          <!-- Seletor de Abas de Questão -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              v-for="(_, qIdx) in generatedQuestions"
              :key="qIdx"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0"
              :class="previewIndex === qIdx ? 'bg-accent text-white shadow-xs' : 'bg-surface border border-line text-secondary hover:text-primary'"
              @click="previewIndex = qIdx"
            >
              Q{{ qIdx + 1 }}
            </button>
          </div>

          <!-- Card da Questão Selecionada -->
          <div class="flex-1 p-4 bg-surface border border-line rounded-xl shadow-xs space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-accent">
                {{ generatedQuestions[previewIndex]?.title || `Questão ${previewIndex + 1}` }}
              </span>
              <BaseBadge size="sm" variant="secondary">{{ selectedTipo }}</BaseBadge>
            </div>

            <p class="text-sm text-primary font-medium whitespace-pre-wrap leading-relaxed">
              {{ generatedQuestions[previewIndex]?.content }}
            </p>

            <!-- Alternativas da Questão -->
            <div v-if="generatedQuestions[previewIndex]?.options" class="space-y-2 pt-2 border-t border-line">
              <div
                v-for="(opt, optIdx) in generatedQuestions[previewIndex]?.options"
                :key="optIdx"
                class="p-2.5 rounded-lg border text-xs space-y-1 transition-colors"
                :class="opt.correct ? 'border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-950/20' : 'border-line bg-surface'"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 flex-1">
                    <span
                      class="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px]"
                      :class="opt.correct ? 'bg-emerald-500 text-white' : 'bg-surface-alt text-secondary border border-line'"
                    >
                      {{ String.fromCharCode(65 + optIdx) }}
                    </span>
                    <span class="font-medium text-primary">{{ opt.text }}</span>
                  </div>
                  <span v-if="opt.correct" class="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 shrink-0">
                    <span class="material-icons text-xs">check</span> Correta
                  </span>
                </div>
                <p v-if="opt.feedback" class="text-[11px] text-secondary pl-7">
                  <span class="font-medium text-primary/80">Feedback:</span> {{ opt.feedback }}
                </p>
              </div>
            </div>
          </div>

          <!-- Ações do Rodapé da Pré-visualização -->
          <div class="flex items-center justify-between pt-2">
            <div class="flex items-center gap-2">
              <BaseButton
                variant="secondary"
                size="sm"
                :disabled="previewIndex === 0"
                @click="previewIndex--"
              >
                <span class="material-icons text-sm">arrow_back</span>
                <span>Anterior</span>
              </BaseButton>
              <BaseButton
                variant="secondary"
                size="sm"
                :disabled="previewIndex >= generatedQuestions.length - 1"
                @click="previewIndex++"
              >
                <span>Próxima</span>
                <span class="material-icons text-sm">arrow_forward</span>
              </BaseButton>
            </div>

            <BaseButton variant="primary" size="sm" @click="handleApplyQuestions">
              <span class="material-icons text-sm">playlist_add_check</span>
              <span>Aplicar {{ generatedQuestions.length }} Questões no Editor</span>
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>
</template>
