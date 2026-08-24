<script setup lang="ts">
import type { Disciplina } from '@/shared/types';
import BaseContentCard from '@/shared/components/BaseContentCard.vue';

const props = withDefaults(
  defineProps<{
    disciplina: Disciplina;
    actionText?: string;
  }>(),
  {
    actionText: 'Ver conteúdo',
  }
);

const emit = defineEmits<(e: 'select', disciplina: Disciplina) => void>();
</script>

<template>
  <BaseContentCard
    :title="props.disciplina.nome"
    :description="props.disciplina.descricao || 'Clique para visualizar as aulas e atividades.'"
    :icon="props.disciplina.icone || 'menu_book'"
    :color="props.disciplina.cor || 'bg-accent'"
    :action-text="props.actionText"
    action-icon="arrow_forward"
    @click="emit('select', props.disciplina)"
  >
    <template #header-actions>
      <slot name="header-actions" />
    </template>
  </BaseContentCard>
</template>
