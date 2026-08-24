<script setup lang="ts">
import { computed } from 'vue';
import type { Curso } from '@/shared/types';
import BaseContentCard from '@/shared/components/BaseContentCard.vue';

const props = withDefaults(
  defineProps<{
    curso: Curso;
    actionText?: string;
  }>(),
  {
    actionText: 'Ver disciplinas',
  }
);

const emit = defineEmits<(e: 'select', curso: Curso) => void>();

const metaInfo = computed(() => [
  { icon: 'menu_book', label: `${props.curso.total_disciplinas ?? 0} disciplinas` },
  { icon: 'person', label: `${props.curso.total_professores ?? 0} professores` },
]);
</script>

<template>
  <BaseContentCard
    :title="props.curso.nome"
    :description="props.curso.descricao || 'Clique para visualizar as disciplinas deste curso.'"
    :icon="props.curso.icone || 'school'"
    :color="props.curso.cor || 'bg-accent'"
    :meta="metaInfo"
    :action-text="props.actionText"
    action-icon="arrow_forward"
    :is-locked="!!props.curso.possui_senha"
    @click="emit('select', props.curso)"
  >
    <template #header-actions>
      <slot name="header-actions" />
    </template>
  </BaseContentCard>
</template>
