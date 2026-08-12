<script setup lang="ts">
import { computed } from 'vue';
import type { Atividade } from '@/shared/types';

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
      return { bg: 'bg-surface-alt', text: 'text-accent', cover: '/static/prova.webp' };
    case 'minigame':
      return { bg: 'bg-purple-100', text: 'text-purple-600', cover: '/static/minigame.webp' };
    case 'roleta':
      return { bg: 'bg-pink-100', text: 'text-pink-600', cover: '/static/roleta.webp' };
    case 'reforco':
      return { bg: 'bg-green-100', text: 'text-green-600', cover: '/static/reforco.webp' };
    default:
      return { bg: 'bg-blue-100', text: 'text-blue-600', cover: '/static/normal.webp' };
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
    class="bg-surface-alt rounded-2xl overflow-hidden shadow-md hover:shadow-xl cursor-pointer card-hover relative border border-line flex flex-col justify-between"
  >
    <!-- Cover Header -->
    <div class="h-28 bg-surface-alt relative overflow-hidden">
      <img
        :src="typeStyles.cover"
        :alt="props.atividade.titulo"
        class="w-full h-full object-cover opacity-90 hover:scale-105 transition-transform duration-500"
        @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
      />
      <div class="absolute top-3 left-3">
        <div :class="[typeStyles.bg, 'p-2 rounded-xl shadow-md flex items-center justify-center']">
          <span v-if="props.isLocked" :class="['material-icons text-sm', typeStyles.text]">lock</span>
          <span v-else-if="isMatIcon" :class="['material-icons text-sm', typeStyles.text]">{{ props.atividade.icone }}</span>
          <span v-else :class="[typeStyles.text, 'font-bold text-xs']">{{ props.atividade.icone || '00' }}</span>
        </div>
      </div>
    </div>

    <!-- Content Area -->
    <div class="p-5 space-y-2 flex-1 flex flex-col justify-between">
      <div>
        <h3 class="text-base font-bold text-primary line-clamp-1">{{ props.atividade.titulo }}</h3>
        <p class="text-secondary text-xs mt-1 line-clamp-2">
          {{ props.isLocked ? 'Conteúdo protegido por senha.' : (props.atividade.descricao || 'Atividade interativa.') }}
        </p>
      </div>

      <div class="flex items-center justify-between pt-3 border-t border-line text-xs font-semibold text-accent">
        <span>Acessar Atividade</span>
        <span class="material-icons text-sm">arrow_forward</span>
      </div>
    </div>
  </div>
</template>
