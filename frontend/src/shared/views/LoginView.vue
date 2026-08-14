<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/shared/stores/auth';
import ThemeToggle from '@/shared/components/ThemeToggle.vue';
import BaseButton from '@/shared/components/BaseButton.vue';
import BaseInput from '@/shared/components/BaseInput.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const emailInput = ref('');
const passwordInput = ref('');
const loginError = ref('');
const isSubmitting = ref(false);

async function handleLogin() {
  if (isSubmitting.value) return;
  loginError.value = '';
  isSubmitting.value = true;
  try {
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
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="relative min-h-screen bg-canvas flex items-center justify-center p-4">

    <!-- Theme toggle — top right -->
    <div class="absolute top-4 right-4">
      <ThemeToggle />
    </div>

    <!-- Decorative background shape -->
    <div
      class="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      <div class="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-accent opacity-5" />
      <div class="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-accent opacity-5" />
    </div>

    <!-- Card de login -->
    <div class="relative w-full max-w-sm">
      <!-- Logo / Identidade -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-accent shadow-lg mb-4">
          <span class="material-icons text-white text-2xl">school</span>
        </div>
        <h1 class="text-xl font-bold text-primary tracking-tight">RepositorioDeAulas</h1>
        <p class="text-xs text-muted mt-1">Área restrita — professores e administradores</p>
      </div>

      <!-- Sessão expirada -->
      <div
        v-if="route.query.expired"
        class="mb-5 flex items-start gap-2.5 rounded-md border border-warning bg-warning-light px-4 py-3 text-xs text-warning-text"
        role="alert"
      >
        <span class="material-icons text-[16px] flex-shrink-0 mt-0.5">schedule</span>
        <span>Sua sessão expirou por razões de segurança. Por favor, entre novamente.</span>
      </div>

      <!-- Form Card -->
      <div class="bg-surface-alt rounded-xl border border-line shadow-lg p-6">
        <form @submit.prevent="handleLogin" class="space-y-4" novalidate>
          <BaseInput
            v-model="emailInput"
            label="E-mail"
            type="email"
            placeholder="professor@escola.edu"
            icon="mail"
            required
          />

          <BaseInput
            v-model="passwordInput"
            label="Senha"
            type="password"
            placeholder="••••••••"
            icon="lock"
            required
          />

          <!-- Erro de login -->
          <div
            v-if="loginError"
            class="flex items-start gap-2 rounded-md border border-danger bg-danger-light px-3.5 py-3 text-xs text-danger-text"
            role="alert"
          >
            <span class="material-icons text-[16px] flex-shrink-0 mt-0.5 text-danger">error</span>
            {{ loginError }}
          </div>

          <BaseButton
            type="submit"
            variant="primary"
            size="md"
            block
            :loading="isSubmitting"
          >
            {{ isSubmitting ? 'Entrando...' : 'Entrar' }}
          </BaseButton>
        </form>
      </div>

      <!-- Link de volta -->
      <div class="text-center mt-5">
        <router-link
          to="/"
          class="inline-flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors duration-base"
        >
          <span class="material-icons text-[14px]">arrow_back</span>
          Voltar para Área do Aluno
        </router-link>
      </div>
    </div>
  </div>
</template>
