---
marp: true
paginate: true
---

# Fundamentos da Lógica e Algoritmos

## Do Pensamento à Execução com Python

---

## Objetivos de Aprendizagem

- Entender a **lógica de programação** como a base do pensamento estruturado.
- Aprender a **representar algoritmos** usando fluxogramas e pseudocódigo.
- Identificar os **blocos de construção** em Python: variáveis, tipos de dados e operadores.
- Compreender como as **estruturas de controle** (condicionais e laços) direcionam a execução de um algoritmo.

---

## A Lógica: Uma Receita Para o Sucesso

Imagine que um computador é um cozinheiro que segue receitas ao pé da letra, sem qualquer intuição [1].

A **lógica de programação** é a arte de escrever essa receita (o algoritmo) de forma tão clara e precisa que o resultado seja sempre o esperado. Cada passo deve ser inequívoco e estar na ordem correta [1].

---

## O Que é um Algoritmo?

É a materialização da lógica: uma sequência **finita** e **precisa** de passos projetada para resolver um problema [1].

Todo algoritmo é composto por três elementos essenciais [1]:

1.  **Entrada**: Os dados a serem processados.
2.  **Processamento**: As instruções a serem executadas.
3.  **Saída**: O resultado gerado.

---

## Passo 1: Planejar Antes de Codificar

Antes de escrever código em uma linguagem como Python, é crucial **formalizar e testar** a lógica do algoritmo [1].

Isso nos ajuda a organizar o pensamento e a encontrar erros de lógica antes que eles se tornem bugs no programa [1].

Para isso, usamos duas ferramentas principais: **Fluxogramas** e **Pseudocódigo**.

---

## Ferramenta de Planejamento: Fluxograma

O fluxograma é uma **representação gráfica** de um algoritmo. Ele usa símbolos padronizados para visualizar o fluxo de execução, tornando a lógica de decisões e repetições muito mais intuitiva [1].

<div class="mermaid">
graph LR;
  A([Início]) --> B[/Entrada de Dados/];
  B --> C{Decisão};
  C -->|Sim| D[Processo 1];
  C -->|Não| E[Processo 2];
  D --> F[/Saída/];
  E --> F;
  F --> G([Fim]);
</div>

---

## Do Pseudocódigo ao Python

O pseudocódigo é uma linguagem intermediária que combina a língua natural com a estrutura da programação. Ele nos permite focar **exclusivamente na lógica**. Veja como a lógica de um pseudocódigo se traduz para Python [1]:

```pseudocode
algoritmo "VerificarAprovacao"
var
  nota1, nota2, media: real
inicio
  leia(nota1, nota2)
  media <- (nota1 + nota2) / 2
  se media >= 7 entao
    escreva("Aprovado!")
  senao
    escreva("Reprovado.")
  fimse
fimalgoritmo
```

---

## Do Pseudocódigo ao Python (continuação)

```python
# Exemplo de Lógica em Python
nota1 = float(input("Digite a primeira nota: "))
nota2 = float(input("Digite a segunda nota: "))

media = (nota1 + nota2) / 2

if media >= 7.0:
    print("Aprovado!")
else:
    print("Reprovado.")
```

---

## Os Blocos de Construção: Variáveis

Para que um algoritmo manipule informações, ele precisa de um lugar para guardá-las.

**Variáveis**: São espaços nomeados na memória do computador reservados para armazenar um valor que **pode mudar** durante a execução. Pense nelas como caixas com etiquetas: a etiqueta é o nome da variável, e o conteúdo é o seu valor [1].

**Constantes**: Também são espaços nomeados, mas seu valor, uma vez definido, **não pode ser modificado**. São usadas para valores fixos, como Pi ($\pi$) ou uma taxa de juros [1].

---

## Classificando os Dados: Tipos Primitivos

Definir o tipo de um dado informa ao computador quanto espaço alocar e quais operações são válidas para ele [1].

- **Inteiro (`int`)**: Para números inteiros, sem casas decimais (ex: idade, quantidade) [1].
- **Real (`float`)**: Para números com casas decimais (ex: preço, altura, temperatura) [1].
- **Cadeia (`str`)**: Para dados textuais (ex: 'A', "Olá, Mundo!") [1].
- **Lógico (`bool`)**: Armazena apenas dois valores: **True** ou **False**. É a base para a tomada de decisões [1].

---

## Manipulando os Dados: Operadores

Operadores são símbolos que executam operações sobre os dados (operandos) [1].

- **Aritméticos**: Realizam cálculos matemáticos.
  `+`, `-`, `*`, `/`, `**` (potência), `%` (módulo) [1].
