# AGENTS.md — Guia do Repositório (RepositorioDeAulas)

Guia geral para agentes de IA e desenvolvedores trabalharem neste monorepo. Cobre arquitetura, convenções, comandos, arquivos-chave e o guia de testes E2E. **Todas as informações foram verificadas diretamente no código.**

---

## 1. Visão geral do projeto

Plataforma educacional de repositório de aulas: professores criam cursos, disciplinas (matérias), aulas (renderizadas a partir de Markdown via Marp) e atividades interativas; alunos acessam anonimamente com senha de curso e respondem atividades; professores avaliam respostas com nota e feedback e geram relatórios de feedback da turma.

**Stack:** Bun + Hono + SQLite (backend) · Vue 3 + Vite + Pinia + Tailwind 3.4 (frontend) · Playwright (E2E).

```
RepositorioDeAulas_new/
├── docker-compose.yml          # Stack dev (bun-server 8080 + vite 5173)
├── docker-compose.prod.yml     # Produção (opções com/sem nginx+Certbot)
├── docker-compose.e2e.yml      # Stack E2E isolada (bun-server 18080 + vite 15173 + playwright)
├── .env                        # Credenciais (SMTP, JWT, PROFESSOR_EMAIL/PASSWORD, Postgres)
├── example.env                 # Template do ambiente
├── backend/                    # API Bun + Hono + SQLite
│   ├── src/db.ts               # Conexão SQLite, schema, seed (admin/demo)
│   ├── src/routes.ts           # TODAS as rotas HTTP (~1500 linhas, fonte da verdade da API)
│   ├── src/marp.ts             # Geração de HTML de aulas (Marp/Markdown)
│   ├── src/mailer.ts           # Nodemailer (SMTP, degrada sem config)
│   ├── src/auth.ts             # login/registro, JWT
│   ├── src/env.ts              # Carrega .env da raiz do repo
│   ├── src/utils.ts            # sanitizeSlug, encryptData/decryptData, hashEmail
│   └── src/templates/          # Templates de e-mail (envio_atividades.html)
├── frontend/                   # Vue 3 + Vite + Tailwind
│   ├── src/admin/              # AdminView + modais (CRUD professor/curso)
│   ├── src/professor/          # ProfessorView + modais (Marp, atividade, respostas, feedback)
│   ├── src/aluno/              # AlunoView + componentes (ActivityModal, AulaCard...)
│   ├── src/shared/             # router, stores (auth/curso), api/client, LoginView
│   │   └── src/materias/       # Aulas geradas localmente (dev, não-tracked)
│   │   └── src/public/static/  # Imagens de capa por tipo de atividade (.webp)
└── e2e/                        # Playwright (config, setup, helpers, tests)
```

---

## 2. Comandos

### Backend (workdir `backend/`)
```bash
bun install          # instalar deps
bun run dev          # bun run --watch src/index.ts (porta 8080)
bun run start        # produção
bun test             # testes (pequeno conjunto, ex: auth.test.ts)
```

### Frontend (workdir `frontend/`)
```bash
npm install
npm run dev          # vite --port 5173
npm run build        # vue-tsc && vite build  (gera dist/ — necessário p/ E2E)
```

### Typecheck / lint
```bash
npx vue-tsc --noEmit            # frontend (workdir frontend/)
npx vite build --outDir /tmp/... # build sem tocar dist root
```

### E2E — ver seção 8 (rodar sempre via Docker).

### ⚠️ Recomendação de Ambiente (Docker First)
> **SEMPRE use Docker (`docker compose`) para executar operações com Bun (backend), Banco de Dados (SQLite) ou Vue/Vite (frontend).**  
> Executar instalações de dependências, builds ou manipulações de banco diretamente na máquina host gera arquivos residuais ("lixo"), poluição de dependências locais e problemas de permissão (ex.: diretório `dist/` gerado como `root`).

### Docker
```bash
docker compose up -d                 # dev (8080 + 5173)
docker compose -f docker-compose.prod.yml --profile with-nginx up -d  # prod opção A
docker compose -f docker-compose.e2e.yml up -d  # e2e manual
```

