<script setup lang="ts">
withDefaults(
  defineProps<{
    height?: string
    width?: string
    rounded?: string
    animated?: boolean
  }>(),
  {
    height: 'h-4',
    width: 'w-full',
    rounded: 'rounded-control',
    animated: true,
  }
)
</script>

<template>
  <div
    role="status"
    aria-label="Carregando..."
    class="bg-line/25 select-none"
    :class="[
      height,
      width,
      rounded,
      animated ? 'animate-pulse' : '',
    ]"
  >
    <span class="sr-only">Carregando...</span>
  </div>
</template>
