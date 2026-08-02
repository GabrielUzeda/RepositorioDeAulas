<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Atividade, Question } from '@/types';

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

watch(
  () => props.show,
  (val) => {
    if (val && props.atividade) {
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

function handleSubmit() {
  handleSaveDraft();
  emit('submit', {
    nome: alunoNome.value,
    email: alunoEmail.value,
    respostas: respostaText.value
  });
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
            <label class="block text-sm font-medium text-slate-700 mb-1">Seu Nome *</label>
            <input v-model="alunoNome" @input="handleSaveDraft" required type="text" placeholder="Nome Completo" class="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Seu E-mail *</label>
            <input v-model="alunoEmail" @input="handleSaveDraft" required type="email" placeholder="seu.email@exemplo.com" class="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Suas Respostas *</label>
          <textarea v-model="respostaText" @input="handleSaveDraft" required rows="5" placeholder="Escreva aqui suas respostas..." class="w-full p-4 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-sm"></textarea>
          <p class="text-xs text-slate-400 mt-1">Seu rascunho é salvo automaticamente no navegador.</p>
        </div>

        <div class="flex justify-end space-x-3 pt-4 border-t">
          <button @click="emit('close')" type="button" class="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium">Cancelar</button>
          <button type="submit" class="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-md">Enviar Resposta</button>
        </div>
      </form>
    </div>
  </div>
</template>
