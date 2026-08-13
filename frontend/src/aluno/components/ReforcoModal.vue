<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useToast } from '@/shared/composables/useToast';
import type { Question, Atividade } from '@/shared/types';
import BaseModal from '@/shared/components/BaseModal.vue';
import BaseButton from '@/shared/components/BaseButton.vue';
import BaseBadge from '@/shared/components/BaseBadge.vue';

const props = withDefaults(defineProps<{
  show: boolean;
  questions: Question[];
  title?: string;
  atividade?: Atividade | null;
}>(), {
  title: '',
});

const emit = defineEmits<(e: 'close') => void>();
const { success } = useToast();

const started = ref(false);
const currentIndex = ref(0);
const selectedOptions = ref<Record<number, number>>({});
const answeredCorrectly = ref<Set<number>>(new Set());

const currentQuestion = computed<Question | null>(() => {
  if (!props.questions || props.questions.length === 0) return null;
  return props.questions[currentIndex.value] || null;
});

const currentSelectedOptionIndex = computed<number | null>(() => {
  return selectedOptions.value[currentIndex.value] ?? null;
});

const currentSelectedOption = computed(() => {
  if (!currentQuestion.value || currentSelectedOptionIndex.value === null) return null;
  return currentQuestion.value.options?.[currentSelectedOptionIndex.value] || null;
});

const acertosCount = computed(() => answeredCorrectly.value.size);
const isCompleted = computed(() => {
  return props.questions.length > 0 && acertosCount.value === props.questions.length;
});

function isOptCorrect(opt: any): boolean {
  if (!opt) return false;
  return Boolean(opt.correct || opt.isCorrect || opt.correta);
}

watch(
  () => props.show,
  (val) => {
    if (val) {
      started.value = false;
      currentIndex.value = 0;
      selectedOptions.value = {};
      answeredCorrectly.value = new Set();
    }
  }
);

function selectOption(optIndex: number) {
  if (!currentQuestion.value) return;
  selectedOptions.value[currentIndex.value] = optIndex;
  
  const opt = currentQuestion.value.options?.[optIndex];
  if (isOptCorrect(opt)) {
    const newSet = new Set(answeredCorrectly.value);
    newSet.add(currentIndex.value);
    answeredCorrectly.value = newSet;

    if (newSet.size === props.questions.length) {
      success('Parabéns! Você acertou todas as questões de reforço! 🎉');
    }
  }
}

function getOptionFeedback(opt: any, question: Question): string {
  if (opt && opt.feedback && opt.feedback.trim()) {
    return opt.feedback;
  }
  const just = (question as any).justificativas;
  if (just && opt && opt.letra && just[opt.letra]) {
    return just[opt.letra];
  }
  return 'Incorreto. Revise o conceito apresentado para identificar a alternativa correta.';
}

function nextQuestion() {
  if (currentIndex.value < props.questions.length - 1) {
    currentIndex.value++;
  }
}

function prevQuestion() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
  }
}
</script>

