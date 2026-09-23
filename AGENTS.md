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
bun test             # testes (suítes: auth, emailValidator, marp, ai, aiRag, features, atividades, respostas, utils, aiProvider)
```

> **DB de teste:** `backend/bunfig.toml` registra `src/testSetup.ts` como *preload*: a cada `bun test` o `data/test.db` (com `-wal`/`-shm`) é **apagado**, o seed roda limpo e `DISABLE_RATE_LIMIT=true` é ligado. Nunca dependa de estado deixado por execuções anteriores — a suíte é hermética. Helpers de fluxo (login, criar professor/curso/disciplina/aula/atividade) ficam em `backend/src/testHelpers.ts`.

### Frontend (workdir `frontend/`)
```bash
npm install
npm run dev          # vite --port 5173
npm run build        # vue-tsc && vite build  (gera dist/ — necessário p/ E2E)
bun test             # testes unitários (frontend/tests/, ex.: shuffle.test.ts)
```

### Typecheck / lint
```bash
npx vue-tsc --noEmit            # frontend (workdir frontend/)
npx vite build --outDir /tmp/... # build sem tocar dist root
```

### Git hooks (gate de qualidade local — `main`)
> ⚠️ Os hooks vivem **apenas em `.git/hooks/`** (não versionados) e não há CI no repositório — clone novo nasce sem eles. Se reescrever os hooks, considere versioná-los (`scripts/git-hooks/` + `git config core.hooksPath`).

**`pre-commit`** — 5 passos, todos bloqueantes; o gate **não escreve arquivos nem mexe no índice do git** (sem `--write`/`git add`):
1. **Lint** (Biome) em `backend/src`, `frontend/src` e `frontend/tests` — bloqueia **apenas erros** (warning pré-existente passa; `biome lint` sai com código 0 só com warnings). Usa o binário local pinado pelo `package.json`; fallback `ghcr.io/biomejs/biome:2.5.8`.
2. **Paridade byte-a-byte** de `backend/src/marpTheme.css` × `frontend/src/shared/marpTheme.css` — edite os DOIS com o mesmo conteúdo.
3. Backend: `docker run --rm -e DATABASE_PATH=/tmp/pre-commit-test.db -v $PWD/backend:/app -w /app oven/bun:alpine bun test`.
4. Frontend: `docker run --rm -v $PWD/frontend:/app -w /app oven/bun:alpine bun test` (testes em `frontend/tests/`; passo ignorado se não houver arquivo `*.test.ts`).
5. Frontend: `docker run --rm -v $PWD/frontend:/app -w /app node:20-alpine npx vue-tsc --noEmit`.

Para reproduzir tudo de uma vez: `bash .git/hooks/pre-commit` (verde = 96 testes de backend + 10 de frontend + typecheck). **Não** está no hook: a suíte E2E do Playwright.

**Formatação (`biome format`) NÃO é gate — de propósito.** O repositório não é `biome format`-clean (arquivos antigos também acusam), então colocar format no hook bloquearia todo commit e geraria conflito em qualquer branch aberta. Se um dia normalizar, faça em **commit isolado** (só `npm run format`, sem mudança de lógica) + arquivo `.git-blame-ignore-revs` + `git config blame.ignoreRevsFile .git-blame-ignore-revs`; só depois disso considere torná-lo bloqueante.

**`post-merge`** roda somente quando o merge/pull é na `main`: `[1/4]` build do frontend em `/tmp/repoaulas-deploy-dist` → `[2/4]` `rsync` de `backend/` (exclui `node_modules/` e `data/`) + `docker-compose.prod.yml` + `dist/` → `[3/4]` `docker compose up -d --build --force-recreate` no servidor + espera `/health` 200 → `[4/4]` `node scripts/smoke-test-prod.mjs` (`--dry-run` também disponível).

**`scripts/smoke-test-prod.mjs`** (prod, 100% HTTP/API, com cleanup): health, login admin, cria professor/curso/vínculo, login do professor, disciplina, aula (Marp), **roleta com o gabarito fora da 1ª posição** (e valida que o `correct` chega ao aluno) e **prova validando que o gabarito NÃO vaza** no endpoint público, submissão conferindo `acertos/total/pontuacao`, **consulta LGPD com o `consulta_token`** e envio do código de rascunho. Envs: `PROD_API_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `NOTIFY_EMAIL` e `SMOKE_SKIP_EMAIL=true` (roda sem disparar e-mail — use para validar localmente contra o stack dev). Atenção: o cleanup apaga o curso (cascata no DB), mas os arquivos `.md/.html` da aula gerada permanecem em `frontend/dist/materias/<slug>/` (slug fixo `disciplina_smoke_test`, sobrescrito a cada deploy).

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
- `atividades` (disciplina_id, aula_id [NULL=geral], external_id, titulo, descricao, caminho, icone, `json_data`, tipo, senha, allow_password, ordem)
- `respostas_alunos` (atividade_id, aluno_nome, aluno_email, aluno_email_hash, respostas [criptografadas], consulta_token_hash, **nota REAL, feedback TEXT, enviado_em, entregue_com_atraso**, criado_em)
  - **Não existem** colunas `acertos`/`total`/`pontuacao` aqui: a correção objetiva é calculada na submissão e devolvida só na resposta HTTP (ver armadilha 13).
