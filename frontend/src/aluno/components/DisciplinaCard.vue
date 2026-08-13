<script setup lang="ts">
import type { Disciplina } from '@/shared/types';
import BaseContentCard from '@/shared/components/BaseContentCard.vue';

const props = defineProps<{
  disciplina: Disciplina;
}>();

const emit = defineEmits<(e: 'select', disciplina: Disciplina) => void>();
</script>

<template>
  <BaseContentCard
    :title="props.disciplina.nome"
    :description="props.disciplina.descricao || 'Clique para visualizar as aulas e atividades.'"
    :icon="props.disciplina.icone || 'menu_book'"
    :color="props.disciplina.cor || 'bg-accent'"
    action-text="Ver conteúdo"
    action-icon="arrow_forward"
    @click="emit('select', props.disciplina)"
  />
</template>
