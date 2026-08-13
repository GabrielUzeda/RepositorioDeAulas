<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount, onMounted } from 'vue';
import { useToast } from '@/shared/composables/useToast';
import BaseButton from '@/shared/components/BaseButton.vue';

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
const currentTheme = ref<'dark' | 'light'>('dark');
const showThemeMenu = ref(false);
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

function adjustFont(factor: number) {
  fontScale.value *= factor;
  fontScale.value = Math.max(0.6, Math.min(2.5, fontScale.value));
  document.documentElement.style.setProperty('--font-scale', String(fontScale.value));
}

function resetFont() {
  fontScale.value = 1.0;
  document.documentElement.style.setProperty('--font-scale', '1.0');
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function handleMouseMove() {
  isIdle.value = false;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    isIdle.value = true;
  }, 2500);
}

// Default Markdown Template
const DEFAULT_MD = `---
theme: dark
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
function initMermaid(themeName: 'dark' | 'light') {
  const w = window as any;
  if (w.mermaid) {
    w.mermaid.initialize({
      startOnLoad: false,
      theme: themeName === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      flowchart: { useMaxWidth: true, htmlLabels: true, padding: 20 },
      sequence: { useMaxWidth: true, wrap: true },
      themeVariables: {
        primaryColor: '#6366f1',
        primaryTextColor: themeName === 'dark' ? '#f8fafc' : '#0f172a',
        lineColor: themeName === 'dark' ? '#94a3b8' : '#475569',
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

  const targetTheme = (global.theme && (global.theme === 'light' || global.theme === 'dark'))
    ? (global.theme as 'dark' | 'light')
    : currentTheme.value;

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
    el.innerHTML = `
      <span class="slide-number">${i + 1}/${totalSlidesNum}</span>
      <div class="slide-content">${html}</div>
    `;
    renderKaTeX(el);
    container.appendChild(el);
  });

  activateSlide(Math.min(currentSlideNum, totalSlidesNum - 1));
  requestAnimationFrame(() => renderAllMermaid());
}

function renderKaTeX(container: HTMLElement) {
  const w = window as any;
  if (!w.katex) return;

  const contentDiv = container.querySelector('.slide-content');
  if (!contentDiv) return;

  // Processa blocos $$...$$ primeiro
  contentDiv.innerHTML = contentDiv.innerHTML.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      return w.katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    } catch (e) {
      return `$$${math}$$`;
    }
  });

  // Processa inline $...$
  contentDiv.innerHTML = contentDiv.innerHTML.replace(/(^|[^\\])\$([^$\n]+?)\$/g, (_, prefix, math) => {
    try {
      return prefix + w.katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch (e) {
      return `${prefix}$${math}$`;
    }
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

function applyTheme(newTheme: 'dark' | 'light', updateEditorText = true) {
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
  const nextTheme = currentTheme.value === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme, true);
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
function generateMarpNextStandaloneHtml(titulo: string, mdContent: string): string {
  const { slides, global } = parseSlides(mdContent);
  const docTitle = (global.title && String(global.title).trim()) ? String(global.title).trim() : (titulo || 'Apresentação — Marp Next');
  const initialTheme = (global.theme && (global.theme === 'light' || global.theme === 'dark')) ? global.theme : 'dark';

  const md = getMarkdownIt();

  let slidesHtml = '';
  slides.forEach((slide, i) => {
    const cls = 'slide' + (slide.directives.class ? ' ' + slide.directives.class : '');
    const animAttr = slide.directives.animation ? `data-animation="${escapeHtml(slide.directives.animation)}"` : '';
    const staggerAttr = slide.directives['animation-stagger'] ? `data-anim-stagger="true"` : '';

    const styleParts: string[] = [];
    if (slide.directives.background) styleParts.push(`background:${slide.directives.background}`);
    if (slide.directives['animation-duration']) styleParts.push(`--anim-duration:${slide.directives['animation-duration']}`);
    if (slide.directives['animation-stagger']) styleParts.push(`--anim-stagger:${slide.directives['animation-stagger']}`);

    const styleAttr = styleParts.length > 0 ? `style="${styleParts.join(';')}"` : '';
    let rawHtml = md ? md.render(slide.content) : `<p>${escapeHtml(slide.content)}</p>`;
    rawHtml = rawHtml.replace(/<table>[\s\S]*?<\/table>/g, (tableHtml: string) => `<div class="table-wrap">${tableHtml}</div>`);

    slidesHtml += `
    <section class="${cls}" data-slide="${i}" ${animAttr} ${staggerAttr} ${styleAttr}>
      <span class="slide-number">${i + 1}/${slides.length}</span>
      <div class="slide-content">${rawHtml}</div>
    </section>`;
  });

  return `<!DOCTYPE html>
<html lang="pt-BR" data-theme="${initialTheme}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(docTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800;900&family=JetBrains Mono:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js"><${'/script'}>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"><${'/script'}>
<style>
:root {
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --bg-app: #0f172a;
  --text-primary: #f8fafc;
  --text-secondary: #cbd5e1;
  --text-muted: #94a3b8;
  --border: #334155;
  --accent: #818cf8;
  --accent-dim: rgba(129, 140, 248, 0.18);
  --code-fg: #c7d2fe;
  --slide-bg: #1e293b;
  --font-scale: 1;
  --anim-duration: 0.5s;
}

