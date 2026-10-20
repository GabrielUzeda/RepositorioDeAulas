---
theme: default
title: Juntando e resumindo dados
animation: fade-up
animation-stagger: 0.12s
animation-duration: 0.5s
---

# Juntando e resumindo dados

## INNER JOIN, LEFT JOIN, ORDER BY e GROUP BY

> *"E se uma cliente nunca fez um pedido: ela aparece no relatório?"*

---

## Onde paramos

<!-- animation: fade-up -->

Na aula passada, o `JOIN` trouxe a cidade da Ana.

- A **chave estrangeira** liga uma tabela à outra.
- O `ON` é a **ponte** entre as duas.

Hoje vamos descobrir o que acontece quando **não existe par** do outro lado.

---

## Objetivos desta aula

<!-- animation: fade-up -->

- **Diferenciar** `INNER JOIN` e `LEFT JOIN`.
- **Entender** o que é `NULL`.
- **Ordenar** resultados com `ORDER BY`.
- **Resumir** dados com `GROUP BY`.
- **Evitar** os erros mais comuns.

---

## Uma nova tabela: `pedidos`

<!-- animation: fade-up -->

Os mesmos clientes de antes, agora com pedidos.

| id | nome |
| --- | --- |
| 1 | Ana |
| 2 | Bruno |
| 3 | Carla |

| id | id_cliente | valor | status |
| --- | --- | --- | --- |
| 101 | 1 | 150 | PAGO |
| 102 | 1 | 80 | CANCELADO |
| 103 | 2 | 200 | PAGO |

---

## Quem não tem pedido?

<!-- animation: fade-up -->

Olhe a tabela de pedidos com calma.

- Ana tem **2** pedidos.
- Bruno tem **1** pedido.
- Carla tem **nenhum**.

Vamos acompanhar a Carla durante toda a aula.

---

## O JOIN da aula passada

<!-- animation: fade-up -->

```sql
SELECT clientes.nome, pedidos.valor
FROM clientes
JOIN pedidos ON clientes.id = pedidos.id_cliente;
```

O `JOIN` sozinho tem um nome completo:

**`INNER JOIN`**

---

## Apelidos para escrever menos

<!-- animation: fade-up -->

```sql
SELECT cli.nome, ped.valor
FROM clientes cli
INNER JOIN pedidos ped
    ON cli.id = ped.id_cliente;
```

- `cli` é o apelido de `clientes`.
- `ped` é o apelido de `pedidos`.

Vamos usá-los daqui em diante.

---

# INNER JOIN

---

## INNER JOIN: só quem tem par

<!-- animation: fade-up -->

Devolve apenas linhas com correspondência **nas duas tabelas**.

- Cliente com pedido: **aparece**.
- Cliente sem pedido: **fica de fora**.

---

## INNER JOIN: o resultado

<!-- animation: fade-up -->

```sql
SELECT cli.nome, ped.id AS id_pedido, ped.valor
FROM clientes cli
INNER JOIN pedidos ped ON cli.id = ped.id_cliente;
```

| nome | id_pedido | valor |
| --- | --- | --- |
| Ana | 101 | 150 |
| Ana | 102 | 80 |
| Bruno | 103 | 200 |

---

## Para onde foi a Carla?

<!-- animation: fade-up -->

- Não existe pedido com `id_cliente = 3`.
- Sem par, a linha dela **some**.
- O banco **não avisa nada**.

Às vezes isso é o desejado. Às vezes é um problema.

---

## Quando o INNER JOIN atrapalha

<!-- animation: fade-up -->

Um posto de saúde lista **todos os pacientes** e suas consultas, para uma campanha de vacina.

- Paciente sem consulta marcada **não aparece**.
- A lista fica menor que o público real.

---

## Pergunta antes de escolher o JOIN

<!-- animation: fade-up -->

> Eu quero ver **todos** os registros da tabela principal, mesmo os sem par?

- **Não:** `INNER JOIN`.
- **Sim:** precisamos de outro JOIN.

---

# LEFT JOIN

---

## LEFT JOIN: ninguém fica para trás

<!-- animation: fade-up -->

Mantém **todas** as linhas da tabela escrita depois do `FROM`.

