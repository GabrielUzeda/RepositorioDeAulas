<script setup lang="ts">
import { computed } from 'vue';
import type { Aula } from '@/shared/types';

const props = defineProps<{
  aula: Aula;
}>();

const emit = defineEmits<(e: 'open', aula: Aula) => void>();

const isMatIcon = computed(() => {
  const icon = props.aula.icone;
  return icon && (isNaN(Number(icon)) || icon.length > 2);
});
</script>

<template>
  <div
    @click="emit('open', props.aula)"
    class="bg-surface-alt rounded-2xl p-4 shadow-md hover:shadow-xl cursor-pointer card-hover relative border border-line"
  >
    <div class="absolute top-0 left-0 transform -translate-x-1/4 -translate-y-1/4">
      <div class="bg-surface-alt p-3 rounded-full w-12 h-12 flex items-center justify-center shadow-sm flex-shrink-0">
        <span v-if="isMatIcon" class="material-icons text-accent">{{ props.aula.icone }}</span>
        <b v-else class="text-accent text-lg">{{ props.aula.icone || '00' }}</b>
      </div>
    </div>
    <div class="flex items-start justify-between p-4 pt-2">
      <div class="px-2">
        <h3 class="text-lg font-medium text-primary">{{ props.aula.titulo }}</h3>
        <p class="text-secondary text-sm mt-1 line-clamp-2">{{ props.aula.descricao || '' }}</p>
      </div>
      <span class="material-icons text-secondary">open_in_new</span>
    </div>
  </div>
</template>
