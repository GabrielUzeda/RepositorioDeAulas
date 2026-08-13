<script setup lang="ts">
defineProps<{
  label?: string
  error?: string
  htmlFor?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="label" :for="htmlFor" class="block text-sm font-semibold text-primary mb-1.5">{{ label }}</label>
    <slot />
    <p v-if="error" class="text-xs text-danger-text">{{ error }}</p>
  </div>
</template>
