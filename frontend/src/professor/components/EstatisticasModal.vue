<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { apiClient } from '@/shared/api/client';
import type { DisciplinaEstatisticas, EstatisticaAtividade, EstatisticaQuestao } from '@/shared/types';
import BaseModal from '@/shared/components/BaseModal.vue';
import BaseButton from '@/shared/components/BaseButton.vue';
import BaseBadge from '@/shared/components/BaseBadge.vue';
import BaseSpinner from '@/shared/components/BaseSpinner.vue';
import EmptyState from '@/shared/components/EmptyState.vue';

const props = defineProps<{
  show: boolean;
  disciplinaId: number | null;
  disciplinaNome?: string;
}>();

const emit = defineEmits<(e: 'close') => void>();

const isLoading = ref(false);
const erro = ref('');
const minAgrupamento = ref(5);
const atividades = ref<EstatisticaAtividade[]>([]);

const atividadesComQuestoes = computed(() => atividades.value.filter((a) => a.questoes.length > 0));

const TIPOS: Record<string, { label: string; badgeClass: string; icone: string }> = {
  reforco: { label: 'Reforço', badgeClass: 'bg-cat-reforco-bg text-cat-reforco', icone: 'fitness_center' },
  minigame: { label: 'Minigame', badgeClass: 'bg-cat-minigame-bg text-cat-minigame', icone: 'sports_esports' },
  roleta: { label: 'Roleta', badgeClass: 'bg-cat-roleta-bg text-cat-roleta', icone: 'casino' },
  prova: { label: 'Prova', badgeClass: 'bg-accent-light text-accent', icone: 'quiz' },
  normal: { label: 'Atividade', badgeClass: 'bg-surface text-secondary', icone: 'edit_note' },
};

function tipoInfo(tipo: string) {
  return TIPOS[tipo] || TIPOS.normal;
}

interface TomQuestao {
  barra: string;
  texto: string;
  rotulo: string;
}

function tomDaQuestao(questao: EstatisticaQuestao): TomQuestao {
  if (questao.taxa_acerto === null) {
    return { barra: 'bg-line', texto: 'text-secondary', rotulo: '' };
  }
  if (questao.taxa_acerto >= 80) {
    return { barra: 'bg-success', texto: 'text-success-text', rotulo: 'Maioria acertou' };
  }
  if (questao.taxa_acerto < 50) {
    return { barra: 'bg-danger', texto: 'text-danger-text', rotulo: 'Maioria errou' };
  }
  return { barra: 'bg-accent', texto: 'text-accent', rotulo: 'Turma dividida' };
}

async function carregar() {
  if (!props.disciplinaId) return;
  isLoading.value = true;
  erro.value = '';
  try {
    const res = await apiClient.get<DisciplinaEstatisticas>(
      `/disciplinas/${props.disciplinaId}/estatisticas`
    );
    if (res.success && res.data) {
      minAgrupamento.value = res.data.min_agrupamento || 5;
      atividades.value = res.data.atividades || [];
    } else {
      erro.value = 'Não foi possível carregar o desempenho da turma.';
      atividades.value = [];
    }
  } finally {
    isLoading.value = false;
  }
}

watch(
  () => [props.show, props.disciplinaId],
  ([mostrando]) => {
    if (mostrando && props.disciplinaId) {
      void carregar();
    }
  }
);
</script>

