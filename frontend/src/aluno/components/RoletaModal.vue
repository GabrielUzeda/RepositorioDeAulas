<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useToast } from '@/shared/composables/useToast';
import type { Question, Option, Atividade } from '@/shared/types';
import BaseModal from '@/shared/components/BaseModal.vue';
import BaseButton from '@/shared/components/BaseButton.vue';
import BaseSpinner from '@/shared/components/BaseSpinner.vue';
import BaseBadge from '@/shared/components/BaseBadge.vue';

const props = withDefaults(defineProps<{
  show: boolean;
  questions: Question[];
  title?: string;
  atividade?: Atividade | null;
  senhaCurso?: string;
  senhaAtividade?: string;
}>(), {
  title: '',
  senhaCurso: '',
  senhaAtividade: '',
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'complete'): void;
}>();

const { success } = useToast();

const availableQuestions = ref<Question[]>([]);
const currentQuestion = ref<Question | null>(null);
const selectedOption = ref<Option | null>(null);

const answeredCount = ref(0);
const acertosCount = ref(0);

const isAnimating = ref(false);
const highlightedIndex = ref(-1);

const showQuestionModal = ref(false);
const isAnswerConfirmed = ref(false);

watch(
  () => props.show,
  (val) => {
    if (val) {
      resetGame();
    } else {
      showQuestionModal.value = false;
    }
  }
);

function resetGame() {
  availableQuestions.value = [...(props.questions || [])];
  currentQuestion.value = null;
  selectedOption.value = null;
  answeredCount.value = 0;
  acertosCount.value = 0;
  isAnimating.value = false;
  highlightedIndex.value = -1;
  showQuestionModal.value = false;
  isAnswerConfirmed.value = false;
}

const remainingCount = computed(() => availableQuestions.value.length);
const errosCount = computed(() => answeredCount.value - acertosCount.value);
const isCompleted = computed(() => props.questions.length > 0 && availableQuestions.value.length === 0);

function isOptCorrect(opt: any): boolean {
  if (!opt) return false;
  return Boolean(opt.correct || opt.isCorrect || opt.correta);
}

function animateSpin() {
  if (availableQuestions.value.length === 0 || isAnimating.value) return;

  isAnimating.value = true;
  const total = availableQuestions.value.length;
  let currentIndex = Math.floor(Math.random() * total);
  let delay = 40;
  let steps = 0;
  const maxSteps = Math.min(18, total * 4 + 8);

  function step() {
    highlightedIndex.value = currentIndex;
    steps++;

    if (steps < maxSteps) {
      currentIndex = (currentIndex + 1) % total;
      delay = Math.min(delay * 1.12, 220);
      setTimeout(step, delay);
    } else {
      setTimeout(() => {
        const selectedQuestion = availableQuestions.value[currentIndex];
        currentQuestion.value = selectedQuestion;
        selectedOption.value = null;
        isAnswerConfirmed.value = false;
        isAnimating.value = false;
        showQuestionModal.value = true;
      }, 250);
    }
  }

  step();
}

function handleSelectOption(opt: Option) {
  if (isAnswerConfirmed.value) return;
  selectedOption.value = opt;
}

function handleConfirmAnswer() {
  if (isAnswerConfirmed.value || !selectedOption.value || !currentQuestion.value) return;
  isAnswerConfirmed.value = true;

  if (isOptCorrect(selectedOption.value)) {
    acertosCount.value++;
  }

  // Remove a pergunta sorteada do pool disponível
  availableQuestions.value = availableQuestions.value.filter(
    (q) => q !== currentQuestion.value
  );
  answeredCount.value++;
}

function handleNextQuestion() {
  showQuestionModal.value = false;
  if (availableQuestions.value.length === 0) {
    success(`Roleta Concluída! Acertos: ${acertosCount.value} / ${props.questions.length}`);
    emit('complete');
  }
}
</script>

