<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useToast } from '@/shared/composables/useToast';
import { validateEmailWithTypo } from '@/shared/utils/emailValidator';
import { apiClient } from '@/shared/api/client';
import type { Atividade, RespostaAluno, Question } from '@/shared/types';
import BaseModal from '../../shared/components/BaseModal.vue';
import BaseButton from '../../shared/components/BaseButton.vue';
import BaseInput from '../../shared/components/BaseInput.vue';
import BaseSelect from '../../shared/components/BaseSelect.vue';
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
const showMobileDetail = ref(false);

const editingNota = ref<number | null>(null);
const editingFeedback = ref('');
const isSavingAll = ref(false);
const isEvaluatingAiBatch = ref(false);
const aiJustificativa = ref('');

const showAiConfigModal = ref(false);
const aiSeveridade = ref<'brando' | 'moderado' | 'rigoroso' | 'sistematico'>('moderado');
const aiObservacoes = ref('');

const severidadeOptions = [
  { value: 'brando', label: 'Brando (Flexível e encorajador)' },
  { value: 'moderado', label: 'Moderado (Equilibrado e padrão)' },
  { value: 'rigoroso', label: 'Rigoroso (Exigência e precisão)' },
  { value: 'sistematico', label: 'Sistemático (Analítico passo a passo)' }
];

const showConfirmDelete = ref(false);
const deleteTargetId = ref<number | null>(null);
const showEditEmailModal = ref(false);
const editingEmail = ref('');
const isSavingEmail = ref(false);

function openEditEmailModal() {
  if (selectedResposta.value) {
    editingEmail.value = selectedResposta.value.aluno_email;
    showEditEmailModal.value = true;
  }
}

async function handleUpdateEmail() {
  if (!selectedResposta.value || isSavingEmail.value) return;
  const validation = validateEmailWithTypo(editingEmail.value);
  if (!validation.isValid) {
    useToast().error(validation.error || 'Formato de e-mail inválido.');
    return;
  }

  isSavingEmail.value = true;
  try {
    const res: any = await apiClient.patch(`/respostas/${selectedResposta.value.id}/email`, {
      novo_email: editingEmail.value.trim().toLowerCase()
    });
    if (res.success) {
      selectedResposta.value.aluno_email = res.aluno_email || editingEmail.value.trim().toLowerCase();
      selectedResposta.value.aluno_email_hash = res.aluno_email_hash;
      const target = respostas.value.find(r => r.id === selectedResposta.value?.id);
      if (target) {
        target.aluno_email = selectedResposta.value.aluno_email;
        target.aluno_email_hash = res.aluno_email_hash;
      }
      useToast().success('E-mail do aluno corrigido com sucesso!');
      showEditEmailModal.value = false;
    } else {
      useToast().error(res.error || 'Erro ao atualizar e-mail.');
    }
  } catch (err: any) {
    useToast().error(err.message || 'Erro ao atualizar e-mail.');
  } finally {
    isSavingEmail.value = false;
  }
}

const editingNotaStr = computed<string>({
  get: () => (editingNota.value === null ? '' : String(editingNota.value)),
  set: (v: string) => {
    const val = v === '' ? null : Number(v);
    editingNota.value = val;
    syncCurrentResposta();
  }
});

function syncCurrentResposta() {
  if (!selectedResposta.value) return;
  selectedResposta.value.nota = editingNota.value;
  selectedResposta.value.feedback = editingFeedback.value;
  const target = respostas.value.find(r => r.id === selectedResposta.value?.id);
  if (target) {
    target.nota = editingNota.value;
    target.feedback = editingFeedback.value;
  }
}

watch(editingFeedback, () => {
  syncCurrentResposta();
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
        Array.from(el.attributes).forEach((attr) => {
          const name = attr.name.toLowerCase();
          const val = attr.value;
          if (name.startsWith('on') || val.replace(/\s+/g, '').toLowerCase().includes('javascript:')) {
            el.removeAttribute(attr.name);
          }
        });
      }
      Array.from(node.childNodes).forEach(sanitizeNode);
    };
    sanitizeNode(doc.body);
    return doc.body.innerHTML;
  } catch {
    return decoded.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

function parseRespostas(raw: any): { label: string; value: string }[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((item, idx) => ({
      label: item?.pergunta || item?.title || item?.enunciado || `Questão ${idx + 1}`,
      value: String(item?.resposta ?? item?.value ?? item ?? '')
    }));
  }
  if (typeof raw === 'object') {
    const questions: Question[] = [];
    if (props.atividade?.json_data) {
      try {
        const data = typeof props.atividade.json_data === 'string'
          ? JSON.parse(props.atividade.json_data)
          : props.atividade.json_data;
        if (Array.isArray(data)) {
          questions.push(...data);
        } else if (data?.questions && Array.isArray(data.questions)) {
          questions.push(...data.questions);
        }
      } catch {}
    }
    return Object.entries(raw).map(([key, val]) => {
      const qIdx = Number(key);
      let label = `Questão ${isNaN(qIdx) ? key : qIdx + 1}`;
      if (!isNaN(qIdx) && questions[qIdx]) {
        label = questions[qIdx].content || questions[qIdx].title || label;
      }
      return { label, value: String(val ?? '') };
    });
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) return parseRespostas(parsed);
    } catch {}
    return [{ label: 'Resposta', value: raw }];
  }
  return [];
}