---

## 3. Arquitetura e camadas

### Backend
- **Hono** (framework) + **SQLite** via `dbq` (wrapper síncrono — `dbq(sql).get(...).run(...)`).
- **DB path**: `db.ts` usa `process.env.DATABASE_PATH || './data/app.db'` (relativo ao working_dir; no container `/app/data/app.db`). **`DB_PATH` não é lido** — só `DATABASE_PATH`.
- **Criptografia/LGPD**: `encryptData/decryptData` (AES-GCM, prefixo `enc:v1:`), `hashEmail` (HMAC SHA-256 b64url; NÃO existe `hashData`). Respostas de alunos são criptografadas; e-mail é hasheado.
- **Seed** (`db.ts`): cria admin com `process.env.PROFESSOR_EMAIL||'admin@escola.com'` e `PROFESSOR_PASSWORD||'MudeEstaSenha!'`, curso demo `demo-course` (senha `asdf1234`), disciplina e aulas demo.
- **Aliases:** `POST /materias` ≡ `POST /disciplinas`; `POST /disciplinas/:id` ≡ PUT. Em todo o código, "disciplina" = "matéria".

### Frontend
- **Router** (`src/shared/router/index.ts`): `/`→AlunoView, `/login`→LoginView, `/professor` (guard)→ProfessorView, `/admin`→AdminView.
- **Stores Pinia**: `auth` (token, login/logout), `curso` (cursos, disciplinas, aulas, atividades; alias: `materias`).
- **API client** (`src/shared/api/client.ts`): `baseUrl='/api'`; envia `Authorization: Bearer` se token em `sessionStorage['professor_auth']` (JSON `{token, expiry: 24h}`); 401 em rota protegida limpa auth.
- **Storage criptografado** (`src/shared/utils/storage.ts`): `secureGet/secureSet` usam chave AES-GCM derivada/local armazenada em `localStorage['enc_key_v1']` (usado p/ senhas de curso/atividade do aluno).
- **Tipos globais** (`src/shared/types/index.ts`): `Professor, Curso, Disciplina, Aula, Question, QuestionOption, ...`.

### Vite proxy (dev) — `frontend/vite.config.ts`
- `publicDir: 'src/public'`, alias `@→./src`.
- Proxy: `/api` → `VITE_PROXY_TARGET||http://localhost:8080` (strip `/api`); `/cursos` e `/materias` → target. **NÃO cobre `/disciplinas`** (aulas são servidas sob `/materias`).

### Componentes reutilizáveis (frontend) — `src/shared/components/`
Biblioteca de componentes compartilhados entre Admin/Professor/Aluno. **Todos usam tokens de tema** (`bg-surface`, `text-primary`, `bg-accent`, `border-line`, `ring-accent`, `bg-danger`, `text-secondary`, `bg-surface-alt`) — definidos em `tailwind.config.js` via `var(--c-*)` — e devem ser usados SEMPRE que a UI repetir um desses padrões, em vez de reescrever Tailwind literal por componente.

**Componentes existentes:**

| Componente | Props | Status de uso |
|---|---|---|
| `BaseButton.vue` | `variant: primary\|secondary\|danger\|ghost` · `size: sm\|md\|lg` · `type` · `disabled` · `block` | ✅ **em uso** (modais/formulários migrados passaram a usar o trio). |
| `BaseCard.vue` | `title?` · `padded?` + slots `header`/`footer`/default | ⚠️ criado, **ainda não usado** (disponível p/ cards de curso/disciplina/aluno). |
| `BaseInput.vue` | `v-model` · `label?` · `type` · `placeholder` · `error?` (border/msg de erro) · `disabled` · `id?` (autogerado) · `required?` | ✅ **em uso** (modais/formulários). |
| `ThemeToggle.vue` | nenhuma (comuta claro/escuro) | ✅ em uso (App, Aluno, Professor, Admin, Login) |
| `Toast.vue` | — | ✅ em uso (via `useToast`, App + vários modais) |

