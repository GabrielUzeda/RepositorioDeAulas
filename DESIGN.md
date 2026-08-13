# DESIGN.md — Design System do RepositorioDeAulas

Documento canônico do design system do frontend. Stack: **Vue 3 + Vite + Tailwind CSS 3.4** com **Pinia**. O theming é feito via **CSS custom properties** (`--c-*`) declaradas em `frontend/src/shared/style.css`, mapeadas para classes utilitárias do Tailwind em `frontend/tailwind.config.js` (ex.: `bg-surface`, `text-primary`, `border-line`, `ring-accent`). O **dark mode** é ativado por **classe `.dark`** no elemento raiz (`darkMode: 'class'`), e cada token define um par de valores em `:root` (light) e `.dark` (dark). Toda UI de tema deve usar exclusivamente estes tokens — nunca cores Tailwind literais fixas.

---

## 1. Tokens de cor

Uso das classes: `bg-<token>`, `text-<token>`, `border-<token>`, `ring-<token>`. Os tokens de categoria (`cat-*`) têm par de cor de texto + cor de fundo (`cat-<nome>` / `cat-<nome>-bg`), usados em chips/pílsulas de tipo de atividade.

| Token (`--c-*` / classe Tailwind) | Light | Dark | Uso |
|---|---|---|---|
| `--c-surface` · `bg-surface` | `#f8fafc` | `#0f172a` | Fundo base da página / superfícies principais |
| `--c-surface-alt` · `bg-surface-alt` | `#ffffff` | `#1e293b` | Superfícies elevadas (cards, inputs, modais) |
| `--c-primary` · `text-primary` | `#0f172a` | `#f1f5f9` | Texto principal / títulos |
| `--c-secondary` · `text-secondary` | `#475569` | `#cbd5e1` | Texto secundário / legendas |
| `--c-line` · `border-line` | `#64748b` | `#64748b` | Bordas / divisores (elevado p/ ≥3:1) |
| `--c-accent` · `bg-accent` / `text-accent` | `#4f46e5` | `#4f46e5` | Cor de destaque (botões primários, foco, links) |
| `--c-danger` · `bg-danger` | `#e11d48` | `#f43f5e` | Fundo de elementos de perigo/erro |
| `--c-success` · `bg-success` | `#059669` | `#10b981` | Fundo de sucesso |
| `--c-on-success` · `text-on-success` | `#0f172a` | `#0f172a` | Texto **sobre** fundo success (garante contraste) |
| `--c-on-danger` · `text-on-danger` | `#ffffff` | `#0f172a` | Texto **sobre** fundo danger (garante contraste) |
| `--c-danger-text` · `text-danger-text` | `#be123c` | `#fb7185` | Texto de erro/mensagem (não-fundo) |
| `--c-cat-minigame` / `--c-cat-minigame-bg` | `#9333ea` / `#f3e8ff` | `#ede9fe` / `#4c1d95` | Categoria: minigame |
| `--c-cat-roleta` / `--c-cat-roleta-bg` | `#be185d` / `#fce7f3` | `#fbcfe8` / `#831843` | Categoria: roleta |
| `--c-cat-reforco` / `--c-cat-reforco-bg` | `#166534` / `#dcfce7` | `#bbf7d0` / `#14532d` | Categoria: reforço |
| `--c-cat-default` / `--c-cat-default-bg` | `#1d4ed8` / `#dbeafe` | `#bfdbfe` / `#1e3a8a` | Categoria: default |

---

## 2. Tokens de raio e sombra (MT-06)

Tokens **aplicados** em `frontend/tailwind.config.js` via `theme.extend.borderRadius` / `theme.extend.boxShadow` (MT-06). Há também `theme.extend.fontSize` com `display`/`h1`/`h2`/`caption` disponíveis para uso futuro.

Especificação (borderRadius) — mapeada em `theme.extend.borderRadius`:

| Token | Valor | Equivalente | Uso |
|---|---|---|---|
| `borderRadius-control` | `0.375rem` | 6px | Inputs, botões, controles de formulário |
| `borderRadius-card` | `0.5rem` | 8px | Cards (BaseCard) |
| `borderRadius-modal` | `1.5rem` | 24px | Modais (BaseModal) |
| `borderRadius-pill` | `9999px` | — | Pílsulas / badges / chips |

