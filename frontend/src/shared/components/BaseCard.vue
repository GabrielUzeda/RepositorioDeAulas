<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    padded?: boolean;
    shadow?: boolean;
    hoverable?: boolean;
  }>(),
  {
    title: '',
    padded: true,
    shadow: true,
    hoverable: false,
  }
);
</script>

<template>
  <div
    class="rounded-md border border-line bg-surface-alt text-primary transition-all duration-base"
    :class="[
      shadow ? 'shadow-card' : '',
      hoverable ? 'card-hover cursor-pointer' : '',
    ]"
  >
    <div v-if="title || $slots.header" class="border-b border-line px-5 py-3.5">
      <slot name="header">
        <h3 class="text-sm font-semibold text-primary">{{ title }}</h3>
      </slot>
    </div>

    <div :class="padded ? 'px-5 py-4' : ''">
      <slot />
    </div>

    <div v-if="$slots.footer" class="border-t border-line px-5 py-3.5">
      <slot name="footer" />
    </div>
  </div>
</template>
