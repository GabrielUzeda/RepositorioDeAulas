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
    font-family: 'Courier New', Courier, monospace;
    background-color: #e0e0e0;
    padding: 2px 5px;
    border-radius: 4px;
  }
---

# Guia de Relacionamentos em SQL com MySQL
Conectando os pontos dos seus dados (Versão Aprimorada)

---

## Objetivos de Aprendizagem

* Compreender o que são **relacionamentos** em bancos de dados.
* Identificar e utilizar **Chaves Primárias** e **Estrangeiras**.
* Diferenciar os tipos de relacionamentos: **1:1, 1:N e N:M**.
* Aprender a consultar dados relacionados com **`JOINs`**.
* Reconhecer e evitar erros comuns na modelagem de dados.

---

## A Biblioteca de Dados

Imagine um banco de dados como uma grande biblioteca. Cada tabela é uma estante de livros sobre um assunto específico: "Clientes", "Produtos", "Vendas".

Os relacionamentos são o sistema de fichas que conecta tudo. Uma ficha na estante "Vendas" aponta exatamente para o livro na estante "Clientes" e para o livro na estante "Produtos". Sem essas conexões, teríamos apenas informações isoladas e sem sentido.

---

## Os Pilares da Conexão: Chaves

Para que as conexões funcionem, precisamos de identificadores únicos.

* **Chave Primária (Primary Key - PK):** É o RG único de cada registro em uma tabela. Garante que não existam dois clientes ou dois produtos com o mesmo ID.

* **Chave Estrangeira (Foreign Key - FK):** É a "cópia" da chave primária de outra tabela. Ela cria o vínculo, a referência entre as tabelas.

---

## Implementando as Chaves em SQL

A teoria se materializa no código ao criarmos as tabelas. Veja como a Chave Estrangeira (`id_cliente`) na tabela `Pedidos` aponta para a Chave Primária da tabela `Clientes`.

```sql
-- Tabela principal
CREATE TABLE Clientes (
    id_cliente INT PRIMARY KEY,
    nome VARCHAR(100)
);

-- Tabela dependente
CREATE TABLE Pedidos (
    id_pedido INT PRIMARY KEY,
    data_pedido DATE,
    id_cliente INT,
    FOREIGN KEY (id_cliente) REFERENCES Clientes(id_cliente)
);
```

---

## Tipos de Relacionamentos: 1 para 1 (1:1)

Um registro de uma tabela se relaciona com **apenas um** registro de outra.
**Exemplo:** Um motorista e sua carteira de motorista.

<div class="mermaid">
graph LR;
  Motorista -- 1..1 --- CNH(Carteira);
</div>

* A `FOREIGN KEY` na tabela `Carteiras` geralmente também é a `PRIMARY KEY`.

---

## Tipos de Relacionamentos: 1 para Muitos (1:N)

Um registro da tabela "pai" (o lado "1") pode se relacionar com **vários** registros da tabela "filho" (o lado "N").
**Exemplo:** Um cliente pode ter vários pedidos.

<div class="mermaid">
graph LR;
  Cliente -- 1..N --- Pedido;
</div>

* A tabela `Pedidos` (lado N) contém a Chave Estrangeira (`id_cliente`).

---

## Tipos de Relacionamentos: Muitos para Muitos (N:M)

Vários registros de uma tabela podem se relacionar com vários de outra.
**Exemplo:** Um produto pode estar em vários pedidos, e um pedido pode ter vários produtos.

Isso requer uma **tabela de junção**.

<div class="mermaid">
graph LR
  Pedido -->|0..N| ItemPedido
  Produto -->|0..N| ItemPedido
  ItemPedido --> Pedido
  ItemPedido --> Produto
</div>

---

## Consultando Dados Conectados: `INNER JOIN`

O `INNER JOIN` retorna apenas os registros que possuem correspondência em **ambas** as tabelas. É como pedir uma lista de clientes que **realmente fizeram pedidos**.

```sql
SELECT
    c.nome,
    p.data_pedido
FROM
    Clientes c
INNER JOIN
    Pedidos p ON c.id_cliente = p.id_cliente;
```

A cláusula `ON` é crucial: é a regra que diz como as tabelas se conectam.

---

## Indo Além: O `LEFT JOIN`

E se quisermos ver **todos os clientes**, inclusive aqueles que nunca fizeram um pedido? Usamos o `LEFT JOIN`.