- Com par: os dados aparecem.
- Sem par: as colunas do outro lado ficam **NULL**.

---

## LEFT JOIN: o resultado

<!-- animation: fade-up -->

```sql
SELECT cli.nome, ped.id AS id_pedido, ped.valor
FROM clientes cli
LEFT JOIN pedidos ped ON cli.id = ped.id_cliente;
```

| nome | id_pedido | valor |
| --- | --- | --- |
| Ana | 101 | 150 |
| Ana | 102 | 80 |
| Bruno | 103 | 200 |
| Carla | NULL | NULL |

A Carla voltou.

---

## Esquerda e direita

<!-- animation: fade-up -->

```sql
FROM clientes cli          -- esquerda: preservada
LEFT JOIN pedidos ped      -- direita: pode vir NULL
```

Trocar a ordem das tabelas **muda o resultado**.

Coloque no `FROM` a tabela da qual você não quer perder nenhuma linha.

---

## O que é NULL?

<!-- animation: fade-up -->

**NULL** significa **sem informação**.

- Não é zero.
- Não é texto vazio.

A Carla não gastou "zero": ela simplesmente não tem pedido.

---

## Testando NULL

<!-- animation: fade-up -->

Comparar com `=` não funciona. O teste correto é `IS NULL`:

```sql
WHERE ped.id IS NULL      -- certo
WHERE ped.id = NULL       -- não funciona
```

---

## Achando quem não tem pedido

<!-- animation: fade-up -->

```sql
SELECT cli.nome
FROM clientes cli
LEFT JOIN pedidos ped ON cli.id = ped.id_cliente
WHERE ped.id IS NULL;
```

| nome |
| --- |
| Carla |

---

## INNER JOIN x LEFT JOIN

<!-- animation: fade-up -->

| | INNER JOIN | LEFT JOIN |
| --- | --- | --- |
| **Mantém** | Só quem tem par | Toda a tabela da esquerda |
| **Sem par** | Some | Vira NULL |
| **Bom para** | Vendas realizadas | Cadastros e auditorias |

---

## Recapitulando

<!-- animation: fade-up -->

- `INNER JOIN`: só o que tem par.
- `LEFT JOIN`: tudo da esquerda, com `NULL` onde faltar par.
- `IS NULL`: encontra quem ficou sem par.

Próximo passo: **organizar** o resultado.

---

# ORDER BY

---

## Sem ordem garantida

<!-- animation: fade-up -->

O banco **não garante** a ordem das linhas.

Duas execuções da mesma consulta podem devolver ordens diferentes.

Se a ordem importa, é preciso pedir.

---

## ORDER BY: ASC e DESC

<!-- animation: fade-up -->

```sql
SELECT cli.nome, ped.valor
FROM clientes cli
INNER JOIN pedidos ped ON cli.id = ped.id_cliente
ORDER BY ped.valor DESC;
```

- `ASC`: do menor para o maior (padrão).
- `DESC`: do maior para o menor.

---

## Dois critérios

<!-- animation: fade-up -->

```sql
ORDER BY cli.nome ASC, ped.valor DESC;
```

Leia assim: "ordene por nome. Em caso de empate, o maior valor primeiro".

---

## NULL no ORDER BY

<!-- animation: fade-up -->

Cada banco trata o `NULL` de um jeito.

- **PostgreSQL e Oracle:** o maior valor. Em `ASC`, vai para o fim.
- **MySQL e SQL Server:** o menor valor. Em `ASC`, vai para o início.

No PostgreSQL e no Oracle: `ORDER BY valor DESC NULLS LAST`.

---

# GROUP BY

---

## De linhas soltas para resumos

<!-- animation: fade-up -->

Um tesoureiro separa as notas em montinhos antes de contar.

O **GROUP BY** faz o mesmo:

- agrupa linhas com o mesmo valor;
- devolve **uma linha de resumo** por grupo.

---

## Funções de resumo

<!-- animation: fade-up -->

- `COUNT(coluna)`: quantas linhas.
- `SUM(coluna)`: soma.
- `AVG(coluna)`: média.
- `MIN` e `MAX`: menor e maior valor.

Elas ignoram `NULL`.

---

## GROUP BY: primeiro exemplo

<!-- animation: fade-up -->

