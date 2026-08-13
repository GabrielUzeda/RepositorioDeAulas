<script setup lang="ts">
import type { Aula } from '@/shared/types';
import BaseContentCard from '@/shared/components/BaseContentCard.vue';

const props = defineProps<{
  aula: Aula;
}>();

const emit = defineEmits<(e: 'open', aula: Aula) => void>();
</script>

<template>
  <BaseContentCard
    :title="props.aula.titulo"
    :description="props.aula.descricao || 'Clique para visualizar a apresentação da aula em Markdown.'"
    :icon="props.aula.icone || 'slideshow'"
    color="bg-accent"
    action-text="Abrir Aula"
    action-icon="open_in_new"
    @click="emit('open', props.aula)"
  />
</template>