<template>
  <BaseModal
    :model-value="props.show"
    @close="emit('close')"
    max-width="max-w-4xl"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-cat-roleta-bg text-cat-roleta rounded-md flex items-center justify-center shrink-0 shadow-xs">
          <span class="material-icons text-[18px]">casino</span>
        </div>
        <h2 class="text-base font-semibold text-primary leading-snug">
          {{ props.atividade?.titulo || props.title || 'Roleta do Conhecimento' }}
        </h2>
      </div>
    </template>

    <div class="py-2 space-y-6 relative">
      <!-- Main Wheel Area -->
      <div class="flex flex-col items-center justify-center space-y-5">
        <div v-if="!isCompleted" class="text-center space-y-2 max-w-xl">
          <h3 class="text-xl font-bold text-primary">Sua Vez de Jogar</h3>
          <p v-if="props.atividade?.descricao" class="text-primary text-xs font-medium leading-relaxed whitespace-pre-line bg-surface-alt p-2.5 rounded-lg border border-line">
            {{ props.atividade.descricao }}
          </p>
          <p class="text-secondary text-sm">Clique no botão para sortear uma pergunta no painel.</p>
        </div>

        <!-- Wheel Grid -->
        <div v-if="!isCompleted" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 w-full max-w-2xl">
          <div
            v-for="(q, idx) in availableQuestions"
            :key="idx"
            :class="[
              'p-6 rounded-2xl border-2 flex items-center justify-center aspect-square transition-all duration-150 shadow-sm',
              highlightedIndex === idx
                ? 'border-cat-roleta bg-cat-roleta-bg text-cat-roleta scale-105 shadow-md ring-2 ring-cat-roleta/50'
                : 'border-line bg-surface text-secondary'
            ]"
          >
            <span class="material-icons text-3xl">
              {{ highlightedIndex === idx ? 'radar' : 'help_outline' }}
            </span>
          </div>
        </div>

        <!-- Completion View -->
        <div v-else class="text-center py-10 space-y-4 max-w-md mx-auto">
          <div class="w-16 h-16 bg-success-light text-success-text rounded-full flex items-center justify-center mx-auto shadow-sm">
            <span class="material-icons text-3xl">emoji_events</span>
          </div>
          <h3 class="text-2xl font-extrabold text-primary">Parabéns! Roleta Concluída!</h3>
          <p class="text-secondary text-sm leading-relaxed">
            Você respondeu a todas as perguntas sorteadas nesta atividade.
          </p>
          <div class="inline-block bg-surface px-6 py-3 rounded-2xl border border-line shadow-xs">
            <span class="text-2xl font-bold text-success">{{ acertosCount }}</span>
            <span class="text-secondary text-base"> / {{ props.questions.length }} acertos</span>
          </div>
        </div>

        <!-- Action Button -->
        <div class="pt-2">
          <BaseButton
            v-if="!isCompleted"
            size="lg"
            variant="primary"
            :disabled="isAnimating"
            :loading="isAnimating"
            @click="animateSpin"
          >
            <span class="material-icons text-base" v-if="!isAnimating">autorenew</span>
            <span class="tracking-wider">{{ isAnimating ? 'SORTEANDO...' : 'GIRAR ROLETA' }}</span>
          </BaseButton>

          <BaseButton
            v-else
            size="md"
            variant="success"
            @click="emit('close')"
          >
            <span class="material-icons text-sm">check</span>
            <span>Concluir</span>
          </BaseButton>
        </div>
      </div>

      <!-- Question Modal Popup Overlay -->
      <div v-if="showQuestionModal && currentQuestion" class="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
        <div class="bg-surface-alt border border-line rounded-2xl p-6 max-w-xl w-full space-y-5 shadow-modal text-primary">
          <div class="flex justify-between items-center border-b border-line pb-3">
            <h4 class="text-base font-bold text-cat-roleta flex items-center gap-2">
              <span class="material-icons text-lg">quiz</span>
              <span>{{ currentQuestion.title || 'Pergunta Sorteada' }}</span>
            </h4>
          </div>

          <div class="text-base font-semibold text-primary leading-relaxed">
            {{ currentQuestion.content }}
          </div>

          <!-- Options -->
          <div class="space-y-2.5">
            <button
              v-for="(opt, idx) in currentQuestion.options"
              :key="idx"
              @click="handleSelectOption(opt)"
              :disabled="isAnswerConfirmed"
              :class="[
                'w-full text-left p-3.5 rounded-xl border transition-all flex items-start space-x-3 text-sm font-medium',
                selectedOption === opt
                  ? isAnswerConfirmed
                    ? isOptCorrect(opt)
                      ? 'border-success bg-success-light text-success-text shadow-xs ring-1 ring-success'
                      : 'border-danger bg-danger-light text-danger-text shadow-xs ring-1 ring-danger'
                    : 'border-cat-roleta bg-cat-roleta-bg text-cat-roleta shadow-xs ring-1 ring-cat-roleta'
                  : 'border-line bg-surface text-primary hover:bg-surface-alt hover:border-line-strong'
              ]"
            >
              <span
                :class="[
                  'w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 mt-0.5',
                  selectedOption === opt
                    ? isAnswerConfirmed
                      ? isOptCorrect(opt) ? 'border-success bg-success text-white' : 'border-danger bg-danger text-white'
                      : 'border-cat-roleta bg-cat-roleta text-white'
                    : 'border-line text-secondary'
                ]"
              >
                {{ String.fromCharCode(65 + idx) }}
              </span>
              <span class="flex-1 leading-relaxed">{{ opt.text }}</span>
            </button>
          </div>

          <!-- Instant Feedback for selected option -->
          <div v-if="isAnswerConfirmed && selectedOption" class="pt-1">
            <div
              v-if="isOptCorrect(selectedOption)"
              class="p-3.5 bg-success-light border-l-4 border-success text-success-text rounded-r-xl text-xs font-semibold flex items-center gap-2.5"
            >
              <span class="material-icons text-lg">check_circle</span>
              <span>Resposta Correta! {{ selectedOption.feedback || '' }}</span>
            </div>

            <div
              v-else
              class="p-3.5 bg-danger-light border-l-4 border-danger text-danger-text rounded-r-xl text-xs flex items-start gap-2.5"
            >
              <span class="material-icons text-lg mt-0.5 shrink-0">error_outline</span>
              <div class="space-y-0.5">
                <span class="font-bold block uppercase tracking-wide text-[10px]">Resposta Incorreta</span>
                <p>{{ selectedOption.feedback || 'Revise o conteúdo para compreender a opção correta.' }}</p>
              </div>
            </div>
          </div>

          <!-- Modal Action -->
          <div class="flex justify-end pt-3 border-t border-line">
            <BaseButton
              v-if="!isAnswerConfirmed"
              variant="primary"
              size="sm"
              :disabled="!selectedOption"
              @click="handleConfirmAnswer"
            >
              Confirmar Resposta
            </BaseButton>

            <BaseButton
              v-else
              variant="success"
              size="sm"
              @click="handleNextQuestion"
            >
              <span>Continuar</span>
              <span class="material-icons text-sm">arrow_forward</span>
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>
</template>
