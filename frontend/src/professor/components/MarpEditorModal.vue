<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount, onMounted } from 'vue';

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
const charCountText = ref('0 chars');

// References
const previewPaneRef = ref<HTMLDivElement | null>(null);
const editorPaneRef = ref<HTMLDivElement | null>(null);
const editorRef = ref<HTMLTextAreaElement | null>(null);
const editorHighlightsRef = ref<HTMLDivElement | null>(null);
const editorBackdropRef = ref<HTMLDivElement | null>(null);
const progressBarRef = ref<HTMLDivElement | null>(null);
const statusBarRef = ref<HTMLDivElement | null>(null);

// UI Toggle States
const isPresentMode = ref(false);
const isAnimMode = ref(true);
const currentTheme = ref<'dark' | 'light'>('dark');
const showExportMenu = ref(false);
const showFindBar = ref(false);
const showReplaceRow = ref(false);
const isMatchCase = ref(false);
const isMatchRegex = ref(false);
const findCountText = ref('0/0');
const findQuery = ref('');
const replaceQuery = ref('');

// Internal Engine State
let currentSlide = 0;
let totalSlides = 0;
let renderTimer: any = null;
let scrollTimer: any = null;
let mermaidCounter = 0;
let mermaidReady = false;
let findMatches: Array<{ start: number; end: number }> = [];
let currentMatchIndex = -1;
let isResizing = false;

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
      logLevel: 'error',
      fontFamily: 'Inter, system-ui, sans-serif',
      flowchart: { useMaxWidth: true, htmlLabels: true, padding: 20, nodeSpacing: 50, rankSpacing: 60, curve: 'basis' },
      sequence: { useMaxWidth: true, actorMargin: 80, width: 200, noteMargin: 16, messageMargin: 40, wrap: true, wrapPadding: 16 },
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
  totalSlides = slides.length;
  slideCountText.value = `${totalSlides} slides`;
  charCountText.value = `${source.length} chars`;

  if (global.theme) {
    const normTheme = String(global.theme).trim().toLowerCase();
    if (normTheme === 'dark' || normTheme === 'light') {
      if (currentTheme.value !== normTheme) {
        applyTheme(normTheme as 'dark' | 'light', false);
      }
    }
  }

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

    const html = md ? md.render(slide.content) : `<p>${escapeHtml(slide.content)}</p>`;
    el.innerHTML = `
      <span class="slide-number">${i + 1}/${totalSlides}</span>
      <div class="slide-content">${html}</div>
    `;
    container.appendChild(el);
  });

  activateSlide(Math.min(currentSlide, totalSlides - 1));
  requestAnimationFrame(() => renderAllMermaid());
}

async function renderAllMermaid() {
  if (!mermaidReady) await waitForFonts();
  if (!previewPaneRef.value) return;

  const containers = previewPaneRef.value.querySelectorAll('.slide-content');
  containers.forEach(container => {
    const pres = container.querySelectorAll('pre');
    pres.forEach(pre => {
      const code = pre.querySelector('code');
      if (!code) return;

      const text = code.textContent?.trim() || '';
      const isMermaid =
        code.className.includes('mermaid') ||
        /^(graph|flowchart|sequence|classDiagram|stateDiagram|erDiagram|pie|gantt|journey|mindmap|timeline|quadrantChart)/m.test(text);

      if (!isMermaid) return;

      const id = `mmd-mn-${++mermaidCounter}`;
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-block';
      wrapper.dataset.mmdId = id;
      pre.replaceWith(wrapper);

      attemptRenderMermaid(wrapper, id, text, 0);
    });
  });
}

function attemptRenderMermaid(wrapper: HTMLElement, id: string, src: string, retries: number) {
  const w = window as any;
  if (!w.mermaid) return;
  w.mermaid.render(id, src).then(({ svg }: { svg: string }) => {
    wrapper.innerHTML = svg;
    fixSvgOverflow(wrapper);
  }).catch((err: any) => {
    if (retries < 2) {
      setTimeout(() => attemptRenderMermaid(wrapper, id, src, retries + 1), 200);
    } else {
      wrapper.innerHTML = `<div class="mermaid-error">⚠ Mermaid: ${err.message || 'Erro de renderização'}</div>`;
    }
  });
}

function fixSvgOverflow(container: HTMLElement) {
  const svg = container.querySelector('svg');
  if (!svg) return;

  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.width = '100%';
  svg.style.height = 'auto';

  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const [x, y, w, h] = vb.split(' ').map(Number);
    const pad = 12;
    svg.setAttribute('viewBox', `${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}`);
  }

  svg.style.overflow = 'visible';
  svg.querySelectorAll('g, foreignObject, text, rect, div').forEach((el: any) => {
    el.style.overflow = 'visible';
  });
}

