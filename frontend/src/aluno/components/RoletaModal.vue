<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { apiClient } from '@/shared/api/client';
import { secureGet, secureSet } from '@/shared/utils/storage';
import { useToast } from '@/shared/composables/useToast';
import type { Question, Option, Atividade } from '@/shared/types';
import BaseModal from '@/shared/components/BaseModal.vue';
import BaseButton from '@/shared/components/BaseButton.vue';
import BaseSpinner from '@/shared/components/BaseSpinner.vue';

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

const availableQuestions = ref<Question[]>([]);
const currentQuestion = ref<Question | null>(null);
const currentQuestionIndex = ref(-1);
const selectedOption = ref<Option | null>(null);

const answeredCount = ref(0);

const isAnimating = ref(false);
const highlightedIndex = ref(-1);

const showQuestionModal = ref(false);
const isSubmitted = ref(false);

const isSubmitting = ref(false);
const isCorrectionDone = ref(false);
const errorMessage = ref('');
const { success } = useToast();
const resultAcertos = ref<number | null>(null);
const resultTotal = ref<number | null>(null);
const resultPontuacao = ref<number | null>(null);

const answers = ref<Record<number, number>>({});

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
  availableQuestions.value = [...props.questions];
  currentQuestion.value = null;
  currentQuestionIndex.value = -1;
  selectedOption.value = null;
  answeredCount.value = 0;
  isAnimating.value = false;
  highlightedIndex.value = -1;
  showQuestionModal.value = false;
  isSubmitted.value = false;
  isSubmitting.value = false;
  isCorrectionDone.value = false;
  errorMessage.value = '';
  resultAcertos.value = null;
  resultTotal.value = null;
  resultPontuacao.value = null;
}

const remainingCount = computed(() => availableQuestions.value.length);
const isCompleted = computed(() => availableQuestions.value.length === 0);

function animateSpin() {
  if (availableQuestions.value.length === 0 || isAnimating.value) return;

  isAnimating.value = true;
  const total = availableQuestions.value.length;

  let currentIndex = Math.floor(Math.random() * total);
  let delay = 50;
  const maxDelay = 400;
  const acceleration = 1.1;
  const minIterations = Math.max(25, total * 3);
  let iterations = 0;

  function loop() {
    highlightedIndex.value = currentIndex;
    iterations++;

    if (iterations < minIterations || delay < maxDelay) {
      currentIndex = (currentIndex + 1) % total;
      delay = Math.min(delay * acceleration, maxDelay);
      setTimeout(loop, delay);
    } else {
      setTimeout(() => {
        currentQuestion.value = availableQuestions.value[currentIndex];
        currentQuestionIndex.value = props.questions.indexOf(availableQuestions.value[currentIndex]);
        selectedOption.value = null;
        isSubmitted.value = false;
        showQuestionModal.value = true;
        isAnimating.value = false;
      }, 500);
    }
  }

  loop();
}

function handleSelectOption(opt: Option) {
  if (isSubmitted.value) return;
  selectedOption.value = opt;
}

function handleConfirmAnswer() {
  if (!selectedOption.value || !currentQuestion.value) return;
  isSubmitted.value = true;

  if (currentQuestionIndex.value >= 0) {
    const optIndex = currentQuestion.value.options?.indexOf(selectedOption.value) ?? -1;
    if (optIndex >= 0) answers.value[currentQuestionIndex.value] = optIndex;
  }

  // Question is always removed from the pool after the student answers;
  // correctness is determined server-side, not via a local gabarito.
  availableQuestions.value = availableQuestions.value.filter(
    (q) => q !== currentQuestion.value
  );
  answeredCount.value++;
}

async function handleNextQuestion() {
  showQuestionModal.value = false;
  if (availableQuestions.value.length === 0) {
    await submitAnswers();
  }
}

