import { describe, expect, test } from 'bun:test';
import { generateMarpNextStandaloneHtml } from './marp';

describe('Marp Next Generator & Standalone Slide Engine', () => {
  test('Marp Standalone HTML: aspect-ratio 16:9, highlight.js, Font Awesome, mobile landscape modal, zoom/pan e delegação de eventos', () => {
    const md = `---
theme: dark
title: Aula Teste Marp
---

# Slide 1
:fa-rocket: Teste de Ícone Font Awesome
Conteudo do slide com texto e código:
\`\`\`js
const x = 42;
console.log(x);
\`\`\`

---

<!--
animation: fade-up
-->

# Slide 2

<button class="custom-btn">Botão Interativo</button>
`;
    const html = generateMarpNextStandaloneHtml('Aula Teste Marp', md);
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('highlight.min.js');
    expect(html).toContain('fontawesome-free');
    expect(html).toContain('fa-rocket');
    expect(html).toContain('id="landscape-modal"');
    expect(html).toContain('isInteractiveElement');
    expect(html).toContain('--c-code-bg');
    expect(html).toContain('width: 100vw;');
    expect(html).toContain('height: 100vh;');
    expect(html).toContain('safeNavigate');
    expect(html).toContain('id="btn-zoom"');
    expect(html).toContain('applySlideZoom');
    expect(html).toContain('translate3d');
    expect(html).toContain('00:00');
    expect(html).toContain('id="zoom-indicator-pill"');
    expect(html).toContain('1x');
    
    // Validar que os blocos de script compilam sem SyntaxError
    const allScripts = Array.from(html.matchAll(/<script(?![^>]*src=)>([\s\S]*?)<\/script>/g));
    expect(allScripts.length).toBeGreaterThan(0);
    for (const match of allScripts) {
      expect(() => new Function(match[1])).not.toThrow();
    }
  });

  test('Mermaid Theme: variáveis e suporte de temas para default, light e dark', () => {
    const mdMermaid = `---
theme: default
title: Aula com Diagramas Mermaid
---

# Slide com Mermaid
\`\`\`mermaid
flowchart TD
    A[Início] --> B{Decisão}
    B -- Sim --> C[Sucesso]
    B -- Não --> D[Erro]
\`\`\`
`;
    const htmlDefault = generateMarpNextStandaloneHtml('Aula Mermaid Default', mdMermaid);
    expect(htmlDefault).toContain('mermaidThemeVars');
    expect(htmlDefault).toContain('flowchart');
    expect(htmlDefault).toContain('mermaid-block');
    expect(htmlDefault).toContain('rx: 6px');
    expect(htmlDefault).toContain('mermaid-error');
    expect(htmlDefault).toContain('error-box');
    expect(htmlDefault).toContain('"fontSize":"16px"');

    const htmlLight = generateMarpNextStandaloneHtml('Aula Mermaid Light', mdMermaid.replace('theme: default', 'theme: light'));
    expect(htmlLight).toContain('data-theme="light"');
    expect(htmlLight).toContain('mermaidThemeVars');

    const htmlDark = generateMarpNextStandaloneHtml('Aula Mermaid Dark', mdMermaid.replace('theme: default', 'theme: dark'));
    expect(htmlDark).toContain('data-theme="dark"');
    expect(htmlDark).toContain('mermaidThemeVars');
  });

  const mdInterativo = `---
theme: default
title: Aula Hash
---

# Slide 1
:lucide-book-open: Conteúdo copiável do slide

---

# Slide 2
`;

  test('Marp Standalone HTML: deep-link por hash em cada slide', () => {
    const html = generateMarpNextStandaloneHtml('Aula Hash', mdInterativo);
    expect(html).toContain('id="slide-1"');
    expect(html).toContain('id="slide-2"');
    expect(html).toContain('slideIndexFromHash');
    expect(html).toContain('syncHashWithSlide');
    expect(html).toContain("addEventListener('hashchange'");
    expect(html).toContain('#slide-');
  });

  test('Marp Standalone HTML: permite selecionar e copiar o texto', () => {
    const html = generateMarpNextStandaloneHtml('Aula Hash', mdInterativo);
    expect(html).toContain('user-select: text');
    expect(html).toContain('-webkit-user-select: text');
  });

  test('Marp Standalone HTML: ícones Lucide', () => {
    const html = generateMarpNextStandaloneHtml('Aula Hash', mdInterativo);
    expect(html).toContain('lucide.min.js');
    expect(html).toContain('data-lucide="book-open"');
    expect(html).toContain('createIcons');
  });

  test('Marp Standalone HTML: zoom com clamp e foco incremental', () => {
    const html = generateMarpNextStandaloneHtml('Aula Hash', mdInterativo);
    expect(html).toContain('clampPan');
    expect(html).toContain('getZoomCenter');
    expect(html).toContain('touch-action: none');
    expect(html).toContain('(fx - cx) - (fx - cx - panX) * factor');
    expect(html).toContain('scheduleNav');
    expect(html).toContain('cancelPendingNav');
    expect(html).not.toContain('originX');
    expect(html).not.toContain('originY');

    const allScripts = Array.from(html.matchAll(/<script(?![^>]*src=)>([\s\S]*?)<\/script>/g));
    for (const match of allScripts) {
      expect(() => new Function(match[1])).not.toThrow();
    }
  });
});
