<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount, onMounted } from 'vue';
import { useToast } from '@/shared/composables/useToast';
import { apiClient } from '@/shared/api/client';
import BaseButton from '@/shared/components/BaseButton.vue';
import { THEME_LABELS, NEXT_THEME, normalizeTheme, type ThemeKey, THEME_KEYS } from '@/shared/marpTheme';
// CSS canônico de tema (marpTheme.css). Injetado no <head> de forma NÃO-scoped
// (onMounted) porque o preview renderiza o DOM do slide dinamicamente e <style scoped>
// não alcança conteúdo injetado. Os seletores [data-theme=...] só ativam dentro do
// wrapper do modal, que carrega o atributo data-theme.
import marpThemeCss from '@/shared/marpTheme.css?inline';

const props = withDefaults(
  defineProps<{
    show: boolean;
    titulo?: string;
    descricao?: string;
    markdown?: string;
    loading?: boolean;
  }>(),
  {
    loading: false,
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', payload: { titulo: string; descricao: string; markdown: string }): void;
}>();

const titleInput = ref('');
const descInput = ref('');
const markdownInput = ref('');
const slideCountText = ref('0 slides');
const charCountText = ref('0 caracteres');

// References
const previewPaneRef = ref<HTMLDivElement | null>(null);
const editorPaneRef = ref<HTMLDivElement | null>(null);
const editorRef = ref<HTMLTextAreaElement | null>(null);
const findInputRef = ref<HTMLInputElement | null>(null);
const editorHighlightsRef = ref<HTMLDivElement | null>(null);
const editorBackdropRef = ref<HTMLDivElement | null>(null);
const progressBarRef = ref<HTMLDivElement | null>(null);
const statusBarRef = ref<HTMLDivElement | null>(null);

// UI Toggle States
const isPresentMode = ref(false);
const isAnimMode = ref(true);
const currentTheme = ref<ThemeKey>('default');
const showExportMenu = ref(false);
const showFindBar = ref(false);
const showReplaceRow = ref(false);
const isMatchCase = ref(false);
const isMatchRegex = ref(false);
const findCountText = ref('0/0');
const findQuery = ref('');
const replaceQuery = ref('');
const fontScale = ref(1.0);
const isIdle = ref(false);
let idleTimer: any = null;

// Internal Engine State
const currentSlide = ref(0);
const totalSlides = ref(0);
let currentSlideNum = 0;
let totalSlidesNum = 0;
let renderTimer: any = null;
let scrollTimer: any = null;
let mermaidCounter = 0;
let mermaidReady = false;
let findMatches: Array<{ start: number; end: number }> = [];
let currentMatchIndex = -1;
let isResizing = false;

const clockText = ref('00:00:00');
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  clockText.value = `${h}:${m}:${s}`;
}
let clockTimer: any = null;

function adjustFont(factor: number) {
  fontScale.value *= factor;
  fontScale.value = Math.max(0.6, Math.min(2.5, fontScale.value));
  document.documentElement.style.setProperty('--font-scale', String(fontScale.value));
}

function resetFont() {
  fontScale.value = 1.0;
  document.documentElement.style.setProperty('--font-scale', '1.0');
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
      const screenAny = screen as any;
      if (screenAny.orientation && typeof screenAny.orientation.lock === 'function') {
        screenAny.orientation.lock('landscape').catch(() => {});
      }
    } else {
      await document.exitFullscreen?.();
      const screenAny = screen as any;
      if (screenAny.orientation && typeof screenAny.orientation.unlock === 'function') {
        screenAny.orientation.unlock();
      }
    }
  } catch (e) {}
}

function handleMouseMove() {
  isIdle.value = false;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    isIdle.value = true;
  }, 2500);
}

// Delegação de eventos no modo apresentar
function isInteractiveElement(target: HTMLElement | null): boolean {
  if (!target || target === document.body || target === document.documentElement) return false;
  const interactive = target.closest(
    'button, a, input, textarea, select, option, details, summary, label, form, ' +
    '[contenteditable="true"], [tabindex], [role="button"], [role="link"], [role="checkbox"], ' +
    '[role="slider"], [role="textbox"], [role="switch"], [data-interactive], .interactive, ' +
    '[draggable="true"], [draggable], [onclick], [onmousedown], [onmouseup], [ontouchstart], [ontouchend], ' +
    'canvas, audio, video, iframe, embed, object, svg, pre, code, kbd, samp, ' +
    '#controls-bar, #controls-bar *, #rotate-prompt, #rotate-prompt *'
  );
  if (interactive) return true;

  try {
    const style = window.getComputedStyle(target);
    if (style.cursor === 'pointer' || style.cursor === 'grab' || style.cursor === 'grabbing' || style.cursor === 'text') {
      if (!target.classList.contains('slide') && !target.classList.contains('slide-content') && target.id !== 'slides-container' && target.id !== 'preview-pane') {
        return true;
      }
    }
  } catch (e) {}

  return false;
}

let isPointerActive = false;
let startX = 0;
let startY = 0;
let startTime = 0;
let lastNavTime = 0;
const NAV_COOLDOWN_MS = 200;

function safeNavigate(delta: number) {
  const now = Date.now();
  if (now - lastNavTime < NAV_COOLDOWN_MS) return;
  lastNavTime = now;
  activateSlide(currentSlide.value + delta);
}

function handlePointerStart(e: PointerEvent | TouchEvent) {
  if (!isPresentMode.value) return;
  const target = e.target as HTMLElement;
  if (isInteractiveElement(target)) return;
  isPointerActive = true;
  startX = (e as PointerEvent).clientX !== undefined ? (e as PointerEvent).clientX : ((e as TouchEvent).touches?.[0]?.clientX || 0);
  startY = (e as PointerEvent).clientY !== undefined ? (e as PointerEvent).clientY : ((e as TouchEvent).touches?.[0]?.clientY || 0);
  startTime = Date.now();
}

function handlePointerEnd(e: PointerEvent | TouchEvent) {
  if (!isPresentMode.value || !isPointerActive) return;
  isPointerActive = false;
  const endX = (e as PointerEvent).clientX !== undefined ? (e as PointerEvent).clientX : ((e as TouchEvent).changedTouches?.[0]?.clientX || startX);
  const endY = (e as PointerEvent).clientY !== undefined ? (e as PointerEvent).clientY : ((e as TouchEvent).changedTouches?.[0]?.clientY || startY);
  const diffX = endX - startX;
  const diffY = endY - startY;
  const dt = Date.now() - startTime;

  // Gesto de Arrastar/Swipe Horizontal (>40px horizontal e dominante sobre o vertical)
  if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.2 && dt < 800) {
    if (diffX < 0) {
      safeNavigate(1);  // Swipe para a esquerda -> próximo slide
    } else {
      safeNavigate(-1); // Swipe para a direita -> slide anterior
    }
    return;
  }

  // Clique simples em áreas livres (movimento < 10px e sem seleção de texto)
  if (Math.abs(diffX) < 10 && Math.abs(diffY) < 10 && dt < 400) {
    const sel = window.getSelection ? window.getSelection()?.toString() : '';
    if (sel && sel.length > 0) return;

    const vw = window.innerWidth;
    if (startX < vw * 0.25) {
      safeNavigate(-1); // Clique na lateral esquerda -> slide anterior
    } else if (startX > vw * 0.75) {
      safeNavigate(1);  // Clique na lateral direita -> próximo slide
    }
  }
}

function handlePointerCancel() {
  isPointerActive = false;
}

// Default Markdown Template
const DEFAULT_MD = `---
theme: default
title: Marp Next
animation: fade-up
animation-stagger: 0.12s
---

<!--
animation: zoom-in
animation-duration: 0.8s
class: centered
-->

# Marp Next ⚡

Apresentações em Markdown com animações nativas

---

<!--
animation: fade-up
animation-stagger: 0.15s
-->

## Recursos

- **HTML-first** — sem dependências pesadas
- **Animações CSS** — 13 presets + custom
- **Mermaid nativo** — diagramas inline
- **Live reload** — edite e veja na hora

---

<!--
animation: slide-up
-->

## Fluxo de Dados

\`\`\`mermaid
graph LR
    A[Markdown] --> B[Parser]
    B --> C[HTML Slides]
    C --> D[Animation Engine]
    C --> E[Mermaid Render]
    D --> F[Browser]
    E --> F
\`\`\`

---

<!--
animation: flip-y
class: centered
-->

## Animações Disponíveis

| Nome | Efeito |
|------|--------|
| fade-up | Sobe com fade |
| zoom-in | Zoom + fade |
| flip-x | Rotação 3D X |
| bounce-in | Elástico |
| blur-in | Desfoque → foco |

---

<!--
animation: bounce-in
class: centered
background: linear-gradient(135deg, #667eea, #764ba2)
-->

# Pronto para começar? 🚀

Edite este Markdown à esquerda
`;

