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
  code {
    background-color: #e0e0e0;
    padding: 2px 5px;
    border-radius: 4px;
  }
---

# Lógica Condicional
### O Poder do "Se... Então..."

---

## Objetivos de Aprendizagem

Ao final desta aula, você será capaz de:

* Entender a estrutura da condicional **"Se P, então Q"**.
* Identificar a **hipótese (P)** e a **conclusão (Q)**.
* Interpretar a tabela-verdade da operação condicional.
* Aplicar a estrutura `if` em **Python** para controlar o fluxo de um programa.

---

## A Lógica das Promessas

Imagine que sua mãe lhe faz uma promessa:

"**Se** você arrumar o seu quarto, **então** eu deixo você jogar videogame."

Essa frase estabelece uma **condição** ("arrumar o quarto") e uma **consequência** ("jogar videogame").

A lógica condicional, ou o "Se... Então...", é a base para a tomada de decisões em programação. Ela testa se uma condição é verdadeira para então executar uma ação.

---

## Anatomia da Condicional: Se P, então Q

Toda condicional tem duas partes:

* **P (Hipótese ou Antecedente):** A condição que é avaliada.
    * *No nosso exemplo:* "Você arrumar o seu quarto".

* **Q (Conclusão ou Consequente):** A ação ou resultado que ocorre se a hipótese for verdadeira.
    * *No nosso exemplo:* "Eu deixo você jogar videogame".

A regra só é **quebrada (Falsa)** se a hipótese acontecer e a conclusão não.

---

## A Tabela-Verdade da Promessa

Vamos analisar quando a promessa da sua mãe foi cumprida (**V**) ou quebrada (**F**).

| Arrumou o Quarto (P) | Jogou Videogame (Q) | Promessa Quebrada? (P → Q) |
| :------------------: | :-----------------: | :------------------------: |
|         **V** |         **V** |       **Não (V)** |
|         **V** |         **F** |       **Sim (F)** |
|         **F** |         **V** |       **Não (V)** |
|         **F** |         **F** |       **Não (V)** |

**A única forma de quebrar a promessa é você arrumar o quarto (P=V) e ela não deixar você jogar (Q=F).** Nos outros casos, a promessa se mantém!

---

## A Condicional na Prática: Python

Em Python, a condicional "Se... Então..." é representada pela estrutura `if`.

```python
# Usando a analogia da promessa
quarto_arrumado = True

if quarto_arrumado == True:
    print("Ótimo! Pode jogar videogame.")

# Exemplo com notas
nota_final = 8.5

if nota_final >= 7.0:
    print("Parabéns, você foi aprovado!")
```

A ação dentro do `if` só é executada se a condição for `True`.

---

## E Se a Condição for Falsa? O `else`

O `if` nos diz o que fazer se a condição for verdadeira. Mas e se não for? Para isso, usamos o `else` (senão).

```python
temperatura = 15

if temperatura > 25:
    print("É um dia quente! Use roupas leves.")
else:
    print("Não está quente. Melhor levar um casaco.")

# Saída: Não está quente. Melhor levar um casaco.
```

O bloco `else` oferece um caminho alternativo, garantindo que uma das duas ações sempre ocorra.

---

## Erros Comuns: A Armadilha da Sintaxe

Um erro muito comum para iniciantes em Python é esquecer os dois-pontos (`:`) no final da linha do `if` ou do `else`, ou errar a **indentação** (o espaço no início da linha).

**A História do Código que Não Rodava:**
Um programador tentou criar um sistema de acesso. O código era `if usuario == "admin" print("Acesso liberado")`. Ele passou horas tentando descobrir o problema.

O computador não entende a lógica sem a sintaxe correta. O `if` exige um `:` no final, e a ação precisa estar em uma nova linha com um recuo (indentação).

**Correto:**
```python
if usuario == "admin":
    print("Acesso liberado")
```

---

## Aplicação no Mundo Real

A lógica "Se... Então..." está por toda parte:

* **E-commerce:** **Se** o usuário tem um cupom válido, **então** aplicar o desconto no carrinho.
* **Jogos:** **Se** a vida do personagem chegar a zero, **então** mostrar a tela de "Game Over".
* **Planilhas:** A função `=SE(A1>100; "Meta Atingida"; "Abaixo da Meta")` executa uma lógica condicional diretamente na célula.
* **Redes Sociais:** **Se** o post receber uma nova curtida, **então** notificar o autor.

---

## Reflexão e Próximos Passos

Pense em uma regra simples do seu dia a dia.
* "**Se** o semáforo estiver vermelho, **então** devo parar."
* "**Se** for fim de semana, **então** posso acordar mais tarde."

Como você escreveria uma dessas regras usando a estrutura `if`/`else` em Python? Praticar com exemplos pessoais ajuda a fixar o conceito de forma definitiva.

---

## Conclusão: O Bloco de Construção das Decisões

A estrutura condicional "Se... Então..." é a ferramenta mais fundamental que temos para criar programas dinâmicos e inteligentes.

Ela permite que nosso código reaja a diferentes entradas, estados e interações, deixando de ser uma sequência linear de passos para se tornar um sistema que **toma decisões**. Dominar o `if` e o `else` é o primeiro grande passo para se tornar um programador proficiente.

---

## Referências

[1] Sweigart, Al. *Automate the Boring Stuff with Python*. No Starch Press, 2020.
[2] Mueller, John Paul. *Beginning Programming with Python For Dummies*. John Wiley & Sons, 2018.
[3] Documentação Oficial do Python. *Mais Ferramentas de Controle de Fluxo*. Disponível em: https://docs.python.org/pt-br/3/tutorial/controlflow.html