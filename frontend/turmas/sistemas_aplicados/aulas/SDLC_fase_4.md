---
marp: true
theme: default
paginate: true
math: katex
style: |
  @import url('https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;700&family=Roboto:ital,wght@0,400;0,700;1,400&display=swap');
  @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.3.0/css/all.min.css');
  section {
    font-family: 'Roboto', sans-serif;
    background-color: #f4f6fb;
    color: #2b2b2b;
    font-size: 26px;
    line-height: 1.5;
  }
  h1, h2, h3 {
    font-family: 'Roboto Slab', serif;
    color: #1a3a6e;
  }
  h2 {
    border-bottom: 2px solid #1a3a6e;
    padding-bottom: 10px;
    margin-bottom: 20px;
  }
  strong {
    color: #d62828;
    font-weight: 700;
  }
  code {
    background: #e0e0e0;
    color: #d63384;
    padding: 2px 5px;
    border-radius: 4px;
  }
  .mermaid {
    display: flex;
    justify-content: center;
    background: white;
    padding: 20px;
    border-radius: 10px;
  }
---

# SDLC Fase 4: Implementação (Codificação)
## Do Projeto à Realidade

<br>

<div style="text-align: center;">
  <i class="fa-solid fa-laptop-code fa-4x" style="color: #1a3a6e;"></i>
</div>

---

## Objetivos da Aula

* Compreender o papel central da fase de implementação no Ciclo de Vida do Software.
* Identificar as **boas práticas** essenciais: Clean Code, Versionamento e Code Review.
* Entender o fluxo de Integração Contínua (CI) como ferramenta de qualidade.
* Reconhecer armadilhas comuns no processo de codificação e como evitá-las.

---

## O Canteiro de Obras Digital

Imagine que o desenvolvimento de software é a construção de um edifício.
* **Fases Anteriores:** Já temos a planta baixa (Design) e a análise do solo (Requisitos).
* **Fase Atual (Implementação):** É o momento em que a equipe de construção entra em cena.
* **O Desafio:** Não basta empilhar tijolos. É preciso garantir que o encanamento (dados) flua, que a eletricidade (lógica) não cause curto-circuito e que as paredes (segurança) sejam sólidas.

> A codificação é a tradução da solução lógica para uma linguagem que a máquina entenda e execute.

---

## Pilar 1: Clean Code (Código Limpo)

Escrever código é, primeiramente, uma forma de comunicação com **outros seres humanos**, não apenas com o computador.

* **Legibilidade:** Nomes de variáveis devem revelar intenção (ex: `diasParaVencimento` em vez de `d`).
* **Funções Pequenas:** Cada função deve fazer apenas uma coisa e fazê-la bem.
* **Comentários:** O código deve se explicar sozinho; comentários explicam o "porquê", não o "como".

<i class="fa-solid fa-broom"></i> **Meta:** Se um colega novo ler seu código, ele deve entender a história que você contou sem precisar decifrá-la.

---

## Pilar 2: A Máquina do Tempo (Git)

O versionamento de código (Git) funciona como "checkpoints" em um videogame ou uma máquina do tempo segura.

* **Histórico:** Permite voltar a qualquer ponto anterior caso uma alteração quebre o sistema.
* **Trabalho em Equipe:** Permite que vários desenvolvedores trabalhem no mesmo "edifício" sem derrubar a parede do outro.
* **Rastreabilidade:** Sabemos quem colocou cada tijolo e por quê.

**Conceito chave:** *Commit* atômico — salve pequenas mudanças lógicas, não o trabalho de uma semana inteira de uma vez.

---

## Pilar 3: Code Review (O Inspetor de Obra)

Antes de "fechar a parede", um inspetor verifica se a fiação está segura. Isso é o Code Review.

* **Não é pessoal:** A revisão é sobre o código, não sobre o programador.
* **Aprendizado Mútuo:** Juniores aprendem com seniores, e seniores encontram novas perspectivas.
* **Qualidade:** Detecta bugs e falhas de segurança antes que cheguem ao usuário final.