watch(
  () => props.show,
  (val) => {
    if (val && props.atividade) {
      fetchRespostas();
    } else {
      respostas.value = [];
      selectedResposta.value = null;
      showMobileDetail.value = false;
      aiJustificativa.value = '';
    }
  },
  { immediate: true }
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
  showMobileDetail.value = true;
  aiJustificativa.value = '';
}

async function handleSuggestAiAvaliacaoTodas() {
  if (!props.atividade || isEvaluatingAiBatch.value || respostas.value.length === 0) return;

  isEvaluatingAiBatch.value = true;
  try {
    const res = await apiClient.post<any>('/ai/evaluate-activity-responses', {
      atividade_id: props.atividade.id,
      severidade: aiSeveridade.value,
      observacoes: aiObservacoes.value.trim() || undefined
    });

    if (res.success && res.data) {
      const { avaliados, total, falhas_count, avaliacoes, sucessos } = res.data;
      const updates = Array.isArray(avaliacoes) && avaliacoes.length > 0
        ? avaliacoes
        : (Array.isArray(sucessos) ? sucessos : []);

      for (const item of updates) {
        const target = respostas.value.find((r: RespostaAluno) => r.id === item.id);
        if (target) {
          target.nota = item.nota;
          target.feedback = item.feedback;
        }
      }

      if (selectedResposta.value) {
        const updatedSelected = updates.find((item: any) => item.id === selectedResposta.value?.id);
        if (updatedSelected) {
          selectedResposta.value.nota = updatedSelected.nota;
          selectedResposta.value.feedback = updatedSelected.feedback;
          editingNota.value = updatedSelected.nota ?? null;
          editingFeedback.value = updatedSelected.feedback ?? '';
          if (updatedSelected.justificativa) {
            aiJustificativa.value = updatedSelected.justificativa;
          }
        }
      }

      if (falhas_count > 0) {
        useToast().warning(`${avaliados} de ${total} respostas avaliadas com sucesso (${falhas_count} falha(s)). Lembre-se de clicar em "Salvar Todas" para persistir.`);
      } else {
        useToast().success(`Todas as ${avaliados} respostas foram avaliadas com IA! Clique em "Salvar Todas" para confirmar as notas.`);
      }
    } else {
      useToast().error(res.error || 'Não foi possível corrigir as respostas com IA.');
    }
  } catch (err: any) {
    useToast().error(err.message || 'Erro ao comunicar com o serviço de IA.');
  } finally {
    isEvaluatingAiBatch.value = false;
  }
}

async function handleSalvarTodas() {
  if (!props.atividade || isSavingAll.value || respostas.value.length === 0) return;

  syncCurrentResposta();

  isSavingAll.value = true;
  try {
    const payload = respostas.value.map(r => ({
      id: r.id,
      nota: r.nota,
      feedback: r.feedback
    }));

    const res = await apiClient.post<any>(`/atividades/${props.atividade.id}/salvar-avaliacoes`, {
      avaliacoes: payload
    });

    if (res.success) {
      useToast().success(`Avaliações salvas com sucesso! (${res.data?.total ?? payload.length} resposta(s))`);
    } else {
      useToast().error(res.error || 'Erro ao salvar avaliações.');
    }
  } catch (err: any) {
    useToast().error(err.message || 'Erro ao salvar avaliações.');
  } finally {
    isSavingAll.value = false;
  }
}

function requestDeleteResposta(id: number) {
  deleteTargetId.value = id;
  showConfirmDelete.value = true;
}

const isDeletingResposta = ref(false);

