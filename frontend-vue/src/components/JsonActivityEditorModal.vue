<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Atividade, Question, Option } from '@/types';

const props = defineProps<{
  show: boolean;
  atividade?: Atividade | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', payload: Partial<Atividade>): void;
}>();

const titulo = ref('');
const descricao = ref('');
const tipo = ref<'normal' | 'prova' | 'minigame' | 'roleta' | 'reforco'>('normal');
const allowPassword = ref(false);
const senha = ref('');
const questions = ref<Question[]>([]);

watch(
  () => props.show,
  (val) => {
    if (val) {
      if (props.atividade) {
        titulo.value = props.atividade.titulo || '';
        descricao.value = props.atividade.descricao || '';
        tipo.value = props.atividade.tipo || 'normal';
        allowPassword.value = !!props.atividade.allow_password;
        senha.value = props.atividade.senha || '';

        if (props.atividade.json_data) {
          try {
            const parsed = typeof props.atividade.json_data === 'string'
              ? JSON.parse(props.atividade.json_data)
              : props.atividade.json_data;
            questions.value = parsed.questions || [];
          } catch {
            questions.value = [];
          }
        } else {
          questions.value = [];
        }
      } else {
        titulo.value = '';
        descricao.value = '';
        tipo.value = 'normal';
        allowPassword.value = false;
        senha.value = '';
        questions.value = [];
      }
    }
  }
);

function addQuestion() {
  questions.value.push({
    title: `Questão ${questions.value.length + 1}`,
    content: '',
    options: [
      { text: 'Opção 1', correct: true, feedback: 'Correto!' },
      { text: 'Opção 2', correct: false, feedback: 'Incorreto.' }
    ]
  });
}

function removeQuestion(index: number) {
  questions.value.splice(index, 1);
}

function moveQuestion(index: number, direction: 'up' | 'down') {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target >= 0 && target < questions.value.length) {
    const temp = questions.value[index];
    questions.value[index] = questions.value[target];
    questions.value[target] = temp;
  }
}

function addOption(qIndex: number) {
  const q = questions.value[qIndex];
  if (!q.options) q.options = [];
  q.options.push({
    text: `Opção ${q.options.length + 1}`,
    correct: false,
    feedback: ''
  });
}

function removeOption(qIndex: number, oIndex: number) {
  questions.value[qIndex].options?.splice(oIndex, 1);
}

function setCorrectOption(qIndex: number, oIndex: number) {
  const opts = questions.value[qIndex].options;
  if (opts) {
    opts.forEach((o, idx) => {
      o.correct = idx === oIndex;
    });
  }
}

function handleSave() {
  const payload: Partial<Atividade> = {
    titulo: titulo.value,
    descricao: descricao.value,
    tipo: tipo.value,
    allow_password: allowPassword.value,
    senha: allowPassword.value ? senha.value : null,
    slug: titulo.value.toLowerCase().replace(/\s+/g, '_'),
    json_data: JSON.stringify({ questions: questions.value })
  };

  emit('save', payload);
}

