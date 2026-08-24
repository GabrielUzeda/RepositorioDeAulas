<script setup lang="ts">
import { computed } from 'vue';
import BaseBadge from '@/shared/components/BaseBadge.vue';

const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    icon?: string;
    color?: string;
    badgeText?: string;
    badgeVariant?: 'accent' | 'success' | 'danger' | 'warning' | 'secondary' | 'neutral';
    meta?: Array<{ icon?: string; label: string }>;
    actionText?: string;
    actionIcon?: string;
    isLocked?: boolean;
  }>(),
  {
    description: '',
    icon: 'school',
    color: 'bg-accent',
    badgeText: '',
    badgeVariant: 'accent',
    meta: () => [],
    actionText: 'Ver conteúdo',
    actionIcon: 'arrow_forward',
    isLocked: false,
  }
);

const emit = defineEmits<(e: 'click') => void>();

const isMatIcon = computed(() => {
  const icon = props.icon;
  return icon && (isNaN(Number(icon)) || icon.length > 2);
});
</script>

<template>
  <div
    @click="emit('click')"
    role="button"
    :aria-label="title"
    tabindex="0"
    @keydown.enter="emit('click')"
    @keydown.space.prevent="emit('click')"
    class="group relative bg-surface-alt rounded-lg border border-line card-hover flex flex-col cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas overflow-hidden"
  >
    <!-- Top accent bar -->
    <div
      class="h-1.5 w-full"
      :class="props.color"
    />

    <div class="p-5 flex flex-col gap-3 flex-1">
      <!-- Icon + Title Header (alinhados verticalmente ao centro) -->
      <div class="flex items-center gap-3">
        <!-- Ícone em box colorido -->
        <div
          class="flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center text-white shadow-xs"
          :class="props.color"
        >
          <span v-if="props.isLocked" class="material-icons text-[18px]">lock</span>
          <span v-else-if="isMatIcon" class="material-icons text-[18px]">{{ props.icon }}</span>
          <b v-else class="text-xs font-bold">{{ props.icon || '00' }}</b>
        </div>

        <!-- Título e Badge alinhados em centro -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-primary leading-snug line-clamp-2">
              {{ props.title }}
            </h3>
            <div class="flex items-center gap-2 flex-shrink-0">
              <BaseBadge
                v-if="props.badgeText"
                :variant="props.badgeVariant"
              >
                {{ props.badgeText }}
              </BaseBadge>
              <slot name="header-actions" />
            </div>
          </div>
        </div>
      </div>

      <!-- Descrição -->
      <p class="text-xs text-secondary leading-relaxed line-clamp-3 flex-1">
        {{ props.isLocked ? 'Conteúdo protegido por senha.' : (props.description || 'Clique para visualizar.') }}
      </p>

      <!-- Meta informações (ex: disciplinas/professores no CursoCard) -->
      <div v-if="props.meta && props.meta.length > 0" class="flex items-center gap-3 pt-1 text-xs text-muted">
        <span v-for="(m, idx) in props.meta" :key="idx" class="flex items-center gap-1">
          <span v-if="m.icon" class="material-icons text-[14px]">{{ m.icon }}</span>
          {{ m.label }}
        </span>
      </div>

      <!-- Rodapé CTA com transição greyed-out -> accent no hover -->
      <div v-if="props.actionText" class="pt-3 border-t border-line flex items-center justify-between text-xs font-semibold text-muted group-hover:text-accent transition-colors duration-base">
        <span>{{ props.isLocked ? 'Inserir senha' : props.actionText }}</span>
        <span class="material-icons text-[16px] group-hover:translate-x-0.5 transition-transform duration-base">
          {{ props.isLocked ? 'lock' : props.actionIcon }}
        </span>
      </div>
    </div>
  </div>
</template>