<i class="fa-solid fa-magnifying-glass"></i> **Dica:** Um erro encontrado no Review custa 100x menos do que um erro encontrado em produção.

---

## Pilar 4: Integração Contínua (CI)

A CI é a esteira automatizada da fábrica. Cada vez que você salva o código, robôs (scripts) verificam se tudo funciona.

<div class="mermaid">
graph LR;
    A[Dev: Commit] --> B{Build Auto};
    B -->|Sucesso| C[Testes Unitários];
    B -->|Falha| D[Alerta Erro];
    C -->|Passou| E[Integração];
    C -->|Falhou| D;
    E --> F[Relatório];
    style A fill:#e1f5fe,stroke:#01579b
    style D fill:#ffcdd2,stroke:#b71c1c
    style F fill:#c8e6c9,stroke:#1b5e20
</div>

<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true });
</script>

---

## Erros Comuns e Prevenção

<i class="fa-solid fa-triangle-exclamation"></i> **Armadilha do "Funciona na minha máquina":**
* *Sintoma:* O código roda localmente, mas falha no servidor.
* *Solução:* Ambientes padronizados (Docker) e respeito à CI.

<i class="fa-solid fa-triangle-exclamation"></i> **Síndrome do Código Espaguete:**
* *Sintoma:* Lógica emaranhada, difícil de seguir, tudo misturado.
* *Solução:* Refatoração constante e seguir princípios SOLID.

<i class="fa-solid fa-triangle-exclamation"></i> **Ego na Programação:**
* *Sintoma:* Levar críticas do Code Review para o lado pessoal.
* *Solução:* Desenvolver mentalidade de crescimento; você não é seu código.

---

## Estudo de Caso: O Bug de 400 Milhões

Em 2012, a Knight Capital perdeu $440 milhões em 45 minutos.

* **O Erro:** Durante uma atualização, um código antigo (não utilizado) foi ativado acidentalmente em um dos servidores porque a **implementação manual** falhou e não houve verificação automatizada adequada.
* **A Lição:** A automação (CI/CD) e o Code Review rigoroso não são burocracia; são travas de segurança vitais para a sobrevivência do negócio.

---

## Aplicação no Mundo Real

Como grandes empresas (Google, Meta, Netflix) lidam com a implementação?

* **Milhares de Commits por dia:** Elas usam "Trunk Based Development".
* **Testes Automatizados:** Nenhuma linha de código entra sem passar por milhares de testes automáticos.
* **Feature Flags:** O código é implementado, mas a funcionalidade pode ser ligada ou desligada instantaneamente se der erro.

> A implementação moderna prioriza a **estabilidade** através da **agilidade controlada**.

---

## Reflexão Prática

Pense na última vez que você escreveu um texto ou código:

1.  Você revisou antes de entregar, ou enviou o primeiro rascunho?
2.  Se alguém criticasse uma parte do seu trabalho, como você reagiria?
3.  **Desafio:** Na sua próxima tarefa de código, tente explicar a lógica para um "Pato de Borracha" (Rubber Duck Debugging) antes de pedir ajuda. Isso força a clareza mental.

---

## Conclusão

A fase de Implementação é onde o abstrato se torna concreto.

* Não é apenas digitar linhas de comando; é construir estruturas sustentáveis.
* Ferramentas como **Git** e práticas como **Code Review** e **CI** transformam a programação de um ato solitário em uma engenharia robusta e colaborativa.
* **Próximo Passo:** Instalar o Git e realizar seu primeiro commit consciente, focando em uma mensagem clara.

---

## Material Complementar

* **Clean Code (Robert C. Martin):** A leitura fundamental para entender a diferença entre código que funciona e código que dura.
* **Documentação Oficial do Git:** Para aprofundar nos comandos e fluxos de trabalho. [https://git-scm.com/doc](https://git-scm.com/doc)
* **Refactoring.Guru:** Um excelente recurso visual para entender padrões de projeto e "code smells". [https://refactoring.guru/pt-br](https://refactoring.guru/pt-br)
* **The Pragmatic Programmer (Thomas & Hunt):** Aborda a mentalidade e a responsabilidade do desenvolvedor profissional.