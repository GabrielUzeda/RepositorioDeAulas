---
marp: true
theme: default
paginate: true

---

# Mapeando a Dor do Usuário
**Da Empatia à Ação no Desenvolvimento de Software**

---

## Objetivos da Aula

Ao final desta sessão, você será capaz de:

* Compreender por que o "mapeamento da dor" é mais crucial do que a "coleta de requisitos".
* Identificar as principais técnicas para descobrir problemas reais do usuário (Personas, Jornadas).
* Traduzir "dores" observadas em "Histórias de Usuário" (User Stories) acionáveis.
* Reconhecer a armadilha de construir "soluções" para problemas inexistentes.

---

## A Armadilha da Solução Prematura

Imagine que sua equipe foi contratada para projetar uma cozinha para um chef renomado.

Vocês gastam meses instalando o fogão mais moderno, uma geladeira com inteligência artificial e um micro-ondas de última geração.

No dia da inauguração, o chef agradece, mas aponta para o canto: "Obrigado, mas meu **problema real** sempre foi a falta de espaço no balcão e facas que perdem o corte."

* Construímos recursos excelentes que não resolviam a **dor** principal.

---

## Por que Focar na Dor?

No desenvolvimento de software, é comum pular direto para a solução ("O usuário precisa de um botão azul!").

* Focar na **dor** (o problema subjacente) garante que estamos construindo a coisa certa.
* **Software focado na dor:** Resolve um problema real, gera adoção e cria valor.
* **Software focado na funcionalidade:** Corre o risco de ser uma "cozinha cheia de micro-ondas" – tecnicamente impressionante, mas raramente usado.

---

## Conceito 1: A Persona

Não podemos resolver uma dor se não sabemos **quem** a sente.

* **O que é:** Uma representação semi-fictícia, mas baseada em dados, do seu usuário-alvo.
* **Por que usar:** Transforma o "usuário" (uma entidade abstrata) em "Ana, 35, gerente de projetos" (uma pessoa com contexto).
* **Exemplo de Dor na Persona:**
    * **Persona:** Ana, Gerente de Projetos.
    * **Contexto:** Gerencia 3 equipes remotas.
    * **Dor:** "Ana gasta 4 horas toda sexta-feira compilando relatórios de status manualmente, o que a impede de fazer análises estratégicas."

---

## Conceito 2: Jornada do Usuário

A dor raramente é um evento único; ela ocorre dentro de um processo.

* **O que é:** Um mapa visual que detalha a experiência do usuário (passos, pensamentos, emoções) ao tentar completar um objetivo.
* **Analogia:** É como o mapa de um detetive. Seguimos o usuário passo a passo, anotando onde ele fica **frustrado**, **confuso** ou **desperdiça tempo**.
* Esses pontos de atrito são as dores que devemos resolver.

---

<div class="mermaid" style="font-size: 18px; text-align: left;">
    graph TD
        subgraph Jornada de Ana (Gerar Relatório)
            A[Abre a Planilha 1] --> B{Dados atualizados?};
            B -->|Não| C[Envia e-mail para Equipe A];
            C --> D[...Espera 2h...];
            D --> E[Recebe dados];
            B -->|Sim| F[Copia dados];
            E --> F;
            F --> G[Abre Planilha 2];
            G --> H[Cola dados];
            H --> I[Verifica Formatação];
            I --> J[Envia e-mail para Liderança];
        end

        subgraph Emoções (Pontos de Dor)
            id1(Início: Ansiosa)
            id2(C: <strong>Frustrada</strong>)
            id3(D: <strong>Bloqueada</strong>)
            id4(I: <strong>Irritada</strong>)
            id5(J: Aliviada)
        end

    style C fill:#f9d4d4,stroke:#d62828,stroke-width:2px
    style D fill:#f9d4d4,stroke:#d62828,stroke-width:2px
    style I fill:#f9d4d4,stroke:#d62828,stroke-width:2px
</div>

---

## Conceito 3: Da Dor à História de Usuário

A **História de Usuário (User Story)** é a ferramenta que traduz a dor em um item de trabalho para a equipe de desenvolvimento.

O formato padrão é:
> **Como** [Persona],
> **Eu quero** [Ação/Funcionalidade],
> **Para que** [Valor/Resultado]

O "Para que" é onde a **dor** é curada.

---

## Traduzindo a Dor de Ana

* **A Dor (da Jornada):** Ana perde horas compilando dados manualmente (Frustração, Tempo perdido).

