<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const ICON_OPTIONS = [
  { id: 'group', label: 'Turma' },
  { id: 'school', label: 'Escola' },
  { id: 'menu_book', label: 'Aulas' },
  { id: 'computer', label: 'Computação' },
  { id: 'terminal', label: 'Código' },
  { id: 'science', label: 'Ciências' },
  { id: 'calculate', label: 'Matemática' },
  { id: 'psychology', label: 'Lógica' },
  { id: 'palette', label: 'Artes' },
  { id: 'auto_stories', label: 'Leitura' },
  { id: 'sports_esports', label: 'Jogos' },
  { id: 'quiz', label: 'Provas' },
  { id: 'emoji_events', label: 'Conquistas' },
  { id: 'forum', label: 'Debate' },
  { id: 'military_tech', label: 'Tática' },
  { id: 'gavel', label: 'Direito' }
];

function selectIcon(iconId: string) {
  emit('update:modelValue', iconId);
}
</script>

<template>
  <div class="grid grid-cols-4 sm:grid-cols-8 gap-2 max-h-48 overflow-y-auto p-1 border border-gray-100 rounded-xl bg-gray-50/50">
    <button
      v-for="icon in ICON_OPTIONS"
      :key="icon.id"
      type="button"
      :title="icon.label"
      @click="selectIcon(icon.id)"
      :class="[
        'p-2 rounded-xl border flex flex-col items-center justify-center transition-all',
        props.modelValue === icon.id
          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
          : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white'
      ]"
    >
      <span class="material-icons text-xl">{{ icon.id }}</span>
      <span class="text-[10px] mt-0.5 truncate max-w-[50px]">{{ icon.label }}</span>
    </button>
  </div>
</template>