// ─── HTML Escaping ───────────────────────────
function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m] || m));
}

// Markdown-it Instance
function getMarkdownIt() {
  const w = window as any;
  if (w.markdownit) {
    return w.markdownit({ html: true, linkify: true, typographer: true });
  }
  return null;
}

// Mermaid Initialization
function initMermaid(themeName: ThemeKey) {
  const w = window as any;
  if (w.mermaid) {
    const theme = normalizeTheme(themeName);
    w.mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      flowchart: { useMaxWidth: true, htmlLabels: true, padding: 20 },
      sequence: { useMaxWidth: true, wrap: true },
      themeVariables: {
        primaryColor: '#6366f1',
        primaryTextColor: theme === 'dark' ? '#f8fafc' : '#0f172a',
        lineColor: theme === 'dark' ? '#94a3b8' : '#475569',
        fontSize: '15px',
      }
    });
  }
}

async function waitForFonts() {
  try {
    await document.fonts.ready;
    await document.fonts.load('16px Inter');
    await document.fonts.load('600 16px Inter');
    await document.fonts.load('14px JetBrains Mono');
  } catch (e) { /* fallback */ }
  mermaidReady = true;
}

// ─── Parser Functions ─────────────────────────
function extractFrontMatter(source: string) {
  const m = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { body: source, global: {} as Record<string, string> };
  const global: Record<string, string> = {};
  m[1].split('\n').forEach(l => {
    const idx = l.indexOf(':');
    if (idx > 0) global[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
  });
  return { body: source.slice(m[0].length), global };
}

function parseDirectives(text: string) {
  const re = /<!--\s*\n([\s\S]*?)\n\s*-->/;
  const match = text.match(re);
  const directives: Record<string, string> = {};
  let content = text;

  if (match) {
    match[1].split('\n').forEach(l => {
      const idx = l.indexOf(':');
      if (idx > 0) directives[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
    });
    content = content.replace(match[0], '').trim();
  }
  return { directives, content };
}

function parseSlides(source: string) {
  const { body, global } = extractFrontMatter(source);
  const SEPARATOR = /^(?:---|\*\*\*|<!--\s*(?:break|slide)\s*-->)\s*$/m;
  const rawSlides = body.split(SEPARATOR);

  return {
    global,
    slides: rawSlides.map((raw, i) => {
      const { directives, content } = parseDirectives(raw.trim());
      return { index: i, directives: { ...global, ...directives }, content };
    })
  };
}

// ─── Renderer ────────────────────────────────
function renderSlides(source: string) {
  const { slides, global } = parseSlides(source);
  totalSlidesNum = slides.length;
  totalSlides.value = totalSlidesNum;
  slideCountText.value = `${totalSlidesNum} slides`;
  charCountText.value = `${source.length} caracteres`;

  // O dropdown de tema sempre reescreve `theme:` no frontmatter (applyTheme → setFrontmatterTheme),
  // então o caso sem theme no markdown é só markdown novo/importado → 'default' é o correto.
  // Não usar fallback para currentTheme (evita estado stale).
  const targetTheme = global.theme ? normalizeTheme(global.theme) : 'default';

  if (currentTheme.value !== targetTheme) {
    currentTheme.value = targetTheme;
  }
  initMermaid(targetTheme);

  const container = previewPaneRef.value;
  if (!container) return;
  container.innerHTML = '';

  const md = getMarkdownIt();

  slides.forEach((slide, i) => {
    const el = document.createElement('section');
    el.className = 'slide' + (slide.directives.class ? ' ' + slide.directives.class : '');
    el.dataset.slide = String(i);

    if (slide.directives.animation) el.dataset.animation = slide.directives.animation;
    if (slide.directives['animation-duration']) el.style.setProperty('--anim-duration', slide.directives['animation-duration']);
    if (slide.directives['animation-stagger']) {
      el.dataset.animStagger = 'true';
      el.style.setProperty('--anim-stagger', slide.directives['animation-stagger']);
    }
    if (slide.directives.background) el.style.background = slide.directives.background;

    let html = md ? md.render(slide.content) : `<p>${escapeHtml(slide.content)}</p>`;
    html = html.replace(/<table>[\s\S]*?<\/table>/g, (tableHtml: string) => `<div class="table-wrap">${tableHtml}</div>`);
    // Suporte a atalhos de ícones Font Awesome :fa-name:, :fas-name:, :fab-name:, :far-name:
    html = html.replace(/:fa([srb]?)-([a-z0-9-]+):/gi, (_m, type, name) => {
      const prefix = type.toLowerCase() === 'b' ? 'fa-brands' : type.toLowerCase() === 'r' ? 'fa-regular' : 'fa-solid';
      return `<i class="fa ${prefix} fa-${name}"></i>`;
    });
    html = html.replace(/:fa-([a-z0-9-]+):/gi, '<i class="fa fa-solid fa-$1"></i>');
    el.innerHTML = `
      <span class="slide-number">${i + 1}/${totalSlidesNum}</span>
      <div class="slide-content">${html}</div>
    `;
    renderKaTeX(el);
    container.appendChild(el);
    executeSlideScripts(el);
    renderAllCodeHighlight(el);
  });

  activateSlide(Math.min(currentSlideNum, totalSlidesNum - 1));
  requestAnimationFrame(() => renderAllMermaid());
}

function renderKaTeX(container: HTMLElement) {
  const w = window as any;
  if (!w.katex) return;

  const contentDiv = container.querySelector('.slide-content');
  if (!contentDiv || !contentDiv.innerHTML.includes('$')) return;

  const walker = document.createTreeWalker(contentDiv, NodeFilter.SHOW_TEXT, null, false);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeValue && node.nodeValue.includes('$')) {
      if (node.parentElement && node.parentElement.closest('pre, code, script, style')) continue;
      textNodes.push(node as Text);
    }
  }
  textNodes.forEach(textNode => {
    const text = textNode.nodeValue;
    if (!text) return;
    if (/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/.test(text)) {
      const span = document.createElement('span');
      span.innerHTML = text
        .replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
          try { return w.katex.renderToString(math.trim(), { displayMode: true, throwOnError: false }); }
          catch (e) { return '$$' + math + '$$'; }
        })
        .replace(/(^|[^\\])\$([^$\n]+?)\$/g, (_, prefix, math) => {
          try { return prefix + w.katex.renderToString(math.trim(), { displayMode: false, throwOnError: false }); }
          catch (e) { return prefix + '$' + math + '$'; }
        });
      textNode.parentNode?.replaceChild(span, textNode);
    }
  });
}

function executeSlideScripts(container: HTMLElement) {
  container.querySelectorAll('script').forEach(oldScript => {
    const newScript = document.createElement('script');
    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
    newScript.textContent = oldScript.textContent;
    try {
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    } catch (e) {
      console.warn('Erro ao executar script do slide:', e);
    }
  });
}

function renderAllCodeHighlight(container: HTMLElement) {
  const w = window as any;
  if (!w.hljs) return;
  container.querySelectorAll('.slide-content pre code').forEach((block: any) => {
    if (block.closest('.mermaid-block') || block.classList.contains('mermaid')) return;
    w.hljs.highlightElement(block);
  });
}

