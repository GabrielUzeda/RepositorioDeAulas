# DESIGN.md — Design System v2.0 (Azul Royal)

Documento canônico do design system do frontend. Stack: **Vue 3 + Vite + Tailwind CSS 3.4** com **Pinia**. Theming via **CSS custom properties** (`--c-*`) em `frontend/src/shared/style.css`, mapeadas em `frontend/tailwind.config.js`. Dark mode via classe `.dark`. Toda UI deve usar exclusivamente os tokens — nunca cores Tailwind literais fixas.

> Princípios adotados: **Refactoring UI (Steve Schoger)** · **Pablo Stanley** · **Nielsen Norman Group**

---

## 1. Paleta — Azul Royal Profissional

### 1.1 Tokens de Superfície (três camadas)

| Token | Classe | Light | Dark | Uso |
|---|---|---|---|---|
| `--c-canvas` | `bg-canvas` | `#f0f4f8` | `#121212` | Fundo da página (mais distante) |
| `--c-surface` | `bg-surface` | `#f8fafc` | `#1e1e1e` | Painéis intermediários |
| `--c-surface-alt` | `bg-surface-alt` | `#ffffff` | `#242424` | Cards, modais, inputs (mais perto do usuário) |
| `--c-header-bg` | `bg-header-bg` | `#ffffff` | `#000000` | Header do topo da página |

> **Schoger:** Três camadas de superfície criam profundidade real sem usar bordas pesadas.
>
> **Dark mode:** as superfícies do modo escuro são **neutras** (cinza, sem matiz azul) — `#121212` / `#1e1e1e` / `#242424`. O azul permanece apenas no accent e nos elementos semânticos.
>
> **Cores de matiz constantes:** accent, categorias e semânticas (danger/success/warning) têm os **mesmos valores nos dois temas** — alternar o modo escuro NÃO muda a tonalidade de nenhum elemento colorido. Só os neutros (superfícies, texto, bordas, sombras) variam.

### 1.2 Tokens de Tipografia

| Token | Classe | Light | Dark | Uso |
|---|---|---|---|---|
| `--c-primary` | `text-primary` | `#1e2b3c` | `#e8f0fc` | Headings, texto de alta prioridade |
| `--c-secondary` | `text-secondary` | `#4a6280` | `#8ba8cc` | Body, rótulos, metadados |
| `--c-muted` | `text-muted` | `#8ba2bc` | `#4a6280` | Placeholders, hints, ícones de suporte |

### 1.3 Tokens de Borda

| Token | Classe | Valor | Uso |
|---|---|---|---|
| `--c-line` | `border-line` | `#c5d4e3` / `#1e3048` | Divisores sutis, bordas padrão |
| `--c-line-strong` | `border-line-strong` | `#8ba2bc` / `#2e4a6a` | Bordas em hover/focus |

### 1.4 Accent — Azul Royal

> **Constante nos dois temas** (idêntico em claro/escuro). Vale para accent, categorias e semânticas: alternar o dark não muda a tonalidade de elemento colorido algum.

| Token | Classe | Light | Dark |
|---|---|---|---|
| `--c-accent` | `bg-accent` / `text-accent` | `#1d4ed8` | `#1d4ed8` |
| `--c-accent-hover` | `bg-accent-hover` | `#1e40af` | `#1e40af` |
| `--c-accent-light` | `bg-accent-light` | `#dbeafe` | `#dbeafe` |
| `--c-accent-text` | `text-accent-text` | `#1d4ed8` | `#1d4ed8` |
| `--c-on-accent` | `text-on-accent` | `#ffffff` | `#ffffff` |

### 1.5 Estados Semânticos

> **Constantes nos dois temas** — mesmos valores em light e dark (não mudam de tonalidade ao alternar o modo escuro).

| Estado | Bg | Light bg | Text | On-color | Uso |
|---|---|---|---|---|---|
| Danger | `bg-danger` `#dc2626` | `bg-danger-light` `#fee2e2` | `text-danger-text` `#991b1b` | `text-on-danger` `#fff` | Erros, exclusões |
| Success | `bg-success` `#059669` | `bg-success-light` `#d1fae5` | `text-success-text` `#065f46` | `text-on-success` `#fff` | Confirmações |
| Warning | `bg-warning` `#d97706` | `bg-warning-light` `#fef3c7` | `text-warning-text` `#92400e` | — | Alertas moderados |

