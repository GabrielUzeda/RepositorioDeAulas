<script setup lang="ts">
import { ref, watch } from 'vue';
import { useToast } from '@/shared/composables/useToast';
import { apiClient } from '@/shared/api/client';
import type { DisciplinaFeedbackRelatorio, AlunoFeedbackConsolidado } from '@/shared/types';
import BaseModal from '@/shared/components/BaseModal.vue';
import BaseButton from '@/shared/components/BaseButton.vue';
import BaseTextarea from '@/shared/components/BaseTextarea.vue';
import BaseInput from '@/shared/components/BaseInput.vue';
import BaseSelect from '@/shared/components/BaseSelect.vue';
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
const isSavingTurma = ref(false);
const savingAlunoEmail = ref<string | null>(null);
const feedbackTurma = ref('');
const alunos = ref<AlunoFeedbackConsolidado[]>([]);
const atividadesConsideradas = ref<Array<{ id: number; titulo: string }>>([]);
const isSendingAll = ref(false);
const sendingEmailFor = ref<string | null>(null);
const confirmReenvioOpen = ref(false);
const isSynthesizingAi = ref(false);
const aiPontosFortes = ref<string[]>([]);
const aiPontosAtencao = ref<string[]>([]);

const showAiConfigModal = ref(false);
const aiSeveridade = ref<'brando' | 'moderado' | 'rigoroso' | 'sistematico'>('moderado');
const aiObservacoes = ref('');

const severidadeOptions = [
  { value: 'brando', label: 'Brando (Acolhedor e encorajador)' },
  { value: 'moderado', label: 'Moderado (Equilibrado e padrão)' },
  { value: 'rigoroso', label: 'Rigoroso (Exigência e precisão)' },
  { value: 'sistematico', label: 'Sistemático (Analítico passo a passo)' }
];

watch(
  () => props.show,
  async (val) => {
    if (val && props.disciplinaId) {
      await fetchRelatorio();
    } else {
      feedbackTurma.value = '';
      alunos.value = [];
      atividadesConsideradas.value = [];
    }
  }
);

async function fetchRelatorio() {
  if (!props.disciplinaId) return;
  isLoading.value = true;
  try {
    const res = await apiClient.get<any>(`/disciplinas/${props.disciplinaId}/relatorio-feedback`);
    if (res.success && res.data) {
      const payload = res.data.data || res.data;
      feedbackTurma.value = payload.feedback_turma || '';
      alunos.value = payload.alunos || [];
      atividadesConsideradas.value = payload.atividades_consideradas || [];
    } else {
      useToast().error(res.error || 'Erro ao carregar relatório de feedback.');
    }
  } catch (err: any) {
    useToast().error(err.message || 'Erro ao carregar relatório de feedback.');
  } finally {
    isLoading.value = false;
  }
}

async function handleGenerateAiSynthesis() {
  if (!props.disciplinaId || isSynthesizingAi.value || alunos.value.length === 0) return;
  isSynthesizingAi.value = true;

  try {
    const alunosDetalhes = alunos.value.map(a => {
      return {
        aluno_nome: a.aluno_nome,
        aluno_email: a.aluno_email,
        media_calculada: a.media_calculada,
        atividades: a.atividades.map(atv => ({
          atividade_titulo: atv.atividade_titulo,
          nota: atv.nota,
          feedback: atv.feedback || null
        })),
        atividades_pendentes: a.atividades_pendentes || []
      };
    });

    const res = await apiClient.post<any>('/ai/synthesize-class-feedback', {
      disciplina_nome: props.disciplinaNome || 'Disciplina',
      total_envios: alunos.value.length,
      severidade: aiSeveridade.value,
      observacoes: aiObservacoes.value.trim() || undefined,
      alunos_detalhes: alunosDetalhes
    });

    if (res.success && res.data) {
      if (res.data.feedback_geral) {
        feedbackTurma.value = res.data.feedback_geral;
      }
      aiPontosFortes.value = res.data.pontos_fortes || [];
      aiPontosAtencao.value = res.data.pontos_atencao || [];

      if (Array.isArray(res.data.alunos_sintese)) {
        const sinteseMap = new Map<string, string>();
        for (const item of res.data.alunos_sintese) {
          if (item.aluno_email && item.feedback_individual) {
            sinteseMap.set(String(item.aluno_email).trim().toLowerCase(), String(item.feedback_individual).trim());
          }
        }
        for (const aluno of alunos.value) {
          const individual = sinteseMap.get(aluno.aluno_email.trim().toLowerCase());
          if (individual) {
            aluno.feedback_geral = individual;
          }
        }
      }

      useToast().success('Síntese pedagógica da turma e feedbacks individuais sintetizados com sucesso!');
    } else {
      useToast().error(res.error || 'Erro ao gerar síntese da turma com IA.');
    }
  } catch (err: any) {
    useToast().error(err.message || 'Erro de comunicação com o serviço de IA.');
  } finally {
    isSynthesizingAi.value = false;
  }
}

