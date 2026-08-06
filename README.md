# Repositório de Aulas — EFG (Escola do Futuro de Goiás)

Plataforma educacional completa para gestão de cursos, matérias, aulas interativas com apresentações Markdown/Marp, gamificação (minigames, roletas, provas e reforço) e controle de acesso multi-professor, desenvolvida com foco em alta performance, segurança e conformidade com a LGPD.

---

## 🚀 Tecnologias Utilizadas

* **Backend:** [Bun](https://bun.sh/) + [Hono.js](https://hono.dev/) (TypeScript, SQLite via `bun:sqlite`, JWT, PBKDF2 SHA-256 600k iterations, Nodemailer SMTP, Marp CLI para geração de slides HTML).
* **Frontend:** Vue 3 (Composition API, Vite, Tailwind CSS, Pinia, Vue Router).
* **Gamificação:** Canvas HTML5 nativo para Minigame Arcade 2D e Roleta Interativa.
* **Testes & E2E:** Bun Test e Playwright E2E.
* **Containerização:** Docker e Docker Compose.

---

## 🐳 Ambientes Docker & Como Usá-los

O repositório possui **3 configurações de Docker Compose**, cada uma otimizada para um propósito específico:

### 1. `docker-compose.yml` — Ambiente de Desenvolvimento Local
Utilizado por desenvolvedores para alterar o código com **Hot Reload** (HMR) em tempo real.

* **Serviços:**
  * `bun-server`: Servidor backend rodando na porta `8080`.
  * `vite`: Servidor de desenvolvimento do Vue 3 rodando na porta `5173`.
* **Como iniciar:**
  ```bash
  cp example.env .env
  docker compose up --build
  ```
* **Acesso:** 
  * Frontend Vue: `http://localhost:5173` (as chamadas de API são redirecionadas automaticamente para o backend na porta `8080`).
  * Backend API: `http://localhost:8080`

---

### 2. `docker-compose.prod.yml` — Ambiente de Produção (Servidor)
Utilizado para publicar a aplicação em produção. Possui **dois modos** controlados por **Docker Compose Profiles**:

---

#### ❓ Por que existem as Opções A e B?

* **Opção A (`--profile with-nginx`)** — Para servidores dedicados ou VPSs **sem** Nginx instalado no host. O próprio Docker sobe um container Nginx que cuida das portas 80/443, emite e renova automaticamente os certificados HTTPS via **ACME/Let's Encrypt (Certbot)**.
* **Opção B (sem profile)** — Para servidores onde **já existe um Nginx (ou outro proxy) no host** gerenciando certificados SSL. O Docker sobe apenas o `bun-server` em uma porta interna (padrão `8080`), e o proxy do host repassa o tráfego.

---

#### 📌 Opção A: Com nginx + HTTPS Automático via Let's Encrypt (Servidor Dedicado)

Nesta opção o Docker gerencia tudo: Nginx (reverse proxy), Certbot (emissão/renovação de certificados ACME) e o bun-server (API + SPA).

**Pré-requisito:** o domínio `SERVER_NAME` deve apontar para o IP do servidor antes de emitir o certificado.

**1. Configure o `.env`:**
```bash
cp example.env .env
# Edite e defina obrigatoriamente:
# SERVER_NAME=repositorio.dominio.com
# sslDir=/var/www/ssl
# verificationDir=/var/www/certbot
# PROFESSOR_PASSWORD=SuaSenhaForte!
# JWT_SECRET=SuaChaveSecreta
```

**2. Primeiro boot — Suba apenas o nginx para liberar a porta 80 para o desafio ACME:**
```bash
docker compose -f docker-compose.prod.yml --profile with-nginx up -d
```
> O nginx sobe em modo HTTP-only (sem certificado ainda) e o bun-server fica disponível internamente.

**3. Emita o certificado SSL (execute uma única vez):**
```bash
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d repositorio.dominio.com \
  --email seu@email.com \
  --agree-tos --no-eff-email
```

**4. Reinicie o nginx para carregar o certificado:**
```bash
docker compose -f docker-compose.prod.yml restart nginx
```

**5. Renovação automática:** O container `certbot` já executa `certbot renew` a cada 12 horas automaticamente. Nenhuma configuração adicional é necessária.

**Acesso:** `https://repositorio.dominio.com` — com HTTPS/TLS ativo e renovação automática.

---

#### 📌 Opção B: Sem nginx no container (Proxy Externo no Host)

Para servidores onde o Nginx (ou qualquer outro proxy) já roda no host e você quer apenas acrescentar este projeto como mais um subdomínio.

**1. Configure o `.env`:**
```bash
cp example.env .env
# PORT=8080   (ou outra porta interna livre)
```

**2. Suba apenas o bun-server:**
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

**3. Adicione o subdomínio no Nginx do host** (ex: `/etc/nginx/sites-available/repositorio.conf`):

```nginx
# Redirecionamento HTTP -> HTTPS
server {
    listen 80;
    server_name repositorio.dominio.com;
    return 301 https://$host$request_uri;
}

# Proxy Reverso HTTPS -> Docker porta 8080
server {
    listen 443 ssl http2;
    server_name repositorio.dominio.com;

    ssl_certificate     /etc/letsencrypt/live/repositorio.dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/repositorio.dominio.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
    }
}
```

**4. Ative e recarregue o Nginx do host:**
```bash
sudo ln -s /etc/nginx/sites-available/repositorio.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---


### 3. `docker-compose.e2e.yml` — Ambiente de Testes E2E (Playwright)
Ambiente isolado em portas alternativas para rodar testes automatizados de ponta a ponta sem interferir no banco de dados de desenvolvimento ou produção.

* **Serviços:** `e2e-bun-server` (porta `18080`, banco `e2e-test.db`) + `e2e-vite` (porta `15173`).
* **Como iniciar:**
  ```bash
  docker compose -f docker-compose.e2e.yml up -d --build
  ```

---

## 🛠️ Funcionalidades da Plataforma

### 🎓 Para Alunos / Estudantes
* **Navegação de Cursos e Matérias:** Visualização intuitiva de cursos, disciplinas, ícones e descrições pedagógicas.
* **Acesso Protegido:** Matérias com suporte a senha de acesso configurável pelo professor.
* **Aulas Interativas com Slides:** Aulas apresentadas em slides modernos compilados via Marp com suporte a diagramas de fluxo [Mermaid.js](https://mermaid.js.org/).
* **5 Tipos de Atividades Pedagógicas:**
  1. **Atividade Normal:** Questionários discursivos e teóricos com salvamento automático de rascunhos.
  2. **Prova / Avaliação Diagnóstica:** Avaliações estruturadas com proteção por senha.
  3. **Minigame de Defesa Cibernética:** Jogo estilo *arcade space shooter* 2D em HTML5 Canvas, gamificado com perguntas pedagógicas e contagem de pontos.
  4. **Roleta do Conhecimento:** Sorteio interativo de categorias de perguntas com feedbacks pedagógicos imediatos.
  5. **Reforço:** Exercícios de fixação e autoavaliação com alternativas de múltipla escolha.
* **Tabela de Liderança Gamificada (Ranking):** Exibição de pontuações nos minigames com nomes sanitizados conforme LGPD (`Nome I.`).
* **Privacidade & Autonomia LGPD (Art. 18):** Formulário de consulta e solicitação de exclusão das próprias respostas enviadas utilizando e-mail e token seguro de consulta.

### 👨‍🏫 Para Professores e Administradores
* **Autenticação Segura:** Autenticação JWT com PBKDF2 SHA-256 (600k iterações) e sistema de aprovação de contas de professores por administradores (`status: pendente` -> `status: ativo`).
* **Gestão de Cursos e Matérias:** Criar, editar, organizar e personalizar cores, ícones e senhas de matérias e cursos.
* **Vínculo Multi-Professor:** Múltiplos professores podem ser vinculados para gerenciar um mesmo curso.
* **Gerador de Aulas Marp:** Criador de aulas em Markdown com suporte a diagramas Mermaid e compilação em HTML5 profissional.
* **Editor Visual de Atividades:** Criador e editor visual de questionários, roletas, provas e minigames.
* **Gestão de Respostas de Alunos:** Visualização, filtragem por disciplina/turma e descarte de submissões de alunos.
* **Gestão de Usuários (Exclusivo Admin):** Aprovação de novos registros de professores, definição de papéis (`admin` / `professor`) e remoção de contas.

---

## ⚙️ Variáveis de Ambiente (`.env`)

Crie o arquivo `.env` na raiz copiando o arquivo de exemplo:
```bash
cp example.env .env
```

| Variável | Descrição | Padrão |
|---|---|---|
| `PROFESSOR_EMAIL` | E-mail do Administrador criado no 1º boot | `admin@local` |
| `PROFESSOR_PASSWORD` | Senha inicial do Administrador (Obrigatório alterar) | — |
| `JWT_SECRET` | Chave secreta para assinatura dos tokens JWT | — |
| `PORT` | Porta TCP exposta no Docker e no backend Bun | `8080` |
| `HOST` | IP de escuta do servidor backend | `0.0.0.0` |
| `DATA_DIR` | Pasta de dados e SQLite | `./backend/data` |
| `DB_PATH` | Caminho do arquivo SQLite principal | `./backend/data/app.db` |
| `SMTP_HOST` | Servidor SMTP para envio de e-mails | `smtp.zoho.com` |
| `SMTP_PORT` | Porta do servidor SMTP (465 SSL / 587 STARTTLS) | `465` |
| `SMTP_USERNAME` | Usuário de autenticação SMTP | — |
| `SMTP_PASSWORD` | Senha da conta SMTP | — |
| `MAIL_FROM` | Endereço remetente exibido nas mensagens | — |

---

## 🧪 Testes e Qualidade

### Executar Testes Unitários e de Integração (Backend)
```bash
cd backend
bun test
```

### Executar Testes E2E (Playwright)
```bash
docker compose -f docker-compose.e2e.yml up -d --build
cd e2e
npx playwright test
```

---

## 🔒 Conformidade LGPD & Segurança

* **Auditoria LGPD:** A documentação completa da auditoria de privacidade (ROPA, RIPD, DPO, Bases Legais, Matriz de Retenção, Política de Privacidade e Incidentes) está mantida na pasta [.lgpd/STATUS.md](.lgpd/STATUS.md).
* **Débito Técnico & Roadmap:** Acompanhe os débitos técnicos corrigidos e pendentes de segurança em [DEBITO_TECNICO.md](DEBITO_TECNICO.md).

---

## 📄 Licença

Este projeto está licenciado sob a licença MIT — veja o arquivo [LICENSE](LICENSE) para mais detalhes.
