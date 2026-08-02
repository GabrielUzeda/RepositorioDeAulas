import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiClient } from '@/api/client';
import type { Professor } from '@/types';

export const useAuthStore = defineStore('auth', () => {
  const professor = ref<Professor | null>(null);
  const isAuthenticated = ref<boolean>(false);
  const isLoading = ref<boolean>(false);

  async function checkAuth(): Promise<boolean> {
    const token = apiClient.getProfessorToken();
    if (!token) {
      isAuthenticated.value = false;
      professor.value = null;
      return false;
    }

    isLoading.value = true;
    const res = await apiClient.get<{ id: number; role: string }>('/check-auth');
    isLoading.value = false;

    if (res.success && res.data) {
      isAuthenticated.value = true;
      professor.value = {
        id: res.data.id,
        email: '',
        nome: res.data.role === 'admin' ? 'Administrador' : 'Professor',
        role: res.data.role
      };
      return true;
    } else {
      apiClient.clearProfessorAuth();
      isAuthenticated.value = false;
      professor.value = null;
      return false;
    }
  }

  async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    isLoading.value = true;
    const res = await apiClient.post<{ token: string; professor: Professor }>('/auth/login', {
      email,
      password
    });
    isLoading.value = false;

    if (res.success && res.data) {
      apiClient.setProfessorToken(res.data.token);
      professor.value = res.data.professor;
      isAuthenticated.value = true;
      return { success: true };
    } else {
      return { success: false, error: res.error || 'Credenciais inválidas!' };
    }
  }

  function logout() {
    apiClient.clearProfessorAuth();
    professor.value = null;
    isAuthenticated.value = false;
  }

  return {
    professor,
    isAuthenticated,
    isLoading,
    checkAuth,
    login,
    logout
  };
});
