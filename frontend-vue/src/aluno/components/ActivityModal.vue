<script setup lang="ts">
import { ref, watch } from 'vue';
import { apiClient } from '@/shared/api/client';
import type { Atividade, Question } from '@/shared/types';

const props = defineProps<{
  show: boolean;
  atividade: Atividade | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: { nome: string; email: string; respostas: string }): void;
}>();

const alunoNome = ref('');
const alunoEmail = ref('');
const respostaText = ref('');
const questionsList = ref<Question[]>([]);
const isSubmitting = ref(false);
const submitSuccess = ref(false);
const errorMessage = ref('');

watch(
  () => props.show,
  (val) => {
    if (val && props.atividade) {
      submitSuccess.value = false;
      errorMessage.value = '';
      alunoNome.value = localStorage.getItem('alunoNome') || '';
      alunoEmail.value = localStorage.getItem('alunoEmail') || '';
      respostaText.value = localStorage.getItem(`draft_${props.atividade.id}`) || '';

      if (props.atividade.json_data) {
        try {
          const parsed = typeof props.atividade.json_data === 'string'
            ? JSON.parse(props.atividade.json_data)
            : props.atividade.json_data;
          questionsList.value = parsed.questions || [];
        } catch {
          questionsList.value = [];
        }
      } else {
        questionsList.value = [];
      }
    }
  }
);

function handleSaveDraft() {
  if (props.atividade) {
    localStorage.setItem(`draft_${props.atividade.id}`, respostaText.value);
    localStorage.setItem('alunoNome', alunoNome.value);
    localStorage.setItem('alunoEmail', alunoEmail.value);
  }
}

async function handleSubmit() {
  if (!props.atividade || isSubmitting.value) return;
  isSubmitting.value = true;
  errorMessage.value = '';

  handleSaveDraft();

  const res = await apiClient.post('/submeter-resposta', {
    atividade_id: props.atividade.id,
    aluno_nome: alunoNome.value,
    aluno_email: alunoEmail.value,
    respostas: respostaText.value
  });

  isSubmitting.value = false;

  if (res.success) {
    submitSuccess.value = true;
    localStorage.removeItem(`draft_${props.atividade.id}`);
    emit('submit', {
      nome: alunoNome.value,
      email: alunoEmail.value,
      respostas: respostaText.value
    });
    setTimeout(() => {
      emit('close');
    }, 2000);
  } else {
    errorMessage.value = res.error || 'Erro ao enviar resposta. Tente novamente.';
  }
}
</script>

<template>
  <div v-if="props.show && props.atividade" class="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 relative border border-slate-100" @click.stop>
      <button @click="emit('close')" class="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition">
        <span class="material-icons">close</span>
      </button>

      <div>
        <span class="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full uppercase tracking-wider">Atividade</span>
        <h2 class="text-2xl font-bold text-slate-800 mt-2">{{ props.atividade.titulo }}</h2>
        <p class="text-slate-600 text-sm mt-1">{{ props.atividade.descricao }}</p>
      </div>

      <!-- Feedback de sucesso -->
      <div v-if="submitSuccess" class="p-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-center space-y-2">
        <span class="material-icons text-4xl text-emerald-600">check_circle</span>
        <h3 class="text-lg font-bold">Resposta Enviada com Sucesso!</h3>
        <p class="text-sm">Sua resposta foi salva no sistema e está disponível para correção do professor.</p>
      </div>

      <div v-else class="space-y-6">
        <!-- Questions content -->
        <div v-if="questionsList.length > 0" class="space-y-4 border-t border-b py-4 my-2">
          <h3 class="text-lg font-semibold text-slate-800">Perguntas da Atividade</h3>
          <div v-for="(q, idx) in questionsList" :key="idx" class="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p class="font-bold text-slate-700">{{ idx + 1 }}. {{ q.title || 'Questão' }}</p>
            <p class="text-slate-600 text-sm mt-1">{{ q.content }}</p>
          </div>
        </div>

        <!-- Student Answers Form -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="aluno-nome" class="block text-sm font-medium text-slate-700 mb-1">Seu Nome *</label>
              <input id="aluno-nome" v-model="alunoNome" @input="handleSaveDraft" required type="text" placeholder="Nome Completo" class="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label for="aluno-email" class="block text-sm font-medium text-slate-700 mb-1">Seu E-mail *</label>
              <input id="aluno-email" v-model="alunoEmail" @input="handleSaveDraft" required type="email" placeholder="seu.email@exemplo.com" class="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <label for="aluno-respostas" class="block text-sm font-medium text-slate-700 mb-1">Suas Respostas *</label>
            <textarea id="aluno-respostas" v-model="respostaText" @input="handleSaveDraft" required rows="5" placeholder="Escreva aqui suas respostas..." class="w-full p-4 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-sm"></textarea>
            <p class="text-xs text-slate-400 mt-1">Seu rascunho é salvo automaticamente no navegador.</p>
          </div>

          <!-- Mensagem de erro -->
          <div v-if="errorMessage" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl">
            {{ errorMessage }}
          </div>

          <!-- Aviso de Transparência LGPD -->
          <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start space-x-2">
            <span class="material-icons text-sm text-indigo-500 mt-0.5">lock</span>
            <div>
              <strong>Aviso de Privacidade (LGPD):</strong> Seus dados de identificação (nome e e-mail) e suas respostas serão armazenados no sistema com a finalidade exclusiva de registro e avaliação pelo professor.
            </div>
          </div>

          <div class="flex justify-end space-x-3 pt-4 border-t">
            <button @click="emit('close')" type="button" class="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium">Cancelar</button>
            <button type="submit" :disabled="isSubmitting" class="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-md transition disabled:opacity-50">
              {{ isSubmitting ? 'Enviando...' : 'Enviar Resposta' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
