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

# Tipos Compostos e Estruturas de Dados
Organizando Informações no Código

---

## Objetivos da Aula

Ao final desta sessão, você será capaz de:

* Diferenciar **Tipos Primitivos** de **Tipos Compostos**.
* Entender o conceito de **Listas** (Arrays) e como usá-las para agrupar dados.
* Compreender o conceito de **Dicionários** (Mapas) e suas aplicações.
* Analisar qual estrutura de dado é mais adequada para resolver problemas comuns.

---

## A Caixa de Ferramentas

Imagine que você precisa construir uma casa.

* Um **Tipo Primitivo** é como uma única ferramenta: um martelo, uma chave de fenda, um tijolo. Ele guarda **um único valor** (ex: o número `10` ou o texto `"Olá"`).

* Um **Tipo Composto** é a **caixa de ferramentas** ou um **caixote de tijolos**. Ele não é a ferramenta em si, mas um *organizador* que agrupa vários itens, permitindo que você os carregue e gerencie juntos.

Em programação, raramente trabalhamos com um único dado. Precisamos organizar coleções de dados.

---

## Primitivos vs. Compostos

Os blocos de construção básicos da informação:

**Tipos Primitivos (Simples)**
Armazenam **um único valor**.
* `inteiro` (ex: `7`)
* `float` (ex: `9.99`)
* `booleano` (ex: `True` ou `False`)
* `string` (ex: `"Ana"`)

**Tipos Compostos (Estruturas de Dados)**
Agrupam **múltiplos valores** em uma única variável.
* **Listas** (ou Arrays)
* **Dicionários** (ou Mapas)

---

## Conceito: Listas (Arrays)

Uma Lista é uma coleção **ordenada** de itens.

* **Analogia:** Pense nela como uma estante com prateleiras numeradas ou um trem com vagões numerados. A ordem importa.

* **Como funciona:** Cada item na lista tem uma posição específica, chamada **índice** (index).

* **A Regra de Ouro:** A contagem dos índices quase sempre começa no **zero** (0), não no 1. O primeiro item está no índice 0, o segundo no índice 1, e assim por diante.

---

## Listas: Exemplo Prático (Python)

Uma lista de tarefas, onde a ordem importa.

```python
# Uma lista de strings
tarefas = ["Comprar leite", "Pagar a conta", "Estudar Python"]

# Acessando o PRIMEIRO item (índice 0)
primeira_tarefa = tarefas[0]
print(primeira_tarefa) # Saída: "Comprar leite"

# Acessando o TERCEIRO item (índice 2)
terceira_tarefa = tarefas[2]
print(terceira_tarefa) # Saída: "Estudar Python"

# Adicionando um item ao FINAL da lista
tarefas.append("Ligar para o médico")

print(tarefas)
# Saída: ['Comprar leite', 'Pagar a conta', 'Estudar Python', 'Ligar para o médico']
```

---

## Listas: Mais Operações (Python)
Listas são flexíveis. Você pode modificar, fatiar e verificar.

```python
numeros = [10, 20, 30, 40, 50]

# Alterando um item pelo índice (o 20 se torna 25)
numeros[1] = 25  
print(numeros) # Saída: [10, 25, 30, 40, 50]

# Fatiando (Slicing): Pegando um pedaço da lista
# Pega do índice 1 (inclusive) até o 3 (exclusive)
meio = numeros[1:3]
print(meio) # Saída: [25, 30]

# Verificando se um item existe
if 30 in numeros:
    print("O número 30 está na lista!")
```

---

## Conceito: Dicionários (Mapas)

Um Dicionário é uma coleção de pares **chave-valor**. Não há ordem garantida.

* **Analogia:** É como um dicionário de idiomas ou um fichário de biblioteca. Você não procura pela "quinta palavra"; você procura pela palavra (a **chave**) para encontrar sua definição (o **valor**).

* **Como funciona:** Você acessa um valor usando uma **chave** única (geralmente uma string), e não um índice numérico.

* **A Regra de Ouro:** São extremamente rápidos para *encontrar* dados se você souber a chave.

---

## Dicionários: Exemplo Prático (Python)

Armazenando as informações de um perfil de usuário.

```python
# Um dicionário usando strings como chaves
usuario = {
    "nome": "Ana Silva",
    "email": "ana.silva@email.com",
    "idade": 28
}

# Acessando um valor pela sua CHAVE
print(usuario["email"]) # Saída: "ana.silva@email.com"

# Adicionando um novo par chave-valor
usuario["cidade"] = "São Paulo"
print(usuario)
# Saída: {'nome': 'Ana Silva', 'email': 'ana.silva@email.com', 'idade': 28, 'cidade': 'São Paulo'}
```

---

## Dicionários: Mais Operações (Python)
Dicionários são ótimos para buscas e atualizações seguras.

```python
usuario = { "nome": "Ana Silva", "idade": 28 }

# Acessando com segurança: .get()
# .get() evita erros se a chave não existir.
email = usuario.get("email")
print(email) # Saída: None (Não dá erro!)

# Definindo um valor padrão com .get()
trabalho = usuario.get("trabalho", "Não informado")
print(trabalho) # Saída: "Não informado"

# Removendo uma chave
del usuario["idade"]
print(usuario) # Saída: {'nome': 'Ana Silva'}
```

