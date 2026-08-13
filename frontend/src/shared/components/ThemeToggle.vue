<script setup lang="ts">
import { useTheme } from '@/shared/composables/useTheme';

const { theme, toggle } = useTheme();
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface-alt px-3 py-1.5 text-xs font-medium text-secondary transition-all duration-base hover:border-line-strong hover:bg-surface hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    :aria-label="`Alternar para tema ${theme === 'dark' ? 'claro' : 'escuro'}`"
    :title="`Tema ${theme === 'dark' ? 'Claro' : 'Escuro'}`"
    @click="toggle"
  >
    <!-- Sun icon -->
    <svg
      v-if="theme === 'dark'"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="h-3.5 w-3.5"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>

    <!-- Moon icon -->
    <svg
      v-else
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="h-3.5 w-3.5"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>

    <span>{{ theme === 'dark' ? 'Claro' : 'Escuro' }}</span>
  </button>
</template>
