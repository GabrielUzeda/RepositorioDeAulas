<script setup lang="ts">
withDefaults(
  defineProps<{
    icon?: string
    title?: string
    message?: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    icon: 'inbox',
    size: 'md',
  }
)
</script>

<template>
  <div
    class="flex flex-col items-center justify-center text-center border border-dashed border-line rounded-lg"
    :class="[
      size === 'sm' ? 'py-8 px-4' : '',
      size === 'md' ? 'py-12 px-6' : '',
      size === 'lg' ? 'py-16 px-8' : '',
    ]"
  >
    <div class="w-14 h-14 rounded-full bg-accent-light flex items-center justify-center mb-4">
      <span class="material-icons text-accent text-2xl">{{ icon }}</span>
    </div>
    <p v-if="title" class="text-sm font-semibold text-primary mb-1">{{ title }}</p>
    <p v-if="message" class="text-sm text-muted max-w-xs">{{ message }}</p>
    <div v-if="$slots.action" class="mt-5">
      <slot name="action" />
    </div>
  </div>
</template>
