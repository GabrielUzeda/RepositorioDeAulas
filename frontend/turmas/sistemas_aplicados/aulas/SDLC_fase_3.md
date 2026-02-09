---
marp: true
theme: default
paginate: true
math: katex
style: |
  @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');
  @import url('https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;700&family=Roboto:ital,wght@0,400;0,700;1,400&display=swap');
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
  }
  strong {
    color: #d62828;
    font-weight: 700;
  }
  code {
    background: #e0e0e0;
    padding: 2px 5px;
    border-radius: 4px;
    color: #c7254e;
  }
  .columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }
---

# Ciclo de Vida de Desenvolvimento de Software
## Fase 3: Design (Arquitetura e Modelagem)

---

## Objetivos da Aula

* Compreender a transição entre "O que fazer" (Requisitos) para "Como fazer" (Design).
* Diferenciar Arquitetura de Software de Design de Interface.
* Identificar os principais artefatos produzidos nesta fase (Diagramas, Wireframes, DER).
* Discutir a importância de planejar antes de codificar para evitar retrabalho.

---

## A Analogia da Construção Civil

Imagine que a Fase 2 (Análise) foi o momento em que o cliente disse: "Quero uma casa com 3 quartos e uma piscina".

* **A Fase de Design é a planta do arquiteto.** 

* Antes de colocar o primeiro tijolo (código), precisamos decidir:
    * Onde passam os canos? (Fluxo de Dados)
    * A casa será de madeira ou alvenaria? (Tecnologias/Stack)
    * Qual a aparência da fachada? (Interface/UI)

> **Sem a planta, a casa pode desabar ou ficar sem banheiro.**

---

## 1. Arquitetura de Software

É a definição da estrutura de alto nível do sistema. Como as peças se encaixam?

<div class="mermaid">
  
graph LR
    A[Decisão de Arquitetura] --> B{O sistema é complexo/grande?}
    B -->|Não - Ex: Blog Pessoal| C[Monolito]
    B -->|Sim - Ex: Netflix| D[Microserviços]
    C --> E[Simplicidade e Rapidez]
    D --> F[Escalabilidade e Manutenção Isolada]

</div>

* **Monolito:** Tudo em um único bloco. Fácil de começar, difícil de escalar.
* **Microserviços:** Pequenos blocos independentes. Complexo de gerenciar, fácil de escalar.

---

## 2. Modelagem de Dados e Interface

Após definir a "estrutura da casa", detalhamos os cômodos.

* **Modelagem de Dados (O Esqueleto):**
    * Como vamos guardar as informações?
    * *Exemplo:* Diagrama Entidade-Relacionamento (DER). Um "Cliente" faz vários "Pedidos".

<div align="center">
  
![Imagen](https://arquivo.devmedia.com.br/artigos/Joel_Rodrigues/mer/image001.png)

</div>    

---

* **Design de Interface (A Decoração):**
    * Como o usuário vê o sistema?
    * *Ferramentas:* Wireframes (rabiscos de tela) e Protótipos de alta fidelidade.

<div align="center">

![w:800](https://img.uxcel.com/cdn-cgi/image/format=auto/practices/dont-skip-the-wireframing-stage-1627993996240/a-1627993996240-2x.jpg)

</div>    


---

* **Definição Tecnológica:**
    * Quais ferramentas usaremos? (Ex: Banco SQL ou NoSQL? React ou Angular?).


![bg left:60%](https://envisionitagency.com/uploads/2018/04/frameworks.png)

---

## Educação Preventiva: Erros Comuns

<div class="columns">
<div>

### <i class="fa-solid fa-triangle-exclamation"></i> O "Over-engineering"
Fazer um design complexo demais para um problema simples.
* *Analogia:* Construir um arranha-céu para guardar uma bicicleta.
* **Solução:** Siga o princípio KISS (*Keep It Simple, Stupid*).

</div>
<div>

### <i class="fa-solid fa-person-digging"></i> Codificar sem Planejar
Pular direto para o código (Fase 4) sem desenhar a solução.
* *Consequência:* "Débito Técnico". Você terá que refazer tudo depois.
* **Solução:** Gaste tempo afiando o machado antes de cortar a árvore.

</div>
</div>

---

## Atividade Prática: O Arquiteto de Soluções

**Cenário:** Uma pequena biblioteca de bairro quer emprestar livros online.

**Desafio em Duplas:**
1.  **Escolha a Arquitetura:** Monolito (sistema único) ou Microserviços (vários sistemas)? Justifique.
2.  **Esboço Rápido:** Desenhe em papel um *Wireframe* da tela de "Detalhes do Livro" (Título, Autor, Botão de Reservar).
3.  **Dados:** Quais informações do livro precisamos salvar no banco de dados?

---

## Aplicação no Mundo Real

As decisões de design impactam o custo e a vida útil do software.

* **Caso de Sucesso:** O *Instagram* começou como um monolito simples (Python/Django) para validar a ideia rápido. Só depois evoluiu para arquiteturas complexas.
* **Lição:** O design não é escrito em pedra; ele deve evoluir, mas precisa de uma base sólida inicial.
* **Na sua carreira:** Um desenvolvedor Sênior não apenas codifica; ele projeta a solução antes.

---


## Conclusão

A fase de Design é a ponte entre a necessidade e a solução.

* Definimos **COMO** o sistema será.
* Escolhemos a **Arquitetura** (estrutura) e as **Tecnologias** (ferramentas).
* Criamos modelos de **Dados** e **Interfaces**.
* Evitamos o erro de construir sem planejar.

**Próximo passo:** Com a "planta da casa" pronta, na próxima aula entraremos na **Fase 4: Desenvolvimento (Codificação)**.

---

## Material Complementar

Para aprofundar seus conhecimentos em Design e Arquitetura:

* **Martin Fowler - Architecture Guide:** Referência mundial em padrões de arquitetura de software. [https://martinfowler.com/architecture/](https://martinfowler.com/architecture/)
* **Draw.io (Diagrams.net):** Ferramenta gratuita para criar fluxogramas e diagramas UML/DER. [https://app.diagrams.net/](https://app.diagrams.net/)
* **Figma:** Padrão da indústria para criação de wireframes e interfaces. [https://www.figma.com/](https://www.figma.com/)