- `estatisticas_questoes` (atividade_id, questao_ref, acertos, erros, atualizado_em, UNIQUE(atividade_id, questao_ref)) — **agregado por questão, sem nenhum dado pessoal**: alimenta o diagnóstico da turma; é ajustado na primeira submissão, no reenvio (troca a contribuição) e em toda exclusão (professor ou LGPD).
- `rascunhos_atividades` (codigo_recuperacao, atividade_id, aluno_nome, aluno_email, aluno_email_hash, respostas_json [criptografadas], expira_em [30 dias], criado_em, atualizado_em)
- `disciplina_feedbacks` (disciplina_id, aluno_email_hash [NULL=turma], feedback_geral, enviado_em, criado_em, atualizado_em, UNIQUE(disciplina_id, aluno_email_hash))

**Convenção:** resposta individual tem `aluno_email_hash` preenchido; feedback de turma é o registro com hash NULL.

---

## 5. Convenções de código

- **Sem comentários** no código (salvo quando o usuário pedir).
- **Proibição estrita de Emojis:** É PROIBIDO o uso de emojis unicode em qualquer parte do projeto (código-fonte, templates Vue/HTML, componentes, mensagens de feedback/toast, modais, logs e documentação). Utilize SEMPRE **Material Icons** (`<span class="material-icons">nome_do_icone</span>`) ou **Font Awesome** (`<i class="fa ..."></i>` / atalhos `:fa-...:`).
- **Tailwind JIT** só gera classes **literais** — paletas de cores são escritas por extenso (ex.: `bg-indigo-600`); nunca monte strings de classe dinamicamente.
- **Reuse de UI:** prefira os componentes de `src/shared/components/` (ver seção 3) a repetir Tailwind literal. Antes de escrever um botão/input/card/modal/spinner/empty novo, verifique se o componente base já existe ou se o padrão merece ser extraído para lá.
- Nomes de arquivos: PascalCase para componentes (`.vue`), camelCase para stores/utilities.
- **Randomização de alternativas:** as atividades de múltipla escolha (roleta, reforço, minigame) e o `ActivityModal` (normal/prova) DEVEM exibir as alternativas em ordem aleatória — o gabarito não pode ficar em posição fixa. Use `shuffleQuestionOptions`/`shuffleArray` de `src/shared/utils/shuffle.ts` (Fisher-Yates + guarda `isOrderSensitiveOption`, que preserva a ordem de opções meta: "Todas/Nenhuma das anteriores", "Verdadeiro/Falso", itens romanos, "alternativa X"). A correção do backend é por **texto** da alternativa (`corrigirObjetivas`), então a ordem visual não afeta a nota. Na geração por IA, os exemplos de `formatoJson` em `backend/src/ai.ts` **devem manter a alternativa correta em posições variadas** (nunca sempre a primeira) — é sinal de viés para o modelo.
- Tipagem forte via TS em frontend e backend (Bun).
- Conexões/erros de DB não usam ORM; SQLite cru com `dbq`.

