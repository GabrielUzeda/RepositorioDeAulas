<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  show: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', password: string): void;
}>();

const passwordInput = ref('');

function handleSubmit() {
  if (passwordInput.value) {
    emit('submit', passwordInput.value);
    passwordInput.value = '';
  }
}
</script>

<template>
  <div v-if="props.show" class="fixed inset-0 bg-surface backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div class="bg-surface-alt rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-fade-in" @click.stop>
      <h3 class="text-xl font-semibold text-primary">Acesso Restrito</h3>
      <p class="text-sm text-secondary">Esta atividade exige senha de acesso definida pelo professor.</p>
      <input
        v-model="passwordInput"
        type="password"
        @keyup.enter="handleSubmit"
        placeholder="Digite a senha"
        class="w-full px-4 py-2 bg-surface-alt text-primary border border-line rounded-lg outline-none focus:ring-2 focus:ring-accent placeholder:text-secondary"
        autofocus
      />
      <div class="flex justify-end space-x-3 pt-2">
        <button @click="emit('close')" type="button" class="px-4 py-2 text-secondary hover:bg-surface-alt rounded-lg text-sm font-medium">Cancelar</button>
        <button @click="handleSubmit" type="button" class="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 shadow-md">Confirmar</button>
      </div>
    </div>
  </div>
</template>
