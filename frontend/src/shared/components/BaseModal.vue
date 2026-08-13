<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  modelValue: boolean
  title?: string
  maxWidth?: string
  noPadding?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'close': []
}>()

function fechar() {
  emit('update:modelValue', false)
  emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') fechar()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? 'modal-title' : undefined"
      >
        <!-- Backdrop — sutil blur com opacidade (Schoger: don't use pure black) -->
        <div
          class="absolute inset-0 bg-primary/30 backdrop-blur-sm"
          @click="fechar"
          aria-hidden="true"
        />

        <!-- Panel -->
        <div
          class="relative z-10 w-full flex flex-col bg-surface-alt border border-line rounded-2xl shadow-modal max-h-[90vh]"
          :class="maxWidth || 'max-w-2xl'"
        >
          <!-- Header -->
          <div class="shrink-0 flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-line">
            <slot name="header">
              <h2
                v-if="title"
                id="modal-title"
                class="text-h3 font-semibold text-primary leading-snug"
              >{{ title }}</h2>
            </slot>

            <button
              class="ml-auto flex-shrink-0 -mt-0.5 p-1.5 rounded-md text-muted hover:text-primary hover:bg-surface transition-colors duration-base"
              @click="fechar"
              aria-label="Fechar modal"
            >
              <span class="material-icons text-[20px]">close</span>
            </button>
          </div>

          <!-- Body -->
          <div
            class="flex-1 min-h-0 overflow-y-auto"
            :class="noPadding ? '' : 'px-6 py-5'"
          >
            <slot />
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="shrink-0 border-t border-line px-6 py-4">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
