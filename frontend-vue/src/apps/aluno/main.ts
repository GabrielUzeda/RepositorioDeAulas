import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AlunoView from '@/views/AlunoView.vue';
import '@/style.css';

const app = createApp(AlunoView);
app.use(createPinia());
app.mount('#app');
