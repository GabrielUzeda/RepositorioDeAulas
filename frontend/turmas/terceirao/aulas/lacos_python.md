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

# Laços de Repetição: Automatizando Tarefas com Python

---

## Objetivos da Aula

* Compreender o que são **laços de repetição** e por que são fundamentais na programação.
* Conhecer os dois principais tipos de laços em Python: `for` e `while`.
* Aprender a aplicar esses laços para resolver problemas práticos e evitar a repetição de código.

---

## A Tarefa Interminável: Uma Analogia

Imagine que você precisa carimbar 1.000 envelopes com o selo da sua empresa. Você tem duas opções:

1.  **A Manual:** Pegar o primeiro envelope, carimbar. Pegar o segundo, carimbar. Pegar o terceiro... uma tarefa repetitiva e cansativa.
2.  **A Automatizada:** Construir uma pequena máquina que, uma vez ligada, pega cada um dos 1.000 envelopes da pilha e os carimba automaticamente.

Na programação, os **laços de repetição** são como essa máquina. Eles executam uma mesma tarefa várias vezes, de forma automática e eficiente.

---

## Conceito Fundamental: O que é um Laço?

Um laço (ou *loop*) é uma estrutura de controle que permite executar um bloco de código repetidamente, enquanto uma determinada condição for verdadeira.

* **Utilidade:** Evita a necessidade de escrever o mesmo código várias vezes.
* **Eficiência:** Torna os programas mais curtos, mais legíveis e menos propensos a erros.
* **Poder:** Permite processar grandes volumes de dados, como todos os contatos de uma agenda ou todos os produtos de uma loja online.

---

## O Laço `for`: Repetição com Início, Meio e Fim

Pense no laço `for` como um funcionário que sabe exatamente quantos itens precisa processar. Ele é ideal para percorrer uma sequência de elementos, como uma lista de nomes ou uma série de números.

**Analogia:** É como um carteiro que tem um número definido de cartas para entregar em uma rua. Ele percorre casa por casa, entrega a correspondência e, ao final da rua, sua tarefa termina.

---

## Laço `for` em Python: Na Prática

A estrutura mais comum do `for` em Python utiliza a função `range()` para gerar uma sequência de números.

```python
# Imprimir os números de 0 a 4
for numero in range(5):
    print(numero)
```

* `for numero in range(5)`: "Para cada `numero` na sequência de 0 a 4..."
* `print(numero)`: "...execute esta ação (imprimir o número atual)."
* O bloco de código a ser repetido deve estar **indentado** (com um recuo).

---

## Explorando o `range()`

A função `range()` é versátil e pode receber diferentes argumentos:

* `range(fim)`: Gera números de `0` até `fim - 1`.
    * Exemplo: `range(3)` gera `0, 1, 2`.
* `range(inicio, fim)`: Gera números de `inicio` até `fim - 1`.
    * Exemplo: `range(2, 5)` gera `2, 3, 4`.
* `range(inicio, fim, passo)`: Gera números de `inicio` até `fim - 1`, pulando de `passo` em `passo`.
    * Exemplo: `range(0, 10, 2)` gera `0, 2, 4, 6, 8`.

---

## O Laço `while`: Repetição Condicional

O laço `while` é como um supervisor que continua executando uma tarefa **enquanto** uma condição específica for verdadeira. Ele não sabe de antemão quantas vezes vai repetir, apenas o critério para parar.

**Analogia:** Pense em encher um balde com água. Você mantém a torneira aberta (*a tarefa*) **enquanto** o balde não estiver cheio (*a condição*). Quando o balde enche, você fecha a torneira.

---

## Laço `while` em Python: Na Prática

```python
# Contar de 1 até 5
contador = 1
while contador <= 5:
    print(contador)
    contador = contador + 1  # Incrementa o contador
```

* `while contador <= 5:`: "Enquanto a variável `contador` for menor ou igual a 5..."
* `contador = contador + 1`: Esta linha é **crucial**. Ela atualiza a variável da condição para que, em algum momento, o laço termine.

---

## Erro Comum: O Laço Infinito

Um dos maiores perigos do `while` é o **laço infinito**. Isso acontece quando a condição de parada nunca é atingida.

**O que acontece?** O programa fica "preso", executando o mesmo bloco de código para sempre, e pode travar.

```python
# Exemplo de laço infinito (NÃO EXECUTE!)
contador = 1
while contador <= 5:
    print("Isso vai se repetir para sempre!")
    # Esquecemos de incrementar o 'contador'!
```

**Prevenção:** Sempre garanta que a variável da condição (`contador`, neste caso) seja modificada dentro do laço de uma forma que eventualmente torne a condição falsa.

---

## Atividade Prática: Estudo de Caso

**Problema:** Você precisa criar uma tabuada simples para um número escolhido pelo usuário. A tabuada deve ir de 1 a 10.

**Como resolver com um laço `for`?**

```python
numero_tabuada = 7 # Poderia ser um input do usuário

print(f"Tabuada do {numero_tabuada}:")

for i in range(1, 11): # Gera números de 1 a 10
    resultado = numero_tabuada * i
    print(f"{numero_tabuada} x {i} = {resultado}")
```

---

## Aplicação no Mundo Real

* **Redes Sociais:** Um laço `for` pode percorrer sua lista de amigos para exibir as últimas atualizações de cada um no seu feed.
* **E-commerce:** Um laço `while` pode continuar exibindo produtos em uma página enquanto o usuário rola para baixo (a condição é "o usuário ainda está rolando").
* **Jogos:** Um laço `for` pode ser usado para desenhar todos os inimigos em uma fase. Um laço `while` principal mantém o jogo rodando enquanto a condição "vidas > 0" for verdadeira.

---

## Reflexão: Qual Laço Usar?

Pense sobre o que você aprendeu. Reflita sobre as situações a seguir e decida qual laço (`for` ou `while`) seria mais apropriado:

1.  **Situação A:** Exibir os 10 produtos mais vendidos de uma loja.
2.  **Situação B:** Pedir para o usuário digitar uma senha até que ele acerte.

**Como a escolha do laço correto impacta a clareza e a segurança do seu código?** Pense no que poderia dar errado em cada situação se o laço errado fosse escolhido.

---

## Conclusão e Próximos Passos

* **Laços** são ferramentas essenciais para automatizar tarefas e lidar com dados em escala.
* O **laço `for`** é ideal para quando sabemos o número de repetições (sequências, listas).
* O **laço `while`** é perfeito para repetições baseadas em uma condição que pode mudar.
* É crucial ter cuidado com **laços infinitos** ao usar o `while`.

Agora, pratique! A melhor forma de consolidar esse conhecimento é criando seus próprios laços para resolver pequenos problemas.

---

## Material Complementar

* **Documentação Oficial do Python sobre Estruturas de Controle:** Para aprofundar, explore a documentação oficial.
    * https://docs.python.org/pt-br/3/tutorial/controlflow.html
* **W3Schools - Python For Loops:** Um ótimo recurso com exemplos interativos para praticar.
    * https://www.w3schools.com/python/python_for_loops.asp
* **Real Python - Python "while" Loops:** Um guia detalhado sobre o funcionamento do `while`.
    * https://realpython.com/python-while-loop/

---

## Referências

[1] MUELLER, John Paul. *Beginning programming with Python for dummies*. John Wiley & Sons, 2018.
[2] DOWNEY, Allen B. *Think Stats: Probability and Statistics for Programmers*. O'Reilly Media, 2011.
[3] Guia para aulas de programação inclusivas. (Material fornecido) 