import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { sanitizeSlug } from './utils';
import { THEME_LABELS, NEXT_THEME, normalizeTheme } from './marpTheme';

const MARP_THEME_CSS = readFileSync(path.join(import.meta.dir, 'marpTheme.css'), 'utf8');

export function resolveFrontendDir(): string {
  if (process.env.FRONTEND_STATIC_DIR) return process.env.FRONTEND_STATIC_DIR;
  if (existsSync('/app/frontend_static')) return '/app/frontend_static';
  return path.join(import.meta.dir, '..', '..', 'frontend', 'src');
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m] || m));
}

function extractFrontMatter(source: string) {
  const m = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { body: source, global: {} as Record<string, string> };
  const global: Record<string, string> = {};
  m[1].split('\n').forEach((l) => {
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
    match[1].split('\n').forEach((l) => {
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
    }),
  };
}

import MarkdownIt from 'markdown-it';

const mdParser = new MarkdownIt({ html: true, linkify: true, typographer: true });

function renderMarkdown(mdText: string): string {
  const html = mdParser.render(mdText);
  return html.replace(/<table>[\s\S]*?<\/table>/g, (tableHtml) => `<div class="table-wrap">${tableHtml}</div>`);
}

export function generateMarpNextStandaloneHtml(titulo: string, mdContent: string): string {
  const { slides, global } = parseSlides(mdContent);
  const docTitle = (global.title && String(global.title).trim()) ? String(global.title).trim() : (titulo || 'Apresentação — Marp Next');
  const initialTheme = normalizeTheme(global.theme);

  let slidesHtml = '';
  slides.forEach((slide, i) => {
    const cls = 'slide' + (slide.directives.class ? ' ' + escapeHtml(slide.directives.class) : '');
    const animAttr = slide.directives.animation ? `data-animation="${escapeHtml(slide.directives.animation)}"` : '';
    const staggerAttr = slide.directives['animation-stagger'] ? `data-anim-stagger="true"` : '';

    const styleParts: string[] = [];
    // [SEG] Valores de diretivas interpolados em atributos/estilo devem ser escapados
    // para evitar breakout de atributo (XSS armazenado em aulas servidas aos alunos).
    if (slide.directives.background) styleParts.push(`background:${escapeHtml(slide.directives.background)}`);
    if (slide.directives['animation-duration']) styleParts.push(`--anim-duration:${escapeHtml(slide.directives['animation-duration'])}`);
    if (slide.directives['animation-stagger']) styleParts.push(`--anim-stagger:${escapeHtml(slide.directives['animation-stagger'])}`);

    const styleAttr = styleParts.length > 0 ? `style="${styleParts.join(';')}"` : '';
    const rawHtml = renderMarkdown(slide.content);

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
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<style>
${MARP_THEME_CSS}
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --font-scale: 1;
  --anim-duration: 0.5s;
}

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

.slide-content h1 { font-size: calc(2.8em * var(--font-scale)); font-weight: 900; letter-spacing: -1px; line-height: 1.1; margin-bottom: 0.4em; }
.slide-content h2 { font-size: calc(2.0em * var(--font-scale)); font-weight: 700; letter-spacing: -0.5px; margin-bottom: 0.4em; }
.slide-content h3 { font-size: calc(1.4em * var(--font-scale)); font-weight: 600; margin-bottom: 0.4em; }
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

.slide-content ul, .slide-content ol {
  font-size: calc(1.1em * var(--font-scale));
  line-height: 1.8;
  padding-left: 1.6em;
  margin-bottom: 0.8em;
  color: var(--text-secondary);
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
  <span id="counter" class="slide-counter">${slides.length > 0 ? '1/' + slides.length : '0/0'}</span>
  <div class="divider"></div>
  <button class="ctrl-btn" id="btn-theme" title="Alternar Tema (T)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg></button>
  <button class="ctrl-btn" id="btn-font-dec" title="Diminuir Fonte (-)">A-</button>
  <button class="ctrl-btn" id="btn-font-reset" title="Resetar Fonte">100%</button>
  <button class="ctrl-btn" id="btn-font-inc" title="Aumentar Fonte (+)">A+</button>
  <div class="divider"></div>
  <button class="ctrl-btn" id="btn-fs" title="Tela Cheia (F)">⛶ Fullscreen</button>
  <div class="divider"></div>
  <span id="clock-display" class="clock-display" title="Hora Atual">00:00:00</span>
</div>

<script>
function updateClock() {
  const clockEl = document.getElementById('clock-display');
  if (clockEl) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    clockEl.textContent = \`\${hours}:\${minutes}:\${seconds}\`;
  }
}
setInterval(updateClock, 1000);
updateClock();

const sunSvg = \`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>\`;
const moonSvg = \`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>\`;

const themeLabels = ${JSON.stringify(THEME_LABELS)};
const themeNext = ${JSON.stringify(NEXT_THEME)};
const themeAliases = { 'high-contrast': 'default' };
function normalizeTheme(input) {
  if (themeAliases[input]) return themeAliases[input];
  if (input === 'dark' || input === 'light') return input;
  return 'default';
}

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
    const theme = normalizeTheme(themeName);
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      flowchart: { useMaxWidth: true, htmlLabels: true, padding: 20 },
      sequence: { useMaxWidth: true, wrap: true },
      themeVariables: {
        primaryColor: '#6366f1',
        primaryTextColor: theme === 'dark' ? '#f8fafc' : '#0f172a',
        lineColor: theme === 'dark' ? '#94a3b8' : '#475569',
        fontSize: '15px'
      }
    });
  }
}

function updateThemeUI(themeName) {
  const btn = document.getElementById('btn-theme');
  if (!btn) return;
  const theme = normalizeTheme(themeName);
  const icons = { default: sunSvg, dark: moonSvg, light: sunSvg };
  btn.innerHTML = (icons[theme] || sunSvg) + ' ' + (themeLabels[theme] || theme);
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
  const cur = normalizeTheme(document.documentElement.dataset.theme || 'default');
  const next = themeNext[cur] || 'default';
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
updateThemeUI('${initialTheme}');
initMermaid('${initialTheme}');
renderAllMermaid();
</script>
</body>
</html>`;
}

export function processMarpContent(
  materiaSlug: string,
  titulo: string,
  mdContent: string
): { caminho?: string; error?: string } {
  const slug = sanitizeSlug(titulo);
  if (materiaSlug.includes('/') || materiaSlug.includes('\\') || materiaSlug.includes('..')) {
    return { error: 'Invalid materia slug' };
  }
  const baseDir = path.join(resolveFrontendDir(), 'materias', materiaSlug, 'aulas');
  mkdirSync(baseDir, { recursive: true });

  const mdPath = path.join(baseDir, `${slug}.md`);
  const htmlPath = path.join(baseDir, `${slug}.html`);

  try {
    writeFileSync(mdPath, mdContent);
  } catch {
    return { error: 'Falha ao salvar o arquivo da aula no servidor.' };
  }

  try {
    const standaloneHtml = generateMarpNextStandaloneHtml(titulo, mdContent);
    writeFileSync(htmlPath, standaloneHtml);
  } catch {
    return { error: 'Falha ao gerar o HTML da aula.' };
  }

  if (!existsSync(htmlPath)) {
    return { error: 'MarpNext completed but HTML output file was not created.' };
  }

  return { caminho: `materias/${materiaSlug}/aulas/${slug}.html` };
}