---

## 6. LGPD / privacidade (pontos relevantes ao mexer)

- Nome/email/respostas do aluno são **criptografados** ao submeter; e-mail vira hash para joins.
- `DELETE /respostas/:id` existe para direito de exclusão (LGPD).
- Consulta do aluno a suas respostas: `GET /aluno/minhas-respostas?email+token` e `DELETE` (token = `consulta_token`).
- E-mails reais exigem SMTP no `.env`; sem SMTP (ou com SMTP quebrado) `sendMail` **resolve** com `{success:false}` em vez de lançar. Quem decide o que fazer com a falha é quem chama: o envio de feedback em lote só conta/marca `enviado_em` quando `success === true` (falha deixa pendente para reenvio).

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
   - **Avaliação**: Acessa `Respostas` em cada atividade, atribui notas numéricas e feedbacks individuais.
   - **Relatórios**: Clica em `Gerar Feedback da Disciplina` para redigir a devolutiva geral da turma, ajustar os comentários individuais e disparar notificações por e-mail via `POST /disciplinas/:id/enviar-emails-feedback`. O botão `Desempenho da Turma` abre o diagnóstico agregado (`GET /disciplinas/:id/estatisticas`): acertos/erros por questão, com aviso de "Maioria acertou/errou", sem identificar aluno e com números ocultos quando a atividade tem menos de 5 respostas.

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
Há 16 specs em `e2e/tests/` (37 testes). Status verificados (todos 100% passando).

> **Revisão de seletores (2026-09-23):** a suíte estava com 3 falhas por rótulos desatualizados (não por bug de produto). Corrigido em `melhorias-recentes.spec.ts` e `fluxo-completo.spec.ts`: título do editor é **'Nova Atividade Interativa'** (não "Editor de Atividade Interativa"), botão de questão é **'Adicionar Pergunta'**, modo split é **'Lado a Lado'**, botão do RAG é **'Anexar Documento Geral do Curso'/'Anexar Documento da Disciplina'**, o campo de enunciado usa `placeholder="Digite o enunciado completo da questão para o aluno..."`, a aba do aluno é `role="tab"` (**não** button), a média aparece como **'Média da Disciplina: N/100'** ("N/100" sozinho casa 2 elementos → use o texto com prefixo) e o clique na disciplina deve mirar o `h3` **pelo nome** (`.first()` corre corrida com o card do curso). Fechar o modal RAG: `getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true })`.

| Spec | Status | Cobre |
|---|---|---|
| `admin.spec.ts` | ✅ atual | Login admin, CRUD professor/curso via UI |
| `auth.spec.ts` | ✅ atual | Credenciais inválidas, redirects p/ `/login?redirect=` |
| `professor.spec.ts` | ✅ **atualizado** | CRUD de disciplinas, aulas (Marp), atividades e reordenação via UI |
| `aluno.spec.ts` | ✅ atual | Acesso anônimo, modal de senha de curso, visualização de aulas em popup e envio de respostas |
| `aluno-atividades-avancadas.spec.ts` | ✅ atual | Fluxos de minigames/roleta/reforço e senhas de atividade |
| `aluno-comprovante-email.spec.ts` | ✅ atual | Submissão de resposta com opt-in de e-mail e validação de entrega do comprovante via Mailhog |
| `aluno-lgpd.spec.ts` | ✅ atual | Direito de consulta e exclusão de dados do aluno conforme LGPD |
| `atividade-conteudo.spec.ts` | ✅ atual | Descrição da atividade, título e descrições individuais de cada pergunta |
| `atividade-fluxo.spec.ts` | ✅ atual | Fluxo de rascunhos do professor no editor e resolução do aluno |
| `atividade-ia.spec.ts` | ✅ **atualizado** | Painel do gerador de atividades por IA integrado na aba Geral |
| `atividade-rascunhos.spec.ts` | ✅ atual | Salvamento e restauração de rascunhos de atividades (30 dias) |
| `aula-ia.spec.ts` | ✅ atual | Geração e pré-visualização de aulas assistidas por IA |
| `email-feedback.spec.ts` | ✅ atual | Entrega real de e-mails de feedback pedagógico via Mailhog |
| `fluxo-completo.spec.ts` | ✅ atual | Jornada completa de ponta a ponta (Professor → Aluno → Avaliação → Feedback) |
| `relacao-aula-atividade.spec.ts` | ✅ **novo** | Matriz completa: aula sem atividade, aula com atividade vinculada e atividade geral, com visão do professor e resolução do aluno |
| `melhorias-recentes.spec.ts` | ✅ **novo** | Modal RAG de documentos, prazos/deadlines no editor, prévia em tempo real, validação com correção de typo de e-mail e ciclo de vida |

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