function handleExportJson() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ questions: questions.value }, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `${titulo.value || 'atividade'}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function handleImportJson(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target?.result as string);
      if (parsed.questions && Array.isArray(parsed.questions)) {
        questions.value = parsed.questions;
      }
    } catch {
      alert('Arquivo JSON inválido!');
    }
  };
  reader.readAsText(file);
}
</script>

<template>
  <div v-if="props.show" class="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex flex-col z-50">
    <!-- Header Toolbar -->
    <div class="bg-slate-900 px-6 py-4 border-b border-slate-800 flex justify-between items-center text-white">
      <div class="flex items-center space-x-3">
        <span class="material-icons text-indigo-400">quiz</span>
        <h2 class="text-xl font-bold">{{ props.atividade ? 'Editar Atividade' : 'Nova Atividade Interativa' }}</h2>
      </div>

      <div class="flex items-center space-x-3">
        <label class="cursor-pointer px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center space-x-1">
          <span class="material-icons text-sm">upload_file</span>
          <span>Importar JSON</span>
          <input type="file" accept=".json" @change="handleImportJson" class="hidden" />
        </label>

        <button @click="handleExportJson" type="button" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center space-x-1">
          <span class="material-icons text-sm">download</span>
          <span>Exportar JSON</span>
        </button>

        <button @click="emit('close')" type="button" class="px-4 py-2 text-slate-400 hover:text-white rounded-lg text-sm font-medium">Cancelar</button>
        <button @click="handleSave" type="button" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-lg">Salvar Atividade</button>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 overflow-y-auto p-8 bg-slate-950 text-slate-100">
      <div class="max-w-4xl mx-auto space-y-6">
        <!-- Basic Info Box -->
        <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-lg">
          <h3 class="text-lg font-bold text-white border-b border-slate-800 pb-2">Informações Básicas</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1">Título da Atividade *</label>
              <input v-model="titulo" required type="text" placeholder="Ex: Avaliação de Algoritmos" class="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1">Tipo de Atividade</label>
              <select v-model="tipo" class="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="normal">Normal</option>
                <option value="prova">Prova</option>
                <option value="minigame">Minigame Tático</option>
                <option value="roleta">Roleta do Conhecimento</option>
                <option value="reforco">Reforço (Modo Zen)</option>
              </select>
            </div>

            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-slate-300 mb-1">Descrição</label>
              <textarea v-model="descricao" rows="2" placeholder="Breve resumo da atividade..." class="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
            </div>

            <div class="md:col-span-2 flex items-center space-x-3 pt-2">
              <input type="checkbox" id="allowPassword" v-model="allowPassword" class="w-4 h-4 text-indigo-600 rounded border-slate-700 bg-slate-950" />
              <label for="allowPassword" class="text-sm font-medium text-slate-300 cursor-pointer">Exigir senha individual de acesso para os alunos</label>
            </div>

            <div v-if="allowPassword" class="md:col-span-2">
              <label class="block text-sm font-medium text-slate-300 mb-1">Senha da Atividade *</label>
              <input v-model="senha" required type="password" placeholder="Digite a senha exclusiva" class="w-full max-w-xs px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

        <!-- Questions Section -->
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="text-xl font-bold text-white">Perguntas ({{ questions.length }})</h3>
            <button @click="addQuestion" type="button" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md flex items-center space-x-2">
              <span class="material-icons text-sm">add</span>
              <span>Adicionar Pergunta</span>
            </button>
          </div>

          <div v-if="questions.length === 0" class="text-center py-12 bg-slate-900 rounded-2xl border border-slate-800 text-slate-500">
            Nenhuma pergunta adicionada. Clique em "Adicionar Pergunta" para começar.
          </div>

          <div
            v-for="(q, qIndex) in questions"
            :key="qIndex"
            class="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-md"
          >
            <div class="flex justify-between items-center border-b border-slate-800 pb-3">
              <input v-model="q.title" placeholder="Título/Tema da Questão" class="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 font-bold text-indigo-400 text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-64" />
              <div class="flex items-center space-x-1">
                <button @click="moveQuestion(qIndex, 'up')" :disabled="qIndex === 0" class="p-1.5 text-slate-400 hover:text-white disabled:opacity-30">
                  <span class="material-icons text-sm">arrow_upward</span>
                </button>
                <button @click="moveQuestion(qIndex, 'down')" :disabled="qIndex === questions.length - 1" class="p-1.5 text-slate-400 hover:text-white disabled:opacity-30">
                  <span class="material-icons text-sm">arrow_downward</span>
                </button>
                <button @click="removeQuestion(qIndex)" class="p-1.5 text-rose-400 hover:text-rose-300">
                  <span class="material-icons text-sm">delete</span>
                </button>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Enunciado da Pergunta *</label>
              <textarea v-model="q.content" rows="2" placeholder="Digite a pergunta para o aluno..." class="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"></textarea>
            </div>

            <!-- Options Section -->
            <div class="space-y-2 pt-2">
              <div class="flex justify-between items-center">
                <label class="text-xs font-bold uppercase tracking-wider text-slate-400">Alternativas de Resposta</label>
                <button @click="addOption(qIndex)" type="button" class="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center">
                  <span class="material-icons text-xs mr-1">add</span> + Opção
                </button>
              </div>

              <div v-for="(opt, oIndex) in q.options" :key="oIndex" class="flex items-center space-x-3 bg-slate-950 p-3 rounded-xl border border-slate-850">
                <input
                  type="radio"
                  :name="`correct_${qIndex}`"
                  :checked="opt.correct"
                  @change="setCorrectOption(qIndex, oIndex)"
                  title="Marcar como alternativa correta"
                  class="w-4 h-4 text-green-500 bg-slate-900 border-slate-700"
                />
                <input v-model="opt.text" placeholder="Texto da opção" class="flex-1 bg-transparent border-none text-white text-sm outline-none" />
                <input v-model="opt.feedback" placeholder="Feedback ao escolher" class="w-48 bg-slate-900 px-3 py-1 rounded-lg text-xs text-slate-300 border border-slate-800 outline-none" />
                <button @click="removeOption(qIndex, oIndex)" class="text-slate-500 hover:text-rose-400 p-1">
                  <span class="material-icons text-xs">close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
