<script setup lang="ts">
import { ref, onUnmounted, watch, computed } from 'vue';
import type { Question, Option } from '@/types';

const props = defineProps<{
  show: boolean;
  questions: Question[];
  title: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'complete'): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const gameState = ref<'start' | 'playing' | 'question' | 'gameover' | 'victory'>('start');

const score = ref(0);
const currentQuestionIndex = ref(0);
const selectedOption = ref<Option | null>(null);
const isAnswerSubmitted = ref(false);

const playerX = ref(300);
const enemyY = ref(50);
let animFrame: number | null = null;

const currentQuestion = computed(() => {
  if (props.questions.length === 0) return null;
  return props.questions[currentQuestionIndex.value % props.questions.length];
});

watch(
  () => props.show,
  (val) => {
    if (val) {
      score.value = 0;
      currentQuestionIndex.value = 0;
      gameState.value = 'start';
    } else {
      stopEngine();
    }
  }
);

function startGame() {
  gameState.value = 'playing';
  setTimeout(initCanvasEngine, 100);
}

function initCanvasEngine() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = canvas.parentElement?.clientWidth || 700;
  canvas.height = 420;

  playerX.value = canvas.width / 2;
  enemyY.value = 50;

  function loop() {
    if (gameState.value !== 'playing') return;
    const cvs = canvasRef.value;
    if (!cvs) return;
    const c = cvs.getContext('2d');
    if (!c) return;

    c.clearRect(0, 0, cvs.width, cvs.height);

    // Dark Space Background
    c.fillStyle = '#050515';
    c.fillRect(0, 0, cvs.width, cvs.height);

    // Stars
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 30; i++) {
      const sx = (i * 37) % cvs.width;
      const sy = (i * 23 + Date.now() * 0.05) % cvs.height;
      c.fillRect(sx, sy, 2, 2);
    }

    // Player Ship (Cyan Triangle)
    c.fillStyle = '#00d4ff';
    c.beginPath();
    c.moveTo(playerX.value, cvs.height - 50);
    c.lineTo(playerX.value - 20, cvs.height - 20);
    c.lineTo(playerX.value + 20, cvs.height - 20);
    c.closePath();
    c.fill();

    // Enemy Target (Red Hexagon)
    c.fillStyle = '#f43f5e';
    c.beginPath();
    c.arc(cvs.width / 2, enemyY.value, 25, 0, Math.PI * 2);
    c.fill();

    // Text HUD
    c.fillStyle = '#38bdf8';
    c.font = '16px Monospace';
    c.fillText(`ALVO DE INVASÃO DETECTADO - FASE ${currentQuestionIndex.value + 1}`, 30, 35);

    // Slowly move enemy downwards until trigger question
    enemyY.value += 0.4;

    if (enemyY.value > 180) {
      // Trigger question pop-up!
      gameState.value = 'question';
      selectedOption.value = null;
      isAnswerSubmitted.value = false;
      return;
    }

    animFrame = requestAnimationFrame(loop);
  }

  loop();
}

function handleSelectOption(opt: Option) {
  if (isAnswerSubmitted.value) return;
  selectedOption.value = opt;
}

function handleConfirmAnswer() {
  if (!selectedOption.value) return;
  isAnswerSubmitted.value = true;

  if (selectedOption.value.correct) {
    score.value += 100;
  }
}

function handleContinueQuestion() {
  if (selectedOption.value?.correct) {
    currentQuestionIndex.value++;
    if (currentQuestionIndex.value >= props.questions.length) {
      gameState.value = 'victory';
      emit('complete');
    } else {
      gameState.value = 'playing';
      enemyY.value = 50;
      setTimeout(initCanvasEngine, 100);
    }
  } else {
    gameState.value = 'gameover';
  }
}

function stopEngine() {
  if (animFrame) {
    cancelAnimationFrame(animFrame);
    animFrame = null;
  }
}

onUnmounted(() => {
  stopEngine();
});
</script>