async function renderAllMermaid() {
  const w = window as any;
  if (!mermaidReady) await waitForFonts();
  if (!previewPaneRef.value) return;
  if (!w.mermaid) return;
  try {
    await document.fonts.ready;
    await document.fonts.load('16px Inter');
  } catch (e) {}

  previewPaneRef.value.querySelectorAll('.slide-content').forEach(container => {
    container.querySelectorAll('pre, .mermaid-block').forEach(el => {
      const src = (el as HTMLElement).dataset.rawMermaid || (el.querySelector('code') ? el.querySelector('code')!.textContent?.trim() : null);
      if (!src) return;

      const isMmd = (el as HTMLElement).dataset.isMermaid === '1' ||
        (el.querySelector('code') && el.querySelector('code')!.className.includes('mermaid')) ||
        /^(graph|flowchart|sequence|classDiagram|stateDiagram|erDiagram|pie|gantt|journey|mindmap|timeline)/m.test(src);
      if (!isMmd) return;

      const id = 'mmd-mn-' + (++mermaidCounter);
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-block';
      wrapper.dataset.rawMermaid = src;
      wrapper.dataset.isMermaid = '1';
      el.replaceWith(wrapper);

      w.mermaid.render(id, src).then(({ svg }: { svg: string }) => {
        wrapper.innerHTML = svg;
        const svgEl = wrapper.querySelector('svg');
        if (svgEl) {
          svgEl.removeAttribute('width');
          svgEl.removeAttribute('height');
          svgEl.style.width = '100%';
          svgEl.style.height = 'auto';
          const vb = svgEl.getAttribute('viewBox');
          if (vb) {
            const [x, y, w, h] = vb.split(' ').map(Number);
            svgEl.setAttribute('viewBox', (x - 12) + ' ' + (y - 12) + ' ' + (w + 24) + ' ' + (h + 24));
          }
          svgEl.style.overflow = 'visible';
          svgEl.querySelectorAll('g, foreignObject, text, rect, div').forEach((node: Element) => (node as HTMLElement).style.overflow = 'visible');
        }
      }).catch((err: any) => {
        wrapper.innerHTML = '<div style="color:#ef4444;font-size:12px;">⚠ Mermaid: ' + err.message + '</div>';
      });
    });
  });
}

function activateSlide(index: number) {
  if (totalSlides.value === 0) return;
  currentSlideNum = Math.max(0, Math.min(index, totalSlides.value - 1));
  currentSlide.value = currentSlideNum;
  if (!previewPaneRef.value) return;

  const slides = previewPaneRef.value.querySelectorAll('.slide');
  slides.forEach((s, i) => {
    s.classList.toggle('active', i === currentSlideNum);
  });

  const active = previewPaneRef.value.querySelector('.slide.active');
  if (active) active.scrollIntoView({ behavior: 'smooth', block: 'center' });
  updateProgress();
}

function nextSlide() { activateSlide(currentSlide.value + 1); }
function prevSlide() { activateSlide(currentSlide.value - 1); }

function updateProgress() {
  const pct = totalSlides.value > 0 ? ((currentSlide.value + 1) / totalSlides.value) * 100 : 0;
  if (progressBarRef.value) progressBarRef.value.style.width = pct + '%';
  if (statusBarRef.value) statusBarRef.value.textContent = `${currentSlide.value + 1} / ${totalSlides.value}`;
}

// ─── Slide Editor Sync ───────────────────────
function getSlideStartCharIndex(source: string, slideIndex: number) {
  let offset = 0;
  const fmMatch = source.match(/^---\n[\s\S]*?\n---\n?/);
  if (fmMatch) {
    offset = fmMatch[0].length;
  }
  if (slideIndex === 0) return offset;

  const body = source.slice(offset);
  const SEPARATOR_GLOBAL = /^(?:---|\*\*\*|<!--\s*(?:break|slide)\s*-->)\s*$/gm;
  let count = 0;
  let match;
  while ((match = SEPARATOR_GLOBAL.exec(body)) !== null) {
    count++;
    if (count === slideIndex) {
      return offset + match.index + match[0].length + 1;
    }
  }
  return offset;
}

function scrollToCharIndex(textarea: HTMLTextAreaElement, charIndex: number, focusTarget = true) {
  if (charIndex < 0) charIndex = 0;
  if (charIndex > textarea.value.length) charIndex = textarea.value.length;

  const prevActive = document.activeElement as HTMLElement | null;

  if (focusTarget) textarea.focus();
  textarea.setSelectionRange(charIndex, charIndex);

  // Usa o elemento DOM de destaque real para rolar o scroll na posição física exata da tela
  nextTick(() => {
    if (editorHighlightsRef.value) {
      const activeMark = editorHighlightsRef.value.querySelector('mark.find-match.active') as HTMLElement | null;
      if (activeMark) {
        const markTop = activeMark.offsetTop;
        const targetScrollTop = Math.max(0, markTop - (textarea.clientHeight / 2) + (activeMark.offsetHeight / 2));
        textarea.scrollTop = targetScrollTop;
      } else {
        const textBefore = textarea.value.substring(0, charIndex);
        const linesBefore = textBefore.split('\n').length - 1;
        const style = window.getComputedStyle(textarea);
        const fontSize = parseFloat(style.fontSize) || 13;
        const lineHeight = parseFloat(style.lineHeight) || (fontSize * 1.7);
        const paddingTop = parseFloat(style.paddingTop) || 20;
        textarea.scrollTop = Math.max(0, (linesBefore * lineHeight) + paddingTop - (textarea.clientHeight / 2));
      }
    }
    syncBackdropScroll();

    if (!focusTarget && prevActive && prevActive !== textarea && typeof prevActive.focus === 'function') {
      prevActive.focus();
    }
  });
}

function getSlideIndexForCharIndex(source: string, charIndex: number): number {
  const { body } = extractFrontMatter(source);
  const offset = source.length - body.length;
  if (charIndex < offset) return 0;

  const SEPARATOR_GLOBAL = /^(?:---|\*\*\*|<!--\s*(?:break|slide)\s*-->)\s*$/gm;
  let slideIdx = 0;
  let match;
  while ((match = SEPARATOR_GLOBAL.exec(body)) !== null) {
    if (offset + match.index > charIndex) break;
    slideIdx++;
  }
  return slideIdx;
}

function highlightCurrentMatch(focusTarget = false) {
  if (findMatches.length === 0 || currentMatchIndex < 0) {
    findCountText.value = '0/0';
    updateEditorHighlights();
    return;
  }

  findCountText.value = `${currentMatchIndex + 1}/${findMatches.length}`;
  const m = findMatches[currentMatchIndex];
  if (editorRef.value) {
    scrollToCharIndex(editorRef.value, m.start, focusTarget);
    editorRef.value.setSelectionRange(m.start, m.end);
  }

  // Sincroniza e rola para o slide correspondente no preview
  const targetSlideIdx = getSlideIndexForCharIndex(markdownInput.value, m.start);
  activateSlide(targetSlideIdx);

  updateEditorHighlights();
}

function handlePreviewClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (isInteractiveElement(target)) return;
  if (isPresentMode.value) return;

  const slideEl = target.closest('.slide') as HTMLElement | null;
  if (!slideEl || !editorRef.value) return;
  const index = parseInt(slideEl.dataset.slide || '0', 10);
  if (isNaN(index)) return;

  activateSlide(index);
  const charIdx = getSlideStartCharIndex(markdownInput.value, index);
  scrollToCharIndex(editorRef.value, charIdx);
}

function handlePreviewScroll() {
  if (!previewPaneRef.value) return;
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    if (!previewPaneRef.value) return;
    const slides = Array.from(previewPaneRef.value.querySelectorAll('.slide')) as HTMLElement[];
    const mid = previewPaneRef.value.scrollTop + previewPaneRef.value.clientHeight / 2;
    for (let i = 0; i < slides.length; i++) {
      const top = slides[i].offsetTop;
      const bottom = top + slides[i].offsetHeight;
      if (mid >= top && mid < bottom) {
        if (currentSlideNum !== i) {
          currentSlideNum = i;
          currentSlide.value = i;
          slides.forEach((s, j) => s.classList.toggle('active', j === i));
          updateProgress();
        }
        break;
      }
    }
  }, 80);
}

// ─── Theme Sync ──────────────────────────────
function setFrontmatterTheme(source: string, newTheme: string) {
  const fmMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fmMatch) {
    let fmContent = fmMatch[1];
    const themeLineRegex = /^[ \t]*theme[ \t]*:[ \t]*.*$/im;
    if (themeLineRegex.test(fmContent)) {
      fmContent = fmContent.replace(themeLineRegex, `theme: ${newTheme}`);
    } else {
      fmContent = `theme: ${newTheme}\n` + fmContent;
    }
    return `---\n${fmContent.trim()}\n---\n` + source.slice(fmMatch[0].length);
  } else {
    return `---\ntheme: ${newTheme}\n---\n\n` + source;
  }
}

