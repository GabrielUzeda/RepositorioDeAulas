<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useToast } from '@/shared/composables/useToast';
import { apiClient } from '@/shared/api/client';
import type { Atividade, RespostaAluno, Question } from '@/shared/types';

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
  const res = await apiClient.get<RespostaAluno[]>(`/atividades/${props.atividade.id}/respostas`);
  isLoading.value = false;
  if (res.success && res.data) {
    respostas.value = res.data;
  } else {
    errorMessage.value = res.error || 'Erro ao carregar as respostas dos alunos.';
  }
}

function handleSelectResposta(resp: RespostaAluno) {
  selectedResposta.value = resp;
  editingNota.value = resp.nota ?? null;
  editingFeedback.value = resp.feedback ?? '';
  
}

async function handleSaveAvaliacao() {
  if (!selectedResposta.value) return;
  isSavingAvaliacao.value = true;
  

  const res = await apiClient.put(`/respostas/${selectedResposta.value.id}/avaliacao`, {
    nota: editingNota.value,
    feedback: editingFeedback.value
  });

  isSavingAvaliacao.value = false;

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
}

async function handleDeleteResposta(id: number) {
  if (!confirm('Deseja realmente excluir esta resposta do aluno? Esta ação cumpre o direito à eliminação dos dados (Art. 18 LGPD).')) return;
  const res = await apiClient.delete(`/respostas/${id}`);
  if (res.success) {
    respostas.value = respostas.value.filter((r) => r.id !== id);
    if (selectedResposta.value?.id === id) {
      selectedResposta.value = null;
    }
  } else {
    useToast().error('Erro ao excluir resposta.');
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
  <div v-if="props.show && props.atividade" class="fixed inset-0 bg-surface backdrop-blur-md flex items-center justify-center p-4 z-50">
    <div class="bg-surface-alt rounded-3xl p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl relative border border-line" @click.stop>
      <!-- Header -->
      <div class="flex justify-between items-start border-b pb-4">
        <div>
          <span class="px-3 py-1 bg-accent text-secondary text-xs font-bold rounded-full uppercase tracking-wider">Respostas dos Alunos</span>
          <h2 class="text-2xl font-bold text-primary mt-2">{{ props.atividade.titulo }}</h2>
          <p class="text-secondary text-xs mt-0.5">Total de Envios: {{ respostas.length }}</p>
        </div>
        <button @click="emit('close')" class="text-secondary hover:text-secondary p-2 rounded-full hover:bg-surface transition">
          <span class="material-icons">close</span>
        </button>
      </div>

      <!-- Main Content Area -->
      <div class="flex-1 overflow-y-auto py-4 space-y-4">
        <div v-if="isLoading" class="text-center py-12 text-secondary">
          <span class="material-icons animate-spin text-3xl">sync</span>
          <p class="mt-2 text-sm">Carregando respostas dos alunos...</p>
        </div>

        <div v-else-if="errorMessage" class="p-6 bg-surface border border-danger text-white rounded-2xl text-center space-y-2">
          <span class="material-icons text-3xl text-danger">error_outline</span>
          <p class="text-sm font-semibold">{{ errorMessage }}</p>
        </div>

        <div v-else-if="respostas.length === 0" class="text-center py-12 bg-surface rounded-2xl border border-line text-secondary">
          <span class="material-icons text-4xl text-secondary">inbox</span>
          <p class="mt-2 text-sm">Nenhuma resposta registrada para esta atividade até o momento.</p>
        </div>

        <div v-else class="space-y-4">
          <!-- Submission Details & Evaluation Section if selected -->
          <div v-if="selectedResposta" class="p-6 bg-surface border border-line rounded-2xl space-y-5">
            <div class="flex justify-between items-center border-b border-line pb-3">
              <div>
                <h4 class="font-bold text-primary text-lg">{{ selectedResposta.aluno_nome }}</h4>
                <p class="text-secondary text-xs">{{ selectedResposta.aluno_email }} • {{ formatDate(selectedResposta.criado_em) }}</p>
              </div>
              <button @click="selectedResposta = null" class="text-accent hover:text-accent text-xs font-bold px-3 py-1 bg-surface-alt rounded-lg border border-line shadow-sm">
                Fechar Detalhes
              </button>
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
                  <label class="block text-xs font-semibold text-secondary mb-1">Nota (0 a 100):</label>
                  <input
                    v-model.number="editingNota"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Ex: 85"
                    class="w-full px-3 py-2 bg-surface border border-line rounded-lg text-primary text-sm font-bold focus:ring-2 focus:ring-accent outline-none"
                  />
                </div>
                <div class="sm:col-span-3">
                  <label class="block text-xs font-semibold text-secondary mb-1">Comentário / Feedback:</label>
                  <input
                    v-model="editingFeedback"
                    type="text"
                    placeholder="Escreva um comentário pedagógico para este aluno..."
                    class="w-full px-3 py-2 bg-surface border border-line rounded-lg text-primary text-sm focus:ring-2 focus:ring-accent outline-none"
                  />
                </div>
              </div>

              <div class="flex justify-end">
                <button
                  @click="handleSaveAvaliacao"
                  :disabled="isSavingAvaliacao"
                  class="px-4 py-2 bg-accent hover:opacity-90 text-primary rounded-lg text-xs font-bold shadow-sm transition flex items-center space-x-1.5"
                >
                  <span v-if="isSavingAvaliacao" class="material-icons text-xs animate-spin">sync</span>
                  <span v-else class="material-icons text-xs">save</span>
                  <span>Salvar Avaliação</span>
                </button>
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
                      class="px-2.5 py-1 bg-accent text-accent font-bold rounded-lg text-xs"
                    >
                      {{ resp.nota }}/100
                    </span>
                    <span v-else class="text-secondary text-xs italic">Sem nota</span>
                  </td>
                  <td class="py-3 px-4 text-right space-x-2">
                    <button
                      @click="handleSelectResposta(resp)"
                      class="px-3 py-1.5 bg-accent hover:opacity-90 text-primary rounded-lg text-xs font-semibold shadow-sm transition"
                    >
                      Avaliar / Ver
                    </button>
                    <button
                      @click="handleDeleteResposta(resp.id)"
                      title="Excluir Resposta (Direito LGPD)"
                      class="px-3 py-1.5 bg-danger hover:opacity-90 text-white rounded-lg text-xs font-semibold transition"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex justify-between items-center pt-4 border-t border-line text-xs text-secondary">
        <span>Em conformidade com o Artigo 18 da LGPD (Direito de eliminação de dados)</span>
        <button @click="emit('close')" class="px-5 py-2 bg-surface hover:bg-surface-alt text-secondary font-bold rounded-xl text-sm transition">
          Fechar
        </button>
      </div>
    </div>
  </div>
</template>
