<script setup lang="ts">
import BaseButton from '@/shared/components/BaseButton.vue';

withDefaults(
  defineProps<{
    label?: string;
    variant?: 'secondary' | 'ghost' | 'primary';
    size?: 'xs' | 'sm' | 'md';
  }>(),
  {
    label: 'Voltar',
    variant: 'secondary',
    size: 'xs',
  }
);

const emit = defineEmits<(e: 'click') => void>();
</script>

<template>
  <BaseButton
    :variant="variant"
    :size="size"
    @click="emit('click')"
    class="flex-shrink-0"
    :aria-label="label ? `Voltar: ${label}` : 'Voltar'"
  >
    <span class="material-icons text-[14px]">arrow_back</span>
    <span>{{ label }}</span>
  </BaseButton>
</template>
