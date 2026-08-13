<script setup lang="ts">
import { computed } from 'vue';
import type { Atividade } from '@/shared/types';
import BaseContentCard from '@/shared/components/BaseContentCard.vue';

const props = defineProps<{
  atividade: Atividade;
  isLocked: boolean;
}>();

const emit = defineEmits<(e: 'click', atividade: Atividade) => void>();

const typeConfig = computed(() => {
  switch (props.atividade.tipo) {
    case 'prova':
      return {
        color: 'bg-cat-default',
        icon: 'quiz',
        label: 'Prova',
        badgeVariant: 'accent' as const,
      };
    case 'minigame':
      return {
        color: 'bg-cat-minigame',
        icon: 'sports_esports',
        label: 'Minigame',
        badgeVariant: 'warning' as const,
      };
    case 'roleta':
      return {
        color: 'bg-cat-roleta',
        icon: 'casino',
        label: 'Roleta',
        badgeVariant: 'warning' as const,
      };
    case 'reforco':
      return {
        color: 'bg-cat-reforco',
        icon: 'fitness_center',
        label: 'Reforço',
        badgeVariant: 'success' as const,
      };
    default:
      return {
        color: 'bg-cat-default',
        icon: 'assignment',
        label: 'Discursiva',
        badgeVariant: 'accent' as const,
      };
  }
});
</script>

<template>
  <BaseContentCard
    :title="props.atividade.titulo"
    :description="props.atividade.descricao || 'Atividade interativa disponível.'"
    :icon="props.atividade.icone || typeConfig.icon"
    :color="typeConfig.color"
    :badge-text="typeConfig.label"
    :badge-variant="typeConfig.badgeVariant"
    action-text="Iniciar atividade"
    action-icon="arrow_forward"
    :is-locked="props.isLocked"
    @click="emit('click', props.atividade)"
  />
</template>
