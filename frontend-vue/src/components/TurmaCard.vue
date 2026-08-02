<script setup lang="ts">
import { computed } from 'vue';
import type { Turma } from '@/types';

const props = defineProps<{
  turma: Turma;
}>();

const emit = defineEmits<{
  (e: 'select', turma: Turma): void;
}>();

const isMatIcon = computed(() => {
  const icon = props.turma.icone;
  return icon && (isNaN(Number(icon)) || icon.length > 2);
});
</script>

<template>
  <div
    @click="emit('select', props.turma)"
    class="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl cursor-pointer card-hover relative flex flex-col justify-between border border-slate-100"
  >
    <div class="absolute top-0 left-0 transform -translate-x-1/4 -translate-y-1/4">
      <div :class="[props.turma.cor || 'bg-indigo-600', 'p-3 rounded-full w-12 h-12 flex items-center justify-center text-white shadow-md']">
        <span v-if="isMatIcon" class="material-icons">{{ props.turma.icone }}</span>
        <b v-else class="text-lg">{{ props.turma.icone || '00' }}</b>
      </div>
    </div>

    <div class="mt-4">
      <div class="flex justify-between items-start">
        <h3 class="text-xl font-semibold text-slate-800 tracking-tight">{{ props.turma.nome }}</h3>
        <span class="material-icons text-slate-400">chevron_right</span>
      </div>
      <p class="text-slate-600 text-sm mt-2 line-clamp-3 whitespace-pre-line">
        {{ props.turma.descricao || 'Clique para visualizar as aulas e atividades.' }}
      </p>
    </div>
  </div>
</template>
