<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useToast } from '@/shared/composables/useToast';
import type { Atividade, Question, QuestionOption } from '@/shared/types';
import BaseModal from '@/shared/components/BaseModal.vue';
import BaseButton from '@/shared/components/BaseButton.vue';
import BaseInput from '@/shared/components/BaseInput.vue';
import BaseTextarea from '@/shared/components/BaseTextarea.vue';
import BaseSelect from '@/shared/components/BaseSelect.vue';
import EmptyState from '@/shared/components/EmptyState.vue';

const tipoOptions = [
  { label: 'Normal', value: 'normal' },
  { label: 'Prova', value: 'prova' },
  { label: 'Minigame Tático', value: 'minigame' },
  { label: 'Roleta do Conhecimento', value: 'roleta' },
  { label: 'Reforço (Modo Zen)', value: 'reforco' },
];

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

const usesOptions = computed(() => tipo.value !== 'normal' && tipo.value !== 'prova');

function normalizeQuestion(q: any): Question {
  let options: QuestionOption[] | undefined;
  const rawOptions = Array.isArray(q?.options) ? q.options : Array.isArray(q?.alternativas) ? q.alternativas : null;
  if (rawOptions && rawOptions.length > 0) {
    options = rawOptions.map((opt: any) => ({
      text: String(opt?.text ?? opt?.label ?? ''),
      correct: !!opt?.correct,
      feedback: String(opt?.feedback ?? '')
    }));
  }
  if (q?.type === 'text') options = undefined;
  return {
    title: String(q?.title ?? ''),
    content: String(q?.content ?? ''),
    ...(options ? { options } : {})
  };
}

