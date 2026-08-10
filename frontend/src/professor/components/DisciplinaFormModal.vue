<script setup lang="ts">
import { ref, watch } from 'vue';
import ColorPicker from './ColorPicker.vue';
import IconPicker from './IconPicker.vue';
import type { Materia } from '@/shared/types';

const props = defineProps<{
  show: boolean;
  materia?: Materia | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', data: Partial<Materia>): void;
}>();

const nome = ref('');
const descricao = ref('');
const cor = ref('bg-indigo-600');
const icone = ref('group');
const senha = ref('');

watch(
  () => props.show,
  (val) => {
    if (val) {
      if (props.materia) {
        nome.value = props.materia.nome || '';
        descricao.value = props.materia.descricao || '';
        cor.value = props.materia.cor || 'bg-indigo-600';
        icone.value = props.materia.icone || 'group';
        senha.value = '';
      } else {
        nome.value = '';
        descricao.value = '';
        cor.value = 'bg-indigo-600';
        icone.value = 'group';
        senha.value = '';
      }
    }
  }
);

function handleSubmit() {
  const payload: Record<string, any> = {
    nome: nome.value,
    descricao: descricao.value,
    cor: cor.value,
    icone: icone.value
  };

  if (!props.materia) {
    payload.slug = nome.value.toLowerCase().replace(/\s+/g, '_');
    payload.senha = senha.value;
  } else if (senha.value) {
    payload.senha = senha.value;
  }

  emit('submit', payload);
}
</script>

<template>
  <div v-if="props.show" class="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50" @click.self="emit('close')">
    <div class="bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl border border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
      <!-- Header with tight icon fit & generous horizontal padding -->
      <div class="px-8 py-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 shrink-0">
        <div class="flex items-center space-x-3.5">
          <div class="w-11 h-11 shrink-0 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30 flex items-center justify-center shadow-inner">
            <span class="material-icons text-xl">{{ icone || 'group' }}</span>
          </div>
          <div>
            <h3 class="text-xl font-bold text-white leading-tight">{{ props.materia ? 'Editar Matéria' : 'Nova Matéria' }}</h3>
            <p class="text-xs text-slate-400 mt-0.5">Configure título, ícone, cor e senha de acesso dos estudantes</p>
          </div>
        </div>
        <button @click="emit('close')" class="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
          <span class="material-icons">close</span>
        </button>
      </div>

      <!-- Form Body with px-8 padding & custom scrollbar -->
      <form @submit.prevent="handleSubmit" class="px-8 py-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
        <div>
          <label for="materia-nome" class="block text-sm font-semibold text-slate-200 mb-1.5">Nome da Matéria *</label>
          <input id="materia-nome" v-model="nome" required type="text" placeholder="Ex: Programação Web Mobile" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600 text-sm" />
        </div>

        <div>
          <label for="materia-desc" class="block text-sm font-semibold text-slate-200 mb-1.5">Descrição da Matéria</label>
          <textarea id="materia-desc" v-model="descricao" rows="3" placeholder="Descreva os tópicos principais e plano de aula desta matéria..." class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600 text-sm min-h-[90px] custom-scrollbar resize-y"></textarea>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label class="block text-sm font-semibold text-slate-200 mb-1.5">Ícone da Matéria</label>
            <IconPicker v-model="icone" />
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-200 mb-1.5">Cor de Identificação</label>
            <ColorPicker v-model="cor" />
          </div>
        </div>

        <div>
          <label for="materia-senha" class="block text-sm font-semibold text-slate-200 mb-1.5">
            Senha de Acesso dos Alunos
            <span v-if="props.materia" class="text-slate-500 font-normal">(deixe em branco para manter a atual)</span>
          </label>
          <input id="materia-senha" v-model="senha" :required="!props.materia" type="password" :placeholder="props.materia ? '••••••••' : 'Defina uma senha de acesso'" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600 text-sm" />
        </div>
      </form>

      <!-- Footer with px-8 horizontal padding -->
      <div class="px-8 py-4 border-t border-slate-800 flex justify-end space-x-3 bg-slate-900/90 shrink-0">
        <button @click="emit('close')" type="button" class="px-5 py-2.5 text-slate-400 hover:text-white rounded-xl text-xs font-medium transition-colors">Cancelar</button>
        <button @click="handleSubmit" type="button" class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all">Salvar Matéria</button>
      </div>
    </div>
  </div>
</template>
