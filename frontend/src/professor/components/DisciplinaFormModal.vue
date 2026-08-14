<script setup lang="ts">
import { ref, watch } from 'vue';
import ColorPicker from './ColorPicker.vue';
import IconPicker from './IconPicker.vue';
import type { Disciplina } from '@/shared/types';
import BaseModal from '@/shared/components/BaseModal.vue';
import BaseButton from '@/shared/components/BaseButton.vue';
import BaseInput from '@/shared/components/BaseInput.vue';
import BaseTextarea from '@/shared/components/BaseTextarea.vue';

const props = withDefaults(
  defineProps<{
    show: boolean;
    disciplina: Disciplina | null;
    loading?: boolean;
  }>(),
  {
    loading: false,
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: { nome: string; descricao: string; cor: string; icone: string }): void;
}>();

const nome = ref('');
const descricao = ref('');
const cor = ref('bg-accent');
const icone = ref('school');
const isSubmitting = ref(false);

watch(
  () => props.show,
  (val) => {
    isSubmitting.value = false;
    if (val) {
      if (props.disciplina) {
        nome.value = props.disciplina.nome || '';
        descricao.value = props.disciplina.descricao || '';
        cor.value = props.disciplina.cor || 'bg-accent';
        icone.value = props.disciplina.icone || 'school';
      } else {
        nome.value = '';
        descricao.value = '';
        cor.value = 'bg-accent';
        icone.value = 'school';
      }
    }
  }
);

function handleSubmit() {
  if (isSubmitting.value || props.loading) return;
  isSubmitting.value = true;
  emit('submit', {
    nome: nome.value,
    descricao: descricao.value,
    cor: cor.value,
    icone: icone.value,
  });
}
</script>

<template>
  <BaseModal
    :model-value="props.show"
    :title="props.disciplina ? 'Editar Disciplina' : 'Nova Disciplina'"
    max-width="max-w-xl"
    @close="emit('close')"
  >
    <form @submit.prevent="handleSubmit" class="space-y-5">
      <BaseInput
        v-model="nome"
        label="Nome da Disciplina *"
        placeholder="Ex: Programação Web Mobile"
        :required="true"
        :disabled="props.loading || isSubmitting"
      />

      <BaseTextarea
        v-model="descricao"
        label="Descrição da Disciplina"
        :rows="3"
        placeholder="Descreva os tópicos principais e plano de aula desta disciplina..."
        :disabled="props.loading || isSubmitting"
      />

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        <div>
          <label class="block text-sm font-semibold text-secondary mb-1.5">Ícone da Disciplina</label>
          <IconPicker v-model="icone" />
        </div>

        <div>
          <label class="block text-sm font-semibold text-secondary mb-1.5">Cor de Identificação</label>
          <ColorPicker v-model="cor" />
        </div>
      </div>
    </form>

    <template #footer>
      <div class="flex justify-end gap-3 pt-4">
        <BaseButton variant="ghost" :disabled="props.loading || isSubmitting" @click="emit('close')">Cancelar</BaseButton>
        <BaseButton variant="primary" :loading="props.loading || isSubmitting" @click="handleSubmit">Salvar Disciplina</BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

