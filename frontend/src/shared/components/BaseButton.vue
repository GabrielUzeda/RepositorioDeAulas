<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    block?: boolean;
    loading?: boolean;
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    disabled: false,
    block: false,
    loading: false,
  }
);
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center gap-2 font-semibold rounded-sm transition-all duration-base focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-alt disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
    :class="[
      block ? 'w-full' : '',

      /* Sizes — (Schoger: padding makes or breaks a button) */
      size === 'xs' ? 'px-2.5 py-1 text-xs tracking-wide' : '',
      size === 'sm' ? 'px-3 py-1.5 text-xs tracking-wide' : '',
      size === 'md' ? 'px-4 py-2 text-sm' : '',
      size === 'lg' ? 'px-5 py-2.5 text-sm' : '',

      /* Variants */
      variant === 'primary'
        ? 'bg-accent text-on-accent shadow-sm hover:bg-accent-hover hover:shadow-md'
        : '',
      variant === 'secondary'
        ? 'border border-line bg-surface-alt text-primary hover:border-line-strong hover:bg-surface shadow-xs'
        : '',
      variant === 'danger'
        ? 'bg-danger text-on-danger shadow-sm hover:bg-danger-hover hover:shadow-md'
        : '',
      variant === 'success'
        ? 'bg-success text-on-success shadow-sm hover:opacity-90 hover:shadow-md'
        : '',
      variant === 'ghost'
        ? 'bg-transparent text-secondary hover:bg-accent-light hover:text-accent'
        : '',
    ]"
  >
    <svg
      v-if="loading"
      class="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <slot />
  </button>
</template>
