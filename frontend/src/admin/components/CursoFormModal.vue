<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import ColorPicker from '@/professor/components/ColorPicker.vue';
import IconPicker from '@/professor/components/IconPicker.vue';
import { apiClient } from '@/shared/api/client';
import type { Curso, Professor } from '@/shared/types';

const props = defineProps<{
  show: boolean;
  curso?: Curso | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', data: { nome: string; descricao: string; cor: string; icone: string; professor_ids: number[] }): void;
}>();

const nome = ref('');
const descricao = ref('');
const cor = ref('bg-indigo-600');
const icone = ref('school');
const professores = ref<Professor[]>([]);
const selectedProfessorIds = ref<number[]>([]);
const searchQuery = ref('');

watch(
  () => props.show,
  async (val) => {
    if (val) {
      searchQuery.value = '';
      const resProf = await apiClient.get<Professor[]>('/professores');
      if (resProf.success && resProf.data) {
        professores.value = resProf.data;
      }

      if (props.curso) {
        nome.value = props.curso.nome || '';
        descricao.value = props.curso.descricao || '';
        cor.value = props.curso.cor || 'bg-indigo-600';
        icone.value = props.curso.icone || 'school';
        const res = await apiClient.get<Professor[]>(`/cursos/${props.curso.id}/professores`);
        selectedProfessorIds.value = res.success && res.data ? res.data.map((p) => p.id) : [];
      } else {
        nome.value = '';
        descricao.value = '';
        cor.value = 'bg-indigo-600';
        icone.value = 'school';
        selectedProfessorIds.value = [];
      }
    }
  }
);

// Only list non-admin professors for course assignment since Admins already have global access
const assignableProfessores = computed(() => {
  return professores.value.filter((p) => p.role !== 'admin');
});

const filteredProfessores = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return assignableProfessores.value;
  return assignableProfessores.value.filter(
    (p) => p.nome.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
  );
});

const selectedProfessoresObjects = computed(() => {
  return professores.value.filter((p) => selectedProfessorIds.value.includes(p.id));
});

function toggleProfessor(id: number) {
  const idx = selectedProfessorIds.value.indexOf(id);
  if (idx >= 0) {
    selectedProfessorIds.value.splice(idx, 1);
  } else {
    selectedProfessorIds.value.push(id);
  }
}

function removeProfessor(id: number) {
  const idx = selectedProfessorIds.value.indexOf(id);
  if (idx >= 0) {
    selectedProfessorIds.value.splice(idx, 1);
  }
}

function selectAllFiltered() {
  const filteredIds = filteredProfessores.value.map((p) => p.id);
  const newSet = new Set([...selectedProfessorIds.value, ...filteredIds]);
  selectedProfessorIds.value = Array.from(newSet);
}

function clearAll() {
  selectedProfessorIds.value = [];
}

function handleSubmit() {
  emit('submit', {
    nome: nome.value,
    descricao: descricao.value,
    cor: cor.value,
    icone: icone.value,
    professor_ids: selectedProfessorIds.value
  });
}
</script>