async function handleSaveFeedbackTurma() {
  if (!props.disciplinaId || isSavingTurma.value) return;
  isSavingTurma.value = true;
  
  try {
    const res = await apiClient.post(`/disciplinas/${props.disciplinaId}/salvar-feedback-geral`, {
      aluno_email: null,
      feedback_geral: feedbackTurma.value
    });
    if (res.success) {
      useToast().success('Feedback Geral da Turma salvo com sucesso!');
    } else {
      useToast().error(res.error || 'Erro ao salvar feedback da turma.');
    }
  } catch (err: any) {
    useToast().error(err.message || 'Erro ao salvar feedback da turma.');
  } finally {
    isSavingTurma.value = false;
  }
}

async function handleSaveAllFeedbacks() {
  if (!props.disciplinaId || isSavingTurma.value) return;
  isSavingTurma.value = true;
  try {
    const payload = [
      { aluno_email: null, feedback_geral: feedbackTurma.value },
      ...alunos.value.map(a => ({
        aluno_email: a.aluno_email,
        feedback_geral: a.feedback_geral || ''
      }))
    ];
    const res = await apiClient.post(`/disciplinas/${props.disciplinaId}/salvar-feedback-geral`, {
      feedbacks: payload
    });
    if (res.success) {
      useToast().success('Todos os feedbacks (turma e individuais) salvos com sucesso!');
    } else {
      useToast().error(res.error || 'Erro ao salvar feedbacks.');
    }
  } catch (err: any) {
    useToast().error(err.message || 'Erro ao salvar feedbacks.');
  } finally {
    isSavingTurma.value = false;
  }
}

async function handleSaveFeedbackAluno(aluno: AlunoFeedbackConsolidado) {
  if (!props.disciplinaId || savingAlunoEmail.value === aluno.aluno_email) return;
  savingAlunoEmail.value = aluno.aluno_email;
  
  try {
    const res = await apiClient.post(`/disciplinas/${props.disciplinaId}/salvar-feedback-geral`, {
      aluno_email: aluno.aluno_email,
      feedback_geral: aluno.feedback_geral
    });
    if (res.success) {
      useToast().success(`Feedback para ${aluno.aluno_nome} salvo!`);
    } else {
      useToast().error(res.error || 'Erro ao salvar feedback do aluno.');
    }
  } catch (err: any) {
    useToast().error(err.message || 'Erro ao salvar feedback do aluno.');
  } finally {
    savingAlunoEmail.value = null;
  }
}

async function handleSendEmailIndividual(aluno: AlunoFeedbackConsolidado) {
  if (!props.disciplinaId || sendingEmailFor.value === aluno.aluno_email) return;
  sendingEmailFor.value = aluno.aluno_email;

  try {
    // Salva o feedback do aluno antes de enviar
    await handleSaveFeedbackAluno(aluno);

    const res = await apiClient.post<{ enviados: number }>(`/disciplinas/${props.disciplinaId}/enviar-emails-feedback`, {
      aluno_email: aluno.aluno_email,
      forcar_reenvio: true
    });

    if (res.success) {
      aluno.ja_enviado = true;
      useToast().success(`E-mail enviado para ${aluno.aluno_email} com sucesso!`);
    } else {
      useToast().error(res.error || 'Erro ao enviar e-mail.');
    }
  } catch (err: any) {
    useToast().error(err.message || 'Erro ao enviar e-mail.');
  } finally {
    sendingEmailFor.value = null;
  }
}

async function doSendEmailTodos(forcarReenvio: boolean) {
  if (!props.disciplinaId || isSendingAll.value) return;

  isSendingAll.value = true;

  try {
    const res = await apiClient.post<{ enviados: number }>(`/disciplinas/${props.disciplinaId}/enviar-emails-feedback`, {
      forcar_reenvio: forcarReenvio
    });

    if (res.success) {
      useToast().success(`${res.data?.enviados || 0} e-mails de feedback enviados com sucesso!`);
      await fetchRelatorio();
    } else {
      useToast().error(res.error || 'Erro ao enviar e-mails.');
    }
  } catch (err: any) {
    useToast().error(err.message || 'Erro ao enviar e-mails.');
  } finally {
    isSendingAll.value = false;
  }
}

