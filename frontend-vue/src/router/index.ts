import { createRouter, createWebHistory } from 'vue-router';
import AlunoView from '@/views/AlunoView.vue';
import ProfessorView from '@/views/ProfessorView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'aluno',
      component: AlunoView
    },
    {
      path: '/professor',
      name: 'professor',
      component: ProfessorView
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
});

export default router;
