<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
    label?: string
  }>(),
  {
    size: 'md',
    label: 'Carregando...',
  }
)
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 text-muted" :aria-label="label" role="status">
    <svg
      class="animate-spin text-accent"
      :class="[
        size === 'sm' ? 'h-5 w-5' : '',
        size === 'md' ? 'h-7 w-7' : '',
        size === 'lg' ? 'h-10 w-10' : '',
      ]"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
      <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <span v-if="label" class="text-xs font-medium">{{ label }}</span>
  </div>
</template>
