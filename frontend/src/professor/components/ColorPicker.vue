<script setup lang="ts">
import { computed } from 'vue';
import { useFloatingPanel } from './useFloatingPanel';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const { triggerRef, panelRef, isOpen, panelStyle, toggle, close } = useFloatingPanel();

type ColorOption = { name: string; class: string };

const COLOR_GROUPS: { name: string; colors: ColorOption[] }[] = [
  {
    name: 'Vermelho',
    colors: [
      { name: 'Vermelho 300', class: 'bg-red-300' },
      { name: 'Vermelho 400', class: 'bg-red-400' },
      { name: 'Vermelho 500', class: 'bg-red-500' },
      { name: 'Vermelho 600', class: 'bg-red-600' },
      { name: 'Vermelho 700', class: 'bg-red-700' },
      { name: 'Vermelho 800', class: 'bg-red-800' }
    ]
  },
  {
    name: 'Laranja',
    colors: [
      { name: 'Laranja 300', class: 'bg-orange-300' },
      { name: 'Laranja 400', class: 'bg-orange-400' },
      { name: 'Laranja 500', class: 'bg-orange-500' },
      { name: 'Laranja 600', class: 'bg-orange-600' },
      { name: 'Laranja 700', class: 'bg-orange-700' },
      { name: 'Laranja 800', class: 'bg-orange-800' }
    ]
  },
  {
    name: 'Âmbar',
    colors: [
      { name: 'Âmbar 300', class: 'bg-amber-300' },
      { name: 'Âmbar 400', class: 'bg-amber-400' },
      { name: 'Âmbar 500', class: 'bg-amber-500' },
      { name: 'Âmbar 600', class: 'bg-amber-600' },
      { name: 'Âmbar 700', class: 'bg-amber-700' },
      { name: 'Âmbar 800', class: 'bg-amber-800' }
    ]
  },
  {
    name: 'Amarelo',
    colors: [
      { name: 'Amarelo 300', class: 'bg-yellow-300' },
      { name: 'Amarelo 400', class: 'bg-yellow-400' },
      { name: 'Amarelo 500', class: 'bg-yellow-500' },
      { name: 'Amarelo 600', class: 'bg-yellow-600' },
      { name: 'Amarelo 700', class: 'bg-yellow-700' },
      { name: 'Amarelo 800', class: 'bg-yellow-800' }
    ]
  },
  {
    name: 'Lima',
    colors: [
      { name: 'Lima 300', class: 'bg-lime-300' },
      { name: 'Lima 400', class: 'bg-lime-400' },
      { name: 'Lima 500', class: 'bg-lime-500' },
      { name: 'Lima 600', class: 'bg-lime-600' },
      { name: 'Lima 700', class: 'bg-lime-700' },
      { name: 'Lima 800', class: 'bg-lime-800' }
    ]
  },
  {
    name: 'Verde',
    colors: [
      { name: 'Verde 300', class: 'bg-green-300' },
      { name: 'Verde 400', class: 'bg-green-400' },
      { name: 'Verde 500', class: 'bg-green-500' },
      { name: 'Verde 600', class: 'bg-green-600' },
      { name: 'Verde 700', class: 'bg-green-700' },
      { name: 'Verde 800', class: 'bg-green-800' }
    ]
  },
  {
    name: 'Esmeralda',
    colors: [
      { name: 'Esmeralda 300', class: 'bg-emerald-300' },
      { name: 'Esmeralda 400', class: 'bg-emerald-400' },
      { name: 'Esmeralda 500', class: 'bg-emerald-500' },
      { name: 'Esmeralda 600', class: 'bg-emerald-600' },
      { name: 'Esmeralda 700', class: 'bg-emerald-700' },
      { name: 'Esmeralda 800', class: 'bg-emerald-800' }
    ]
  },
  {
    name: 'Petróleo',
    colors: [
      { name: 'Petróleo 300', class: 'bg-teal-300' },
      { name: 'Petróleo 400', class: 'bg-teal-400' },
      { name: 'Petróleo 500', class: 'bg-teal-500' },
      { name: 'Petróleo 600', class: 'bg-teal-600' },
      { name: 'Petróleo 700', class: 'bg-teal-700' },
      { name: 'Petróleo 800', class: 'bg-teal-800' }
    ]
  },
  {
    name: 'Ciano',
    colors: [
      { name: 'Ciano 300', class: 'bg-cyan-300' },
      { name: 'Ciano 400', class: 'bg-cyan-400' },
      { name: 'Ciano 500', class: 'bg-cyan-500' },
      { name: 'Ciano 600', class: 'bg-cyan-600' },
      { name: 'Ciano 700', class: 'bg-cyan-700' },
      { name: 'Ciano 800', class: 'bg-cyan-800' }
    ]
  },
  {
    name: 'Céu',
    colors: [
      { name: 'Céu 300', class: 'bg-sky-300' },
      { name: 'Céu 400', class: 'bg-sky-400' },
      { name: 'Céu 500', class: 'bg-sky-500' },
      { name: 'Céu 600', class: 'bg-sky-600' },
      { name: 'Céu 700', class: 'bg-sky-700' },
      { name: 'Céu 800', class: 'bg-sky-800' }
    ]
  },
  {
    name: 'Azul',
    colors: [
      { name: 'Azul 300', class: 'bg-blue-300' },
      { name: 'Azul 400', class: 'bg-blue-400' },
      { name: 'Azul 500', class: 'bg-blue-500' },
      { name: 'Azul 600', class: 'bg-blue-600' },
      { name: 'Azul 700', class: 'bg-blue-700' },
      { name: 'Azul 800', class: 'bg-blue-800' }
    ]
  },
  {
    name: 'Índigo',
    colors: [
      { name: 'Índigo 300', class: 'bg-indigo-300' },
      { name: 'Índigo 400', class: 'bg-indigo-400' },
      { name: 'Índigo 500', class: 'bg-indigo-500' },
      { name: 'Índigo 600', class: 'bg-indigo-600' },
      { name: 'Índigo 700', class: 'bg-indigo-700' },
      { name: 'Índigo 800', class: 'bg-indigo-800' }
    ]
  },
  {
    name: 'Violeta',
    colors: [
      { name: 'Violeta 300', class: 'bg-violet-300' },
      { name: 'Violeta 400', class: 'bg-violet-400' },
      { name: 'Violeta 500', class: 'bg-violet-500' },
      { name: 'Violeta 600', class: 'bg-violet-600' },
      { name: 'Violeta 700', class: 'bg-violet-700' },
      { name: 'Violeta 800', class: 'bg-violet-800' }
    ]
  },
  {
    name: 'Roxo',
    colors: [
      { name: 'Roxo 300', class: 'bg-purple-300' },
      { name: 'Roxo 400', class: 'bg-purple-400' },
      { name: 'Roxo 500', class: 'bg-purple-500' },
      { name: 'Roxo 600', class: 'bg-purple-600' },
      { name: 'Roxo 700', class: 'bg-purple-700' },
      { name: 'Roxo 800', class: 'bg-purple-800' }
    ]
  },
  {
    name: 'Fúcsia',
    colors: [
      { name: 'Fúcsia 300', class: 'bg-fuchsia-300' },
      { name: 'Fúcsia 400', class: 'bg-fuchsia-400' },
      { name: 'Fúcsia 500', class: 'bg-fuchsia-500' },
      { name: 'Fúcsia 600', class: 'bg-fuchsia-600' },
      { name: 'Fúcsia 700', class: 'bg-fuchsia-700' },
      { name: 'Fúcsia 800', class: 'bg-fuchsia-800' }
    ]
  },
  {
    name: 'Pink',
    colors: [
      { name: 'Pink 300', class: 'bg-pink-300' },
      { name: 'Pink 400', class: 'bg-pink-400' },
      { name: 'Pink 500', class: 'bg-pink-500' },
      { name: 'Pink 600', class: 'bg-pink-600' },
      { name: 'Pink 700', class: 'bg-pink-700' },
      { name: 'Pink 800', class: 'bg-pink-800' }
    ]
  },
  {
    name: 'Rosa',
    colors: [
      { name: 'Rosa 300', class: 'bg-rose-300' },
      { name: 'Rosa 400', class: 'bg-rose-400' },
      { name: 'Rosa 500', class: 'bg-rose-500' },
      { name: 'Rosa 600', class: 'bg-rose-600' },
      { name: 'Rosa 700', class: 'bg-rose-700' },
      { name: 'Rosa 800', class: 'bg-rose-800' }
    ]
  },
  {
    name: 'Grafite',
    colors: [
      { name: 'Grafite 400', class: 'bg-slate-400' },
      { name: 'Grafite 500', class: 'bg-slate-500' },
      { name: 'Grafite 600', class: 'bg-slate-600' },
      { name: 'Grafite 700', class: 'bg-slate-700' },
      { name: 'Grafite 800', class: 'bg-slate-800' },
      { name: 'Grafite 900', class: 'bg-slate-900' }
    ]
  },
  {
    name: 'Cinza',
    colors: [
      { name: 'Cinza 400', class: 'bg-gray-400' },
      { name: 'Cinza 500', class: 'bg-gray-500' },
      { name: 'Cinza 600', class: 'bg-gray-600' },
      { name: 'Cinza 700', class: 'bg-gray-700' },
      { name: 'Cinza 800', class: 'bg-gray-800' },
      { name: 'Cinza 900', class: 'bg-gray-900' }
    ]
  },
  {
    name: 'Zinco',
    colors: [
      { name: 'Zinco 400', class: 'bg-zinc-400' },
      { name: 'Zinco 500', class: 'bg-zinc-500' },
      { name: 'Zinco 600', class: 'bg-zinc-600' },
      { name: 'Zinco 700', class: 'bg-zinc-700' },
      { name: 'Zinco 800', class: 'bg-zinc-800' },
      { name: 'Zinco 900', class: 'bg-zinc-900' }
    ]
  },
  {
    name: 'Neutro',
    colors: [
      { name: 'Neutro 400', class: 'bg-neutral-400' },
      { name: 'Neutro 500', class: 'bg-neutral-500' },
      { name: 'Neutro 600', class: 'bg-neutral-600' },
      { name: 'Neutro 700', class: 'bg-neutral-700' },
      { name: 'Neutro 800', class: 'bg-neutral-800' },
      { name: 'Neutro 900', class: 'bg-neutral-900' }
    ]
  },
  {
    name: 'Pedra',
    colors: [
      { name: 'Pedra 400', class: 'bg-stone-400' },
      { name: 'Pedra 500', class: 'bg-stone-500' },
      { name: 'Pedra 600', class: 'bg-stone-600' },
      { name: 'Pedra 700', class: 'bg-stone-700' },
      { name: 'Pedra 800', class: 'bg-stone-800' },
      { name: 'Pedra 900', class: 'bg-stone-900' }
    ]
  }
];