function activateSlide(index: number) {
  if (totalSlides === 0) return;
  currentSlide = Math.max(0, Math.min(index, totalSlides - 1));
  if (!previewPaneRef.value) return;

  const slides = previewPaneRef.value.querySelectorAll('.slide');
  slides.forEach((s, i) => {
    s.classList.toggle('active', i === currentSlide);
  });

  const active = previewPaneRef.value.querySelector('.slide.active');
  if (active) active.scrollIntoView({ behavior: 'smooth', block: 'center' });
  updateProgress();
}

function nextSlide() { activateSlide(currentSlide + 1); }
function prevSlide() { activateSlide(currentSlide - 1); }

function updateProgress() {
  const pct = totalSlides > 0 ? ((currentSlide + 1) / totalSlides) * 100 : 0;
  if (progressBarRef.value) progressBarRef.value.style.width = pct + '%';
  if (statusBarRef.value) statusBarRef.value.textContent = `${currentSlide + 1} / ${totalSlides}`;
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

  const textBefore = textarea.value.substring(0, charIndex);
  const linesBefore = textBefore.split('\n').length - 1;
  const fontSize = 13;
  const lineHeight = fontSize * 1.7;
  const paddingTop = 20;

  const targetScrollTop = Math.max(0, (linesBefore * lineHeight) + paddingTop - 40);

  if (focusTarget) textarea.focus();
  textarea.setSelectionRange(charIndex, charIndex);
  textarea.scrollTop = targetScrollTop;

  if (!focusTarget && prevActive && prevActive !== textarea && typeof prevActive.focus === 'function') {
    prevActive.focus();
  }
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
        if (currentSlide !== i) {
          currentSlide = i;
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
  updateEditorHighlights();
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
      alert('Não foi possível carregar a biblioteca PptxGenJS.');
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
    markdownInput.value = props.markdown ?? draft ?? DEFAULT_MD;
    currentSlide = 0;
    renderSlides(markdownInput.value);
    nextTick(() => {
      if (editorRef.value) editorRef.value.focus();
    });
  }
);

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

// ─── Global API (4.7) ──────────────────────
onMounted(() => {
  setupAutoSave();
  const w = window as any;
  w.marpNext = {
    render: renderSlides,
    next: nextSlide,
    prev: prevSlide,
    goTo: activateSlide,
    exportHtml,
    exportPdf,
    exportPptx,
    get current() { return currentSlide; },
    get total() { return totalSlides; },
  };
});

