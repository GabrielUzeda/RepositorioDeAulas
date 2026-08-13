<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    block?: boolean;
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    disabled: false,
    block: false
  }
);
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
    :class="[
      block ? 'w-full' : '',
      size === 'sm' ? 'px-2.5 py-1 text-xs' : '',
      size === 'md' ? 'px-3.5 py-2 text-sm' : '',
      size === 'lg' ? 'px-5 py-2.5 text-base' : '',
      variant === 'primary' ? 'bg-accent text-white hover:opacity-90' : '',
      variant === 'secondary' ? 'border border-line bg-surface-alt text-primary hover:bg-surface' : '',
      variant === 'danger' ? 'bg-danger text-on-danger hover:opacity-90' : '',
      variant === 'ghost' ? 'bg-transparent text-secondary hover:bg-surface-alt' : ''
    ]"
  >
    <slot />
  </button>
</template>