[data-theme="light"] {
  --bg-app: #f8fafc;
  --text-primary: #0f172a;
  --text-secondary: #334155;
  --text-muted: #475569;
  --border: #cbd5e1;
  --accent: #4338ca;
  --accent-dim: rgba(67, 56, 202, 0.12);
  --code-fg: #4338ca;
  --slide-bg: #ffffff;
}

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  width: 100vw;
  height: 100vh;
  background: var(--bg-app);
  color: var(--text-primary);
  font-family: var(--font-sans);
  overflow: hidden;
  user-select: none;
}

#slides-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slide {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  max-width: none;
  max-height: none;
  background: var(--slide-bg);
  border: none;
  border-radius: 0;
  padding: 60px 80px;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transform: scale(1);
  transition: opacity 0.4s ease;
  font-size: calc(16px * var(--font-scale));
  overflow: visible;
}

.slide.active {
  opacity: 1;
  pointer-events: auto;
  transform: scale(1);
  z-index: 10;
}

.slide.centered {
  text-align: center;
  align-items: center;
}

.slide-content h1 { font-size: calc(2.8em * var(--font-scale)); font-weight: 900; letter-spacing: -1px; line-height: 1.1; margin-bottom: 0.4em; color: var(--text-primary); }
.slide-content h2 { font-size: calc(2.0em * var(--font-scale)); font-weight: 700; letter-spacing: -0.5px; margin-bottom: 0.4em; color: var(--text-primary); }
.slide-content h3 { font-size: calc(1.4em * var(--font-scale)); font-weight: 600; margin-bottom: 0.4em; color: var(--text-primary); }
.slide-content p { font-size: calc(1.15em * var(--font-scale)); line-height: 1.7; margin-bottom: 0.6em; color: var(--text-secondary); }

