<template>
  <div class="fixed top-4 right-4 z-50 flex w-80 max-w-[90vw] flex-col gap-2">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface-alt px-4 py-3 shadow-lg"
      :class="{
        'text-danger': t.type === 'error',
        'text-success': t.type === 'success',
        'text-primary': t.type === 'info',
      }"
    >
      <span class="text-sm font-medium leading-snug">{{ t.message }}</span>
      <button
        type="button"
        class="shrink-0 text-secondary transition-colors hover:text-primary"
        aria-label="Fechar"
        @click="dismiss(t.id)"
      >
        ×
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { toasts, dismiss } = useToast()
</script>
