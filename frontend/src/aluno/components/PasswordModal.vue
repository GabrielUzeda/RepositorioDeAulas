<script setup lang="ts">
import { ref } from 'vue';
import BaseModal from '@/shared/components/BaseModal.vue';
import BaseInput from '@/shared/components/BaseInput.vue';
import BaseButton from '@/shared/components/BaseButton.vue';

const props = defineProps<{
  show: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', password: string): void;
}>();

const passwordInput = ref('');

function handleSubmit() {
  if (passwordInput.value) {
    emit('submit', passwordInput.value);
    passwordInput.value = '';
  }
}
</script>

<template>
  <BaseModal
    :model-value="props.show"
    @close="emit('close')"
    :title="props.title || 'Acesso Restrito'"
    max-width="max-w-md"
  >
    <div class="space-y-4">
      <p class="text-sm text-secondary">Esta atividade exige senha de acesso definida pelo professor.</p>
      <BaseInput
        v-model="passwordInput"
        type="password"
        placeholder="Digite a senha"
        autofocus
        @keyup.enter="handleSubmit"
      />
      <div class="flex justify-end space-x-3 pt-2">
        <BaseButton variant="ghost" @click="emit('close')">Cancelar</BaseButton>
        <BaseButton variant="primary" @click="handleSubmit">Confirmar</BaseButton>
      </div>
    </div>
  </BaseModal>
</template>
