<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';

const props = defineProps<{
  show: boolean;
  titulo?: string;
  descricao?: string;
  markdown?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', payload: { titulo: string; descricao: string; markdown: string }): void;
}>();

const titleInput = ref('');
const descInput = ref('');
const markdownInput = ref('');
const iframeRef = ref<HTMLIFrameElement | null>(null);

let marpInstance: any = null;
let renderDebounce: any = null;

async function getMarp() {
  if (!marpInstance) {
    try {
      // @ts-ignore
      const mod = await import(/* @vite-ignore */ 'https://esm.sh/@marp-team/marp-core@3');
      const MarpConstructor = mod.Marp || mod.default?.Marp || mod.default;
      marpInstance = new MarpConstructor({ html: true, script: false });
    } catch (e) {
      console.error('Erro ao carregar Marp Core:', e);
    }
  }
  return marpInstance;
}

async function renderMarpPreview() {
  if (!iframeRef.value) return;
  const marp = await getMarp();
  if (!iframeRef.value) return;
  const md = markdownInput.value || '';
  
  let html = '';
  let css = '';
  if (marp && typeof marp.render === 'function') {
    const res = marp.render(md, { script: false });
    html = res.html;
    css = res.css;
  } else {
    html = `<div class="marpit"><section><h1>${escapeHtml(props.titulo || 'Aula')}</h1><p>Preview indisponível</p></section></div>`;
  }

  const iframe = iframeRef.value;
  let doc: Document | null = null;
  try {
    doc = iframe.contentDocument || iframe.contentWindow?.document || null;
  } catch (e) {
    console.warn('Não foi possível acessar a propriedade document do iframe:', e);
  }
  if (!doc) return;

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    ${css}
    body {
      margin: 0;
      padding: 20px;
      background: #090d16;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .marpit {
      width: 100%;
      max-width: 1280px;
    }
    section {
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      margin-bottom: 24px;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div class="marpit">${html}</div>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@latest/dist/mermaid.min.js"><\/script>
  <script type="module">
    import "https://esm.sh/@marp-team/marp-core@3/browser";

    async function renderMermaidDiagrams() {
      let mermaidObj = window.mermaid;
      if (!mermaidObj) {
        try {
          const mod = await import("https://cdn.jsdelivr.net/npm/mermaid@latest/+esm");
          mermaidObj = mod.default || mod;
        } catch (e) {
          console.error("Não foi possível carregar o Mermaid:", e);
          return;
        }
      }

      try {
        mermaidObj.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose'
        });

        const blocks = document.querySelectorAll('pre code.language-mermaid, pre.language-mermaid, code.language-mermaid, div.mermaid');
        const nodes = [];

        blocks.forEach((el) => {
          const parentPre = el.closest('pre') || el;
          if (parentPre.dataset.mermaidProcessed) return;
          parentPre.dataset.mermaidProcessed = 'true';

          const div = document.createElement('div');
          div.className = 'mermaid';
          div.style.display = 'flex';
          div.style.justifyContent = 'center';
          div.style.alignItems = 'center';
          div.style.margin = '1rem 0';
          div.textContent = el.textContent || '';

          parentPre.parentNode.replaceChild(div, parentPre);
          nodes.push(div);
        });

        if (nodes.length > 0) {
          await mermaidObj.run({ nodes });
        }
      } catch (err) {
        console.error("Erro ao renderizar gráficos Mermaid:", err);
      }
    }

    renderMermaidDiagrams();
  <\/script>
</body>
</html>`;

  try {
    doc.open();
    doc.write(fullHtml);
    doc.close();
  } catch (e) {
    console.error('Erro ao escrever no document do iframe:', e);
  }
}

function escapeHtml(str: string) {
  return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m] || m));
}

function triggerPreviewUpdate() {
  clearTimeout(renderDebounce);
  renderDebounce = setTimeout(renderMarpPreview, 250);
}

watch(markdownInput, () => {
  triggerPreviewUpdate();
});

watch(
  () => props.show,
  (val) => {
    if (val) {
      titleInput.value = props.titulo || '';
      descInput.value = props.descricao || '';
      markdownInput.value = props.markdown || '---\nmarp: true\ntheme: default\npaginate: true\n---\n\n# Título da Aula\n\n---\n\n## Conteúdo do Slide 1\n\n```mermaid\ngraph TD\n  A[Início] --> B[Processamento]\n  B --> C[Conclusão]\n```';
      nextTick(() => {
        renderMarpPreview();
      });
    }
  }
);

onBeforeUnmount(() => {
  clearTimeout(renderDebounce);
});

function handleSave() {
  emit('save', {
    titulo: titleInput.value,
    descricao: descInput.value,
    markdown: markdownInput.value
  });
}
</script>

<template>
  <div v-if="props.show" class="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex flex-col z-50">
    <!-- Header Bar -->
    <div class="bg-slate-900 px-6 py-4 border-b border-slate-800 flex justify-between items-center text-white">
      <div class="flex items-center space-x-3 flex-1">
        <span class="material-icons text-indigo-400 text-2xl">slideshow</span>
        <input
          v-model="titleInput"
          placeholder="Título da Aula"
          class="h-10 px-4 bg-slate-800 border border-slate-700 text-white text-sm font-semibold rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 w-64 leading-normal placeholder:text-slate-500"
        />
        <input
          v-model="descInput"
          placeholder="Descrição rápida"
          class="h-10 px-4 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 flex-1 max-w-md leading-normal placeholder:text-slate-500"
        />
      </div>
      <div class="flex items-center space-x-3">
        <button @click="emit('close')" type="button" class="px-4 py-2 text-slate-400 hover:text-white rounded-lg text-sm font-medium">Cancelar</button>
        <button @click="handleSave" type="button" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-lg">Salvar Aula</button>
      </div>
    </div>

    <!-- Split View Editor -->
    <div class="flex-1 grid grid-cols-1 lg:grid-cols-2 bg-slate-950 overflow-hidden">
      <!-- Markdown Input -->
      <div class="p-4 border-r border-slate-800 flex flex-col">
        <label class="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">Editor Markdown / Marp</label>
        <textarea
          v-model="markdownInput"
          class="flex-1 w-full bg-slate-900 text-slate-100 p-4 font-mono text-sm rounded-xl border border-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 resize-none placeholder:text-slate-500"
          placeholder="Digite seu código Marp Markdown aqui..."
        ></textarea>
      </div>

      <!-- Live Preview -->
      <div class="p-4 flex flex-col bg-slate-900">
        <label class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Preview em Tempo Real (Marp)</label>
        <div class="flex-1 bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
          <iframe ref="iframeRef" sandbox="allow-scripts allow-same-origin" class="w-full h-full border-none"></iframe>
        </div>
      </div>
    </div>
  </div>
</template>