async function handleSendEmailTodos() {
  if (!props.disciplinaId || isSendingAll.value) return;
  
  // Salva feedback da turma e todos os feedbacks individuais dos alunos antes de disparar
  await handleSaveAllFeedbacks();

  const pendentes = alunos.value.filter(a => !a.ja_enviado);
  if (pendentes.length === 0) {
    confirmReenvioOpen.value = true;
    return;
  }

  await doSendEmailTodos(pendentes.length === 0);
}

async function confirmReenvio() {
  await doSendEmailTodos(true);
  confirmReenvioOpen.value = false;
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
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label class="block text-xs font-bold text-primary uppercase tracking-wider flex items-center space-x-1.5">
              <span class="material-icons text-sm text-accent">campaign</span>
              <span>Feedback Geral da Turma (Recado Coletivo)</span>
            </label>
            <div class="flex items-center gap-2">
              <BaseButton
                variant="ghost"
                size="sm"
                class="text-xs text-secondary hover:text-primary px-2.5 py-1.5 rounded-lg border border-line flex items-center gap-1.5"
                title="Configurar critérios e observações pedagógicas da IA"
                @click="showAiConfigModal = true"
              >
                <span class="material-icons text-sm text-accent">tune</span>
                <span class="hidden sm:inline">Critérios IA</span>
              </BaseButton>

              <BaseButton
                variant="ghost"
                size="sm"
                :disabled="isSynthesizingAi || alunos.length === 0"
                class="text-xs text-accent font-semibold flex items-center gap-1 hover:bg-accent/10 px-2.5 py-1.5 rounded border border-accent/20"
                title="Sintetizar desempenho da turma e feedbacks individuais dos alunos com IA"
                @click="handleGenerateAiSynthesis"
              >
                <span class="material-icons text-sm" :class="{ 'animate-spin': isSynthesizingAi }">
                  {{ isSynthesizingAi ? 'sync' : 'auto_awesome' }}
                </span>
                <span>{{ isSynthesizingAi ? 'Gerando Síntese...' : 'Sintetizar com IA' }}</span>
              </BaseButton>
              <BaseButton variant="secondary" size="sm" :loading="isSavingTurma" @click="handleSaveAllFeedbacks" title="Salvar feedback da turma e individuais de todos os alunos">
                <span class="material-icons text-xs">done_all</span>
                <span>Salvar Todos</span>
              </BaseButton>
              <BaseButton variant="primary" size="sm" :loading="isSavingTurma" @click="handleSaveFeedbackTurma">
                <span class="material-icons text-xs">save</span>
                <span>Salvar Feedback da Turma</span>
              </BaseButton>
            </div>
          </div>
          <BaseTextarea
            v-model="feedbackTurma"
            :rows="3"
            placeholder="Digite um comunicado ou feedback geral para toda a turma nesta disciplina (será incluído no e-mail de todos os alunos)..."
          />

          <!-- Destaques da IA (pontos fortes e de atenção) -->
          <div v-if="aiPontosFortes.length > 0 || aiPontosAtencao.length > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div v-if="aiPontosFortes.length > 0" class="p-3 bg-success/10 border border-success/30 rounded-xl space-y-1">
              <p class="text-xs font-bold text-success flex items-center gap-1">
                <span class="material-icons text-xs">thumb_up</span> Pontos Fortes Observados:
              </p>
              <ul class="text-xs text-primary space-y-0.5 list-disc pl-4">
                <li v-for="(ponto, i) in aiPontosFortes" :key="i">{{ ponto }}</li>
              </ul>
            </div>
            <div v-if="aiPontosAtencao.length > 0" class="p-3 bg-accent/10 border border-accent/30 rounded-xl space-y-1">
              <p class="text-xs font-bold text-accent flex items-center gap-1">
                <span class="material-icons text-xs">lightbulb</span> Tópicos de Atenção / Revisão:
              </p>
              <ul class="text-xs text-primary space-y-0.5 list-disc pl-4">
                <li v-for="(ponto, i) in aiPontosAtencao" :key="i">{{ ponto }}</li>
              </ul>
            </div>
          </div>
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
                  <h4 class="font-bold text-primary text-base flex flex-wrap items-center gap-2">
                    <span>{{ aluno.aluno_nome }}</span>
                    <span
                      v-if="aluno.media_calculada !== null && aluno.media_calculada !== undefined"
                      class="px-2.5 py-0.5 bg-accent/15 text-accent border border-accent/30 text-[11px] font-bold rounded-full flex items-center space-x-1"
                      title="Média geral da disciplina (atividades não entregues valem nota 0)"
                    >
                      <span class="material-icons text-[12px]">analytics</span>
                      <span>Média da Disciplina: {{ aluno.media_calculada }}/100</span>
                    </span>
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
                  class="w-full sm:w-auto"
                  :loading="sendingEmailFor === aluno.aluno_email"
                  @click="handleSendEmailIndividual(aluno)"
                >
                  <span class="material-icons text-xs">send</span>
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

              <!-- Atividades Pendentes (não entregues) -->
              <div v-if="aluno.atividades_pendentes && aluno.atividades_pendentes.length > 0" class="space-y-2 pt-1">
                <label class="block text-[11px] font-bold text-danger uppercase tracking-wider flex items-center gap-1">
                  <span class="material-icons text-xs">warning_amber</span>
                  <span>Atividades Não Entregues ({{ aluno.atividades_pendentes.length }}) — Contabilizadas como Nota 0 na média:</span>
                </label>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div
                    v-for="pend in aluno.atividades_pendentes"
                    :key="pend.id"
                    class="p-2.5 bg-danger/5 border border-danger/20 rounded-xl flex items-center justify-between text-xs"
                  >
                    <span class="text-primary font-medium truncate">{{ pend.atividade_titulo }}</span>
                    <span class="px-2 py-0.5 bg-danger/10 text-danger font-bold rounded text-[10px] shrink-0">Pendente (0/100)</span>
                  </div>
                </div>
              </div>

              <!-- Feedback Geral do Aluno na Disciplina -->
              <div class="space-y-1.5 pt-1">
                <div class="flex justify-between items-center">
                  <label class="block text-[11px] font-bold text-secondary uppercase tracking-wider">Feedback Individual do Aluno na Disciplina:</label>
                  <BaseButton
                    variant="ghost"
                    size="sm"
                    :loading="savingAlunoEmail === aluno.aluno_email"
                    @click="handleSaveFeedbackAluno(aluno)"
                  >
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
            :loading="isSendingAll"
            :disabled="alunos.length === 0"
            @click="handleSendEmailTodos"
          >
            <span class="material-icons text-sm">forward_to_inbox</span>
            <span>Enviar para Todos os Pendentes</span>
          </BaseButton>
        </div>
      </div>
    </template>
  </BaseModal>

  <ConfirmDialog
    v-model="confirmReenvioOpen"
    :danger="true"
    :loading="isSendingAll"
    message="Todos os alunos já receberam o e-mail de feedback. Deseja reenviar para todos novamente?"
    confirm-text="Reenviar"
    @confirm="confirmReenvio"
  />

  <!-- Modal de Configuração de Critérios de IA -->
  <BaseModal
    v-model="showAiConfigModal"
    title="Configuração da Síntese com IA"
    max-width="max-w-md"
    @close="showAiConfigModal = false"
  >
    <div class="space-y-4">
      <p class="text-xs text-secondary">
        Personalize o nível de severidade e forneça orientações específicas para a inteligência artificial ao gerar o parecer geral da turma e os feedbacks individuais dos alunos.
      </p>

      <BaseSelect
        v-model="aiSeveridade"
        label="Nível de Severidade da Síntese"
        :options="severidadeOptions"
      />

      <div class="space-y-1">
        <label class="block text-sm font-medium text-primary">Orientações e Observações Pedagógicas</label>
        <BaseTextarea
          v-model="aiObservacoes"
          :rows="4"
          placeholder="Ex: 'Enfatize a importância de entregar as atividades pendentes', 'Destaque o bom domínio dos tópicos teóricos', 'Seja rigoroso na cobrança de prazos', etc."
        />
        <p class="text-[11px] text-secondary">Instruções extras que serão injetadas diretamente na síntese coletiva e nas devolutivas individuais dos alunos.</p>
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-line">
        <BaseButton variant="primary" size="sm" @click="showAiConfigModal = false">
          <span class="material-icons text-xs mr-1">check</span>
          <span>Aplicar Critérios</span>
        </BaseButton>
      </div>
    </div>
  </BaseModal>
</template>
