<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    label?: string;
    error?: string;
    options?: Array<{ label: string; value: string | number }>;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
  }>(),
  {
    label: '',
    error: '',
    options: () => [],
    placeholder: '',
    disabled: false,
    id: ''
  }
);

const model = defineModel<string | number>({ required: false });

const inputId = computed(
  () => props.id || `base-select-${Math.random().toString(36).slice(2, 8)}`
);
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="label" :for="inputId" class="block text-sm font-semibold text-primary mb-1.5">{{ label }}</label>
    <select
      :id="inputId"
      v-model="model"
      :disabled="disabled"
      class="w-full px-4 py-3 bg-surface border rounded-control text-primary outline-none focus:ring-2 focus:ring-accent"
      :class="error ? 'border-danger' : 'border-line'"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="o in options" :key="String(o.value)" :value="o.value">{{ o.label }}</option>
      <slot />
    </select>
    <p v-if="error" class="text-xs text-danger-text">{{ error }}</p>
  </div>
</template>
