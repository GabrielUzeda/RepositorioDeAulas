<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    label?: string;
    type?: string;
    placeholder?: string;
    error?: string;
    hint?: string;
    disabled?: boolean;
    id?: string;
    required?: boolean;
    autofocus?: boolean;
    icon?: string;
  }>(),
  {
    modelValue: '',
    type: 'text',
    placeholder: '',
    error: '',
    hint: '',
    disabled: false,
    id: '',
    required: false,
    autofocus: false,
    icon: '',
  }
);

const model = defineModel<string>({ required: false });

const inputId = computed(
  () => props.id || `base-input-${Math.random().toString(36).slice(2, 8)}`
);
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

    <div class="relative">
      <span
        v-if="icon"
        class="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-muted text-[18px] pointer-events-none"
      >{{ icon }}</span>

      <input
        :id="inputId"
        :type="type"
        v-model="model"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :autofocus="autofocus"
        class="w-full rounded-sm border bg-surface-alt px-3 py-2 text-sm text-primary placeholder:text-muted transition-all duration-base focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface"
        :class="[
          error ? 'border-danger focus:ring-danger' : 'border-line hover:border-line-strong',
          icon ? 'pl-9' : '',
        ]"
      />
    </div>

    <p v-if="error" class="flex items-center gap-1 text-xs text-danger-text" role="alert">
      <span class="material-icons text-[14px]">error_outline</span>
      {{ error }}
    </p>
    <p v-else-if="hint" class="text-xs text-muted">{{ hint }}</p>
  </div>
</template>
