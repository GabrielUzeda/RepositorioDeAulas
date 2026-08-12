<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    padded?: boolean;
  }>(),
  {
    title: '',
    padded: true
  }
);
</script>

<template>
  <div class="rounded-lg border border-line bg-surface text-primary shadow-sm">
    <div v-if="title || $slots.header" class="border-b border-line px-4 py-3">
      <slot name="header">
        <h3 class="text-base font-semibold text-primary">{{ title }}</h3>
      </slot>
    </div>
    <div :class="padded ? 'p-4' : ''">
      <slot />
    </div>
    <div v-if="$slots.footer" class="border-t border-line px-4 py-3">
      <slot name="footer" />
    </div>
  </div>
</template>
