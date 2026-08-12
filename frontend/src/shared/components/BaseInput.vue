<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    label?: string;
    type?: string;
    placeholder?: string;
    error?: string;
    disabled?: boolean;
    id?: string;
  }>(),
  {
    modelValue: '',
    type: 'text',
    placeholder: '',
    error: '',
    disabled: false,
    id: ''
  }
);

const model = defineModel<string>({ required: false });

const inputId = computed(
  () => props.id || `base-input-${Math.random().toString(36).slice(2, 8)}`
);
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="label" :for="inputId" class="text-sm font-medium text-secondary">{{ label }}</label>
    <input
      :id="inputId"
      :type="type"
      v-model="model"
      :placeholder="placeholder"
      :disabled="disabled"
      class="rounded-md border bg-surface px-3 py-2 text-sm text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
      :class="error ? 'border-danger' : 'border-line'"
    />
    <p v-if="error" class="text-xs text-danger">{{ error }}</p>
  </div>
</template>