function applyTheme(newTheme: ThemeKey, updateEditorText = true) {
  currentTheme.value = newTheme;
  initMermaid(newTheme);

  if (updateEditorText && markdownInput.value) {
    const updatedMd = setFrontmatterTheme(markdownInput.value, newTheme);
    if (updatedMd !== markdownInput.value) {
      markdownInput.value = updatedMd;
      renderSlides(markdownInput.value);
    }
  } else {
    renderAllMermaid();
  }
}

function toggleTheme() {
  const nextTheme = NEXT_THEME[currentTheme.value];
  applyTheme(nextTheme, true);
}

// ─── Marp Theme CSS (canônico, não-scoped) ───
// <style scoped> não alcança o DOM injetado do preview (renderSlides), então o CSS de tema
// é injetado no <head> de forma não-scoped. Os seletores [data-theme=...] do marpTheme.css
// só ativam dentro do wrapper do modal (que tem o atributo data-theme), então não vazam
// visualmente para o restante do app. Idempotente: se o <style> já existir, só atualiza.
function ensureMarpThemeCss() {
  let style = document.getElementById('marp-theme-css') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'marp-theme-css';
    style.setAttribute('data-marp-theme', '');
    document.head.appendChild(style);
  }
  style.textContent = marpThemeCss;
}

// ─── Find & Replace Logic ────────────────────
function openFindBar(showReplace = false) {
  showFindBar.value = true;
  showReplaceRow.value = showReplace;
  nextTick(() => {
    updateFindMatches();
    if (findInputRef.value) {
      findInputRef.value.focus();
      findInputRef.value.select();
    }
  });
}

function closeFindBar() {
  showFindBar.value = false;
  findMatches = [];
  currentMatchIndex = -1;
  findCountText.value = '0/0';
  updateEditorHighlights();
  if (editorRef.value) editorRef.value.focus();
}

function syncBackdropScroll() {
  if (editorBackdropRef.value && editorRef.value) {
    editorBackdropRef.value.scrollTop = editorRef.value.scrollTop;
    editorBackdropRef.value.scrollLeft = editorRef.value.scrollLeft;
  }
}

function updateEditorHighlights() {
  if (!editorHighlightsRef.value) return;
  const query = findQuery.value;
  if (!query || !showFindBar.value || findMatches.length === 0) {
    editorHighlightsRef.value.innerHTML = '';
    return;
  }

  const text = markdownInput.value;
  let html = '';
  let lastIndex = 0;

  findMatches.forEach((m, idx) => {
    const before = escapeHtml(text.substring(lastIndex, m.start));
    const matchText = escapeHtml(text.substring(m.start, m.end));
    const isActive = (idx === currentMatchIndex);
    const cls = isActive ? 'find-match active' : 'find-match';

    html += before + `<mark class="${cls}">${matchText}</mark>`;
    lastIndex = m.end;
  });

  html += escapeHtml(text.substring(lastIndex));
  if (text.endsWith('\n')) html += ' ';

  editorHighlightsRef.value.innerHTML = html;
  syncBackdropScroll();
}

function updateFindMatches() {
  const query = findQuery.value;
  findMatches = [];
  currentMatchIndex = -1;

  if (!query) {
    findCountText.value = '0/0';
    updateEditorHighlights();
    return;
  }

  const text = markdownInput.value;
  try {
    let regex: RegExp;
    const flags = isMatchCase.value ? 'g' : 'gi';
    if (isMatchRegex.value) {
      regex = new RegExp(query, flags);
    } else {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regex = new RegExp(escaped, flags);
    }

    let match;
    while ((match = regex.exec(text)) !== null) {
      findMatches.push({ start: match.index, end: match.index + match[0].length });
      if (match[0].length === 0) regex.lastIndex++;
    }
  } catch (e) {
    findCountText.value = 'Erro Regex';
    updateEditorHighlights();
    return;
  }

  if (findMatches.length > 0) {
    currentMatchIndex = 0;
    highlightCurrentMatch(false);
  } else {
    findCountText.value = 'Sem resultados';
    updateEditorHighlights();
  }
}



function findNext() {
  if (findMatches.length === 0) return;
  currentMatchIndex = (currentMatchIndex + 1) % findMatches.length;
  highlightCurrentMatch();
}

function findPrev() {
  if (findMatches.length === 0) return;
  currentMatchIndex = (currentMatchIndex - 1 + findMatches.length) % findMatches.length;
  highlightCurrentMatch();
}

function replaceCurrent() {
  if (findMatches.length === 0 || currentMatchIndex < 0) return;
  const m = findMatches[currentMatchIndex];
  const replacement = replaceQuery.value;
  const val = markdownInput.value;

  markdownInput.value = val.substring(0, m.start) + replacement + val.substring(m.end);
  renderSlides(markdownInput.value);
  updateFindMatches();
}

function replaceAll() {
  const query = findQuery.value;
  if (!query || findMatches.length === 0) return;

  const replacement = replaceQuery.value;
  const text = markdownInput.value;
  const flags = isMatchCase.value ? 'g' : 'gi';

  try {
    let regex: RegExp;
    if (isMatchRegex.value) {
      regex = new RegExp(query, flags);
    } else {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regex = new RegExp(escaped, flags);
    }
    markdownInput.value = text.replace(regex, replacement);
  } catch (e) {
    return;
  }

  renderSlides(markdownInput.value);
  updateFindMatches();
}

// ─── Tab Key Handler ─────────────────────────
function handleTabKey(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault();
    if (!editorRef.value) return;
    const start = editorRef.value.selectionStart;
    const end = editorRef.value.selectionEnd;
    const val = markdownInput.value;

    markdownInput.value = val.substring(0, start) + '  ' + val.substring(end);
    nextTick(() => {
      if (editorRef.value) {
        editorRef.value.selectionStart = editorRef.value.selectionEnd = start + 2;
      }
      renderSlides(markdownInput.value);
    });
  }
}

// ─── Export Logic ────────────────────────────

function downloadFile(content: string, fileName: string, contentType: string) {
  const a = document.createElement('a');
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 100);
}

async function exportHtml() {
  showExportMenu.value = false;
  const res = await apiClient.post('/marp/render', {
    titulo: titleInput.value || 'Aula Sem Título',
    markdown: markdownInput.value,
  });
  const html = res.data?.html;
  if (!res.success || res.status === 0 || !html) {
    useToast().error(res.error || 'backend indisponível');
    return;
  }
  downloadFile(html, 'apresentacao-marp-next.html', 'text/html;charset=utf-8;');
}

async function exportPdf() {
  showExportMenu.value = false;
  // Gera o HTML standalone em memória e imprime via iframe oculto — NUNCA a página do app.
  const res = await apiClient.post('/marp/render', {
    titulo: titleInput.value || 'Aula Sem Título',
    markdown: markdownInput.value,
  });
  const htmlContent = res.data?.html;
  if (!res.success || res.status === 0 || !htmlContent) {
    useToast().error(res.error || 'backend indisponível');
    return;
  }
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const removeIframe = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    window.removeEventListener('afterprint', removeIframe);
  };
  window.addEventListener('afterprint', removeIframe);
  setTimeout(removeIframe, 60000);

  try {
    const doc = iframe.contentDocument;
    if (!doc || !iframe.contentWindow) { removeIframe(); return; }
    doc.open();
    doc.write(htmlContent);
    doc.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } catch (e) {
    removeIframe();
    useToast().error('Não foi possível gerar o PDF.');
  }
}

// Cores do export PPTX por tema — espelham os tokens de marpTheme.css (default/dark/light).
// Decisão: fontFace permanece 'Arial' (universal em visualizadores de PPT; 'Roboto' cairia
// em fallback silencioso e mudaria o layout em máquinas sem a fonte instalada).
const THEME_PPT_COLORS: Record<ThemeKey, { bg: string; title: string; body: string; accent: string }> = {
  default: { bg: '#FFFFFF', title: '#1a3a6e', body: '#2b2b2b', accent: '#d62828' },
  dark: { bg: '#1E293B', title: '#F8FAFC', body: '#CBD5E1', accent: '#818CF8' },
  light: { bg: '#FFFFFF', title: '#0F172A', body: '#334155', accent: '#4338CA' },
};

