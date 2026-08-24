<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { apiClient } from '@/shared/api/client';
import { secureGet, secureSet, secureRemove } from '@/shared/utils/storage';
import { useToast } from '@/shared/composables/useToast';
import type { Atividade, Question } from '@/shared/types';
import BaseModal from '@/shared/components/BaseModal.vue';
import BaseButton from '@/shared/components/BaseButton.vue';
import BaseInput from '@/shared/components/BaseInput.vue';
import RichTextEditor from '@/shared/components/RichTextEditor.vue';

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
const rascunhoCodigo = ref('');
const respostasMap = ref<Record<string, string>>({});
const questionsList = ref<Question[]>([]);
const currentStep = ref(0);
const isSubmitting = ref(false);
const submitSuccess = ref(false);
const errorMessage = ref('');
const { success } = useToast();

const totalSteps = computed(() => questionsList.value.length + 2); // 0 (ID), 1..N (Perguntas), N+1 (Revisão)
const progress = computed(() => ((currentStep.value) / (totalSteps.value - 1)) * 100);

watch(
  () => props.show,
  (val) => {
    if (val && props.atividade) {
      currentStep.value = 0;
      submitSuccess.value = false;
      errorMessage.value = '';
      respostasMap.value = {};
      rascunhoCodigo.value = '';

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

async function handleRestoreDraft() {
  if (!rascunhoCodigo.value) return;
  try {
    const res: any = await apiClient.get(`/rascunhos/${rascunhoCodigo.value}`);
    const data = res.data?.data || res.data || res;
    if (res.success !== false && data && (data.nome || data.aluno_nome || data.email || data.aluno_email)) {
      alunoNome.value = data.nome || data.aluno_nome || '';
      alunoEmail.value = data.email || data.aluno_email || '';
      respostasMap.value = data.respostas || {};
      success('Rascunho restaurado com sucesso!');
      rascunhoCodigo.value = '';
      errorMessage.value = '';
    } else {
      errorMessage.value = res.error || (res.data && res.data.error) || 'Código inválido ou expirado.';
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Erro ao restaurar rascunho.';
  }
}

function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const showDraftModal = ref(false);
const savedDraftCode = ref('');
const isCopyingCode = ref(false);
const draftEmailInput = ref('');
const isSendingDraftEmail = ref(false);
const draftEmailStatus = ref('');

async function handleSaveDraftToServer() {
  if (!props.atividade) return;
  if (!alunoEmail.value || !isValidEmailFormat(alunoEmail.value)) {
    errorMessage.value = 'Preencha um e-mail válido no primeiro passo para salvar o rascunho no servidor.';
    return;
  }
  errorMessage.value = '';
  try {
    const res: any = await apiClient.post(`/atividades/${props.atividade.id}/rascunhos`, {
      nome: alunoNome.value,
      email: alunoEmail.value,
      respostas: respostasMap.value
    });
    const codigo = res.data?.codigo || res.data?.codigo_recuperacao || res.codigo || res.codigo_recuperacao;
    if (res.success && codigo) {
      savedDraftCode.value = codigo;
      draftEmailInput.value = alunoEmail.value;
      draftEmailStatus.value = '';
      showDraftModal.value = true;
      success('Rascunho salvo com sucesso!');
    } else {
      errorMessage.value = res.error || (res.data && res.data.error) || res.message || 'Erro ao salvar rascunho.';
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Erro ao salvar rascunho.';
  }
}

async function copyDraftCode() {
  if (!savedDraftCode.value) return;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(savedDraftCode.value);
    }
    isCopyingCode.value = true;
    success('Código copiado para a área de transferência!');
    setTimeout(() => {
      isCopyingCode.value = false;
    }, 2500);
  } catch {
    isCopyingCode.value = true;
    setTimeout(() => {
      isCopyingCode.value = false;
    }, 2500);
  }
}

async function handleSendDraftEmail() {
  if (!props.atividade || !savedDraftCode.value) return;
  const email = draftEmailInput.value.trim();
  if (!email || !isValidEmailFormat(email)) {
    draftEmailStatus.value = 'Informe um e-mail válido para receber o código.';
    return;
  }
  isSendingDraftEmail.value = true;
  draftEmailStatus.value = '';
  try {
    const res: any = await apiClient.post(`/atividades/${props.atividade.id}/rascunhos/enviar-email`, {
      email,
      codigo: savedDraftCode.value
    });
    if (res.success) {
      draftEmailStatus.value = 'Código enviado para seu e-mail com sucesso!';
      success('Código enviado por e-mail!');
    } else {
      draftEmailStatus.value = res.error || res.message || 'Erro ao enviar e-mail.';
    }
  } catch (err: any) {
    draftEmailStatus.value = err.message || 'Erro ao enviar e-mail.';
  } finally {
    isSendingDraftEmail.value = false;
  }
}

function selectOption(key: string, optionText: string) {
  respostasMap.value[key] = optionText;
  handleSaveDraft();
}

function nextStep() {
  if (currentStep.value === 0 && (!alunoNome.value || !alunoEmail.value)) {
    errorMessage.value = 'Preencha seu nome e e-mail.';
    return;
  }
  if (currentStep.value === 0 && !isValidEmailFormat(alunoEmail.value)) {
    errorMessage.value = 'Informe um formato de e-mail válido (ex: seu@email.com).';
    return;
  }
  errorMessage.value = '';
  if (currentStep.value < totalSteps.value - 1) {
    currentStep.value++;
    handleSaveDraft();
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
}

const enviarEmail = ref(false);
const serverAcertos = ref<number | null>(null);
const serverTotal = ref<number | null>(null);
const serverPontuacao = ref<number | null>(null);

async function handleSubmit() {
  if (isSubmitting.value) return;
  
  isSubmitting.value = true;
  errorMessage.value = '';

  try {
    const res = await apiClient.post(`/atividades/${props.atividade!.id}/respostas`, {
      aluno_nome: alunoNome.value,
      aluno_email: alunoEmail.value,
      respostas: respostasMap.value,
      enviar_email: enviarEmail.value,
      senha_curso: props.senhaCurso,
      senha_atividade: props.senhaAtividade
    });

    if (res.success) {
      submitSuccess.value = true;
      secureRemove(`draft_${props.atividade!.id}`);
      if (res.data?.consulta_token) {
        secureSet(`consulta_token_${props.atividade!.id}`, String(res.data.consulta_token));
      }
      if (res.data?.acertos !== undefined) serverAcertos.value = res.data.acertos;
      if (res.data?.total !== undefined) serverTotal.value = res.data.total;
      if (res.data?.pontuacao !== undefined) serverPontuacao.value = res.data.pontuacao;
      
      let msg = 'Resposta enviada com sucesso!';
      if (props.atividade?.tipo === 'prova' && serverAcertos.value !== null) {
        const total = serverTotal.value ?? questionsList.value.length;
        msg += ` Correção do servidor: ${serverAcertos.value} / ${total} acertos`;
        if (serverPontuacao.value !== null) msg += ` (${serverPontuacao.value}%)`;
      }
      success(msg);
      emit('submit', { nome: alunoNome.value, email: alunoEmail.value, respostas: respostasMap.value });
      setTimeout(() => emit('close'), props.atividade?.tipo === 'prova' && serverAcertos.value !== null ? 4000 : 2500);
    } else {
      errorMessage.value = res.error || (res.data && res.data.error) || 'Erro ao enviar resposta. Verifique os dados e tente novamente.';
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Erro ao enviar resposta.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <BaseModal
    :model-value="props.show && !!props.atividade"
    max-width="max-w-4xl"
    @close="emit('close')"
  >
    <template #header>
      <div class="flex-1">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-9 h-9 bg-cat-default text-white rounded-md flex items-center justify-center shadow-xs">
            <span class="material-icons text-[18px]">{{ props.atividade?.tipo === 'prova' ? 'quiz' : 'edit_note' }}</span>
          </div>
          <h2 class="text-base font-semibold text-primary">{{ props.atividade?.titulo }}</h2>
        </div>
        <div class="w-full h-1.5 bg-surface rounded-full overflow-hidden">
          <div class="h-full bg-accent transition-all duration-300" :style="{ width: `${progress}%` }"></div>
        </div>
        <p class="text-xs text-secondary mt-1">Passo {{ currentStep + 1 }} de {{ totalSteps }}</p>
      </div>
    </template>

    <div v-if="props.atividade" class="space-y-6">
      <div v-if="currentStep === 0" class="space-y-4">
        <!-- Painel LGPD e Re-envio -->
        <div class="p-4 bg-surface-alt border border-line rounded-xl space-y-3">
          <div class="flex items-start gap-2 text-secondary">
             <span class="material-icons text-accent text-lg mt-0.5">shield</span>
             <p class="text-xs">Seus dados são protegidos pela LGPD e ECA Digital. Se você enviar a atividade mais de uma vez com o mesmo e-mail, sua resposta anterior será automaticamente atualizada (a última tentativa é a que prevalece).</p>
          </div>
        </div>

        <BaseInput v-model="alunoNome" label="Seu Nome *" placeholder="Nome Completo" />
        <BaseInput v-model="alunoEmail" type="email" label="Seu E-mail *" placeholder="seu@email.com" />
        
        <div class="flex items-center gap-2 pt-1">
          <input
            id="enviarEmailCheckbox"
            v-model="enviarEmail"
            type="checkbox"
            class="w-4 h-4 text-accent border-line rounded focus:ring-accent accent-accent cursor-pointer"
          />
          <label for="enviarEmailCheckbox" class="text-xs font-medium text-primary cursor-pointer select-none">
            Desejo receber uma cópia de comprovante com minhas respostas por e-mail
          </label>
        </div>
        
        <div class="border-t border-line pt-4 space-y-2">
            <p class="text-sm font-medium text-primary">Restaurar Rascunho</p>
            <div class="flex gap-2">
                <BaseInput v-model="rascunhoCodigo" class="flex-1" placeholder="Código (ex: R8K9X2)" />
                <BaseButton variant="secondary" @click="handleRestoreDraft">Restaurar</BaseButton>
            </div>
        </div>
      </div>

      <div v-else-if="currentStep <= questionsList.length" class="space-y-4">
        <template v-for="(q, idx) in questionsList" :key="idx">
          <div v-if="currentStep === idx + 1" class="space-y-4">
            <h3 class="font-bold text-primary">{{ idx + 1 }}. {{ q.title || q.content }}</h3>
            
            <div v-if="q.options && q.options.length > 0" class="grid gap-2">
              <button
                v-for="opt in q.options" :key="opt.text"
                type="button"
                @click="selectOption(getQuestionKey(q, idx), opt.text)"
                :class="['w-full text-left px-4 py-3 rounded-xl border', respostasMap[getQuestionKey(q, idx)] === opt.text ? 'border-accent bg-surface-alt' : 'border-line']"
              >
                {{ opt.text }}
              </button>
            </div>
            
            <RichTextEditor
              v-else
              v-model="respostasMap[getQuestionKey(q, idx)]"
              @update:model-value="handleSaveDraft"
              label="Sua resposta:"
            />
          </div>
        </template>
      </div>

      <div v-else class="space-y-4">
        <h3 class="font-bold text-primary">Revisão das Respostas</h3>
        <div class="bg-surface-alt p-4 rounded-xl space-y-4 max-h-[60vh] overflow-y-auto">
          <div v-for="(q, idx) in questionsList" :key="idx" class="border-b border-line pb-3">
            <div class="flex justify-between items-start mb-1">
              <p class="text-sm font-semibold text-primary">{{ idx + 1 }}. {{ q.title || q.content }}</p>
              <BaseButton size="sm" variant="ghost" @click="currentStep = idx + 1">Editar</BaseButton>
            </div>
            <div
              v-if="respostasMap[getQuestionKey(q, idx)]"
              class="text-sm text-secondary bg-surface p-3 rounded-lg border border-line prose prose-sm max-w-none dark:prose-invert"
              v-html="respostasMap[getQuestionKey(q, idx)]"
            ></div>
            <p v-else class="text-sm text-muted italic">Não respondida</p>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2 bg-surface p-3 border border-line rounded-xl">
          <input
            id="enviarEmailCheckboxRev"
            v-model="enviarEmail"
            type="checkbox"
            class="w-4 h-4 text-accent border-line rounded focus:ring-accent accent-accent cursor-pointer"
          />
          <label for="enviarEmailCheckboxRev" class="text-xs font-medium text-primary cursor-pointer select-none">
            Desejo receber uma cópia de comprovante com minhas respostas por e-mail ({{ alunoEmail || 'e-mail informado' }})
          </label>
        </div>
      </div>

      <div v-if="submitSuccess" class="p-4 bg-surface-alt border border-accent rounded-xl text-center space-y-2">
        <h3 class="text-lg font-bold text-primary">Resposta Enviada com Sucesso!</h3>
        <p v-if="props.atividade?.tipo === 'prova' && serverAcertos !== null" class="text-sm text-accent font-semibold">
          Correção do servidor: {{ serverAcertos }} / {{ serverTotal ?? questionsList.length }} acertos
          <span v-if="serverPontuacao !== null">({{ serverPontuacao }}%)</span>
        </p>
        <p v-else class="text-xs text-secondary">
          Sua resposta foi registrada com sucesso.
        </p>
      </div>

      <div v-if="errorMessage" class="p-3 bg-danger text-white text-sm rounded-xl">{{ errorMessage }}</div>

      <div class="flex justify-between pt-4 border-t border-line">
        <BaseButton variant="secondary" :disabled="currentStep === 0" @click="prevStep">Anterior</BaseButton>
        <div class="flex gap-2">
            <BaseButton v-if="currentStep > 0" variant="ghost" @click="handleSaveDraftToServer">Salvar Rascunho</BaseButton>
            <BaseButton v-if="currentStep < totalSteps - 1" variant="primary" @click="nextStep">Próximo</BaseButton>
            <BaseButton v-else variant="primary" :loading="isSubmitting" @click="handleSubmit">Enviar Resposta</BaseButton>
        </div>
      </div>
    </div>
  </BaseModal>

  <!-- Modal de Exibição do Código de Rascunho -->
  <BaseModal
    :model-value="showDraftModal"
    title="Rascunho Salvo no Servidor"
    max-width="max-w-md"
    @close="showDraftModal = false"
  >
    <div class="space-y-4 text-center">
      <div class="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto">
        <span class="material-icons text-2xl">save</span>
      </div>
      <div>
        <h3 class="text-base font-bold text-primary">Código de Recuperação</h3>
        <p class="text-xs text-secondary mt-1">Guarde este código! Ele é válido por 30 dias para você restaurar suas respostas em qualquer dispositivo.</p>
      </div>

      <div class="p-3.5 bg-surface-alt border border-line rounded-xl flex items-center justify-between gap-2">
        <span class="font-mono text-base font-bold tracking-widest text-accent select-all">{{ savedDraftCode }}</span>
        <BaseButton size="sm" variant="secondary" @click="copyDraftCode">
          <span class="material-icons text-xs mr-1">{{ isCopyingCode ? 'check' : 'content_copy' }}</span>
          {{ isCopyingCode ? 'Copiado!' : 'Copiar Código' }}
        </BaseButton>
      </div>

      <div class="border-t border-line pt-3 text-left space-y-2">
        <p class="text-xs font-medium text-primary">Enviar código para seu e-mail</p>
        <div class="flex gap-2">
          <BaseInput v-model="draftEmailInput" type="email" placeholder="seu@email.com" class="flex-1" />
          <BaseButton variant="secondary" :loading="isSendingDraftEmail" @click="handleSendDraftEmail">Enviar</BaseButton>
        </div>
        <p v-if="draftEmailStatus" :class="['text-[11px]', draftEmailStatus.includes('sucesso') ? 'text-accent font-medium' : 'text-danger']">
          {{ draftEmailStatus }}
        </p>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end pt-2">
        <BaseButton variant="primary" @click="showDraftModal = false">Concluir</BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
