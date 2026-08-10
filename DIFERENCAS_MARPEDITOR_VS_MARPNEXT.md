# Diferenças: Editor de Aulas (RepositorioDeAulas_new) vs marpnext

Comparação entre o editor de aulas Marp deste repositório (Vue 3 + backend Hono/Bun) e o
`/home/gsuzeda/Projects/EFG/marpnext/index.html` (single-file, markdown-it + mermaid, sem build).

Data: 2026-08-10

---

## 1. Resumo executivo

- A reimplementação Vue (`MarpEditorModal.vue`, 1470 linhas) portou **quase todo o motor**
  do original: parse de frontmatter/diretivas, render de slides com markdown-it, mermaid com
  retry/`fixSvgOverflow`, navegação (teclado, clique, scroll), find & replace, resizer,
  `generateStandaloneHtml` com as 13 animações e export PPTX via PptxGenJS.
- Porém a **integração no app está quebrada**: o `MarpEditorModal` emite `save`, mas o
  `ProfessorView.vue` escuta `@submit`; e é passada a prop `:aula` (que não existe no modal),
  em vez de `:markdown`/`:titulo`/`:descricao`. **Salvar aula e editar aula existente não
  funcionam** (ver seção 3).
- O port Vue omitiu ou regrediu vários recursos do original: tema claro, `@media print`,
  auto-save (`localStorage`), API global `window.marpNext`, e um decorrer de apresentação que
  expõe os 13 presets no preview.
- O backend (`backend/src/marp.ts`) introduziu um pipeline **novo** que não existia no original:
  gera o HTML estático do aluno com um renderer markdown **caseiro** (`simpleMarkdownToHtml`)
  que **degrada** tabelas, listas ordenadas, imagens, `hr`, strikethrough e agrupamento de
  parágrafos, divergindo do preview que o professor vê (que usa markdown-it real).

---

## 2. Funcionalidades portadas com êxito (1:1)

| Recurso original (marpnext) | Status no RepositorioDeAulas_new |
|---|---|
| Parse de frontmatter (tema, título, animação, stagger) | Portado idêntico (`extractFrontMatter`) |
| Diretivas por slide (`animation`, `class`, `background`) | Portado idêntico (`parseDirectives`) |
| Separador de slides `---`/`***`/`<!-- break -->` | Portado idêntico |
| Render via markdown-it (`html`, `linkify`, `typographer`) | Portado (`getMarkdownIt`) |
| Mermaid com `startOnLoad:false`, retry x3, `fixSvgOverflow` | Portado idêntico |
| Sleep do `waitForFonts` (Inter/JetBrains Mono) | Portado (mas sem setar `fontFamily` no init — ver 4.4) |
| Navegação: setas, espaço, PageUp/Down, Home/End, `F` apresentar | Portado (`onGlobalKeyDown`) |
| Clique no slide → sincroniza editor (`scrollToCharIndex`) | Portado (com métricas hardcoded, ver 4.3) |
| Scroll do preview → sincroniza slide ativo | Portado |
| Find & Replace (case/regex, highlight no backdrop) | Portado |
| Resizer 20–75% | Portado |
| Export HTML autossuficiente, PDF (`window.print`), PPTX (PptxGenJS) | Portado |
| `emoji`/tabela de animações no template demo | Portado |

---

## 3. Problemas de integração (CRÍTICOS)

### 3.1 `MarpEditorModal` — prop/event mismatch (não salva, não edita)

- `MarpEditorModal.vue` define: props `show | titulo | descricao | markdown` (linhas 4–9) e
  emits `'close' | 'save'` (linhas 11–14). Em `handleSave()` emite `'save'` (linha 1117).
- `ProfessorView.vue` (linhas 386–391):
  ```html
  <MarpEditorModal
    :show="showMarpModal"
    :aula="editingAula"          <!-- prop INEXISTENTE no modal -->
    @close="showMarpModal = false"
    @submit="handleSaveMarpAula" <!-- evento INEXISTENTE (o modal emite 'save') -->
  />
  ```