async function exportPptx() {
  showExportMenu.value = false;
  const w = window as any;
  if (!w.PptxGenJS) {
    try {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
      document.head.appendChild(script);
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      });
    } catch (e) {
      useToast().error('Não foi possível carregar a biblioteca PptxGenJS.');
      return;
    }
  }

  const pptx = new w.PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';

  if (!previewPaneRef.value) return;
  const slideNodes = previewPaneRef.value.querySelectorAll('.slide');
  const themeColors = THEME_PPT_COLORS[normalizeTheme(currentTheme.value)];
  const titleColor = themeColors.title;
  const bodyColor = themeColors.body;

  const slideBgColor = (sEl: Element) => {
    const style = sEl.getAttribute('style') || '';
    const m = style.match(/#[0-9a-fA-F]{3,8}/);
    return m ? m[0].replace('#', '').slice(0, 6).toUpperCase() : themeColors.bg;
  };

  slideNodes.forEach((sEl) => {
    const pptxSlide = pptx.addSlide();
    pptxSlide.background = { color: slideBgColor(sEl) };

    const contentBox = sEl.querySelector('.slide-content');
    const titleEl = sEl.querySelector('h1, h2, h3') as HTMLElement | null;
    if (titleEl) {
      pptxSlide.addText(titleEl.innerText, {
        x: 0.8, y: 0.7, w: '85%', h: 1.3,
        fontSize: 26, bold: true, color: titleColor,
        fontFace: 'Arial'
      });
    }

    const bodyParts: string[] = [];
    if (contentBox) {
      contentBox.childNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const tag = (node as HTMLElement).tagName;
        if (/^H[123]$/.test(tag)) return;
        const t = ((node as HTMLElement).innerText || '').trim();
        if (t) bodyParts.push(t);
      });
    }

    if (bodyParts.length > 0) {
      pptxSlide.addText(bodyParts.join('\n\n'), {
        x: 0.8, y: 2.2, w: '85%', h: 3.3,
        fontSize: 16, color: bodyColor,
        fontFace: 'Arial', valign: 'top', fit: 'shrink'
      });
    }
  });

  pptx.writeFile({ fileName: 'apresentacao-marp-next.pptx' });
}

// ─── Resizer (drag to resize editor pane) ────
function onResizerMouseDown() {
  isResizing = true;
  if (editorPaneRef.value) editorPaneRef.value.classList.add('dragging');
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';

  const onMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const pct = (e.clientX / window.innerWidth) * 100;
    if (pct > 20 && pct < 75) {
      if (editorPaneRef.value) editorPaneRef.value.style.width = pct + '%';
    }
  };

  const onUp = () => {
    isResizing = false;
    if (editorPaneRef.value) editorPaneRef.value.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

const isSaving = ref(false);

// ─── Save & Props Sync ─────────────────────
function handleSave() {
  if (isSaving.value || props.loading) return;
  isSaving.value = true;
  emit('save', {
    titulo: titleInput.value.trim(),
    descricao: descInput.value.trim(),
    markdown: markdownInput.value,
  });
}

watch(
  () => props.show,
  (show) => {
    isSaving.value = false;
    if (!show) return;
    titleInput.value = props.titulo ?? '';
    descInput.value = props.descricao ?? '';
    const draft = window.localStorage?.getItem('marp-next-content') ?? '';
    markdownInput.value = props.markdown ?? (draft.trim() ? draft : DEFAULT_MD);
    currentSlideNum = 0;
    currentSlide.value = 0;
    nextTick(() => {
      renderSlides(markdownInput.value);
      if (editorRef.value) editorRef.value.focus();
    });
  },
  { immediate: true }
);

watch(markdownInput, (newVal) => {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    renderSlides(newVal);
  }, 100);
});

// ─── Auto-save (4.7) ───────────────────────
let autoSaveTimer: any = null;

function setupAutoSave() {
  if (autoSaveTimer) return;
  autoSaveTimer = setInterval(() => {
    try {
      window.localStorage?.setItem('marp-next-content', markdownInput.value);
    } catch (e) { /* quota/private mode */ }
  }, 2000);
}

function cleanupAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
}

function togglePresentMode() {
  isPresentMode.value = !isPresentMode.value;
  if (isPresentMode.value) {
    try { document.documentElement.requestFullscreen?.(); } catch(e){}
  } else {
    try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch(e){}
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (!props.show) return;

  const isCtrlOrCmd = e.ctrlKey || e.metaKey;
  if (isCtrlOrCmd && (e.key === 'f' || e.key === 'F')) {
    e.preventDefault();
    openFindBar(false);
    return;
  }
  if (isCtrlOrCmd && (e.key === 'h' || e.key === 'H')) {
    e.preventDefault();
    openFindBar(true);
    return;
  }

  const target = e.target as HTMLElement | null;
  const isInputTarget = target && (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    (target as any).isContentEditable ||
    !!target.closest?.('#find-bar, [contenteditable="true"], input, textarea, select')
  );

  if ((e.key === 'f' || e.key === 'F') && !isCtrlOrCmd) {
    if (!isInputTarget) {
      e.preventDefault();
      togglePresentMode();
      return;
    }
  }

  if (e.key === 'Escape') {
    if (isPresentMode.value) {
      isPresentMode.value = false;
      try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch(e){}
      return;
    }
  }

  if (!isInputTarget) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      nextSlide();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      prevSlide();
    } else if (e.key === 'Home') {
      e.preventDefault();
      activateSlide(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      activateSlide(totalSlidesNum - 1);
    }
  }
}

function handleWindowClick() {
  showExportMenu.value = false;
}

