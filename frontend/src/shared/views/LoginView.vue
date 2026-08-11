<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/shared/stores/auth';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const emailInput = ref('');
const passwordInput = ref('');
const loginError = ref('');

async function handleLogin() {
  loginError.value = '';
  const result = await authStore.login(emailInput.value, passwordInput.value);
  if (!result.success) {
    loginError.value = result.error || 'Falha na autenticação';
    return;
  }
  const role = authStore.professor?.role;
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '';
  if (redirect && !(role === 'admin' && redirect === '/professor')) {
    router.push(redirect);
  } else if (role === 'admin') {
    router.push('/admin');
  } else {
    router.push('/professor');
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
    <div class="bg-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-700 space-y-6">
      <div class="text-center space-y-2">
        <span class="material-icons text-5xl text-indigo-400">admin_panel_settings</span>
        <h2 class="text-2xl font-bold text-white">Painel de Acesso</h2>
        <p class="text-slate-400 text-sm">Digite suas credenciais para acessar o painel do professor ou do administrador.</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div v-if="route.query.expired" class="p-3.5 bg-amber-950/60 border border-amber-700/60 text-amber-200 text-xs rounded-xl flex items-center space-x-2.5">
          <span class="material-icons text-amber-400 text-base shrink-0">schedule</span>
          <span>Sua sessão expirou por razões de segurança. Por favor, entre novamente.</span>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1">E-mail</label>
          <input v-model="emailInput" required type="email" placeholder="professor@local" class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1">Senha</label>
          <input v-model="passwordInput" required type="password" placeholder="••••••••" class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div v-if="loginError" class="p-3 bg-rose-900/50 border border-rose-700 text-rose-200 text-sm rounded-xl">
          {{ loginError }}
        </div>

        <button type="submit" :disabled="authStore.isLoading" class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition">
          {{ authStore.isLoading ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>

      <div class="text-center pt-2">
        <router-link to="/" class="text-indigo-400 hover:text-indigo-300 text-sm font-medium">← Voltar para Área do Aluno</router-link>
      </div>
    </div>
  </div>
</template>
