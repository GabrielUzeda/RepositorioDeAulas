<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    variant?: 'accent' | 'success' | 'danger' | 'warning' | 'secondary' | 'neutral';
    text?: string;
    dot?: boolean;
    icon?: string;
  }>(),
  {
    variant: 'accent',
    text: '',
    dot: false,
    icon: '',
  }
);

const badgeStyle = computed(() => {
  switch (props.variant) {
    case 'success':
      return {
        classes: 'bg-success-light text-success-text border-success-text/20',
        dot: 'bg-success',
      };
    case 'danger':
      return {
        classes: 'bg-danger-light text-danger-text border-danger-text/20',
        dot: 'bg-danger',
      };
    case 'warning':
      return {
        classes: 'bg-warning-light text-warning-text border-warning-text/20',
        dot: 'bg-warning',
      };
    case 'secondary':
      return {
        classes: 'bg-surface-alt text-secondary border-line',
        dot: 'bg-secondary',
      };
    case 'neutral':
      return {
        classes: 'bg-surface text-muted border-line',
        dot: 'bg-muted',
      };
    default:
      return {
        classes: 'bg-accent-light text-accent-text border-accent-text/20',
        dot: 'bg-accent',
      };
  }
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border tracking-wide flex-shrink-0"
    :class="badgeStyle.classes"
  >
    <span
      v-if="dot"
      class="w-1.5 h-1.5 rounded-full flex-shrink-0"
      :class="badgeStyle.dot"
    />
    <span v-else-if="icon" class="material-icons text-[12px] flex-shrink-0">{{ icon }}</span>
    <slot>{{ text }}</slot>
  </span>
</template>
