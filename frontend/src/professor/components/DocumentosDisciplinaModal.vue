<template>
  <BaseModal
    :model-value="modelValue"
    title="Documentos Orientadores (RAG)"
    max-width="max-w-4xl"
    @update:model-value="emit('update:modelValue', $event)"
    @close="emit('close')"
  >
    <div class="space-y-6">
      <p class="text-xs text-secondary -mt-2">Ementas, planos de aula e PDFs vinculados para contextualizar a IA</p>

      <!-- Upload area -->
      <div class="p-4 rounded-card border-2 border-dashed border-line bg-surface-alt/50">
        <div class="flex flex-col sm:flex-row items-center gap-4">
          <div class="p-3 bg-accent/10 text-accent rounded-full">
            <span class="material-icons text-2xl">upload_file</span>
          </div>
          <div class="flex-1 text-center sm:text-left">
            <p class="text-sm font-semibold text-primary">Anexar Documento Pedagógico</p>
            <p class="text-xs text-secondary mt-0.5">Suporta PDF, Markdown (.md), TXT e CSV (até 5MB)</p>
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
            <span class="material-icons text-base text-accent">folder</span>
            Documentos da Disciplina ({{ documentos.length }})
          </h4>
          <span class="text-xs text-secondary">A IA usará estes documentos para criar questões precisas</span>
        </div>

        <div v-if="loading" class="py-8 text-center text-secondary">
          <BaseSpinner size="md" text="Carregando documentos..." />
        </div>

        <EmptyState
          v-else-if="documentos.length === 0"
          icon="description"
          title="Nenhum documento orientador adicionado"
          description="Envie a ementa ou PDF do curso para gerar atividades contextualizadas"
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
                <div class="flex items-center gap-2 text-xs text-secondary mt-0.5">
                  <span class="uppercase font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface border border-line">
                    {{ doc.tipo }}
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
    variant="danger"
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
  disciplinaId: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'close'): void;
}>();

const toast = useToast();
const documentos = ref<DocumentoOrientador[]>([]);
const loading = ref(false);
const uploading = ref(false);
const uploadError = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

const showConfirmDelete = ref(false);
const docIdToDelete = ref<number | null>(null);
const isDeletingDoc = ref(false);

async function loadDocumentos() {
  if (!props.disciplinaId) return;
  loading.value = true;
  try {
    const res = await apiClient.get<DocumentoOrientador[]>(`/disciplinas/${props.disciplinaId}/documentos`);
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

  uploadError.value = '';
  uploading.value = true;

  try {
    const formData = new FormData();
    formData.append('arquivo', file);
    formData.append('titulo', file.name.replace(/\.[^/.]+$/, ''));

    const token = sessionStorage.getItem('professor_auth');
    const authData = token ? JSON.parse(token) : null;

    const response = await fetch(`/api/disciplinas/${props.disciplinaId}/documentos`, {
      method: 'POST',
      headers: {
        ...(authData?.token ? { Authorization: `Bearer ${authData.token}` } : {})
      },
      body: formData
    });

    const res = await response.json();
    if (res.success) {
      toast.success('Documento orientador anexado com sucesso!');
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
  isDeletingDoc.value = true;
  try {
    const res = await apiClient.delete(`/disciplinas/${props.disciplinaId}/documentos/${docIdToDelete.value}`);
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
    if (open) loadDocumentos();
  },
  { immediate: true }
);
</script>
