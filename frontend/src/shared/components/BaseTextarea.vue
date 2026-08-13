<script setup lang="ts">
import { computed, useId } from 'vue'

const props = defineProps<{
  label?: string
  placeholder?: string
  rows?: number
  error?: string
  disabled?: boolean
  id?: string
}>()

const model = defineModel<string>()

const inputId = computed(() => props.id ?? useId())
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="label" :for="inputId" class="block text-sm font-semibold text-primary mb-1.5">{{ label }}</label>
    <textarea
      :id="inputId"
      v-model="model"
      :placeholder="placeholder"
      :rows="rows ?? 4"
      :disabled="disabled"
      class="w-full px-4 py-3 bg-surface border rounded-control text-primary outline-none focus:ring-2 focus:ring-accent resize-y"
      :class="error ? 'border-danger' : 'border-line'"
    ></textarea>
    <p v-if="error" class="text-xs text-danger-text">{{ error }}</p>
  </div>
</template>
