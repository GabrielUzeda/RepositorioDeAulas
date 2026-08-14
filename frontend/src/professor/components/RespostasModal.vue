<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useToast } from '@/shared/composables/useToast';
import { apiClient } from '@/shared/api/client';
import type { Atividade, RespostaAluno, Question } from '@/shared/types';
import BaseModal from '../../shared/components/BaseModal.vue';
import BaseButton from '../../shared/components/BaseButton.vue';
import BaseInput from '../../shared/components/BaseInput.vue';
import BaseTextarea from '../../shared/components/BaseTextarea.vue';
import BaseBadge from '../../shared/components/BaseBadge.vue';
import BaseSpinner from '../../shared/components/BaseSpinner.vue';
import ConfirmDialog from '../../shared/components/ConfirmDialog.vue';
import EmptyState from '../../shared/components/EmptyState.vue';

const props = defineProps<{
  show: boolean;
  atividade: Atividade | null;
}>();

const emit = defineEmits<(e: 'close') => void>();

const respostas = ref<RespostaAluno[]>([]);
const isLoading = ref(false);
const errorMessage = ref('');
const selectedResposta = ref<RespostaAluno | null>(null);

const editingNota = ref<number | null>(null);
const editingFeedback = ref('');
const isSavingAvaliacao = ref(false);

const showConfirmDelete = ref(false);
const deleteTargetId = ref<number | null>(null);

const editingNotaStr = computed<string>({
  get: () => (editingNota.value === null ? '' : String(editingNota.value)),
  set: (v: string) => {
    editingNota.value = v === '' ? null : Number(v);
  }
});


const parsedQuestionsMap = computed<Question[]>(() => {
  if (!props.atividade?.json_data) return [];
  try {
    const data = typeof props.atividade.json_data === 'string'
      ? JSON.parse(props.atividade.json_data)
      : props.atividade.json_data;
    return data.questions || [];
  } catch {
    return [];
  }
});

function parseRespostas(raw: string | Record<string, string>): Array<{ key: string; label: string; value: string }> {
  if (!raw) return [];
  
  let mapObj: Record<string, any> | null = null;
  if (typeof raw === 'object' && raw !== null) {
    mapObj = raw;
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        mapObj = parsed;
      }
    } catch {
      // Legacy plain text response
    }
  }

  if (mapObj) {
    return Object.entries(mapObj).map(([key, val]) => {
      const qIdx = Number(key);
      const question = !isNaN(qIdx) ? parsedQuestionsMap.value[qIdx] : null;
      const label = question?.content || question?.title || `Questão ${isNaN(qIdx) ? key : qIdx + 1}`;
      return { key, label, value: String(val) };
    });
  }

  return [{ key: '0', label: 'Resposta Global', value: String(raw) }];
}

watch(
  () => props.show,
  async (val) => {
    if (val && props.atividade) {
      errorMessage.value = '';
      await fetchRespostas();
    } else {
      respostas.value = [];
      errorMessage.value = '';
      selectedResposta.value = null;
    }
  }
);

async function fetchRespostas() {
  if (!props.atividade) return;
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const res = await apiClient.get<RespostaAluno[]>(`/atividades/${props.atividade.id}/respostas`);
    if (res.success && res.data) {
      respostas.value = res.data;
    } else {
      errorMessage.value = res.error || 'Erro ao carregar as respostas dos alunos.';
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Erro ao carregar as respostas dos alunos.';
  } finally {
    isLoading.value = false;
  }
}

function handleSelectResposta(resp: RespostaAluno) {
  selectedResposta.value = resp;
  editingNota.value = resp.nota ?? null;
  editingFeedback.value = resp.feedback ?? '';
}

