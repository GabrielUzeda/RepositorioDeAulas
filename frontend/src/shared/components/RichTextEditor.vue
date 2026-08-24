<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';

interface Props {
  modelValue?: string;
  label?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  id?: string;
  required?: boolean;
  minHeight?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  minHeight: '180px',
  disabled: false,
});

const emit = defineEmits(['update:modelValue']);

const editor = ref<HTMLElement | null>(null);
const isFullscreen = ref(false);
const editorId = props.id || `rte-${Math.random().toString(36).substr(2, 9)}`;

const charCount = computed(() => {
  return editor.value ? editor.value.innerText.length : 0;
});

const exec = (command: string, value: string | null = null) => {
  document.execCommand(command, false, value || undefined);
  editor.value?.focus();
  updateValue();
};

// Função para sanitizar HTML prevenindo XSS via allowlist estrita de tags e atributos permitidos
const ALLOWED_TAGS = new Set([
  'HTML', 'HEAD', 'BODY',
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'H2', 'H3', 'H4',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'SPAN'
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  PRE: new Set(['class']),
  CODE: new Set(['class']),
  SPAN: new Set(['class'])
};

const sanitizeHTML = (html: string): string => {
  if (!html) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 1. Remover completamente tags perigosas ou atípicas (scripts, iframes, svgs, math, templates, etc.)
  const dangerousTags = doc.querySelectorAll('script, iframe, object, embed, form, input, button, select, textarea, svg, math, template, noscript, style, link, meta, base, applet, audio, video');
  dangerousTags.forEach(el => el.remove());

  // 2. Processar recursivamente todos os elementos aplicando allowlist estrita
  const sanitizeNode = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toUpperCase();

      if (!ALLOWED_TAGS.has(tagName)) {
        // Tag não permitida: desempacota o conteúdo (ou remove se for elemento vazio)
        const parent = el.parentNode;
        while (el.firstChild) {
          parent?.insertBefore(el.firstChild, el);
        }
        parent?.removeChild(el);
        return;
      }

      // Filtrar atributos
      const allowedAttrsForTag = ALLOWED_ATTRS[tagName] || new Set();
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const attrName = attr.name.toLowerCase();
        const attrValue = attr.value.trim().toLowerCase();

        // Bloquear inline event handlers e protocolos inseguros
        if (
          attrName.startsWith('on') ||
          attrValue.startsWith('javascript:') ||
          attrValue.startsWith('data:') ||
          attrValue.startsWith('vbscript:') ||
          !allowedAttrsForTag.has(attrName)
        ) {
          el.removeAttribute(attr.name);
        }
      }
    }

    // Processar nós filhos
    const children = Array.from(node.childNodes);
    for (const child of children) {
      sanitizeNode(child);
    }
  };

  sanitizeNode(doc.body);
  return doc.body.innerHTML;
};

const insertCodeBlock = () => {
  const selection = window.getSelection();
  const selectedText = selection ? selection.toString() : '';
  const codeHTML = `<pre class="bg-surface p-3 rounded-lg border border-line font-mono text-xs overflow-x-auto text-primary my-2"><code>${selectedText || '// Insira seu código aqui...'}</code></pre><p><br></p>`;
  exec('insertHTML', codeHTML);
};

const updateValue = () => {
  if (editor.value) {
    const rawHTML = editor.value.innerHTML;
    const cleanHTML = sanitizeHTML(rawHTML);
    emit('update:modelValue', cleanHTML);
  }
};

onMounted(() => {
  if (editor.value) {
    editor.value.innerHTML = sanitizeHTML(props.modelValue || '');
  }
});

watch(() => props.modelValue, (newVal) => {
  if (editor.value && editor.value.innerHTML !== newVal) {
    editor.value.innerHTML = sanitizeHTML(newVal || '');
  }
});

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
};
</script>

<template>
  <div :class="['w-full', isFullscreen ? 'fixed inset-0 z-[9999] bg-surface p-4' : '']">
    <label v-if="label" :for="editorId" class="block text-sm font-medium text-secondary mb-1">
      {{ label }} <span v-if="required" class="text-danger">*</span>
    </label>

    <div :class="['border rounded-md overflow-hidden bg-surface-alt transition-all', error ? 'border-danger' : 'border-line focus-within:ring-2 ring-accent']">
      <!-- Toolbar -->
      <div class="flex flex-wrap gap-1 p-2 border-b border-line bg-surface">
        <button type="button" @click="exec('bold')" class="p-1.5 hover:bg-surface-alt rounded text-primary" title="Negrito"><i class="material-icons text-sm">format_bold</i></button>
        <button type="button" @click="exec('italic')" class="p-1.5 hover:bg-surface-alt rounded text-primary" title="Itálico"><i class="material-icons text-sm">format_italic</i></button>
        <button type="button" @click="exec('formatBlock', 'h2')" class="p-1.5 hover:bg-surface-alt rounded text-primary font-bold text-xs" title="Título">H2</button>
        <button type="button" @click="exec('insertUnorderedList')" class="p-1.5 hover:bg-surface-alt rounded text-primary" title="Lista"><i class="material-icons text-sm">format_list_bulleted</i></button>
        <button type="button" @click="exec('insertOrderedList')" class="p-1.5 hover:bg-surface-alt rounded text-primary" title="Lista Num."><i class="material-icons text-sm">format_list_numbered</i></button>
        <button type="button" @click="exec('formatBlock', 'blockquote')" class="p-1.5 hover:bg-surface-alt rounded text-primary" title="Citação"><i class="material-icons text-sm">format_quote</i></button>
        <button type="button" @click="insertCodeBlock" class="p-1.5 hover:bg-surface-alt rounded text-primary" title="Bloco de Código"><i class="material-icons text-sm">code</i></button>
        <button type="button" @click="exec('removeFormat')" class="p-1.5 hover:bg-surface-alt rounded text-primary" title="Limpar"><i class="material-icons text-sm">format_clear</i></button>
        <div class="ml-auto">
          <button type="button" @click="toggleFullscreen" class="p-1.5 hover:bg-surface-alt rounded text-primary" :title="isFullscreen ? 'Sair' : 'Expandir'">
            <i class="material-icons text-sm">{{ isFullscreen ? 'fullscreen_exit' : 'fullscreen' }}</i>
          </button>
        </div>
      </div>

      <!-- Editor -->
      <div
        ref="editor"
        :id="editorId"
        contenteditable="true"
        @input="updateValue"
        :style="{ minHeight: isFullscreen ? '90vh' : minHeight }"
        :class="['p-4 outline-none text-primary bg-transparent', disabled ? 'opacity-50 cursor-not-allowed' : '']"
        :placeholder="placeholder"
      ></div>
      
      <!-- Footer -->
      <div class="px-4 py-2 border-t border-line text-xs text-secondary bg-surface flex justify-end">
        {{ charCount }} caracteres
      </div>
    </div>

    <p v-if="error" class="text-xs text-danger mt-1">{{ error }}</p>
    <p v-if="hint && !error" class="text-xs text-secondary mt-1">{{ hint }}</p>
  </div>
</template>