async function submitAnswers() {
  if (isSubmitting.value) return;
  if (!props.atividade) {
    emit('complete');
    return;
  }
  isSubmitting.value = true;
  errorMessage.value = '';

  const [nome, email] = await Promise.all([
    secureGet('alunoNome'),
    secureGet('alunoEmail'),
  ]);

  const respostas = props.questions.map((q, idx) => ({
    questao: q.title || q.content,
    resposta: answers.value[idx] !== undefined ? q.options?.[answers.value[idx]]?.text : null
  }));

  const res = await apiClient.post('/submeter-resposta', {
    atividade_id: props.atividade.id,
    aluno_nome: nome,
    aluno_email: email,
    respostas: JSON.stringify(respostas).trim(),
    senha_curso: props.senhaCurso,
    senha_atividade: props.senhaAtividade
  });

  isSubmitting.value = false;

  if (res.success) {
    isCorrectionDone.value = true;
    if (res.data && res.data.consulta_token) {
      secureSet(`consulta_token_${props.atividade.id}`, String(res.data.consulta_token));
    }
    if (res.data && res.data.acertos !== undefined) resultAcertos.value = res.data.acertos;
    if (res.data && res.data.total !== undefined) resultTotal.value = res.data.total;
    if (res.data && res.data.pontuacao !== undefined) resultPontuacao.value = res.data.pontuacao;
    let msg = 'Atividade concluída!';
    if (resultAcertos.value !== null) {
      const total = resultTotal.value ?? props.questions.length;
      msg += ` Acertos: ${resultAcertos.value} / ${total}`;
      if (resultPontuacao.value !== null) msg += ` — Pontuação: ${resultPontuacao.value}%`;
    }
    success(msg);
    emit('complete');
  } else {
    errorMessage.value = res.error || 'Erro ao registrar respostas.';
  }
}

function closeAfterSubmit() {
  emit('close');
}
</script>