async function handleSaveAvaliacao() {
  if (!selectedResposta.value || isSavingAvaliacao.value) return;
  isSavingAvaliacao.value = true;

  try {
    const res = await apiClient.put(`/respostas/${selectedResposta.value.id}/avaliacao`, {
      nota: editingNota.value,
      feedback: editingFeedback.value
    });

    if (res.success) {
      useToast().success('Avaliação Salva!');
      selectedResposta.value.nota = editingNota.value;
      selectedResposta.value.feedback = editingFeedback.value;
      
      const idx = respostas.value.findIndex(r => r.id === selectedResposta.value?.id);
      if (idx !== -1) {
        respostas.value[idx].nota = editingNota.value;
        respostas.value[idx].feedback = editingFeedback.value;
      }
    } else {
      useToast().error(res.error || 'Erro ao salvar avaliação.');
    }
  } catch (err: any) {
    useToast().error(err.message || 'Erro ao salvar avaliação.');
  } finally {
    isSavingAvaliacao.value = false;
  }
}

function requestDeleteResposta(id: number) {
  deleteTargetId.value = id;
  showConfirmDelete.value = true;
}

async function handleDeleteResposta(id: number) {
  try {
    const res = await apiClient.delete(`/respostas/${id}`);
    if (res.success) {
      respostas.value = respostas.value.filter((r) => r.id !== id);
      if (selectedResposta.value?.id === id) {
        selectedResposta.value = null;
      }
    } else {
      useToast().error('Erro ao excluir resposta.');
    }
  } catch (err: any) {
    useToast().error(err.message || 'Erro ao excluir resposta.');
  }
}

