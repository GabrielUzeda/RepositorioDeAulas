---
marp: true
theme: default
paginate: true
style: |
  @import url('https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;700&family=Roboto:ital,wght@0,400;0,700;1,400&display=swap');
  section {
    font-family: 'Roboto', sans-serif;
    background-color: #f4f6fb;
    color: #2b2b2b;
    font-size: 28px;
    line-height: 1.5;
  }
  h1, h2, h3 {
    font-family: 'Roboto Slab', serif;
    color: #1a3a6e;
  }
  h2 {
    border-bottom: 2px solid #1a3a6e;
    padding-bottom: 5px;
  }
  strong {
    color: #d62828;
    font-weight: 700;
  }
---

# A Arte de Conversar com a IA: Criando Prompts Eficazes

---

## Objetivos de Aprendizagem

Ao final desta aula, você será capaz de:

* Entender o que é um **prompt** e sua importância fundamental na interação com IAs.
* Identificar os **princípios essenciais** para a criação de prompts claros e eficazes.
* Aplicar técnicas para **estruturar suas instruções**, definindo contexto, persona e formato.
* Reconhecer e **evitar erros comuns** que levam a resultados insatisfatórios.

---

## Introdução: O Chefe e o Estagiário

Imagine que a Inteligência Artificial é um estagiário genial, mas sem experiência de vida.

Se você pede "faça um relatório sobre as vendas", ele pode entregar qualquer coisa: um número, um gráfico confuso ou um texto de dez páginas.

Mas, se você instrui: "**Crie um relatório de uma página** sobre as vendas do **último trimestre**, comparando com o mesmo período do ano anterior e destacando os **três produtos mais vendidos**", o resultado será preciso e útil.

O **prompt** é essa instrução detalhada.

---

## O que é um Prompt?

Um **prompt** é o conjunto de instruções, perguntas ou qualquer texto que fornecemos a um modelo de linguagem (IA) para que ele execute uma tarefa.

É a ponte de comunicação entre a nossa intenção e a capacidade de geração da máquina.

```text
+----------------+      +------------------+      +----------------------+      +----------------+
|      Você      | ---> |      Prompt      | ---> |          IA           | --->|    Resultado   |
| (Sua Intenção) |      |   (Instruções)   |      |    (Processamento)    |     | (Texto, Código) |
+----------------+      +------------------+      +----------------------+      +----------------+
```

---

## Os Pilares de um Bom Prompt

Para construir uma instrução poderosa, quatro pilares são essenciais:

* **Clareza e Especificidade**: Diga exatamente o que você quer, sem ambiguidades.
* **Contexto**: Forneça as informações de fundo necessárias para a IA entender o cenário.
* **Persona (Papel)**: Diga à IA quem ela deve "ser" ao responder (um especialista, um roteirista, etc.).
* **Formato**: Especifique como a resposta deve ser estruturada (lista, tabela, JSON, etc.).

---

## Pilar 1: Clareza e Especificidade

A diferença entre um resultado genérico e um resultado especializado está nos detalhes.

**Exemplo Vago:**
> "Fale sobre a economia do Brasil."

**Exemplo Específico e Claro:**
> "Escreva um resumo de **três parágrafos** sobre os principais desafios da economia brasileira em **2024**, focando em **inflação, política fiscal e o impacto no agronegócio**. Use uma linguagem acessível para quem não é economista."

---

## Pilar 2: A Força do Contexto

Pedir uma informação sem contexto é como pedir a um estranho para encontrar "o carro vermelho" em um estacionamento gigante. Qual deles? Onde?

**Exemplo sem Contexto:**
> "Traduza este texto para o inglês."

**Exemplo com Contexto:**
> "Você é um tradutor especializado em documentos de marketing para a indústria de tecnologia. **Traduza o texto a seguir para o inglês americano**, mantendo um tom **entusiasmado e inovador**. O público-alvo são jovens empreendedores do Vale do Silício."

---

## Pilar 3: A Persona Certa para a Tarefa

Atribuir um papel à IA foca a sua "base de conhecimento", resultando em respostas mais alinhadas, com o jargão e a perspectiva corretos.

**Exemplo sem Persona:**
> "Como eu posso melhorar meu site?"

