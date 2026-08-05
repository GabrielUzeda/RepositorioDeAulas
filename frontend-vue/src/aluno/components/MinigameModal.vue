<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue';
import { MinigamePlayer } from './minigame-player';
import type { Atividade } from '@/shared/types';

const props = defineProps<{
  show: boolean;
  atividade: Atividade | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
let player: MinigamePlayer | null = null;

watch(
  () => props.show,
  (val) => {
    if (val && props.atividade) {
      nextTick(() => {
        if (!containerRef.value || player) return;
        player = new MinigamePlayer(props.atividade, () => {
          emit('close');
        });
        player.mount(containerRef.value.id);
      });
    } else if (!val) {
      player?.destroy();
      player = null;
    }
  }
);

onUnmounted(() => {
  player?.destroy();
  player = null;
});
</script>

<template>
  <div v-if="props.show" class="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 z-50">
    <div class="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col border border-slate-800" @click.stop>
      <div class="flex justify-between items-center px-5 py-3 border-b border-slate-800 bg-slate-950">
        <span class="px-3 py-1 bg-cyan-900/60 text-cyan-300 text-xs font-bold rounded-full uppercase tracking-wider">Simulação Tática</span>
        <button @click="emit('close')" class="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div id="mg-modal-container" ref="containerRef" class="relative flex-1 min-h-0"></div>
    </div>
  </div>
</template>
