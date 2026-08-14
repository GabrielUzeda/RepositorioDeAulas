<script setup lang="ts">
import { ref, watch } from 'vue';
import BaseModal from '@/shared/components/BaseModal.vue';
import BaseInput from '@/shared/components/BaseInput.vue';
import BaseButton from '@/shared/components/BaseButton.vue';

const props = withDefaults(
  defineProps<{
    show: boolean;
    title?: string;
    loading?: boolean;
  }>(),
  {
    loading: false,
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', password: string): void;
}>();

const passwordInput = ref('');
const isSubmitting = ref(false);

watch(
  () => props.show,
  (val) => {
    isSubmitting.value = false;
    if (!val) {
      passwordInput.value = '';
    }
  }
);

function handleSubmit() {
  if (isSubmitting.value || props.loading) return;
  if (passwordInput.value) {
    isSubmitting.value = true;
    emit('submit', passwordInput.value);
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
        :disabled="props.loading || isSubmitting"
        @keyup.enter="handleSubmit"
      />
      <div class="flex justify-end space-x-3 pt-2">
        <BaseButton variant="ghost" :disabled="props.loading || isSubmitting" @click="emit('close')">Cancelar</BaseButton>
        <BaseButton variant="primary" :loading="props.loading || isSubmitting" @click="handleSubmit">Confirmar</BaseButton>
      </div>
    </div>
  </BaseModal>
</template>