**Catálogo de componentes reutilizáveis — criados e disponíveis** (commit deste trabalho; extraídos dos padrões repetidos verificados no código):

| Componente | Justificativa (padrão origem) | Status de uso |
|---|---|---|
| `BaseModal.vue` | Shell de modal repetido (~13 modais). Overlay+container+header+close → `<BaseModal v-model @close>` com Teleport+Transition, overlay-click+Esc+X. | ✅ em uso nos 13 modais (exceto MarpEditor, que mantém layout fullscreen) |
| `BaseSpinner.vue` | `material-icons animate-spin ... sync` repetido. | ✅ em uso (3 arquivos) |
| `EmptyState.vue` | Vazios "Nenhum ..." repetidos. | ✅ **em uso** (AlunoView×4, AdminView, ProfessorView×4, JsonActivityEditorModal, RespostasModal, FeedbackConsolidadoModal) |
| `ConfirmDialog.vue` | `window.confirm` em exclusões/reenvio (LGPD). | ✅ em uso (substituiu todos os `window.confirm`: AdminView×2, ProfessorView×3, RespostasModal, FeedbackConsolidadoModal) |
| `BaseBadge.vue` | Pill de cabeçalho repetida nos modais. | ✅ em uso (1 arquivo) |
| `BaseTabs.vue` | Tabs de AlunoView (aulas/atividades). | ⚠️ criado, não usado (AlunoView fora do escopo de migração) |
| `BaseSelect.vue` | `<select>` em formulários. | ✅ em uso (2 arquivos) |
| `BaseTextarea.vue` | `<textarea>` em 7 arquivos. | ✅ em uso (6 arquivos) |
| `BaseContentCard.vue` | Card padronizado de conteúdo com header, ícone, badges, meta e slots de ações. | ✅ em uso (CursoCard, DisciplinaCard, AdminView, ProfessorView) |
| `RichTextEditor.vue` | Editor WYSIWYG com sanitização anti-XSS e suporte a formatação/código. | ✅ em uso (ActivityModal) |

**Regras:** para criar novo componente, siga a convenção PascalCase em `src/shared/components/`; use apenas classes literais de tokens (nunca classes dinâmicas); aproveite `BaseButton`/`BaseInput`/`BaseCard` em vez de botões/inputs novos; migrar o trio base para as views é trabalho pendente (não feito ainda).

---

## 4. Modelo de dados principal (SQLite — `db.ts`)

- `usuarios` (admin/professor), `cursos` (com coluna `senha`), `curso_professores`
- `disciplinas` (curso_id, slug, nome, cor, icone, descricao)
- `aulas` (disciplina_id, titulo, **caminho** → `materias/{slug}/aulas/{slug}.html`, descricao, ordem, conteudo_md)
- `atividades` (disciplina_id, external_id, titulo, descricao, caminho, icone, `json_data`, tipo, senha, allow_password, ordem)
- `respostas_alunos` (atividade_id, aluno_nome, aluno_email, aluno_email_hash, respostas [criptografadas], acertos, total, pontuacao, **nota REAL, feedback TEXT, enviado_em**, consulta_token, criado_em)
- `rascunhos_atividades` (codigo_recuperacao, atividade_id, aluno_nome, aluno_email, aluno_email_hash, respostas_json [criptografadas], expira_em [30 dias], criado_em, atualizado_em)
- `disciplina_feedbacks` (disciplina_id, aluno_email_hash [NULL=turma], feedback_geral, enviado_em, criado_em, atualizado_em, UNIQUE(disciplina_id, aluno_email_hash))

**Convenção:** resposta individual tem `aluno_email_hash` preenchido; feedback de turma é o registro com hash NULL.

---

## 5. Convenções de código

