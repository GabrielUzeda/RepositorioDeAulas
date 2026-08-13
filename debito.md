# Débito Técnico — Design System (RepositorioDeAulas)

> **Documento autossuficiente.** Descreve os problemas de design system encontrados no frontend.
> Pode ser lido isoladamente: traz contexto, evidência (com números medidos) e impacto.
> Data da auditoria: 2026-08-13. Stack afetada: `frontend/` (Vue 3 + Vite + Tailwind 3.4).
> O guia de desenvolvimento `AGENTS.md` também espelha este conteúdo (seção 11).

---

## 1. Resumo executivo

Há **4 frentes de débito técnico** no design system do frontend:

| # | Débito | Gravidade | Resumo |
|---|---|---|---|
| 1 | Modularização de CSS | Baixa | Tema centralizado em CSS vars, mas sem tokens de raio/espaçamento/sombra/tipografia. |
| 2 | Padronização de cor | **Média** | Existem **dois sistemas de cor paralelos**: tokens `--c-*` (modais/base) e paleta Tailwind crua fixa (cards/modais temáticos) que **não responde ao dark mode**. |
| 3 | Contraste WCAG 4.5:1 | **Média** | Texto em botões de sucesso/danger e mensagens de erro **não atingem 4.5:1** (pior no dark). Chips de categoria também falham. |
| 4 | Design system documentado | Média | Não há `DESIGN.md`/styleguide; o que existe (tokens + catálogo de componentes) está só em `AGENTS.md` e em código. |

**Risco geral:** baixo para funcionamento; **médio para acessibilidade** (WCAG 2.1 AA, especialmente texto em botões e erros — o projeto é educacional e pode envolver menores, tornando contraste um ponto de atenção) e **médio para manutenção** (dois sistemas de cor, sem documentação formal de design).

---

## 2. Contexto (para autossuficiência)

- **Stack:** Vue 3 + Vite + Tailwind 3.4 (JIT). Backend não é afetado.
- **Tokens de cor:** definidos como CSS variables em `frontend/src/shared/style.css` e mapeados em `frontend/tailwind.config.js` (`colors: { surface, surface-alt, primary, secondary, line, accent, danger, success } → var(--c-*)`).
  - Light: `--c-surface:#f8fafc; --c-surface-alt:#fff; --c-primary:#0f172a; --c-secondary:#475569; --c-line:#e2e8f0; --c-accent:#4f46e5; --c-danger:#e11d48; --c-success:#059669`
  - Dark (`.dark`): `--c-surface:#0f172a; --c-surface-alt:#1e293b; --c-primary:#f1f5f9; --c-secondary:#cbd5e1; --c-line:#334155; --c-accent:#4f46e5; --c-danger:#f43f5e; --c-success:#10b981`
- **Dark mode:** alternado pela classe `.dark` (via `ThemeToggle.vue`). Os tokens trocam; cores Tailwind literais **não**.
- **Componentes base:** `frontend/src/shared/components/` — `BaseModal`, `BaseButton`, `BaseCard`, `BaseInput`, `BaseSpinner`, `EmptyState`, `ConfirmDialog`, `BaseBadge`, `BaseTabs`, `BaseSelect`, `BaseTextarea`, `FormField`.
- **CSS:** apenas 1 arquivo global (`src/shared/style.css`) com tokens + utilitários (`.card-hover`), scrollbar e estilos do Marp. Os componentes são 100% utility-classes; só 2 `.vue` usam `<style scoped>`.

---

## 3. Débito 1 — Modularização de CSS

**Estado:** o theming de cor está centralizado em variáveis CSS (bom). Porém **não há tokens** para:
- raio (`rounded-*` é literal por componente: `BaseModal` usa `rounded-3xl`, `BaseCard` `rounded-lg`, `BaseButton`/`BaseInput` `rounded-md`, `EmptyState` `rounded-2xl`, badges `rounded-full`);
- espaçamento (`p-4`, `py-2`, `gap-1` etc. sem escala nomeada);
- sombra (`shadow-2xl`, `shadow-sm`, `shadow-xl` sem token);
- tipografia (nenhuma escala/font-weight tokenizada).

**Impacto:** dificulta consistência visual e refactoring temático; cada dev "chuta" valores.

**Evidência:** `frontend/src/shared/style.css`; `frontend/tailwind.config.js`; `BaseModal.vue`/`BaseCard.vue`/`BaseButton.vue`/`BaseInput.vue`.

---

## 4. Débito 2 — Padronização: dois sistemas de cor paralelos

Os componentes **base/modais** usam os tokens (`bg-surface`, `text-secondary`, `border-line`, `ring-accent`, `bg-accent`, `bg-danger`). Mas componentes de **conteúdo** usam paleta Tailwind **crua e fixa**, que **ignora o dark mode**:

