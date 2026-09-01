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
  set: (v: string) => { editingNota.value = v === '' ? null : Number(v); }
});

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'H2', 'H3', 'H4',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'SPAN', 'A', 'DIV'
]);

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  let current = str;
  let passes = 0;
  const txt = document.createElement('textarea');
  while (passes < 3 && (current.includes('&lt;') || current.includes('&gt;') || current.includes('&amp;'))) {
    txt.innerHTML = current;
    const decoded = txt.value;
    if (decoded === current) break;
    current = decoded;
    passes++;
  }
  return current;
}

function sanitizeRichText(html: string): string {
  if (!html) return '<span class="text-secondary opacity-60">(Sem resposta)</span>';
  let decoded = decodeHtmlEntities(html);
  if (!/<[a-z][\s\S]*>/i.test(decoded)) {
    return decoded.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(decoded, 'text/html');
    const sanitizeNode = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (!ALLOWED_TAGS.has(el.tagName.toUpperCase())) {
          const parent = el.parentNode;
          while (el.firstChild) parent?.insertBefore(el.firstChild, el);
          parent?.removeChild(el);
          return;
        }
        const attrs = Array.from(el.attributes);
        for (const attr of attrs) {
          const attrName = attr.name.toLowerCase();
          const attrVal = attr.value.trim().toLowerCase();
          if (attrName.startsWith('on') || attrVal.startsWith('javascript:') || attrVal.startsWith('data:')) {
            el.removeAttribute(attr.name);
          }
        }
      }
      for (const child of Array.from(node.childNodes)) {
        sanitizeNode(child);
      }
    };
    sanitizeNode(doc.body);
    return doc.body.innerHTML || decoded;
  } catch (_e) {
    return decoded;
  }
}

const parsedQuestionsMap = computed<Question[]>(() => {
  if (!props.atividade?.json_data) return [];
  try {
    const data = typeof props.atividade.json_data === 'string'
      ? JSON.parse(props.atividade.json_data)
      : props.atividade.json_data;
    return data.questions || [];
  } catch { return []; }
});

function parseRespostas(raw: string | Record<string, string>): Array<{ key: string; label: string; value: string }> {
  if (!raw) return [];
  let mapObj: Record<string, any> | null = null;
  if (typeof raw === 'object' && raw !== null) {
    mapObj = raw;
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) mapObj = parsed;
    } catch { }
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
      if (respostas.value.length > 0 && !selectedResposta.value) {
        handleSelectResposta(respostas.value[0]);
      }
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
        selectedResposta.value = respostas.value[0] ?? null;
        if (selectedResposta.value) {
          editingNota.value = selectedResposta.value.nota ?? null;
          editingFeedback.value = selectedResposta.value.feedback ?? '';
        }
      }
    } else {
      useToast().error('Erro ao excluir resposta.');
    }
  } catch (err: any) {
    useToast().error(err.message || 'Erro ao excluir resposta.');
  }
}

function onConfirmDelete() {
  if (deleteTargetId.value !== null) handleDeleteResposta(deleteTargetId.value);
}

function formatDate(isoStr: string) {
  try { return new Date(isoStr).toLocaleString('pt-BR'); } catch { return isoStr; }
}

function scoreColor(nota: number | null | undefined) {
  if (nota === null || nota === undefined) return 'text-secondary';
  if (nota >= 70) return 'text-success';
  if (nota >= 50) return 'text-accent';
  return 'text-danger';
}
</script>

