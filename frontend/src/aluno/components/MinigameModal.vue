<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue';
import { MinigamePlayer } from './minigame-player';
import type { Atividade } from '@/shared/types';
import BaseModal from '@/shared/components/BaseModal.vue';
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
  <BaseModal :model-value="props.show" max-width="max-w-4xl" @close="emit('close')">
    <template #header>
      <div class="flex justify-between items-center w-full border-b border-line pb-3">
        <span class="px-3 py-1 bg-cat-default-bg text-cat-default text-xs font-bold rounded-full uppercase tracking-wider">Simulação Tática</span>
        <BaseButton variant="ghost" @click="emit('close')">
          <span class="material-icons">close</span>
        </BaseButton>
      </div>
    </template>
    <div id="mg-modal-container" ref="containerRef" class="relative h-[80vh] min-h-0"></div>
  </BaseModal>
</template>
