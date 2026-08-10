<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { apiClient } from '@/shared/api/client';
import type { Professor, Curso } from '@/shared/types';

const props = defineProps<{
  show: boolean;
  professor: Professor | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: { nome: string; email: string; password: string; role: string; curso_ids: number[] }): void;
}>();

const nome = ref('');
const email = ref('');
const password = ref('');
const role = ref<'professor' | 'admin'>('professor');
const cursos = ref<Curso[]>([]);
const selectedCursoIds = ref<number[]>([]);
const searchQuery = ref('');
const error = ref('');

watch(
  () => props.show,
  async (open) => {
    if (open) {
      nome.value = props.professor?.nome || '';
      email.value = props.professor?.email || '';
      password.value = '';
      role.value = props.professor?.role === 'admin' ? 'admin' : 'professor';
      searchQuery.value = '';
      error.value = '';

      const resCursos = await apiClient.get<Curso[]>('/cursos');
      if (resCursos.success && resCursos.data) {
        cursos.value = resCursos.data;
      }

      if (props.professor) {
        const res = await apiClient.get<Curso[]>(`/professores/${props.professor.id}/cursos`);
        selectedCursoIds.value = res.success && res.data ? res.data.map((c) => c.id) : [];
      } else {
        selectedCursoIds.value = [];
      }
    }
  }
);

watch(role, async (newRole) => {
  if (newRole === 'professor' && props.professor && selectedCursoIds.value.length === 0) {
    const res = await apiClient.get<Curso[]>(`/professores/${props.professor.id}/cursos`);
    if (res.success && res.data) {
      selectedCursoIds.value = res.data.map((c) => c.id);
    }
  }
});

const filteredCursos = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return cursos.value;
  return cursos.value.filter(
    (c) => c.nome.toLowerCase().includes(q) || (c.descricao && c.descricao.toLowerCase().includes(q))
  );
});

const selectedCursosObjects = computed(() => {
  return cursos.value.filter((c) => selectedCursoIds.value.includes(c.id));
});

function toggleCurso(id: number) {
  const idx = selectedCursoIds.value.indexOf(id);
  if (idx >= 0) {
    selectedCursoIds.value.splice(idx, 1);
  } else {
    selectedCursoIds.value.push(id);
  }
}

function removeCurso(id: number) {
  const idx = selectedCursoIds.value.indexOf(id);
  if (idx >= 0) {
    selectedCursoIds.value.splice(idx, 1);
  }
}

function selectAllFiltered() {
  const filteredIds = filteredCursos.value.map((c) => c.id);
  const newSet = new Set([...selectedCursoIds.value, ...filteredIds]);
  selectedCursoIds.value = Array.from(newSet);
}

function clearAll() {
  if (searchQuery.value.trim()) {
    const filteredIds = new Set(filteredCursos.value.map((c) => c.id));
    selectedCursoIds.value = selectedCursoIds.value.filter((id) => !filteredIds.has(id));
  } else {
    selectedCursoIds.value = [];
  }
}

