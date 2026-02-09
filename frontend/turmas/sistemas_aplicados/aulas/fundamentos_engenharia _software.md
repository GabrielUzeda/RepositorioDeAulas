---
marp: true
paginate: true
math: katex
---

# Fundamentos da Engenharia de Software
---

## Objetivos da Unidade

* Compreender a Engenharia de Software como disciplina sistemática.
* Analisar o Ciclo de Vida de Desenvolvimento de Sistemas (SDLC).
* Aplicar técnicas de Engenharia de Requisitos focadas em projetos de dados.
* Diferenciar metodologias Ágeis de Tradicionais (Waterfall).

---

## Introdução: A Analogia da Construção

Imagine construir um arranha-céu sem planta, adicionando andares conforme a vontade dos moradores.

* O resultado seria instável, perigoso e custoso.
* **Software é igual:** sem engenharia, torna-se código "espaguete".
* A Engenharia de Software é o conjunto de ferramentas e métodos para construir sistemas robustos, escaláveis e confiáveis.
* Não é apenas *programar*, é *projetar* soluções.

---

## 1.1 Conceitos Fundamentais

A Engenharia de Software aplica princípios de engenharia ao desenvolvimento de software.

* **Sistemática:** Segue processos definidos, não o acaso.
* **Disciplinada:** Exige rigor na qualidade e testes.
* **Quantificável:** Mede custos, prazos e desempenho.
* **Foco no Produto:** O objetivo final é software funcional e útil, não apenas linhas de código.

---

## 1.2 Ciclo de Vida (SDLC)

O *Software Development Life Cycle* é a jornada do produto.

<div class="marmaid">
graph LR;
    A[Planejamento] --> B[Análise];
    B --> C[Design];
    C --> D[Implementação];
    D --> E[Testes];
    E --> F[Manutenção];

</div>

* Cada fase alimenta a próxima.
* Ignorar uma fase (ex: pular testes) cobra um preço alto no futuro.

---

## SDLC — Fase 1: Planejamento

**Objetivo:** Entender o problema, o contexto e a viabilidade do projeto.
**Principais Atividades:**
* Identificação do problema de negócio.
* Definição de objetivos e escopo.
* Estimativas iniciais de custo e cronograma.
* Análise de riscos (técnicos, legais, organizacionais).
**Resultado da fase:**  
📄 *Project Charter*, visão macro do sistema e aprovação para seguir adiante.
**Perguntas-chave:**
* Vale a pena construir isso?
* Quem serão os usuários?
* Quais riscos podem inviabilizar o projeto?

---

## SDLC — Fase 2: Análise de Requisitos

**Objetivo:** Entender profundamente o que o sistema deve fazer.

**Principais Atividades:**
* Entrevistas, workshops e observação de processos.
* Identificação de Requisitos Funcionais e Não-Funcionais.
* Criação de casos de uso, user stories e diagramas de fluxo.

**Resultado da fase:**  
📄 Documento de Requisitos formalizado ou backlog priorizado.

**Por que é crucial?**  
> Construir o sistema errado é muito pior do que construir um sistema com bugs.

---

## SDLC — Fase 3: Design (Arquitetura e Modelagem)

**Objetivo:** Definir **como** o sistema será construído.

**Principais Atividades:**
* Arquitetura (Monolito? Microserviços? Data Lake?).
* Modelagem de dados (DER, dicionário de dados).
* Design de interfaces (wireframes).
* Definição de tecnologias, APIs, integrações e padrões.

**Resultado da fase:**  
📄 Documento de Arquitetura + protótipo.

**Benefício:**  
Reduz surpresas durante a implementação e melhora a qualidade técnica.

---

## SDLC — Fase 4: Implementação (Codificação)

**Objetivo:** Construir o software de acordo com o design.

**Práticas recomendadas:**
* Padrões de código (Clean Code).
* Versionamento (Git).
* Revisões de código (Code Review).
* Integração Contínua (CI).

**Resultado:**  
💻 Código funcionando e integrado ao restante do sistema.

**Risco comum:**  
"Pular etapas" e codificar sem entender totalmente os requisitos.

---

## SDLC — Fase 5: Testes

**Objetivo:** Garantir que o software está correto, seguro e confiável.

**Tipos de Teste:**
* **Unitário:** Funções isoladas.
* **Integração:** Componentes conversando entre si.
* **Sistema:** Teste do sistema como um todo.
* **Aceitação (UAT):** Validação do cliente.

**Por que importa?**  
Encontrar um erro aqui custa pouco; em produção, custa *muito*.

---

## SDLC — Fase 6: Manutenção

**Objetivo:** Sustentar, corrigir e evoluir o software após entrar em produção.

**Tipos:**
* **Corretiva:** Bugs.
* **Evolutiva:** Novas funcionalidades.
* **Adaptativa:** Mudanças em regras de negócio.
* **Preventiva:** Refatorações para evitar problemas futuros.

**Observação:**  
A manutenção costuma representar **60–80%** do custo total de vida do software.

---


## 1.3 Engenharia de Requisitos

