<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  show: boolean;
  titulo?: string;
  descricao?: string;
  markdown?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', payload: { titulo: string; descricao: string; markdown: string }): void;
}>();

const titleInput = ref('');
const descInput = ref('');
const markdownInput = ref('');

watch(
  () => props.show,
  (val) => {
    if (val) {
      titleInput.value = props.titulo || '';
      descInput.value = props.descricao || '';
      markdownInput.value = props.markdown || '# Título da Aula\n\n--- \n\n## Conteúdo do Slide 1';
    }
  }
);

function handleSave() {
  emit('save', {
    titulo: titleInput.value,
    descricao: descInput.value,
    markdown: markdownInput.value
  });
}
</script>

<template>
  <div v-if="props.show" class="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex flex-col z-50">
    <!-- Header Bar -->
    <div class="bg-slate-900 px-6 py-4 border-b border-slate-800 flex justify-between items-center text-white">
      <div class="flex items-center space-x-4 flex-1">
        <span class="material-icons text-indigo-400">slideshow</span>
        <input v-model="titleInput" placeholder="Título da Aula" class="bg-slate-800 px-4 py-1.5 rounded-lg border border-slate-700 text-white font-semibold outline-none focus:ring-2 focus:ring-indigo-500 w-64" />
        <input v-model="descInput" placeholder="Descrição rápida" class="bg-slate-800 px-4 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500 flex-1 max-w-md" />
      </div>
      <div class="flex items-center space-x-3">
        <button @click="emit('close')" type="button" class="px-4 py-2 text-slate-400 hover:text-white rounded-lg text-sm font-medium">Cancelar</button>
        <button @click="handleSave" type="button" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-lg">Salvar Aula</button>
      </div>
    </div>

    <!-- Split View Editor -->
    <div class="flex-1 grid grid-cols-1 lg:grid-cols-2 bg-slate-950 overflow-hidden">
      <!-- Markdown Input -->
      <div class="p-4 border-r border-slate-800 flex flex-col">
        <label class="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">Editor Markdown / Marp</label>
        <textarea
          v-model="markdownInput"
          class="flex-1 w-full bg-slate-900 text-slate-100 p-4 font-mono text-sm rounded-xl border border-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          placeholder="Digite seu código Marp Markdown aqui..."
        ></textarea>
      </div>

      <!-- Live Preview -->
      <div class="p-4 flex flex-col bg-slate-900">
        <label class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Preview em Tempo Real</label>
        <div class="flex-1 bg-white rounded-xl overflow-hidden p-6 border border-slate-800 overflow-y-auto">
          <div class="prose max-w-none">
            <pre class="whitespace-pre-wrap font-sans text-slate-800">{{ markdownInput }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