### Testes de unidade/integração (`bun test`) — cobertura atual

| Arquivo | Cobre |
|---|---|
| `backend/src/auth.test.ts` | login/registro, aprovação, JWT, rate limit, isolamento multi-professor, headers de segurança |
| `backend/src/features.test.ts` | RAG (documentos de disciplina/curso), prazos + `entregue_com_atraso`, ciclo de vida (status), feedback em lote, avaliações em lote, relatório com médias |
| `backend/src/atividades.test.ts` | gabarito (`stripGabarito` em prova vs roleta/reforço/minigame), senha de atividade/curso, autorização por curso, vínculo multi-aula (`aula_ids`), sanitização de `caminho`, validação de payload |
| `backend/src/respostas.test.ts` | correção objetiva por texto (objeto/array/string), PII cifrada em repouso, gates de status/senha, upsert por e-mail, LGPD (consulta + exclusão em cascata), ranking (nome público, teto, ordenação), rascunhos (código, upsert, expiração com limpeza lazy) |
| `backend/src/utils.test.ts` | `sanitizeSlug`/`sanitizePathOrUrl` (traversal), `parseJsonOrNull`, round-trip de `encryptData`/`decryptData`, `hashEmail`, `hashSenhaCurso`, verificação de senha de curso (hash + legado texto puro), conteúdo estático protegido, `health`/`db-test` |
| `backend/src/autorizacao.test.ts` | matriz de autorização: rotas admin-only (admin 2xx / professor 403 / anônimo 401), professor intruso em disciplina/aula/atividade/status/respostas/avaliação/relatório/feedback/documentos com verificação de estado inalterado, token malformado/adulterado/sem `Bearer`, e o que é público por padrão |
| `backend/src/estatisticas.test.ts` | agregado por questão: contadores na 1ª submissão, reenvio que **substitui** a contribuição (não infla), exclusão pelo professor e exclusão LGPD devolvendo a contribuição, supressão com menos de 5 respostas (k-anonimato), questão discursiva nunca com números, authz (401/403/400) |
| `backend/src/professor.test.ts` | `POST /marp/render` (authz, validação, HTML standalone + alias `/api`), rascunhos do editor (CRUD, isolamento entre professores, limite de 20, limpeza de expirados) e CRUD admin de professores (sem vazar `senha_hash`/`salt`, 409 de e-mail duplicado, status inválido, troca de senha refletida no login, vínculos com cursos) |
| `backend/src/mailer.test.ts` | mailer com **SMTP falso in-process**: envelope (from/to/subject), template real com substituição + escape HTML, nome de template com traversal, template ausente, degradação sem SMTP; e rotas de e-mail (código de rascunho e feedback em lote contando/marcando só o que realmente saiu) |
| `frontend/tests/shuffle.test.ts` | `shuffleArray` (permutação, Fisher-Yates sem viés, não-mutação), `isOrderSensitiveOption`, `shuffleQuestionOptions` (preserva alternativas meta, não muta a origem) |

