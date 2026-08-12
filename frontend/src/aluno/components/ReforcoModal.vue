<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { apiClient } from '@/shared/api/client';
import { secureGet, secureSet } from '@/shared/utils/storage';
import type { Question, Atividade } from '@/shared/types';

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
}>();

const currentIndex = ref(0);
const selectedOptionIndex = ref<number | null>(null);
const answeredQuestions = ref<Set<number>>(new Set());
const answers = ref<Record<number, number>>({});
const isSubmitting = ref(false);
const isSubmitted = ref(false);
const errorMessage = ref('');
const resultAcertos = ref<number | null>(null);
const resultTotal = ref<number | null>(null);
const resultPontuacao = ref<number | null>(null);

watch(
  () => props.show,
  (val) => {
    if (val) {
      currentIndex.value = 0;
      selectedOptionIndex.value = null;
      answeredQuestions.value = new Set();
      answers.value = {};
      isSubmitting.value = false;
      isSubmitted.value = false;
      errorMessage.value = '';
      resultAcertos.value = null;
      resultTotal.value = null;
      resultPontuacao.value = null;
    }
  }
);

const currentQuestion = computed(() => {
  return props.questions[currentIndex.value] || null;
});

const currentAnswered = computed(() => answeredQuestions.value.has(currentIndex.value));
const allAnswered = computed(() => answeredQuestions.value.size >= props.questions.length);
const selectedFeedback = computed(() => {
  if (selectedOptionIndex.value === null || !currentQuestion.value) return null;
  return currentQuestion.value.options?.[selectedOptionIndex.value]?.feedback || null;
});

function handleSelectOption(optionIndex: number) {
  if (answeredQuestions.value.has(currentIndex.value) || !currentQuestion.value) return;

  selectedOptionIndex.value = optionIndex;
  answers.value[currentIndex.value] = optionIndex;
  answeredQuestions.value.add(currentIndex.value);
}

async function submitAnswers() {
  if (isSubmitting.value) return;
  if (!props.atividade) {
    emit('close');
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
    isSubmitted.value = true;
    if (res.data && res.data.consulta_token) {
      secureSet(`consulta_token_${props.atividade.id}`, String(res.data.consulta_token));
    }
    if (res.data && res.data.acertos !== undefined) resultAcertos.value = res.data.acertos;
    if (res.data && res.data.total !== undefined) resultTotal.value = res.data.total;
    if (res.data && res.data.pontuacao !== undefined) resultPontuacao.value = res.data.pontuacao;
  } else {
    errorMessage.value = res.error || 'Erro ao registrar respostas.';
  }
}

function closeAfterSubmit() {
  emit('close');
}

function nextQuestion() {
  if (currentIndex.value === props.questions.length - 1) {
    if (allAnswered.value) submitAnswers();
  } else {
    currentIndex.value++;
    selectedOptionIndex.value = answers.value[currentIndex.value] ?? null;
  }
}

function prevQuestion() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    selectedOptionIndex.value = answers.value[currentIndex.value] ?? null;
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

      <!-- Question Counter -->
      <div class="flex justify-between items-center text-sm font-semibold text-slate-500">
        <span>Questão {{ currentIndex + 1 }} de {{ props.questions.length }}</span>
        <span class="text-indigo-600">Respondidas: {{ answeredQuestions.size }} / {{ props.questions.length }}</span>
      </div>

      <!-- Submission Status -->
      <div v-if="isSubmitting" class="p-4 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-sm font-medium text-center">
        Enviando respostas para correção do servidor...
      </div>

      <!-- Server Correction Result -->
      <div v-if="isSubmitted" class="p-4 rounded-xl border text-center space-y-1">
        <span class="material-icons text-3xl text-green-600">check_circle</span>
        <p class="text-lg font-bold text-slate-800">Respostas registradas e corrigidas pelo servidor.</p>
        <p v-if="resultAcertos !== null" class="text-sm text-slate-600">
          Acertos: {{ resultAcertos }} / {{ resultTotal ?? props.questions.length }}
        </p>
        <p v-if="resultPontuacao !== null" class="text-sm text-slate-600">
          Pontuação: {{ resultPontuacao }}
        </p>
        <button
          @click="closeAfterSubmit"
          class="mt-3 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-md"
        >
          Fechar
        </button>
      </div>

      <!-- Error -->
      <div v-if="errorMessage && !isSubmitted" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl">
        {{ errorMessage }}
      </div>

      <!-- Question Body -->
      <div v-if="currentQuestion && !isSubmitting && !isSubmitted" class="space-y-4">
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
              'w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between font-medium',
              selectedOptionIndex === idx
                ? 'border-indigo-500 bg-indigo-50 text-indigo-800 shadow-md'
                : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700'
            ]"
          >
            <span>{{ option.text }}</span>
            <span v-if="selectedOptionIndex === idx" class="material-icons text-xl ml-2">radio_button_checked</span>
          </button>
        </div>

        <!-- Feedback da opção selecionada -->
        <div v-if="selectedFeedback" class="p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-xl text-sm text-amber-800 flex items-start space-x-2">
          <span class="material-icons text-base text-amber-500 mt-0.5">info</span>
          <span>{{ selectedFeedback }}</span>
        </div>
      </div>

      <!-- Footer Navigation -->
      <div v-if="!isSubmitting && !isSubmitted" class="flex justify-between items-center pt-4 border-t">
        <button
          @click="prevQuestion"
          :disabled="currentIndex === 0"
          class="px-4 py-2 border rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          @click="nextQuestion"
          :disabled="currentIndex === props.questions.length - 1 ? !allAnswered : !currentAnswered"
          class="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-md disabled:opacity-40"
        >
          {{ currentIndex === props.questions.length - 1 ? 'Finalizar' : 'Próxima' }}
        </button>
      </div>
    </div>
  </div>
</template>