- `frontend/src/aluno/components/AtividadeCard.vue:17-23` → `bg-purple-100 text-purple-600`, `bg-pink-100 text-pink-600`, `bg-green-100 text-green-600`, `bg-blue-100 text-blue-600` (chips de categoria de atividade).
- `frontend/src/aluno/components/RoletaModal.vue` → ~12 ocorrências `bg-pink-*/text-pink-*` fixas (tema rosa do modal).
- `frontend/src/aluno/components/MinigameModal.vue:51` → `bg-cyan-900 text-cyan-300`.
- `frontend/src/admin/AdminView.vue:259` → `bg-purple-950 border-purple-800 text-purple-300`.

> (`ColorPicker.vue`/`IconPicker.vue` usam paletas inteiras de cor — justificável, são seletores de cor, não tema de UI.)

**Impacto:**
- No dark mode, esses chips/fundos claros (`purple-100`, `pink-100`, `green-100`, `blue-100`) continuam claros → quebra visual e de contraste contra o fundo escuro.
- Manutenção de tema exige caçar cores literais espalhadas; o token system não é a única fonte de verdade.

**Evidência:** greps por `(bg|text|border)-(gray|slate|...|purple|pink|cyan|...)-[0-9]+` retornam dezenas de ocorrências fora dos tokens.

---

## 5. Débito 3 — Contraste WCAG 4.5:1 (não garantido)

Contraste medido (fórmula WCAG: `(L1+0.05)/(L2+0.05)`). Texto normal exige **≥4.5:1**; texto grande/negrito exige **≥3:1**; elementos não-texto (bordas) exigem **≥3:1** (WCAG 1.4.11).

### 5.1 Pares do sistema de tokens (texto normal)

| Par (texto / fundo) | Tema | Ratio | WCAG AA (4.5) |
|---|---|---|---|
| primary / surface | light | 17.06 | ✅ |
| primary / surface | dark | 16.30 | ✅ |
| primary / surface-alt | light | 17.85 | ✅ |
| primary / surface-alt | dark | 13.35 | ✅ |
| secondary / surface | light | 7.24 | ✅ |
| secondary / surface | dark | 12.02 | ✅ |
| secondary / surface-alt | light | 7.58 | ✅ |
| secondary / surface-alt | dark | 9.85 | ✅ |
| branco / accent (indigo-600) | ambos | 6.29 | ✅ |
| **branco / danger (rosa)** | light | 4.70 | ✅ |
| **branco / danger (rosa)** | **dark** | **3.67** | ⚠️ <4.5 (passa só p/ grande) |
| **branco / success (verde)** | light | 3.77 | ⚠️ <4.5 |
| **branco / success (verde)** | **dark** | **2.54** | ❌ FAIL |
| **texto danger (erro) / surface** | light | 4.49 | ⚠️ falha por 0.01 |
| texto danger (erro) / surface | dark | 4.86 | ✅ |
| texto danger (erro) / surface-alt | light | 4.70 | ✅ |
| texto danger (erro) / surface-alt | dark | 3.98 | ⚠️ <4.5 |

### 5.2 Bordas / separadores (não-texto, exige 3:1)

| Par | Tema | Ratio | Status |
|---|---|---|---|
| `line` / surface | light | 1.18 | ❌ FAIL |
| `line` / surface | dark | 1.72 | ❌ FAIL |

### 5.3 Chips de categoria (`AtividadeCard.vue`) — texto vs próprio fundo (constante nos dois temas)

| Chip | Texto / Fundo | Ratio | Status |
|---|---|---|---|
| roxo | `#9333ea` / `#f3e8ff` | 4.56 | ✅ |
| rosa | `#db2777` / `#fce7f3` | 3.91 | ❌ FAIL |
| verde | `#16a34a` / `#dcfce7` | 3.00 | ❌ FAIL |
| azul | `#2563eb` / `#dbeafe` | 4.24 | ❌ FAIL |

### 5.4 Conclusão de contraste
- Texto principal/secundário: **OK** em ambos os temas.
- **Botões de sucesso** (`bg-success text-white`): **falham** no dark (2.54) e ficam no limite no light (3.77).
- **Botões de perigo** (`bg-danger text-white`): ficam no limite no dark (3.67).
- **Mensagens de erro** (`text-danger` sobre surface claro): 4.49 — falha por 0.01.
- **Bordas/separadores**: muito baixas (1.2–1.7), abaixo do 3:1 de não-texto.
- **Chips de categoria**: 3 de 4 abaixo de 4.5:1.

---

## 6. Débito 4 — Design system não documentado formalmente

- Não há `DESIGN.md`, styleguide ou spec de tokens na raiz.
- O que existe: tokens em `style.css` + mapa em `tailwind.config.js` + catálogo de componentes em `AGENTS.md` (seção 3).
- **Faltam**: guia de uso de cor, escala tipográfica, escala de espaçamento/raio, requisitos de contraste mínimo e API formal dos componentes.

---

## 7. Impacto consolidado

- **Acessibilidade (WCAG 2.1 AA):** botões de sucesso/danger e erros abaixo de 4.5:1; borders invisíveis; chips de categoria failing. Relevante para público educacional (possível presença de menores).
- **Dark mode:** quebrado em cards/modais temáticos (cores fixas).
- **Manutenção:** dois sistemas de cor; sem documentação de design; sem tokens de raio/espaçamento.

