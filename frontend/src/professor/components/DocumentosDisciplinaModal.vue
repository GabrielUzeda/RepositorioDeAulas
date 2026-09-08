<template>
  <BaseModal
    :model-value="modelValue"
    title="Documentos Orientadores (RAG)"
    max-width="max-w-4xl"
    @update:model-value="emit('update:modelValue', $event)"
    @close="emit('close')"
  >
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 -mt-2">
        <p class="text-xs text-secondary">Ementas, planos de ensino e PDFs para contextualizar a inteligência artificial</p>
        
        <!-- Seletor de Escopo: Disciplina vs Curso Inteiro -->
        <div v-if="cursoId" class="flex items-center p-1 bg-surface-alt rounded-xl border border-line shrink-0">
          <button
            type="button"
            :disabled="uploading"
            class="px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            :class="escopoAtivo === 'disciplina' ? 'bg-accent text-white shadow-xs' : 'text-secondary hover:text-primary'"
            @click="mudarEscopo('disciplina')"
          >
            <span class="material-icons text-xs">folder</span>
            <span>Esta Disciplina</span>
          </button>
          <button
            type="button"
            :disabled="uploading"
            class="px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            :class="escopoAtivo === 'curso' ? 'bg-accent text-white shadow-xs' : 'text-secondary hover:text-primary'"
            @click="mudarEscopo('curso')"
          >
            <span class="material-icons text-xs">school</span>
            <span>Curso Inteiro</span>
          </button>
        </div>
      </div>

      <!-- Upload area -->
      <div class="p-4 rounded-card border-2 border-dashed border-line bg-surface-alt/50">
        <div class="flex flex-col sm:flex-row items-center gap-4">
          <div class="p-3 bg-accent/10 text-accent rounded-full">
            <span class="material-icons text-2xl">upload_file</span>
          </div>
          <div class="flex-1 text-center sm:text-left">
            <p class="text-sm font-semibold text-primary">
              {{ escopoAtivo === 'curso' ? 'Anexar Documento Geral do Curso' : 'Anexar Documento da Disciplina' }}
            </p>
            <p class="text-xs text-secondary mt-0.5">
              {{ escopoAtivo === 'curso' ? 'Documentos do curso ficam disponíveis para todas as disciplinas associadas' : 'Disponível especificamente para as atividades e aulas desta disciplina' }} (PDF, MD, TXT, CSV até 10MB)
            </p>
          </div>
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <input
              ref="fileInput"
              type="file"
              accept=".pdf,.md,.markdown,.txt,.csv"
              class="hidden"
              @change="handleFileUpload"
            />
            <BaseButton
              variant="primary"
              size="sm"
              :disabled="uploading"
              @click="fileInput?.click()"
            >
              <span class="material-icons text-sm mr-1">attach_file</span>
              {{ uploading ? 'Processando...' : 'Selecionar Arquivo' }}
            </BaseButton>
          </div>
        </div>
        <p v-if="uploadError" class="text-xs text-danger mt-2 text-center sm:text-left">{{ uploadError }}</p>
      </div>

      <!-- Document List -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-bold text-primary flex items-center gap-1.5">
            <span class="material-icons text-base text-accent">
              {{ escopoAtivo === 'curso' ? 'school' : 'folder' }}
            </span>
            <span>
              {{ escopoAtivo === 'curso' ? 'Documentos do Curso' : 'Documentos da Disciplina' }} ({{ documentos.length }})
            </span>
          </h4>
          <span class="text-xs text-secondary">A IA usará estes documentos para criar questões precisas</span>
        </div>

        <div v-if="loading" class="py-8 text-center text-secondary">
          <BaseSpinner size="md" text="Carregando documentos..." />
        </div>

        <EmptyState
          v-else-if="documentos.length === 0"
          icon="description"
          :title="escopoAtivo === 'curso' ? 'Nenhum documento geral do curso adicionado' : 'Nenhum documento da disciplina adicionado'"
          :description="escopoAtivo === 'curso' ? 'Envie diretrizes ou matrizes que se aplicam a todo o curso' : 'Envie a ementa ou plano de ensino para gerar atividades contextualizadas'"
        />

        <div v-else class="space-y-2 max-h-72 overflow-y-auto pr-1">
          <div
            v-for="doc in documentos"
            :key="doc.id"
            class="flex items-center justify-between p-3 rounded-card bg-surface-alt border border-line hover:border-accent/40 transition-colors"
          >
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <span class="material-icons text-xl text-accent flex-shrink-0">
                {{ doc.tipo === 'pdf' ? 'picture_as_pdf' : 'article' }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-primary truncate">{{ doc.titulo }}</p>
                <div class="flex items-center gap-2 text-xs text-secondary mt-0.5 flex-wrap">
                  <span class="uppercase font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface border border-line">
                    {{ doc.tipo }}
                  </span>
                  <span v-if="doc.disciplina_id === null || doc.disciplina_id === undefined" class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-secondary/15 text-secondary">
                    Geral do Curso
                  </span>
                  <span>{{ formatBytes(doc.tamanho_bytes || 0) }}</span>
                  <span>•</span>
                  <span>{{ formatDate(doc.criado_em) }}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1 ml-2">
              <button
                type="button"
                class="p-1.5 text-secondary hover:text-danger rounded-control hover:bg-surface transition-colors"
                title="Excluir documento"
                @click="confirmDelete(doc.id)"
              >
                <span class="material-icons text-base">delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end">
        <BaseButton variant="secondary" size="sm" @click="emit('close')">
          Fechar
        </BaseButton>
      </div>
    </template>
  </BaseModal>

  <ConfirmDialog
    v-model="showConfirmDelete"
    title="Excluir Documento Orientador"
    message="Deseja realmente remover este documento orientador? A IA deixará de utilizá-lo como referência."
    confirm-text="Excluir"
    :danger="true"
    :loading="isDeletingDoc"
    @confirm="executeDelete"
  />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { apiClient } from '@/shared/api/client';
import BaseModal from '@/shared/components/BaseModal.vue';
import BaseButton from '@/shared/components/BaseButton.vue';
import BaseSpinner from '@/shared/components/BaseSpinner.vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue';
import { useToast } from '@/shared/composables/useToast';
import type { DocumentoOrientador } from '@/shared/types';

const props = defineProps<{
  modelValue: boolean;
  disciplinaId?: number | null;
  cursoId?: number | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'close'): void;
}>();