onMounted(() => {
  ensureMarpThemeCss();
  setupAutoSave();
  updateClock();
  clockTimer = setInterval(updateClock, 1000);
  window.addEventListener('keydown', handleGlobalKeydown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('click', handleWindowClick);
  if (window.PointerEvent) {
    window.addEventListener('pointerdown', handlePointerStart, { passive: true });
    window.addEventListener('pointerup', handlePointerEnd, { passive: true });
    window.addEventListener('pointercancel', handlePointerCancel, { passive: true });
  } else {
    window.addEventListener('touchstart', handlePointerStart, { passive: true });
    window.addEventListener('touchend', handlePointerEnd, { passive: true });
    window.addEventListener('touchcancel', handlePointerCancel, { passive: true });
  }
  window.addEventListener('dragstart', handlePointerCancel, { passive: true });
  const w = window as any;
  w.marpNext = {
    render: renderSlides,
    next: nextSlide,
    prev: prevSlide,
    goTo: activateSlide,
    exportHtml,
    exportPdf,
    exportPptx,
    get current() { return currentSlideNum; },
    get total() { return totalSlidesNum; },
  };
});

onBeforeUnmount(() => {
  cleanupAutoSave();
  if (clockTimer) clearInterval(clockTimer);
  const themeStyle = document.getElementById('marp-theme-css');
  if (themeStyle) themeStyle.remove();
  window.removeEventListener('keydown', handleGlobalKeydown);
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('click', handleWindowClick);
  if (window.PointerEvent) {
    window.removeEventListener('pointerdown', handlePointerStart);
    window.removeEventListener('pointerup', handlePointerEnd);
    window.removeEventListener('pointercancel', handlePointerCancel);
  } else {
    window.removeEventListener('touchstart', handlePointerStart);
    window.removeEventListener('touchend', handlePointerEnd);
    window.removeEventListener('touchcancel', handlePointerCancel);
  }
  window.removeEventListener('dragstart', handlePointerCancel);
  if (idleTimer) clearTimeout(idleTimer);
  const w = window as any;
  if (w.marpNext) delete w.marpNext;
});

</script>

<template>
  <div v-if="props.show" class="marpnext-modal-root fixed inset-0 bg-canvas flex flex-col z-50 overflow-hidden" :class="{ 'present-mode': isPresentMode, 'anim-mode': isAnimMode }" :data-theme="currentTheme">
    <!-- TOPBAR -->
    <div id="topbar">
      <div class="logo">marp-next <span>/ editor</span></div>
      <div class="sep"></div>

      <!-- Inputs for Title & Description -->
      <div class="flex items-center space-x-2 flex-1 max-w-3xl">
        <input
          v-model="titleInput"
          placeholder="Título da Aula"
          class="tb-input font-semibold w-52 shrink-0"
        />
        <input
          v-model="descInput"
          placeholder="Descrição rápida da aula..."
          class="tb-input flex-1"
        />
      </div>

      <div class="sep"></div>
      <BaseButton :variant="isPresentMode ? 'primary' : 'secondary'" size="sm" @click="togglePresentMode" title="Apresentar (F)">▶ Apresentar</BaseButton>
      <BaseButton :variant="isAnimMode ? 'primary' : 'secondary'" size="sm" @click="isAnimMode = !isAnimMode" title="Toggle animações">✦ Animação</BaseButton>
      <select
        v-model="currentTheme"
        @change="applyTheme(currentTheme, true)"
        class="tb-input font-medium"
        title="Tema do Slide Preview"
      >
        <option v-for="tKey in THEME_KEYS" :key="tKey" :value="tKey">
          Tema: {{ THEME_LABELS[tKey] }}
        </option>
      </select>

      <!-- Dropdown de Exportar -->
      <div class="export-dropdown relative">
        <BaseButton variant="secondary" size="sm" @click.stop="showExportMenu = !showExportMenu" title="Exportar Apresentação">📥 Exportar ▾</BaseButton>
        <div v-if="showExportMenu" class="export-menu">
          <button class="export-item" @click="exportHtml(); showExportMenu = false">🌐 HTML Autossuficiente (.html)</button>
          <button class="export-item" @click="exportPdf(); showExportMenu = false">📄 Documento PDF (.pdf)</button>
          <button class="export-item" @click="exportPptx(); showExportMenu = false">📊 Apresentação PowerPoint (.pptx)</button>
        </div>
      </div>

        <!-- Action Buttons -->
        <div class="flex items-center space-x-2 ml-auto">
          <BaseButton variant="ghost" size="sm" :disabled="props.loading || isSaving" @click="emit('close')">Cancelar</BaseButton>
          <BaseButton variant="primary" size="sm" :loading="props.loading || isSaving" @click="handleSave">Salvar Aula</BaseButton>
        </div>
    </div>

    <!-- MAIN SPLIT -->
    <div id="main" class="flex-1 flex overflow-hidden relative">
      <div id="editor-pane" ref="editorPaneRef">
        <div id="editor-header">
          <span>Markdown</span>
          <div class="flex items-center space-x-3">
            <span id="char-count">{{ charCountText }}</span>
          </div>
        </div>

        <!-- FIND & REPLACE BAR -->
        <div id="find-bar" v-if="showFindBar">
          <div class="find-row">
            <div class="find-input-group">
              <input
                ref="findInputRef"
                v-model="findQuery"
                @input="updateFindMatches"
                @keydown.enter.prevent="findNext"
                @keydown.esc="closeFindBar"
                type="text"
                id="find-input"
                placeholder="Localizar..."
                spellcheck="false"
              />
              <span id="find-count">{{ findCountText }}</span>
              <button class="find-option-btn" :class="{ active: isMatchCase }" @click="isMatchCase = !isMatchCase; updateFindMatches()" title="Diferenciar maiúsculas/minúsculas">Aa</button>
              <button class="find-option-btn" :class="{ active: isMatchRegex }" @click="isMatchRegex = !isMatchRegex; updateFindMatches()" title="Expressão regular (Regex)">.*</button>
            </div>
            <div class="find-actions">
              <button class="find-btn" @click="findPrev" title="Anterior (Shift+Enter)">↑</button>
              <button class="find-btn" @click="findNext" title="Próximo (Enter)">↓</button>
              <button class="find-btn" @click="showReplaceRow = !showReplaceRow" title="Alternar substituir (Ctrl+H)">⇄</button>
              <button class="find-btn" @click="closeFindBar" title="Fechar (Esc)">✕</button>
            </div>
          </div>
          <div class="replace-row" v-if="showReplaceRow">
            <input
              v-model="replaceQuery"
              @keydown.enter.prevent="replaceCurrent"
              @keydown.esc="closeFindBar"
              type="text"
              id="replace-input"
              placeholder="Substituir por..."
              spellcheck="false"
            />
            <button class="find-btn primary" @click="replaceCurrent">Substituir</button>
            <button class="find-btn primary" @click="replaceAll">Substituir Todos</button>
          </div>
        </div>

        <div id="editor-wrapper">
          <div id="editor-backdrop" ref="editorBackdropRef">
            <div id="editor-highlights" ref="editorHighlightsRef"></div>
          </div>
          <textarea
            id="editor"
            ref="editorRef"
            v-model="markdownInput"
            @scroll="syncBackdropScroll"
            @keydown="handleTabKey"
            spellcheck="false"
            placeholder="Digite seu código Marp Markdown aqui..."
          ></textarea>
        </div>
      </div>

      <div id="resizer" @mousedown="onResizerMouseDown"></div>

      <div id="preview-pane" ref="previewPaneRef" :data-theme="currentTheme" @click="handlePreviewClick" @scroll="handlePreviewScroll"></div>
    </div>

    <div id="progress-bar" ref="progressBarRef"></div>
    <div id="status-bar" ref="statusBarRef"></div>

    <!-- FLOATING PRESENTATION CONTROLS (Idêntico a backend/src/marp.ts) -->
    <div v-if="isPresentMode" id="controls-bar" :class="{ idle: isIdle }">
      <button class="ctrl-btn" id="btn-prev" @click="prevSlide" title="Anterior (← / ↑)">◀</button>
      <button class="ctrl-btn" id="btn-next" @click="nextSlide" title="Próximo (→ / ↓ / Espaço)">▶</button>
      <span id="counter" class="slide-counter">{{ totalSlides > 0 ? (currentSlide + 1) + '/' + totalSlides : '0/0' }}</span>
      <div class="divider"></div>
      <button class="ctrl-btn" id="btn-theme" @click="toggleTheme" title="Alternar Tema (T)">
        <svg v-if="currentTheme === 'default'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        <svg v-else-if="currentTheme === 'dark'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        {{ THEME_LABELS[currentTheme] }}
      </button>
      <div class="divider"></div>
      <span id="clock-display" class="clock-display" title="Hora Atual">{{ clockText }}</span>
      <div class="divider"></div>
      <button class="ctrl-btn" id="btn-font-dec" @click="adjustFont(0.9)" title="Diminuir Fonte (-)">A-</button>
      <button class="ctrl-btn" id="btn-font-reset" @click="resetFont" title="Resetar Fonte">100%</button>
      <button class="ctrl-btn" id="btn-font-inc" @click="adjustFont(1.1)" title="Aumentar Fonte (+)">A+</button>
      <div class="divider"></div>
      <button class="ctrl-btn" id="btn-fs" @click="toggleFullscreen" title="Tela Cheia (F)">⛶ Fullscreen</button>
    </div>
  </div>
</template>

<style scoped>
.marpnext-modal-root {
  --slide-w: 960px;
  --slide-h: 540px;
  --anim-duration: 0.5s;
  --anim-stagger: 0.1s;
  --radius: 10px;
  --topbar-h: 48px;
  font-family: var(--font-sans);
  color: var(--c-primary);
}

#topbar {
  height: var(--topbar-h);
  display: flex; align-items: center; gap: 12px;
  padding: 0 16px;
  background: var(--c-surface-alt);
  border-bottom: 1px solid var(--c-line);
  flex-shrink: 0;
  z-index: 100;
}
#topbar .logo { font-weight:800; font-size:14px; color:var(--c-accent); letter-spacing:-0.5px; }
#topbar .logo span { color:var(--c-muted); font-weight:400; }
#topbar .sep { width:1px; height:20px; background:var(--c-line); }

.tb-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:5px;
  height: 32px; padding: 0 12px; border-radius:6px; border:1px solid var(--c-line);
  background:transparent; color:var(--c-secondary); font-size:12px; font-weight: 500;
  font-family:var(--font-sans); cursor:pointer; transition:all .15s;
  box-sizing: border-box; outline: none; white-space: nowrap; flex-shrink: 0;
}
.tb-btn:hover { background:var(--c-accent-light); color:var(--c-accent); border-color:var(--c-accent); }
.tb-btn.active { background:var(--c-accent); color:var(--c-on-accent); border-color:var(--c-accent); }