- **Relacionais**: Comparam dois valores, e o resultado é sempre um valor **Lógico** (True/False) [1].
  `==` (igual), `!=` (diferente), `>` (maior que), `<` (menor que) [1].
- **Lógicos**: Combinam ou invertem expressões lógicas [1].
  `and`, `or`, `not` [1].

---

## Armadilha Comum: O Pensamento Linear

Um erro comum para iniciantes é presumir que um algoritmo sempre segue uma sequência reta, do início ao fim.

Problemas do mundo real exigem que programas **tomem decisões** e **repitam ações** [1].

As **estruturas de controle** são os mecanismos que nos permitem criar fluxos de execução dinâmicos e inteligentes, quebrando a linearidade [1].

---

## Direcionando o Fluxo: Estruturas Condicionais

Permitem que um programa escolha entre diferentes caminhos de execução com base em uma condição **booleana** (True ou False) [1].

- **if**: Executa um bloco de código **apenas se** a condição for VERDADEIRA. Se for FALSA, o bloco é ignorado [1].
- **if-else**: Oferece dois caminhos. Se a condição for VERDADEIRA, executa o bloco do `if`. Se for FALSA, executa o bloco do `else`. Garante que um dos dois caminhos será sempre seguido [1].

---

## Automatizando Tarefas: Estruturas de Repetição (Laços)

São usadas para executar um mesmo bloco de código várias vezes, evitando redundância [1].

- **while**: Um laço de **pré-teste**. A condição é verificada **antes** de cada execução. O bloco só executa **enquanto** a condição for VERDADEIRA. Pode nunca executar [1].
- **for**: Um laço **controlado por um iterável** (como uma lista ou um intervalo). Ideal para quando se quer percorrer uma sequência de elementos [1].
- **while com break**: Uma forma de simular um laço de **pós-teste** (do-while), garantindo que o código execute **pelo menos uma vez** [1].

---

## Qual Laço Usar? Um Guia Rápido

| Característica       | **for**                                                      | **while**                                                                             |
| :------------------- | :----------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| **Caso de Uso**      | Percorrer uma sequência **finita e conhecida** de elementos. | Repetir enquanto uma condição for **verdadeira** (nº de vezes pode ser desconhecido). |
| **Estrutura Típica** | `for item in sequencia:`                                     | `while condicao:`                                                                     |
| **Execução Mínima**  | 0 vezes.                                                     | 0 vezes.                                                                              |

_Nota: Para garantir a execução ao menos uma vez (lógica do-while), usa-se `while True:` com uma condição de `break` dentro do laço._

---

## Atividade Prática: Desvendando o Código Python

Analise o código Python abaixo, que calcula a média de 3 notas e exibe o status do aluno.

**Identifique:**

1.  Quais são as **variáveis** e seus prováveis tipos?
2.  Quais **operadores** (aritméticos e relacionais) foram usados?
3.  Qual **estrutura condicional** foi aplicada para tomar a decisão?

---

## Atividade Prática: Desvendando o Código Python (continuação)

```python
nome_aluno = input("Digite o nome do aluno: ")
nota1 = float(input("Digite a primeira nota: "))
nota2 = float(input("Digite a segunda nota: "))
nota3 = float(input("Digite a terceira nota: "))

media = (nota1 + nota2 + nota3) / 3

print(f"A média de {nome_aluno} é: {media:.1f}")

if media >= 7.0:
    print("Status: Aprovado")
else:
    print("Status: Reprovado")
```

---

## Conclusão: A Anatomia do Programa

Programar é a arte de compor esses componentes fundamentais:

- Primeiro, planejamos a solução com **fluxogramas** e **pseudocódigo**.
- Em seguida, usamos **variáveis** e **tipos de dados** para armazenar e classificar informações.
- Com **operadores**, manipulamos esses dados.
- Finalmente, com **estruturas de controle**, orquestramos o fluxo de execução para tomar decisões e repetir tarefas.

Dominar esses princípios é a verdadeira marca de um programador proficiente, independentemente da linguagem [1].

---

## Material Complementar

- **Documentação Oficial do Python sobre Estruturas de Controle:**
  Para aprofundar, explore como a lógica se traduz em comandos como `if`, `for` e `while`.
  *https://docs.python.org/pt-br/3/tutorial/controlflow.html*

- **Curso de Lógica de Programação - Gustavo Guanabara:**
  Uma série de vídeos didáticos e gratuitos que cobrem todos esses fundamentos com exemplos práticos.
  *https://www.youtube.com/playlist?list=PLHz_AreHm4dmSj0MHol_aoNYCSGFqvfXV*

---

## Referências

[1] A Anatomia da Lógica de Programação: Uma Estrutura Fundamental para a Resolução de Problemas Computacionais, 2025. (Material de referência fornecido para a elaboração desta aula).
