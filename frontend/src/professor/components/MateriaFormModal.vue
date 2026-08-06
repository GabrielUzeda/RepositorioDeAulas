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
  <div v-if="props.show" class="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl space-y-6 relative border border-slate-100" @click.stop>
      <button @click="emit('close')" class="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition">
        <span class="material-icons">close</span>
      </button>

      <h3 class="text-xl font-bold text-slate-800">{{ props.materia ? 'Editar Materia' : 'Nova Materia' }}</h3>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label for="materia-nome" class="block text-sm font-medium text-slate-700 mb-1">Nome da Materia *</label>
          <input id="materia-nome" v-model="nome" required type="text" placeholder="Ex: Web Mobile 2026" class="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label for="materia-desc" class="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
          <textarea id="materia-desc" v-model="descricao" rows="3" placeholder="Descrição da materia para os alunos..." class="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">Cor da Materia</label>
          <ColorPicker v-model="cor" />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">Ícone da Materia</label>
          <IconPicker v-model="icone" />
        </div>

        <div>
          <label for="materia-senha" class="block text-sm font-medium text-slate-700 mb-1">Senha de Acesso para Alunos</label>
          <input id="materia-senha" v-model="senha" :required="!props.materia" type="password" :placeholder="props.materia ? 'Deixe em branco para manter a atual' : 'Defina a senha da materia'" class="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div class="flex justify-end space-x-3 pt-4 border-t">
          <button @click="emit('close')" type="button" class="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium">Cancelar</button>
          <button type="submit" class="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-md">Salvar Materia</button>
        </div>
      </form>
    </div>
  </div>
</template>