- **Sem comentários** no código (salvo quando o usuário pedir).
- **Tailwind JIT** só gera classes **literais** — paletas de cores são escritas por extenso (ex.: `bg-indigo-600`); nunca monte strings de classe dinamicamente.
- **Reuse de UI:** prefira os componentes de `src/shared/components/` (ver seção 3) a repetir Tailwind literal. Antes de escrever um botão/input/card/modal/spinner/empty novo, verifique se o componente base já existe ou se o padrão merece ser extraído para lá.
- Nomes de arquivos: PascalCase para componentes (`.vue`), camelCase para stores/utilities.
- Tipagem forte via TS em frontend e backend (Bun).
- Conexões/erros de DB não usam ORM; SQLite cru com `dbq`.

---

## 6. LGPD / privacidade (pontos relevantes ao mexer)

- Nome/email/respostas do aluno são **criptografados** ao submeter; e-mail vira hash para joins.
- `DELETE /respostas/:id` existe para direito de exclusão (LGPD).
- Consulta do aluno a suas respostas: `GET /aluno/minhas-respostas?email+token` e `DELETE` (token = `consulta_token`).
- E-mails reais exigem SMTP no `.env`; sem SMTP, envios degradam silenciosamente (não lançam erro).

---

## 7. Fluxos de negócio e Jornada End-to-End

O repositório opera em 4 grandes papéis/fluxos encadeados, do gerenciamento administrativo até a entrega pedagógica:

### 7.1 Jornada End-to-End do Sistema

```
[1. Administrador] ──► Criar Professores & Cursos ──► Vincular Professores aos Cursos
                                                                  │
                                                                  ▼
[2. Professor]     ──► Criar Disciplinas ──► Criar Aulas (Marp) & Atividades (Tipos) ──► Reordenar
                                                                  │
                                                                  ▼
[3. Aluno]         ──► Autenticar Curso (Senha) ──► Visualizar Aulas ──► Responder Atividade (Opt-in Email)
                                                                  │
                                                                  ▼
[4. Avaliação]     ──► Professor atribui Nota/Feedback ──► Gera Relatório Consolidado da Turma (Disparo Email)
```

1. **Administrador (`/admin`)**:
   - Autentica-se com credenciais master (`PROFESSOR_EMAIL` / `PROFESSOR_PASSWORD`).
   - **Gestão de Professores**: Realiza CRUD de novos docentes (`POST/PUT/DELETE /professores`).
   - **Gestão de Cursos**: Cria os cursos (`POST/PUT/DELETE /cursos`), define senha de acesso anônimo do curso e vincula os professores responsáveis pela gestão pedagógica via `curso_professores`.

2. **Professor (`/professor`)**:
   - Autentica-se e acessa seus cursos vinculados em `Painel do Professor`.
   - **Disciplinas**: Seleciona o curso e faz CRUD das disciplinas/matérias.
   - **Aulas & Marp**: Abre a disciplina e cria/edita aulas usando o **Marp Markdown Editor** (com suporte a slides, KaTeX, Mermaid e preview em tempo real).
   - **Atividades & Reordenação**: Cria/edita atividades interativas e utiliza os botões ou recurso **Drag & Drop** (`Reordenar`) para definir a sequência pedagógica de aulas e atividades.
   - **Avaliação**: Acessa `Ver Respostas dos Alunos` em cada atividade, atribui notas numéricas e feedbacks individuais.
   - **Relatórios**: Clica em `Gerar Feedback da Disciplina` para redigir a devolutiva geral da turma, ajustar os comentários individuais e disparar notificações por e-mail via `POST /disciplinas/:id/enviar-emails-feedback`.

3. **Aluno (Área Pública - `/`)**:
   - Navega anonimamente pelos cursos disponíveis.
   - Se o curso possuir senha (`cursos.senha`), o modal `Acesso Restrito` solicita a verificação antes de liberar disciplinas.
   - **Aulas**: Abre os slides renderizados pelo backend/Marp em popup seguro (window.open).
   - **Atividades**: Responde a atividade (passo-a-passo por pergunta ou minigame/roleta), salva rascunho local ou no servidor (código de 30 dias), opcionalmente marca a checkbox para **receber comprovante com suas respostas por e-mail** (conforme LGPD) e submete a resposta.

### 7.2 Modalidades e Tipos de Atividades Disponíveis

