<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import type { Extension } from '@codemirror/state';
import { EditorState, Compartment, Prec } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting } from '@codemirror/language';
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';
import { normalizarLinguagem } from '@/shared/utils/codeAnswer';

const props = withDefaults(defineProps<{
  modelValue: string;
  linguagem?: string;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
  readonly?: boolean;
  ariaLabel?: string;
  stretch?: boolean;
}>(), {
  linguagem: 'texto',
  placeholder: '',
  minHeight: '220px',
  maxHeight: '55vh',
  readonly: false,
  ariaLabel: 'Editor de código',
  stretch: false,
});

const emit = defineEmits<(e: 'update:modelValue', value: string) => void>();

const host = ref<HTMLDivElement | null>(null);
const caracteres = ref(0);

const languageCompartment = new Compartment();
const themeCompartment = new Compartment();

let view: EditorView | null = null;
let observer: MutationObserver | null = null;
let aplicandoExterno = false;
let temaEscuroAplicado: boolean | null = null;
let requisicaoIdioma = 0;

function detectarTemaEscuro(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

function criarTema(minHeight: string, maxHeight: string): Extension {
  return EditorView.theme({
    '&': {
      backgroundColor: 'var(--c-surface)',
      color: 'var(--c-primary)',
      fontSize: '13px',
      minHeight,
      maxHeight,
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      lineHeight: '1.6',
      overflow: 'auto',
    },
    '.cm-content': { caretColor: 'var(--c-accent)', padding: '8px 0' },
    '.cm-gutters': {
      backgroundColor: 'var(--c-surface-alt)',
      color: 'var(--c-secondary)',
      border: 'none',
      borderRight: '1px solid var(--c-line)',
    },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 6px' },
    '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--c-accent) 9%, transparent)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--c-primary)' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--c-accent)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'color-mix(in srgb, var(--c-accent) 28%, transparent)',
    },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
      backgroundColor: 'color-mix(in srgb, var(--c-accent) 22%, transparent)',
      outline: '1px solid var(--c-accent)',
    },
    '.cm-tooltip': {
      backgroundColor: 'var(--c-surface-alt)',
      border: '1px solid var(--c-line)',
      color: 'var(--c-primary)',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: 'var(--c-accent)',
      color: '#ffffff',
    },
    '.cm-panels': {
      backgroundColor: 'var(--c-surface-alt)',
      color: 'var(--c-primary)',
      borderColor: 'var(--c-line)',
    },
    '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, var(--c-accent) 20%, transparent)' },
  }, { dark: detectarTemaEscuro() });
}

async function carregarSuporte(linguagem: string): Promise<Extension> {
  switch (normalizarLinguagem(linguagem)) {
    case 'javascript': {
      const { javascript } = await import('@codemirror/lang-javascript');
      return javascript();
    }
    case 'typescript': {
      const { javascript } = await import('@codemirror/lang-javascript');
      return javascript({ typescript: true });
    }
    case 'python': {
      const { python } = await import('@codemirror/lang-python');
      return python();
    }
    case 'sql': {
      const { sql } = await import('@codemirror/lang-sql');
      return sql();
    }
    case 'html': {
      const { html } = await import('@codemirror/lang-html');
      return html();
    }
    case 'css': {
      const { css } = await import('@codemirror/lang-css');
      return css();
    }
    case 'json': {
      const { json } = await import('@codemirror/lang-json');
      return json();
    }
    default:
      return [];
  }
}

async function aplicarLinguagem(linguagem: string) {
  const requisicao = ++requisicaoIdioma;
  const suporte = await carregarSuporte(linguagem);
  if (!view || requisicao !== requisicaoIdioma) return;
  view.dispatch({ effects: languageCompartment.reconfigure(suporte) });
}

function aplicarTema() {
  if (!view) return;
  const escuro = detectarTemaEscuro();
  if (temaEscuroAplicado === escuro) return;
  temaEscuroAplicado = escuro;
  view.dispatch({
    effects: themeCompartment.reconfigure(escuro ? syntaxHighlighting(oneDarkHighlightStyle) : []),
  });
}

function observarTema() {
  if (typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver(() => aplicarTema());
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}

onMounted(() => {
  if (!host.value) return;

  view = new EditorView({
    state: EditorState.create({
      doc: props.modelValue ?? '',
      extensions: [
        basicSetup,
        Prec.high(keymap.of(props.readonly ? [] : [indentWithTab])),
        EditorView.lineWrapping,
        EditorView.editable.of(!props.readonly),
        cmPlaceholder(props.placeholder ?? ''),
        criarTema(props.minHeight, props.maxHeight),
        themeCompartment.of([]),
        languageCompartment.of([]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            caracteres.value = update.state.doc.length;
            if (!aplicandoExterno) emit('update:modelValue', update.state.doc.toString());
          }
        }),
      ],
    }),
    parent: host.value,
  });

  caracteres.value = view.state.doc.length;
  aplicarTema();
  aplicarLinguagem(props.linguagem);
  observarTema();
  requestAnimationFrame(() => view?.requestMeasure());
});

onUnmounted(() => {
  observer?.disconnect();
  observer = null;
  view?.destroy();
  view = null;
});

watch(
  () => props.modelValue,
  (valor) => {
    if (!view) return;
    const atual = view.state.doc.toString();
    const novo = valor ?? '';
    if (atual === novo) return;
    aplicandoExterno = true;
    view.dispatch({ changes: { from: 0, to: atual.length, insert: novo } });
    aplicandoExterno = false;
    caracteres.value = novo.length;
  }
);

watch(
  () => props.linguagem,
  (linguagem) => {
    aplicarLinguagem(linguagem);
  }
);

const idiomaExibido = computed(() => normalizarLinguagem(props.linguagem));
</script>

<template>
  <div
    class="w-full border border-line rounded-md overflow-hidden bg-surface-alt transition-shadow"
    :class="[readonly ? 'opacity-80' : 'focus-within:ring-2 focus-within:ring-accent', stretch ? 'flex-1 flex flex-col min-h-0' : '']"
  >
    <div v-if="$slots.toolbar" class="flex flex-wrap items-center gap-1 p-2 border-b border-line bg-surface select-none">
      <slot name="toolbar" />
    </div>

    <div
      ref="host"
      class="bg-surface"
      :class="stretch ? 'cm-stretch flex-1 min-h-0' : ''"
      :aria-label="props.ariaLabel"
      role="group"
    ></div>

    <div class="flex items-center justify-between gap-2 px-4 py-2 border-t border-line text-[11px] text-secondary bg-surface">
      <span>Tab indenta; Enter mantém a indentação; o texto é preservado exatamente como digitado.</span>
      <span class="shrink-0 tabular-nums">{{ caracteres }} caractere{{ caracteres === 1 ? '' : 's' }}<template v-if="idiomaExibido !== 'texto'"> · {{ idiomaExibido }}</template></span>
    </div>
  </div>
</template>

<style scoped>
.cm-stretch {
  display: flex;
  flex-direction: column;
}
.cm-stretch :deep(.cm-editor) {
  flex: 1;
}
</style>