/* Table Styles for Standalone HTML */
.table-wrap {
  margin: 1.2em 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.slide-content table {
  width: 100%;
  border-collapse: collapse;
  font-size: calc(0.95em * var(--font-scale));
  border: none;
  border-radius: 0;
  margin: 0;
}
.slide-content th, .slide-content td {
  padding: 12px 18px;
  border: 1px solid var(--border);
  text-align: left;
  line-height: 1.5;
}
.slide-content th {
  background: var(--accent-dim);
  color: var(--text-primary);
  font-weight: 700;
}
.slide-content tr:nth-child(even) {
  background: rgba(255, 255, 255, 0.03);
}
[data-theme="light"] .slide-content tr:nth-child(even) {
  background: rgba(0, 0, 0, 0.03);
}

.slide-content code {
  font-family: var(--font-mono);
  font-size: 0.88em;
  background: var(--accent-dim);
  color: var(--code-fg);
  padding: 2px 6px;
  border-radius: 4px;
}
.slide-content pre {
  background: #0d1117;
  color: #e6edf3;
  padding: 20px 24px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.85em;
  line-height: 1.65;
  font-family: var(--font-mono);
  margin: 1em 0;
}
.slide-content pre code {
  background: none;
  color: inherit;
  padding: 0;
}

.slide-content ul, .slide-content ol {
  font-size: calc(1.1em * var(--font-scale));
  line-height: 1.8;
  padding-left: 1.6em;
  margin-bottom: 0.8em;
  color: var(--text-secondary);
}
.slide-content li::marker { color: var(--accent); }
.slide-content blockquote {
  border-left: 4px solid var(--accent);
  padding-left: 18px;
  color: var(--text-muted);
  font-style: italic;
  margin: 1em 0;
}
.slide-content img { max-width: 100%; max-height: 75vh; object-fit: contain; height: auto; border-radius: 8px; }
.slide-content a { color: var(--accent); text-decoration: none; }
.slide-content a:hover { text-decoration: underline; }

.slide-number {
  position: absolute;
  bottom: 20px;
  right: 24px;
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-weight: 600;
}

/* Animations */
.slide .slide-content > * { opacity:1; transition: opacity .3s, transform .3s; }
body.anim-mode .slide:not(.active) .slide-content > * { opacity:0; }
body.anim-mode .slide.active .slide-content > * { animation-fill-mode:forwards; }

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

body.anim-mode .slide.active[data-animation="fade"] .slide-content>* { animation:anim-fade var(--anim-duration, 0.5s) ease both; }
body.anim-mode .slide.active[data-animation="fade-up"] .slide-content>* { animation:anim-fade-up var(--anim-duration, 0.5s) cubic-bezier(.4,0,.2,1) both; }
body.anim-mode .slide.active[data-animation="fade-down"] .slide-content>* { animation:anim-fade-down var(--anim-duration, 0.5s) cubic-bezier(.4,0,.2,1) both; }
body.anim-mode .slide.active[data-animation="fade-left"] .slide-content>* { animation:anim-fade-left var(--anim-duration, 0.5s) cubic-bezier(.4,0,.2,1) both; }
body.anim-mode .slide.active[data-animation="fade-right"] .slide-content>* { animation:anim-fade-right var(--anim-duration, 0.5s) cubic-bezier(.4,0,.2,1) both; }
body.anim-mode .slide.active[data-animation="slide-up"] .slide-content>* { animation:anim-slide-up var(--anim-duration, 0.5s) cubic-bezier(.4,0,.2,1) both; }
body.anim-mode .slide.active[data-animation="zoom-in"] .slide-content>* { animation:anim-zoom-in var(--anim-duration, 0.5s) cubic-bezier(.4,0,.2,1) both; }
body.anim-mode .slide.active[data-animation="zoom-out"] .slide-content>* { animation:anim-zoom-out var(--anim-duration, 0.5s) cubic-bezier(.4,0,.2,1) both; }
body.anim-mode .slide.active[data-animation="flip-x"] .slide-content>* { animation:anim-flip-x var(--anim-duration, 0.5s) ease both; }
body.anim-mode .slide.active[data-animation="flip-y"] .slide-content>* { animation:anim-flip-y var(--anim-duration, 0.5s) ease both; }
body.anim-mode .slide.active[data-animation="blur-in"] .slide-content>* { animation:anim-blur-in var(--anim-duration, 0.5s) ease both; }
body.anim-mode .slide.active[data-animation="bounce-in"] .slide-content>* { animation:anim-bounce-in var(--anim-duration, .7s) cubic-bezier(.68,-.55,.265,1.55) both; }
body.anim-mode .slide.active[data-animation="elastic"] .slide-content>* { animation:anim-elastic var(--anim-duration, .8s) cubic-bezier(.175,.885,.32,1.275) both; }

body.anim-mode .slide.active[data-anim-stagger] .slide-content>*:nth-child(2) { animation-delay:calc(var(--anim-stagger)*1); }
body.anim-mode .slide.active[data-anim-stagger] .slide-content>*:nth-child(3) { animation-delay:calc(var(--anim-stagger)*2); }
body.anim-mode .slide.active[data-anim-stagger] .slide-content>*:nth-child(4) { animation-delay:calc(var(--anim-stagger)*3); }
body.anim-mode .slide.active[data-anim-stagger] .slide-content>*:nth-child(5) { animation-delay:calc(var(--anim-stagger)*4); }
body.anim-mode .slide.active[data-anim-stagger] .slide-content>*:nth-child(6) { animation-delay:calc(var(--anim-stagger)*5); }
body.anim-mode .slide.active[data-anim-stagger] .slide-content>*:nth-child(7) { animation-delay:calc(var(--anim-stagger)*6); }
body.anim-mode .slide.active[data-anim-stagger] .slide-content>*:nth-child(8) { animation-delay:calc(var(--anim-stagger)*7); }

#controls-bar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 30px;
  padding: 6px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 1000;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  transition: opacity 0.3s ease;
}
[data-theme="light"] #controls-bar {
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 10px 30px rgba(0,0,0,0.12);
}
#controls-bar.idle { opacity: 0.15; }
#controls-bar:hover, #controls-bar.idle:hover { opacity: 1; }

.ctrl-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
}
.ctrl-btn:hover {
  background: var(--accent-dim);
  color: var(--accent);
  border-color: var(--accent);
}

#progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background: var(--accent);
  transition: width 0.3s ease;
  z-index: 1001;
}

@media print {
  html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
  #slides-container { display: block !important; height: auto !important; }
  #controls-bar, #progress-bar { display: none !important; }
  .slide { page-break-after: always !important; break-after: page !important; position: relative !important; opacity: 1 !important; width: 100vw !important; height: 100vh !important; }
  body.anim-mode .slide .slide-content > * { opacity: 1 !important; animation: none !important; }
}
.mermaid-block {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: visible !important;
  margin: 1em 0;
}
.mermaid-block svg {
  overflow: visible !important;
  max-width: 100%;
  height: auto;
  transform: scale(var(--font-scale, 1));
  transform-origin: center center;
}
.mermaid-block p, .mermaid-block div, .mermaid-block span {
  line-height: 1.25 !important;
  margin: 0 !important;
  padding: 0 !important;
}
.mermaid-block .nodeLabel,
.mermaid-block .edgeLabel,
.mermaid-block text,
.mermaid-block .label,
.mermaid-block .cluster-label text,
.mermaid-block .actor {
  white-space: pre-wrap !important;
  overflow: visible !important;
  text-overflow: clip !important;
  line-height: 1.25 !important;
}
.mermaid-block foreignObject {
  overflow: visible !important;
}
.mermaid-block foreignObject div {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  height: 100% !important;
  box-sizing: border-box !important;
  overflow: visible !important;
  white-space: nowrap !important;
  text-align: center !important;
  line-height: 1.25 !important;
}
.mermaid-block .node rect,
.mermaid-block .node polygon,
.mermaid-block .node circle,
.mermaid-block .node ellipse {
  stroke-width: 1.5px;
}
</style>
</head>
<body class="anim-mode">

