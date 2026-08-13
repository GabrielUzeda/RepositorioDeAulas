<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue';
import { MinigamePlayer } from './minigame-player';
import type { Atividade } from '@/shared/types';
import BaseButton from '@/shared/components/BaseButton.vue';

const props = withDefaults(defineProps<{
  show: boolean;
  atividade: Atividade | null;
  senhaCurso?: string;
  senhaAtividade?: string;
}>(), {
  senhaCurso: '',
  senhaAtividade: '',
});

const emit = defineEmits<(e: 'close') => void>();

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
        }, props.senhaCurso, props.senhaAtividade);
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
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="props.show"
        class="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <!-- Floating Close Button at Top Right -->
        <div class="absolute top-4 right-4 z-50">
          <BaseButton
            variant="ghost"
            size="sm"
            @click="emit('close')"
            class="!text-white hover:!bg-white/20"
            aria-label="Fechar simulação tática"
          >
            <span class="material-icons text-xl">close</span>
          </BaseButton>
        </div>

        <!-- Fullscreen Arcade Canvas Container -->
        <div id="mg-modal-container" ref="containerRef" class="relative w-full h-full flex-1"></div>
      </div>
    </Transition>
  </Teleport>
</template>
