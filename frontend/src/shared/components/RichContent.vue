<script setup lang="ts">
import { computed } from 'vue';
import { sanitizarHtml, contemHtml } from '@/shared/utils/sanitizeHtml';

const props = withDefaults(
  defineProps<{
    conteudo?: string;
    tag?: string;
  }>(),
  {
    conteudo: '',
    tag: 'div',
  }
);

const ehHtml = computed(() => contemHtml(props.conteudo));

const htmlSeguro = computed(() => (ehHtml.value ? sanitizarHtml(props.conteudo) : ''));
</script>

<template>
  <component
    :is="tag"
    v-if="ehHtml"
    class="rich-content rich-content-html"
    v-html="htmlSeguro"
  />
  <component :is="tag" v-else class="rich-content whitespace-pre-wrap">
    {{ conteudo }}
  </component>
</template>

<style scoped>
.rich-content-html :deep(pre) {
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: 0.5rem;
  padding: 0.75rem;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.75rem;
  line-height: 1.5;
  overflow-x: auto;
  margin: 0.5rem 0;
  white-space: pre;
}

.rich-content-html :deep(code) {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.875em;
}

.rich-content-html :deep(p) {
  margin: 0.25rem 0;
}

.rich-content-html :deep(ul),
.rich-content-html :deep(ol) {
  margin: 0.25rem 0;
  padding-left: 1.5rem;
}

.rich-content-html :deep(ul) {
  list-style: disc;
}

.rich-content-html :deep(ol) {
  list-style: decimal;
}

.rich-content-html :deep(blockquote) {
  border-left: 3px solid var(--c-accent);
  padding-left: 0.75rem;
  margin: 0.5rem 0;
  color: var(--c-secondary);
}

.rich-content-html :deep(h2),
.rich-content-html :deep(h3),
.rich-content-html :deep(h4) {
  font-weight: 600;
  margin: 0.5rem 0 0.25rem;
}
</style>