O sistema suporta 4 tipos principais de atividades interativas (armazenadas na coluna `tipo` e estruturadas em `json_data`):

| Tipo | Chave `tipo` | Características e Comportamento |
|---|---|---|
| **Normal / Prova** | `normal` / `prova` | Avaliação formal com perguntas objetivas ou discursivas. Exibe pontuação e porcentagem de acertos ao final se houver gabarito. |
| **Reforço** | `reforco` | Focado na aprendizagem contínua. Apresenta feedback pedagógico imediato após cada pergunta sem caráter eliminatório. |
| **Minigame** | `minigame` | Formato gamificado interativo. Registra pontuação e tempo de conclusão, alimentando a tabela `ranking` (expurgo automático em 30 dias). |
| **Roleta** | `roleta` | Atividade dinâmica de sorteio de perguntas. Utilizada em dinâmica de grupo ou revisão presencial/híbrida em sala de aula. |

> **Controle de Acesso por Atividade**: Atividades individuais podem opcionalmente ter `allow_password: 1` e uma senha própria (`atividades.senha`), exigindo uma confirmação secundária do aluno ao abrir a atividade.

---

## 8. Testes E2E (Playwright via Docker — caminho oficial)

### Escopo
Há 11 specs em `e2e/tests/`. Status verificados (todos 100% passando):

| Spec | Status | Cobre |
|---|---|---|
| `admin.spec.ts` | ✅ atual | Login admin, CRUD professor/curso via UI |
| `auth.spec.ts` | ✅ atual | Credenciais inválidas, redirects p/ `/login?redirect=` |
| `professor.spec.ts` | ✅ **atualizado** | CRUD de disciplinas, aulas (Marp), atividades e reordenação via UI |
| `aluno.spec.ts` | ✅ atual | Acesso anônimo, modal de senha de curso, visualização de aulas em popup e envio de respostas |
| `aluno-atividades-avancadas.spec.ts` | ✅ atual | Fluxos de minigames/roleta/reforço e senhas de atividade |
| `aluno-comprovante-email.spec.ts` | ✅ **novo** | Submissão de resposta com opt-in de e-mail e validação de entrega do comprovante via Mailhog |
| `aluno-lgpd.spec.ts` | ✅ atual | Direito de consulta e exclusão de dados do aluno conforme LGPD |
| `atividade-fluxo.spec.ts` | ✅ atual | Importação e exportação de JSON de atividades |
| `atividade-rascunhos.spec.ts` | ✅ atual | Salvamento e restauração de rascunhos de atividades (30 dias) |
| `email-feedback.spec.ts` | ✅ atual | Entrega real de e-mails de feedback pedagógico via Mailhog |
| `fluxo-completo.spec.ts` | ✅ atual | Jornada completa de ponta a ponta (Professor → Aluno → Avaliação → Feedback) |

### Como executar
```bash
# Caminho oficial (reproduz CI, isento de problema local):
cd e2e && npm install && npx playwright test

# OU o mesmo via compose (o global-setup local sobe a stack sozinha):
PROFESSOR_PASSWORD=ProfessorUzeda! npx playwright test --config e2e/playwright.config.ts
```

**`PLAYWRIGHT_CONFIG` ou `E2E_ADMIN_PASSWORD`/`PROFESSOR_PASSWORD` é obrigatório** — sem ele, `playwright.config.ts` lança erro.

- **Local (fora do container):** `global-setup` roda `docker compose -f docker-compose.e2e.yml down --remove-orphans`, apaga `backend/data/e2e-test.db` (+`-wal`/`-shm`), sobe `bun-server`+`vite`, aguarda `/db-test` e frontend; `global-teardown` derruba o compose.
- **Container** (`PLAYWRIGHT_CONTAINER=true` no compose): só espera os serviços.

### Resultados
- Reporter `list`; trace on-first-retry; screenshot only-on-failure; video retain-on-failure. PDF/vídeo ficam em `e2e/test-results/`.

---

## 9. Guia de escrita de testes E2E

