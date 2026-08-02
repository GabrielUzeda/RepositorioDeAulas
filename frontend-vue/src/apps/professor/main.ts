import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ProfessorView from '@/views/ProfessorView.vue';
import '@/style.css';

const app = createApp(ProfessorView);
app.use(createPinia());
app.mount('#app');