Especificação (boxShadow) — mapeada em `theme.extend.boxShadow`:

| Token | Descrição esperada |
|---|---|
| `boxShadow-card` | Sombra suave de elevação para cards (ex.: `0 1px 3px rgba(0,0,0,.1)` + hover via `.card-hover`) |
| `boxShadow-modal` | Sombra mais forte para sobreposição de modais/toasts |

---

## 3. Regra de contraste (WCAG 2.1 AA)

- **Texto normal** (≤ 18px ou 14px bold): contraste mínimo **4.5:1** contra o fundo.
- **Texto grande/negrito** (≥ 18.66px normal ou ≥ 14px bold): mínimo **3:1**.
- **Elementos não-texto** (bordas, ícones, divisores): mínimo **3:1**.

Decisões de remediação aplicadas:
- `--c-line` foi elevado para **`#64748b`** (em ambos os temas) para que bordas atinjam ≥3:1 contra `surface`.
- Botões de perigo/sucesso usam `text-on-danger` / `text-on-success` (e não branco fixo) para garantir contraste ≥4.5:1 nos dois temas.
- Mensagens de erro usam `text-danger-text` (e não `bg-danger`), respeitando o contraste de texto.

---

## 4. Catálogo de componentes base (`frontend/src/shared/components/`)

| Componente | Propósito |
|---|---|
| `BaseButton.vue` | Botão com variantes `primary/secondary/danger/ghost`, tamanhos `sm/md/lg`, `block`, `disabled`. |
| `BaseCard.vue` | Container de superfície elevada com slots `header`/`footer`/`default` e prop `title`. |
| `BaseModal.vue` | Shell de modal (Teleport + Transition), overlay-click + Esc + X, `v-model` + `@close`. |
| `BaseInput.vue` | Input com `label`, `error` (borda + msg), `v-model`, `id` autogerado, `required`/`disabled`. |
| `BaseSelect.vue` | Select estilizado por token, com `label`/`error` e `v-model`. |
| `BaseTextarea.vue` | Textarea com `label`/`error` e `v-model`, reaproveitado em 6 arquivos. |
| `BaseSpinner.vue` | Indicador de carregamento (ícone `sync` com `animate-spin`). |
| `EmptyState.vue` | Estado vazio reutilizável ("Nenhum ..."). |
| `ConfirmDialog.vue` | Diálogo de confirmação substituindo `window.confirm` (exclusões/reenvio LGPD). |
| `BaseBadge.vue` | Pílula/chip de cabeçalho (ex.: status de e-mail enviado/pendente). |
| `BaseTabs.vue` | Navegação por abas (ex.: Aulas/Atividades do Aluno). |

*(Auxiliares também presentes: `Toast.vue`, `ThemeToggle.vue` — não listados acima por estarem fora do escopo deste catálogo, mas seguem os mesmos tokens.)*

---

## 5. Anti-padrões / regras

- **(a) NUNCA** usar cor Tailwind literal fixa para tema de UI (ex.: `bg-purple-100`, `text-pink-600`, `bg-cyan-900`). Use os tokens `--c-*` / classes mapeadas. Isso quebra o dark mode e a consistência.
- **(b) NUNCA** montar classes Tailwind dinamicamente (ex.: `class={`bg-${cor}`}`). O Tailwind JIT só gera classes **literais** presentes no código-fonte; strings dinâmicas não são detectadas e viram classes inexistentes.
- **(c) Exceção legítima:** `ColorPicker` e `IconPicker` usam paletas inteiras de propósito (seleção de cor/ícone), sendo a única exceção autorizada a cores fixas.

---

## 6. Como estender o design system

1. Adicionar a variável CSS em `frontend/src/shared/style.css`, tanto em `:root` (light) quanto em `.dark` (dark):
   ```css
   :root   { --c-meu-token: #......; }
   .dark   { --c-meu-token: #......; }
   ```
2. Mapear no `tailwind.config.js` em `theme.extend.colors`:
   ```js
   colors: { 'meu-token': 'var(--c-meu-token)' }
   ```
3. Usar via classes literais (`bg-meu-token`, `text-meu-token`, `border-meu-token`).
4. Para raio/sombra, seguir o mesmo padrão em `theme.extend.borderRadius` / `theme.extend.boxShadow` (ver seção 2).
5. Documentar novo token/components neste `DESIGN.md` quando aplicável.