onBeforeUnmount(() => {
  cleanupAutoSave();
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
      <div class="flex items-center space-x-2 flex-1 max-w-xl">
        <input
          v-model="titleInput"
          placeholder="Título da Aula"
          class="h-8 px-3 bg-slate-900 border border-slate-700 text-white text-xs font-semibold rounded outline-none focus:border-indigo-500 w-48 placeholder:text-slate-500"
        />
        <input
          v-model="descInput"
          placeholder="Descrição rápida da aula..."
          class="h-8 px-3 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded outline-none focus:border-indigo-500 flex-1 placeholder:text-slate-500"
        />
      </div>

      <div class="sep"></div>
      <button class="tb-btn" :class="{ active: isPresentMode }" @click="isPresentMode = !isPresentMode" title="Apresentar (F)">▶ Apresentar</button>
      <button class="tb-btn" :class="{ active: isAnimMode }" @click="isAnimMode = !isAnimMode" title="Toggle animações">✦ Anim</button>
      <button class="tb-btn" @click="toggleTheme" title="Toggle tema">◐ Tema</button>

      <select v-model="currentTheme" @change="applyTheme(currentTheme, true)" class="tb-btn" style="padding:4px 8px;font-size:11px;">
        <option value="dark">Dark</option>
        <option value="light">Light</option>
      </select>

      <!-- Export Dropdown -->
      <div class="export-dropdown relative">
        <button class="tb-btn" @click.stop="showExportMenu = !showExportMenu" title="Exportar Apresentação">📥 Exportar ▾</button>
        <div v-if="showExportMenu" class="export-menu">
          <button class="export-item" @click="exportHtml">🌐 HTML Autossuficiente (.html)</button>
          <button class="export-item" @click="exportPdf">📄 Documento PDF (.pdf)</button>
          <button class="export-item" @click="exportPptx">📊 Apresentação PowerPoint (.pptx)</button>
        </div>
      </div>

      <div class="flex-1"></div>
      <span class="slide-count-text">{{ slideCountText }}</span>

      <!-- Action Buttons -->
      <div class="flex items-center space-x-2 ml-4">
        <button @click="emit('close')" type="button" class="px-3 py-1.5 text-slate-400 hover:text-white text-xs font-medium rounded hover:bg-slate-800 transition">Cancelar</button>
        <button @click="handleSave" type="button" class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold shadow transition">Salvar Aula</button>
      </div>
    </div>

    <!-- MAIN SPLIT -->
    <div id="main" class="flex-1 flex overflow-hidden relative">
      <div id="editor-pane" ref="editorPaneRef">
        <div id="editor-header">
          <span>Markdown</span>
          <div class="flex items-center space-x-3">
            <button class="tb-btn-xs" @click="openFindBar(false)" title="Localizar e Substituir (Ctrl+F / Ctrl+H)">🔍 Localizar</button>
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
  display:inline-flex; align-items:center; gap:5px;
  padding: 5px 12px; border-radius:6px; border:1px solid var(--border);
  background:transparent; color:var(--text-secondary); font-size:12px;
  font-family:var(--font-sans); cursor:pointer; transition:all .15s;
}
.tb-btn:hover { background:var(--accent-dim); color:var(--accent); border-color:var(--accent); }
.tb-btn.active { background:var(--accent); color:#fff; border-color:var(--accent); }

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
.export-item {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px;
  border: none; background: transparent; color: var(--text-primary);
  font-size: 12px; cursor: pointer; text-align: left; transition: background 0.15s;
}
.export-item:hover { background: var(--accent-dim); color: var(--accent); }

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
:deep(.slide-content h1) { font-size:2.8rem; font-weight:900; letter-spacing:-1px; line-height:1.1; }
:deep(.slide-content h2) { font-size:2rem; font-weight:700; letter-spacing:-0.5px; }
:deep(.slide-content h3) { font-size:1.4rem; font-weight:600; }
:deep(.slide-content p)  { font-size:1.15rem; line-height:1.75; color:var(--text-secondary); }
:deep(.slide-content ul), :deep(.slide-content ol) { font-size:1.1rem; line-height:2; padding-left:1.4rem; color:var(--text-secondary); }
:deep(.slide-content li::marker) { color:var(--accent); }
:deep(.slide-content a) { color:var(--accent); text-decoration:none; }
:deep(.slide-content blockquote) { border-left:3px solid var(--accent); padding-left:16px; color:var(--text-muted); font-style:italic; }
:deep(.slide-content pre) { background:#0d1117; color:#e6edf3; padding:20px 24px; border-radius:8px; overflow-x:auto; font-size:0.85rem; line-height:1.65; font-family:var(--font-mono); }
:deep(.slide-content pre code) { background:none; color:inherit; padding:0; }
:deep(.slide-content table) { width:100%; border-collapse:collapse; font-size:0.95rem; }
:deep(.slide-content th), :deep(.slide-content td) { padding:10px 14px; border:1px solid var(--border); text-align:left; }
:deep(.slide-content th) { background:var(--accent-dim); font-weight:600; }
:deep(.slide.centered .slide-content) { align-items:center; text-align:center; }

/* MERMAID STYLING */
:deep(.mermaid-block) { display: flex; justify-content: center; overflow: visible !important; padding: 16px 0; }
:deep(.mermaid-block svg) { overflow: visible !important; max-width: 100%; }
:deep(.mermaid-error) { color: var(--red); font-family: var(--font-mono); font-size: 12px; white-space: pre-wrap; }
:deep(.mermaid-block p), :deep(.mermaid-block div), :deep(.mermaid-block span) { margin: 0 !important; padding: 0 !important; line-height: 1.25 !important; }
:deep(.mermaid-block foreignObject) { overflow: visible !important; }
:deep(.mermaid-block foreignObject div) { display: flex !important; align-items: center !important; justify-content: center !important; width: 100% !important; height: 100% !important; box-sizing: border-box !important; overflow: visible !important; white-space: nowrap !important; text-align: center !important; line-height: 1.25 !important; }

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

@media print {
  .marpnext-modal-root { position: static !important; background: #fff !important; }
  #topbar, #editor-pane, #resizer, #progress-bar, #status-bar, #find-bar { display: none !important; }
  #preview-pane { display: block !important; position: static !important; width: 100% !important; height: auto !important; overflow: visible !important; padding: 0 !important; gap: 0 !important; background: #fff !important; }
  .marpnext-modal-root.anim-mode :deep(.slide .slide-content > *) { opacity: 1 !important; animation: none !important; transition: none !important; }
  :deep(.slide) { page-break-after: always !important; break-after: page !important; position: relative !important; opacity: 1 !important; width: 100vw !important; height: 100vh !important; max-width: none !important; max-height: none !important; margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; transform: none !important; }
}
</style>