- Consequências:
  1. **`handleSaveMarpAula` nunca é chamado** — o clique em "Salvar Aula" emite `'save'`,
     que ninguém escuta. Não faz POST nem PUT. Salvar não funciona.
  2. **Edição não carrega o conteúdo** — ao abrir para editar, `editingAula` (com
     `titulo`, `descricao`, `conteudo_md`) é passado como prop `aula` (órfã). O `watch(props.show)`
     inicializa `markdownInput = props.markdown || DEFAULT_MD` → como `markdown` fica
     `undefined`, o professor vê o **template demo** em vez da aula salva.
  3. O campo `conteudo_md` do tipo `Aula` (shared/types) não é mapeado para a prop `markdown`.
- Correção sugerida:
  ```html
  <MarpEditorModal
    :show="showMarpModal"
    :titulo="editingAula?.titulo"
    :descricao="editingAula?.descricao"
    :markdown="editingAula?.conteudo_md"
    @close="showMarpModal = false"
    @save="handleSaveMarpAula"
  />
  ```

### 3.2 `JsonActivityEditorModal` — mesmo mismatch

- `JsonActivityEditorModal.vue` emite `'save'` (linha 115) e `'close'`.
- `ProfessorView.vue` (linhas 393–398) usa `@submit="handleSaveActivity"`.
- **`handleSaveActivity` nunca é chamado** — salvar/editar atividade também está quebrado.
  (O `DisciplinaFormModal` funciona porque emite `'submit'` corretamente.)

### 3.3 Caminho gerado pelo backend (relativo vs absoluto)

- `processMarpContent` retorna `materias/<slug>/aulas/<slug>.html` **sem barra inicial**.
- `AlunoView.handleOpenAula` faz `window.open(aula.caminho, '_blank')`. A rota do aluno é `/`,
  então resolve para `/materias/...` corretamente (funciona hoje; sujeito a regressão se a
  rota do app mudar para um path aninhado).

### 3.4 Orfãos em disco ao atualizar/remover aula

- Novo `processMarpContent` grava `<slug>.md` e `<slug>.html`; ao **renomear** o título o
  slug muda → arquivo novo, o antigo **fica órfão** em `frontend/src/materias/...`.
- `DELETE /aulas` (routes.ts) remove só o registro do banco — **não apaga** o HTML/MD gerado.

---

## 4. Funções alteradas / trechos omitidos

### 4.1 Render do HTML do aluno: markdown-it foi SUBSTITUÍDO por renderer caseiro

- Original: `generateStandaloneHtml` usa `md.render()` (markdown-it full) → tabelas, listas
  ordenadas, imagens, html inline, `hr`, etc. funcionam.
