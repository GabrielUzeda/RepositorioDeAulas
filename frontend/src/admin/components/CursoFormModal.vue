<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
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

onMounted(async () => {
  const res = await apiClient.get<Professor[]>('/professores');
  if (res.success && res.data) {
    professores.value = res.data;
  }
});

watch(
  () => props.show,
  async (val) => {
    if (val) {
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

function toggleProfessor(id: number) {
  const idx = selectedProfessorIds.value.indexOf(id);
  if (idx >= 0) {
    selectedProfessorIds.value.splice(idx, 1);
  } else {
    selectedProfessorIds.value.push(id);
  }
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
  <div v-if="props.show" class="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl space-y-6 relative border border-slate-100" @click.stop>
      <button @click="emit('close')" class="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition">
        <span class="material-icons">close</span>
      </button>

      <h3 class="text-xl font-bold text-slate-800">{{ props.curso ? 'Editar Curso' : 'Novo Curso' }}</h3>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label for="curso-nome" class="block text-sm font-medium text-slate-700 mb-1">Nome do Curso *</label>
          <input id="curso-nome" v-model="nome" required type="text" placeholder="Ex: Web Mobile 2026" class="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label for="curso-desc" class="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
          <textarea id="curso-desc" v-model="descricao" rows="3" placeholder="Descrição do curso para os alunos..." class="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">Cor do Curso</label>
          <ColorPicker v-model="cor" />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">Ícone do Curso</label>
          <IconPicker v-model="icone" />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Professores que podem dar aula neste curso</label>
          <div v-if="professores.length === 0" class="text-sm text-slate-400">Nenhum professor cadastrado.</div>
          <div v-else class="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
            <label
              v-for="prof in professores"
              :key="prof.id"
              class="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <input type="checkbox" :checked="selectedProfessorIds.includes(prof.id)" @change="toggleProfessor(prof.id)" class="w-4 h-4 text-indigo-600 rounded" />
              <span class="text-sm text-slate-700">{{ prof.nome }}</span>
              <span class="text-xs text-slate-400">{{ prof.email }}</span>
            </label>
          </div>
        </div>

        <div class="flex justify-end space-x-3 pt-4 border-t">
          <button @click="emit('close')" type="button" class="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium">Cancelar</button>
          <button type="submit" class="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-md">Salvar Curso</button>
        </div>
      </form>
    </div>
  </div>
</template>
