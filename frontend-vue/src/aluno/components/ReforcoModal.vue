<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { Question } from '@/shared/types';

const props = defineProps<{
  show: boolean;
  questions: Question[];
  title: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const currentIndex = ref(0);
const score = ref(0);
const selectedOptionIndex = ref<number | null>(null);
const feedback = ref<string | null>(null);
const isCorrect = ref<boolean | null>(null);
const answeredQuestions = ref<Set<number>>(new Set());

watch(
  () => props.show,
  (val) => {
    if (val) {
      currentIndex.value = 0;
      score.value = 0;
      selectedOptionIndex.value = null;
      feedback.value = null;
      isCorrect.value = null;
      answeredQuestions.value = new Set();
    }
  }
);

const currentQuestion = computed(() => {
  return props.questions[currentIndex.value] || null;
});

function handleSelectOption(optionIndex: number) {
  if (answeredQuestions.value.has(currentIndex.value) || !currentQuestion.value) return;

  selectedOptionIndex.value = optionIndex;
  const option = currentQuestion.value.options?.[optionIndex];
  if (!option) return;

  isCorrect.value = option.correct;
  feedback.value = option.feedback || (option.correct ? 'Resposta Correta!' : 'Resposta Incorreta!');

  if (option.correct) {
    score.value++;
    answeredQuestions.value.add(currentIndex.value);
    // Fire confetti on complete
    if (typeof (window as any).confetti === 'function') {
      (window as any).confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    }
  }
}

function nextQuestion() {
  if (currentIndex.value < props.questions.length - 1) {
    currentIndex.value++;
    selectedOptionIndex.value = null;
    feedback.value = null;
    isCorrect.value = null;
  } else {
    emit('close');
  }
}

function prevQuestion() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    selectedOptionIndex.value = null;
    feedback.value = null;
    isCorrect.value = null;
  }
}
</script>

<template>
  <div v-if="props.show" class="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl space-y-6 relative border border-slate-100" @click.stop>
      <!-- Header -->
      <div class="flex justify-between items-center border-b pb-4">
        <div>
          <span class="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase tracking-wider">Modo Reforço</span>
          <h2 class="text-2xl font-bold text-slate-800 mt-1">{{ props.title }}</h2>
        </div>
        <button @click="emit('close')" class="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition">
          <span class="material-icons">close</span>
        </button>
      </div>

      <!-- Question Counter & Score -->
      <div class="flex justify-between items-center text-sm font-semibold text-slate-500">
        <span>Questão {{ currentIndex + 1 }} de {{ props.questions.length }}</span>
        <span class="text-green-600">Acertos: {{ score }} / {{ props.questions.length }}</span>
      </div>

      <!-- Question Body -->
      <div v-if="currentQuestion" class="space-y-4">
        <h4 v-if="currentQuestion.title" class="text-lg font-semibold text-indigo-700">{{ currentQuestion.title }}</h4>
        <p class="text-slate-700 text-base leading-relaxed">{{ currentQuestion.content }}</p>

        <!-- Options -->
        <div class="space-y-3 pt-2">
          <button
            v-for="(option, idx) in currentQuestion.options"
            :key="idx"
            type="button"
            @click="handleSelectOption(idx)"
            :disabled="answeredQuestions.has(currentIndex)"
            :class="[
              'w-full text-left p-4 rounded-xl border-2 transition-all flex items-start justify-between font-medium',
              selectedOptionIndex === idx
                ? isCorrect
                  ? 'border-green-500 bg-green-50 text-green-800 shadow-md'
                  : 'border-rose-500 bg-rose-50 text-rose-800'
                : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700'
            ]"
          >
            <span>{{ option.text }}</span>
            <span v-if="selectedOptionIndex === idx" class="material-icons text-xl ml-2">
              {{ isCorrect ? 'check_circle' : 'cancel' }}
            </span>
          </button>
        </div>

        <!-- Feedback Banner -->
        <div
          v-if="feedback"
          :class="[
            'p-4 rounded-xl text-sm font-medium transition-all shadow-sm',
            isCorrect ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
          ]"
        >
          {{ feedback }}
        </div>
      </div>

      <!-- Footer Navigation -->
      <div class="flex justify-between items-center pt-4 border-t">
        <button
          @click="prevQuestion"
          :disabled="currentIndex === 0"
          class="px-4 py-2 border rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          @click="nextQuestion"
          class="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-md"
        >
          {{ currentIndex === props.questions.length - 1 ? 'Finalizar' : 'Próxima' }}
        </button>
      </div>
    </div>
  </div>
</template>
