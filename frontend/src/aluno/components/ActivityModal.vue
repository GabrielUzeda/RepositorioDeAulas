<script setup lang="ts">
import { ref, watch } from 'vue';
import { apiClient } from '@/shared/api/client';
import { secureGet, secureSet, secureRemove } from '@/shared/utils/storage';
import { useToast } from '@/shared/composables/useToast';
import type { Atividade, Question } from '@/shared/types';
import BaseModal from '@/shared/components/BaseModal.vue';
import BaseButton from '@/shared/components/BaseButton.vue';
import BaseInput from '@/shared/components/BaseInput.vue';
import BaseTextarea from '@/shared/components/BaseTextarea.vue';
import BaseBadge from '@/shared/components/BaseBadge.vue';

const props = withDefaults(defineProps<{
  show: boolean;
  atividade: Atividade | null;
  senhaCurso?: string;
  senhaAtividade?: string;
}>(), {
  senhaCurso: '',
  senhaAtividade: '',
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: { nome: string; email: string; respostas: Record<string, string> }): void;
}>();

const alunoNome = ref('');
const alunoEmail = ref('');
const respostasMap = ref<Record<string, string>>({});
const questionsList = ref<Question[]>([]);
const isSubmitting = ref(false);
const submitSuccess = ref(false);
const errorMessage = ref('');
const { success } = useToast();
const serverAcertos = ref<number | null>(null);
const serverTotal = ref<number | null>(null);
const serverPontuacao = ref<number | null>(null);

watch(
  () => props.show,
  (val) => {
    if (val && props.atividade) {
      submitSuccess.value = false;
      errorMessage.value = '';
      serverAcertos.value = null;
      serverTotal.value = null;
      serverPontuacao.value = null;
      respostasMap.value = {};

      Promise.all([
        secureGet('alunoNome'),
        secureGet('alunoEmail'),
        secureGet(`draft_${props.atividade.id}`),
      ]).then(([nome, email, draft]) => {
        alunoNome.value = nome || '';
        alunoEmail.value = email || '';
        if (draft) {
          try {
            respostasMap.value = JSON.parse(draft);
          } catch {
            respostasMap.value = { "0": draft };
          }
        }
      });

      if (props.atividade.json_data) {
        try {
          const parsed = typeof props.atividade.json_data === 'string'
            ? JSON.parse(props.atividade.json_data)
            : props.atividade.json_data;
          questionsList.value = parsed.questions || [];
        } catch {
          questionsList.value = [];
        }
      } else {
        questionsList.value = [];
      }
    }
  }
);

function getQuestionKey(q: Question, idx: number): string {
  return q.id !== undefined ? String(q.id) : String(idx);
}

function handleSaveDraft() {
  if (props.atividade) {
    secureSet(`draft_${props.atividade.id}`, JSON.stringify(respostasMap.value));
    secureSet('alunoNome', alunoNome.value);
    secureSet('alunoEmail', alunoEmail.value);
  }
}

function selectOption(key: string, optionText: string) {
  respostasMap.value[key] = optionText;
  handleSaveDraft();
}

