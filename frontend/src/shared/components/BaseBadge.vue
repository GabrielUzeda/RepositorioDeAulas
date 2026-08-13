<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'accent' | 'success' | 'danger' | 'secondary'
    text?: string
  }>(),
  {
    variant: 'accent',
    text: '',
  },
)

const base = 'px-3 py-1 text-xs font-bold rounded-pill uppercase tracking-wider'

const colorClass = computed<string>(() => {
  switch (props.variant) {
    case 'success':
      return 'bg-success text-on-success'
    case 'danger':
      return 'bg-danger text-on-danger'
    case 'secondary':
      return 'bg-surface-alt text-secondary border border-line'
    default:
      return 'bg-accent text-white'
  }
})
</script>

<template>
  <span :class="[base, colorClass]"><slot>{{ text }}</slot></span>
</template>
