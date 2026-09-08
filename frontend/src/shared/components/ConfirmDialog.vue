<script setup lang="ts">
import { nextTick } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    message?: string
    confirmText?: string
    cancelText?: string
    danger?: boolean
    loading?: boolean
  }>(),
  {
    title: 'Confirmação',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    danger: false,
    loading: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

async function onConfirm() {
  if (props.loading) return
  emit('confirm')
  await nextTick()
  if (!props.loading) {
    emit('update:modelValue', false)
  }
}

function onCancel() {
  if (props.loading) return
  emit('cancel')
  emit('update:modelValue', false)
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    @update:model-value="!props.loading && emit('update:modelValue', $event)"
    :title="title"
  >
    <p class="text-secondary">{{ message }}</p>

    <template #footer>
      <div class="flex justify-end gap-3 pt-4">
        <BaseButton variant="secondary" :disabled="loading" @click="onCancel">{{ cancelText }}</BaseButton>
        <BaseButton :variant="danger ? 'danger' : 'primary'" :loading="loading" @click="onConfirm">{{ confirmText }}</BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