const toast = useToast();
const escopoAtivo = ref<'disciplina' | 'curso'>('disciplina');
const documentos = ref<DocumentoOrientador[]>([]);
const loading = ref(false);
const uploading = ref(false);
const uploadError = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

const showConfirmDelete = ref(false);
const docIdToDelete = ref<number | null>(null);
const isDeletingDoc = ref(false);

function mudarEscopo(novoEscopo: 'disciplina' | 'curso') {
  if (escopoAtivo.value === novoEscopo) return;
  escopoAtivo.value = novoEscopo;
  loadDocumentos();
}

async function loadDocumentos() {
  const isCurso = escopoAtivo.value === 'curso' || !props.disciplinaId;
  const targetId = isCurso ? props.cursoId : props.disciplinaId;
  if (!targetId) return;

  loading.value = true;
  try {
    const endpoint = isCurso
      ? `/cursos/${targetId}/documentos`
      : `/disciplinas/${targetId}/documentos`;

    const res = await apiClient.get<DocumentoOrientador[]>(endpoint);
    if (res.success && res.data) {
      documentos.value = res.data;
    }
  } catch (e: any) {
    console.error('Erro ao carregar documentos:', e);
  } finally {
    loading.value = false;
  }
}

async function handleFileUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const isCurso = escopoAtivo.value === 'curso' || !props.disciplinaId;
  const targetId = isCurso ? props.cursoId : props.disciplinaId;
  if (!targetId) return;

  uploadError.value = '';
  uploading.value = true;

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('arquivo', file);
    formData.append('titulo', file.name.replace(/\.[^/.]+$/, ''));

    const token = apiClient.getProfessorToken();
    const endpoint = isCurso
      ? `/api/cursos/${targetId}/documentos`
      : `/api/disciplinas/${targetId}/documentos`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: formData
    });

    const res = await response.json();
    if (res.success || res.id) {
      toast.success(isCurso ? 'Documento geral do curso anexado com sucesso!' : 'Documento orientador anexado com sucesso!');
      await loadDocumentos();
    } else {
      uploadError.value = res.error || 'Erro ao processar arquivo';
      toast.error(uploadError.value);
    }
  } catch (err: any) {
    uploadError.value = err.message || 'Falha no upload';
    toast.error(uploadError.value);
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}

function confirmDelete(docId: number) {
  docIdToDelete.value = docId;
  showConfirmDelete.value = true;
}

async function executeDelete() {
  if (!docIdToDelete.value) return;

  const isCurso = escopoAtivo.value === 'curso' || !props.disciplinaId;
  const targetId = isCurso ? props.cursoId : props.disciplinaId;
  if (!targetId) return;

  isDeletingDoc.value = true;
  try {
    const endpoint = isCurso
      ? `/cursos/${targetId}/documentos/${docIdToDelete.value}`
      : `/disciplinas/${targetId}/documentos/${docIdToDelete.value}`;

    const res = await apiClient.delete(endpoint);
    if (res.success) {
      documentos.value = documentos.value.filter(d => d.id !== docIdToDelete.value);
      toast.success('Documento orientador removido com sucesso!');
      showConfirmDelete.value = false;
    }
  } catch (e: any) {
    toast.error(e.message || 'Erro ao excluir');
  } finally {
    isDeletingDoc.value = false;
    docIdToDelete.value = null;
  }
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      if (!props.disciplinaId && props.cursoId) {
        escopoAtivo.value = 'curso';
      }
      loadDocumentos();
    }
  },
  { immediate: true }
);
</script>
