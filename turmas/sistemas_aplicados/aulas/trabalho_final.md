---

marp: true 
theme: default 
paginate: true 

---

# Engenharia Reversa com Git

### O Arqueólogo de Software e o Ciclo de Vida (SDLC)

---

## <i class="fa-solid fa-bullseye"></i> Objetivos da Missão

Ao final desta atividade, você será capaz de:

  * **Aplicar** o conceito de Engenharia Reversa para entender um software legado.
  * **Mapear** as fases do SDLC (Ciclo de Vida de Desenvolvimento de Software) a partir de um código pronto.
  * **Utilizar** branches do Git para segregar diferentes tipos de documentação e tarefas.
  * **Praticar** a leitura técnica de código HTML/JS (Sistema de Alocação).

---

## <i class="fa-solid fa-book-skull"></i> O Cenário: O Código Perdido

Imagine que você foi contratado por uma escola. O antigo desenvolvedor criou um **"Sistema de Alocação de Professores"** (`index.html`), mas desapareceu sem deixar documentação.

O sistema funciona, mas ninguém sabe **como** foi planejado, **quais** são as regras exatas ou **como** expandi-lo.

  * **Sua Tarefa:** Você não vai codificar (já está pronto!). Você vai reconstruir a história desse software.
  * **Sua Ferramenta:** O Git será sua máquina do tempo e organizador.

---

## <i class="fa-solid fa-code-branch"></i> Estratégia de Branches

