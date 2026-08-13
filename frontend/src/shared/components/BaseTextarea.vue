<script setup lang="ts">
import { computed, useId } from 'vue'

const props = defineProps<{
  label?: string
  placeholder?: string
  rows?: number
  error?: string
  hint?: string
  disabled?: boolean
  id?: string
  required?: boolean
}>()

const model = defineModel<string>()

const inputId = computed(() => props.id ?? useId())
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label
      v-if="label"
      :for="inputId"
      class="text-sm font-medium text-primary"
    >
      {{ label }}
      <span v-if="required" class="text-danger ml-0.5" aria-hidden="true">*</span>
    </label>

    <textarea
      :id="inputId"
      v-model="model"
      :placeholder="placeholder"
      :rows="rows ?? 4"
      :disabled="disabled"
      class="w-full rounded-sm border bg-surface-alt px-3 py-2.5 text-sm text-primary placeholder:text-muted transition-all duration-base focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface resize-y disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface"
      :class="error ? 'border-danger focus:ring-danger' : 'border-line hover:border-line-strong'"
    ></textarea>

    <p v-if="error" class="flex items-center gap-1 text-xs text-danger-text" role="alert">
      <span class="material-icons text-[14px]">error_outline</span>
      {{ error }}
    </p>
    <p v-else-if="hint" class="text-xs text-muted">{{ hint }}</p>
  </div>
</template>
