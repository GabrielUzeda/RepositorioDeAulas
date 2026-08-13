<script setup lang="ts">
const modelValue = defineModel<string | number>()
defineProps<{
  tabs: Array<{ label: string; value: string | number }>
}>()
function select(v: string | number) {
  modelValue.value = v
}
</script>

<template>
  <div class="flex bg-surface-alt p-1 rounded-control">
    <button
      v-for="t in tabs"
      :key="t.value"
      @click="select(t.value)"
      :class="[
        'px-5 py-2 rounded-control text-sm font-bold transition',
        t.value === modelValue ? 'bg-surface-alt text-accent shadow-sm' : 'text-secondary hover:text-primary'
      ]"
    >{{ t.label }}</button>
  </div>
</template>
