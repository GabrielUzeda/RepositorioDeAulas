<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Question } from '@/types';

const props = defineProps<{
  show: boolean;
  questions: Question[];
  title: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const isSpinning = ref(false);
const activeQuestion = ref<Question | null>(null);
const score = ref(0);
const remainingCount = ref(0);

watch(
  () => props.show,
  (val) => {
    if (val) {
      score.value = 0;
      remainingCount.value = props.questions.length;
      activeQuestion.value = null;
      isSpinning.value = false;
    }
  }
);

function spin() {
  if (isSpinning.value || props.questions.length === 0) return;
  isSpinning.value = true;
  activeQuestion.value = null;

  setTimeout(() => {
    const randomIdx = Math.floor(Math.random() * props.questions.length);
    activeQuestion.value = props.questions[randomIdx];
    isSpinning.value = false;
  }, 1200);
}

function handleAnswer(isCorrect: boolean) {
  if (isCorrect) score.value++;
  if (remainingCount.value > 0) remainingCount.value--;
  activeQuestion.value = null;
}
</script>

<template>
  <div v-if="props.show" class="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl space-y-6 relative border border-slate-100 text-center" @click.stop>
      <button @click="emit('close')" class="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition">
        <span class="material-icons">close</span>
      </button>

      <div>
        <span class="px-3 py-1 bg-pink-100 text-pink-700 text-xs font-bold rounded-full uppercase tracking-wider">Roleta do Conhecimento</span>
        <h2 class="text-2xl font-bold text-slate-800 mt-2">{{ props.title }}</h2>
      </div>

      <!-- Stats Bar -->
      <div class="flex justify-center space-x-6 text-sm font-semibold text-slate-600 bg-slate-50 py-3 rounded-2xl border border-slate-100">
        <div>Acertos: <span class="text-green-600 font-bold">{{ score }}</span></div>
        <div>Restantes: <span class="text-slate-700 font-bold">{{ remainingCount }}</span></div>
      </div>

      <!-- Wheel / Spin Action -->
      <div class="py-6 flex flex-col items-center justify-center">
        <div
          :class="[
            'w-32 h-32 rounded-full border-4 border-pink-500 flex items-center justify-center shadow-lg transition-transform duration-1000 bg-gradient-to-br from-pink-400 to-purple-600 text-white',
            isSpinning ? 'animate-spin scale-110' : ''
          ]"
        >
          <span class="material-icons text-5xl">casino</span>
        </div>
        <button
          @click="spin"
          :disabled="isSpinning"
          class="mt-6 px-8 py-3 bg-pink-600 text-white font-bold text-lg rounded-2xl hover:bg-pink-700 shadow-xl transition-transform active:scale-95 disabled:opacity-50"
        >
          {{ isSpinning ? 'Girando...' : 'Girar Roleta' }}
        </button>
      </div>

      <!-- Active Question -->
      <div v-if="activeQuestion" class="bg-pink-50 p-6 rounded-2xl border border-pink-200 text-left space-y-4 animate-fade-in">
        <h4 class="text-lg font-bold text-pink-800">{{ activeQuestion.title || 'Pergunta Sortada' }}</h4>
        <p class="text-slate-800 font-medium">{{ activeQuestion.content }}</p>
        <div class="flex space-x-3 pt-2">
          <button @click="handleAnswer(true)" class="flex-1 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-md">Acertou (+1)</button>
          <button @click="handleAnswer(false)" class="flex-1 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 shadow-md">Errou</button>
        </div>
      </div>
    </div>
  </div>
</template>
