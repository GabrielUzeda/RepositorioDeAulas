<script setup lang="ts">
import { ref, watch } from 'vue';
import { apiClient } from '@/shared/api/client';
import type { DisciplinaFeedbackRelatorio, AlunoFeedbackConsolidado } from '@/shared/types';

const props = defineProps<{
  show: boolean;
  disciplinaId: number | null;
  disciplinaNome?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const isLoading = ref(false);
const feedbackTurma = ref('');
const alunos = ref<AlunoFeedbackConsolidado[]>([]);
const isSendingAll = ref(false);
const sendingEmailFor = ref<string | null>(null);
const actionMessage = ref<{ text: string; type: 'success' | 'error' } | null>(null);

watch(
  () => props.show,
  async (val) => {
    if (val && props.disciplinaId) {
      actionMessage.value = null;
      await fetchRelatorio();
    } else {
      feedbackTurma.value = '';
      alunos.value = [];
      actionMessage.value = null;
    }
  }
);

async function fetchRelatorio() {
  if (!props.disciplinaId) return;
  isLoading.value = true;
  const res = await apiClient.get<DisciplinaFeedbackRelatorio>(`/disciplinas/${props.disciplinaId}/relatorio-feedback`);
  isLoading.value = false;
  if (res.success && res.data) {
    feedbackTurma.value = res.data.feedback_turma || '';
    alunos.value = res.data.alunos || [];
  } else {
    actionMessage.value = { text: res.error || 'Erro ao carregar relatório de feedback.', type: 'error' };
  }
}

async function handleSaveFeedbackTurma() {
  if (!props.disciplinaId) return;
  actionMessage.value = null;
  const res = await apiClient.post(`/disciplinas/${props.disciplinaId}/salvar-feedback-geral`, {
    aluno_email: null,
    feedback_geral: feedbackTurma.value
  });
  if (res.success) {
    actionMessage.value = { text: 'Feedback Geral da Turma salvo com sucesso!', type: 'success' };
  } else {
    actionMessage.value = { text: res.error || 'Erro ao salvar feedback da turma.', type: 'error' };
  }
}

async function handleSaveFeedbackAluno(aluno: AlunoFeedbackConsolidado) {
  if (!props.disciplinaId) return;
  actionMessage.value = null;
  const res = await apiClient.post(`/disciplinas/${props.disciplinaId}/salvar-feedback-geral`, {
    aluno_email: aluno.aluno_email,
    feedback_geral: aluno.feedback_geral
  });
  if (res.success) {
    actionMessage.value = { text: `Feedback para ${aluno.aluno_nome} salvo!`, type: 'success' };
  } else {
    actionMessage.value = { text: res.error || 'Erro ao salvar feedback do aluno.', type: 'error' };
  }
}

async function handleSendEmailIndividual(aluno: AlunoFeedbackConsolidado) {
  if (!props.disciplinaId) return;
  sendingEmailFor.value = aluno.aluno_email;
  actionMessage.value = null;

  // Salva o feedback do aluno antes de enviar
  await handleSaveFeedbackAluno(aluno);

  const res = await apiClient.post<{ enviados: number }>(`/disciplinas/${props.disciplinaId}/enviar-emails-feedback`, {
    aluno_email: aluno.aluno_email,
    forcar_reenvio: true
  });

  sendingEmailFor.value = null;

  if (res.success) {
    aluno.ja_enviado = true;
    actionMessage.value = { text: `E-mail enviado para ${aluno.aluno_email} com sucesso!`, type: 'success' };
  } else {
    actionMessage.value = { text: res.error || 'Erro ao enviar e-mail.', type: 'error' };
  }
}

async function handleSendEmailTodos() {
  if (!props.disciplinaId || isSendingAll.value) return;
  
  // Salva feedback da turma antes de disparar
  await handleSaveFeedbackTurma();

  const pendentes = alunos.value.filter(a => !a.ja_enviado);
  if (pendentes.length === 0) {
    if (!confirm('Todos os alunos já receberam o e-mail de feedback. Deseja reenviar para todos novamente?')) {
      return;
    }
  }

  isSendingAll.value = true;
  actionMessage.value = null;

  const res = await apiClient.post<{ enviados: number }>(`/disciplinas/${props.disciplinaId}/enviar-emails-feedback`, {
    forcar_reenvio: pendentes.length === 0
  });

  isSendingAll.value = false;

  if (res.success) {
    actionMessage.value = { text: `${res.data?.enviados || 0} e-mails de feedback enviados com sucesso!`, type: 'success' };
    await fetchRelatorio();
  } else {
    actionMessage.value = { text: res.error || 'Erro ao enviar e-mails.', type: 'error' };
  }
}

function formatDate(isoStr: string) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('pt-BR');
  } catch {
    return isoStr;
  }
}
</script>