<template>
  <BaseModal
    :model-value="props.show && !!props.atividade"
    max-width="max-w-6xl"
    allow-fullscreen
    no-padding
    @close="emit('close')"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-md bg-accent flex items-center justify-center text-white shadow-xs shrink-0">
          <span class="material-icons text-[20px]">analytics</span>
        </div>
        <div>
          <h2 class="text-lg font-bold text-primary leading-tight">{{ props.atividade?.titulo }}</h2>
          <p class="text-xs text-secondary">{{ respostas.length }} resposta{{ respostas.length !== 1 ? 's' : '' }} submetida{{ respostas.length !== 1 ? 's' : '' }}</p>
        </div>
      </div>
    </template>

    <!-- Loading / error states -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-20 gap-3">
      <BaseSpinner />
      <p class="text-sm text-secondary">Carregando respostas dos alunos...</p>
    </div>

    <div v-else-if="errorMessage" class="p-8 text-center space-y-2">
      <span class="material-icons text-3xl text-danger">error_outline</span>
      <p class="text-sm font-semibold text-danger">{{ errorMessage }}</p>
    </div>

    <EmptyState v-else-if="respostas.length === 0" icon="inbox" message="Nenhuma resposta registrada para esta atividade até o momento." class="py-20" />

    <!-- Layout split: lista esq + detalhe dir -->
    <div v-else class="flex h-full min-h-[60vh] flex-1">

      <!-- Lista de alunos (sidebar esquerda) -->
      <aside class="w-72 shrink-0 flex flex-col border-r border-line overflow-y-auto bg-surface">
        <div class="px-3 pt-3 pb-2 border-b border-line">
          <p class="text-xs font-bold uppercase tracking-wider text-secondary">
            Total de Envios: {{ respostas.length }}
          </p>
        </div>

        <div
          v-for="resp in respostas"
          :key="resp.id"
          class="group flex items-center gap-3 px-3 py-3 border-b border-line cursor-pointer transition-colors"
          :class="selectedResposta?.id === resp.id ? 'bg-accent/10 border-l-2 border-l-accent' : 'hover:bg-surface-alt'"
          @click="handleSelectResposta(resp)"
        >
          <!-- Avatar -->
          <div
            class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            :class="selectedResposta?.id === resp.id ? 'bg-accent text-white' : 'bg-surface-alt text-secondary'"
          >
            {{ resp.aluno_nome.charAt(0).toUpperCase() }}
          </div>

          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-primary truncate">{{ resp.aluno_nome }}</p>
            <p class="text-xs text-secondary truncate">{{ resp.aluno_email }}</p>
          </div>

          <!-- Nota badge -->
          <span
            v-if="resp.nota !== null && resp.nota !== undefined"
            class="text-xs font-bold shrink-0"
            :class="scoreColor(resp.nota)"
          >{{ resp.nota }}</span>
          <span v-else class="text-xs text-secondary shrink-0 italic">—</span>
        </div>
      </aside>

      <!-- Painel de detalhe (direita) -->
      <main class="flex-1 min-w-0 flex flex-col overflow-hidden">

        <!-- Nenhum selecionado -->
        <EmptyState v-if="!selectedResposta" icon="person_search" message="Selecione um aluno à esquerda para ver e avaliar as respostas." class="my-auto" />

        <template v-else>
          <!-- Header do aluno selecionado (fixo) -->
          <div class="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-line bg-surface-alt">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-md bg-accent flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs">
                {{ selectedResposta.aluno_nome.charAt(0).toUpperCase() }}
              </div>
              <div class="min-w-0">
                <h4 class="font-bold text-primary text-sm leading-tight truncate">{{ selectedResposta.aluno_nome }}</h4>
                <p class="text-secondary text-xs truncate">{{ selectedResposta.aluno_email }} · {{ formatDate(selectedResposta.criado_em) }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span v-if="selectedResposta.nota !== null && selectedResposta.nota !== undefined"
                class="text-xs font-bold px-2.5 py-1 rounded-md bg-surface border border-line"
                :class="scoreColor(selectedResposta.nota)">
                Nota: {{ selectedResposta.nota }}/100
              </span>
              <BaseButton variant="danger" size="sm" title="Excluir resposta" @click="requestDeleteResposta(selectedResposta.id)">
                <span class="material-icons text-sm">delete</span>
              </BaseButton>
            </div>
          </div>

          <!-- Área scrollável: avaliação + respostas -->
          <div class="flex-1 overflow-y-auto">

            <!-- Formulário de avaliação (Feedback à esquerda, Nota + Salvar à direita) -->
            <div class="sticky top-0 z-10 bg-surface-alt border-b border-line px-5 py-4 shadow-xs">
              <div class="flex flex-col sm:flex-row items-stretch sm:items-start gap-4">
                <div class="flex-1 min-w-0">
                  <BaseTextarea
                    v-model="editingFeedback"
                    :rows="3"
                    label="Comentário Pedagógico / Feedback"
                    placeholder="Escreva um comentário pedagógico para este aluno..."
                  />
                </div>
                <div class="w-full sm:w-44 shrink-0 flex flex-col justify-between self-stretch gap-2">
                  <BaseInput
                    v-model="editingNotaStr"
                    label="Nota (0-100)"
                    type="number"
                    placeholder="Ex: 85"
                  />
                  <BaseButton
                    variant="primary"
                    size="md"
                    class="w-full inline-flex items-center justify-center gap-1.5"
                    :loading="isSavingAvaliacao"
                    @click="handleSaveAvaliacao"
                  >
                    <span class="material-icons text-xs">save</span>
                    <span class="whitespace-nowrap">Salvar Avaliação</span>
                  </BaseButton>
                </div>
              </div>
            </div>

            <!-- Respostas por pergunta -->
            <div class="px-5 py-4 space-y-3">
              <h5 class="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-icons text-sm text-accent">forum</span>
                <span>Respostas Submetidas:</span>
              </h5>

              <div
                v-for="(item, idx) in parseRespostas(selectedResposta.respostas)"
                :key="idx"
                class="rounded-xl border border-line overflow-hidden"
              >
                <div class="flex items-center gap-2 px-4 py-2 bg-surface-alt border-b border-line">
                  <span class="px-2 py-0.5 bg-accent/15 text-accent rounded-md text-xs font-bold shrink-0">Q{{ idx + 1 }}</span>
                  <span class="text-xs font-medium text-primary leading-snug">{{ item.label }}</span>
                </div>
                <div
                  class="px-4 py-3 bg-surface text-sm text-primary leading-relaxed border-t border-line/40 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-4 [&_blockquote]:border-accent [&_blockquote]:pl-3 [&_blockquote]:italic [&_pre]:bg-surface-alt [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:font-mono [&_pre]:text-xs [&_pre]:border [&_pre]:border-line [&_pre]:overflow-x-auto [&_code]:font-mono [&_code]:text-xs max-w-none"
                  v-html="sanitizeRichText(item.value)"
                ></div>
              </div>
            </div>
          </div>
        </template>
      </main>
    </div>

    <template #footer>
      <div class="flex justify-between items-center text-xs text-secondary">
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