### Helpers (`e2e/helpers.ts`)
- `unique(prefix)` / `uniqueName(prefix)` — sufixo `_{Date.now()}_{rand}`
- `setupAdminContext(request)` → `{adminToken}`; `createProfessor(...)` → `{id, nome, email, password}` (senha `'senha12345'`, role professor); `createCurso(request, adminToken, professorIds=[])` → `{id, nome, slug}` (sem senha por padrão); `createMateria(request, profToken, cursoId)` → `{id, nome, slug}` (disciplina; a senha da disciplina foi removida — o acesso é controlado pela senha do curso); `cleanupEntities(request, adminToken, cursoId?, professorId?)`.
- `loginViaUI(page, email, password, expectedUrl)` — `/login` → fill placeholders → `Entrar` → `waitForURL`.
- `profLogin` + `api` (GET/POST/PUT/DELETE autenticado, sem prefixo `/api`) são definidos localmente em `aluno.spec.ts` e `fluxo-completo.spec.ts` (copie o padrão).

### Seletores atuais (verificados) — resumo rápido
- **Login**: placeholders `professor@local` e `••••••••`; botão `Entrar`.
- **Aluno**: heading `Área do Aluno`; card curso/disciplina = `h3` (nome); tabs `Aulas (N)`/`Atividades (N)`; aula abre em popup com URL contendo `/materias/`; PasswordModal: `Acesso Restrito` + placeholder `Digite a senha`.
- **ActivityModal (aluno)**: duas `getByLabel('Seu Nome *'/'Seu E-mail *')`; opções objetivas são **botões** (nome = texto da opção, ex. `Brasília`); success `h3 'Resposta Enviada com Sucesso!'` + `Correção do servidor: X / Y acertos`.
- **Professor**: heading `Painel do Professor`; curso card `h3`; disciplina `h3` + botão `Gerenciar Aulas & Atividades`; botão `Ver Respostas dos Alunos`; `Gerar Feedback da Disciplina`.
- **RespostasModal**: `Total de Envios: {n}`; botão `Avaliar / Ver`; inputs `placeholder='Ex: 85'` (nota) e `placeholder='Escreva um comentário pedagógico para este aluno...'` (feedback); sucesso `Avaliação Salva!`; botão `Fechar`.
- **FeedbackConsolidadoModal**: heading `Relatório de Feedback da Disciplina`; textarea da turma (placeholder `Digite um comunicado ou feedback geral para toda a turma...`); botão `Salvar Feedback da Turma` → `Feedback Geral da Turma salvo com sucesso!`; input individual (placeholder `Escreva observações pedagógicas gerais para este aluno...`); botão `Salvar Feedback` → `Feedback para {nome} salvo!`; badges `E-mail Enviado`/`E-mail Pendente`.

### Programação defensiva
- Monte a cena via API em `beforeAll`; use a UI só para o comportamento sob teste; valide efeitos via API sempre que possível (ex.: relatorios).
- Ao abrir aula: `const [popup] = await Promise.all([context.waitForEvent('page'), h3.click()])` e valide `popup.content()` antes de fechar.
- Limpe dados com `cleanupEntities` em `afterAll`.

---

## 10. Armadilhas validadas (leia antes de editar != código)