<template>
  <div v-if="props.show" class="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50" @click.self="emit('close')">
    <div class="bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl border border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
      <!-- Header with tight icon fit & generous horizontal padding -->
      <div class="px-8 py-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 shrink-0">
        <div class="flex items-center space-x-3.5">
          <div class="w-11 h-11 shrink-0 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30 flex items-center justify-center shadow-inner">
            <span class="material-icons text-xl">{{ icone || 'school' }}</span>
          </div>
          <div>
            <h3 class="text-xl font-bold text-white leading-tight">{{ props.curso ? 'Editar Curso' : 'Novo Curso' }}</h3>
            <p class="text-xs text-slate-400 mt-0.5">Configure nome, estilização e vincule os professores autorizados</p>
          </div>
        </div>
        <button @click="emit('close')" class="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
          <span class="material-icons">close</span>
        </button>
      </div>

      <!-- Form Body with px-8 padding & custom scrollbar -->
      <form @submit.prevent="handleSubmit" class="px-8 py-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
        <div>
          <label for="curso-nome" class="block text-sm font-semibold text-slate-200 mb-1.5">Nome do Curso *</label>
          <input id="curso-nome" v-model="nome" required type="text" placeholder="Ex: Desenvolvedor Web Fullstack" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600 text-sm" />
        </div>

        <div>
          <label for="curso-desc" class="block text-sm font-semibold text-slate-200 mb-1.5">Descrição do Curso</label>
          <textarea id="curso-desc" v-model="descricao" rows="3" placeholder="Escreva uma descrição completa do conteúdo e objetivos do curso..." class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600 text-sm min-h-[90px] custom-scrollbar resize-y"></textarea>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label class="block text-sm font-semibold text-slate-200 mb-1.5">Ícone do Curso</label>
            <IconPicker v-model="icone" />
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-200 mb-1.5">Cor de Identificação</label>
            <ColorPicker v-model="cor" />
          </div>
        </div>

        <!-- Professor Selector -->
        <div class="space-y-3.5 pt-3 border-t border-slate-800">
          <div class="flex items-center justify-between">
            <label class="block text-sm font-semibold text-slate-200">
              Professores Autorizados
              <span class="text-xs font-normal text-slate-400 ml-1">({{ selectedProfessorIds.length }} selecionados)</span>
            </label>
            <div class="flex items-center space-x-2 text-xs">
              <button type="button" @click="selectAllFiltered" class="text-indigo-400 hover:text-indigo-300 font-medium">Selecionar todos</button>
              <span class="text-slate-600">•</span>
              <button type="button" @click="clearAll" class="text-slate-400 hover:text-slate-200 font-medium">Limpar</button>
            </div>
          </div>

          <!-- Selected Badges Cloud -->
          <div v-if="selectedProfessoresObjects.length > 0" class="flex flex-wrap gap-2 p-2.5 bg-slate-950 border border-slate-800 rounded-2xl max-h-28 overflow-y-auto custom-scrollbar">
            <span
              v-for="p in selectedProfessoresObjects"
              :key="p.id"
              class="inline-flex items-center space-x-1.5 px-3 py-1 bg-indigo-950/80 border border-indigo-700/60 text-indigo-200 text-xs rounded-xl font-medium shadow-sm"
            >
              <span>{{ p.nome }}</span>
              <button type="button" @click="removeProfessor(p.id)" class="text-indigo-400 hover:text-white ml-1">
                <span class="material-icons text-sm leading-none">close</span>
              </button>
            </span>
          </div>

          <!-- Search Filter Input -->
          <div class="relative">
            <span class="material-icons absolute left-3.5 top-3 text-slate-500 text-base">search</span>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar professor por nome ou email..."
              class="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600"
            />
          </div>

          <!-- Toggle Chips Grid -->
          <div v-if="assignableProfessores.length === 0" class="text-xs text-slate-500 text-center py-5">
            Nenhum professor cadastrado no sistema.
          </div>
          <div v-else-if="filteredProfessores.length === 0" class="text-xs text-slate-500 text-center py-5">
            Nenhum professor encontrado para "{{ searchQuery }}".
          </div>
          <div v-else class="max-h-48 overflow-y-auto border border-slate-800 rounded-2xl p-2 bg-slate-950 grid grid-cols-1 gap-1.5 custom-scrollbar">
            <button
              v-for="p in filteredProfessores"
              :key="p.id"
              type="button"
              @click="toggleProfessor(p.id)"
              :class="[
                'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all text-left border',
                selectedProfessorIds.includes(p.id)
                  ? 'bg-indigo-950/60 border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-500/40'
                  : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              ]"
            >
              <div class="flex items-center space-x-3 truncate">
                <span class="material-icons text-slate-400 text-sm">person</span>
                <div class="truncate">
                  <div class="truncate text-slate-200 font-semibold">{{ p.nome }}</div>
                  <div class="truncate text-[10px] text-slate-500">{{ p.email }}</div>
                </div>
              </div>
              <span v-if="selectedProfessorIds.includes(p.id)" class="material-icons text-indigo-400 text-base shrink-0 ml-2">check_circle</span>
              <span v-else class="material-icons text-slate-700 text-base shrink-0 ml-2">radio_button_unchecked</span>
            </button>
          </div>
        </div>
      </form>

      <!-- Footer with px-8 horizontal padding -->
      <div class="px-8 py-4 border-t border-slate-800 flex justify-end space-x-3 bg-slate-900/90 shrink-0">
        <button @click="emit('close')" type="button" class="px-5 py-2.5 text-slate-400 hover:text-white rounded-xl text-xs font-medium transition-colors">Cancelar</button>
        <button @click="handleSubmit" type="button" class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all">Salvar Curso</button>
      </div>
    </div>
  </div>
</template>