<div id="progress-bar"></div>
<div id="slides-container">
  ${slidesHtml}
</div>

<div id="controls-bar">
  <button class="ctrl-btn" id="btn-prev" title="Anterior (← / ↑)">◀</button>
  <button class="ctrl-btn" id="btn-next" title="Próximo (→ / ↓ / Espaço)">▶</button>
  <span id="counter" style="font-size:12px;font-family:var(--font-mono);color:var(--text-muted);padding:0 6px;">${slides.length > 0 ? '1/' + slides.length : '0/0'}</span>
  <div style="width:1px;height:16px;background:var(--border);"></div>
  <button class="ctrl-btn" id="btn-theme" title="Alternar Tema (T)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Escuro</button>
  <button class="ctrl-btn" id="btn-font-dec" title="Diminuir Fonte (-)">A-</button>
  <button class="ctrl-btn" id="btn-font-reset" title="Resetar Fonte">100%</button>
  <button class="ctrl-btn" id="btn-font-inc" title="Aumentar Fonte (+)">A+</button>
  <div style="width:1px;height:16px;background:var(--border);"></div>
  <button class="ctrl-btn" id="btn-fs" title="Tela Cheia (F)">⛶ Fullscreen</button>
</div>

<script>
const sunSvg = \`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>\`;
const moonSvg = \`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>\`;

let currentSlide = 0;
const totalSlides = ${slides.length};
let fontScale = 1.0;
let mermaidCounter = 0;

// Save original mermaid code blocks so theme switching can re-render them
document.querySelectorAll('.slide-content pre').forEach(pre => {
  const code = pre.querySelector('code');
  if (code && (code.className.includes('mermaid') || /^(graph|flowchart|sequence|classDiagram|stateDiagram|erDiagram|pie|gantt|journey|mindmap|timeline)/m.test(code.textContent.trim()))) {
    pre.dataset.rawMermaid = code.textContent.trim();
    pre.dataset.isMermaid = '1';
  }
});

function initMermaid(themeName) {
  if (window.mermaid) {
    mermaid.initialize({
      startOnLoad: false,
      theme: themeName === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      flowchart: { useMaxWidth: true, htmlLabels: true, padding: 20 },
      sequence: { useMaxWidth: true, wrap: true },
      themeVariables: {
        primaryColor: '#6366f1',
        primaryTextColor: themeName === 'dark' ? '#f8fafc' : '#0f172a',
        lineColor: themeName === 'dark' ? '#94a3b8' : '#475569',
        fontSize: '15px'
      }
    });
  }
}

function updateThemeUI(themeName) {
  const btn = document.getElementById('btn-theme');
  if (btn) {
    btn.innerHTML = themeName === 'dark' ? sunSvg + ' Claro' : moonSvg + ' Escuro';
  }
}

function activateSlide(idx) {
  if (totalSlides === 0) return;
  currentSlide = Math.max(0, Math.min(idx, totalSlides - 1));
  document.querySelectorAll('.slide').forEach((s, i) => {
    s.classList.toggle('active', i === currentSlide);
  });
  document.getElementById('counter').textContent = (currentSlide + 1) + '/' + totalSlides;
  document.getElementById('progress-bar').style.width = (((currentSlide + 1) / totalSlides) * 100) + '%';
}

async function renderAllMermaid() {
  if (!window.mermaid) return;
  try {
    await document.fonts.ready;
    await document.fonts.load('16px Inter');
  } catch (e) {}

  document.querySelectorAll('.slide-content').forEach(container => {
    container.querySelectorAll('pre, .mermaid-block').forEach(el => {
      const src = el.dataset.rawMermaid || (el.querySelector('code') ? el.querySelector('code').textContent.trim() : null);
      if (!src) return;

      const isMmd = el.dataset.isMermaid === '1' ||
        (el.querySelector('code') && el.querySelector('code').className.includes('mermaid')) ||
        /^(graph|flowchart|sequence|classDiagram|stateDiagram|erDiagram|pie|gantt|journey|mindmap|timeline)/m.test(src);
      if (!isMmd) return;

      const id = 'mmd-p-' + (++mermaidCounter);
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-block';
      wrapper.dataset.rawMermaid = src;
      wrapper.dataset.isMermaid = '1';
      el.replaceWith(wrapper);

      mermaid.render(id, src).then(({ svg }) => {
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
          svgEl.querySelectorAll('g, foreignObject, text, rect, div').forEach(node => node.style.overflow = 'visible');
        }
      }).catch(err => {
        wrapper.innerHTML = '<div style="color:#ef4444;font-size:12px;">⚠ Mermaid: ' + err.message + '</div>';
      });
    });
  });
}

// Navigation & Controls
document.getElementById('btn-prev').addEventListener('click', () => activateSlide(currentSlide - 1));
document.getElementById('btn-next').addEventListener('click', () => activateSlide(currentSlide + 1));

document.getElementById('btn-theme').addEventListener('click', toggleTheme);
function toggleTheme() {
  const cur = document.documentElement.dataset.theme || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  updateThemeUI(next);
  initMermaid(next);
  renderAllMermaid();
}

document.getElementById('btn-font-inc').addEventListener('click', () => adjustFont(1.1));
document.getElementById('btn-font-dec').addEventListener('click', () => adjustFont(0.9));
document.getElementById('btn-font-reset').addEventListener('click', () => { fontScale = 1.0; applyFontScale(); });

function adjustFont(factor) {
  fontScale *= factor;
  fontScale = Math.max(0.6, Math.min(2.5, fontScale));
  applyFontScale();
}
function applyFontScale() {
  document.documentElement.style.setProperty('--font-scale', fontScale);
}

document.getElementById('btn-fs').addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
});

// Keyboard Hotkeys
document.addEventListener('keydown', e => {
  switch (e.key) {
    case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown':
      e.preventDefault(); activateSlide(currentSlide + 1); break;
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
      e.preventDefault(); activateSlide(currentSlide - 1); break;
    case 'Home': e.preventDefault(); activateSlide(0); break;
    case 'End': e.preventDefault(); activateSlide(totalSlides - 1); break;
    case 'f': case 'F':
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
      break;
    case 't': case 'T':
      toggleTheme(); break;
    case '+': case '=':
      adjustFont(1.1); break;
    case '-': case '_':
      adjustFont(0.9); break;
  }
});

// Controls auto-hide when idle
let idleTimer;
const controls = document.getElementById('controls-bar');
document.addEventListener('mousemove', () => {
  controls.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => controls.classList.add('idle'), 2500);
});

try {
  const _url = new URL(window.location.href);
  if (_url.searchParams.has('senha')) {
    _url.searchParams.delete('senha');
    window.history.replaceState({}, document.title, _url.pathname + (_url.searchParams.toString() ? '?' + _url.searchParams.toString() : '') + _url.hash);
  }
} catch (e) {}

function renderAllKaTeX() {
  if (!window.katex) return;
  document.querySelectorAll('.slide-content').forEach(container => {
    container.innerHTML = container.innerHTML.replace(/\\$\\$([\\s\\S]+?)\\$\\$/g, (_, math) => {
      try { return window.katex.renderToString(math.trim(), { displayMode: true, throwOnError: false }); }
      catch (e) { return '$$' + math + '$$'; }
    });
    container.innerHTML = container.innerHTML.replace(/(^|[^\\\\])\\$([^\\$\\n]+?)\\$/g, (_, prefix, math) => {
      try { return prefix + window.katex.renderToString(math.trim(), { displayMode: false, throwOnError: false }); }
      catch (e) { return prefix + '$' + math + '$'; }
    });
  });
}

activateSlide(0);
renderAllKaTeX();
initMermaid(document.documentElement.dataset.theme || 'dark');
renderAllMermaid();
<${'/script'}>
</body>
</html>`;
}

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