function onConfirmDelete() {
  if (deleteTargetId.value !== null) {
    handleDeleteResposta(deleteTargetId.value);
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
  <BaseModal
    :model-value="props.show && !!props.atividade"
    max-width="max-w-4xl"
    @close="emit('close')"
  >
    <template #header>
      <div class="flex justify-between items-start border-b pb-4">
        <div>
          <BaseBadge variant="accent">Respostas dos Alunos</BaseBadge>
          <h2 class="text-2xl font-bold text-primary mt-2">{{ props.atividade?.titulo }}</h2>
          <p class="text-secondary text-xs mt-0.5">Total de Envios: {{ respostas.length }}</p>
        </div>
      </div>
    </template>

    <!-- Main Content Area -->
    <div class="space-y-4">
      <div v-if="isLoading" class="text-center py-12 text-secondary">
        <BaseSpinner />
        <p class="mt-2 text-sm">Carregando respostas dos alunos...</p>
      </div>

      <div v-else-if="errorMessage" class="p-6 bg-surface border border-danger text-white rounded-2xl text-center space-y-2">
        <span class="material-icons text-3xl text-danger">error_outline</span>
        <p class="text-sm font-semibold">{{ errorMessage }}</p>
      </div>

      <EmptyState v-else-if="respostas.length === 0" icon="inbox" message="Nenhuma resposta registrada para esta atividade até o momento." />

      <div v-else class="space-y-4">
        <!-- Submission Details & Evaluation Section if selected -->
        <div v-if="selectedResposta" class="p-6 bg-surface border border-line rounded-2xl space-y-5">
          <div class="flex justify-between items-center border-b border-line pb-3">
            <div>
              <h4 class="font-bold text-primary text-lg">{{ selectedResposta.aluno_nome }}</h4>
              <p class="text-secondary text-xs">{{ selectedResposta.aluno_email }} • {{ formatDate(selectedResposta.criado_em) }}</p>
            </div>
            <BaseButton variant="secondary" size="sm" @click="selectedResposta = null">
              Fechar Detalhes
            </BaseButton>
          </div>

          <!-- Formulário de Avaliação (Nota e Feedback) -->
          <div class="p-4 bg-surface-alt rounded-xl border border-line shadow-sm space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-primary uppercase tracking-wider flex items-center space-x-1">
                <span class="material-icons text-sm text-accent">grade</span>
                <span>Avaliação do Professor (Interno)</span>
              </span>

            </div>

            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div class="sm:col-span-1">
                <BaseInput
                  v-model="editingNotaStr"
                  label="Nota (0 a 100):"
                  type="number"
                  placeholder="Ex: 85"
                />
              </div>
              <div class="sm:col-span-3">
                <BaseTextarea
                  v-model="editingFeedback"
                  label="Comentário / Feedback:"
                  placeholder="Escreva um comentário pedagógico para este aluno..."
                />
              </div>
            </div>

            <div class="flex justify-end">
              <BaseButton
                variant="primary"
                size="sm"
                :loading="isSavingAvaliacao"
                @click="handleSaveAvaliacao"
              >
                <span class="material-icons text-xs">save</span>
                <span>Salvar Avaliação</span>
              </BaseButton>
            </div>
          </div>
          
          <!-- Respostas do Aluno por Pergunta -->
          <div class="space-y-3">
            <label class="block text-xs font-bold text-accent uppercase tracking-wider">Respostas do Aluno:</label>
            
            <div v-for="(item, idx) in parseRespostas(selectedResposta.respostas)" :key="idx" class="p-4 bg-surface-alt rounded-xl border border-line shadow-sm space-y-1.5">
              <div class="flex items-center space-x-2 text-xs font-bold text-primary">
                <span class="px-2 py-0.5 bg-accent text-secondary rounded-md">Q{{ idx + 1 }}</span>
                <span>{{ item.label }}</span>
              </div>
              <div class="p-3 bg-surface rounded-lg text-sm text-primary font-mono whitespace-pre-wrap border border-line">
                {{ item.value || '(Sem resposta)' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Submissions Table -->
        <div class="overflow-x-auto border border-line rounded-2xl">
          <table class="w-full text-left text-sm text-secondary">
            <thead class="bg-surface text-secondary text-xs uppercase font-semibold">
              <tr>
                <th class="py-3 px-4">Aluno</th>
                <th class="py-3 px-4">E-mail</th>
                <th class="py-3 px-4">Data/Hora</th>
                <th class="py-3 px-4 text-center">Nota</th>
                <th class="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr v-for="resp in respostas" :key="resp.id" class="hover:bg-surface transition">
                <td class="py-3 px-4 font-bold text-primary">{{ resp.aluno_nome }}</td>
                <td class="py-3 px-4 text-secondary">{{ resp.aluno_email }}</td>
                <td class="py-3 px-4 text-secondary text-xs">{{ formatDate(resp.criado_em) }}</td>
                <td class="py-3 px-4 text-center">
                  <span
                    v-if="resp.nota !== null && resp.nota !== undefined"
                    class="px-2.5 py-1 bg-accent text-white font-bold rounded-lg text-xs"
                  >
                    {{ resp.nota }}/100
                  </span>
                  <span v-else class="text-secondary text-xs italic">Sem nota</span>
                </td>
                <td class="py-3 px-4 text-right space-x-2">
                  <BaseButton
                    variant="primary"
                    size="sm"
                    @click="handleSelectResposta(resp)"
                  >
                    Avaliar / Ver
                  </BaseButton>
                  <BaseButton
                    variant="danger"
                    size="sm"
                    @click="requestDeleteResposta(resp.id)"
                  >
                    Excluir
                  </BaseButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between items-center pt-4 border-t border-line text-xs text-secondary">
        <span>Em conformidade com o Artigo 18 da LGPD (Direito de eliminação de dados)</span>
        <BaseButton variant="secondary" @click="emit('close')">Fechar</BaseButton>
      </div>
    </template>
  </BaseModal>

  <ConfirmDialog
    v-model="showConfirmDelete"
    :danger="true"
    message="Deseja realmente excluir esta resposta do aluno? Esta ação cumpre o direito à eliminação dos dados (Art. 18 LGPD)."
    confirm-text="Excluir"
    @confirm="onConfirmDelete"
    @cancel="showConfirmDelete = false"
  />
</template>
