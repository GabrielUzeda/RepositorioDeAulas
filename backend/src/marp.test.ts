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

    const htmlLight = generateMarpNextStandaloneHtml('Aula Mermaid Light', mdMermaid.replace('theme: default', 'theme: light'));
    expect(htmlLight).toContain('data-theme="light"');
    expect(htmlLight).toContain('mermaidThemeVars');

    const htmlDark = generateMarpNextStandaloneHtml('Aula Mermaid Dark', mdMermaid.replace('theme: default', 'theme: dark'));
    expect(htmlDark).toContain('data-theme="dark"');
    expect(htmlDark).toContain('mermaidThemeVars');
  });
});