<template>
  <BaseModal
    :model-value="props.show"
    @close="emit('close')"
    :title="props.title || 'Roleta'"
    max-width="max-w-4xl"
  >
    <div class="space-y-6 relative">
      <!-- Badge + counters (moved from manual header) -->
      <div class="flex justify-between items-center flex-wrap gap-3">
        <div class="flex items-center space-x-3">
          <div class="p-3 bg-cat-roleta-bg text-cat-roleta rounded-2xl flex items-center justify-center">
            <span class="material-icons leading-none">casino</span>
          </div>
          <span class="px-3 py-1 bg-cat-roleta-bg text-cat-roleta text-xs font-bold rounded-full uppercase tracking-wider">Roleta do Conhecimento</span>
        </div>

        <div class="flex items-center space-x-4 bg-surface px-4 py-2 rounded-xl text-xs font-bold">
          <div class="flex items-center space-x-1 text-success" title="Respondidas">
            <span class="material-icons text-sm">check_circle</span>
            <span>{{ answeredCount }}</span>
          </div>
          <div class="w-px h-4 bg-line"></div>
          <div class="flex items-center space-x-1 text-cat-roleta" title="Restantes">
            <span class="material-icons text-sm">help</span>
            <span>{{ remainingCount }}</span>
          </div>
        </div>
      </div>

      <!-- Main Wheel Area -->
      <div class="py-8 flex flex-col items-center justify-center space-y-6">
        <div v-if="!isCompleted" class="text-center space-y-1">
          <h3 class="text-2xl font-bold text-primary">Sua Vez de Jogar</h3>
          <p class="text-secondary text-sm">Clique no botão para sortear uma pergunta no painel.</p>
        </div>

        <!-- Wheel Grid -->
        <div v-if="!isCompleted" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 w-full max-w-2xl">
          <div
            v-for="(q, idx) in availableQuestions"
            :key="idx"
            :class="[
              'p-6 rounded-2xl border-2 flex items-center justify-center aspect-square transition-all duration-200 shadow-md',
              highlightedIndex === idx
                ? 'border-cat-roleta bg-cat-roleta-bg text-cat-roleta scale-105 shadow-lg'
                : 'border-line bg-surface text-secondary'
            ]"
          >
            <span class="material-icons text-3xl">
              {{ highlightedIndex === idx ? 'radar' : 'help_outline' }}
            </span>
          </div>
        </div>

        <!-- Completion View -->
        <div v-else class="text-center py-12 space-y-4">
          <template v-if="isSubmitting">
            <BaseSpinner size="lg" color-class="text-secondary" />
            <h3 class="text-3xl font-bold text-secondary">Sincronizando com o servidor...</h3>
            <p class="text-secondary">Enviando suas respostas para correção no servidor.</p>
          </template>
          <template v-else>
            <h3 class="text-3xl font-bold text-success">Parabéns! Atividade Concluída!</h3>
            <p class="text-secondary">Você respondeu todas as perguntas disponíveis nesta roleta.</p>
            <p v-if="isCorrectionDone && resultAcertos !== null" class="text-secondary">
              Acertos: {{ resultAcertos }} / {{ resultTotal ?? props.questions.length }}
              <template v-if="resultPontuacao !== null"> — Pontuação: {{ resultPontuacao }}</template>
            </p>
            <p v-if="errorMessage" class="text-danger text-sm">{{ errorMessage }}</p>
            <BaseButton
              v-if="errorMessage"
              variant="danger"
              class="mt-3"
              @click="emit('close')"
            >
              Fechar
            </BaseButton>
          </template>
        </div>

        <!-- Action Button -->
        <BaseButton
          size="lg"
          :disabled="isAnimating || isCompleted"
          @click="animateSpin"
        >
          <BaseSpinner v-if="isAnimating" size="sm" />
          <span class="tracking-wider">{{ isCompleted ? 'CONCLUÍDO' : 'GIRAR ROLETA' }}</span>
        </BaseButton>
      </div>

      <!-- Question Modal Popup (kept as raw nested overlay to preserve no-dismiss behavior) -->
      <div v-if="showQuestionModal && currentQuestion" class="fixed inset-0 bg-surface backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div class="bg-surface-alt border border-line rounded-3xl p-6 max-w-2xl w-full space-y-6 shadow-2xl text-primary">
          <div class="flex justify-between items-center border-b border-line pb-3">
            <h4 class="text-lg font-bold text-cat-roleta flex items-center space-x-2">
              <span class="material-icons">quiz</span>
              <span>{{ currentQuestion.title }}</span>
            </h4>
          </div>

          <div class="text-lg font-medium text-primary">
            {{ currentQuestion.content }}
          </div>

          <!-- Options -->
          <div class="space-y-3">
            <button
              v-for="(opt, idx) in currentQuestion.options"
              :key="idx"
              @click="handleSelectOption(opt)"
              :disabled="isSubmitted"
              :class="[
                'w-full text-left p-4 rounded-xl border transition flex flex-col space-y-1',
                selectedOption === opt
                  ? isSubmitted
                    ? 'border-success bg-surface text-success'
                    : 'border-cat-roleta bg-cat-roleta-bg text-cat-roleta'
                  : 'border-line bg-surface text-secondary hover:border-line'
              ]"
            >
              <div class="flex justify-between items-center font-medium">
                <span>{{ opt.text }}</span>
                <span class="material-icons text-sm">
                  {{ selectedOption === opt ? (isSubmitted ? 'check_circle' : 'radio_button_checked') : 'radio_button_unchecked' }}
                </span>
              </div>
            </button>
          </div>

          <!-- Feedback da opção escolhida -->
          <div v-if="isSubmitted && selectedOption?.feedback" class="p-4 bg-surface-alt border-l-4 border-accent rounded-r-xl text-sm text-secondary flex items-start space-x-2">
            <span class="material-icons text-base text-accent mt-0.5">info</span>
            <span>{{ selectedOption.feedback }}</span>
          </div>

          <!-- Modal Action -->
          <div class="flex justify-end pt-4 border-t border-line">
            <button
              v-if="!isSubmitted"
              @click="handleConfirmAnswer"
              :disabled="!selectedOption"
              class="px-6 py-2.5 bg-cat-roleta hover:opacity-90 text-on-danger font-bold rounded-xl text-sm transition"
            >
              Confirmar Resposta
            </button>
            <button
              v-else
              @click="handleNextQuestion"
              class="px-6 py-2.5 bg-success hover:opacity-90 font-bold rounded-xl text-sm transition"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>
</template>
