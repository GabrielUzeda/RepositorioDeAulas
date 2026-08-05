<script setup lang="ts">
import { ref, watch } from 'vue';
import { apiClient } from '@/shared/api/client';
import type { Atividade, RespostaAluno } from '@/shared/types';

const props = defineProps<{
  show: boolean;
  atividade: Atividade | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const respostas = ref<RespostaAluno[]>([]);
const isLoading = ref(false);
const errorMessage = ref('');
const selectedResposta = ref<RespostaAluno | null>(null);

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

async function handleDeleteResposta(id: number) {
  if (!confirm('Deseja realmente excluir esta resposta do aluno? Esta ação cumpre o direito à eliminação dos dados (Art. 18 LGPD).')) return;
  const res = await apiClient.delete(`/respostas/${id}`);
  if (res.success) {
    respostas.value = respostas.value.filter((r) => r.id !== id);
    if (selectedResposta.value?.id === id) {
      selectedResposta.value = null;
    }
  } else {
    alert('Erro ao excluir resposta.');
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
  <div v-if="props.show && props.atividade" class="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl relative border border-slate-100" @click.stop>
      <!-- Header -->
      <div class="flex justify-between items-start border-b pb-4">
        <div>
          <span class="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full uppercase tracking-wider">Respostas dos Alunos</span>
          <h2 class="text-2xl font-bold text-slate-800 mt-2">{{ props.atividade.titulo }}</h2>
          <p class="text-slate-500 text-xs mt-0.5">Total de Envios: {{ respostas.length }}</p>
        </div>
        <button @click="emit('close')" class="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition">
          <span class="material-icons">close</span>
        </button>
      </div>

      <!-- Main Content Area -->
      <div class="flex-1 overflow-y-auto py-4 space-y-4">
        <div v-if="isLoading" class="text-center py-12 text-slate-500">
          <span class="material-icons animate-spin text-3xl">sync</span>
          <p class="mt-2 text-sm">Carregando respostas dos alunos...</p>
        </div>

        <div v-else-if="errorMessage" class="p-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-center space-y-2">
          <span class="material-icons text-3xl text-rose-600">error_outline</span>
          <p class="text-sm font-semibold">{{ errorMessage }}</p>
        </div>

        <div v-else-if="respostas.length === 0" class="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 text-slate-500">
          <span class="material-icons text-4xl text-slate-300">inbox</span>
          <p class="mt-2 text-sm">Nenhuma resposta registrada para esta atividade até o momento.</p>
        </div>

        <div v-else class="space-y-4">
          <!-- Submission Details Modal overlay if selected -->
          <div v-if="selectedResposta" class="p-6 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-4">
            <div class="flex justify-between items-center border-b border-indigo-200/60 pb-3">
              <div>
                <h4 class="font-bold text-indigo-900 text-lg">{{ selectedResposta.aluno_nome }}</h4>
                <p class="text-indigo-700 text-xs">{{ selectedResposta.aluno_email }} • {{ formatDate(selectedResposta.criado_em) }}</p>
              </div>
              <button @click="selectedResposta = null" class="text-indigo-600 hover:text-indigo-800 text-xs font-bold px-3 py-1 bg-white rounded-lg border border-indigo-200 shadow-sm">
                Fechar Detalhes
              </button>
            </div>
            <div>
              <label class="block text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1">Respostas Enviadas pelo Aluno:</label>
              <div class="p-4 bg-white rounded-xl border border-indigo-100 font-mono text-sm text-slate-800 whitespace-pre-wrap">
                {{ selectedResposta.respostas }}
              </div>
            </div>
          </div>

          <!-- Submissions Table -->
          <div class="overflow-x-auto border border-slate-200 rounded-2xl">
            <table class="w-full text-left text-sm text-slate-700">
              <thead class="bg-slate-100 text-slate-600 text-xs uppercase font-semibold">
                <tr>
                  <th class="py-3 px-4">Aluno</th>
                  <th class="py-3 px-4">E-mail</th>
                  <th class="py-3 px-4">Data/Hora</th>
                  <th class="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="resp in respostas" :key="resp.id" class="hover:bg-slate-50 transition">
                  <td class="py-3 px-4 font-bold text-slate-800">{{ resp.aluno_nome }}</td>
                  <td class="py-3 px-4 text-slate-600">{{ resp.aluno_email }}</td>
                  <td class="py-3 px-4 text-slate-500 text-xs">{{ formatDate(resp.criado_em) }}</td>
                  <td class="py-3 px-4 text-right space-x-2">
                    <button
                      @click="selectedResposta = resp"
                      class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                    >
                      Ver Resposta
                    </button>
                    <button
                      @click="handleDeleteResposta(resp.id)"
                      title="Excluir Resposta (Direito LGPD)"
                      class="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-semibold transition"
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
      <div class="flex justify-between items-center pt-4 border-t border-slate-100 text-xs text-slate-400">
        <span>Em conformidade com o Artigo 18 da LGPD (Direito de eliminação de dados)</span>
        <button @click="emit('close')" class="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition">
          Fechar
        </button>
      </div>
    </div>
  </div>
</template>
