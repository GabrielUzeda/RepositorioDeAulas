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
    line-height: 1.4;
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
    color: #d62828;
    padding: 2px 5px;
    border-radius: 4px;
  }
  .mermaid {
    display: flex;
    justify-content: center;
  }
---

# <i class="fa-solid fa-user-secret"></i> Detetive Virtual
## Investigando a Verdade com Python e Estatística

---

## <i class="fa-solid fa-bullseye"></i> A Missão

Neste projeto final, vocês deixarão de ser apenas estudantes para se tornarem **investigadores forenses de dados**.

* **O Cenário:** O mundo digital está inundado de informações duvidosas, gráficos manipulados e correlações falsas.
* **O Objetivo:** Identificar uma "notícia suspeita" (fake news, estudo enviesado, postagem viral) e submetê-la a um rigoroso inquérito científico.
* **As Armas:** O pensamento crítico, a Estatística Descritiva e a programação em Python.

---

## <i class="fa-solid fa-magnifying-glass"></i> O Inquérito (Escopo)

Vocês devem escolher um alvo para a investigação. Exemplos de casos:

* **Saúde:** "Tratamentos milagrosos" com amostras insuficientes.
* **Economia:** Gráficos de inflação ou PIB que distorcem a escala visual.
* **Esportes:** Estatísticas manipuladas para supervalorizar um atleta.
* **Correlações Espúrias:** "O consumo de sorvete causa ataques de tubarão?" (Causalidade vs. Correlação).

> **Desafio:** Não basta dizer que é mentira; você deve **provar matematicamente** onde está o erro.

---

## <i class="fa-solid fa-chart-line"></i> Ferramentas Obrigatórias: Estatística

Para validar sua tese, o grupo deve aplicar os seguintes conceitos:

* **Descritiva:** Média, mediana, moda, quartis e percentis.
* **Dispersão:** Desvio padrão (o quanto os dados variam da média).
* **Relação:** Covariância e Correlação Linear.
* **Probabilidade:**
    * Condicional e Independência.
    * Regras de Adição e Multiplicação ($P(A \cup B)$ e $P(A \cap B)$).
* **Inferência:** Distribuição Normal e Teste Z.

$$ Z = \frac{\bar{X} - \mu}{\sigma / \sqrt{n}} $$

---

## <i class="fa-brands fa-python"></i> Ferramentas Obrigatórias: Python

O computador será seu assistente de laboratório. O código deve conter:

* **Tipos de Variáveis:** Justificar o uso de `float`, `int`, `bool`.
* **Estruturas de Dados:** Listas (com `zip`, `sort`, união/interseção).
* **Controle de Fluxo:** Laços `for` e `while` para iterar sobre dados.
* **Bibliotecas:** Importação correta e uso de **Matplotlib** para visualizar as fraudes (ou a verdade).

<div class="mermaid">
  graph LR;
  A[Coleta de Dados] --> B[Limpeza Python];
  B --> C{Análise Estatística};
  C -->|Confirmado| D[Validar];
  C -->|Refutado| E[Desmentir];
  D --> F[Relatório Final];
  E --> F;
</div>

---

## <i class="fa-solid fa-triangle-exclamation"></i> Educação Preventiva: Erros Comuns

Ao programar e apresentar, evitem estas armadilhas clássicas:

1.  **O "Copiar-Colar" Cego:** Não usem um código que vocês não sabem explicar. Se usou `zip`, saiba por que ele foi melhor que um índice manual.
2.  **Leitura de Slides:** Na apresentação oral, **proibido ler textos longos**. O slide é um apoio visual, não um teleprompter.
3.  **Gráficos sem Contexto:** Um gráfico sem eixos nomeados ou legenda é como uma prova sem assinatura: inválido.
4.  **Confusão de Tipos:** Tentar somar *strings* ("10" + "10" = "1010") é um erro fatal na análise de dados. Convertam para `int` ou `float`.

---

## <i class="fa-solid fa-list-check"></i> Estrutura da Entrega

O trabalho se divide em dois momentos cruciais:

* **Parte 1: Apresentação Oral (70%)**
    * 10 min de fala + 20 min de sabatina.
    * Expliquem o **raciocínio**, não apenas o código.
    * Todos os integrantes devem falar.

* **Parte 2: Relatório Escrito (30%)**
    * Tese investigativa (Introdução, Metodologia, Discussão).
    * **Códigos Comentados:** Expliquem o "porquê" das escolhas técnicas (ex: "Usei gráfico de dispersão para ver a correlação").

---

## <i class="fa-solid fa-brain"></i> Critérios de Avaliação

Como sua investigação será julgada?

1.  **Clareza e Postura:** Capacidade de argumentar e responder perguntas sem ler.
2.  **Rigor Estatístico:** Aplicação correta do Teste Z e probabilidades.
3.  **Qualidade do Código:** Organização, comentários explicativos e uso eficiente das estruturas (listas, laços).
4.  **Visualização:** Gráficos que revelam a verdade por trás dos dados.

---

## <i class="fa-solid fa-book"></i> Material Complementar

Para aprofundar sua investigação e escrita do código:

* **Allen B. Downey - Think Stats:** Focado em probabilidade e estatística para programadores (caps. 1-4).
* **John Paul Mueller - Beginning Programming with Python:** Ótimo para revisar laços e tipos de variáveis.
* **Deborah Rumsey - Estatística II Para Leigos:** Explicações acessíveis sobre testes de hipótese e análise de dados.
* **Documentação Matplotlib:** Galeria de exemplos para criar gráficos impactantes. [https://matplotlib.org/stable/gallery/index.html](https://matplotlib.org/stable/gallery/index.html)

---

## <i class="fa-solid fa-scale-balanced"></i> Rubrica de Avaliação Detalhada

A tabela abaixo mostra exatamente **quanto cada item vale** na nota final.

| Componente | Critério | Descrição | Peso |
|-----------|----------|-----------|------|
| **Apresentação (70%)** | Clareza e postura | Fala natural, sem leitura de slides, domínio do conteúdo | **10%** |
| | Aplicação estatística | Uso correto de: média, mediana, moda, dispersão, quartis, correlação, probabilidades, distribuição normal, Teste Z | **10%** |
| | Código em Python | Uso adequado de tipos, listas, laços, zip/sort, união/interseção, bibliotecas | **10%** |
| | Visualização | Gráficos Matplotlib claros, completos e interpretados | **10%** |
| | Respostas às perguntas | Argumentação e defesa das conclusões | **30%** |
| **Relatório Escrito (30%)** | Estrutura e redação | Clareza, organização, metodologia, conclusão | **10%** |
| | Códigos comentados | Explicações do “porquê” das escolhas técnicas | **10%** |
| | Profundidade da análise | Discussão crítica, interpretação dos dados, consistência estatística | **10%** |

> **Total: 100 pontos possíveis**  
> Lembrem-se: **todos os tópicos obrigatórios devem aparecer ao menos uma vez**.