> **NNGroup:** Sempre usar tokens `*-light` + `*-text` para mensagens inline (não fundo saturado). Reservar `bg-danger` / `text-on-danger` apenas para botões de ação.

### 1.6 Categorias de Atividade

> **Constantes nos dois temas** — pares texto/fundo idênticos em light e dark.

| Categoria | Texto | Fundo |
|---|---|---|
| minigame | `text-cat-minigame` `#6d28d9` | `bg-cat-minigame-bg` `#ede9fe` |
| roleta | `text-cat-roleta` `#9d174d` | `bg-cat-roleta-bg` `#fce7f3` |
| reforco | `text-cat-reforco` `#065f46` | `bg-cat-reforco-bg` `#d1fae5` |
| default | `text-cat-default` `#1d4ed8` | `bg-cat-default-bg` `#dbeafe` |

---

## 2. Escala Tipográfica

Configurada em `theme.extend.fontSize`. Fonte base: **Inter** (via Google Fonts ou system-ui fallback).

| Token | Tamanho | Line-height | Peso | Letter-spacing | Uso |
|---|---|---|---|---|---|
| `text-display` | 2.25rem/36px | 2.75rem | 700 | -0.03em | Títulos heroicos |
| `text-h1` | 1.875rem/30px | 2.25rem | 700 | -0.025em | Títulos de página |
| `text-h2` | 1.5rem/24px | 2rem | 600 | -0.02em | Seções principais |
| `text-h3` | 1.25rem/20px | 1.75rem | 600 | -0.015em | Subseções, modais |
| `text-body` | 1rem/16px | 1.625rem | — | — | Texto corrido |
| `text-sm` | 0.875rem/14px | 1.375rem | — | — | Rótulos, secundário |
| `text-xs` | 0.8125rem/13px | 1.25rem | — | — | Badges, captions |
| `text-caption` | 0.75rem/12px | 1.125rem | — | — | Hints, timestamps |

> **Schoger:** Mais variação de tamanho cria hierarquia real. Usar `tracking-tight` em headings grandes.

---

## 3. Tokens de Elevação (Sombras)

| Token | Classe | Uso |
|---|---|---|
| `--shadow-xs` | `shadow-xs` | Elementos flutuantes mínimos |
| `--shadow-sm` / card | `shadow-card` | Cards em repouso |
| `--shadow-md` | `shadow-md` | Cards em hover |
| `--shadow-lg` | `shadow-lg` | Dropdowns, tooltips |
| `--shadow-xl` / modal | `shadow-modal` | Modais, overlays |

> **Schoger:** Sombras são uma ferramenta de elevação, não decoração. Use-as para comunicar hierarquia Z.

---

## 4. Tokens de Raio

| Token | Classe | Valor | Uso |
|---|---|---|---|
| `xs` | `rounded-xs` | 4px | Chips, tags pequenas |
| `sm` / control | `rounded-sm` | 6px | Botões, inputs, controles |
| `md` / card | `rounded-md` | 8px | Cards de conteúdo |
| `lg` | `rounded-lg` | 12px | Cards destaque |
| `xl` | `rounded-xl` | 16px | Painéis, seções |
| `2xl` / modal | `rounded-2xl` | 24px | Modais |
| `full` / pill | `rounded-full` | 9999px | Pílulas, avatares |

---

## 5. Catálogo de Componentes Base (`frontend/src/shared/components/`)