---

## Armadilhas Comuns (Educação Preventiva)

O erro mais comum é confundir como acessamos Listas e Dicionários.

* **Analogia do Erro:** Tentar encontrar um livro na biblioteca (Dicionário) gritando "Eu quero o livro número 5!" (usando um índice) em vez de usar o nome do livro (a chave) no catálogo.

* **Erro 1: Usar índice em Dicionário**
    `print(usuario[0])`  
    **Gera um Erro!** Dicionários não entendem índices numéricos; eles entendem **chaves** (ex: `usuario["nome"]`).

* **Erro 2: Usar chave em Lista**
    `print(tarefas["nome"])`  
    **Gera um Erro!** Listas não entendem chaves de texto; elas entendem **índices** (ex: `tarefas[0]`).

---

## Estudo de Caso: O Carrinho de Compras

**Problema:** Você está programando um site de e-commerce e precisa armazenar os itens que um usuário colocou no carrinho de compras.

* **Abordagem 1: Usar uma Lista Simples**
    `carrinho = ["Maçã", "Leite", "Pão", "Maçã"]`
    * *Prós:* Simples.
    * *Contras:* Como saber que são **duas** maçãs? E o preço?

* **Abordagem 2: Usar um Dicionário (Melhor)**
    `carrinho = { "Maçã": 2, "Leite": 1, "Pão": 1 }`
    * *Prós:* Armazena a **quantidade** (valor) para cada **item** (chave).

* **Abordagem 3: Uma Lista de Dicionários (Mais Robusto)**
    * E se quisermos armazenar o item, a quantidade E o preço unitário?
    * Podemos usar uma lista, onde *cada item* é um dicionário.

---

## Estudo de Caso: Carrinho (Código)

```python
# Abordagem 3: Lista de Dicionários
carrinho = [
    { "item": "Maçã", "qtd": 2, "preco_unit": 1.50 },
    { "item": "Leite", "qtd": 1, "preco_unit": 4.00 },
    { "item": "Pão", "qtd": 6, "preco_unit": 0.50 }
]

# Calculando o total
total = 0
for produto in carrinho:
    # Acessamos cada dicionário e suas chaves
    subtotal = produto["qtd"] * produto["preco_unit"]
    total = total + subtotal
    print(f"Item: {produto['item']} - Subtotal: {subtotal}")

print(f"Total do carrinho: R$ {total}")
# Saída: Total do carrinho: R$ 10.0
```

---

## Aplicação no Mundo Real

Você usa tipos compostos todos os dias, mesmo sem perceber:

* **Listas (Sequências Ordenadas)**
    * O feed do seu Instagram ou Twitter (uma lista de posts, do mais novo para o mais antigo).
    * Uma playlist de música (uma lista de músicas que tocam em ordem).
    * O histórico do seu navegador (uma lista de sites visitados).

* **Dicionários (Consultas por Rótulo)**
    * Sua lista de contatos no celular (Chave: "Nome da Pessoa", Valor: "Número de Telefone").
    * As configurações de qualquer aplicativo (Chave: "Modo Noturno", Valor: `True`).
    * A tabela nutricional de um alimento (Chave: "Proteínas", Valor: "10g").

---

## Reflexão Rápida

Pense em um aplicativo de música (como Spotify ou Apple Music).

1.  **Onde ele provavelmente usa uma LISTA?**
    * ... para a fila de músicas "Próximas a Tocar".
    * ... para os resultados de uma busca (uma lista ordenada de músicas).

2.  **Onde ele provavelmente usa um DICIONÁRIO?**
    * ... para guardar os dados de UMA música (`{"titulo": "...", "artista": "...", "album": "..."}`).
    * ... para guardar os dados do seu perfil (`{"username": "...", "email": "..."}`).

---

## Conclusão

* **Tipos Primitivos** guardam um único dado (`7`, `"Olá"`).
* **Tipos Compostos** (Estruturas de Dados) são "caixas de ferramentas" que agrupam dados.

* Use uma **LISTA** quando a **ORDEM** dos itens for a coisa mais importante (acesso por índice `[0]`).

* Use um **DICIONÁCULO** quando a capacidade de **BUSCA RÁPIDA** por um rótulo for o mais importante (acesso por chave `["chave"]`).

Escolher a estrutura correta é o primeiro passo para escrever um código eficiente e lógico.

---

## Material Complementar

* **Documentação Oficial Python (Listas):**
    Para aprofundar, explore todos os métodos que uma lista oferece.
    [https://docs.python.org/3/tutorial/datastructures.html](https://docs.python.org/3/tutorial/datastructures.html)

* **Documentação Oficial Python (Dicionários):**
    Veja como dicionários são otimizados para busca rápida.
    [https://wiki.python.org/moin/Dictionary](https://wiki.python.org/moin/Dictionary)

* **W3Schools (Python Dictionaries):**
    Um ótimo recurso com exemplos interativos para praticar.
    [https://www.w3schools.