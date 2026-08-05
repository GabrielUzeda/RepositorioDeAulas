# Débito Técnico — Repositório de Aulas (EFG)

> Checklist de segurança, privacidade e LGPD.
> Última revisão: Atualização de conformidade de segurança e privacidade.

## Legenda de status

- ✅ **Resolvido** — implementado, verificado e commitado
- 🟡 **Em andamento / Parcial** — fechado em parte, falta algo
- 📋 **Aprovado p/ corrigir** — decisão fechada, aguarda execução
- 🔁 **Aceito / Mitigado** — risco aceito com mitigação parcial
- ⏸️ **Standby** — adiado por decisão do mantenedor

---

## Seção 2 — Críticos

### 2.1 — `/send-mail` aberto (relay de email)
**Status:** 🔁 Aceito / Mitigado
- [ ] (Opcional) Adicionar rate limit e validação de payload; manter simples e logado.

---

### 2.2 — Credenciais e senhas nos testes
✅ **RESOLVIDO**
- `ADMIN_SEED_PASSWORD` centralizado nos arquivos de teste (`backend/src/auth.test.ts` e `e2e/playwright.config.ts`), lendo dinamicamente de `process.env`.
- `example.env` atualizado com a documentação detalhada de cada variável de ambiente.

---

### 2.3 — Admin padrão em seed (`PROFESSOR_PASSWORD`)
✅ **RESOLVIDO**
- `backend/src/db.ts` lê `process.env.PROFESSOR_PASSWORD`. Documentado com clareza no `example.env`.

---

### 2.4 — JWT Secret com fallback
🔁 **Aceito / Mitigado**
- `example.env` documenta e instrui a alteração de `JWT_SECRET` em ambiente de produção.

---

### 2.5 — Controle de acesso (IDOR) em aulas/atividades/matérias
✅ **RESOLVIDO**
- `GET /atividades/:id`: exige senha ou token de professor.
- `GET /aulas/:id`: exige senha da matéria correspondente (`?senha=...`) ou token de professor autenticado.

---

### 2.6 — Senhas em plaintext (materias/atividades)
📋 **Aprovado p/ corrigir**
- [ ] Hash das senhas de matérias/atividades.
- [ ] Enviar senha por header/body em vez de query params `?senha=`.

---

### 2.7 — Permissões e rastreamento de artefatos
✅ **RESOLVIDO**
- Adicionados `.playwright-mcp/`, `e2e/test-results/` e `e2e/playwright-report/` no `.gitignore`.
- Removidos os arquivos da pasta `.playwright-mcp/` do rastreamento do Git (`git rm -r --cached .playwright-mcp`).

---

## Seção 3 — Altas / Médias

### 3.1 — Registro de Professores (`/auth/register`)
📋 **Aprovado p/ fluxo de aprovação de Admin**
- [ ] Campo `status (pending/active)` em `professores`.

---

### 3.2 — Proteção e Privacidade no `/ranking`
✅ **RESOLVIDO**
- Sanitização de nome público com `formatPublicName` (`João S.`).
- Ocultação de e-mails no retorno público do `GET /ranking/:id`.
- Aplicado **Rate Limiting** (`submissionLimiter`) na rota `POST /ranking`.

---

### 3.3 — Rate Limiting
✅ **RESOLVIDO**
- Aplicado `loginLimiter` para logins, `registerLimiter` para cadastros e `submissionLimiter` (20 req/min) para submissão de respostas e ranking.

---

### 3.5 — Porta 8080 exposta em produção
📋 **Aprovado**
- Exposição feita através do proxy reverso Nginx no `docker-compose.prod.yml`.

---

### 3.6 — Anti-cheat / Validação de Gabarito
📋 **Aprovado p/ corrigir no servidor**
- [ ] Mover a validação da opção correta para o servidor backend.

---

### 3.7 — Tratamento Global de Erros (`app.onError` e `e.message`)
✅ **RESOLVIDO**
- Adicionado middleware global `app.onError` no Hono sanitizando respostas para `500 Internal Server Error`.
- Sanitizadas as rotas `/db-test`, `/ranking`, `/submeter-resposta` para não vazar *stack trace* ou exceções internas do SQLite.

---

### 3.8 — Iterações do PBKDF2
📋 **Recomendado**
- [ ] Elevar iterações de 100.000 para ~600.000.

---

### 3.9 — Política de Segurança de Conteúdo (CSP)
📋 **Aprovado**
- [ ] Configuração de CSP no Nginx para aulas em Marp HTML.

---

### 3.10 — Criptografia de Rascunhos em `localStorage`
📋 **Aprovado**
- [ ] Implementar criptografia leve (Web Crypto) para rascunhos no navegador.

---

## Seção 4 — LGPD (Conformidade para Ambiente Educacional)

### 4.1 — Anonimização no Ranking Público (Art. 7º)
✅ **RESOLVIDO**
- `formatPublicName` anonimiza sobrenomes de alunos em exibições públicas.

### 4.2 — Coleta e Transparência para Menores (Art. 14 & Art. 6º, VI)
✅ **RESOLVIDO**
- Implementado o **Aviso de Privacidade LGPD (Dever de Informação)** no `ActivityModal.vue`.

### 4.3 — Direitos do Titular (Art. 18 LGPD)
✅ **RESOLVIDO**
- Endpoint `GET /aluno/minhas-respostas?email=` permite ao aluno consultar suas próprias submissões.
- Endpoint protegido por **Rate Limiting** para impedir scraping automatizado.
- Professores possuem painel visual no `RespostasModal.vue` para atender solicitações de exclusão de dados.

### 4.4 — Política de Retenção de Dados (Art. 15 e 16)
📋 **A ser automatizado**
- [ ] Definir rotina periódica para expiração/exclusão de respostas antigas do ano letivo anterior.

---

## Summary Checklist
- [x] [2.2] Remover fallbacks hardcoded de senhas nos testes e Playwright config
- [x] [2.5] Exigir senha no `GET /aulas/:id`
- [x] [2.7] Adicionar `.playwright-mcp` ao `.gitignore` e untrack do Git
- [x] [3.2] Rate limiting no `POST /ranking` e `GET /aluno/minhas-respostas`
- [x] [3.7] Middleware `app.onError` e remoção de `e.message` nas rotas
- [x] [4.1] Sanitização pública de nomes no ranking (`João S.`)
- [x] [4.3] Rota de auto-consulta de dados para o aluno (Art. 18 LGPD)