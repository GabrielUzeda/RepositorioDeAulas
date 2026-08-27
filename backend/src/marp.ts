import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { db } from './db';
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
  let html = mdParser.render(mdText);
  html = html.replace(/<table>[\s\S]*?<\/table>/g, (tableHtml) => `<div class="table-wrap">${tableHtml}</div>`);
  // Suporte a atalhos de ícones Font Awesome :fa-name:, :fas-name:, :fab-name:, :far-name:
  html = html.replace(/:fa([srb]?)-([a-z0-9-]+):/gi, (_m, type, name) => {
    const prefix = type.toLowerCase() === 'b' ? 'fa-brands' : type.toLowerCase() === 'r' ? 'fa-regular' : 'fa-solid';
    return `<i class="fa ${prefix} fa-${name}"></i>`;
  });
  html = html.replace(/:fa-([a-z0-9-]+):/gi, '<i class="fa fa-solid fa-$1"></i>');
  return html;
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
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/highlight.min.js"></script>
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
  touch-action: pan-y;
}

#slides-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  touch-action: pan-y;
}

.slide {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  box-sizing: border-box;
  background: var(--slide-bg);
  border: none;
  border-radius: 0;
  padding: 32px 48px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transform: scale(1);
  transition: opacity 0.4s ease;
  font-size: calc(16px * var(--font-scale, 1));
}

@media (max-width: 768px) {
  .slide {
    padding: 8px 12px !important;
  }
}

@media (max-width: 480px) {
  .slide {
    padding: 4px 6px !important;
  }
}

.slide.active {
  opacity: 1;
  pointer-events: auto;
  transform: scale(1);
  z-index: 10;
}

.slide.centered,
.slide.centered .slide-content {
  text-align: center;
}

