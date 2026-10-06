<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    maxWidth?: string
    noPadding?: boolean
    allowFullscreen?: boolean
    fullscreen?: boolean
    actionsOverlay?: boolean
  }>(),
  {
    maxWidth: 'max-w-2xl',
    noPadding: false,
    allowFullscreen: false,
    fullscreen: undefined,
    actionsOverlay: false,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:fullscreen': [value: boolean]
  'close': []
}>()

const internalFullscreen = ref(false)
const isFullscreen = computed(() => props.fullscreen ?? internalFullscreen.value)

function setFullscreen(value: boolean) {
  internalFullscreen.value = value
  emit('update:fullscreen', value)
}

function toggleFullscreen() {
  setFullscreen(!isFullscreen.value)
}

function fechar() {
  setFullscreen(false)
  emit('update:modelValue', false)
  emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') fechar()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

watch(
  () => props.modelValue,
  (val) => {
    if (!val && isFullscreen.value) setFullscreen(false)
  }
)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center"
        :class="isFullscreen ? 'p-0' : 'p-4'"
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
          class="relative z-10 w-full flex flex-col bg-surface-alt border border-line shadow-modal transition-all duration-200"
          :class="[
            isFullscreen
              ? 'fixed inset-0 h-[100dvh] max-h-[100dvh] max-w-none rounded-none border-none'
              : `rounded-2xl max-h-[90vh] ${props.maxWidth || 'max-w-2xl'}`
          ]"
        >
          <!-- Header -->
          <div
            class="shrink-0 gap-4"
            :class="props.actionsOverlay
              ? 'relative px-6 pt-5'
              : 'flex items-start justify-between px-6 pt-5 pb-4 border-b border-line'"
          >
            <div :class="props.actionsOverlay ? '' : 'flex-1 min-w-0'">
              <slot name="header">
                <h2
                  v-if="title"
                  id="modal-title"
                  class="text-h3 font-semibold text-primary leading-snug"
                >{{ title }}</h2>
              </slot>
            </div>

            <div
              class="flex items-center gap-1 shrink-0"
              :class="props.actionsOverlay ? 'absolute top-5 right-6 h-9' : 'ml-auto -mt-0.5'"
            >
              <button
                v-if="props.allowFullscreen"
                class="p-1.5 rounded-md text-muted hover:text-primary hover:bg-surface transition-colors duration-base flex items-center justify-center"
                :title="isFullscreen ? 'Restaurar tamanho' : 'Modo tela cheia'"
                :aria-label="isFullscreen ? 'Restaurar tamanho' : 'Modo tela cheia'"
                @click="toggleFullscreen"
              >
                <span class="material-icons text-[20px] leading-none">{{ isFullscreen ? 'fullscreen_exit' : 'fullscreen' }}</span>
              </button>

              <button
                class="p-1.5 rounded-md text-muted hover:text-primary hover:bg-surface transition-colors duration-base flex items-center justify-center"
                @click="fechar"
                aria-label="Fechar modal"
              >
                <span class="material-icons text-[20px] leading-none">close</span>
              </button>
            </div>
          </div>

          <!-- Body -->
          <div
            class="flex-1 min-h-0 overflow-y-auto"
            :class="[noPadding ? '' : (isFullscreen ? 'px-4 py-4 md:px-10 md:py-6' : 'px-6 py-5'), isFullscreen ? 'max-h-[calc(100dvh-130px)] flex flex-col' : '']"
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
