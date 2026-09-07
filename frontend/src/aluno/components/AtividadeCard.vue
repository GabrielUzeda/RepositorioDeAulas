<script setup lang="ts">
import { computed } from 'vue';
import type { Atividade } from '@/shared/types';
import BaseContentCard from '@/shared/components/BaseContentCard.vue';
import BaseBadge from '@/shared/components/BaseBadge.vue';

const props = defineProps<{
  atividade: Atividade;
  isLocked: boolean;
}>();

const emit = defineEmits<(e: 'click', atividade: Atividade) => void>();

const deadlineInfo = computed(() => {
  if (!props.atividade.data_limite) return null;
  const deadlineDate = new Date(props.atividade.data_limite);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isExpired = diffMs < 0;

  const formattedDate = deadlineDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  if (isExpired) {
    return {
      text: `Prazo encerrado (${formattedDate})`,
      variant: 'danger' as const,
      icon: 'event_busy'
    };
  }
  if (diffDays <= 2) {
    return {
      text: `Entrega próxima: ${formattedDate}`,
      variant: 'warning' as const,
      icon: 'schedule'
    };
  }
  return {
    text: `Prazo: ${formattedDate}`,
    variant: 'secondary' as const,
    icon: 'event'
  };
});

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
  >
    <template v-if="deadlineInfo" #meta>
      <div class="mt-2 flex items-center">
        <BaseBadge :variant="deadlineInfo.variant" class="text-[11px] gap-1">
          <span class="material-icons text-[13px]">{{ deadlineInfo.icon }}</span>
          {{ deadlineInfo.text }}
        </BaseBadge>
      </div>
    </template>
  </BaseContentCard>
</template>
