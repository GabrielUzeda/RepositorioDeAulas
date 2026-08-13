<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    label?: string;
    error?: string;
    hint?: string;
    options?: Array<{ label: string; value: string | number }>;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    required?: boolean;
  }>(),
  {
    label: '',
    error: '',
    hint: '',
    options: () => [],
    placeholder: '',
    disabled: false,
    id: '',
    required: false,
  }
);

const model = defineModel<string | number>({ required: false });

const inputId = computed(
  () => props.id || `base-select-${Math.random().toString(36).slice(2, 8)}`
);
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" :for="inputId" class="text-sm font-medium text-primary">
      {{ label }}
      <span v-if="required" class="text-danger ml-0.5" aria-hidden="true">*</span>
    </label>

    <div class="relative">
      <select
        :id="inputId"
        v-model="model"
        :disabled="disabled"
        class="w-full appearance-none rounded-sm border bg-surface-alt px-3 py-2 pr-8 text-sm text-primary transition-all duration-base focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface"
        :class="error ? 'border-danger focus:ring-danger' : 'border-line hover:border-line-strong'"
      >
        <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
        <option v-for="o in options" :key="String(o.value)" :value="o.value">{{ o.label }}</option>
        <slot />
      </select>

      <!-- Chevron icon -->
      <span
        class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 material-icons text-muted text-[18px]"
      >expand_more</span>
    </div>

    <p v-if="error" class="flex items-center gap-1 text-xs text-danger-text" role="alert">
      <span class="material-icons text-[14px]">error_outline</span>
      {{ error }}
    </p>
    <p v-else-if="hint" class="text-xs text-muted">{{ hint }}</p>
  </div>
</template>