<template>
  <BaseModal
    :model-value="props.show"
    max-width="max-w-2xl"
    @close="emit('close')"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-cat-reforco-bg text-cat-reforco rounded-md flex items-center justify-center shrink-0 shadow-xs">
          <span class="material-icons text-[18px]">fitness_center</span>
        </div>
        <h2 class="text-base font-semibold text-primary leading-snug">
          {{ props.atividade?.titulo || props.title || 'Atividade de Reforço' }}
        </h2>
      </div>
    </template>

    <!-- Tela Inicial de Apresentação (Exibida apenas antes de iniciar) -->
    <div v-if="!started" class="py-8 px-4 flex flex-col items-center text-center space-y-6">
      <div class="w-16 h-16 bg-accent-light text-accent rounded-2xl flex items-center justify-center shadow-sm">
        <span class="material-icons text-3xl">school</span>
      </div>

      <div class="space-y-2 max-w-lg">
        <h3 class="text-xl font-bold text-primary">Aprendizado Livre e Sem Avaliação</h3>
        <p class="text-secondary text-sm leading-relaxed">
          Responda todas as questões sem medo de errar! O objetivo desta atividade é fixar os conceitos com feedback imediato a cada escolha.
        </p>
      </div>

      <BaseButton variant="primary" size="md" @click="started = true">
        <span>Começar Atividade</span>
        <span class="material-icons text-sm">arrow_forward</span>
      </BaseButton>
    </div>

    <!-- Tela Principal com as Questões e Feedbacks -->
    <div v-else class="space-y-5">
      <!-- Header & Progress Counter -->
      <div class="flex justify-between items-center text-sm font-semibold text-secondary pb-1">
        <span>Questão {{ currentIndex + 1 }} de {{ props.questions.length }}</span>
        <div class="flex items-center gap-2">
          <BaseBadge variant="success">
            Acertos: {{ acertosCount }} / {{ props.questions.length }}
          </BaseBadge>
        </div>
      </div>

      <!-- Victory Celebration Banner -->
      <div v-if="isCompleted" class="p-4 bg-success-light border border-success/30 text-success-text rounded-xl text-sm font-bold flex items-center gap-3 animate-fade-in">
        <span class="material-icons text-2xl">emoji_events</span>
        <div>
          <h4 class="text-base font-extrabold">🎉 Parabéns!</h4>
          <p class="text-xs font-normal opacity-90">Você acertou todas as questões da atividade de reforço!</p>
        </div>
      </div>

      <!-- Question Body -->
      <div v-if="currentQuestion" class="space-y-4 pt-1">
        <h4 v-if="currentQuestion.title" class="text-base font-semibold text-accent">{{ currentQuestion.title }}</h4>
        <p class="text-primary text-base font-medium leading-relaxed">{{ currentQuestion.content }}</p>

        <!-- Option Buttons -->
        <div class="space-y-3 pt-2">
          <button
            v-for="(opt, idx) in currentQuestion.options"
            :key="idx"
            @click="selectOption(idx)"
            type="button"
            :class="[
              'w-full text-left p-4 rounded-xl border transition-all flex items-start space-x-3 text-sm font-medium',
              currentSelectedOptionIndex === idx
                ? isOptCorrect(opt)
                  ? 'bg-success-light border-success text-success-text shadow-sm ring-1 ring-success'
                  : 'bg-danger-light border-danger text-danger-text shadow-sm ring-1 ring-danger'
                : 'bg-surface-alt border-line text-primary hover:bg-surface hover:border-line-strong'
            ]"
          >
            <!-- Letter / Circle Icon -->
            <span
              :class="[
                'w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-colors',
                currentSelectedOptionIndex === idx
                  ? isOptCorrect(opt)
                    ? 'border-success bg-success text-white'
                    : 'border-danger bg-danger text-white'
                  : 'border-line text-secondary'
              ]"
            >
              <span v-if="currentSelectedOptionIndex === idx" class="material-icons text-[14px]">
                {{ isOptCorrect(opt) ? 'check' : 'close' }}
              </span>
              <span v-else>{{ String.fromCharCode(65 + idx) }}</span>
            </span>

            <span class="flex-1 leading-relaxed">{{ opt.text }}</span>
          </button>
        </div>

        <!-- Instant Feedback Box for Selected Option -->
        <div v-if="currentSelectedOption" class="pt-2">
          <!-- Correct Feedback -->
          <div
            v-if="isOptCorrect(currentSelectedOption)"
            class="p-4 bg-success-light border-l-4 border-success text-success-text rounded-r-xl text-sm font-semibold flex items-center gap-3 animate-fade-in"
          >
            <span class="material-icons text-xl">check_circle</span>
            <span>Resposta Correta! 🎉</span>
          </div>

          <!-- Incorrect Feedback with Explanation -->
          <div
            v-else
            class="p-4 bg-danger-light border-l-4 border-danger text-danger-text rounded-r-xl text-sm flex items-start gap-3 animate-fade-in"
          >
            <span class="material-icons text-xl mt-0.5 shrink-0">error_outline</span>
            <div class="space-y-1">
              <h5 class="font-bold text-xs uppercase tracking-wide">Resposta Incorreta</h5>
              <p class="leading-relaxed text-xs">
                {{ getOptionFeedback(currentSelectedOption, currentQuestion) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Controls -->
    <template v-if="started" #footer>
      <div class="flex justify-between items-center pt-1">
        <BaseButton
          variant="secondary"
          size="sm"
          :disabled="currentIndex === 0"
          @click="prevQuestion"
        >
          <span class="material-icons text-sm">arrow_back</span>
          <span>Anterior</span>
        </BaseButton>

        <BaseButton
          v-if="currentIndex < props.questions.length - 1"
          variant="primary"
          size="sm"
          @click="nextQuestion"
        >
          <span>Próxima</span>
          <span class="material-icons text-sm">arrow_forward</span>
        </BaseButton>

        <BaseButton
          v-else
          variant="ghost"
          size="sm"
          @click="emit('close')"
        >
          <span>Concluir</span>
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