async function handleSubmit() {
  if (!props.atividade || isSubmitting.value) return;
  isSubmitting.value = true;
  errorMessage.value = '';

  handleSaveDraft();

  try {
    const res = await apiClient.post('/submeter-resposta', {
      atividade_id: props.atividade.id,
      aluno_nome: alunoNome.value,
      aluno_email: alunoEmail.value,
      respostas: respostasMap.value,
      senha_curso: props.senhaCurso,
      senha_atividade: props.senhaAtividade
    });

    if (res.success) {
      submitSuccess.value = true;
      secureRemove(`draft_${props.atividade.id}`);
      if (res.data && res.data.consulta_token) {
        secureSet(`consulta_token_${props.atividade.id}`, String(res.data.consulta_token));
      }
      if (res.data && res.data.acertos !== undefined) serverAcertos.value = res.data.acertos;
      if (res.data && res.data.total !== undefined) serverTotal.value = res.data.total;
      if (res.data && res.data.pontuacao !== undefined) serverPontuacao.value = res.data.pontuacao;
      let msg = 'Resposta enviada!';
      if (serverAcertos.value !== null) {
        const total = serverTotal.value ?? questionsList.value.length;
        msg += ` Correção do servidor: ${serverAcertos.value} / ${total} acertos`;
        if (serverPontuacao.value !== null) msg += ` (Pontuação: ${serverPontuacao.value}%)`;
      }
      success(msg);
      emit('submit', {
        nome: alunoNome.value,
        email: alunoEmail.value,
        respostas: respostasMap.value
      });
      setTimeout(() => {
        emit('close');
      }, serverAcertos.value !== null ? 6000 : 2000);
    } else {
      errorMessage.value = res.error || 'Erro ao enviar resposta. Tente novamente.';
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Erro ao enviar resposta. Tente novamente.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <BaseModal
    :model-value="props.show && !!props.atividade"
    max-width="max-w-3xl"
    @close="emit('close')"
  >
    <template v-if="props.atividade" #header>
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-cat-default text-white rounded-md flex items-center justify-center shrink-0 shadow-xs">
          <span class="material-icons text-[18px]">{{ props.atividade.tipo === 'prova' ? 'quiz' : 'edit_note' }}</span>
        </div>
        <h2 class="text-base font-semibold text-primary leading-snug">
          {{ props.atividade.titulo }}
        </h2>
      </div>
    </template>
    <template v-if="props.atividade">
      <p v-if="props.atividade.descricao" class="text-secondary text-sm mb-6 leading-relaxed">
        {{ props.atividade.descricao }}
      </p>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Identificação do Aluno -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-line">
          <BaseInput
            id="aluno-nome"
            v-model="alunoNome"
            @input="handleSaveDraft"
            type="text"
            label="Seu Nome *"
            placeholder="Nome Completo"
          />
          <BaseInput
            id="aluno-email"
            v-model="alunoEmail"
            @input="handleSaveDraft"
            type="email"
            label="Seu E-mail *"
            placeholder="seu.email@exemplo.com"
          />
        </div>

        <!-- Perguntas com Respostas Individuais -->
        <div v-if="questionsList.length > 0" class="space-y-6">
          <h3 class="text-lg font-semibold text-primary">Perguntas da Atividade</h3>
          <div v-for="(q, idx) in questionsList" :key="idx" class="p-5 bg-surface-alt rounded-2xl border border-line space-y-3">
            <p class="font-bold text-primary text-sm sm:text-base">{{ idx + 1 }}. {{ q.title || q.content }}</p>
            <p v-if="q.title && q.content" class="text-secondary text-sm">{{ q.content }}</p>

            <!-- Questão Objetiva: Opções/Alternativas -->
            <div v-if="q.options && q.options.length > 0" class="space-y-2 pt-1">
              <label class="block text-xs font-semibold text-secondary uppercase tracking-wider">Selecione uma alternativa:</label>
              <div class="grid grid-cols-1 gap-2">
                <button
                  v-for="(opt, optIdx) in q.options"
                  :key="optIdx"
                  type="button"
                  @click="selectOption(getQuestionKey(q, idx), opt.text)"
                  :class="[
                    'w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all flex items-center justify-between',
                    respostasMap[getQuestionKey(q, idx)] === opt.text
                      ? 'bg-surface-alt border-accent text-accent font-semibold ring-1 ring-accent'
                      : 'bg-surface-alt border-line text-secondary hover:bg-surface'
                  ]"
                >
                  <span>{{ opt.text }}</span>
                  <span v-if="respostasMap[getQuestionKey(q, idx)] === opt.text" class="material-icons text-accent text-base">check_circle</span>
                  <span v-else class="material-icons text-secondary text-base">radio_button_unchecked</span>
                </button>
              </div>
            </div>

            <!-- Questão Discursiva: Textarea Individual -->
            <div v-else class="pt-1">
              <BaseTextarea
                :id="`resposta-q-${idx}`"
                v-model="respostasMap[getQuestionKey(q, idx)]"
                @input="handleSaveDraft"
                :rows="3"
                label="Sua resposta:"
                placeholder="Escreva sua resposta para esta pergunta..."
              />
            </div>
          </div>
        </div>

        <!-- Mensagem de erro -->
        <div v-if="errorMessage" class="p-3 bg-danger border border-danger text-danger text-sm rounded-xl">
          {{ errorMessage }}
        </div>

        <!-- Aviso de Transparência LGPD & ECA Digital -->
        <div class="p-3.5 bg-surface-alt border border-line rounded-xl text-xs text-secondary flex items-start space-x-2">
          <span class="material-icons text-sm text-accent mt-0.5">verified_user</span>
          <div>
            <strong>Aviso de Privacidade (LGPD & ECA Digital - Lei 15.211/2025):</strong> Coletamos apenas seu nome e e-mail com a finalidade exclusiva de registro e acompanhamento pedagógico pelo professor. Não realizamos perfilamento, nem compartilhamos dados com terceiros ou para fins comerciais.
          </div>
        </div>

        <div class="flex justify-end space-x-3 pt-4 border-t border-line">
          <BaseButton variant="ghost" type="button" :disabled="isSubmitting" @click="emit('close')">Cancelar</BaseButton>
          <BaseButton type="submit" variant="primary" :loading="isSubmitting">
            <span>{{ isSubmitting ? 'Enviando...' : 'Enviar Resposta' }}</span>
          </BaseButton>
        </div>
      </form>
    </template>
  </BaseModal>
</template>
