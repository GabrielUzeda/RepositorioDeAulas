<script setup lang="ts">
import { computed } from 'vue';
import type { Atividade } from '@/types';

const props = defineProps<{
  atividade: Atividade;
  isLocked: boolean;
}>();

const emit = defineEmits<{
  (e: 'click', atividade: Atividade): void;
}>();

const typeStyles = computed(() => {
  switch (props.atividade.tipo) {
    case 'prova':
      return { bg: 'bg-amber-100', text: 'text-amber-600' };
    case 'minigame':
      return { bg: 'bg-purple-100', text: 'text-purple-600' };
    case 'roleta':
      return { bg: 'bg-pink-100', text: 'text-pink-600' };
    case 'reforco':
      return { bg: 'bg-green-100', text: 'text-green-600' };
    default:
      return { bg: 'bg-blue-100', text: 'text-blue-600' };
  }
});

const isMatIcon = computed(() => {
  const icon = props.atividade.icone;
  return icon && (isNaN(Number(icon)) || icon.length > 2);
});
</script>

<template>
  <div
    @click="emit('click', props.atividade)"
    class="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl cursor-pointer card-hover relative border border-slate-100"
  >
    <div class="absolute top-0 left-0 transform -translate-x-1/4 -translate-y-1/4">
      <div :class="[typeStyles.bg, 'p-3 rounded-full w-12 h-12 flex items-center justify-center shadow-sm']">
        <span v-if="props.isLocked" :class="['material-icons', typeStyles.text]">lock</span>
        <span v-else-if="isMatIcon" :class="['material-icons', typeStyles.text]">{{ props.atividade.icone }}</span>
        <span v-else :class="[typeStyles.text, 'font-bold text-lg']">{{ props.atividade.icone || '00' }}</span>
      </div>
    </div>

    <div class="flex items-start justify-between mt-4">
      <div class="flex flex-1">
        <div class="ml-2 flex-1">
          <h3 class="text-lg font-medium text-gray-800">{{ props.atividade.titulo }}</h3>
          <p class="text-gray-600 text-sm mt-1">
            {{ props.isLocked ? 'Conteúdo protegido por senha.' : (props.atividade.descricao || '') }}
          </p>
        </div>
      </div>
      <span class="material-icons text-gray-400">open_in_new</span>
    </div>
  </div>
</template>