**Padrão de escrita (backend):** use `backend/src/testHelpers.ts` (`adminToken()` via `signJwt` — sem passar pelo rate limit de login; `unique()` para slugs/e-mails; `createProfessor`/`createCurso`/`createDisciplina`/`createAula`/`createAtividade`) e sempre limpe o que criou no `afterAll` (`deleteCurso`/`deleteProfessor`). Afirme a **resposta HTTP** e, quando fizer sentido, o **estado no banco** — teste também a *ausência* de efeito colateral (ex.: linha que não foi alterada) em cenários de acesso negado.

### Helpers (`e2e/helpers.ts`)
- `unique(prefix)` / `uniqueName(prefix)` — sufixo `_{Date.now()}_{rand}`
- `setupAdminContext(request)` → `{adminToken}`; `createProfessor(...)` → `{id, nome, email, password}` (senha `'senha12345'`, role professor); `createCurso(request, adminToken, professorIds=[])` → `{id, nome, slug}` (sem senha por padrão); `createMateria(request, profToken, cursoId)` → `{id, nome, slug}` (disciplina; a senha da disciplina foi removida — o acesso é controlado pela senha do curso); `cleanupEntities(request, adminToken, cursoId?, professorId?)`.
- `loginViaUI(page, email, password, expectedUrl)` — `/login` → fill placeholders → `Entrar` → `waitForURL`.
- `profLogin` + `api` (GET/POST/PUT/DELETE autenticado, sem prefixo `/api`) são definidos localmente em `aluno.spec.ts` e `fluxo-completo.spec.ts` (copie o padrão).

### Seletores atuais (verificados) — resumo rápido
- **Login**: placeholders `professor@local` e `••••••••`; botão `Entrar`.
- **Aluno**: heading `Área do Aluno`; card curso/disciplina = `h3` (nome); tabs `Aulas (N)`/`Atividades (N)`; aula abre em popup com URL contendo `/materias/`; PasswordModal: `Acesso Restrito` + placeholder `Digite a senha`.
- **ActivityModal (aluno)**: duas `getByLabel('Seu Nome *'/'Seu E-mail *')`; opções objetivas são **botões** (nome = texto da opção, ex. `Brasília`); success `h3 'Resposta Enviada com Sucesso!'` + `Correção do servidor: X / Y acertos`.
- **Professor**: heading `Painel do Professor`; curso card `h3`; disciplina `h3` + botão `Gerenciar Aulas & Atividades`; botão `Respostas` (seletor: `getByRole('button', { name: /Respostas/i })`); `Gerar Feedback da Disciplina`.
- **RespostasModal**: `Total de Envios: {n}`; botão `Avaliar / Ver`; inputs `placeholder='Ex: 85'` (nota) e `placeholder='Escreva um comentário pedagógico para este aluno...'` (feedback); sucesso `Avaliação Salva!`; botão `Fechar`.
- **FeedbackConsolidadoModal**: heading `Relatório de Feedback da Disciplina`; textarea da turma (placeholder `Digite um comunicado ou feedback geral para toda a turma...`); botão `Salvar Feedback da Turma` → `Feedback Geral da Turma salvo com sucesso!`; input individual (placeholder `Escreva observações pedagógicas gerais para este aluno...`); botão `Salvar Feedback` → `Feedback para {nome} salvo!`; badges `E-mail Enviado`/`E-mail Pendente`.

### Programação defensiva
- Monte a cena via API em `beforeAll`; use a UI só para o comportamento sob teste; valide efeitos via API sempre que possível (ex.: relatorios).
- Ao abrir aula: `const [popup] = await Promise.all([context.waitForEvent('page'), h3.click()])` e valide `popup.content()` antes de fechar.
- Limpe dados com `cleanupEntities` em `afterAll`.

---

## 10. Armadilhas validadas (leia antes de editar != código)

