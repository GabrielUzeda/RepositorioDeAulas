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

# Lógica e Tabela-Verdade
### Decifrando as Regras do Pensamento Digital

---

## Objetivos de Aprendizagem

Ao final desta aula, você será capaz de:

* Entender o que é uma **proposição lógica**.
* Utilizar os operadores lógicos **E (AND)**, **OU (OR)** e **NÃO (NOT)**.
* Construir e interpretar **tabelas-verdade** para avaliar expressões.
* Aplicar esses conceitos em exemplos práticos com **Python**.

---

## A Lógica no Dia a Dia: Uma Analogia

Imagine que você precisa decidir que roupa usar. Sua decisão depende de duas condições: "Está chovendo?" e "Está frio?".

Sua regra mental é: "Vou usar uma jaqueta **SE** estiver chovendo **E** estiver frio".

Essa simples decisão é uma operação lógica. A programação e os computadores usam exatamente esse tipo de raciocínio para funcionar.

---

## Proposições: Os Tijolos da Lógica

Uma **proposição** é qualquer afirmação que pode ser classificada como **Verdadeira (V)** ou **Falsa (F)**.

* **Exemplo 1:** "O céu é azul." (Verdadeiro)
* **Exemplo 2:** "Brasília é a capital do Japão." (Falso)
* **Exemplo 3:** `x > 10` (Pode ser V ou F, dependendo do valor de `x`)

Na programação, chamamos isso de valores **booleanos** (`True` ou `False`).

---

## Operador E (AND): A Exigência Dupla

O operador **E** combina duas proposições. O resultado só é verdadeiro se **ambas** as proposições forem verdadeiras.

**Analogia:** "Para eu ir à praia, preciso de protetor solar **E** de tempo livre."

| Protetor Solar | Tempo Livre | Vou à Praia? |
| :------------: | :---------: | :----------: |
|       **V** |     **V** |     **V** |
|       **V** |     **F** |     **F** |
|       **F** |     **V** |     **F** |
|       **F** |     **F** |     **F** |

---

## Operador OU (OR): Uma Alternativa

O operador **OU** também combina duas proposições. O resultado é verdadeiro se **pelo menos uma** delas for verdadeira.

**Analogia:** "Para o almoço, eu como arroz **OU** macarrão."

|   Como Arroz   | Como Macarrão |   Almocei?   |
| :------------: | :-----------: | :----------: |
|       **V** |      **V** |     **V** |
|       **V** |      **F** |     **V** |
|       **F** |      **V** |     **V** |
|       **F** |      **F** |     **F** |

---

## Operador NÃO (NOT): A Inversão

O operador **NÃO** inverte o valor de uma proposição. O que é verdadeiro se torna falso, e o que é falso se torna verdadeiro.

**Analogia:** Se a proposição "A porta está aberta" é **Verdadeira**, então "A porta **NÃO** está aberta" é **Falsa**.

| Proposição A |  NÃO A  |
| :----------: | :-----: |
|     **V** |   **F** |
|     **F** |   **V** |

---

## Tabela-Verdade na Prática: Python

Vamos traduzir nossas analogias para o código! Em Python, os operadores são `and`, `or` e `not`.

```python
# Operador AND
tem_protetor = True
tem_tempo_livre = False
vou_a_praia = tem_protetor and tem_tempo_livre
print(f"Vou à praia? {vou_a_praia}")  # Saída: False

# Operador OR
como_arroz = False
como_macarrao = True
almocei = como_arroz or como_macarrao
print(f"Almocei? {almocei}")  # Saída: True

# Operador NOT
porta_aberta = True
porta_fechada = not porta_aberta
print(f"A porta está fechada? {porta_fechada}") # Saída: False
```

---

## Erros Comuns: A Armadilha da Atribuição

Um desenvolvedor júnior foi encarregado de criar um sistema de login. O sistema deveria liberar o acesso se o usuário fosse "admin".

Ele escreveu o seguinte código: `if (usuario = 'admin'):`.

O sistema liberava o acesso para qualquer um! Por quê?

Ele usou `=`, que **atribui** um valor, em vez de `==`, que **compara** valores. A expressão `usuario = 'admin'` sempre resultava em 'admin', que é considerado `True`, liberando o acesso indevidamente.

**Lembre-se:**
* `=` serve para guardar um valor (atribuição).
* `==` serve para verificar se dois valores são iguais (comparação).

---

## Aplicação no Mundo Real

A lógica da tabela-verdade é a base de quase tudo no mundo digital:

* **Motores de Busca:** Quando você pesquisa por "gatos **E** cachorros", a lógica `AND` é usada para encontrar páginas que contenham ambas as palavras.
* **Sistemas de Controle:** Em um ar-condicionado, a lógica pode ser: "SE a temperatura > 25°C **E** o modo 'auto' estiver ligado, ENTÃO ligar o compressor".
* **Hardware:** Os processadores são construídos com milhões de "portas lógicas", que são implementações físicas dos operadores `AND`, `OR` e `NOT`.

---
## Reflexão e Próximos Passos

Pense em uma decisão que você tomou hoje.
* Quais foram as condições (as proposições) envolvidas?
* Você usou a lógica "E" ou a lógica "OU"?
* Como você representaria essa decisão em um pequeno trecho de código?

Refletir sobre isso ajuda a solidificar o conhecimento e a ver a lógica como uma ferramenta natural do pensamento.

---

## Conclusão: Organizando o Raciocínio

A tabela-verdade não é apenas uma ferramenta teórica; é um mapa que nos ajuda a visualizar e a estruturar decisões complexas de forma clara e sem ambiguidades.

Ao dominar os operadores **E**, **OU** e **NÃO**, ganhamos o poder de construir programas que tomam decisões inteligentes e previsíveis, transformando regras do mundo real em instruções que uma máquina pode entender.

---

## Referências

[1] Sweigart, Al. *Automate the Boring Stuff with Python*. No Starch Press, 2020.
[2] Mueller, John Paul. *Beginning Programming with Python For Dummies*. John Wiley & Sons, 2018.
[3] Documentação Oficial do Python. *Expressões Booleanas*. Disponível em: https://docs.python.org/3/library/stdtypes.html#boolean-operations-and-or-not