function exportHtml() {
  showExportMenu.value = false;
  const htmlContent = generateMarpNextStandaloneHtml(titleInput.value || 'Aula Sem Título', markdownInput.value);
  downloadFile(htmlContent, 'apresentacao-marp-next.html', 'text/html;charset=utf-8;');
}

function exportPdf() {
  showExportMenu.value = false;
  window.print();
}

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
  const isDark = currentTheme.value === 'dark';
  const titleColor = isDark ? 'F8FAFC' : '0F172A';
  const bodyColor = isDark ? 'CBD5E1' : '475569';

  const slideBgColor = (sEl: Element) => {
    const style = sEl.getAttribute('style') || '';
    const m = style.match(/#[0-9a-fA-F]{3,8}/);
    return m ? m[0].replace('#', '').slice(0, 6).toUpperCase() : (isDark ? '1E293B' : 'FFFFFF');
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

// ─── Save & Props Sync ─────────────────────
function handleSave() {
  emit('save', {
    titulo: titleInput.value.trim(),
    descricao: descInput.value.trim(),
    markdown: markdownInput.value,
  });
}

watch(
  () => props.show,
  (show) => {
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
  const isInputTarget = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('#find-bar'));

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

  if (isPresentMode.value || !isInputTarget) {
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
  showThemeMenu.value = false;
  showExportMenu.value = false;
}

onMounted(() => {
  setupAutoSave();
  window.addEventListener('keydown', handleGlobalKeydown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('click', handleWindowClick);
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
  window.removeEventListener('keydown', handleGlobalKeydown);
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('click', handleWindowClick);
  if (idleTimer) clearTimeout(idleTimer);
  const w = window as any;
  if (w.marpNext) delete w.marpNext;
});

</script>

<template>
  <div v-if="props.show" class="marpnext-modal-root fixed inset-0 bg-slate-950 flex flex-col z-50 overflow-hidden" :class="{ 'present-mode': isPresentMode, 'anim-mode': isAnimMode }" :data-theme="currentTheme">
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
      <button class="tb-btn" :class="{ active: isPresentMode }" @click="togglePresentMode" title="Apresentar (F)">▶ Apresentar</button>
      <button class="tb-btn" :class="{ active: isAnimMode }" @click="isAnimMode = !isAnimMode" title="Toggle animações">✦ Animação</button>

      <!-- Dropdown de Tema (Idêntico ao de Exportar) -->
      <div class="export-dropdown relative">
        <button class="tb-btn" @click.stop="showThemeMenu = !showThemeMenu; showExportMenu = false" title="Alternar tema da apresentação">
          {{ currentTheme === 'dark' ? '🌙 Dark' : '☀️ Light' }} ▾
        </button>
        <div v-if="showThemeMenu" class="export-menu theme-menu">
          <button class="export-item" :class="{ active: currentTheme === 'dark' }" @click="applyTheme('dark', true); showThemeMenu = false">
            🌙 Dark
          </button>
          <button class="export-item" :class="{ active: currentTheme === 'light' }" @click="applyTheme('light', true); showThemeMenu = false">
            ☀️ Light
          </button>
        </div>
      </div>

      <!-- Dropdown de Exportar -->
      <div class="export-dropdown relative">
        <button class="tb-btn" @click.stop="showExportMenu = !showExportMenu; showThemeMenu = false" title="Exportar Apresentação">📥 Exportar ▾</button>
        <div v-if="showExportMenu" class="export-menu">
          <button class="export-item" @click="exportHtml(); showExportMenu = false">🌐 HTML Autossuficiente (.html)</button>
          <button class="export-item" @click="exportPdf(); showExportMenu = false">📄 Documento PDF (.pdf)</button>
          <button class="export-item" @click="exportPptx(); showExportMenu = false">📊 Apresentação PowerPoint (.pptx)</button>
        </div>
      </div>

        <!-- Action Buttons -->
        <div class="flex items-center space-x-2 ml-auto">
          <BaseButton variant="ghost" size="sm" @click="emit('close')">Cancelar</BaseButton>
          <BaseButton variant="primary" size="sm" @click="handleSave">Salvar Aula</BaseButton>
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

      <div id="preview-pane" ref="previewPaneRef" @click="handlePreviewClick" @scroll="handlePreviewScroll"></div>
    </div>

    <div id="progress-bar" ref="progressBarRef"></div>
    <div id="status-bar" ref="statusBarRef"></div>

    <!-- FLOATING PRESENTATION CONTROLS (Igual a apresentacao-marp-next.html) -->
    <div v-if="isPresentMode" id="controls-bar" :class="{ idle: isIdle }">
      <button class="ctrl-btn" @click="prevSlide" title="Anterior (← / ↑)">◀</button>
      <button class="ctrl-btn" @click="nextSlide" title="Próximo (→ / ↓ / Espaço)">▶</button>
      <span id="counter" style="font-size:12px;font-family:var(--font-mono);color:var(--text-muted);padding:0 6px;">{{ currentSlide + 1 }}/{{ totalSlides }}</span>
      <div style="width:1px;height:16px;background:var(--border);"></div>
      <button class="ctrl-btn" @click="toggleTheme" title="Alternar Tema (T)">
        <svg v-if="currentTheme === 'dark'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        {{ currentTheme === 'dark' ? 'Claro' : 'Escuro' }}
      </button>
      <button class="ctrl-btn" @click="adjustFont(0.9)" title="Diminuir Fonte (-)">A-</button>
      <button class="ctrl-btn" @click="resetFont" title="Resetar Fonte">100%</button>
      <button class="ctrl-btn" @click="adjustFont(1.1)" title="Aumentar Fonte (+)">A+</button>
      <div style="width:1px;height:16px;background:var(--border);"></div>
      <button class="ctrl-btn" @click="toggleFullscreen" title="Tela Cheia (F)">⛶ Fullscreen</button>
    </div>
  </div>
</template>

<style scoped>
.marpnext-modal-root {
  --bg-app: #09090b;
  --bg-editor: #111113;
  --bg-preview: #0f0f12;
  --bg-slide: #16161d;
  --border: #27272a;
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #86868f;
  --accent: #818cf8;
  --accent-dim: rgba(129,140,248,0.12);
  --green: #34d399;
  --red: #f87171;
  --yellow: #fbbf24;
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --slide-w: 960px;
  --slide-h: 540px;
  --anim-duration: 0.5s;
  --anim-stagger: 0.1s;
  --radius: 10px;
  --topbar-h: 48px;
  font-family: var(--font-sans);
  color: var(--text-primary);
}

.marpnext-modal-root[data-theme="light"] {
  --bg-app: #f4f4f5;
  --bg-editor: #ffffff;
  --bg-preview: #e4e4e7;
  --bg-slide: #ffffff;
  --border: #d4d4d8;
  --text-primary: #18181b;
  --text-secondary: #52525b;
  --text-muted: #5c5c66;
  --accent: #4f46e5;
  --accent-dim: rgba(79,70,229,0.1);
}

#topbar {
  height: var(--topbar-h);
  display: flex; align-items: center; gap: 12px;
  padding: 0 16px;
  background: var(--bg-editor);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  z-index: 100;
}
#topbar .logo { font-weight:800; font-size:14px; color:var(--accent); letter-spacing:-0.5px; }
#topbar .logo span { color:var(--text-muted); font-weight:400; }
#topbar .sep { width:1px; height:20px; background:var(--border); }

.tb-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:5px;
  height: 32px; padding: 0 12px; border-radius:6px; border:1px solid var(--border);
  background:transparent; color:var(--text-secondary); font-size:12px; font-weight: 500;
  font-family:var(--font-sans); cursor:pointer; transition:all .15s;
  box-sizing: border-box; outline: none; white-space: nowrap; flex-shrink: 0;
}
.tb-btn:hover { background:var(--accent-dim); color:var(--accent); border-color:var(--accent); }
.tb-btn.active { background:var(--accent); color:#fff; border-color:var(--accent); }



.tb-input {
  height: 32px;
  padding: 0 12px;
  background: var(--bg-app);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 12px;
  font-family: var(--font-sans);
  border-radius: 6px;
  outline: none;
  transition: all .15s ease;
}
.tb-input::placeholder {
  color: var(--text-muted);
  opacity: 0.8;
}
.tb-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-dim);
}

#editor-pane {
  width: 42%; min-width: 320px;
  display:flex; flex-direction:column;
  background: var(--bg-editor);
  border-right: 1px solid var(--border);
  position: relative;
}

