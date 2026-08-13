<script setup lang="ts">
import { computed } from 'vue';
import type { Curso } from '@/shared/types';
import BaseContentCard from '@/shared/components/BaseContentCard.vue';

const props = defineProps<{
  curso: Curso;
}>();

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
    action-text="Ver disciplinas"
    action-icon="arrow_forward"
    :is-locked="!!props.curso.senha"
    @click="emit('select', props.curso)"
  />
</template>