const selectedColor = computed(() => {
  for (const group of COLOR_GROUPS) {
    const found = group.colors.find((c) => c.class === props.modelValue);
    if (found) return found;
  }
  return {
    name: props.modelValue?.startsWith('bg-') ? 'Cor personalizada' : 'Padrão',
    class: props.modelValue?.startsWith('bg-') ? props.modelValue : 'bg-accent'
  };
});

function selectColor(colorClass: string) {
  emit('update:modelValue', colorClass);
  close();
}
</script>

<template>
  <div ref="triggerRef">
    <!-- Trigger Button -->
    <button
      type="button"
      @click="toggle"
      @keydown.esc="close"
      class="w-full flex items-center justify-between px-4 py-2.5 bg-surface border border-line rounded-xl text-primary hover:bg-surface transition-colors focus:ring-2 focus:ring-accent"
    >
      <div class="flex items-center space-x-3">
        <div class="w-8 h-8 rounded-full border border-white/20 shadow-inner shrink-0" :class="selectedColor.class"></div>
        <span class="text-sm font-medium text-secondary truncate">{{ selectedColor.name }}</span>
      </div>
      <span class="material-icons text-secondary text-sm transition-transform shrink-0" :class="{ 'rotate-180': isOpen }">unfold_more</span>
    </button>
  </div>

  <!-- Floating Color Panel (teleported to body, never affects modal overflow) -->
  <Teleport to="body">
    <transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 scale-95"
      leave-active-class="transition duration-75 ease-in"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        ref="panelRef"
        :style="panelStyle"
        class="fixed z-[60] w-[320px] max-h-80 overflow-y-auto bg-surface border border-line shadow-2xl rounded-2xl p-3 space-y-2.5 custom-scrollbar"
      >
        <div class="flex items-center justify-between shrink-0 pl-0.5">
          <span class="text-xs font-bold text-secondary uppercase tracking-wide">Cores de Identificação</span>
          <span class="text-[10px] text-secondary">132 cores</span>
        </div>

        <div v-for="group in COLOR_GROUPS" :key="group.name" class="space-y-1">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-secondary pl-0.5">{{ group.name }}</p>
          <div class="grid grid-cols-6 gap-1.5">
            <button
              v-for="color in group.colors"
              :key="color.class"
              type="button"
              :title="color.name"
              @click="selectColor(color.class)"
              class="w-full aspect-square rounded-lg flex items-center justify-center text-white transition-all hover:scale-110 shadow-sm border border-white/15"
              :class="[
                color.class,
                props.modelValue === color.class
                  ? 'ring-2 ring-offset-1 ring-offset-surface ring-white scale-110 shadow-lg'
                  : 'opacity-75 hover:opacity-100'
              ]"
            >
              <span v-if="props.modelValue === color.class" class="material-icons text-xs font-bold drop-shadow">check</span>
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>