**Exemplo com Persona:**
> "**Aja como um especialista em SEO (Search Engine Optimization) com 10 anos de experiência.** Analise a seguinte descrição do meu site de e-commerce de produtos artesanais e sugira **cinco melhorias práticas** para aumentar o tráfego orgânico."

---

## Armadilhas Comuns: A Praga da Ambiguidade

Um dos maiores erros é assumir que a IA conhece suas intenções ou o que você considera "bom senso".

**A Armadilha:**
> "Crie um post para redes sociais sobre nosso novo produto."

Este pedido gera perguntas: Qual rede social (Instagram, LinkedIn)? Qual é o tom (formal, divertido)? Existe uma imagem? Qual o objetivo (vender, informar)?

**A Solução Preventiva:**
> "**Crie um texto para um post de Instagram** anunciando o 'Café Aurora'. Use um tom **alegre e convidativo**, com 2 parágrafos curtos. Inclua 3 emojis relacionados a café e finalize com uma pergunta para gerar engajamento. Adicione as hashtags #CaféAurora e #AmoCafé."

---

## Estudo de Caso: O Planejamento de Viagem

**Cenário:** Você quer usar a IA para planejar uma viagem de 7 dias para a Itália.

**Prompt Inicial (Fraco):**
> "Crie um roteiro de viagem para a Itália."

**Reflexão para Melhoria:**
* Quais cidades?
* Qual o orçamento?
* Qual o perfil do viajante (família, casal, sozinho)?
* Quais são os interesses (história, gastronomia, natureza)?

---
**Prompt Otimizado:**
> "**Aja como um agente de viagens especialista em Itália.** Crie um roteiro de **7 dias** para um casal em lua de mel, com orçamento de **R$ 20.000**. O foco é **história e gastronomia**. O roteiro deve incluir as cidades de **Roma e Florença**, sugestões de 2 restaurantes por cidade e uma atividade cultural por dia."
---

## Aplicação no Mundo Real

A engenharia de prompt não é apenas para programadores. É uma habilidade para todos.

* **No trabalho:** É como delegar uma tarefa. Quanto mais clara a sua delegação, melhor o resultado.
* **Nos estudos:** É como pedir ajuda a um tutor. Quanto mais específica sua dúvida, mais útil a resposta.
* **No dia a dia:** É como usar um GPS. "Me leve para casa" funciona se o endereço estiver salvo. Caso contrário, você precisa fornecer todos os detalhes do destino.

---

## Hora da Reflexão

Pense em uma interação recente com uma IA (ChatGPT, Gemini, Copilot, etc.) em que o resultado não foi o que você esperava.

1.  **O que você pediu?** (Descreva o prompt original).
2.  **Qual foi o resultado?** (O que a IA entregou?).
3.  **O que poderia ter sido diferente?** Como você reescreveria seu prompt agora, aplicando os pilares de **clareza, contexto e persona** para guiar a IA a um resultado melhor?

Essa análise é o caminho para a maestria.

---

## Conclusão: De uma Conversa para um Diálogo

Criar bons prompts transforma a interação com a IA de um simples "pergunte e responda" para um **diálogo colaborativo**.

Lembre-se: a qualidade da resposta que você recebe está diretamente ligada à qualidade da pergunta que você faz.

Dominar essa habilidade não é sobre entender a máquina, mas sobre aprimorar nossa própria capacidade de **comunicar, estruturar o pensamento e definir objetivos com clareza.**

---

## Referências

[1] Google. *Guia Definitivo para a Engenharia de Prompt com Gemma 3*. 2024.
[2] IBM. *What is few shot prompting?*. Acessado em 19 de setembro de 2025.
[3] NVIDIA. *What is Chain of Thought (CoT) Prompting?*. Acessado em 19 de setembro de 2025.
[4] Jina AI. *PromptPerfect - AI Prompt Generator and Optimizer*. Acessado em 19 de setembro de 2025.

---

## Material Complementar

* **OpenAI Cookbook: Techniques to improve reliability**: Um guia com táticas e exemplos práticos para melhorar a qualidade dos prompts.
    * `https://cookbook.openai.com/examples/techniques_to_improve_reliability`

* **Prompt Engineering Guide**: Um guia completo e gratuito que cobre desde o básico até técnicas avançadas de engenharia de prompt.
    * `https://www.promptingguide.ai/`