watch(
  () => props.show,
  (val) => {
    if (val) {
      if (props.atividade) {
        titulo.value = props.atividade.titulo || '';
        descricao.value = props.atividade.descricao || '';
        tipo.value = (props.atividade.tipo as any) || 'normal';
        allowPassword.value = !!props.atividade.allow_password;
        senha.value = props.atividade.senha || '';

        if (props.atividade.json_data) {
          try {
            const parsed = typeof props.atividade.json_data === 'string'
              ? JSON.parse(props.atividade.json_data)
              : props.atividade.json_data;
            questions.value = (Array.isArray(parsed?.questions) ? parsed.questions : []).map(normalizeQuestion);
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
  const base = { title: `Questão ${questions.value.length + 1}`, content: '' };
  if (usesOptions.value) {
    questions.value.push({
      ...base,
      options: [
        { text: 'Opção 1', correct: true, feedback: 'Correto!' },
        { text: 'Opção 2', correct: false, feedback: 'Incorreto.' }
      ]
    });
  } else {
    questions.value.push(base);
  }
}

function handleTypeChange() {
  questions.value = [];
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
    caminho: titulo.value.toLowerCase().replace(/\s+/g, '_'),
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
      const raw = Array.isArray(parsed?.questions) ? parsed.questions : Array.isArray(parsed?.perguntas) ? parsed.perguntas : null;
      if (!raw) {
        useToast().error('Arquivo JSON não contém perguntas.');
        return;
      }
      if (parsed?.titulo) titulo.value = String(parsed.titulo);
      if (parsed?.descricao) descricao.value = String(parsed.descricao);
      if (parsed?.tipo) tipo.value = (parsed.tipo === 'game' ? 'minigame' : parsed.tipo);
      if (parsed?.senha) {
        allowPassword.value = true;
        senha.value = String(parsed.senha);
      }
      questions.value = raw.map(normalizeQuestion);
    } catch {
      useToast().error('Arquivo JSON inválido!');
    }
  };
  reader.readAsText(file);
}
</script>

<template>
  <BaseModal :model-value="props.show" @close="emit('close')" max-width="max-w-4xl">
    <template #header>
      <div class="flex items-center justify-between gap-4 w-full border-b border-line pb-4">
        <div class="flex items-center space-x-3">
          <span class="material-icons text-accent">quiz</span>
          <h2 class="text-xl font-bold text-primary">{{ props.atividade ? 'Editar Atividade' : 'Nova Atividade Interativa' }}</h2>
        </div>

        <div class="flex items-center space-x-3">
          <label class="cursor-pointer px-3 py-1.5 bg-surface-alt hover:bg-surface text-secondary rounded-lg text-xs font-semibold flex items-center space-x-1">
            <span class="material-icons text-sm">upload_file</span>
            <span>Importar JSON</span>
            <input type="file" accept=".json" @change="handleImportJson" class="hidden" />
          </label>

          <BaseButton variant="secondary" size="sm" @click="handleExportJson">
            <span class="material-icons text-sm">download</span>
            <span>Exportar JSON</span>
          </BaseButton>

          <BaseButton variant="ghost" size="sm" @click="emit('close')">Cancelar</BaseButton>
          <BaseButton variant="primary" size="sm" @click="handleSave">Salvar Atividade</BaseButton>
        </div>
      </div>
    </template>

    <div class="space-y-6">
      <!-- Basic Info Box -->
      <div class="bg-surface p-6 rounded-2xl border border-line space-y-4 shadow-lg">
        <h3 class="text-lg font-bold text-primary border-b border-line pb-2">Informações Básicas</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BaseInput
            v-model="titulo"
            type="text"
            label="Título da Atividade *"
            placeholder="Ex: Avaliação de Algoritmos"
          />

          <BaseSelect
            v-model="tipo"
            :options="tipoOptions"
            label="Tipo de Atividade"
            @change="handleTypeChange"
          />

          <div class="md:col-span-2">
            <BaseTextarea
              v-model="descricao"
              :rows="2"
              label="Descrição"
              placeholder="Breve resumo da atividade..."
            />
          </div>

          <div class="md:col-span-2 flex items-center space-x-3 pt-2">
            <input type="checkbox" id="allowPassword" v-model="allowPassword" class="w-4 h-4 text-accent rounded border-line bg-surface" />
            <label for="allowPassword" class="text-sm font-medium text-secondary cursor-pointer">Exigir senha individual de acesso para os alunos</label>
          </div>

          <div v-if="allowPassword" class="md:col-span-2">
            <BaseInput
              v-model="senha"
              type="password"
              label="Senha da Atividade *"
              placeholder="Digite a senha exclusiva"
            />
          </div>
        </div>
      </div>

      <!-- Questions Section -->
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="text-xl font-bold text-primary">Perguntas ({{ questions.length }})</h3>
          <BaseButton variant="primary" size="sm" @click="addQuestion">
            <span class="material-icons text-sm">add</span>
            <span>Adicionar Pergunta</span>
          </BaseButton>
        </div>

        <EmptyState v-if="questions.length === 0" title="Nenhuma pergunta adicionada." message="Clique em &quot;Adicionar Pergunta&quot; para começar." />

        <div v-if="!usesOptions" class="p-3 bg-surface border border-line rounded-xl text-secondary text-xs">
          <span class="material-icons text-sm align-middle mr-1 text-accent">edit_note</span>
          <span>Atividade do tipo <strong class="text-secondary">{{ tipo }}</strong>: as perguntas são <strong class="text-secondary">discursivas</strong> (resposta em texto). Não são exibidas alternativas.</span>
        </div>

        <div
          v-for="(q, qIndex) in questions"
          :key="qIndex"
          class="bg-surface p-6 rounded-2xl border border-line space-y-4 shadow-md"
        >
          <div class="flex justify-between items-center border-b border-line pb-3">
            <input v-model="q.title" placeholder="Título/Tema da Questão" class="bg-surface px-3 py-1.5 rounded-lg border border-line font-bold text-accent text-sm outline-none focus:ring-2 focus:ring-accent w-64" />
            <div class="flex items-center space-x-1">
              <BaseButton variant="ghost" size="sm" :disabled="qIndex === 0" @click="moveQuestion(qIndex, 'up')">
                <span class="material-icons text-sm">arrow_upward</span>
              </BaseButton>
              <BaseButton variant="ghost" size="sm" :disabled="qIndex === questions.length - 1" @click="moveQuestion(qIndex, 'down')">
                <span class="material-icons text-sm">arrow_downward</span>
              </BaseButton>
              <BaseButton variant="danger" size="sm" @click="removeQuestion(qIndex)">
                <span class="material-icons text-sm">delete</span>
              </BaseButton>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-secondary mb-1">Enunciado da Pergunta *</label>
            <BaseTextarea
              v-model="q.content"
              :rows="2"
              placeholder="Digite a pergunta para o aluno..."
            />
          </div>

          <!-- Options Section (apenas para tipos objetivos: minigame/roleta/reforco) -->
          <div v-if="usesOptions" class="space-y-2 pt-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-bold uppercase tracking-wider text-secondary">Alternativas de Resposta</label>
              <BaseButton variant="ghost" size="sm" @click="addOption(qIndex)">
                <span class="material-icons text-xs mr-1">add</span> + Opção
              </BaseButton>
            </div>

            <div v-for="(opt, oIndex) in q.options" :key="oIndex" class="flex items-center space-x-3 bg-surface p-3 rounded-xl border border-line">
              <input
                type="radio"
                :name="`correct_${qIndex}`"
                :checked="opt.correct"
                @change="setCorrectOption(qIndex, oIndex)"
                title="Marcar como alternativa correta"
                class="w-4 h-4 text-success bg-surface border-line"
              />
              <input v-model="opt.text" placeholder="Texto da opção" class="flex-1 bg-transparent border-none text-primary text-sm outline-none" />
              <input v-model="opt.feedback" placeholder="Feedback ao escolher" class="w-48 bg-surface px-3 py-1 rounded-lg text-xs text-secondary border border-line outline-none" />
              <BaseButton variant="ghost" size="sm" @click="removeOption(qIndex, oIndex)">
                <span class="material-icons text-xs">close</span>
              </BaseButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>
</template>