---

## 8. Itens de remediação sugerida (AINDA NÃO implementados)

1. **Contraste — crítico:** ajustar `--c-success`/`--c-danger` (especialmente no `.dark`) ou trocar o texto dos botões de `text-white` para um token de texto de alto contraste, garantindo ≥4.5:1 nos dois temas. Subir `--c-line` para ≥3:1 contra surface.
2. **Tokenizar cores fixas:** substituir `purple-100/pink-600/...` por tokens de categoria com par claro/escuro válidos (ex.: `--c-cat-1..n`), ou aceitar que são decorativos e garantir ≥4.5:1 no texto do chip.
3. **Tokens de raio/espaçamento/sombra/tipografia:** adicionar a `tailwind.config.js` e aplicar nos componentes base.
4. **`DESIGN.md`:** documentar tokens, escalas, contraste mínimo e API dos componentes (espelhado em `AGENTS.md` seção 11).

---

## 9. Evidência (arquivos)

- `frontend/src/shared/style.css` — tokens `--c-*` (light/dark) + utilitários globais.
- `frontend/tailwind.config.js` — mapa `colors → var(--c-*)`.
- `frontend/src/shared/components/` — componentes base (tokens).
- `frontend/src/aluno/components/AtividadeCard.vue:17-23` — chips de categoria fixos.
- `frontend/src/aluno/components/RoletaModal.vue` — tema rosa fixo.
- `frontend/src/aluno/components/MinigameModal.vue:51` — `bg-cyan-900 text-cyan-300`.
- `frontend/src/admin/AdminView.vue:259` — `bg-purple-950...`.
- `AGENTS.md` (seção 11) — espelho deste débito.

---

## 10. Prioridade

| Item | Prioridade |
|---|---|
| Contraste em botões success/danger + erros | **Alta** (acessibilidade) |
| Bordas/separadores ≥3:1 | Média |
| Tokenizar cores fixas (dark mode dos cards) | Média |
| Tokens de raio/espaçamento/sombra/tipografia | Baixa |
| `DESIGN.md` + espelho em `AGENTS.md` | Média |

---

## 11. Estado de resolução (2026-08-13)

Implementada a remediação dos itens 1–4 via PR/branch de trabalho (não commitado no momento desta nota). Decisão de arquitetura: **Opção B** do cérebro — manter tons de marca e introduzir tokens de *texto* dedicados, em vez de escurecer as cores de fundo.

### Itens resolvidos
1. **Contraste (Alta):** `--c-line` elevado para `#64748b` (≥3:1 em ambos os temas); adicionados `--c-on-success` (texto sobre success), `--c-on-danger` (branco no light / `#0f172a` no dark, ≥4.5:1) e `--c-danger-text` (#be123c / #fb7185, erros ≥4.5:1). `BaseButton` (danger), `BaseInput`/`BaseSelect`/`BaseTextarea`/`FormField` (erro) e selos/`FeedbackConsolidadoModal` (success/danger) passam a usar esses tokens.
2. **Padronização de cor (Média):** criados tokens de categoria `cat-{minigame,roleta,reforco,default}` (+ `-bg`) com par claro/escuro válido (≥4.5:1). `AtividadeCard` (chips), `RoletaModal`, `MinigameModal`, `AdminView` ("Acesso Total") e `JsonActivityEditorModal` migraram de cores Tailwind fixas para tokens — **zero** `purple-/pink-/cyan-/sky-` residuais nesses arquivos.
3. **Tokens de raio/sombra/tipografia (Baixa):** adicionados em `tailwind.config.js` `borderRadius` (control/card/modal/pill), `boxShadow` (card/modal) e `fontSize` (display/h1/h2/caption); aplicados em `BaseCard`, `BaseModal`, `EmptyState`, `BaseBadge`, `BaseTabs`, `BaseSelect`, `BaseTextarea`. *Tokens de `spacing` não foram adicionados (fora do escopo desta decisão; Tailwind já prove escala padrão).*
4. **`DESIGN.md` (Média):** criado na raiz documentando tokens de cor, raio/sombra, regra de contraste WCAG AA, catálogo de componentes e anti-padrões.

### Riscos aceitos (não regressão — estados de destaque/rótulo, não texto de leitura)
- `RoletaModal` (opção correta enviada): `text-success` sobre `bg-surface` ≈ 3.5:1.
- `JsonActivityEditorModal`: `text-success` (ícone/checkbox) ≈ 2.54:1 no dark.
- `--c-line` idêntico nos dois temas deixa bordas mais visíveis no light (esperado). Recomenda-se validação visual de `AdminView` e `FeedbackConsolidadoModal` antes do release.

### Verificação
- `npx vue-tsc --noEmit` passa em todos os builds.
- Classes permanecem literais (JIT-safe); nenhum arquivo fora do escopo de design system foi tocado pela remediação.