<template>
  <div v-if="props.show && props.disciplinaId" class="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl p-6 sm:p-8 max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl relative border border-slate-100" @click.stop>
      <!-- Header -->
      <div class="flex justify-between items-start border-b pb-4">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
            <span class="material-icons text-xl">mark_email_read</span>
          </div>
          <div>
            <h2 class="text-2xl font-bold text-slate-800">Relatório de Feedback da Disciplina</h2>
            <p class="text-slate-500 text-xs mt-0.5">{{ props.disciplinaNome }} • Consolidação e Envio de Avaliações</p>
          </div>
        </div>
        <button @click="emit('close')" class="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition">
          <span class="material-icons">close</span>
        </button>
      </div>

      <!-- Action Notification Alert -->
      <div v-if="actionMessage" :class="['mt-4 p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between', actionMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200']">
        <span class="flex items-center space-x-2">
          <span class="material-icons text-sm">{{ actionMessage.type === 'success' ? 'check_circle' : 'error' }}</span>
          <span>{{ actionMessage.text }}</span>
        </span>
        <button @click="actionMessage = null" class="text-slate-400 hover:text-slate-600"><span class="material-icons text-sm">close</span></button>
      </div>

      <!-- Main Body -->
      <div class="flex-1 overflow-y-auto py-4 space-y-6">
        <div v-if="isLoading" class="text-center py-12 text-slate-500">
          <span class="material-icons animate-spin text-3xl">sync</span>
          <p class="mt-2 text-sm">Carregando relatório consolidado...</p>
        </div>

        <div v-else-if="alunos.length === 0" class="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 text-slate-500">
          <span class="material-icons text-4xl text-slate-300">inbox</span>
          <p class="mt-2 text-sm">Nenhuma resposta enviada por alunos nesta disciplina ainda.</p>
        </div>

        <div v-else class="space-y-6">
          <!-- 1. Feedback Geral da Turma -->
          <div class="p-5 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-3">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center space-x-1.5">
                <span class="material-icons text-sm text-indigo-600">campaign</span>
                <span>Feedback Geral da Turma (Recado Coletivo)</span>
              </label>
              <button
                @click="handleSaveFeedbackTurma"
                class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-sm"
              >
                <span class="material-icons text-xs">save</span>
                <span>Salvar Feedback da Turma</span>
              </button>
            </div>
            <textarea
              v-model="feedbackTurma"
              rows="3"
              placeholder="Digite um comunicado ou feedback geral para toda a turma nesta disciplina (será incluído no e-mail de todos os alunos)..."
              class="w-full p-3 bg-white border border-indigo-200 rounded-xl text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
            ></textarea>
          </div>

          <!-- 2. Lista de Alunos e Avaliações Consolidadas -->
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider">
                Alunos com Atividades Submetidas ({{ alunos.length }})
              </h3>
              <span class="text-xs text-slate-500">
                Pendente de envio: <strong class="text-amber-600">{{ alunos.filter(a => !a.ja_enviado).length }}</strong> alunos
              </span>
            </div>

            <div class="space-y-4">
              <div
                v-for="aluno in alunos"
                :key="aluno.aluno_email"
                class="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 hover:border-indigo-200 transition"
              >
                <!-- Cabecalho do Aluno -->
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <h4 class="font-bold text-slate-800 text-base flex items-center space-x-2">
                      <span>{{ aluno.aluno_nome }}</span>
                      <span
                        v-if="aluno.ja_enviado"
                        class="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full flex items-center space-x-1"
                      >
                        <span class="material-icons text-[12px]">check_circle</span>
                        <span>E-mail Enviado</span>
                      </span>
                      <span
                        v-else
                        class="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full flex items-center space-x-1"
                      >
                        <span class="material-icons text-[12px]">schedule</span>
                        <span>E-mail Pendente</span>
                      </span>
                    </h4>
                    <p class="text-slate-500 text-xs mt-0.5">{{ aluno.aluno_email }}</p>
                  </div>

                  <button
                    @click="handleSendEmailIndividual(aluno)"
                    :disabled="sendingEmailFor === aluno.aluno_email"
                    class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 shadow-sm"
                  >
                    <span v-if="sendingEmailFor === aluno.aluno_email" class="material-icons text-xs animate-spin">sync</span>
                    <span v-else class="material-icons text-xs">send</span>
                    <span>Enviar E-mail Individual</span>
                  </button>
                </div>

                <!-- Atividades Respondidas por este aluno -->
                <div class="space-y-2">
                  <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Atividades Enviadas & Notas:</label>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div
                      v-for="atv in aluno.atividades"
                      :key="atv.id"
                      class="p-3 bg-white border border-slate-200 rounded-xl space-y-1 text-xs"
                    >
                      <div class="flex justify-between items-start">
                        <span class="font-bold text-slate-800">{{ atv.atividade_titulo }}</span>
                        <span
                          v-if="atv.nota !== null && atv.nota !== undefined"
                          class="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-bold rounded text-[10px]"
                        >
                          {{ atv.nota }}/100
                        </span>
                        <span v-else class="text-slate-400 text-[10px] italic">Sem nota</span>
                      </div>
                      <p v-if="atv.feedback" class="text-slate-600 text-[11px] italic">"{{ atv.feedback }}"</p>
                      <p v-else class="text-slate-400 text-[10px]">Sem comentários na atividade.</p>
                    </div>
                  </div>
                </div>

                <!-- Feedback Geral do Aluno na Disciplina -->
                <div class="space-y-1.5 pt-1">
                  <div class="flex justify-between items-center">
                    <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">Feedback Individual do Aluno na Disciplina:</label>
                    <button
                      @click="handleSaveFeedbackAluno(aluno)"
                      class="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold"
                    >
                      Salvar Feedback
                    </button>
                  </div>
                  <input
                    v-model="aluno.feedback_geral"
                    type="text"
                    placeholder="Escreva observações pedagógicas gerais para este aluno..."
                    class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer com Ações Globais -->
      <div class="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-slate-100 gap-3">
        <span class="text-xs text-slate-400">Prevenção de duplicatas ativa: o envio em lote ignora alunos já notificados.</span>

        <div class="flex items-center space-x-3 w-full sm:w-auto justify-end">
          <button @click="emit('close')" type="button" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">
            Fechar
          </button>
          
          <button
            @click="handleSendEmailTodos"
            :disabled="isSendingAll || alunos.length === 0"
            class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-indigo-600/25 flex items-center space-x-2"
          >
            <span v-if="isSendingAll" class="material-icons text-sm animate-spin">sync</span>
            <span v-else class="material-icons text-sm">forward_to_inbox</span>
            <span>Enviar para Todos os Pendentes</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
