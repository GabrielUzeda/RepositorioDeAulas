<script setup lang="ts">
import { ref, watch } from 'vue';
import { apiClient } from '@/shared/api/client';
import { secureGet, secureSet, secureRemove } from '@/shared/utils/storage';
import type { Atividade, Question } from '@/shared/types';

const props = withDefaults(defineProps<{
  show: boolean;
  atividade: Atividade | null;
  senhaCurso?: string;
  senhaAtividade?: string;
}>(), {
  senhaCurso: '',
  senhaAtividade: '',
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: { nome: string; email: string; respostas: Record<string, string> }): void;
}>();

const alunoNome = ref('');
const alunoEmail = ref('');
const respostasMap = ref<Record<string, string>>({});
const questionsList = ref<Question[]>([]);
const isSubmitting = ref(false);
const submitSuccess = ref(false);
const errorMessage = ref('');
const serverAcertos = ref<number | null>(null);
const serverTotal = ref<number | null>(null);
const serverPontuacao = ref<number | null>(null);

watch(
  () => props.show,
  (val) => {
    if (val && props.atividade) {
      submitSuccess.value = false;
      errorMessage.value = '';
      serverAcertos.value = null;
      serverTotal.value = null;
      serverPontuacao.value = null;
      respostasMap.value = {};

      Promise.all([
        secureGet('alunoNome'),
        secureGet('alunoEmail'),
        secureGet(`draft_${props.atividade.id}`),
      ]).then(([nome, email, draft]) => {
        alunoNome.value = nome || '';
        alunoEmail.value = email || '';
        if (draft) {
          try {
            respostasMap.value = JSON.parse(draft);
          } catch {
            respostasMap.value = { "0": draft };
          }
        }
      });

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

function getQuestionKey(q: Question, idx: number): string {
  return q.id !== undefined ? String(q.id) : String(idx);
}

function handleSaveDraft() {
  if (props.atividade) {
    secureSet(`draft_${props.atividade.id}`, JSON.stringify(respostasMap.value));
    secureSet('alunoNome', alunoNome.value);
    secureSet('alunoEmail', alunoEmail.value);
  }
}

function selectOption(key: string, optionText: string) {
  respostasMap.value[key] = optionText;
  handleSaveDraft();
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
    respostas: respostasMap.value,
    senha_curso: props.senhaCurso,
    senha_atividade: props.senhaAtividade
  });

  isSubmitting.value = false;

  if (res.success) {
    submitSuccess.value = true;
    secureRemove(`draft_${props.atividade.id}`);
    if (res.data && res.data.consulta_token) {
      secureSet(`consulta_token_${props.atividade.id}`, String(res.data.consulta_token));
    }
    if (res.data && res.data.acertos !== undefined) serverAcertos.value = res.data.acertos;
    if (res.data && res.data.total !== undefined) serverTotal.value = res.data.total;
    if (res.data && res.data.pontuacao !== undefined) serverPontuacao.value = res.data.pontuacao;
    emit('submit', {
      nome: alunoNome.value,
      email: alunoEmail.value,
      respostas: respostasMap.value
    });
    setTimeout(() => {
      emit('close');
    }, serverAcertos.value !== null ? 6000 : 2000);
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
        <div v-if="serverAcertos !== null" class="pt-1">
          <p class="text-sm font-semibold">Correção do servidor: {{ serverAcertos }} / {{ serverTotal ?? questionsList.length }} acertos</p>
          <p v-if="serverPontuacao !== null" class="text-sm">Pontuação: {{ serverPontuacao }}%</p>
        </div>
      </div>

      <div v-else class="space-y-6">
        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- Identificação do Aluno -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b">
            <div>
              <label for="aluno-nome" class="block text-sm font-medium text-slate-700 mb-1">Seu Nome *</label>
              <input id="aluno-nome" v-model="alunoNome" @input="handleSaveDraft" required type="text" placeholder="Nome Completo" class="w-full px-4 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400" />
            </div>
            <div>
              <label for="aluno-email" class="block text-sm font-medium text-slate-700 mb-1">Seu E-mail *</label>
              <input id="aluno-email" v-model="alunoEmail" @input="handleSaveDraft" required type="email" placeholder="seu.email@exemplo.com" class="w-full px-4 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400" />
            </div>
          </div>

          <!-- Perguntas com Respostas Individuais -->
          <div v-if="questionsList.length > 0" class="space-y-6">
            <h3 class="text-lg font-semibold text-slate-800">Perguntas da Atividade</h3>
            <div v-for="(q, idx) in questionsList" :key="idx" class="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <p class="font-bold text-slate-800 text-sm sm:text-base">{{ idx + 1 }}. {{ q.title || q.content }}</p>
              <p v-if="q.title && q.content" class="text-slate-600 text-sm">{{ q.content }}</p>

              <!-- Questão Objetiva: Opções/Alternativas -->
              <div v-if="q.options && q.options.length > 0" class="space-y-2 pt-1">
                <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Selecione uma alternativa:</label>
                <div class="grid grid-cols-1 gap-2">
                  <button
                    v-for="(opt, optIdx) in q.options"
                    :key="optIdx"
                    type="button"
                    @click="selectOption(getQuestionKey(q, idx), opt.text)"
                    :class="[
                      'w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all flex items-center justify-between',
                      respostasMap[getQuestionKey(q, idx)] === opt.text
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-semibold ring-1 ring-indigo-500'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    ]"
                  >
                    <span>{{ opt.text }}</span>
                    <span v-if="respostasMap[getQuestionKey(q, idx)] === opt.text" class="material-icons text-indigo-600 text-base">check_circle</span>
                    <span v-else class="material-icons text-slate-300 text-base">radio_button_unchecked</span>
                  </button>
                </div>
              </div>

              <!-- Questão Discursiva: Textarea Individual -->
              <div v-else class="pt-1">
                <label :for="`resposta-q-${idx}`" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Sua resposta:</label>
                <textarea
                  :id="`resposta-q-${idx}`"
                  v-model="respostasMap[getQuestionKey(q, idx)]"
                  @input="handleSaveDraft"
                  rows="3"
                  placeholder="Escreva sua resposta para esta pergunta..."
                  class="w-full p-3.5 bg-white text-slate-900 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-sm placeholder:text-slate-400"
                ></textarea>
              </div>
            </div>
          </div>

          <!-- Mensagem de erro -->
          <div v-if="errorMessage" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl">
            {{ errorMessage }}
          </div>

          <!-- Aviso de Transparência LGPD & ECA Digital -->
          <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start space-x-2">
            <span class="material-icons text-sm text-indigo-500 mt-0.5">verified_user</span>
            <div>
              <strong>Aviso de Privacidade (LGPD & ECA Digital - Lei 15.211/2025):</strong> Coletamos apenas seu nome e e-mail com a finalidade exclusiva de registro e acompanhamento pedagógico pelo professor. Não realizamos perfilamento, nem compartilhamos dados com terceiros ou para fins comerciais.
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
