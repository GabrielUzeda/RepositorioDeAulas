<script setup lang="ts">
import { ref, watch } from 'vue';
import { useToast } from '@/shared/composables/useToast';
import { apiClient } from '@/shared/api/client';
import type { DisciplinaFeedbackRelatorio, AlunoFeedbackConsolidado } from '@/shared/types';
import BaseModal from '@/shared/components/BaseModal.vue';
import BaseButton from '@/shared/components/BaseButton.vue';
import BaseTextarea from '@/shared/components/BaseTextarea.vue';
import BaseInput from '@/shared/components/BaseInput.vue';
import BaseSpinner from '@/shared/components/BaseSpinner.vue';
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue';
import EmptyState from '@/shared/components/EmptyState.vue';

const props = defineProps<{
  show: boolean;
  disciplinaId: number | null;
  disciplinaNome?: string;
}>();

const emit = defineEmits<(e: 'close') => void>();

const isLoading = ref(false);
const feedbackTurma = ref('');
const alunos = ref<AlunoFeedbackConsolidado[]>([]);
const isSendingAll = ref(false);
const sendingEmailFor = ref<string | null>(null);
const confirmReenvioOpen = ref(false);


watch(
  () => props.show,
  async (val) => {
    if (val && props.disciplinaId) {
      
      await fetchRelatorio();
    } else {
      feedbackTurma.value = '';
      alunos.value = [];
      
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
    useToast().error(res.error || 'Erro ao carregar relatório de feedback.');
  }
}

async function handleSaveFeedbackTurma() {
  if (!props.disciplinaId) return;
  
  const res = await apiClient.post(`/disciplinas/${props.disciplinaId}/salvar-feedback-geral`, {
    aluno_email: null,
    feedback_geral: feedbackTurma.value
  });
  if (res.success) {
    useToast().success('Feedback Geral da Turma salvo com sucesso!');
  } else {
    useToast().error(res.error || 'Erro ao salvar feedback da turma.');
  }
}

async function handleSaveFeedbackAluno(aluno: AlunoFeedbackConsolidado) {
  if (!props.disciplinaId) return;
  
  const res = await apiClient.post(`/disciplinas/${props.disciplinaId}/salvar-feedback-geral`, {
    aluno_email: aluno.aluno_email,
    feedback_geral: aluno.feedback_geral
  });
  if (res.success) {
    useToast().success(`Feedback para ${aluno.aluno_nome} salvo!`);
  } else {
    useToast().error(res.error || 'Erro ao salvar feedback do aluno.');
  }
}

async function handleSendEmailIndividual(aluno: AlunoFeedbackConsolidado) {
  if (!props.disciplinaId) return;
  sendingEmailFor.value = aluno.aluno_email;
  

  // Salva o feedback do aluno antes de enviar
  await handleSaveFeedbackAluno(aluno);

  const res = await apiClient.post<{ enviados: number }>(`/disciplinas/${props.disciplinaId}/enviar-emails-feedback`, {
    aluno_email: aluno.aluno_email,
    forcar_reenvio: true
  });

  sendingEmailFor.value = null;

  if (res.success) {
    aluno.ja_enviado = true;
    useToast().success(`E-mail enviado para ${aluno.aluno_email} com sucesso!`);
  } else {
    useToast().error(res.error || 'Erro ao enviar e-mail.');
  }
}

async function doSendEmailTodos(forcarReenvio: boolean) {
  if (!props.disciplinaId || isSendingAll.value) return;

  isSendingAll.value = true;
  

  const res = await apiClient.post<{ enviados: number }>(`/disciplinas/${props.disciplinaId}/enviar-emails-feedback`, {
    forcar_reenvio: forcarReenvio
  });

  isSendingAll.value = false;

  if (res.success) {
    useToast().success(`${res.data?.enviados || 0} e-mails de feedback enviados com sucesso!`);
    await fetchRelatorio();
  } else {
    useToast().error(res.error || 'Erro ao enviar e-mails.');
  }
}

async function handleSendEmailTodos() {
  if (!props.disciplinaId || isSendingAll.value) return;
  
  // Salva feedback da turma antes de disparar
  await handleSaveFeedbackTurma();

  const pendentes = alunos.value.filter(a => !a.ja_enviado);
  if (pendentes.length === 0) {
    confirmReenvioOpen.value = true;
    return;
  }

  await doSendEmailTodos(pendentes.length === 0);
}

async function confirmReenvio() {
  await doSendEmailTodos(true);
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
  <BaseModal
    :model-value="!!(props.show && props.disciplinaId)"
    @close="emit('close')"
    title="Relatório de Feedback da Disciplina"
    max-width="max-w-5xl"
  >
    <p v-if="props.disciplinaNome" class="text-secondary text-xs mb-4">{{ props.disciplinaNome }} • Consolidação e Envio de Avaliações</p>

    <!-- Main Body -->
    <div class="py-4 space-y-6">
      <div v-if="isLoading" class="text-center py-12 text-secondary flex flex-col items-center">
        <BaseSpinner size="md" />
        <p class="mt-2 text-sm">Carregando relatório consolidado...</p>
      </div>

      <EmptyState v-else-if="alunos.length === 0" icon="inbox" message="Nenhuma resposta enviada por alunos nesta disciplina ainda." />

      <div v-else class="space-y-6">
        <!-- 1. Feedback Geral da Turma -->
        <div class="p-5 bg-surface border border-line rounded-2xl space-y-3">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-bold text-primary uppercase tracking-wider flex items-center space-x-1.5">
              <span class="material-icons text-sm text-accent">campaign</span>
              <span>Feedback Geral da Turma (Recado Coletivo)</span>
            </label>
            <BaseButton variant="primary" size="sm" @click="handleSaveFeedbackTurma">
              <span class="material-icons text-xs">save</span>
              <span>Salvar Feedback da Turma</span>
            </BaseButton>
          </div>
          <BaseTextarea
            v-model="feedbackTurma"
            :rows="3"
            placeholder="Digite um comunicado ou feedback geral para toda a turma nesta disciplina (será incluído no e-mail de todos os alunos)..."
          />
        </div>

        <!-- 2. Lista de Alunos e Avaliações Consolidadas -->
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="text-sm font-bold text-secondary uppercase tracking-wider">
              Alunos com Atividades Submetidas ({{ alunos.length }})
            </h3>
            <span class="text-xs text-secondary">
              Pendente de envio: <strong class="text-secondary">{{ alunos.filter(a => !a.ja_enviado).length }}</strong> alunos
            </span>
          </div>

          <div class="space-y-4">
            <div
              v-for="aluno in alunos"
              :key="aluno.aluno_email"
              class="p-5 bg-surface border border-line rounded-2xl space-y-4 hover:border-line transition"
            >
              <!-- Cabecalho do Aluno -->
              <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-line pb-3">
                <div>
                  <h4 class="font-bold text-primary text-base flex items-center space-x-2">
                    <span>{{ aluno.aluno_nome }}</span>
                    <span
                      v-if="aluno.ja_enviado"
                      class="px-2.5 py-0.5 bg-success text-on-success text-[10px] font-bold rounded-full flex items-center space-x-1"
                    >
                      <span class="material-icons text-[12px]">check_circle</span>
                      <span>E-mail Enviado</span>
                    </span>
                    <span
                      v-else
                      class="px-2.5 py-0.5 bg-surface text-secondary text-[10px] font-bold rounded-full flex items-center space-x-1"
                    >
                      <span class="material-icons text-[12px]">schedule</span>
                      <span>E-mail Pendente</span>
                    </span>
                  </h4>
                  <p class="text-secondary text-xs mt-0.5">{{ aluno.aluno_email }}</p>
                </div>

                <BaseButton
                  variant="primary"
                  size="sm"
                  :disabled="sendingEmailFor === aluno.aluno_email"
                  @click="handleSendEmailIndividual(aluno)"
                >
                  <BaseSpinner v-if="sendingEmailFor === aluno.aluno_email" size="sm" color-class="text-current" />
                  <span v-else class="material-icons text-xs">send</span>
                  <span>Enviar E-mail Individual</span>
                </BaseButton>
              </div>

              <!-- Atividades Respondidas por este aluno -->
              <div class="space-y-2">
                <label class="block text-[11px] font-bold text-secondary uppercase tracking-wider">Atividades Enviadas & Notas:</label>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    v-for="atv in aluno.atividades"
                    :key="atv.id"
                    class="p-3 bg-surface-alt border border-line rounded-xl space-y-1 text-xs"
                  >
                    <div class="flex justify-between items-start">
                      <span class="font-bold text-primary">{{ atv.atividade_titulo }}</span>
                      <span
                        v-if="atv.nota !== null && atv.nota !== undefined"
                        class="px-2 py-0.5 bg-accent text-white font-bold rounded text-[10px]"
                      >
                        {{ atv.nota }}/100
                      </span>
                      <span v-else class="text-secondary text-[10px] italic">Sem nota</span>
                    </div>
                    <p v-if="atv.feedback" class="text-secondary text-[11px] italic">"{{ atv.feedback }}"</p>
                    <p v-else class="text-secondary text-[10px]">Sem comentários na atividade.</p>
                  </div>
                </div>
              </div>

              <!-- Feedback Geral do Aluno na Disciplina -->
              <div class="space-y-1.5 pt-1">
                <div class="flex justify-between items-center">
                  <label class="block text-[11px] font-bold text-secondary uppercase tracking-wider">Feedback Individual do Aluno na Disciplina:</label>
                  <BaseButton variant="ghost" size="sm" @click="handleSaveFeedbackAluno(aluno)">
                    Salvar Feedback
                  </BaseButton>
                </div>
                <BaseInput
                  v-model="aluno.feedback_geral"
                  type="text"
                  placeholder="Escreva observações pedagógicas gerais para este aluno..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer com Ações Globais -->
    <template #footer>
      <div class="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-line gap-3">
        <span class="text-xs text-secondary">Prevenção de duplicatas ativa: o envio em lote ignora alunos já notificados.</span>

        <div class="flex items-center space-x-3 w-full sm:w-auto justify-end">
          <BaseButton variant="ghost" size="sm" @click="emit('close')">
            Fechar
          </BaseButton>
          
          <BaseButton
            variant="primary"
            :disabled="isSendingAll || alunos.length === 0"
            @click="handleSendEmailTodos"
          >
            <BaseSpinner v-if="isSendingAll" size="sm" color-class="text-current" />
            <span v-else class="material-icons text-sm">forward_to_inbox</span>
            <span>Enviar para Todos os Pendentes</span>
          </BaseButton>
        </div>
      </div>
    </template>
  </BaseModal>

  <ConfirmDialog
    v-model="confirmReenvioOpen"
    :danger="true"
    message="Todos os alunos já receberam o e-mail de feedback. Deseja reenviar para todos novamente?"
    confirm-text="Reenviar"
    @confirm="confirmReenvio"
  />
</template>