#editor-header {
  display:flex; align-items:center; justify-content:space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 11px; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.5px;
}

#resizer {
  width: 5px; cursor: col-resize; background: var(--border);
  transition: background .2s; flex-shrink:0;
}
#resizer:hover { background: var(--accent); }

#preview-pane {
  flex:1; overflow-y:auto; overflow-x:hidden;
  background: var(--bg-preview);
  scroll-snap-type: y mandatory;
  scroll-behavior: smooth;
  padding: 32px;
  display:flex; flex-direction:column; align-items:center; gap:32px;
}

/* FIND BAR */
#find-bar {
  background: var(--bg-editor);
  border-bottom: 1px solid var(--border);
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
  background: var(--bg-app); border: 1px solid var(--border); border-radius: 6px; padding: 2px 6px;
}
#find-input, #replace-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--text-primary); font-family: var(--font-mono); font-size: 12px; padding: 4px 6px;
}
#find-count { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); padding: 0 6px; white-space: nowrap; }
.find-option-btn {
  background: transparent; border: 1px solid transparent; color: var(--text-muted);
  font-family: var(--font-mono); font-size: 11px; font-weight: 700; padding: 2px 5px; border-radius: 4px; cursor: pointer;
}
.find-option-btn.active { background: var(--accent); color: #fff; }
.find-actions { display: flex; align-items: center; gap: 4px; }
.find-btn {
  display: inline-flex; align-items: center; justify-content: center; padding: 4px 8px;
  border-radius: 4px; border: 1px solid var(--border); background: transparent;
  color: var(--text-secondary); font-size: 11px; cursor: pointer;
}
.find-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 600; }
.tb-btn-xs {
  display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px;
  border-radius: 4px; border: 1px solid var(--border); background: transparent;
  color: var(--text-muted); font-size: 11px; cursor: pointer;
}

