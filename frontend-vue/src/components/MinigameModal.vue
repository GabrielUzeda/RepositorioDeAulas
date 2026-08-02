<script setup lang="ts">
import { ref, onUnmounted, watch } from 'vue';
import type { Question } from '@/types';

const props = defineProps<{
  show: boolean;
  questions: Question[];
  title: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const score = ref(0);

let animId: number | null = null;

watch(
  () => props.show,
  (val) => {
    if (val) {
      score.value = 0;
      setTimeout(initGame, 100);
    } else {
      stopGame();
    }
  }
);

function initGame() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = canvas.parentElement?.clientWidth || 600;
  canvas.height = 400;

  function loop() {
    const cvs = canvasRef.value;
    if (!cvs) return;
    const context = cvs.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, cvs.width, cvs.height);
    context.fillStyle = '#0f172a';
    context.fillRect(0, 0, cvs.width, cvs.height);

    context.fillStyle = '#38bdf8';
    context.font = '20px Inter, sans-serif';
    context.fillText('Simulador Tático - Canvas Ativo', 40, 60);

    context.fillStyle = '#94a3b8';
    context.font = '14px Inter, sans-serif';
    context.fillText(`Perguntas preparadas: ${props.questions.length}`, 40, 100);

    animId = requestAnimationFrame(loop);
  }
  loop();
}

function stopGame() {
  if (animId) {
    cancelAnimationFrame(animId);
    animId = null;
  }
}

onUnmounted(() => {
  stopGame();
});
</script>

<template>
  <div v-if="props.show" class="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
    <div class="bg-slate-900 rounded-3xl p-6 max-w-3xl w-full shadow-2xl space-y-4 relative border border-slate-800 text-white" @click.stop>
      <div class="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <span class="px-3 py-1 bg-purple-900/60 text-purple-300 text-xs font-bold rounded-full uppercase tracking-wider">Minigame Tático</span>
          <h2 class="text-xl font-bold text-slate-100 mt-1">{{ props.title }}</h2>
        </div>
        <button @click="emit('close')" class="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition">
          <span class="material-icons">close</span>
        </button>
      </div>

      <div class="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
        <canvas ref="canvasRef" class="w-full h-[400px] block"></canvas>
      </div>

      <div class="flex justify-between items-center text-sm font-semibold text-slate-400">
        <span>Pontuação: <b class="text-purple-400">{{ score }}</b></span>
        <button @click="emit('close')" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold">Encerrar Sessão</button>
      </div>
    </div>
  </div>
</template>
