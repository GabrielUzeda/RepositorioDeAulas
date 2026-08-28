<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[999999] flex w-80 max-w-[90vw] flex-col gap-2.5 pointer-events-none">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast-card group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface-alt/95 p-3.5 shadow-modal backdrop-blur-md pointer-events-auto border-l-4 transition-all duration-200"
          :class="getBorderClass(t.type)"
          @mouseenter="pause(t.id)"
          @mouseleave="resume(t.id)"
        >
          <div class="flex items-center gap-3">
            <span class="material-icons text-xl shrink-0" :class="getTextClass(t.type)">{{ getIcon(t.type) }}</span>
            <div class="flex-1 min-w-0 pr-1 flex flex-col justify-center">
              <p v-if="t.title" class="text-sm font-semibold text-primary leading-tight mb-0.5">{{ t.title }}</p>
              <p class="text-xs sm:text-sm text-secondary leading-snug break-words">{{ t.message }}</p>
              <button
                v-if="t.action"
                class="mt-1.5 text-xs font-semibold text-accent hover:underline focus:outline-none self-start"
                @click="t.action.onClick"
              >
                {{ t.action.label }}
              </button>
            </div>
            <button
              type="button"
              class="shrink-0 flex items-center justify-center rounded-lg p-1 text-muted transition-colors hover:bg-surface hover:text-primary"
              aria-label="Fechar"
              @click="dismiss(t.id)"
            >
              <span class="material-icons text-base">close</span>
            </button>
          </div>
          
          <div v-if="!t.persistent" class="absolute bottom-0 left-0 right-0 h-0.5 bg-line/20 overflow-hidden">
            <div 
              class="h-full toast-progress-bar"
              :class="getBgClass(t.type)"
              :style="{ animationDuration: `${t.duration}ms` }"
            ></div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { toasts, dismiss, pause, resume } = useToast()

const getIcon = (type: string) => {
  switch (type) {
    case 'success': return 'check_circle'
    case 'error': return 'error'
    case 'warning': return 'warning'
    default: return 'info'
  }
}

const getBorderClass = (type: string) => {
  switch (type) {
    case 'success': return 'border-l-success'
    case 'error': return 'border-l-danger'
    case 'warning': return 'border-l-warning'
    default: return 'border-l-accent'
  }
}

const getTextClass = (type: string) => {
  switch (type) {
    case 'success': return 'text-success'
    case 'error': return 'text-danger-text'
    case 'warning': return 'text-warning-text'
    default: return 'text-accent'
  }
}

const getBgClass = (type: string) => {
  switch (type) {
    case 'success': return 'bg-success'
    case 'error': return 'bg-danger'
    case 'warning': return 'bg-warning'
    default: return 'bg-accent'
  }
}
</script>

<style scoped>
.toast-move,
.toast-enter-active,
.toast-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(40px) scale(0.95);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(40px) scale(0.95);
}

.toast-progress-bar {
  animation: toast-progress linear forwards;
}

.toast-card:hover .toast-progress-bar {
  animation-play-state: paused;
}

@keyframes toast-progress {
  from { width: 100%; }
  to { width: 0%; }
}
</style>
