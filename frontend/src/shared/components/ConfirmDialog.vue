<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'

withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    message?: string
    confirmText?: string
    cancelText?: string
    danger?: boolean
  }>(),
  {
    title: 'Confirmação',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    danger: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

function onConfirm() {
  emit('confirm')
  emit('update:modelValue', false)
}

function onCancel() {
  emit('cancel')
  emit('update:modelValue', false)
}
</script>

<template>
  <BaseModal :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :title="title">
    <p class="text-secondary">{{ message }}</p>

    <template #footer>
      <div class="flex justify-end gap-3 pt-4">
        <BaseButton variant="secondary" @click="onCancel">{{ cancelText }}</BaseButton>
        <BaseButton :variant="danger ? 'danger' : 'primary'" @click="onConfirm">{{ confirmText }}</BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
