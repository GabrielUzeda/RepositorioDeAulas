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

# Probabilidade Condicional e Independência

Estatística e Python na Prática

---

## Objetivos de Aprendizagem

* Entender o que é **probabilidade condicional** e como ela muda nossas previsões.
* Diferenciar eventos **dependentes** de eventos **independentes**.
* Aplicar esses conceitos para resolver problemas do mundo real.
* Implementar cálculos de probabilidade condicional usando Python.

---

## Uma Escolha na Biblioteca

Imagine uma biblioteca com 100 livros. A chance de pegar um livro de ficção científica é de 30%.
<div class="mermaid">
graph LR
    A["Biblioteca (100 Livros)"] --> B{"Ficção Científica?"}
    B -- "{30% (30 Livros)}" --> C["Sim"]
    B -- "{70% (70 Livros)}" --> D["Não"]
    
    C --> E{"Capa Dura?"}
    E -- "{20 Livros}" --> F["Sim"]
    E -- "{10 Livros}" --> G["Não"]
    
    D --> H{"Capa Dura?"}
    H -- "{10 Livros}" --> I["Sim"]
    H -- "{60 Livros}" --> J["Não"]
</div>

---

**Mas e se você só puder pegar livros de capa dura?** Agora, o "universo" de livros possíveis tem apenas 30 exemplares (20 de ficção + 10 de outros).

A chance de pegar uma ficção científica **dado que** o livro tem capa dura é de 20/30, ou 67%. Isso é **probabilidade condicional**.

---

## O Que é Probabilidade Condicional?

É a probabilidade de um evento ocorrer, **dado que outro evento já aconteceu** [1].

A fórmula pode parecer intimidadora, mas a ideia é simples [2]:

$$P(A|B) = \frac{P(A \cap B)}{P(B)}$$

* **P(A|B)**: Probabilidade de A, **dado** B.
* **P(A ∩ B)**: Probabilidade de A **e** B ocorrerem juntos.
* **P(B)**: Probabilidade do evento B (nosso novo "universo").

No nosso exemplo, A é "ser ficção científica" e B é "ter capa dura".

---

## Eventos: Independentes ou Dependentes?

Dois eventos são **independentes** se a ocorrência de um não afeta a probabilidade do outro [1].

* **Exemplo Independente:** Lançar uma moeda e um dado. O resultado da moeda não muda a chance de sair um 6 no dado. Matematicamente, `P(A|B) = P(A)` [1].

Dois eventos são **dependentes** quando o resultado de um influencia o outro.

* **Exemplo Dependente:** Tirar duas cartas de um baralho sem reposição. A probabilidade de tirar um Rei na segunda carta **depende** do que foi a primeira carta.

---

## Armadilha Comum: A Falácia da Conjunção

Qual cenário é mais provável?

1.  Um político experiente perde a eleição.
2.  Um político experiente perde a eleição **após** uma grande crise econômica abalar a confiança do público.

Muitos escolhem a segunda opção, pois a história parece mais completa. No entanto, a probabilidade de dois eventos (A e B) ocorrerem juntos **nunca** é maior que a probabilidade de um deles ocorrer sozinho (`P(A e B) ≤ P(A)`) [1]. A crise é apenas uma das muitas razões pelas quais um político pode perder.

---

## Atividade Prática: Clima e Vendas

Uma sorveteria quer entender o impacto do clima nas vendas. Eles têm dados de 100 dias:

|                | Vendeu Muito | Vendeu Pouco | Total |
| :------------- | :----------: | :----------: | :---: |
| **Dia de Sol** |      40      |      10      |  50   |
| **Dia Nublado**|      20      |      30      |  50   |
| **Total** |      60      |      40      |  100  |

1.  Qual a probabilidade de "Vender Muito" em um dia qualquer?
2.  Qual a probabilidade de "Vender Muito" **dado que** foi um "Dia de Sol"?
3.  As vendas e o clima são eventos independentes?

---

## Resolvendo em Python

Vamos usar a biblioteca **Pandas** para analisar os dados da sorveteria.

```python
import pandas as pd

# Criando a tabela de dados (DataFrame)
data = {'clima': ['sol'] * 50 + ['nublado'] * 50,
        'vendas': ['muito'] * 40 + ['pouco'] * 10 + ['muito'] * 20 + ['pouco'] * 30}
df = pd.DataFrame(data)

# 1. Probabilidade de vender muito
p_vender_muito = len(df[df['vendas'] == 'muito']) / len(df)
print(f"P(Vender Muito): {p_vender_muito:.2f}")

# 2. Probabilidade condicional
dias_de_sol = df[df['clima'] == 'sol']
p_vender_muito_dado_sol = len(dias_de_sol[dias_de_sol['vendas'] == 'muito']) / len(dias_de_sol)
print(f"P(Vender Muito | Sol): {p_vender_muito_dado_sol:.2f}")
```

---

## Aplicação no Mundo Real

A probabilidade condicional é a base de muitas tecnologias e decisões:

* **Filtros de Spam:** Um e-mail tem a palavra "grátis". Qual a probabilidade de ser spam, **dado** que essa palavra apareceu? É assim que seu e-mail aprende a filtrar mensagens indesejadas.
* **Diagnósticos Médicos:** Um paciente testa positivo para uma doença. Qual a probabilidade de ele realmente ter a doença, **dado** que o teste deu positivo? Isso ajuda a entender a precisão dos exames.
* **Recomendação de Filmes:** Você assistiu ao filme "A Origem". Qual a probabilidade de você gostar de "Interestelar", **dado** que você gostou do primeiro?

---

## Reflexão Final

Pense em uma decisão recente que você tomou.

* Quais informações você já tinha em mãos?
* Como uma **nova informação** (um evento que ocorreu) mudou a probabilidade de você fazer uma escolha ou outra?

A probabilidade condicional não é apenas uma fórmula matemática; é uma maneira de estruturar nosso pensamento para tomar decisões melhores e mais informadas, atualizando nossas crenças à medida que novas evidências surgem.

---

## Conclusão

* A **Probabilidade Condicional** nos permite recalcular a chance de um evento acontecer quando temos novas informações, limitando nosso "universo" de possibilidades.
* Entender a diferença entre eventos **independentes** e **dependentes** é crucial para não cometer erros de cálculo e interpretação.
* Ferramentas como o **Python** nos permitem testar essas ideias de forma rápida e prática, transformando teoria em insights aplicáveis.

---

## Referências

[1] Downey, A. (2011). *Think Stats: Probability and Statistics for Programmers*. O'Reilly Media.
[2] Mueller, J. P. (2018). *Beginning Programming with Python for Dummies*. John Wiley & Sons.