- RepositorioDeAulas_new backend `backend/src/marp.ts` (`simpleMarkdownToHtml`): só suporta
  `#`/`##`/`###`, bullets `-`, blockquote `>`, ` ``` ` code, parágrafos; inline:
  `**bold**`, `*italic*`, `` `code` ``, `[link](url)`.
- **O que degrada/queima no HTML que o aluno vê** (`/materias/*`):
  - Tabelas markdown `| a | b |` → viram `<p>` soltos.
  - Listas numeradas `1.` → perdem numeração.
  - `<img>`/`![alt](url)` → o regex de link casa e vira `<a>` (imagem vira link).
  - Listas aninhadas, `hr`, headers `####+`, `~~strikethrough~~`, HTML passthrough.
  - Parágrafos: cada linha vira um `<p>` isolado (sem agrupamento).
- Divergência professor vs aluno: o preview do professor (markdown-it) mostra conteúdo rico
  que o aluno nunca vê. **Recomendação: trocar por markdown-it no backend** (já disponível via
  CDN ou bundle) ou portar `generateStandaloneHtml` do modal para o backend.

### 4.2 Dois geradores standalone divergentes

- O modal tem `generateStandaloneHtml` (markdown-it, 13 animações, botões de fonte/tema/FS).
- O backend tem outro HTML standalone (simpleMarkdownToHtml). São **duas implementações** do
  mesmo conceito com capacidades diferentes → manter só uma (idealmente via utils compartilhado).

### 4.3 `scrollToCharIndex` com métricas hardcoded

- Original: `getComputedStyle(editor)` para `fontSize`, `lineHeight`, `paddingTop`.
- Vue: hardcoded `fontSize=13`, `lineHeight=13*1.7`, `paddingTop=20`. Se o CSS do editor
  mudar, a rolagem/posição do cursor fica desalinhada (regressão menor).

### 4.4 `initMermaid` não define `fontFamily`

- Original seta `fontFamily:'Inter, system-ui, sans-serif'` em `applyTheme`/`init`.
- Vue: `initMermaid` NÃO passa `fontFamily` em nenhum ponto → mermaid renderiza com fonte
  padrão, divergindo do visual original. (O standalone do modal também não seta.)

### 4.5 `applyTheme` sem `execCommand`/undo

- Original: `applyTheme` (bg do editor) usava `document.execCommand('insertText', ...)` para
  preservar undo/redo. Vue: define `markdownInput.value` direto → perde histórico de undo ao
  trocar tema.

### 4.6 CSS do modal incompleto vs original

- **Sem `@media print`**: `exportarPDF` no modal = `window.print()`, mas sem as regras de
  print (esconder UI, page-break por slide) que o original tinha → PDF sai com a UI do editor
  e sem quebras de página por slide.
- **Sem tema claro no modal**: o bloco `[data-theme="light"]` existe (linha 798), mas só
  dentro da string de `generateStandaloneHtml()` (template do export), **não** no `<style
  scoped>` do modal; além disso a div raiz (linha 1126) não tem `:data-theme="currentTheme"`.
  Na prática `applyTheme('light')` troca o ref/atributo interno mas o preview/editor continuam
  dark. (O `#sel-theme` até existe, mas não muda o visual.)
- **Só 5 regras de animação no preview**: existem `@keyframes anim-fade`, `anim-fade-up`,
  `anim-fade-down`, `anim-zoom-in`, `anim-flip-y`, `anim-bounce-in` (linhas 1445–1450), mas as
  regras seletoras `[data-animation=...]` (linhas 1452–1456) só cobrem `fade`, `fade-up`,
  `zoom-in`, `flip-y` e `bounce-in`. Faltam ainda as regras (e onde aplicável os keyframes)
  para `fade-down`, `fade-left`, `fade-right`, `slide-up`, `zoom-out`, `flip-x`, `blur-in` e
  `elastic`. Slides com esses presets ficam **sem animação** no preview (no standalone todas as
  13 estão lá — mais uma divergência preview vs export).
- **`✦ Anim` não desativa animation**: regra
  `.marpnext-modal-root:not(.present-mode) :deep(.slide:not(.active) .slide-content > *) { opacity: 1 }`
  desliga o efeito por padrão no preview, e o toggle `isAnimMode` não alterna classe CSS —
  o botão "Anim" não tem efeito real (no original, `anim-mode` no body controla o stagger/anims).

### 4.7 Recursos originais NÃO portados

| Recurso original | Onde/situação |
|---|---|
| Auto-save `localStorage` a cada 2s (`marp-next-content`) | Não portado — rascunho não sobrevive a reload. |
| API pública `window.marpNext` (render, next, prev, goTo, export*, current/total) | Não portado. |
| Log "marp-next editor & presenter ready" | Não portado (cosmético). |
| Controles de fonte (A+, A–, reset) no export HTML | Portado: `adjustFont`/`applyFontScale` via `--font-scale` (linhas 952–956) com `+`/`-` no teclado. OK. |
| `#slide-count`/`#char-count` no topo do standalone | Portado no modal (chars/slides), OK. |
| KaTeX (CSS+JS carregado) | Carregado em ambos, **nunca invocado** em nenhum dos dois (morto / dead code — herança do original). |

### 4.8 Trecho omitido: sincronização por rolagem do preview

- Original: debounce de 80ms no scroll do preview para calcular slide ativo via `offsetTop`.
- Vue: `handlePreviewScroll` existe (mesma lógica). OK — mantido. (Item mantido para não
  gerar falso positivo.)

### 4.9 Regressão no foco de `scrollToCharIndex`

- Original (`marpnext/index.html` 1111–1120): quando `focusTarget = false`, captura
  `document.activeElement` e, após rolar/focar, **restaura o foco** no elemento anterior.
- Vue (`MarpEditorModal.vue` 376–391): quando `focusTarget = false`, apenas pula
  `textarea.focus()`, mas **não restaura** o foco anterior (o `activeElement` fica em limbo).
  Afeta o fluxo find-next/prev quando o foco estava em outro controle.

### 4.10 Features NOVAS e melhorias do port Vue

| Item | Situação |
|---|---|
| Inputs `titleInput`/`descInput` na topbar (linhas 16–17, 1134–1143) | **Novidade**: no original o título vinha só do frontmatter `title:`. Agora o modal coleta título/descrição para salvar no banco (Aula). |
| Cleanup de listeners/timers em `onBeforeUnmount` (linhas 1108–1114) | **Melhoria**: original global não tinha `removeEventListener`/`clearTimeout`; o Vue evita memory leak. |
| Sanitização de path traversal no backend | **Melhoria de segurança**: `processMarpContent` valida `materiaSlug` contra `..` `/` `\` (marp.ts), e a entrega `/materias/*` exige JWT de professor ou senha do curso (routes.ts). (Já citado em 5.1.) |
| Export dropdown sem "click-outside" (linhas 1157–1163) | Só o botão `@click.stop` alterna `showExportMenu`; não há listener para fechar ao clicar fora. No original havia `document click` para fechar. Diferença menor de UX. |
| Seletor de tema duplicado na topbar (linhas 1149–1154) | Há tanto o botão `◐ Tema` (`toggleTheme`) quanto o `<select v-model="currentTheme">`; ambos mudam só o ref interno — nenhum muda o visual (ver 4.6). Duplicação sem efeito. |

### 4.11 Mudanças propositais aceitáveis

- `DEFAULT_MD`: bullet trocado de "HTML-first — sem PDF, sem PPTX" para "sem dependências
  pesadas" (cosmético; o app de fato gera PDF/PPTX via export).
- Mermaid `id`: `mmd-mn-*` no modal vs `mmd-p-*` no standalone (só prefixo).
- Filename de export idêntico: `apresentacao-marp-next.html` / `.pdf` / `.pptx`.

---

## 5. Validação da implementação (Vue + backend)

### 5.1 O que está sólido

- Motor de slides/mermaid/navegação/find&replace: fiel ao original, bem estruturado em
  componentes, com cleanup de listeners em `onBeforeUnmount`.
- Backend: controle de acesso consistente nas rotas `/materias/*` (JWT professor OU senha do
  curso), sanitização de path (`..`, `\`) e slug, CSP específica para HTML servido.
- Draft: separação frontend/backend e proxy Vite são coerentes.

### 5.2 Bugs/riscos confirmados

1. **[CRÍTICO]** `@submit` vs emit `save` no Marp e Json modals → salvar não faz nada.
2. **[CRÍTICO]** prop `:aula` inexistente → editar aula mostra template demo e nunca salva.
3. **[ALTO]** `simpleMarkdownToHtml` degrada markdown rico no HTML do aluno (tabela, img,
   listas numeradas, parágrafos).
4. **[MÉDIO]** Falta `@media print` → export PDF quebrado no modal.
5. **[MÉDIO]** Tema claro não implementado no CSS e `fontFamily` ausente no mermaid.
6. **[MÉDIO]** Botão "Anim" sem efeito + 8/13 animações ausentes no preview.
7. **[MÉDIO]** Orfãos de arquivos em disco no rename/delete de aula.
8. **[MÉDIO]** Auto-save e `window.marpNext` não portados (regressão de DX).
9. **[BAIXO]** `scrollToCharIndex` com métricas hardcoded (regressão de alinhamento).
10. **[BAIXO]** `scrollToCharIndex` não restaura o foco quando `focusTarget = false` (ver 4.9).
11. **[INFO]** Inputs de título/descrição e cleanup de listeners são novidades/melhorias (ver 4.10).

### 5.3 Sugestões priorizadas

1. Corrigir prop/event binding nos 2 modais (seção 3.1/3.2).
2. Usar markdown-it no backend no lugar de `simpleMarkdownToHtml` (ou reutilizar o standalone
   do modal → consistência professor/aluno).
3. Portar `@media print`, tema claro, `fontFamily` mermaid, keyframes restantes e vencer
   `isAnimMode` sobre a CSS.
4. Limpar arquivos órfãos no update/delete de aula.
5. Considerar re-adicionar auto-save e `window.marpNext` para verificação/uso por outras partes.

---

## 6. Arquivos de referência

- Original: `/home/gsuzeda/Projects/EFG/marpnext/index.html` (2303 linhas).
- Vue: `frontend/src/professor/components/MarpEditorModal.vue` (1470 linhas).
- Integração: `frontend/src/professor/ProfessorView.vue` (413).
- Outro editor: `frontend/src/professor/components/JsonActivityEditorModal.vue` (283).
- Backend: `backend/src/marp.ts` (420) e `backend/src/routes.ts` (1488).