O maior risco em projetos não é técnico, é **comunicacional**. Construir o sistema errado é pior que construir o sistema certo com bugs.

* **Requisitos Funcionais:** O que o sistema *faz*.
    * Ex: "O sistema deve calcular a média de vendas."
* **Requisitos Não-Funcionais:** Como o sistema *se comporta*.
    * Ex: "O cálculo deve levar menos de 2 segundos (Performance)."
    * Ex: "Os dados devem ser criptografados (Segurança)."

---

## Foco: Requisitos em Projetos de Dados

Em Ciência de Dados, os requisitos possuem nuances específicas:

* **Volume:** Qual a quantidade de dados esperada?
* **Velocidade:** O processamento é em tempo real ou em lote?
* **Veracidade:** Qual a fonte confiável?
* **Governança:** Quem pode acessar esses dados (LGPD/GDPR)?

---

## Educação Preventiva: Erros Comuns

Ao definir requisitos, cuidado com estas armadilhas:

* **Síndrome do "Eu sei o que o cliente quer":** Assumir necessidades sem perguntar.
* **Requisitos Vagos:** "O sistema deve ser rápido". (O quão rápido? Em qual hardware?)
* **Gold Plating:** Adicionar funcionalidades "extras" que ninguém pediu, encarecendo o projeto.
* **Correção Tardia:**
    * Corrigir um erro na fase de *Requisitos* custa 1x.
    * Corrigir o mesmo erro na fase de *Produção* pode custar 100x.

---

## 1.4 Metodologias: Tradicional (Waterfall)

O modelo em "Cascata" é linear e sequencial.

* **Característica:** Uma fase só começa quando a anterior termina.
* **Vantagem:** Documentação clara, prazos definidos.
* **Desvantagem:** Rigidez. Mudanças tardias são traumáticas.
* **Analogia:** Como escrever um livro à mão. Mudar o Capítulo 1 exige reescrever tudo.

---

## 1.4 Metodologias: Ágil (Agile)

Foca na entrega contínua e adaptação a mudanças.

* **Iterativo:** Desenvolvimento em ciclos curtos (Sprints).
* **Incremental:** O software cresce funcionalidade por funcionalidade.
* **Valor:** *Software funcionando mais que documentação abrangente.*
* **Analogia:** Como editar um texto no Google Docs. Mudanças são bem-vindas e rápidas.

---

## Comparativo Visual

| Característica | Tradicional (Waterfall) | Ágil (Scrum/Kanban) |
| :--- | :--- | :--- |
| **Planejamento** | Detalhado no início | Contínuo (Ondas sucessivas) |
| **Mudanças** | Resistência (Controle de mudanças rígido) | Bem-vindas (Vantagem competitiva) |
| **Entrega** | Apenas no final ("Big Bang") | Frequente e incremental |
| **Cliente** | Envolvimento pontual | Colaboração diária |

---

## Estudo de Caso: O Dashboard da Logística

**Cenário:** Uma empresa pede um sistema para "ver as entregas".
**Abordagem Tradicional:** 6 meses documentando, 6 meses codando. Ao entregar, a empresa mudou o processo logístico. Sistema inútil.
**Abordagem Ágil:**
1.  **Sprint 1:** Entrega uma lista simples das entregas do dia. (Feedback: "Ótimo, mas precisamos ver atrasos").
2.  **Sprint 2:** Adiciona filtro de atrasos. (Feedback: "Perfeito").
3.  **Resultado:** O produto evolui com a necessidade real.

---

## Atividade Prática: Especificação de Dados

**Contexto:** Você deve criar um *Data Lake* para um hospital.

1.  Defina 1 Requisito Funcional (Que dado coletar?)
2.  Defina 1 Requisito Não-Funcional Crítico (Pense em privacidade/velocidade).
3.  Qual metodologia você usaria e por quê?

*Reflita por 2 minutos antes de discutir.*

---

## Reflexão e Prática

Pense na sua experiência pessoal (ou acadêmica):

* Já iniciou uma tarefa (código ou trabalho) sem ler o enunciado completo?
* Qual foi o resultado? Teve que refazer?
* **Lição:** A "Engenharia de Requisitos" economiza o recurso mais valioso que temos: **Tempo**.

---

## Conclusão

* **Engenharia de Software** traz ordem ao caos do desenvolvimento.
* **Requisitos** são a fundação; se falharem, o prédio cai.
* **Metodologias** (Ágil ou Tradicional) são ferramentas; escolha a adequada ao contexto (Clareza vs. Incerteza).
* Em dados, a precisão dos requisitos define a qualidade dos *insights*.

---

## Material Complementar

* **Manifesto Ágil:** Os valores e princípios fundamentais. [agilemanifesto.org](https://agilemanifesto.org/)
* **SWEBOK (Guide to the Software Engineering Body of Knowledge):** Referência oficial da IEEE Computer Society.
* **Sommerville, Ian.** *Engenharia de Software*. 10ª Ed. (Livro clássico para aprofundamento nos processos).
* **Pressman, Roger.** *Engenharia de Software: Uma Abordagem Profissional*. (Foco em práticas de gestão e técnica).