.slide-content {
  width: 100%;
  max-width: 100%;
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

<div id="landscape-modal">
  <div class="landscape-modal-card">
    <div class="landscape-icon-wrapper">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
        <path d="M12 18h.01"/>
      </svg>
    </div>
    <h3>Modo Paisagem Recomendado</h3>
    <p>Para uma melhor experiência de visualização dos slides, por favor gire seu dispositivo para a posição horizontal (paisagem).</p>
    <button id="btn-confirm-landscape" type="button" class="landscape-btn-confirm">
      Entendido, Continuar
    </button>
  </div>
</div>

<div id="zoom-indicator-pill" class="zoom-indicator-pill">Zoom 1x</div>

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
  <div class="divider"></div>
  <button class="ctrl-btn" id="btn-zoom" title="Lupa / Zoom (Z)">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
    <span id="zoom-text">1x</span>
  </button>
  <div class="divider"></div>
  <span id="clock-display" class="clock-display" title="Hora Atual">00:00</span>
  <div class="divider"></div>
  <button class="ctrl-btn" id="btn-font-dec" title="Diminuir Fonte (-)">A-</button>
  <button class="ctrl-btn" id="btn-font-reset" title="Resetar Fonte">100%</button>
  <button class="ctrl-btn" id="btn-font-inc" title="Aumentar Fonte (+)">A+</button>
  <div class="divider"></div>
  <button class="ctrl-btn" id="btn-fs" title="Tela Cheia (F)">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
    Fullscreen
  </button>
</div>

<script>
function updateClock() {
  const clockEl = document.getElementById('clock-display');
  if (clockEl) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    clockEl.textContent = \`\${hours}:\${minutes}\`;
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

function renderAllCodeHighlight() {
  if (!window.hljs) return;
  document.querySelectorAll('.slide-content pre code').forEach(block => {
    if (block.closest('.mermaid-block') || block.classList.contains('mermaid')) return;
    window.hljs.highlightElement(block);
  });
}

function activateSlide(idx) {
  if (totalSlides === 0) return;
  resetZoom();
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
        wrapper.innerHTML = '<div style="color:#ef4444;font-size:12px;">[Erro] Mermaid: ' + err.message + '</div>';
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
  renderAllCodeHighlight();
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

document.getElementById('btn-fs').addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      if (screen.orientation && typeof screen.orientation.lock === 'function') {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } else {
      await document.exitFullscreen();
      if (screen.orientation && typeof screen.orientation.unlock === 'function') {
        screen.orientation.unlock();
      }
    }
  } catch (_err) {}
});

// Keyboard Hotkeys
document.addEventListener('keydown', e => {
  const target = e.target;
  if (
    target &&
    (target.tagName === 'INPUT' ||
     target.tagName === 'TEXTAREA' ||
     target.tagName === 'SELECT' ||
     target.isContentEditable ||
     (typeof target.closest === 'function' && target.closest('[contenteditable="true"], input, textarea, select, #landscape-modal')))
  ) {
    return;
  }

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
    case 'z': case 'Z':
      toggleZoom(); break;
    case '+': case '=':
      adjustFont(1.1); break;
    case '-': case '_':
      adjustFont(0.9); break;
  }
});

// Controls auto-hide & toggle
let idleTimer;
let lastTouchTime = 0;
let lastMouseX = window.innerWidth / 2;
let lastMouseY = window.innerHeight / 2;
let isMousePanning = false;
const controls = document.getElementById('controls-bar');

function toggleControlsBar() {
  clearTimeout(idleTimer);
  const isCurrentlyIdle = controls.classList.contains('idle');
  if (isCurrentlyIdle) {
    controls.classList.remove('idle');
    idleTimer = setTimeout(() => controls.classList.add('idle'), 2500);
  } else {
    controls.classList.add('idle');
  }
}

document.addEventListener('mousemove', (e) => {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  if (isMousePanning && currentZoom > 1.05) {
    const dx = e.clientX - panStartX;
    const dy = e.clientY - panStartY;
    panX += dx;
    panY += dy;
    panStartX = e.clientX;
    panStartY = e.clientY;
    applySlideZoom();
    return;
  }

  if (Date.now() - lastTouchTime < 1000) return;
  if (e.movementX === 0 && e.movementY === 0) return;
  controls.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => controls.classList.add('idle'), 2500);
});

// Zoom & Pan System (1x, 2x, 3x, 4x)
let currentZoom = 1.0;
let panX = 0;
let panY = 0;
let originX = 50;
let originY = 50;
let initialPinchDistance = 0;
let initialZoom = 1.0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let lastTapTime = 0;
let zoomPillTimer = null;

function showZoomPill(text) {
  const pill = document.getElementById('zoom-indicator-pill');
  if (!pill) return;
  pill.textContent = text;
  pill.classList.add('show');
  clearTimeout(zoomPillTimer);
  zoomPillTimer = setTimeout(() => {
    pill.classList.remove('show');
  }, 1200);
}

function updateZoomUI() {
  const zoomText = document.getElementById('zoom-text');
  const levelStr = currentZoom <= 1.01 ? '1x' : (Number.isInteger(currentZoom) ? currentZoom + 'x' : currentZoom.toFixed(1) + 'x');
  if (zoomText) {
    zoomText.textContent = levelStr;
  }
  showZoomPill(levelStr);
}

function applySlideZoom() {
  const activeSlide = document.querySelector('.slide.active');
  if (!activeSlide) return;
  if (currentZoom <= 1.01) {
    currentZoom = 1.0;
    panX = 0;
    panY = 0;
    activeSlide.style.transform = '';
    activeSlide.style.transformOrigin = 'center center';
    if (slidesContainer) slidesContainer.style.cursor = '';
  } else {
    activeSlide.style.transformOrigin = 'center center';
    activeSlide.style.transform = \`translate3d(\${panX}px, \${panY}px, 0) scale(\${currentZoom})\`;
    if (slidesContainer) slidesContainer.style.cursor = isMousePanning ? 'grabbing' : 'grab';
  }
  updateZoomUI();
}

function resetZoom() {
  currentZoom = 1.0;
  panX = 0;
  panY = 0;
  initialPinchDistance = 0;
  isPanning = false;
  isMousePanning = false;
  document.querySelectorAll('.slide').forEach(s => {
    s.style.transform = '';
    s.style.transformOrigin = 'center center';
  });
  if (slidesContainer) slidesContainer.style.cursor = '';
  const zoomText = document.getElementById('zoom-text');
  if (zoomText) zoomText.textContent = '1x';
}

function toggleZoom(focalX, focalY) {
  if (focalX === undefined && focalY === undefined) {
    focalX = lastMouseX;
    focalY = lastMouseY;
  }

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const fx = (focalX !== undefined && !isNaN(focalX)) ? focalX : cx;
  const fy = (focalY !== undefined && !isNaN(focalY)) ? focalY : cy;

  let nextZoom = 1.0;
  if (currentZoom < 1.9) {
    nextZoom = 2.0;
  } else if (currentZoom < 2.9) {
    nextZoom = 3.0;
  } else if (currentZoom < 3.9) {
    nextZoom = 4.0;
  } else {
    resetZoom();
    return;
  }

  panX = (cx - fx) * (nextZoom - 1);
  panY = (cy - fy) * (nextZoom - 1);
  currentZoom = nextZoom;
  applySlideZoom();
}

const btnZoom = document.getElementById('btn-zoom');
if (btnZoom) {
  btnZoom.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleZoom();
  });
}

// Robust Event Delegation & Gestures
function isInteractiveElement(target) {
  if (!target || target === document.body || target === document.documentElement) return false;
  const interactive = target.closest(
    'button, a, input, textarea, select, option, details, summary, label, form, ' +
    '[contenteditable="true"], [contenteditable], [tabindex], [role="button"], [role="link"], [role="checkbox"], ' +
    '[role="slider"], [role="textbox"], [role="switch"], [data-interactive], .interactive, ' +
    '[draggable="true"], [draggable], [onclick], [onmousedown], [onmouseup], [ontouchstart], [ontouchend], ' +
    'canvas, audio, video, iframe, embed, object, svg, pre, code, kbd, samp, ' +
    '#controls-bar, #controls-bar *, #landscape-modal, #landscape-modal *'
  );
  if (interactive) return true;

  try {
    const style = window.getComputedStyle(target);
    if (style.cursor === 'pointer' || style.cursor === 'grab' || style.cursor === 'grabbing' || style.cursor === 'text') {
      if (!target.classList.contains('slide') && !target.classList.contains('slide-content') && target.id !== 'slides-container') {
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

function safeNavigate(delta) {
  const now = Date.now();
  if (now - lastNavTime < NAV_COOLDOWN_MS) return;
  lastNavTime = now;
  activateSlide(currentSlide + delta);
}

const slidesContainer = document.getElementById('slides-container') || document.body;

function handlePointerStart(e) {
  if (isInteractiveElement(e.target)) return;
  isPointerActive = true;
  startX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
  startY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
  startTime = Date.now();
  if (currentZoom > 1.05) {
    isMousePanning = true;
    panStartX = startX;
    panStartY = startY;
  }
}

function handlePointerEnd(e) {
  isMousePanning = false;
  if (!isPointerActive) return;
  isPointerActive = false;
  const endX = e.clientX !== undefined ? e.clientX : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : startX);
  const endY = e.clientY !== undefined ? e.clientY : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : startY);
  const diffX = endX - startX;
  const diffY = endY - startY;
  const dt = Date.now() - startTime;

  if (currentZoom > 1.05) {
    return;
  }

  // Gesto de Arrastar/Swipe Horizontal (>30px horizontal, movimento dominante horizontal e tempo < 1200ms)
  if (Math.abs(diffX) > 30 && Math.abs(diffX) > Math.abs(diffY) * 1.1 && dt < 1200) {
    if (diffX < 0) {
      safeNavigate(1);  // Swipe para a esquerda -> próximo slide
    } else {
      safeNavigate(-1); // Swipe para a direita -> slide anterior
    }
    return;
  }

  // Clique simples em áreas livres (movimento < 12px, tempo < 500ms e sem seleção de texto)
  if (Math.abs(diffX) < 12 && Math.abs(diffY) < 12 && dt < 500) {
    const sel = window.getSelection ? window.getSelection().toString() : '';
    if (sel && sel.length > 0) return;

    const vw = window.innerWidth;
    if (startX < vw * 0.25) {
      safeNavigate(-1); // Clique na lateral esquerda -> slide anterior
    } else if (startX > vw * 0.75) {
      safeNavigate(1);  // Clique na lateral direita -> próximo slide
    } else {
      toggleControlsBar(); // Clique ao centro -> oculta/exibe barra de controles
    }
  }
}

function handlePointerCancel() {
  isPointerActive = false;
  isPanning = false;
  isMousePanning = false;
}

function handleTouchStart(e) {
  lastTouchTime = Date.now();
  if (isInteractiveElement(e.target)) return;
  if (!e.touches) return;

  // Gesto de Pinça com 2 dedos
  if (e.touches.length === 2) {
    isPointerActive = false;
    isPanning = false;
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    originX = Math.round((midX / window.innerWidth) * 100);
    originY = Math.round((midY / window.innerHeight) * 100);
    initialPinchDistance = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    initialZoom = currentZoom;
    return;
  }

  if (e.touches.length === 1) {
    isPointerActive = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
    if (currentZoom > 1.05) {
      isPanning = true;
      panStartX = e.touches[0].clientX;
      panStartY = e.touches[0].clientY;
    }
  }
}

function handleTouchMove(e) {
  lastTouchTime = Date.now();
  if (isInteractiveElement(e.target)) return;
  if (!e.touches) return;

  // Pinch-to-zoom com 2 dedos
  if (e.touches.length === 2 && initialPinchDistance > 0) {
    if (e.cancelable) e.preventDefault();
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const currentDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const factor = currentDist / Math.max(initialPinchDistance, 1);
    const oldZoom = currentZoom;
    const newZoom = Math.min(Math.max(initialZoom * factor, 1.0), 4.0);
    if (newZoom <= 1.01) {
      resetZoom();
      return;
    }
    const scaleRatio = newZoom / oldZoom;
    panX = (midX - cx) - (midX - cx - panX) * scaleRatio;
    panY = (midY - cy) - (midY - cy - panY) * scaleRatio;
    currentZoom = newZoom;
    applySlideZoom();
    return;
  }

  // Pan quando zoom ativo
  if (e.touches.length === 1 && currentZoom > 1.05 && isPanning) {
    if (e.cancelable) e.preventDefault();
    const dx = e.touches[0].clientX - panStartX;
    const dy = e.touches[0].clientY - panStartY;
    panX += dx;
    panY += dy;
    panStartX = e.touches[0].clientX;
    panStartY = e.touches[0].clientY;
    applySlideZoom();
  }
}

function handleTouchEnd(e) {
  lastTouchTime = Date.now();
  if (e.touches && e.touches.length > 0) {
    if (e.touches.length === 1) {
      panStartX = e.touches[0].clientX;
      panStartY = e.touches[0].clientY;
    }
    return;
  }

  initialPinchDistance = 0;
  isPanning = false;

  if (currentZoom > 1.05) {
    // Quando com zoom ativo, não navega slides com swipe acidental
    return;
  }

  if (!isPointerActive) return;
  isPointerActive = false;
  const touch = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
  if (!touch) return;
  const endX = touch.clientX;
  const endY = touch.clientY;
  const diffX = endX - startX;
  const diffY = endY - startY;
  const dt = Date.now() - startTime;

  // Gesto de Arrastar/Swipe Horizontal (>30px horizontal e tempo < 1200ms)
  if (Math.abs(diffX) > 30 && Math.abs(diffX) > Math.abs(diffY) * 0.9 && dt < 1200) {
    if (diffX < 0) {
      safeNavigate(1);  // Swipe para a esquerda -> próximo slide
    } else {
      safeNavigate(-1); // Swipe para a direita -> slide anterior
    }
    return;
  }

  // Toque simples em áreas livres
  if (Math.abs(diffX) < 15 && Math.abs(diffY) < 15 && dt < 500) {
    const now = Date.now();
    // Duplo toque para alternar zoom na posição tocada (ponto focal)
    if (now - lastTapTime < 320) {
      toggleZoom(endX, endY);
      lastTapTime = 0;
      return;
    }
    lastTapTime = now;

    const vw = window.innerWidth;
    if (startX < vw * 0.25) {
      safeNavigate(-1);
    } else if (startX > vw * 0.75) {
      safeNavigate(1);
    } else {
      toggleControlsBar(); // Clique/toque ao centro -> oculta/exibe controles
    }
  }
}

// Suporte simultâneo a Touch e Pointer
slidesContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
slidesContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
window.addEventListener('touchend', handleTouchEnd, { passive: true });
window.addEventListener('touchcancel', handlePointerCancel, { passive: true });

slidesContainer.addEventListener('dblclick', (e) => {
  if (isInteractiveElement(e.target)) return;
  toggleZoom(e.clientX, e.clientY);
});

window.addEventListener('wheel', (e) => {
  if (e.ctrlKey) {
    if (e.cancelable) e.preventDefault();
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const fx = e.clientX;
    const fy = e.clientY;
    const delta = -e.deltaY * 0.01;
    const oldZoom = currentZoom;
    const newZoom = Math.min(Math.max(currentZoom + delta, 1.0), 4.0);
    if (newZoom <= 1.01) {
      resetZoom();
      return;
    }
    const factor = newZoom / oldZoom;
    panX = (fx - cx) - (fx - cx - panX) * factor;
    panY = (fy - cy) - (fy - cy - panY) * factor;
    currentZoom = newZoom;
    applySlideZoom();
  }
}, { passive: false });

if (window.PointerEvent) {
  slidesContainer.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return; // Evita duplicidade com TouchEvent
    handlePointerStart(e);
  }, { passive: true });
  window.addEventListener('pointerup', e => {
    if (e.pointerType === 'touch') return;
    handlePointerEnd(e);
  }, { passive: true });
  window.addEventListener('pointercancel', handlePointerCancel, { passive: true });
} else {
  slidesContainer.addEventListener('mousedown', handlePointerStart, { passive: true });
  window.addEventListener('mouseup', handlePointerEnd, { passive: true });
}
window.addEventListener('dragstart', handlePointerCancel, { passive: true });

const btnConfirmLandscape = document.getElementById('btn-confirm-landscape');
if (btnConfirmLandscape) {
  btnConfirmLandscape.addEventListener('click', (e) => {
    e.stopPropagation();
    const modal = document.getElementById('landscape-modal');
    if (modal) {
      modal.classList.add('dismissed');
      modal.style.display = 'none';
    }
  });
}

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
    if (!container.innerHTML.includes('$')) return;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.includes('$')) {
        if (node.parentElement && node.parentElement.closest('pre, code, script, style')) continue;
        textNodes.push(node);
      }
    }
    textNodes.forEach(textNode => {
      const text = textNode.nodeValue;
      if (!text) return;
      if (/\\$\\$[\\s\\S]+?\\$\\$|\\$[^\\$\\n]+?\\$/.test(text)) {
        const span = document.createElement('span');
        span.innerHTML = text
          .replace(/\\$\\$([\\s\\S]+?)\\$\\$/g, (_, math) => {
            try { return window.katex.renderToString(math.trim(), { displayMode: true, throwOnError: false }); }
            catch (e) { return '$$' + math + '$$'; }
          })
          .replace(/(^|[^\\\\])\\$([^\\$\\n]+?)\\$/g, (_, prefix, math) => {
            try { return prefix + window.katex.renderToString(math.trim(), { displayMode: false, throwOnError: false }); }
            catch (e) { return prefix + '$' + math + '$'; }
          });
        textNode.parentNode && textNode.parentNode.replaceChild(span, textNode);
      }
    });
  });
}

activateSlide(0);
renderAllKaTeX();
renderAllCodeHighlight();
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

export function regenerateAllAulasHtml(): number {
  try {
    const aulas = db.query(`
      SELECT a.id, a.titulo, a.conteudo_md, d.slug as materia_slug 
      FROM aulas a 
      JOIN disciplinas d ON a.disciplina_id = d.id
    `).all() as Array<{ id: number; titulo: string; conteudo_md: string; materia_slug: string }>;

    let count = 0;
    for (const aula of aulas) {
      if (aula.conteudo_md && aula.materia_slug) {
        processMarpContent(aula.materia_slug, aula.titulo, aula.conteudo_md);
        count++;
      }
    }
    return count;
  } catch (err) {
    console.error('[marp] Falha ao sincronizar HTML das aulas:', err);
    return 0;
  }
}