1. **Senha é exclusiva do curso**: `disciplinas` não possui mais coluna `senha`. O acesso anônimo a aulas/atividades checa apenas `cursos.senha`. Para fluxo anônimo sem modal de senha, crie o curso sem senha.
2. **`GET /cursos/:id` devolve `senha` inclusive para anônimos**; `GET /cursos/:id/disciplinas` anon omite campos.
3. **Tailwind JIT** só com classes literais.
4. **Marp** grava em `resolveFrontendDir()` → no container `/app/frontend_static` (bind de `./frontend/dist/`). Se `frontend/dist/` não existir no host, o mount cria pasta vazia e aulas dão 404 → **rode `npm run build` no frontend antes de E2E**.
5. **E-mail**: sem SMTP, `enviar-emails-feedback` roda com `enviados=0` (não lança). Para testar entrega real, adicionar um SMTP fake (ex.: Mailhog) ao compose.
6. **Não existe `hashData`** — use `hashEmail` (bug histórico já corrigido em `routes.ts`).
7. **Compose e2e usa `DATABASE_PATH`** (não `DB_PATH`) para bater com o reset do `global-setup`.
8. **`e2e/node_modules` local pode estar quebrado** (root/stale; lock `@playwright/test@1.62.1` vs package.json `1.50.0` e imagem `v1.50.0-noble`) → **rode por Docker** (container faz `npm install` limpo). Não troque versões sem necessidade.
9. **`npm run build` no frontend pode falhar com EACCES** em `dist/assets` (dono root) — problema pré-existente do ambiente local.
10. **Vite proxy não cobre `/disciplinas`** — aulas são servidas sob `/materias`.
11. **Legado**: `frontend-vue/` é a app Vue antiga — não editar.

---

## 11. Design System — estado atual (débito técnico resolvido)

> Débito de design system resolvido em 2026-08-13 (ver histórico de commit). Documentação canônica de tokens/escalas/contraste: **`DESIGN.md`** (raiz). Esta seção é o espelho para IAs.

### 11.1 Tokens de cor (fonte de verdade)
Definidos em `frontend/src/shared/style.css` como CSS vars, mapeados em `tailwind.config.js` (`colors → var(--c-*)`): `surface, surface-alt, primary, secondary, line, accent, danger, success` (+ `on-success, on-danger, danger-text` e `cat-{minigame,roleta,reforco,default}`/`-bg`). Dark mode via classe `.dark` (ThemeToggle). Tokens de raio (`rounded-control/card/modal/pill`), sombra (`shadow-card/modal`) e tipografia (`text-display/h1/h2/caption`) também definidos em `tailwind.config.js`; espaçamento segue a escala padrão do Tailwind.

### 11.2 Padronização de cor (resolvido)
- Todos os componentes (**base/modais** e **conteúdo**) usam os tokens `--c-*`; não há mais sistemas de cor paralelos. Chips de categoria de atividade usam `cat-*`, e `RoletaModal`/`MinigameModal`/`AdminView`/`AtividadeCard` migraram de cores Tailwind fixas (`purple-/pink-/cyan-/sky-`) para tokens. `ColorPicker`/`IconPicker` continuam exceção legítima (paleta de seleção).
- **Regra ao editar UI:** prefira os tokens `--c-*`; não introduza novas cores Tailwind literais fixas (quebram o dark mode).

### 11.3 Contraste WCAG 2.1 AA 4.5:1 — resolvido
Texto normal exige ≥4.5:1; não-texto (bordas) exige ≥3:1. Resolvido via tokens dedicados:
- Botões de **sucesso/danger** e mensagens de **erro** usam `--c-on-success` / `--c-on-danger` / `--c-danger-text` (garante ≥4.5:1 nos dois temas).
- Bordas/separadores usam `--c-line:#64748b` (≥3:1 contra `surface` em ambos os temas).
- Texto principal/secundário e chips de categoria (`cat-*`) já atingiam ≥4.5:1.

**Ao mexer em botões/erros:** usar os tokens `--c-on-success`/`--c-on-danger`/`--c-danger-text` (garante ≥4.5:1 nos dois temas); manter `--c-line` em ≥3:1.

### 11.4 Design system documentado
Há `DESIGN.md` na raiz documentando tokens de cor, escalas de raio/sombra/tipografia, regra de contraste WCAG AA e catálogo de componentes. Ao criar componente, documente props/uso aqui e no `DESIGN.md`.

### 11.5 Remediação — concluída (2026-08-13)
1. ✅ Contraste de botões success/danger + erros (tokens `on-*`/`danger-text`). 2. ✅ Bordas ≥3:1 (`--c-line:#64748b`). 3. ✅ Tokenizar cores fixas (`cat-*`). 4. ✅ Tokens de raio/sombra/tipografia. 5. ✅ `DESIGN.md` criado.