<template>
  <BaseModal
    :model-value="props.show"
    max-width="max-w-4xl"
    @close="emit('close')"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-accent-light text-accent rounded-md flex items-center justify-center shrink-0 shadow-xs">
          <span class="material-icons text-[18px]">insights</span>
        </div>
        <div class="min-w-0">
          <h2 class="text-base font-semibold text-primary leading-snug">Desempenho da Turma</h2>
          <p v-if="props.disciplinaNome" class="text-xs text-secondary truncate">{{ props.disciplinaNome }}</p>
        </div>
      </div>
    </template>

    <div class="space-y-5">
      <div class="p-3 bg-surface-alt border border-line rounded-xl flex items-start gap-2.5">
        <span class="material-icons text-accent text-lg mt-0.5 shrink-0">info</span>
        <p class="text-xs text-secondary leading-relaxed">
          Dados <strong class="text-primary">agregados por questão</strong> — nenhum aluno é identificado.
          Reforço e minigame servem como diagnóstico, não como avaliação.
          Questões com menos de <strong class="text-primary">{{ minAgrupamento }}</strong> respostas têm os números ocultos.
        </p>
      </div>

      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <BaseSpinner />
      </div>

      <div v-else-if="erro" class="p-3 bg-danger-light border-l-4 border-danger text-danger-text rounded-r-xl text-sm">
        {{ erro }}
      </div>

      <EmptyState
        v-else-if="atividadesComQuestoes.length === 0"
        icon="insights"
        title="Sem dados para exibir"
        message="Nenhuma atividade desta disciplina possui questões para gerar estatísticas."
      />

      <div v-else class="space-y-4">
        <div
          v-for="atividade in atividadesComQuestoes"
          :key="atividade.id"
          class="border border-line rounded-2xl overflow-hidden"
        >
          <div class="flex items-center justify-between gap-3 px-4 py-3 bg-surface-alt border-b border-line">
            <div class="flex items-center gap-2 min-w-0">
              <span class="material-icons text-base" :class="tipoInfo(atividade.tipo).badgeClass.split(' ')[1]">
                {{ tipoInfo(atividade.tipo).icone }}
              </span>
              <h3 class="text-sm font-semibold text-primary truncate">{{ atividade.titulo }}</h3>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-xs px-2 py-0.5 rounded-pill" :class="tipoInfo(atividade.tipo).badgeClass">
                {{ tipoInfo(atividade.tipo).label }}
              </span>
              <BaseBadge variant="secondary">
                {{ atividade.total_submissoes }} {{ atividade.total_submissoes === 1 ? 'resposta' : 'respostas' }}
              </BaseBadge>
            </div>
          </div>

          <div class="p-4 space-y-2.5 bg-surface-alt">
            <p v-if="!atividade.suficientes" class="text-xs text-secondary italic mb-1">
              Números ocultos: esta atividade ainda tem menos de {{ minAgrupamento }} respostas.
            </p>

            <div
              v-for="questao in atividade.questoes"
              :key="questao.indice"
              class="p-3 rounded-xl border border-line bg-surface space-y-2"
            >
              <div class="flex items-start justify-between gap-3">
                <p class="text-sm font-medium text-primary leading-relaxed">
                  {{ questao.indice + 1 }}. {{ questao.titulo }}
                </p>
                <BaseBadge v-if="questao.taxa_acerto !== null" variant="secondary">
                  {{ questao.taxa_acerto }}%
                </BaseBadge>
              </div>

              <p v-if="!questao.objetivo" class="text-xs text-secondary">
                Questão discursiva — sem correção automática.
              </p>

              <p v-else-if="questao.acertos === null" class="text-xs text-secondary">
                Dados insuficientes para exibir o desempenho desta questão.
              </p>

              <template v-else>
                <div class="h-2 rounded-pill bg-surface-alt border border-line overflow-hidden">
                  <div
                    class="h-full transition-all duration-300"
                    :class="tomDaQuestao(questao).barra"
                    :style="{ width: `${questao.taxa_acerto}%` }"
                  ></div>
                </div>
                <div class="flex items-center justify-between gap-2 text-xs">
                  <span class="font-semibold" :class="tomDaQuestao(questao).texto">
                    {{ tomDaQuestao(questao).rotulo }}
                  </span>
                  <span class="text-secondary">
                    {{ questao.acertos }} {{ questao.acertos === 1 ? 'acertou' : 'acertaram' }} /
                    {{ questao.erros }} {{ questao.erros === 1 ? 'errou' : 'erraram' }}
                    ({{ questao.respondentes }} respostas)
                  </span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end">
        <BaseButton variant="secondary" size="sm" @click="emit('close')">
          <span class="material-icons text-sm">close</span>
          <span>Fechar</span>
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
