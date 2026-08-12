<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/shared/stores/auth';
import ThemeToggle from '@/shared/components/ThemeToggle.vue';

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
  <div class="relative min-h-screen bg-surface text-primary flex items-center justify-center p-4">
    <div class="absolute top-4 right-4">
      <ThemeToggle />
    </div>
    <div class="bg-surface-alt rounded-3xl p-8 max-w-md w-full shadow-2xl border border-line space-y-6">
      <div class="text-center space-y-2">
        <span class="material-icons text-5xl text-accent">admin_panel_settings</span>
        <h2 class="text-2xl font-bold text-primary">Painel de Acesso</h2>
        <p class="text-secondary text-sm">Digite suas credenciais para acessar o painel do professor ou do administrador.</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div v-if="route.query.expired" class="p-3.5 bg-surface-alt border border-line text-danger text-xs rounded-xl flex items-center space-x-2.5">
          <span class="material-icons text-danger text-base shrink-0">schedule</span>
          <span class="text-secondary">Sua sessão expirou por razões de segurança. Por favor, entre novamente.</span>
        </div>
        <div>
          <label class="block text-sm font-medium text-secondary mb-1">E-mail</label>
          <input v-model="emailInput" required type="email" placeholder="professor@local" class="w-full px-4 py-2.5 bg-surface border border-line rounded-xl text-primary outline-none focus:ring-2 focus:ring-accent" />
        </div>

        <div>
          <label class="block text-sm font-medium text-secondary mb-1">Senha</label>
          <input v-model="passwordInput" required type="password" placeholder="••••••••" class="w-full px-4 py-2.5 bg-surface border border-line rounded-xl text-primary outline-none focus:ring-2 focus:ring-accent" />
        </div>

        <div v-if="loginError" class="p-3 bg-surface-alt border border-danger text-danger text-sm rounded-xl">
          {{ loginError }}
        </div>

        <button type="submit" :disabled="authStore.isLoading" class="w-full py-3 bg-accent hover:opacity-90 text-white font-bold rounded-xl shadow-lg transition">
          {{ authStore.isLoading ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>

      <div class="text-center pt-2">
        <router-link to="/" class="text-accent hover:opacity-80 text-sm font-medium">← Voltar para Área do Aluno</router-link>
      </div>
    </div>
  </div>
</template>