/* EXPORT DROPDOWN */
.export-menu {
  position: absolute; top: 100%; right: 0; margin-top: 4px;
  background: var(--bg-editor); border: 1px solid var(--border);
  border-radius: 6px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
  z-index: 100; min-width: 240px; padding: 4px 0;
}
.export-menu.theme-menu {
  min-width: 100%;
  white-space: nowrap;
}
.export-item {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px;
  border: none; background: transparent; color: var(--text-primary);
  font-size: 12px; cursor: pointer; text-align: left; transition: background 0.15s;
  white-space: nowrap;
}
.export-item:hover { background: var(--accent-dim); color: var(--accent); }
.export-item.active { background: var(--accent-dim); color: var(--accent); font-weight: 600; }

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
  resize: none; outline: none; background: transparent; color: var(--text-primary); overflow-y: scroll;
}
:deep(mark.find-match) {
  background-color: rgba(234, 179, 8, 0.35); color: transparent !important; border-radius: 2px;
  display: inline !important; padding: 0 !important; margin: 0 !important; font: inherit !important;
  outline: 1px solid rgba(234, 179, 8, 0.5);
}
:deep(mark.find-match.active) {
  background-color: rgba(129, 140, 248, 0.6); color: transparent !important; outline: 2px solid var(--accent);
}