* **A História de Usuário (A Solução):**
    > **Como** [Ana, Gerente de Projetos],
    > **Eu quero** [gerar um relatório de status consolidado com um clique],
    > **Para que** [eu possa usar meu tempo para analisar os dados, em vez de apenas coletá-los].

* Note que a história não diz *como* fazer (não fala de banco de dados, nem de API). Ela foca no **valor** gerado ao curar a dor.

---

## Erros Comuns (Educação Preventiva)

### 1. Confundir "Soluções" com "Dores"
* **O Pedido (Solução):** "Eu preciso de um botão para exportar para Excel."
* **A Dor (Problema Real):** "Eu não confio nos dados do dashboard, então preciso exportar para verificar as fórmulas eu mesmo."
* *Lição:* Sempre pergunte "Por quê?" até encontrar a dor raiz. Talvez a solução não seja um botão de exportar, mas sim melhorar a confiança no dashboard.

---

## Erros Comuns (Educação Preventiva)

### 2. Pedir ao Usuário a Solução
* Uma armadilha comum é perguntar: "Do que você precisa no software?"
* **Analogia (atribuída a Henry Ford):** "Se eu perguntasse aos meus clientes o que eles queriam, eles teriam dito 'cavalos mais rápidos'."
* O trabalho do usuário é ter o **problema** (cavalos são lentos e sujos).
* O nosso trabalho é entender esse problema e propor a **solução** (o carro).
* *Lição:* Observe o que o usuário *faz* (e onde ele sofre), não apenas o que ele *pede*.

---

## Estudo de Caso Rápido

**Contexto:** Um aplicativo de gestão de tempo (timesheet).

**Observações da Equipe:**
1.  Os desenvolvedores (Persona: Bia) *odeiam* preencher o timesheet e sempre deixam para sexta-feira.
2.  O gerente (Persona: Carlos) reclama que os dados do timesheet nunca estão atualizados em tempo real.

**Reflexão:**
* Qual é a dor de Bia?
* Qual é a dor de Carlos?
* Elas são conflitantes?
* *Spoiler:* A dor de Bia é a **interrupção** (ter que parar o que faz para preencher). A dor de Carlos é a **falta de visibilidade**.

---

## Aplicação no Mundo Real: O Backlog

Onde vive o mapeamento da dor? No **Product Backlog**.

* **Um Backlog Ruim:** Uma lista de funcionalidades técnicas.
    * `Fazer integração com API X`
    * `Mudar cor do botão Y`

* **Um Backlog Saudável:** Uma lista de dores priorizadas (geralmente como Histórias de Usuário).
    * `Como Ana, quero um relatório em um clique, para economizar tempo.`
    * `Como Bia, quero registrar minhas horas sem interromper meu fluxo, para manter o foco.`

---

## Reflexão e Próximos Passos

Mapear a dor do usuário não é uma única fase; é uma mentalidade contínua.

* **O que observamos?** (O usuário está frustrado, usando planilhas).
* **O que isso significa?** (Nosso sistema tem uma falha de visibilidade ou usabilidade).
* **O que aprendemos?** (A dor real não é "precisar de planilhas", mas "falta de confiança nos dados").
* **O que faremos?** (Vamos criar uma História de Usuário focada em construir confiança, talvez com um dashboard transparente, antes de proibir as planilhas).

---

## Conclusão

* Pare de perguntar ao seu usuário o que ele *quer*. Comece a investigar o que o *atrapalha*.
* Use **Personas** para gerar empatia e **Jornadas** para encontrar os pontos de atrito.
* Traduza essas **dores** em **Histórias de Usuário** que focam no **valor** (a cura da dor).
* Um software de sucesso não é medido pelo número de funcionalidades, mas pela quantidade de dores reais que ele elimina.

---

## Material Complementar

* **Livro:** *Inspired: How to Create Tech Products Customers Love* (Marty Cagan)
    * Um guia essencial sobre como descobrir e validar problemas reais antes de construir.

* **Livro:** *User Story Mapping* (Jeff Patton)
    * Aprofunda a técnica de mapear a jornada do usuário e conectá-la diretamente ao backlog de desenvolvimento.

* **Artigos:** Nielsen Norman Group (NN/g)
    * Explore o site [https://www.nngroup.com/](https://www.nngroup.com/) para artigos de referência sobre Personas, Mapeamento de Jornada e técnicas de entrevista com usuários.