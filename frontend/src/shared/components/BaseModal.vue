<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  modelValue: boolean
  title?: string
  maxWidth?: string
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
  if (event.key === 'Escape') {
    fechar()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 bg-surface backdrop-blur-md flex items-center justify-center p-4 z-50"
        @click.self="fechar"
      >
        <div
          class="bg-surface-alt rounded-modal p-6 sm:p-8 w-full max-h-[90vh] flex flex-col shadow-modal relative border border-line"
          :class="maxWidth || 'max-w-2xl'"
        >
          <div class="shrink-0">
            <slot name="header">
              <div class="flex justify-between items-start border-b pb-4">
                <h2 v-if="title" class="text-2xl font-bold text-primary">{{ title }}</h2>
                <button
                  class="ml-auto text-secondary hover:text-primary p-2 rounded-full hover:bg-surface transition"
                  @click="fechar"
                >
                  <span class="material-icons">close</span>
                </button>
              </div>
            </slot>
          </div>

          <div class="flex-1 min-h-0 overflow-y-auto pt-4">
            <slot />
          </div>

          <div class="shrink-0">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