Ele retorna **todos** os registros da tabela à esquerda (`Clientes`) e os registros correspondentes da tabela à direita (`Pedidos`). Se não houver correspondência, os campos da tabela da direita virão como `NULL`.

```sql
SELECT
    c.nome,
    p.id_pedido
FROM
    Clientes c
LEFT JOIN
    Pedidos p ON c.id_cliente = p.id_cliente;
```

---
## `INNER` vs `LEFT JOIN`: Visualizando a Diferença

**Tabela Clientes**
| id_cliente | nome |
| :--- | :--- |
| 1 | Ana |
| 2 | Bruno |
| 3 | Carla |

**Tabela Pedidos**
| id_pedido | id_cliente |
| :--- | :--- |
| 101 | 1 |
| 102 | 2 |
| 103 | 2 |
---

**Resultado `INNER JOIN`** (Apenas quem tem pedido)
| nome | id_pedido |
| :--- | :--- |
| Ana | 101 |
| Bruno | 102 |
| Bruno | 103 |

**Resultado `LEFT JOIN`** (Todos os clientes)
| nome | id_pedido |
| :--- | :--- |
| Ana | 101 |
| Bruno | 102 |
| Bruno | 103 |
| **Carla** | **NULL** |

---

## O Perigo das Conexões Soltas

**Erro Comum:** Esquecer a cláusula `ON` ou usar a condição errada em um `JOIN`.

Imagine conectar a tabela de "Clientes" com a de "Pedidos" usando o campo `nome` em vez do `id`. Se dois clientes tiverem o mesmo nome ("José Silva"), os pedidos de um poderiam ser atribuídos ao outro.

Isso gera um **produto cartesiano**, resultando em dados incorretos e lentidão. É como tentar montar um quebra-cabeça com as peças erradas.

---

## Atividade Prática: Estudo de Caso

Você está modelando um sistema para um blog. As tabelas são `Autores` e `Posts`.

1.  Qual o tipo de relacionamento entre `Autores` e `Posts`? (Considere que um post tem apenas um autor).
2.  Como você estruturaria as chaves (PK e FK) nessas tabelas?
3.  Escreva uma consulta SQL para listar o nome de cada autor ao lado do título de cada um de seus posts.

---
## Estudo de Caso: Solução

1.  **Tipo de Relacionamento:** **1 para Muitos (1:N)**. Um autor pode escrever muitos posts, mas cada post tem apenas um autor.

2.  **Estrutura das Chaves:**
    * `Autores`: `id_autor` (PK)
    * `Posts`: `id_post` (PK) e `id_autor` (FK, referenciando `Autores.id_autor`).

3.  **Consulta SQL:**
```sql
SELECT
    a.nome_autor,
    p.titulo_post
FROM
    Autores a
INNER JOIN
    Posts p ON a.id_autor = p.id_autor;
```

---

## Reflexão

Pense em um sistema que você usa no dia a dia (rede social, e-commerce, streaming).
* Quais "tabelas" você consegue identificar? (Ex: Usuários, Filmes, Playlists).
* Como elas se relacionam? (Ex: Um usuário cria várias playlists, um filme pode estar em várias playlists).
* Entender esses relacionamentos ajuda a perceber como os dados são organizados e por que certas funcionalidades são possíveis.

---

## Conclusão e Aplicação Real

Dominar relacionamentos e `JOINs` é a diferença entre ser um mero extrator de dados e um verdadeiro analista.

* **Clareza:** Permite construir consultas complexas de forma lógica.
* **Integridade:** Garante que os dados permaneçam consistentes e confiáveis.
* **Performance:** Uma modelagem correta e `JOINs` bem escritos são fundamentais para o desempenho do sistema.

Você agora tem a base para construir e consultar bancos de dados relacionais de forma eficaz e profissional.

---

## Material Complementar

* **Documentação Oficial do MySQL sobre JOINs:** Para aprofundar, explore a sintaxe e os exemplos de todos os tipos de `JOIN`.
    `https://dev.mysql.com/doc/refman/8.0/en/join.html`
* **W3Schools SQL Joins:** Um ótimo recurso com exemplos interativos para praticar.
    `https://www.w3schools.com/sql/sql_join.asp`

---

## Referências

[1] Beighley, L. *Use a Cabeça! SQL*. Alta Books, 2008.
[2] Documentação Oficial do MySQL. *MySQL 8.0 Reference Manual*. Oracle Corporation.
[3] Silberschatz, A., Korth, H. F., & Sudarshan, S. *Sistemas de Banco de Dados*. McGraw-Hill Brasil, 2012.