async function handleDeleteResposta(id: number) {
  isDeletingResposta.value = true;
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
      showConfirmDelete.value = false;
      useToast().success('Resposta excluída com sucesso.');
    } else {
      useToast().error('Erro ao excluir resposta.');
    }
  } catch (err: any) {
    useToast().error(err.message || 'Erro ao excluir resposta.');
  } finally {
    isDeletingResposta.value = false;
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
    :model-value="props.show"
    max-width="max-w-6xl"
    allow-fullscreen
    no-padding
    @close="emit('close')"
  >
    <template #header>
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full pr-2">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-md bg-accent flex items-center justify-center text-white shadow-xs shrink-0">
            <span class="material-icons text-[20px]">analytics</span>
          </div>
          <div class="min-w-0">
            <h2 class="text-lg font-bold text-primary leading-tight truncate">{{ props.atividade?.titulo }}</h2>
            <p class="text-xs text-secondary">{{ respostas.length }} resposta{{ respostas.length !== 1 ? 's' : '' }} submetida{{ respostas.length !== 1 ? 's' : '' }}</p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <BaseButton
            variant="ghost"
            size="sm"
            class="text-xs text-secondary hover:text-primary px-2.5 py-1.5 rounded-lg border border-line flex items-center gap-1.5"
            title="Configurar critérios e severidade da IA"
            @click="showAiConfigModal = true"
          >
            <span class="material-icons text-sm text-accent">tune</span>
            <span class="hidden sm:inline">Critérios IA</span>
          </BaseButton>

          <BaseButton
            variant="ghost"
            size="sm"
            :disabled="isEvaluatingAiBatch || respostas.length === 0"
            class="text-xs text-accent font-semibold flex items-center gap-1.5 hover:bg-accent/10 px-3 py-1.5 rounded-lg border border-accent/20"
            title="Corrigir todas as respostas dos alunos com IA"
            @click="handleSuggestAiAvaliacaoTodas"
          >
            <span class="material-icons text-sm" :class="{ 'animate-spin': isEvaluatingAiBatch }">
              {{ isEvaluatingAiBatch ? 'sync' : 'auto_awesome' }}
            </span>
            <span>{{ isEvaluatingAiBatch ? 'Avaliando todas com IA...' : 'Corrigir Todas com IA' }}</span>
          </BaseButton>

          <BaseButton
            variant="primary"
            size="sm"
            :disabled="respostas.length === 0 || isSavingAll"
            :loading="isSavingAll"
            class="text-xs font-semibold flex items-center gap-1.5 px-3 py-1.5"
            title="Salvar todas as avaliações no banco de dados"
            @click="handleSalvarTodas"
          >
            <span class="material-icons text-sm">save</span>
            <span>Salvar Todas</span>
          </BaseButton>
        </div>
      </div>
    </template>

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
    <div v-else class="flex h-full min-h-[60vh] flex-1 overflow-hidden">

      <!-- Lista de alunos (sidebar esquerda) -->
      <aside
        class="w-full lg:w-72 shrink-0 flex flex-col border-r border-line overflow-y-auto bg-surface"
        :class="showMobileDetail ? 'hidden lg:flex' : 'flex'"
      >
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
            <div class="flex items-center gap-1.5">
              <p class="text-sm font-semibold text-primary truncate">{{ resp.aluno_nome }}</p>
              <span v-if="resp.entregue_com_atraso" class="material-icons text-danger text-xs shrink-0" title="Entregue com atraso">schedule</span>
            </div>
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
      <main
        class="flex-1 min-w-0 flex flex-col overflow-hidden"
        :class="!showMobileDetail ? 'hidden lg:flex' : 'flex'"
      >

        <!-- Nenhum selecionado -->
        <EmptyState v-if="!selectedResposta" icon="person_search" message="Selecione um aluno à esquerda para ver e avaliar as respostas." class="my-auto" />

        <template v-else>
          <!-- Header do aluno selecionado (fixo) -->
          <div class="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-line bg-surface-alt">
            <div class="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                class="lg:hidden p-1.5 -ml-1 text-secondary hover:text-primary rounded-lg hover:bg-surface transition"
                title="Voltar à lista de alunos"
                @click="showMobileDetail = false"
              >
                <span class="material-icons text-lg">arrow_back</span>
              </button>
              <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-accent flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0 shadow-xs">
                {{ selectedResposta.aluno_nome.charAt(0).toUpperCase() }}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h4 class="font-bold text-primary text-sm leading-tight truncate">{{ selectedResposta.aluno_nome }}</h4>
                  <span v-if="selectedResposta.entregue_com_atraso" class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-danger/10 text-danger-text border border-danger/30 shrink-0">Atraso</span>
                </div>
                <div class="flex items-center gap-1.5 text-secondary text-xs truncate">
                  <span class="truncate">{{ selectedResposta.aluno_email }}</span>
                  <button
                    type="button"
                    class="text-accent hover:text-primary transition-colors p-0.5 rounded"
                    title="Corrigir e-mail do aluno"
                    @click="openEditEmailModal"
                  >
                    <span class="material-icons text-xs">edit</span>
                  </button>
                  <span>·</span>
                  <span>{{ formatDate(selectedResposta.criado_em) }}</span>
                </div>
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
                <div class="flex-1 min-w-0 space-y-2">
                  <label class="block text-xs font-bold text-primary">Comentário Pedagógico / Feedback</label>
                  <BaseTextarea
                    v-model="editingFeedback"
                    :rows="3"
                    placeholder="Escreva um comentário pedagógico para este aluno..."
                  />
                  <div v-if="aiJustificativa" class="p-2 rounded bg-accent/5 border border-accent/20 text-xs text-secondary flex items-start gap-2">
                    <span class="material-icons text-sm text-accent shrink-0 mt-0.5">info</span>
                    <div>
                      <strong class="text-primary">Justificativa da IA:</strong> {{ aiJustificativa }}
                    </div>
                  </div>
                </div>
                <div class="w-full sm:w-36 shrink-0 flex flex-col justify-start self-stretch gap-2">
                  <BaseInput
                    v-model="editingNotaStr"
                    label="Nota (0-100)"
                    type="number"
                    placeholder="Ex: 85"
                  />
                  <p class="text-[11px] text-secondary leading-tight mt-1">
                    As alterações são salvas ao clicar em <strong class="text-primary">"Salvar Todas"</strong> no topo.
                  </p>
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
                   class="px-4 py-3 bg-surface text-sm text-primary leading-relaxed border-t border-line/40 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-4 [&_blockquote]:border-accent [&_blockquote]:pl-3 [&_blockquote]:italic [&_pre]:bg-surface-alt [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:font-mono [&_pre]:text-xs [&_pre]:border [&_pre]:border-line [&_pre]:overflow-x-auto [&_code]:font-mono [&_code]:text-xs [&_p]:mb-2.5 [&_p:last-child]:mb-0 max-w-none"
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

  <!-- Modal de Configuração de Critérios de IA -->
  <BaseModal
    v-model="showAiConfigModal"
    title="Configuração da Correção com IA"
    max-width="max-w-md"
    @close="showAiConfigModal = false"
  >
    <div class="space-y-4">
      <p class="text-xs text-secondary">
        Personalize o nível de severidade e forneça orientações específicas para a inteligência artificial ao avaliar todas as respostas dos alunos.
      </p>

      <BaseSelect
        v-model="aiSeveridade"
        label="Nível de Severidade da Correção"
        :options="severidadeOptions"
      />

      <div class="space-y-1">
        <label class="block text-sm font-medium text-primary">Orientações e Observações Pedagógicas</label>
        <BaseTextarea
          v-model="aiObservacoes"
          :rows="4"
          placeholder="Ex: 'Seja rigoroso com a sintaxe SQL', 'Considere resposta correta se explicar o conceito mesmo sem citar a fórmula exata', etc."
        />
        <p class="text-[11px] text-muted">Instruções extras que serão injetadas diretamente no critério de avaliação da IA.</p>
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-line">
        <BaseButton variant="primary" size="sm" @click="showAiConfigModal = false">
          <span class="material-icons text-xs mr-1">check</span>
          <span>Aplicar Critérios</span>
        </BaseButton>
      </div>
    </div>
  </BaseModal>

  <!-- Modal de Edição de E-mail do Aluno -->
  <BaseModal
    v-model="showEditEmailModal"
    title="Corrigir E-mail do Aluno"
    max-width="max-w-md"
    @close="showEditEmailModal = false"
  >
    <div class="space-y-4">
      <p class="text-xs text-secondary">
        Atualize o endereço de e-mail cadastrado nesta resposta para que o aluno receba o comprovante e os feedbacks pedagógicos corretamente.
      </p>
      <BaseInput
        v-model="editingEmail"
        type="email"
        label="Novo Endereço de E-mail"
        placeholder="aluno@escola.com"
      />
      <div class="flex justify-end gap-2 pt-2 border-t border-line">
        <BaseButton variant="ghost" size="sm" @click="showEditEmailModal = false">Cancelar</BaseButton>
        <BaseButton variant="primary" size="sm" :loading="isSavingEmail" @click="handleUpdateEmail">
          <span class="material-icons text-xs mr-1">save</span>
          <span>Salvar Alteração</span>
        </BaseButton>
      </div>
    </div>
  </BaseModal>

  <ConfirmDialog
    v-model="showConfirmDelete"
    :danger="true"
    :loading="isDeletingResposta"
    message="Deseja realmente excluir esta resposta do aluno? Esta ação cumpre o direito à eliminação dos dados (Art. 18 LGPD)."
    confirm-text="Excluir"
    @confirm="onConfirmDelete"
    @cancel="showConfirmDelete = false"
  />
</template>
