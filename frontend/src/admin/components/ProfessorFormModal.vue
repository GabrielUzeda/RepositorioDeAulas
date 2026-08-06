<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Professor } from '@/shared/types';

const props = defineProps<{
  show: boolean;
  professor: Professor | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: { nome: string; email: string; password: string; role: string }): void;
}>();

const nome = ref('');
const email = ref('');
const password = ref('');
const role = ref<'professor' | 'admin'>('professor');
const error = ref('');

watch(
  () => props.show,
  (open) => {
    if (open) {
      nome.value = props.professor?.nome || '';
      email.value = props.professor?.email || '';
      password.value = '';
      role.value = props.professor?.role === 'admin' ? 'admin' : 'professor';
      error.value = '';
    }
  }
);

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
    role: role.value
  });
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" @click.self="emit('close')">
    <div class="bg-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-700 space-y-5">
      <div class="flex justify-between items-center">
        <h3 class="text-xl font-bold text-white">{{ professor ? 'Editar Professor' : 'Novo Professor' }}</h3>
        <button @click="emit('close')" class="text-slate-400 hover:text-white">
          <span class="material-icons">close</span>
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label for="prof-nome" class="block text-sm font-medium text-slate-300 mb-1">Nome</label>
          <input id="prof-nome" v-model="nome" type="text" required class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label for="prof-email" class="block text-sm font-medium text-slate-300 mb-1">E-mail</label>
          <input id="prof-email" v-model="email" type="email" required class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label for="prof-senha" class="block text-sm font-medium text-slate-300 mb-1">
            Senha
            <span v-if="professor" class="text-slate-500 font-normal">(deixe em branco para manter)</span>
          </label>
          <input id="prof-senha" v-model="password" type="password" placeholder="••••••••" class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label for="prof-perfil" class="block text-sm font-medium text-slate-300 mb-1">Perfil</label>
          <select id="prof-perfil" v-model="role" class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="professor">Professor</option>
            <option value="admin">Administrador</option>
          </select>
        </div>

        <div v-if="error" class="p-3 bg-rose-900/50 border border-rose-700 text-rose-200 text-sm rounded-xl">
          {{ error }}
        </div>

        <div class="flex justify-end space-x-3 pt-2">
          <button type="button" @click="emit('close')" class="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition">
            Cancelar
          </button>
          <button type="submit" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition">
            {{ professor ? 'Salvar' : 'Criar' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