.tb-input {
  height: 32px;
  padding: 0 12px;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  color: var(--c-primary);
  font-size: 12px;
  font-family: var(--font-sans);
  border-radius: 6px;
  outline: none;
  transition: all .15s ease;
}
.tb-input::placeholder {
  color: var(--c-muted);
  opacity: 0.8;
}
.tb-input:focus {
  border-color: var(--c-accent);
  box-shadow: 0 0 0 2px var(--c-accent-light);
}

#editor-pane {
  width: 42%; min-width: 320px;
  display:flex; flex-direction:column;
  background: var(--c-surface-alt);
  border-right: 1px solid var(--c-line);
  position: relative;
}

#editor-header {
  display:flex; align-items:center; justify-content:space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--c-line);
  font-size: 11px; color: var(--c-muted);
  text-transform: uppercase; letter-spacing: 0.5px;
}

#resizer {
  width: 5px; cursor: col-resize; background: var(--c-line);
  transition: background .2s; flex-shrink:0;
}
#resizer:hover { background: var(--c-accent); }

#preview-pane {
  flex:1; overflow-y:auto; overflow-x:hidden;
  background: var(--c-canvas);
  scroll-snap-type: y mandatory;
  scroll-behavior: smooth;
  padding: 32px;
  display:flex; flex-direction:column; align-items:center; gap:32px;
}

/* FIND BAR */
#find-bar {
  background: var(--c-surface-alt);
  border-bottom: 1px solid var(--c-line);
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  z-index: 50;
}
.find-row, .replace-row { display: flex; align-items: center; gap: 8px; width: 100%; }
.find-input-group {
  position: relative; flex: 1; display: flex; align-items: center;
  background: var(--c-surface); border: 1px solid var(--c-line); border-radius: 6px; padding: 2px 6px;
}
#find-input, #replace-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--c-primary); font-family: var(--font-mono); font-size: 12px; padding: 4px 6px;
}
#find-count { font-size: 11px; color: var(--c-muted); font-family: var(--font-mono); padding: 0 6px; white-space: nowrap; }
.find-option-btn {
  background: transparent; border: 1px solid transparent; color: var(--c-muted);
  font-family: var(--font-mono); font-size: 11px; font-weight: 700; padding: 2px 5px; border-radius: 4px; cursor: pointer;
}
.find-option-btn.active { background: var(--c-accent); color: var(--c-on-accent); }
.find-actions { display: flex; align-items: center; gap: 4px; }
.find-btn {
  display: inline-flex; align-items: center; justify-content: center; padding: 4px 8px;
  border-radius: 4px; border: 1px solid var(--c-line); background: transparent;
  color: var(--c-secondary); font-size: 11px; cursor: pointer;
}
.find-btn.primary { background: var(--c-accent); color: var(--c-on-accent); border-color: var(--c-accent); font-weight: 600; }
.tb-btn-xs {
  display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px;
  border-radius: 4px; border: 1px solid var(--c-line); background: transparent;
  color: var(--c-muted); font-size: 11px; cursor: pointer;
}

/* EXPORT DROPDOWN */
.export-menu {
  position: absolute; top: 100%; right: 0; margin-top: 4px;
  background: var(--c-surface-alt); border: 1px solid var(--c-line);
  border-radius: 6px; box-shadow: var(--shadow-modal);
  z-index: 100; min-width: 240px; padding: 4px 0;
}
.export-item {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px;
  border: none; background: transparent; color: var(--c-primary);
  font-size: 12px; cursor: pointer; text-align: left; transition: background 0.15s;
  white-space: nowrap;
}
.export-item:hover { background: var(--c-accent-light); color: var(--c-accent); }
.export-item.active { background: var(--c-accent-light); color: var(--c-accent); font-weight: 600; }

/* EDITOR HIGHLIGHTS BACKDROP */
#editor-wrapper { position: relative; flex: 1; width: 100%; height: 100%; overflow: hidden; display: flex; }
#editor-backdrop {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0; margin: 0; padding: 0; border: 0;
  overflow-y: scroll; overflow-x: hidden; pointer-events: none; z-index: 1;
}
#editor-highlights, #editor {
  font-family: var(--font-mono) !important; font-size: 13px !important; line-height: 1.7 !important;
  padding: 20px !important; margin: 0 !important; border: 0 !important; box-sizing: border-box !important;
  tab-size: 2 !important; -moz-tab-size: 2 !important; word-wrap: break-word !important;
  overflow-wrap: break-word !important; white-space: pre-wrap !important; letter-spacing: normal !important;
}
#editor-highlights { width: 100%; min-height: 100%; color: transparent; background: transparent; }
#editor {
  position: relative; z-index: 2; flex: 1; width: 100%; height: 100%;
  resize: none; outline: none; background: transparent; color: var(--c-primary); overflow-y: scroll;
}
:deep(mark.find-match) {
  background-color: rgba(234, 179, 8, 0.35); color: transparent !important; border-radius: 2px;
  display: inline !important; padding: 0 !important; margin: 0 !important; font: inherit !important;
  outline: 1px solid rgba(234, 179, 8, 0.5);
}
:deep(mark.find-match.active) {
  background-color: rgba(129, 140, 248, 0.6); color: transparent !important; outline: 2px solid var(--c-accent);
}

/* SLIDES STYLING (card 960x540 = layout do preview; cores do slide vêm de marpTheme.css via --slide-bg) */
:deep(.slide) {
  width: var(--slide-w); max-width:100%; min-height: var(--slide-h);
  padding: 48px 56px; background: var(--slide-bg); border-radius: var(--radius);
  scroll-snap-align: center; position:relative; overflow:visible;
  box-shadow: 0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px var(--c-line); flex-shrink: 0;
}
:deep(.slide.active) { box-shadow: 0 8px 48px rgba(129,140,248,0.12), 0 0 0 2px var(--c-accent); }
:deep(.slide-number) { position:absolute; top:16px; right:20px; font-size:11px; color:var(--c-muted); font-weight:600; }
:deep(.slide-content) { width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; gap:1.2rem; }
:deep(.slide-content h1) { font-size: calc(2.8rem * var(--font-scale, 1)); font-weight:900; letter-spacing:-1px; line-height:1.1; }
:deep(.slide-content h2) { font-size: calc(2rem * var(--font-scale, 1)); font-weight:700; letter-spacing:-0.5px; }
:deep(.slide-content h3) { font-size: calc(1.4rem * var(--font-scale, 1)); font-weight:600; }
:deep(.slide-content p)  { font-size: calc(1.15rem * var(--font-scale, 1)); line-height:1.75; color:var(--c-text); }
:deep(.slide-content ul), :deep(.slide-content ol) { font-size: calc(1.1rem * var(--font-scale, 1)); line-height:1.8; padding-left:1.6rem; margin-bottom:0.8em; color:var(--c-text); list-style-position: outside; }
:deep(.slide-content ul ul), :deep(.slide-content ul ol), :deep(.slide-content ol ul), :deep(.slide-content ol ol) { font-size:0.95em; line-height:1.6; margin-top:0.3em; margin-bottom:0.3em; padding-left:1.4rem; }
:deep(.slide-content ul) { list-style-type: disc; }
:deep(.slide-content ul ul) { list-style-type: circle; }
:deep(.slide-content ul ul ul) { list-style-type: square; }
:deep(.slide-content ol) { list-style-type: decimal; }
:deep(.table-wrap) { margin: 1.2em 0; border: 1px solid var(--c-line); border-radius: 8px; overflow: hidden; }
:deep(.slide-content table) { width:100%; border-collapse:collapse; font-size: calc(0.95rem * var(--font-scale, 1)); margin:0; }
:deep(.slide.centered .slide-content) { align-items:center; text-align:center; }

/* MERMAID STYLING */
:deep(.mermaid-block) { display: flex; justify-content: center; overflow: visible !important; padding: 16px 0; }
:deep(.mermaid-block svg) { overflow: visible !important; max-width: 100%; transform: scale(var(--font-scale, 1)); transform-origin: center center; }
:deep(.mermaid-error) { color: var(--red); font-family: var(--font-mono); font-size: 12px; white-space: pre-wrap; }
:deep(.mermaid-block p), :deep(.mermaid-block div), :deep(.mermaid-block span) { margin: 0 !important; padding: 0 !important; line-height: 1.25 !important; }
:deep(.mermaid-block .nodeLabel),
:deep(.mermaid-block .edgeLabel),
:deep(.mermaid-block text),
:deep(.mermaid-block .label),
:deep(.mermaid-block .cluster-label text),
:deep(.mermaid-block .actor) {
  white-space: pre-wrap !important;
  overflow: visible !important;
  text-overflow: clip !important;
  line-height: 1.25 !important;
}
:deep(.mermaid-block foreignObject) { overflow: visible !important; }
:deep(.mermaid-block foreignObject div) { display: flex !important; align-items: center !important; justify-content: center !important; width: 100% !important; height: 100% !important; box-sizing: border-box !important; overflow: visible !important; white-space: nowrap !important; text-align: center !important; line-height: 1.25 !important; }
:deep(.mermaid-block .node rect),
:deep(.mermaid-block .node polygon),
:deep(.mermaid-block .node circle),
:deep(.mermaid-block .node ellipse) { stroke-width: 1.5px; }