O código atual está na branch `main` (Implementação). Você criará **4 branches** para reconstruir o entorno:

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 350" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
  <rect width="800" height="350" fill="#f8f9fa" rx="10" />

  <style>
    .branch-path { fill: none; stroke-width: 3; stroke-linecap: round; }
    .main-line { stroke: #1a3a6e; stroke-width: 4; }
    .node { stroke: #fff; stroke-width: 2; r: 9; }
    .label { font-size: 13px; font-weight: 800; fill: #222; }
    .sub-label { font-size: 11px; fill: #666; font-style: italic; }
    .tag-main { fill: #1a3a6e; font-size: 11px; font-weight: bold; }
  </style>

  <line x1="50" y1="175" x2="750" y2="175" class="main-line" />
  <text x="760" y="179" class="tag-main">MAIN</text>

  <circle cx="90" cy="175" r="12" fill="#1a3a6e" stroke="#fff" stroke-width="2"/>
  <text x="90" y="215" class="label" text-anchor="middle">Código Pronto</text>

  <path d="M 130 175 C 130 90, 180 90, 230 90" class="branch-path" stroke="#8854d0"/>
  <circle cx="230" cy="90" class="node" fill="#8854d0"/>
  <text x="245" y="85" class="label">1. Especificação</text>
  <text x="245" y="100" class="sub-label">Reqs & Regras</text>
  <circle cx="130" cy="175" r="4" fill="#8854d0"/>

  <path d="M 290 175 C 290 90, 320 90, 370 90" class="branch-path" stroke="#20bf6b"/>
  <circle cx="370" cy="90" class="node" fill="#20bf6b"/>
  <text x="385" y="85" class="label">2. Design</text>
  <text x="385" y="100" class="sub-label">wireframes.md</text>
  <circle cx="290" cy="175" r="4" fill="#20bf6b"/>

  <path d="M 430 175 C 430 260, 460 260, 510 260" class="branch-path" stroke="#eb3b5a"/>
  <circle cx="510" cy="260" class="node" fill="#eb3b5a"/>
  <text x="525" y="255" class="label">3. Testes</text>
  <text x="525" y="270" class="sub-label">bugs.md</text>
  <circle cx="430" cy="175" r="4" fill="#eb3b5a"/>

  <path d="M 570 175 C 570 90, 600 90, 650 90" class="branch-path" stroke="#fc5c65"/>
  <circle cx="650" cy="90" class="node" fill="#fc5c65"/>
  <text x="665" y="85" class="label">4. Manutenção</text>
  <text x="665" y="100" class="sub-label">roadmap.md</text>
  <circle cx="570" cy="175" r="4" fill="#fc5c65"/>

</svg>

---

## Passo 1: Especificação (O Problema e as Regras)

**Branch:** `git checkout -b fase-1-especificacao`

Nesta fase dupla, você deve entender **o que** o usuário vê e **como** o sistema decide.

1.  **Requisitos (Visual):** Olhe a tela. Quem é o usuário? O que ele ganha com isso?
    * *Ação:* Crie `requisitos.md` com 2 História de Usuário.
2.  **Análise (Lógica):**  Identifique as regras de negcio.
    * *Ação:* Adicione 4 requisítos funcionais e 4 não funcionais

---

# Fase 1 — Template  

### 👤 Histórias de Usuário
1. **Como [tipo de usuário]**, eu quero [ação desejada], para que [benefício].
2. **Como [tipo de usuário]**, eu quero [ação desejada], para que [benefício].

---

### ⚙️ Requisitos Funcionais
1. O sistema deve [...]
2. O sistema deve [...]
3. O sistema deve [...]
4. O sistema deve [...]


### 🧱 Requisitos Não Funcionais
1. O sistema deverá carregar [...]
2. O layout deverá [...]
3. A aplicação deverá suportar [...]
4. O comportamento deverá ser [...]

---

## Passo 2: Como foi desenhado?

**Branch:** `git checkout -b fase-2-design`

Analise o visual do site, como ele foi arquitetado?

  * **Ação:** Crie um arquivo `estrutura_visual.md` ou desenhe em papel e tire foto.
  * **Tarefa:**
      * Desenhe o "Esqueleto" (Wireframe) da página baseando-se nas `divs` principais.
      * Liste a paleta de cores primária identificada no código.

*Isso ajuda a entender que o Design vem antes do código, mas aqui estamos fazendo o caminho inverso.*

---

# Fase 2 — Design  (Template)
### 🧩 Wireframe (Esboço Estrutural)
Desenhe aqui ou descreva as principais divisões da página.

- Header:
- Área de filtros:
- Tabela de resultados:
- Rodapé:

> (Opcional: colar foto do desenho do wireframe)

---

### 🎨 Paleta de Cores Identificada
- Cor primária: `#______`
- Cor secundária: `#______`
- Cor de destaque: `#______`


---

## Passo 3: O Sistema é Confiável?

**Branch:** `git checkout -b fase-3-testes`

Abra o `index.html` no navegador. Tente "quebrar" o sistema.

  * **Ação:** Crie um arquivo `bugs.md`.
  * **Teste de Estresse:**
    1.  O que acontece se eu carregar um arquivo CSV vazio?
    2.  O filtro de horário funciona se eu não selecionar nenhum dia?
    3.  A busca por nome diferencia maiúsculas de minúsculas?

*Registre os comportamentos inesperados e faça o commit.*

---

# Fase 3 — Testes  (Template)

### 🔍 Testes Realizados

#### 1. Teste: CSV vazio  
- **Ação:**  
- **Comportamento Esperado:**  
- **Comportamento Observado:**  
- **Resultado:** 

---

#### 2. Teste: Filtro sem selecionar dias  
- **Ação:**  
- **Comportamento Esperado:**  
- **Comportamento Observado:**  
- **Resultado:**  

---

#### 3. Teste: Busca com maiúsculas/minúsculas  
- **Ação:**  
- **Comportamento Esperado:**  
- **Comportamento Observado:**  
- **Resultado:**  

### 🐛 Lista de Bugs Encontrados
1. [descrição breve]  
2. [descrição breve]  
3. [descrição breve]

---

## Passo 4: O Futuro do Produto

**Branch:** `git checkout -b fase-4-manutencao`

O software precisa evoluir. Baseado no que você viu, o que falta?

  * **Ação:** Crie um arquivo `roadmap.md`.
  * **Proponha:**
      * Uma melhoria corretiva (para um bug achado na fase anterior).
      * Uma melhoria evolutiva (ex: botão de exportar resultados).
  * **Importante:** Não altere o HTML! Apenas documente o plano.

---

# Fase 4 — Manutenção  (template)

### 🛠️ Melhorias Corretivas (Bugfix)
1. Corrigir o problema onde [...]

### 🚀 Melhorias Evolutivas (Novos Recursos)
1. Adicionar a funcionalidade de [...]
2. Melhorar a experiência de [...]  

---

### 🗺️ Roadmap Proposto
| Prioridade | Item | Descrição | Tipo |
|-----------|-------|------------|-------|
| Alta | [...] | [...] | Corretiva |
| Média | [...] | [...] | Evolutiva |
| Baixa | [...] | [...] | Evolutiva |


### 📌 Observações Finais
- Nenhuma alteração no código foi feita.
- Este roadmap descreve planos futuros com base na análise do sistema atual.

---


## Reflexão Final

Ao desmontar o processo, percebemos que **Software não é apenas código**.

  * O código (`index.html`) é apenas a ponta do iceberg.
  * Abaixo dele, existe uma montanha de decisões (Especificação) e estruturas (Design).
  * Se você não documenta suas branches, o próximo "arqueólogo" terá o mesmo trabalho que você teve hoje.

**Entrega:** Faça o push de todas as branches para o repositório remoto.

---

## Material Complementar

  * **Documentação do Git:** Referência oficial para comandos de branch e checkout. [https://git-scm.com/doc](https://git-scm.com/doc)
  * **Tailwind CSS Docs:** Para entender as classes de design encontradas no arquivo. [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
  * **Manifesto Ágil:** Princípios que valorizam software funcionando, mas não descartam a documentação. [https://agilemanifesto.org/](https://agilemanifesto.org/)