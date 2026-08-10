<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const isOpen = ref(false);
const searchQuery = ref('');
const pickerRef = ref<HTMLDivElement | null>(null);

const ICON_OPTIONS = [
  // Educação & Escola
  { id: 'school', label: 'Escola', category: 'Educação' },
  { id: 'menu_book', label: 'Livro', category: 'Educação' },
  { id: 'auto_stories', label: 'Leitura', category: 'Educação' },
  { id: 'class', label: 'Classe', category: 'Educação' },
  { id: 'cast_for_education', label: 'EAD', category: 'Educação' },
  { id: 'history_edu', label: 'História', category: 'Educação' },
  { id: 'local_library', label: 'Biblioteca', category: 'Educação' },
  
  // Computação & Tecnologia
  { id: 'computer', label: 'Computador', category: 'Tecnologia' },
  { id: 'terminal', label: 'Código', category: 'Tecnologia' },
  { id: 'code', label: 'Dev', category: 'Tecnologia' },
  { id: 'data_object', label: 'Data', category: 'Tecnologia' },
  { id: 'memory', label: 'Hardware', category: 'Tecnologia' },
  { id: 'smart_toy', label: 'IA & Robô', category: 'Tecnologia' },
  { id: 'devices', label: 'Dispositivos', category: 'Tecnologia' },
  { id: 'cloud', label: 'Nuvem', category: 'Tecnologia' },
  
  // Ciências & Exatas
  { id: 'science', label: 'Ciências', category: 'Exatas' },
  { id: 'calculate', label: 'Matemática', category: 'Exatas' },
  { id: 'biotech', label: 'Biotecnologia', category: 'Exatas' },
  { id: 'architecture', label: 'Engenharia', category: 'Exatas' },
  { id: 'psychology', label: 'Lógica', category: 'Exatas' },
  { id: 'functions', label: 'Funções', category: 'Exatas' },

  // Arte & Comunicação
  { id: 'palette', label: 'Artes', category: 'Criação' },
  { id: 'brush', label: 'Design', category: 'Criação' },
  { id: 'movie', label: 'Vídeo', category: 'Criação' },
  { id: 'mic', label: 'Áudio', category: 'Criação' },
  { id: 'camera_alt', label: 'Fotografia', category: 'Criação' },

  // Interação & Jogos
  { id: 'sports_esports', label: 'Jogos', category: 'Geral' },
  { id: 'quiz', label: 'Quiz', category: 'Geral' },
  { id: 'emoji_events', label: 'Conquistas', category: 'Geral' },
  { id: 'group', label: 'Turma', category: 'Geral' },
  { id: 'forum', label: 'Debate', category: 'Geral' },
  { id: 'military_tech', label: 'Tática', category: 'Geral' },
  { id: 'gavel', label: 'Direito', category: 'Geral' },
  { id: 'work', label: 'Negócios', category: 'Geral' },
  { id: 'lightbulb', label: 'Inovação', category: 'Geral' }
];

const selectedIconObject = computed(() => {
  return ICON_OPTIONS.find((i) => i.id === props.modelValue) || { id: props.modelValue || 'school', label: 'Personalizado' };
});

const filteredIcons = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return ICON_OPTIONS;
  return ICON_OPTIONS.filter(
    (i) => i.label.toLowerCase().includes(q) || i.id.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
  );
});

function selectIcon(iconId: string) {
  emit('update:modelValue', iconId);
  isOpen.value = false;
}

function handleClickOutside(event: MouseEvent) {
  if (pickerRef.value && !pickerRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div ref="pickerRef" @keydown.esc="isOpen = false" class="relative inline-block w-full">
    <!-- Trigger Button -->
    <button
      type="button"
      @click="isOpen = !isOpen"
      class="w-full flex items-center justify-between px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white hover:bg-slate-900 transition-colors focus:ring-2 focus:ring-indigo-500"
    >
      <div class="flex items-center space-x-3">
        <div class="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0">
          <span class="material-icons text-lg">{{ selectedIconObject.id }}</span>
        </div>
        <span class="text-sm font-medium text-slate-200">{{ selectedIconObject.label }}</span>
      </div>
      <span class="material-icons text-slate-400 text-sm transition-transform" :class="{ 'rotate-180': isOpen }">unfold_more</span>
    </button>

    <!-- Floating Expansive Popover -->
    <div
      v-if="isOpen"
      class="absolute z-50 left-0 right-0 mt-2 bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl p-3 space-y-3 max-h-72 flex flex-col"
    >
      <!-- Search Input -->
      <div class="relative shrink-0">
        <span class="material-icons absolute left-3 top-2.5 text-slate-500 text-sm">search</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Pesquisar entre +35 ícones..."
          class="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600"
          autofocus
        />
      </div>

      <!-- Icon Grid -->
      <div class="flex-1 overflow-y-auto grid grid-cols-4 gap-1.5 pr-1">
        <button
          v-for="icon in filteredIcons"
          :key="icon.id"
          type="button"
          :title="`${icon.label} (${icon.category})`"
          @click="selectIcon(icon.id)"
          :class="[
            'p-2 rounded-xl border flex flex-col items-center justify-center transition-all',
            props.modelValue === icon.id
              ? 'border-indigo-500 bg-indigo-950/80 text-white ring-2 ring-indigo-500/50 shadow-md font-bold'
              : 'border-slate-800 bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white'
          ]"
        >
          <span class="material-icons text-xl mb-0.5" :class="props.modelValue === icon.id ? 'text-indigo-400' : 'text-slate-400'">{{ icon.id }}</span>
          <span class="text-[10px] leading-tight truncate w-full text-center">{{ icon.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
