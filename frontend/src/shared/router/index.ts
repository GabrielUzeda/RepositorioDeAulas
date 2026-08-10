import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/shared/stores/auth';
import AlunoView from '@/aluno/AlunoView.vue';
import LoginView from '@/shared/views/LoginView.vue';
import ProfessorView from '@/professor/ProfessorView.vue';
import AdminView from '@/admin/AdminView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'aluno', component: AlunoView },
    { path: '/login', name: 'login', component: LoginView },
    {
      path: '/professor',
      name: 'professor',
      component: ProfessorView,
      meta: { requiresAuth: true, roles: ['professor', 'admin'] }
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
      meta: { requiresAuth: true, roles: ['admin'] }
    }
  ]
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth) {
    if (!auth.isAuthenticated) {
      const ok = await auth.checkAuth();
      if (!ok) {
        return { name: 'login', query: { redirect: to.fullPath, expired: 'true' } };
      }
    }
    const role = auth.professor?.role;
    if (to.meta.roles && role && !(to.meta.roles as string[]).includes(role)) {
      return role === 'admin' ? { name: 'admin' } : { name: 'professor' };
    }
  }
  return true;
});

export default router;