1. **Senha é exclusiva do curso**: `disciplinas` não possui mais coluna `senha`. O acesso anônimo a aulas/atividades checa apenas `cursos.senha`. Para fluxo anônimo sem modal de senha, crie o curso sem senha.
2. **`GET /cursos/:id` não expõe a senha nem seu hash** — devolve `possui_senha: 0 | 1` (booleano); `GET /cursos/:id/disciplinas` anônimo omite campos restritos. Validação de senha é feita via `POST /cursos/:id/verificar-senha`.
3. **Tailwind JIT** só com classes literais.
4. **Marp** grava em `resolveFrontendDir()` → no container `/app/frontend_static` (bind de `./frontend/dist/`). Se `frontend/dist/` não existir no host, o mount cria pasta vazia e aulas dão 404 → **rode `npm run build` no frontend antes de E2E**.
5. **E-mail**: sem SMTP, `enviar-emails-feedback` roda com `enviados=0` (não lança) e **não marca `enviado_em`** — o gate é o `success` devolvido por `sendMail`. Para testar a cadeia completa sem depender de servidor externo, `backend/src/mailer.test.ts` sobe um SMTP falso **in-process** (`Bun.listen`) e captura envelope/corpo. Para entrega real, o compose E2E já usa Mailhog.
6. **Não existe `hashData`** — use `hashEmail` (bug histórico já corrigido em `routes.ts`).
7. **Compose e2e usa `DATABASE_PATH`** (não `DB_PATH`) para bater com o reset do `global-setup`.
8. **`e2e/node_modules` local pode estar quebrado** (root/stale; lock `@playwright/test@1.62.1` vs package.json `1.50.0` e imagem `v1.50.0-noble`) → **rode por Docker** (container faz `npm install` limpo). Não troque versões sem necessidade.
9. **`npm run build` no frontend pode falhar com EACCES** em `dist/assets` (dono root) — problema pré-existente do ambiente local.
10. **Vite proxy não cobre `/disciplinas`** — aulas são servidas sob `/materias`.
11. **Legado**: `frontend-vue/` é a app Vue antiga — não editar.
12. **Senha do curso em `GET /cursos/:id/disciplinas`**: o caminho anônimo **exige a senha** (`?senha=` ou `x-curso-senha`); gestor (admin/dono) passa sem ela e recebe também as disciplinas ocultas + a coluna `status`. O frontend tem que repassar a senha já guardada — `cursoStore.fetchDisciplinas(cursoId, senha)` e o `AlunoView.handleSelectCurso` lê `secureGet('curso_senha_<id>')`; se a senha salva estiver inválida (professor trocou), o fetch falha, o storage é limpo e o `PasswordModal` reabre. Não chame esse endpoint sem senha para curso protegido: volta 401 e a lista fica vazia.
13. **A correção objetiva NÃO é persistida por aluno**: `corrigirObjetivas` roda na submissão e o resultado (`acertos`/`total`/`pontuacao`) só existe na **resposta HTTP** do POST — `respostas_alunos` não tem essas colunas. O boletim do professor usa `nota`, não acertos. O que existe de coletivo é a tabela `estatisticas_questoes` (por questão, anônima).
14. **Estatísticas da turma (`estatisticas_questoes`)**: são contadores **cumulativos por questão** e obedecem à invariante "agregado = soma das respostas atualmente guardadas" — por isso o reenvio do mesmo aluno remove a contribuição antiga antes de somar a nova, e toda exclusão (professor ou LGPD) decrementa (com piso 0). `GET /disciplinas/:id/estatisticas` só devolve números quando a atividade tem **≥ 5 submissões** (`MIN_SUBMISSOES_ESTATISTICAS`, k-anonimato); abaixo disso tudo vem `null`. Questões discursivas nunca têm números. Chave do contador é a mesma `questao_ref` usada na correção (`q.id` quando houver, senão o índice) — se o professor reescrever/reordenar questões, contadores órfãos podem sobrar (a leitura ignora, pois enumera as questões atuais do `json_data`).
15. **Ranking também exige senha do curso**: `GET /ranking/:atividade_id` valida a senha do curso dono da atividade (mesmo `readCursoSenha`: `?senha=`, `x-curso-senha`, `x-materia-senha` ou cookie `curso_senha`); admin/gestor do curso passa sem ela e atividade inexistente devolve 404. O `minigame-player.ts` anexa `?senha=$senhaCurso` na consulta — ao criar um novo consumidor do ranking (ou uma spec E2E), passe a senha, senão vem 401.
16. **Cuidado com o compose E2E vs. o dev**: `docker-compose.yml` (dev) e `docker-compose.e2e.yml` compartilham o mesmo *project name* **e os mesmos nomes de serviço** (`bun-server`, `vite`) — só os `container_name` diferem (`e2e-*`). Consequência: `down --remove-orphans` no arquivo E2E **derruba o stack de dev**, e mesmo o `down` simples pode afetar os containers do dev. Receita segura usada nas verificações: `docker compose -f docker-compose.e2e.yml up -d bun-server mailhog vite` → `docker compose -f docker-compose.e2e.yml run --rm --no-deps playwright npx playwright test` → `docker compose -f docker-compose.e2e.yml down --remove-orphans` → **restaurar o dev** com `docker compose up -d` e conferir `/health` (8080) e o Vite (5173).
17. **Papel de `owner` — PENDENTE (decidido deixar para depois)**: hoje só existe `admin`, e nenhum guarda impede excluir/rebaixar o último admin (inclusive a si mesmo). A decisão foi **não** criar a guarda de "último admin", porque o modelo alvo é um `owner` acima de `admin`. Perguntas em aberto para quando for implementar: quem nasce `owner` (promover o admin semeado no seed?); admins podem criar/remover admins ou isso vira exclusivo do owner; e como revogar privilégio na hora — hoje o `role` viaja no JWT por 24h, então rebaixar alguém não tira o poder dele até o token expirar (exigiria versão de token ou TTL curto para owner).

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