/* ANIMATIONS */
:deep(.slide .slide-content > *) { opacity:1; transition: opacity .3s, transform .3s; }
.marpnext-modal-root.anim-mode :deep(.slide:not(.active) .slide-content > *) { opacity: 0; }
.marpnext-modal-root.anim-mode :deep(.slide.active .slide-content > *) { animation-fill-mode: forwards; }

@keyframes anim-fade { from{opacity:0} to{opacity:1} }
@keyframes anim-fade-up { from{opacity:0;transform:translateY(36px)} to{opacity:1;transform:translateY(0)} }
@keyframes anim-fade-down { from{opacity:0;transform:translateY(-36px)} to{opacity:1;transform:translateY(0)} }
@keyframes anim-fade-left { from{opacity:0;transform:translateX(36px)} to{opacity:1;transform:translateX(0)} }
@keyframes anim-fade-right { from{opacity:0;transform:translateX(-36px)} to{opacity:1;transform:translateX(0)} }
@keyframes anim-slide-up { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
@keyframes anim-zoom-in { from{opacity:0;transform:scale(0.7)} to{opacity:1;transform:scale(1)} }
@keyframes anim-zoom-out { from{opacity:0;transform:scale(1.3)} to{opacity:1;transform:scale(1)} }
@keyframes anim-flip-x { from{opacity:0;transform:perspective(800px) rotateX(80deg)} to{opacity:1;transform:perspective(800px) rotateX(0)} }
@keyframes anim-flip-y { from{opacity:0;transform:perspective(800px) rotateY(80deg)} to{opacity:1;transform:perspective(800px) rotateY(0)} }
@keyframes anim-blur-in { from{opacity:0;filter:blur(16px)} to{opacity:1;filter:blur(0)} }
@keyframes anim-bounce-in { from{opacity:0;transform:scale(0.3)} to{opacity:1;transform:scale(1)} }
@keyframes anim-elastic { from{opacity:0;transform:scale(0)} to{opacity:1;transform:scale(1)} }

.marpnext-modal-root.anim-mode :deep(.slide.active[data-animation="fade"] .slide-content>*) { animation:anim-fade var(--anim-duration, 0.5s) ease both; }
.marpnext-modal-root.anim-mode :deep(.slide.active[data-animation="fade-up"] .slide-content>*) { animation:anim-fade-up var(--anim-duration, 0.5s) cubic-bezier(.4,0,.2,1) both; }
.marpnext-modal-root.anim-mode :deep(.slide.active[data-animation="fade-down"] .slide-content>*) { animation:anim-fade-down var(--anim-duration, 0.5s) cubic-bezier(.4,0,.2,1) both; }
.marpnext-modal-root.anim-mode :deep(.slide.active[data-animation="fade-left"] .slide-content>*) { animation:anim-fade-left var(--anim-duration, 0.5s) cubic-bezier(.4,0,.2,1) both; }
.marpnext-modal-root.anim-mode :deep(.slide.active[data-animation="fade-right"] .slide-content>*) { animation:anim-fade-right var(--anim-duration, 0.5s) cubic-bezier(.4,0,.2,1) both; }
.marpnext-modal-root.anim-mode :deep(.slide.active[data-animation="slide-up"] .slide-content>*) { animation:anim-slide-up var(--anim-duration, 0.5s) cubic-bezier(.4,0,.2,1) both; }
.marpnext-modal-root.anim-mode :deep(.slide.active[data-animation="zoom-in"] .slide-content>*) { animation:anim-zoom-in var(--anim-duration, 0.5s) cubic-bezier(.4,0,.2,1) both; }
.marpnext-modal-root.anim-mode :deep(.slide.active[data-animation="zoom-out"] .slide-content>*) { animation:anim-zoom-out var(--anim-duration, 0.5s) cubic-bezier(.4,0,.2,1) both; }
.marpnext-modal-root.anim-mode :deep(.slide.active[data-animation="flip-x"] .slide-content>*) { animation:anim-flip-x var(--anim-duration, 0.5s) ease both; }
.marpnext-modal-root.anim-mode :deep(.slide.active[data-animation="flip-y"] .slide-content>*) { animation:anim-flip-y var(--anim-duration, 0.5s) ease both; }
.marpnext-modal-root.anim-mode :deep(.slide.active[data-animation="blur-in"] .slide-content>*) { animation:anim-blur-in var(--anim-duration, 0.5s) ease both; }
.marpnext-modal-root.anim-mode :deep(.slide.active[data-animation="bounce-in"] .slide-content>*) { animation:anim-bounce-in var(--anim-duration, .7s) cubic-bezier(.68,-.55,.265,1.55) both; }
.marpnext-modal-root.anim-mode :deep(.slide.active[data-animation="elastic"] .slide-content>*) { animation:anim-elastic var(--anim-duration, .8s) cubic-bezier(.175,.885,.32,1.275) both; }

.marpnext-modal-root.anim-mode :deep(.slide.active[data-anim-stagger] .slide-content>*:nth-child(2)) { animation-delay:calc(var(--anim-stagger)*1); }
.marpnext-modal-root.anim-mode :deep(.slide.active[data-anim-stagger] .slide-content>*:nth-child(3)) { animation-delay:calc(var(--anim-stagger)*2); }
.marpnext-modal-root.anim-mode :deep(.slide.active[data-anim-stagger] .slide-content>*:nth-child(4)) { animation-delay:calc(var(--anim-stagger)*3); }
.marpnext-modal-root.anim-mode :deep(.slide.active[data-anim-stagger] .slide-content>*:nth-child(5)) { animation-delay:calc(var(--anim-stagger)*4); }
.marpnext-modal-root.anim-mode :deep(.slide.active[data-anim-stagger] .slide-content>*:nth-child(6)) { animation-delay:calc(var(--anim-stagger)*5); }
.marpnext-modal-root.anim-mode :deep(.slide.active[data-anim-stagger] .slide-content>*:nth-child(7)) { animation-delay:calc(var(--anim-stagger)*6); }
.marpnext-modal-root.anim-mode :deep(.slide.active[data-anim-stagger] .slide-content>*:nth-child(8)) { animation-delay:calc(var(--anim-stagger)*7); }

#progress-bar { position:fixed; bottom:0; left:0; height:3px; background:linear-gradient(90deg, var(--c-accent), #a855f7); transition:width .3s; z-index:999; }
#status-bar { position:fixed; bottom:8px; right:16px; font-size:11px; color:var(--c-muted); font-family:var(--font-mono); z-index:999; }
.slide-count-text { font-size:11px; color:var(--c-muted); font-family:var(--font-mono); }

/* PRESENT MODE */
.present-mode #topbar, .present-mode #editor-pane, .present-mode #resizer { display:none !important; }
.present-mode #preview-pane {
  position: relative !important;
  padding: 0 !important;
  gap: 0 !important;
  background: var(--bg-app);
  width: 100vw !important;
  height: 100vh !important;
  overflow: hidden !important;
  user-select: none;
}
.present-mode :deep(.slide) {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  min-height: 100vh !important;
  max-width: none !important;
  max-height: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  border: none !important;
  padding: 60px 80px !important;
  margin: 0 !important;
  opacity: 0 !important;
  pointer-events: none !important;
  transform: scale(1) !important;
  transition: opacity 0.4s ease !important;
}
.present-mode :deep(.slide.active) {
  opacity: 1 !important;
  pointer-events: auto !important;
  transform: scale(1) !important;
}

@media (max-width: 768px) {
  .present-mode :deep(.slide) {
    padding: 24px 28px !important;
  }
}
</style>
