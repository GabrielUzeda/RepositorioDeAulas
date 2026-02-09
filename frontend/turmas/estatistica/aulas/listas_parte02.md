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

# Revisão de Listas em Python
Introdução ao `for`, `sort()` e `zip()`

---

## Objetivos de Aprendizagem

* Compreender a estrutura e utilidade das **listas** em Python.
* Aprender a percorrer listas de forma eficiente usando o laço `for`.
* Dominar a ordenação de dados com o método `.sort()`.
* Aprender a combinar listas em paralelo com a função `zip()`.
* Identificar e prevenir erros comuns na manipulação de listas.

---

## O que são Listas? Uma Analogia

Imagine uma lista de compras. É uma coleção **ordenada** de itens onde você pode:
* Adicionar ou remover produtos.
* Verificar o terceiro item da lista.
* Trocar um item por outro.

Em Python, uma **lista** funciona de maneira similar: é uma "caixa" versátil que armazena uma coleção de valores (números, textos, etc.) em uma sequência específica, permitindo modificações.

---

## O Laço `for`: O Inspetor de Itens

Imagine um inspetor em uma linha de montagem. Sua função é examinar **cada item**, um por um, para verificar sua qualidade.

O laço `for` em Python é como esse inspetor. Ele percorre uma lista do início ao fim, executando uma ação para cada item encontrado.

```python
tarefas = ["Limpar o quarto", "Fazer compras", "Pagar contas"]

for tarefa in tarefas:
    print("Tarefa pendente:", tarefa)
```

---

## Ordenando a Bagunça: O Método `.sort()`

Pense em organizar uma estante de livros. Você pode organizá-los em ordem alfabética diretamente na prateleira.

O método `.sort()` faz exatamente isso: ele **reorganiza a própria lista** em ordem crescente (ou alfabética), alterando sua estrutura original permanentemente.

```python
numeros = [40, 10, 30, 20]
print("Antes:", numeros)

numeros.sort()  # A mágica acontece aqui!
print("Depois:", numeros)
```

Resultado: `[10, 20, 30, 40]`

---

## Combinando Listas: A Função `zip()`

Imagine ter duas listas separadas: uma com nomes de alunos e outra com suas respectivas notas. Como combinar as informações para saber a nota de cada um?

A função `zip()` funciona como um zíper: ela une duas ou mais listas, criando pares de elementos que possuem a mesma posição.

```python
alunos = ["Ana", "Bruno", "Carla"]
notas = [9.5, 8.0, 10.0]

for aluno, nota in zip(alunos, notas):
    print(f"O(A) aluno(a) {aluno} tirou a nota {nota}")
```

---

## Erros Comuns: Armadilhas a Evitar

Um erro frequente é tentar usar o resultado do `.sort()` como se fosse uma nova lista.

Lembre-se da nossa estante de livros: quando você os organiza, a estante continua sendo a mesma, apenas com os livros em uma nova ordem. O `.sort()` **modifica a lista original** e não retorna uma nova.

```python
# Errado!
numeros = [3, 1, 2]
lista_ordenada = numeros.sort()  # Isso não funciona!
print(lista_ordenada) # O resultado será "None" (Nulo)

# Correto
numeros = [3, 1, 2]
numeros.sort()  # Modifica a lista original
print(numeros) # Agora sim: [1, 2, 3]
```

---

## Atividade Prática: Diário de Bordo

Vamos criar um pequeno sistema para gerenciar as despesas de uma viagem.

**Cenário:** Você tem duas listas, uma com a descrição de cada despesa e outra com o valor correspondente.

1.  Crie as duas listas: `despesas` e `valores`.
2.  Use `zip` e `for` para exibir cada despesa e seu valor.
3.  Use `.sort()` na lista de valores para encontrar a despesa mais barata (o primeiro item após a ordenação).

---

## Aplicação no Mundo Real

Esses conceitos são a base para tarefas mais complexas:

* **Análise de Dados:** Ordenar e percorrer grandes volumes de dados para encontrar padrões, como o desempenho de vendas de produtos.
* **Desenvolvimento Web:** Exibir uma lista de produtos (nomes, preços, imagens) em um site de e-commerce, combinando informações de diferentes fontes com `zip`.
* **Automação:** Ler uma lista de arquivos em uma pasta e processar cada um deles usando um laço `for`.

---

## Reflexão

Pense em como você organiza informações no seu dia a dia. Uma agenda, uma playlist de músicas, os contatos do seu celular.

* De que forma um laço `for` poderia automatizar uma tarefa repetitiva que você faz com essas listas?
* Em qual situação do seu cotidiano a função `zip` seria útil para combinar informações?

Refletir sobre essas conexões ajuda a solidificar o aprendizado e a ver a programação como uma ferramenta para resolver problemas reais.

---

## Conclusão

Hoje, revisamos três ferramentas essenciais para manipular listas em Python:
* O laço **`for`** nos permite "conversar" com cada item de uma lista.
* O método **`.sort()`** coloca nossos dados em ordem, facilitando a análise.
* A função **`zip()`** nos ajuda a conectar informações de diferentes listas de forma inteligente.

Dominar essas ferramentas é um passo fundamental para construir programas mais poderosos e eficientes.

---

## Material Complementar

* **Documentação Oficial do Python sobre Listas:** Para aprofundar, explore todos os métodos que uma lista oferece. [https://docs.python.org/3/tutorial/datastructures.html](https://docs.python.org/3/tutorial/datastructures.html) [1]
* **W3Schools - Python For Loops:** Um ótimo recurso com exemplos interativos para praticar. [https://www.w3schools.com/python/python_for_loops.asp](https://www.w3schools.com/python/python_for_loops.asp) [2]

---

## Referências

[1] Python Software Foundation. *Python 3 Documentation*.
[2] W3Schools. *Python For Loops Tutorial*.