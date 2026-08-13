<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
    colorClass?: string
  }>(),
  {
    size: 'md',
    colorClass: undefined,
  },
)

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'text-xl'
    case 'lg':
      return 'text-5xl'
    default:
      return 'text-3xl'
  }
})
</script>

<template>
  <span class="material-icons animate-spin" :class="[sizeClass, colorClass || 'text-primary']">sync</span>
</template>
