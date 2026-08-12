<script setup lang="ts">
import { ref, computed } from 'vue';
import { useFloatingPanel } from './useFloatingPanel';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const searchQuery = ref('');
const { triggerRef, panelRef, isOpen, panelStyle, toggle, close } = useFloatingPanel();

const ICON_OPTIONS = [
  // Educação & Escola
  { id: 'school', label: 'Escola', category: 'Educação' },
  { id: 'account_balance', label: 'Universidade', category: 'Educação' },
  { id: 'menu_book', label: 'Livro', category: 'Educação' },
  { id: 'auto_stories', label: 'Leitura', category: 'Educação' },
  { id: 'import_contacts', label: 'Textbook', category: 'Educação' },
  { id: 'local_library', label: 'Biblioteca', category: 'Educação' },
  { id: 'class', label: 'Classe', category: 'Educação' },
  { id: 'cast_for_education', label: 'EAD', category: 'Educação' },
  { id: 'history_edu', label: 'História', category: 'Educação' },
  { id: 'styler', label: 'Material', category: 'Educação' },
  { id: 'text_snippet', label: 'Documento', category: 'Educação' },
  { id: 'edit_note', label: 'Resumos', category: 'Educação' },
  { id: 'note', label: 'Anotações', category: 'Educação' },

  // Computação & Tecnologia
  { id: 'computer', label: 'Computador', category: 'Tecnologia' },
  { id: 'terminal', label: 'Código', category: 'Tecnologia' },
  { id: 'code', label: 'Dev', category: 'Tecnologia' },
  { id: 'data_object', label: 'Data', category: 'Tecnologia' },
  { id: 'api', label: 'API', category: 'Tecnologia' },
  { id: 'database', label: 'Banco de Dados', category: 'Tecnologia' },
  { id: 'storage', label: 'Armazenamento', category: 'Tecnologia' },
  { id: 'dns', label: 'Servidor', category: 'Tecnologia' },
  { id: 'cloud', label: 'Nuvem', category: 'Tecnologia' },
  { id: 'memory', label: 'Hardware', category: 'Tecnologia' },
  { id: 'devices', label: 'Dispositivos', category: 'Tecnologia' },
  { id: 'developer_mode', label: 'Dev Mode', category: 'Tecnologia' },
  { id: 'developer_board', label: 'Prototipagem', category: 'Tecnologia' },
  { id: 'web', label: 'Web', category: 'Tecnologia' },
  { id: 'smart_toy', label: 'IA & Robô', category: 'Tecnologia' },

  // Ciências & Exatas
  { id: 'science', label: 'Ciências', category: 'Exatas' },
  { id: 'calculate', label: 'Matemática', category: 'Exatas' },
  { id: 'biotech', label: 'Biotecnologia', category: 'Exatas' },
  { id: 'architecture', label: 'Engenharia', category: 'Exatas' },
  { id: 'psychology', label: 'Lógica', category: 'Exatas' },
  { id: 'functions', label: 'Funções', category: 'Exatas' },
  { id: 'straighten', label: 'Geometria', category: 'Exatas' },
  { id: 'square_foot', label: 'Medição', category: 'Exatas' },
  { id: 'timeline', label: 'Gráficos', category: 'Exatas' },
  { id: 'insights', label: 'Análise', category: 'Exatas' },

  // Arte & Criação
  { id: 'palette', label: 'Artes', category: 'Criação' },
  { id: 'brush', label: 'Design', category: 'Criação' },
  { id: 'draw', label: 'Desenho', category: 'Criação' },
  { id: 'auto_awesome', label: 'Criativo', category: 'Criação' },
  { id: 'movie', label: 'Vídeo', category: 'Criação' },
  { id: 'videocam', label: 'Filmagem', category: 'Criação' },
  { id: 'mic', label: 'Áudio', category: 'Criação' },
  { id: 'music_note', label: 'Música', category: 'Criação' },
  { id: 'graphic_eq', label: 'Sonorização', category: 'Criação' },
  { id: 'camera_alt', label: 'Fotografia', category: 'Criação' },

  // Comunicação & Social
  { id: 'group', label: 'Turma', category: 'Social' },
  { id: 'groups', label: 'Grupos', category: 'Social' },
  { id: 'forum', label: 'Debate', category: 'Social' },
  { id: 'question_answer', label: 'Q&A', category: 'Social' },
  { id: 'chat', label: 'Chat', category: 'Social' },
  { id: 'comment', label: 'Comentários', category: 'Social' },
  { id: 'handshake', label: 'Colaboração', category: 'Social' },
  { id: 'public', label: 'Sociedade', category: 'Social' },
  { id: 'map', label: 'Mapa', category: 'Social' },
  { id: 'email', label: 'E-mail', category: 'Social' },

  // Negócios & Carreira
  { id: 'work', label: 'Negócios', category: 'Carreira' },
  { id: 'business_center', label: 'Empresa', category: 'Carreira' },
  { id: 'badge', label: 'Certificação', category: 'Carreira' },
  { id: 'gavel', label: 'Direito', category: 'Carreira' },
  { id: 'scale', label: 'Justiça', category: 'Carreira' },
  { id: 'trending_up', label: 'Crescimento', category: 'Carreira' },
  { id: 'workspace_premium', label: 'Destaque', category: 'Carreira' },
  { id: 'emoji_events', label: 'Conquistas', category: 'Carreira' },

  // Inovação & Outros
  { id: 'lightbulb', label: 'Inovação', category: 'Outros' },
  { id: 'rocket_launch', label: 'Lançamento', category: 'Outros' },
  { id: 'quiz', label: 'Quiz', category: 'Outros' },
  { id: 'sports_esports', label: 'Jogos', category: 'Outros' },
  { id: 'military_tech', label: 'Tática', category: 'Outros' },
  { id: 'star', label: 'Destaque', category: 'Outros' },
  { id: 'security', label: 'Segurança', category: 'Outros' },
  { id: 'shield', label: 'Proteção', category: 'Outros' },
  { id: 'verified_user', label: 'Verificado', category: 'Outros' },
  { id: 'favorite', label: 'Favorito', category: 'Outros' }
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
  searchQuery.value = '';
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
        <div class="w-8 h-8 rounded-lg bg-surface border border-line text-accent flex items-center justify-center shrink-0">
          <span class="material-icons text-lg">{{ selectedIconObject.id }}</span>
        </div>
        <span class="text-sm font-medium text-secondary truncate">{{ selectedIconObject.label }}</span>
      </div>
      <span class="material-icons text-secondary text-sm transition-transform shrink-0" :class="{ 'rotate-180': isOpen }">unfold_more</span>
    </button>
  </div>

  <!-- Floating Expansive Popover (teleported to body, never affects modal overflow) -->
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
        class="fixed z-[60] w-[340px] bg-surface border border-line shadow-2xl rounded-2xl p-3 space-y-3 max-h-72 flex flex-col"
      >
        <!-- Search Input -->
        <div class="relative shrink-0">
          <span class="material-icons absolute left-3 top-2.5 text-secondary text-sm">search</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Pesquisar entre +80 ícones..."
            class="w-full pl-9 pr-3 py-1.5 bg-surface border border-line rounded-xl text-primary text-xs outline-none focus:ring-2 focus:ring-accent placeholder:text-secondary"
            autofocus
          />
        </div>

        <!-- Icon Grid -->
        <div class="flex-1 overflow-y-auto grid grid-cols-4 gap-1.5 pr-1 custom-scrollbar">
          <button
            v-for="icon in filteredIcons"
            :key="icon.id"
            type="button"
            :title="`${icon.label} (${icon.category})`"
            @click="selectIcon(icon.id)"
            :class="[
              'p-2 rounded-xl border flex flex-col items-center justify-center transition-all',
              props.modelValue === icon.id
                ? 'border-accent bg-surface text-primary ring-2 ring-accent shadow-md font-bold'
                : 'border-line bg-surface hover:bg-surface text-secondary hover:text-primary'
            ]"
          >
            <span class="material-icons text-xl mb-0.5" :class="props.modelValue === icon.id ? 'text-accent' : 'text-secondary'">{{ icon.id }}</span>
            <span class="text-[10px] leading-tight truncate w-full text-center">{{ icon.label }}</span>
          </button>
        </div>
      </div>
    </transition>
  </Teleport>
</template>