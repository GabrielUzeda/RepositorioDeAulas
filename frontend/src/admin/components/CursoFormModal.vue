<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import ColorPicker from '@/professor/components/ColorPicker.vue';
import IconPicker from '@/professor/components/IconPicker.vue';
import { apiClient } from '@/shared/api/client';
import type { Curso, Professor } from '@/shared/types';
import BaseModal from '@/shared/components/BaseModal.vue';
import BaseButton from '@/shared/components/BaseButton.vue';
import BaseInput from '@/shared/components/BaseInput.vue';
import BaseTextarea from '@/shared/components/BaseTextarea.vue';
import BaseSpinner from '@/shared/components/BaseSpinner.vue';

const props = defineProps<{
  show: boolean;
  curso: Curso | null;
  professores: Professor[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: { nome: string; descricao: string; cor: string; icone: string; senha: string; professor_ids: number[] }): void;
}>();

const nome = ref('');
const descricao = ref('');
const cor = ref('bg-accent');
const icone = ref('school');
const senha = ref('');
const removerSenha = ref(false);
const selectedProfessorIds = ref<number[]>([]);
const searchQuery = ref('');
const isSubmitting = ref(false);
const isLoadingProfessores = ref(false);

watch(
  () => props.show,
  (val) => {
    if (val) {
      isSubmitting.value = false;
      removerSenha.value = false;
      senha.value = '';
      if (props.curso) {
        nome.value = props.curso.nome || '';
        descricao.value = props.curso.descricao || '';
        cor.value = props.curso.cor || 'bg-accent';
        icone.value = props.curso.icone || 'school';
        selectedProfessorIds.value = [];
        isLoadingProfessores.value = true;
        apiClient
          .get<{ id: number }[]>(`/cursos/${props.curso.id}/professores`)
          .then((res) => {
            if (res.success && Array.isArray(res.data)) {
              selectedProfessorIds.value = res.data.map((r) => r.id);
            }
          })
          .catch(() => {
            selectedProfessorIds.value = [];
          })
          .finally(() => {
            isLoadingProfessores.value = false;
          });
      } else {
        nome.value = '';
        descricao.value = '';
        cor.value = 'bg-accent';
        icone.value = 'school';
        selectedProfessorIds.value = [];
        isLoadingProfessores.value = false;
      }
      searchQuery.value = '';
    }
  }
);

const filteredProfessores = computed(() => {
  if (!searchQuery.value.trim()) return props.professores;
  const q = searchQuery.value.toLowerCase().trim();
  return props.professores.filter(
    (p) => p.nome.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
  );
});

const selectedProfessoresObjects = computed(() => {
  return props.professores.filter((p) => selectedProfessorIds.value.includes(p.id));
});

function toggleProfessor(id: number) {
  const index = selectedProfessorIds.value.indexOf(id);
  if (index > -1) {
    selectedProfessorIds.value.splice(index, 1);
  } else {
    selectedProfessorIds.value.push(id);
  }
}

function removeProfessor(id: number) {
  const index = selectedProfessorIds.value.indexOf(id);
  if (index > -1) {
    selectedProfessorIds.value.splice(index, 1);
  }
}

function selectAll() {
  selectedProfessorIds.value = props.professores.map((p) => p.id);
}

function clearAll() {
  selectedProfessorIds.value = [];
}