/* SLIDES STYLING */
:deep(.slide) {
  width: var(--slide-w); max-width:100%; min-height: var(--slide-h);
  padding: 48px 56px; background: var(--bg-slide); border-radius: var(--radius);
  scroll-snap-align: center; position:relative; overflow:visible;
  box-shadow: 0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px var(--border); flex-shrink: 0;
}
:deep(.slide.active) { box-shadow: 0 8px 48px rgba(129,140,248,0.12), 0 0 0 2px var(--accent); }
:deep(.slide-number) { position:absolute; top:16px; right:20px; font-size:11px; color:var(--text-muted); font-weight:600; }
:deep(.slide-content) { width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; gap:1.2rem; }
:deep(.slide-content h1) { font-size: calc(2.8rem * var(--font-scale, 1)); font-weight:900; letter-spacing:-1px; line-height:1.1; }
:deep(.slide-content h2) { font-size: calc(2rem * var(--font-scale, 1)); font-weight:700; letter-spacing:-0.5px; }
:deep(.slide-content h3) { font-size: calc(1.4rem * var(--font-scale, 1)); font-weight:600; }
:deep(.slide-content p)  { font-size: calc(1.15rem * var(--font-scale, 1)); line-height:1.75; color:var(--text-secondary); }
:deep(.slide-content ul), :deep(.slide-content ol) { font-size: calc(1.1rem * var(--font-scale, 1)); line-height:1.8; padding-left:1.6rem; margin-bottom:0.8em; color:var(--text-secondary); list-style-position: outside; }
:deep(.slide-content ul ul), :deep(.slide-content ul ol), :deep(.slide-content ol ul), :deep(.slide-content ol ol) { font-size:0.95em; line-height:1.6; margin-top:0.3em; margin-bottom:0.3em; padding-left:1.4rem; }
:deep(.slide-content ul) { list-style-type: disc; }
:deep(.slide-content ul ul) { list-style-type: circle; }
:deep(.slide-content ul ul ul) { list-style-type: square; }
:deep(.slide-content ol) { list-style-type: decimal; }
:deep(.slide-content li::marker) { color:var(--accent); }
:deep(.slide-content strong) { color:var(--text-primary); }
:deep(.slide-content em) { color:var(--yellow); }
.marpnext-modal-root[data-theme="light"] :deep(.slide-content em) { color:#b45309; }
:deep(.slide-content blockquote) { border-left:3px solid var(--accent); padding-left:16px; color:var(--text-muted); font-style:italic; }
:deep(.slide-content hr) { border:none; height:1px; background:var(--border); margin:1rem 0; }
:deep(.slide-content img) { max-width:100%; border-radius:8px; }
:deep(.table-wrap) { margin: 1.2em 0; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
:deep(.slide-content table) { width:100%; border-collapse:collapse; font-size: calc(0.95rem * var(--font-scale, 1)); margin:0; }
:deep(.slide-content th), :deep(.slide-content td) { padding:10px 14px; border:1px solid var(--border); text-align:left; }
:deep(.slide-content th) { background:var(--accent-dim); font-weight:600; }
:deep(.slide-content tr:nth-child(even)) { background: rgba(255, 255, 255, 0.03); }
.marpnext-modal-root[data-theme="light"] :deep(.slide-content tr:nth-child(even)) { background: rgba(0, 0, 0, 0.03); }
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

#progress-bar { position:fixed; bottom:0; left:0; height:3px; background:linear-gradient(90deg, var(--accent), #a855f7); transition:width .3s; z-index:999; }
#status-bar { position:fixed; bottom:8px; right:16px; font-size:11px; color:var(--text-muted); font-family:var(--font-mono); z-index:999; }
.slide-count-text { font-size:11px; color:var(--text-muted); font-family:var(--font-mono); }

/* PRESENT MODE */
.present-mode #topbar, .present-mode #editor-pane, .present-mode #resizer { display:none !important; }
.present-mode #preview-pane { padding:0 !important; gap:0 !important; background:var(--bg-app); width:100vw; height:100vh; overflow:hidden; }
.present-mode :deep(.slide) {
  width:100vw!important; height:100vh!important; min-height:100vh!important;
  max-width:none!important; max-height:none!important; border-radius:0!important;
  box-shadow:none!important; border:none!important; padding:60px 80px!important; margin:0!important;
}

/* Floating Presentation Controls Overlay */
#controls-bar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 30px;
  padding: 6px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 1000;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  transition: opacity 0.3s ease, background 0.3s ease, border-color 0.3s ease;
}

.marpnext-modal-root[data-theme="light"] #controls-bar {
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 10px 30px rgba(0,0,0,0.12);
}

#controls-bar.idle {
  opacity: 0.15;
}
#controls-bar:hover, #controls-bar.idle:hover {
  opacity: 1;
}

.ctrl-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
}
.ctrl-btn:hover {
  background: var(--accent-dim);
  color: var(--accent);
  border-color: var(--accent);
}

@media print {
  .marpnext-modal-root { position: static !important; background: #fff !important; }
  #topbar, #editor-pane, #resizer, #progress-bar, #status-bar, #find-bar, #controls-bar { display: none !important; }
  #preview-pane { display: block !important; position: static !important; width: 100% !important; height: auto !important; overflow: visible !important; padding: 0 !important; gap: 0 !important; background: #fff !important; }
  .marpnext-modal-root.anim-mode :deep(.slide .slide-content > *) { opacity: 1 !important; animation: none !important; transition: none !important; }
  :deep(.slide) { page-break-after: always !important; break-after: page !important; position: relative !important; opacity: 1 !important; width: 100vw !important; height: 100vh !important; max-width: none !important; max-height: none !important; margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; transform: none !important; }
}
</style>