```sql
SELECT cli.nome,
       COUNT(ped.id)  AS total_pedidos,
       SUM(ped.valor) AS total_gasto
FROM clientes cli
INNER JOIN pedidos ped ON cli.id = ped.id_cliente
GROUP BY cli.nome;
```

---

## O resultado

<!-- animation: fade-up -->

| nome | total_pedidos | total_gasto |
| --- | --- | --- |
| Ana | 2 | 230 |
| Bruno | 1 | 200 |

Três linhas viraram dois resumos: um por cliente.

---

## A regra de ouro

<!-- animation: fade-up -->

Toda coluna do `SELECT` deve estar:

1. no `GROUP BY`, **ou**
2. dentro de uma função como `SUM` ou `COUNT`.

Senão, o banco não sabe qual valor mostrar para o grupo.

---

## Agrupe pelo id

<!-- animation: fade-up -->

Duas pessoas podem se chamar "Ana Silva".

Agrupar só pelo nome **soma os pedidos das duas**.

```sql
GROUP BY cli.id, cli.nome
```

---

## WHERE x HAVING

<!-- animation: fade-up -->

- `WHERE` filtra **linhas**, antes de agrupar.
- `HAVING` filtra **grupos**, depois de agrupar.

---

## WHERE e HAVING juntos

<!-- animation: fade-up -->

```sql
SELECT cli.nome, SUM(ped.valor) AS total_gasto
FROM clientes cli
INNER JOIN pedidos ped ON cli.id = ped.id_cliente
WHERE ped.status = 'PAGO'
GROUP BY cli.nome
HAVING SUM(ped.valor) >= 200;
```

| nome | total_gasto |
| --- | --- |
| Bruno | 200 |

---

## A ordem real de execução

<!-- animation: fade-up -->

```mermaid
flowchart LR
    A["1 FROM e JOIN"] --> B["2 WHERE"]
    B --> C["3 GROUP BY"]
    C --> D["4 HAVING"]
    D --> E["5 SELECT"]
    E --> F["6 ORDER BY"]
```

O apelido criado no `SELECT` ainda não existe no `WHERE`. No `ORDER BY`, já existe.

---

# Juntando tudo

---

## INNER JOIN + GROUP BY + ORDER BY

<!-- animation: fade-up -->

```sql
SELECT cli.id, cli.nome,
       COUNT(ped.id)  AS total_pedidos,
       SUM(ped.valor) AS volume_financeiro
FROM clientes cli
INNER JOIN pedidos ped ON cli.id = ped.id_cliente
GROUP BY cli.id, cli.nome
ORDER BY volume_financeiro DESC;
```

---

## O ranking de clientes

<!-- animation: fade-up -->

| id | nome | total_pedidos | volume_financeiro |
| --- | --- | --- | --- |
| 1 | Ana | 2 | 230 |
| 2 | Bruno | 1 | 200 |

Quem não comprou **não entra**.

---

## LEFT JOIN + GROUP BY

<!-- animation: fade-up -->

Agora queremos **todos** os clientes.

```sql
SELECT cli.nome,
       COUNT(ped.id)  AS total_pedidos,
       SUM(ped.valor) AS total_gasto
FROM clientes cli
LEFT JOIN pedidos ped ON cli.id = ped.id_cliente
GROUP BY cli.id, cli.nome;
```

---

## O retrato completo

<!-- animation: fade-up -->

| nome | total_pedidos | total_gasto |
| --- | --- | --- |
| Ana | 2 | 230 |
| Bruno | 1 | 200 |
| Carla | 0 | NULL |

Mostra quem se destaca e quem precisa de atenção.

---

# Armadilhas

---

## Pegadinha 1: COUNT(*)

<!-- animation: fade-up -->

Com `LEFT JOIN`, a Carla gera **uma linha** com campos `NULL`.

- `COUNT(*)` conta linhas: devolve **1**. Errado.
- `COUNT(ped.id)` ignora NULL: devolve **0**. Certo.

---

## Pegadinha 2: o WHERE que desfaz o LEFT JOIN

<!-- animation: fade-up -->

```sql
SELECT cli.nome, ped.valor
FROM clientes cli
LEFT JOIN pedidos ped ON cli.id = ped.id_cliente
WHERE ped.status = 'PAGO';
```

