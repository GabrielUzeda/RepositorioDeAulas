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

const props = withDefaults(
  defineProps<{
    show: boolean;
    atividade?: Atividade | null;
    loading?: boolean;
  }>(),
  {
    loading: false,
  }
);

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
const isSaving = ref(false);

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
    isSaving.value = false;
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
  if (isSaving.value || props.loading) return;
  isSaving.value = true;
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
  <BaseModal :model-value="props.show" @close="emit('close')" max-width="max-w-5xl">
    <template #header>
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full border-b border-line pb-4">
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 rounded-md bg-accent flex items-center justify-center text-white shadow-xs">
            <span class="material-icons text-[20px]">quiz</span>
          </div>
          <div>
            <h2 class="text-xl font-bold text-primary">{{ props.atividade ? 'Editar Atividade' : 'Nova Atividade Interativa' }}</h2>
            <p class="text-xs text-secondary">Configure os dados gerais e adicione perguntas objetivas ou discursivas.</p>
          </div>
        </div>

        <div class="flex items-center flex-wrap gap-2">
          <label class="cursor-pointer px-3 py-1.5 bg-surface-alt hover:bg-surface border border-line text-secondary rounded-md text-xs font-semibold flex items-center space-x-1 transition-colors">
            <span class="material-icons text-sm">upload_file</span>
            <span>Importar JSON</span>
            <input type="file" accept=".json" @change="handleImportJson" class="hidden" />
          </label>

          <BaseButton variant="secondary" size="sm" @click="handleExportJson">
            <span class="material-icons text-sm">download</span>
            <span>Exportar JSON</span>
          </BaseButton>

          <BaseButton variant="ghost" size="sm" :disabled="props.loading || isSaving" @click="emit('close')">Cancelar</BaseButton>
          <BaseButton variant="primary" size="sm" :loading="props.loading || isSaving" @click="handleSave">Salvar Atividade</BaseButton>
        </div>
      </div>
    </template>

    <div class="space-y-6">
      <!-- Basic Info Box -->
      <div class="bg-surface-alt p-6 rounded-xl border border-line space-y-4 shadow-sm">
        <h3 class="text-base font-bold text-primary border-b border-line pb-2">Informações Básicas</h3>

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
              :rows="3"
              label="Descrição / Orientações"
              placeholder="Breve resumo ou instruções da atividade para os alunos..."
            />
          </div>

          <div class="md:col-span-2 flex items-center space-x-3 pt-1">
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
          <div>
            <h3 class="text-lg font-bold text-primary">Perguntas ({{ questions.length }})</h3>
            <p class="text-xs text-secondary">Defina o enunciado e as opções de cada questão.</p>
          </div>
          <BaseButton variant="primary" size="sm" @click="addQuestion">
            <span class="material-icons text-sm">add</span>
            <span>Adicionar Pergunta</span>
          </BaseButton>
        </div>

        <EmptyState v-if="questions.length === 0" title="Nenhuma pergunta adicionada." message="Clique em &quot;Adicionar Pergunta&quot; para começar." />

        <div v-if="!usesOptions" class="p-3 bg-surface-alt border border-line rounded-lg text-secondary text-xs flex items-center gap-2">
          <span class="material-icons text-base text-accent">edit_note</span>
          <span>Atividade do tipo <strong class="text-primary">{{ tipo }}</strong>: as perguntas são <strong class="text-primary">discursivas</strong> (resposta livre em texto).</span>
        </div>

        <div
          v-for="(q, qIndex) in questions"
          :key="qIndex"
          class="bg-surface-alt p-6 rounded-xl border border-line space-y-4 shadow-sm"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
            <div class="flex items-center gap-2 flex-1">
              <span class="w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center shrink-0">
                {{ qIndex + 1 }}
              </span>
              <input
                v-model="q.title"
                placeholder="Título/Tema da Questão (Ex: Questão 1)"
                class="bg-surface px-3 py-1.5 rounded-md border border-line font-semibold text-primary text-sm outline-none focus:ring-2 focus:ring-accent flex-1 max-w-md"
              />
            </div>

            <div class="flex items-center space-x-1 self-end sm:self-auto">
              <BaseButton variant="ghost" size="sm" :disabled="qIndex === 0" title="Mover para cima" @click="moveQuestion(qIndex, 'up')">
                <span class="material-icons text-sm">arrow_upward</span>
              </BaseButton>
              <BaseButton variant="ghost" size="sm" :disabled="qIndex === questions.length - 1" title="Mover para baixo" @click="moveQuestion(qIndex, 'down')">
                <span class="material-icons text-sm">arrow_downward</span>
              </BaseButton>
              <BaseButton variant="danger" size="sm" title="Excluir questão" @click="removeQuestion(qIndex)">
                <span class="material-icons text-sm">delete</span>
              </BaseButton>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">Enunciado da Pergunta *</label>
            <BaseTextarea
              v-model="q.content"
              :rows="3"
              placeholder="Digite o enunciado completo da questão para o aluno..."
            />
          </div>

          <!-- Options Section (apenas para tipos objetivos: minigame/roleta/reforco) -->
          <div v-if="usesOptions" class="space-y-3 pt-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-semibold uppercase tracking-wider text-secondary">Alternativas de Resposta</label>
              <BaseButton variant="ghost" size="sm" @click="addOption(qIndex)">
                <span class="material-icons text-xs mr-1">add</span> + Adicionar Opção
              </BaseButton>
            </div>

            <div class="space-y-2">
              <div v-for="(opt, oIndex) in q.options" :key="oIndex" class="flex flex-col sm:flex-row sm:items-center gap-2.5 bg-surface p-3 rounded-lg border border-line">
                <div class="flex items-center gap-2 shrink-0">
                  <input
                    type="radio"
                    :name="`correct_${qIndex}`"
                    :checked="opt.correct"
                    @change="setCorrectOption(qIndex, oIndex)"
                    title="Marcar como alternativa correta"
                    class="w-4 h-4 text-success bg-surface border-line cursor-pointer"
                  />
                  <span class="text-xs font-medium text-secondary">{{ String.fromCharCode(65 + oIndex) }})</span>
                </div>
                <input
                  v-model="opt.text"
                  placeholder="Texto da alternativa..."
                  class="flex-1 bg-surface-alt px-3 py-1.5 rounded-md border border-line text-primary text-sm outline-none focus:border-accent"
                />
                <input
                  v-model="opt.feedback"
                  placeholder="Feedback pedagógico (opcional)..."
                  class="w-full sm:w-60 bg-surface-alt px-3 py-1.5 rounded-md text-xs text-secondary border border-line outline-none focus:border-accent"
                />
                <button
                  type="button"
                  class="p-1 text-secondary hover:text-danger rounded hover:bg-surface-alt transition-colors shrink-0 self-end sm:self-auto"
                  title="Remover opção"
                  @click="removeOption(qIndex, oIndex)"
                >
                  <span class="material-icons text-sm">close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>
</template>
