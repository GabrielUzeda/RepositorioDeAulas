<script setup lang="ts">
defineProps<{
  icon?: string
  title?: string
  message?: string
}>()
</script>

<template>
  <div class="text-center py-12 bg-surface-alt rounded-card border border-line text-secondary">
    <span v-if="icon" class="material-icons text-4xl mb-2 block">{{ icon }}</span>
    <p v-if="title" class="text-lg font-semibold text-primary">{{ title }}</p>
    <p v-if="message" class="text-sm">{{ message }}</p>
    <div v-if="$slots.action" class="mt-4">
      <slot name="action" />
    </div>
  </div>
</template>