async function handleSubmit() {
  if (isSubmitting.value) return;
  isSubmitting.value = true;
  try {
    let senhaPayload: string | null | undefined ;
    if (props.curso) {
      if (removerSenha.value) {
        senhaPayload = null;
      } else if (senha.value.trim().length > 0) {
        senhaPayload = senha.value.trim();
      } else {
        senhaPayload = undefined; // Manter senha existente no backend
      }
    } else {
      senhaPayload = senha.value.trim().length > 0 ? senha.value.trim() : null;
    }

    const payload: any = {
      nome: nome.value,
      descricao: descricao.value,
      cor: cor.value,
      icone: icone.value,
      professor_ids: selectedProfessorIds.value
    };
    if (senhaPayload !== undefined) {
      payload.senha = senhaPayload;
    }

    await emit('submit', payload);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <BaseModal
    :model-value="show"
    @close="emit('close')"
    :title="curso ? 'Editar Curso' : 'Novo Curso'"
    max-width="max-w-xl"
  >
    <form @submit.prevent="handleSubmit" class="space-y-5">
      <BaseInput
        v-model="nome"
        label="Nome do Curso *"
        placeholder="Ex: Engenharia de Software 2026"
      />

      <BaseTextarea
        v-model="descricao"
        label="Descrição do Curso"
        :rows="3"
        placeholder="Descreva os objetivos, ementa e público-alvo do curso..."
      />

      <div class="space-y-1.5">
        <BaseInput
          v-model="senha"
          :label="curso?.possui_senha ? 'Alterar Senha do Curso (deixe em branco para manter a atual)' : 'Senha de Acesso dos Estudantes (deixe em branco se for de acesso livre)'"
          type="password"
          :placeholder="removerSenha ? 'A senha será removida ao salvar' : (curso?.possui_senha ? '•••••••• (manter senha atual)' : 'Definir senha de acesso')"
          :disabled="removerSenha"
        />
        <div v-if="curso && curso.possui_senha" class="flex items-center justify-between text-xs pt-0.5 px-0.5">
          <span v-if="!removerSenha" class="text-secondary">Este curso possui senha ativa. Preencha apenas para alterá-la.</span>
          <span v-else class="text-danger font-medium">A senha será removida ao salvar (acesso livre).</span>
          <button
            type="button"
            class="text-xs font-semibold underline transition-colors"
            :class="removerSenha ? 'text-accent' : 'text-danger hover:text-danger/80'"
            @click="removerSenha = !removerSenha; if (removerSenha) senha = ''"
          >
            {{ removerSenha ? 'Manter senha protegida' : 'Remover senha do curso' }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        <div>
          <label class="block text-sm font-semibold text-primary mb-1.5">Ícone do Curso</label>
          <IconPicker v-model="icone" />
        </div>

        <div>
          <label class="block text-sm font-semibold text-primary mb-1.5">Cor de Identificação</label>
          <ColorPicker v-model="cor" />
        </div>
      </div>

      <!-- Seleção de Professores -->
      <div class="space-y-2.5 pt-2 border-t border-line">
        <div class="flex items-center justify-between">
          <label class="block text-sm font-semibold text-primary">
            Professores Responsáveis
            <span class="text-xs font-normal text-secondary ml-1">({{ selectedProfessorIds.length }} selecionados)</span>
          </label>
          <div class="flex items-center space-x-2 text-xs">
            <button type="button" @click="selectAll" class="text-accent hover:text-accent font-medium">Selecionar Todos</button>
            <span class="text-secondary">•</span>
            <button type="button" @click="clearAll" class="text-secondary hover:text-primary font-medium">Limpar</button>
          </div>
        </div>

        <div v-if="selectedProfessoresObjects.length > 0" class="flex flex-wrap gap-2 p-2.5 bg-surface border border-line rounded-2xl max-h-28 overflow-y-auto custom-scrollbar">
          <span
            v-for="p in selectedProfessoresObjects"
            :key="p.id"
            class="inline-flex items-center space-x-1.5 px-3 py-1 bg-surface-alt border border-line text-accent text-xs rounded-xl font-medium shadow-sm"
          >
            <span>{{ p.nome }}</span>
            <button type="button" @click="removeProfessor(p.id)" class="text-accent hover:text-primary ml-1">
              <span class="material-icons text-sm leading-none">close</span>
            </button>
          </span>
        </div>

        <div class="relative">
          <span class="material-icons absolute left-3.5 top-3 text-secondary text-base">search</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar professor por nome ou e-mail..."
            class="w-full pl-10 pr-4 py-2.5 bg-surface border border-line rounded-xl text-primary text-xs outline-none focus:ring-2 focus:ring-accent placeholder:text-secondary"
          />
        </div>

        <div v-if="isLoadingProfessores" class="flex items-center justify-center py-6 gap-2 text-xs text-secondary" aria-busy="true">
          <BaseSpinner size="sm" />
          <span>Carregando vinculações...</span>
        </div>
        <div v-else-if="professores.length === 0" class="text-xs text-secondary text-center py-5">
          Nenhum professor cadastrado no sistema.
        </div>
        <div v-else-if="filteredProfessores.length === 0" class="text-xs text-secondary text-center py-5">
          Nenhum professor encontrado para "{{ searchQuery }}".
        </div>
        <div v-else class="max-h-48 overflow-y-auto border border-line rounded-2xl p-2 bg-surface grid grid-cols-1 gap-1.5 custom-scrollbar">
          <button
            v-for="p in filteredProfessores"
            :key="p.id"
            type="button"
            @click="toggleProfessor(p.id)"
            :class="[
              'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all text-left border',
              selectedProfessorIds.includes(p.id)
                ? 'bg-accent border-accent text-white shadow-sm ring-1 ring-accent'
                : 'bg-surface-alt border-line text-secondary hover:bg-surface hover:text-primary'
            ]"
          >
            <div class="flex items-center space-x-3 truncate">
              <div
                :class="[
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  selectedProfessorIds.includes(p.id) ? 'bg-white/20 text-white' : 'bg-surface-alt text-secondary'
                ]"
              >
                {{ p.nome.charAt(0).toUpperCase() }}
              </div>
              <div class="truncate">
                <p :class="['font-medium leading-tight truncate', selectedProfessorIds.includes(p.id) ? 'text-white' : 'text-primary']">{{ p.nome }}</p>
                <p :class="['text-[10px] truncate', selectedProfessorIds.includes(p.id) ? 'text-white/80' : 'text-secondary']">{{ p.email }}</p>
              </div>
            </div>
            <span v-if="selectedProfessorIds.includes(p.id)" class="material-icons text-white text-base shrink-0 ml-2">check_circle</span>
            <span v-else class="material-icons text-secondary text-base shrink-0 ml-2">radio_button_unchecked</span>
          </button>
        </div>
      </div>
    </form>

    <template #footer>
      <div class="flex justify-end gap-3 pt-4">
        <BaseButton variant="ghost" :disabled="isSubmitting" @click="emit('close')">Cancelar</BaseButton>
        <BaseButton variant="primary" :loading="isSubmitting" @click="handleSubmit">Salvar Curso</BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