---

## 12. Débito técnico conhecido

Itens reconhecidos e **não** implementados, com o motivo e o ponto de entrada para quem for atacar:

| Item | Onde mexer | Situação |
|---|---|---|
| **Papel `owner` acima de `admin`** | `backend/src/db.ts` (seed/migração), `backend/src/auth.ts` (novo middleware), `frontend/src/admin/AdminView.vue` | Decisão pendente (ver armadilha 17). Hoje qualquer admin exclui/rebaixa outro admin, inclusive a si mesmo, e o último admin pode sumir. Perguntas em aberto: quem nasce `owner` (promover o admin semeado no seed?); admins podem criar/remover admins ou vira exclusivo do owner; como revogar privilégio na hora (**o `role` viaja no JWT por 24h** — exige versão de token ou TTL curto para owner); esconder a gestão de professores de quem não é owner. |
| **Validador antes de salvar a aula (Marp)** | `frontend/src/professor/components/MarpEditorModal.vue` (caminho de salvar) e `backend/src/marp.ts` | Pendente. Hoje só existe `repairRawHtmlBlocks()`, que **conserta na renderização**: um bloco HTML cru sem fechamento (`<style>`, `<script>`, `<template>`, `<textarea>`) faz o parser engolir o resto do documento e sumir com os slides seguintes. Falta uma barreira **preventiva no save** (`POST /aulas`, `PUT /aulas/:id`, `POST /marp/render`) que detecte tag crua sem fechamento, JS com erro de sintaxe (ex.: `new Function(...)` em sandbox, sem executar no contexto da página) e Markdown malformado, apontando o slide/linha antes de gravar `conteudo_md`. |
| **`Record<string, any>` em `dbq`/`parseBody`** | `backend/src/routes.ts` | Débito consciente: migrar para `unknown` gera 35+ erros de tipo em ~60 pontos e não muda nada em runtime (tipo é apagado). Revisitar só com tempo dedicado. |
| **`biome format` não é gate** | repositório | O repo não é format-clean (arquivos antigos também acusam) e o hook só bloqueia **erros** de lint. Caminho combinado: um commit isolado com `npm run format` (sem mudança de lógica) + `.git-blame-ignore-revs` (`git config blame.ignoreRevsFile .git-blame-ignore-revs`), feito em momento sem branches abertas; só depois tornar `biome format --check` bloqueante. |

> Referência de armadilhas relacionadas: §10 itens 13–16 (correção objetiva não persistida, estatísticas agregadas, ranking com senha e compose dev × e2e).