<template>
  <div v-if="props.show" class="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
    <div class="bg-slate-900 rounded-3xl p-6 max-w-4xl w-full shadow-2xl space-y-4 relative border border-slate-800 text-white font-mono" @click.stop>
      <!-- Header -->
      <div class="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <span class="px-3 py-1 bg-cyan-900/60 text-cyan-300 text-xs font-bold rounded-full uppercase tracking-wider">Simulação Tática</span>
          <h2 class="text-xl font-bold text-slate-100 mt-1">{{ props.title }}</h2>
        </div>
        <div class="flex items-center space-x-4">
          <div class="text-sm font-bold text-cyan-400">PONTOS: {{ score }}</div>
          <button @click="emit('close')" class="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition">
            <span class="material-icons">close</span>
          </button>
        </div>
      </div>

      <!-- Start Screen View -->
      <div v-if="gameState === 'start'" class="py-16 text-center space-y-8 bg-slate-950 rounded-2xl border border-slate-800">
        <div class="space-y-2">
          <h3 class="text-cyan-400 text-sm tracking-widest uppercase">MÓDULO INTERATIVO</h3>
          <h2 class="text-3xl font-bold text-white">{{ props.title }}</h2>
          <p class="text-slate-400 text-xs font-sans">Elimine alvos lógicos respondendo corretamente às questões de inteligência.</p>
        </div>

        <button @click="startGame" class="px-10 py-4 bg-transparent border-2 border-cyan-400 text-cyan-400 text-lg font-bold rounded-2xl hover:bg-cyan-400 hover:text-slate-950 transition shadow-lg shadow-cyan-500/20">
          INICIAR SISTEMA TÁTICO
        </button>
      </div>

      <!-- Game Canvas View -->
      <div v-show="gameState === 'playing'" class="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
        <canvas ref="canvasRef" class="w-full h-[400px] block"></canvas>
      </div>

      <!-- Question Pop-up Modal -->
      <div v-if="gameState === 'question' && currentQuestion" class="py-6 space-y-6 bg-slate-950 p-6 rounded-2xl border border-cyan-900/50">
        <div class="border-b border-slate-800 pb-3 flex justify-between items-center">
          <span class="text-xs font-bold text-cyan-400 uppercase tracking-wider">QUESTÃO {{ currentQuestionIndex + 1 }} DE {{ props.questions.length }}</span>
          <span class="text-xs text-slate-500 font-sans">Escolha a alternativa correta</span>
        </div>

        <div class="text-lg font-bold text-white font-sans">
          {{ currentQuestion.content }}
        </div>

        <!-- Options list -->
        <div class="space-y-3 font-sans">
          <button
            v-for="(opt, idx) in currentQuestion.options"
            :key="idx"
            @click="handleSelectOption(opt)"
            :disabled="isAnswerSubmitted"
            :class="[
              'w-full text-left p-4 rounded-xl border transition flex justify-between items-center',
              selectedOption === opt
                ? isAnswerSubmitted
                  ? opt.correct
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                    : 'border-rose-500 bg-rose-950/40 text-rose-300'
                  : 'border-cyan-400 bg-cyan-950/40 text-white'
                : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
            ]"
          >
            <span>{{ opt.text }}</span>
            <span class="material-icons text-sm">
              {{ selectedOption === opt ? (isAnswerSubmitted ? (opt.correct ? 'check_circle' : 'cancel') : 'radio_button_checked') : 'radio_button_unchecked' }}
            </span>
          </button>
        </div>

        <div class="flex justify-end pt-4 border-t border-slate-800 font-sans">
          <button
            v-if="!isAnswerSubmitted"
            @click="handleConfirmAnswer"
            :disabled="!selectedOption"
            class="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold rounded-xl text-sm transition"
          >
            Disparar Resposta
          </button>
          <button
            v-else
            @click="handleContinueQuestion"
            class="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition"
          >
            {{ selectedOption?.correct ? 'Próxima Fase' : 'Ver Resultado' }}
          </button>
        </div>
      </div>

      <!-- Game Over View -->
      <div v-if="gameState === 'gameover'" class="py-12 text-center space-y-6 bg-slate-950 rounded-2xl border border-rose-900/50">
        <h2 class="text-4xl font-bold text-rose-500 tracking-wider">FALHA LÓGICA FATAL</h2>
        <p class="text-slate-400 text-sm font-sans">Sua resposta incorreta comprometeu o sistema tático.</p>
        <button @click="startGame" class="px-8 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition">
          REINICIAR SIMULAÇÃO
        </button>
      </div>

      <!-- Victory View -->
      <div v-if="gameState === 'victory'" class="py-12 text-center space-y-6 bg-slate-950 rounded-2xl border border-emerald-900/50">
        <h2 class="text-4xl font-bold text-emerald-400 tracking-wider">MISSÃO CUMPRIDA</h2>
        <p class="text-slate-400 text-sm font-sans">Você respondeu todas as perguntas táticas com sucesso!</p>
        <div class="text-2xl font-bold text-white">PONTUAÇÃO FINAL: {{ score }}</div>
        <button @click="emit('close')" class="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition">
          ENCERRAR SESSÃO
        </button>
      </div>
    </div>
  </div>
</template>
