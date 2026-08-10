<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const COLOR_OPTIONS = [
  { name: 'Índigo', class: 'bg-indigo-600' },
  { name: 'Azul', class: 'bg-blue-600' },
  { name: 'Ciano', class: 'bg-cyan-600' },
  { name: 'Esmeralda', class: 'bg-emerald-600' },
  { name: 'Âmbar', class: 'bg-amber-500' },
  { name: 'Rosa', class: 'bg-rose-600' },
  { name: 'Roxo', class: 'bg-purple-600' },
  { name: 'Grafite', class: 'bg-slate-700' }
];

function selectColor(colorClass: string) {
  emit('update:modelValue', colorClass);
}
</script>

<template>
  <div class="flex flex-wrap gap-2.5 py-1">
    <button
      v-for="color in COLOR_OPTIONS"
      :key="color.class"
      type="button"
      :title="color.name"
      @click="selectColor(color.class)"
      :class="[
        'w-8 h-8 rounded-full flex items-center justify-center text-white transition-all transform hover:scale-110 shadow-sm border border-white/20',
        color.class,
        props.modelValue === color.class ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-indigo-400 scale-110 opacity-100 shadow-indigo-500/50 shadow-lg' : 'opacity-70 hover:opacity-100'
      ]"
    >
      <span v-if="props.modelValue === color.class" class="material-icons text-xs font-bold">check</span>
    </button>
  </div>
</template>