function handleSubmit() {
  error.value = '';
  if (!nome.value.trim() || !email.value.trim()) {
    error.value = 'Informe nome e email.';
    return;
  }
  if (!props.professor && !password.value) {
    error.value = 'Informe uma senha.';
    return;
  }
  emit('submit', {
    nome: nome.value.trim(),
    email: email.value.trim(),
    password: password.value,
    role: role.value,
    curso_ids: role.value === 'admin' ? [] : selectedCursoIds.value
  });
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-6" @click.self="emit('close')">
    <div class="bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl border border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
      <!-- Header with tight icon fit & generous horizontal padding -->
      <div class="px-8 py-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 shrink-0">
        <div class="flex items-center space-x-3.5">
          <div class="w-11 h-11 shrink-0 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30 flex items-center justify-center shadow-inner">
            <span class="material-icons text-xl">person</span>
          </div>
          <div>
            <h3 class="text-xl font-bold text-white leading-tight">{{ professor ? 'Editar Professor' : 'Novo Professor' }}</h3>
            <p class="text-xs text-slate-400 mt-0.5">Gerencie credenciais e atribuições de disciplinas</p>
          </div>
        </div>
        <button @click="emit('close')" class="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
          <span class="material-icons">close</span>
        </button>
      </div>

      <!-- Form Body with px-8 padding & custom scrollbar -->
      <form @submit.prevent="handleSubmit" class="px-8 py-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
        <div>
          <label for="prof-nome" class="block text-sm font-semibold text-slate-200 mb-1.5">Nome Completo *</label>
          <input id="prof-nome" v-model="nome" type="text" required placeholder="Ex: Maria Silva" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600 text-sm" />
        </div>

        <div>
          <label for="prof-email" class="block text-sm font-semibold text-slate-200 mb-1.5">E-mail Corporativo *</label>
          <input id="prof-email" v-model="email" type="email" required placeholder="exemplo@escola.gov.br" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600 text-sm" />
        </div>

        <div>
          <label for="prof-senha" class="block text-sm font-semibold text-slate-200 mb-1.5">
            Senha
            <span v-if="professor" class="text-slate-500 font-normal">(deixe em branco para manter a atual)</span>
          </label>
          <input id="prof-senha" v-model="password" type="password" placeholder="••••••••" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600 text-sm" />
        </div>

        <div>
          <label for="prof-perfil" class="block text-sm font-semibold text-slate-200 mb-1.5">Perfil de Acesso *</label>
          <select id="prof-perfil" v-model="role" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
            <option value="professor">Professor (Acesso Restrito aos Cursos Vinculados)</option>
            <option value="admin">Administrador (Acesso Irrestrito ao Sistema)</option>
          </select>
        </div>

        <!-- Role = Admin Note -->
        <div v-if="role === 'admin'" class="p-4 bg-indigo-950/40 border border-indigo-800/40 rounded-2xl flex items-start space-x-3.5">
          <span class="material-icons text-indigo-400 text-xl mt-0.5 shrink-0">verified_user</span>
          <div class="text-xs text-slate-300 leading-relaxed">
            <strong class="text-indigo-300 font-semibold block mb-0.5">Acesso Global Ativo</strong>
            Como Administrador, este perfil possui permissão total de gerenciamento de todos os cursos e matérias da plataforma. A vinculação individual de cursos aplica-se apenas a perfis de Professor.
          </div>
        </div>

        <!-- Role = Professor Course Selector -->
        <div v-else class="space-y-3.5 pt-3 border-t border-slate-800">
          <div class="flex items-center justify-between">
            <label class="block text-sm font-semibold text-slate-200">
              Cursos Vinculados
              <span class="text-xs font-normal text-slate-400 ml-1">({{ selectedCursoIds.length }} selecionados)</span>
            </label>
            <div class="flex items-center space-x-2 text-xs">
              <button type="button" @click="selectAllFiltered" class="text-indigo-400 hover:text-indigo-300 font-medium">Selecionar todos</button>
              <span class="text-slate-600">•</span>
              <button type="button" @click="clearAll" class="text-slate-400 hover:text-slate-200 font-medium">Limpar</button>
            </div>
          </div>

          <!-- Selected Badges Cloud -->
          <div v-if="selectedCursosObjects.length > 0" class="flex flex-wrap gap-2 p-2.5 bg-slate-950 border border-slate-800 rounded-2xl max-h-28 overflow-y-auto custom-scrollbar">
            <span
              v-for="c in selectedCursosObjects"
              :key="c.id"
              class="inline-flex items-center space-x-1.5 px-3 py-1 bg-indigo-950/80 border border-indigo-700/60 text-indigo-200 text-xs rounded-xl font-medium shadow-sm"
            >
              <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: c.cor || '#6366f1' }"></span>
              <span>{{ c.nome }}</span>
              <button type="button" @click="removeCurso(c.id)" class="text-indigo-400 hover:text-white ml-1">
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
              placeholder="Buscar curso por nome..."
              class="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600"
            />
          </div>

          <!-- Scalable Toggle Chips Grid -->
          <div v-if="cursos.length === 0" class="text-xs text-slate-500 text-center py-5">
            Nenhum curso cadastrado no sistema.
          </div>
          <div v-else-if="filteredCursos.length === 0" class="text-xs text-slate-500 text-center py-5">
            Nenhum curso encontrado para "{{ searchQuery }}".
          </div>
          <div v-else class="max-h-52 overflow-y-auto border border-slate-800 rounded-2xl p-2 bg-slate-950 grid grid-cols-1 gap-1.5 custom-scrollbar">
            <button
              v-for="c in filteredCursos"
              :key="c.id"
              type="button"
              @click="toggleCurso(c.id)"
              :class="[
                'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all text-left border',
                selectedCursoIds.includes(c.id)
                  ? 'bg-indigo-950/60 border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-500/40'
                  : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              ]"
            >
              <div class="flex items-center space-x-3 truncate">
                <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: c.cor || '#6366f1' }"></span>
                <span class="truncate">{{ c.nome }}</span>
              </div>
              <span v-if="selectedCursoIds.includes(c.id)" class="material-icons text-indigo-400 text-base shrink-0 ml-2">check_circle</span>
              <span v-else class="material-icons text-slate-700 text-base shrink-0 ml-2">radio_button_unchecked</span>
            </button>
          </div>
        </div>

        <div v-if="error" class="p-3.5 bg-rose-950/60 border border-rose-800 text-rose-200 text-xs rounded-xl">
          {{ error }}
        </div>
      </form>

      <!-- Footer with px-8 horizontal padding -->
      <div class="px-8 py-4 border-t border-slate-800 flex justify-end space-x-3 bg-slate-900/90 shrink-0">
        <button @click="emit('close')" type="button" class="px-5 py-2.5 text-slate-400 hover:text-white rounded-xl text-xs font-medium transition-colors">Cancelar</button>
        <button @click="handleSubmit" type="button" class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all">Salvar Professor</button>
      </div>
    </div>
  </div>
</template>