| Componente | Props | Status | Uso |
|---|---|---|---|
| `BaseButton.vue` | `variant: primary\|secondary\|danger\|success\|ghost` · `size: xs\|sm\|md\|lg` · `loading` · `block` · `disabled` | ✅ em uso | Todas as ações |
| `BaseInput.vue` | `v-model` · `label` · `type` · `icon` · `hint` · `error` · `required` · `disabled` | ✅ em uso | Formulários |
| `BaseTextarea.vue` | `v-model` · `label` · `hint` · `error` · `rows` · `required` | ✅ em uso | Campos longos |
| `BaseSelect.vue` | `v-model` · `label` · `options` · `hint` · `error` · `placeholder` · `required` | ✅ em uso | Seleções |
| `BaseCard.vue` | `title` · `padded` · `shadow` · `hoverable` + slots `header/footer` | ✅ disponível | Containers |
| `BaseContentCard.vue` | `title` · `description` · `icon` · `color` · `badgeText` · `meta` · `actionText` + slots | ✅ em uso | Cards padronizados |
| `RichTextEditor.vue` | `modelValue` · `label` · `placeholder` · `error` · `minHeight` | ✅ em uso | Editor rico anti-XSS |
| `BaseModal.vue` | `v-model` · `title` · `maxWidth` · `noPadding` + slots `header/footer` | ✅ em uso | Diálogos |
| `BaseBadge.vue` | `variant: accent\|success\|danger\|warning\|secondary\|neutral` · `dot` | ✅ em uso | Status, categorias |
| `BaseSpinner.vue` | `size: sm\|md\|lg` · `label` + `role="status"` | ✅ em uso | Loading states |
| `EmptyState.vue` | `icon` · `title` · `message` · `size` + slot `action` | ✅ em uso | Estados vazios |
| `ConfirmDialog.vue` | `v-model` · configurável | ✅ em uso | Confirmações LGPD |
| `BaseTabs.vue` | — | ⚠️ disponível | Abas |
| `ThemeToggle.vue` | — | ✅ em uso | Header |
| `Toast.vue` | via `useToast` | ✅ em uso | Feedback flutuante |

---

## 6. Padrões de Layout

### Header Padrão
- **Sticky** com `backdrop-blur-md` (frosted glass — não sólido pesado)
- Altura: `h-14`
- Logo + breadcrumb + ações

### Grid de Cards
- **Cursos / Disciplinas / Atividades**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
- **Aulas**: lista vertical `flex flex-col gap-2` (conteúdo textual — mais scannable)

### Modal
- `max-w-2xl` padrão · `max-h-[90vh]` com scroll interno no body

---

## 7. Princípios & Anti-padrões

### ✅ Faça sempre

- Use os três tokens de superfície (`canvas → surface → surface-alt`) para hierarquia de elevação sem bordas extras.
- Use `*-light` + `*-text` para alertas inline — nunca `bg-danger text-white` direto.
- Use `role`, `aria-label`, `aria-selected`, `role="alert"` para acessibilidade (NNGroup).
- Use `card-hover` para hover de cards (transform + shadow, não só cor).
- Mantenha **cores de matiz constantes entre temas** (accent, semânticas, categorias) — só os neutros variam no dark.
- Adicione `tabindex="0"` e handlers `@keydown.enter/@keydown.space` em divs clicáveis.
- Prefira `focus-visible:ring` a `focus:ring` para não poluir mouse users.

### ❌ Nunca faça

- **Nunca** usar cor Tailwind literal (`bg-purple-100`, `text-pink-600`). Use os tokens `--c-*`.
- **Nunca** usar emojis unicode na interface, mensagens de feedback, toasts ou código. Use sempre **Material Icons** (`<span class="material-icons">`) ou **Font Awesome** (`<i class="fa...">`).
- **Nunca** montar classes dinamicamente via concatenação de strings.
- **Nunca** usar `window.confirm()` — use `ConfirmDialog.vue`.
- **Nunca** usar fundo sólido preto/escuro no backdrop de modais — use `bg-primary/30 backdrop-blur-sm`.
- **Nunca** usar o ícone `sync` para spinner — use `BaseSpinner` com SVG nativo.

---

## 8. Como Estender

1. Adicionar `--c-novo-token` em `:root` e `.dark` em `style.css`.
2. Mapear em `theme.extend.colors` no `tailwind.config.js`.
3. Usar via classe literal (`bg-novo-token`, `text-novo-token`).
4. Documentar neste `DESIGN.md`.

> **Convenção de matiz:** toda cor **com matiz** (accent, semânticas, categorias) deve ter o **mesmo valor em `:root` e `.dark`** — apenas para que neutros (superfícies, texto, bordas, sombras) tenham valores distintos no dark. Assim, alternar o modo escuro nunca muda a tonalidade de um elemento colorido.

---

*Design System v2.0 — Auditado em conformidade com WCAG 2.1 AA, princípios Refactoring UI (Schoger) e diretrizes NNGroup.*