Para a Carla, `ped.status` é `NULL`. O `WHERE` elimina a linha dela.

O LEFT JOIN virou um INNER JOIN.

---

## Pegadinha 2: a correção

<!-- animation: fade-up -->

Leve o filtro para dentro do `ON`:

```sql
FROM clientes cli
LEFT JOIN pedidos ped
    ON cli.id = ped.id_cliente
    AND ped.status = 'PAGO';
```

| nome | valor |
| --- | --- |
| Ana | 150 |
| Bruno | 200 |
| Carla | NULL |

---

## Pegadinha 3: somas que dobram

<!-- animation: fade-up -->

Imagine que a Ana também tenha **2 telefones** cadastrados.

- Juntando pedidos **e** telefones: 2 x 2 = **4 linhas**.
- `SUM(valor)` dá 460, mas o real é **230**.

---

## Pegadinha 3: a correção

<!-- animation: fade-up -->

Resuma primeiro, junte depois:

```sql
SELECT cli.nome, resumo.total_gasto
FROM clientes cli
LEFT JOIN (
    SELECT id_cliente, SUM(valor) AS total_gasto
    FROM pedidos
    GROUP BY id_cliente
) resumo ON cli.id = resumo.id_cliente;
```

A parte entre parênteses é uma **subconsulta**.

---

# Praticando

---

## Estudo de caso: filiais

<!-- animation: fade-up -->

Uma rede de lojas quer um relatório com:

- **todas** as filiais, mesmo sem vendas;
- total de vendas concluídas e faturamento;
- faturamento **0** para quem não vendeu;
- da maior para a menor receita.

Antes de ver a resposta: qual JOIN? Onde vai o filtro?

---

## Estudo de caso: a solução

<!-- animation: fade-up -->

```sql
SELECT fil.id, fil.nome,
       COUNT(ven.id) AS total_vendas,
       COALESCE(SUM(ven.valor), 0) AS faturamento
FROM filiais fil
LEFT JOIN vendas ven
    ON fil.id = ven.id_filial
    AND ven.status = 'CONCLUIDA'
GROUP BY fil.id, fil.nome
ORDER BY faturamento DESC;
```

---

## Lendo a solução

<!-- animation: fade-up -->

- `LEFT JOIN`: nenhuma filial some.
- Filtro no `ON`: não derruba filiais sem vendas.
- `COUNT(ven.id)`: conta 0 quando não há venda.
- `COALESCE`: troca `NULL` por 0.

---

## Para praticar

<!-- animation: fade-up -->

Com `clientes` e `pedidos`, escreva:

1. Cada cliente com o **maior** pedido dele.
2. Quantos pedidos **cancelados** cada cliente tem, inclusive zero.
3. Clientes com mais de 100 gastos em pedidos pagos.

---

## Quando o resultado parecer estranho

<!-- animation: fade-up -->

- **Linhas sumiram?** Veja o `WHERE` após um `LEFT JOIN`.
- **Linhas a mais?** A relação é 1:1 ou 1:N?
- **Contagem errada?** `COUNT(*)` ou `COUNT(coluna)`?
- **Soma inflada?** Há duas tabelas "de muitos" no JOIN?

Rode a consulta por partes.

---

## O que levamos desta aula

<!-- animation: fade-up -->

- `INNER JOIN` mostra só o que tem par.
- `LEFT JOIN` preserva a tabela principal.
- `NULL` é ausência de informação: use `IS NULL`.
- `ORDER BY` é o único jeito de garantir a ordem.
- `GROUP BY` transforma linhas em resumos.

---

## Material complementar

<!-- animation: fade-up -->

**Livros**

- **Sistemas de Banco de Dados** (7. ed.), Silberschatz, Korth e Sudarshan. GEN LTC, 2020.
- **Introdução a Sistemas de Bancos de Dados** (8. ed.), C. J. Date. Elsevier, 2004.
- **SQL for Smarties** (5. ed.), Joe Celko. Morgan Kaufmann, 2014.

**Documentação**

- PostgreSQL: <https://www.postgresql.org/docs/current/queries-table-expressions.html>
- MySQL: <https://dev.mysql.com/doc/refman/8.0/en/join.html>
