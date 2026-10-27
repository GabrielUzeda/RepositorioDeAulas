---
marp: true
theme: default
title: Subconsultas em Banco de Dados
description: Uma consulta dentro de outra: como calcular um valor, montar uma lista e resumir dados antes de usar no resultado final
---

# Subconsultas em Banco de Dados
## Perguntas dentro de perguntas
*Uma conversa sobre IN, NOT IN, EXISTS e NOT EXISTS*

---

## Exemplo de hoje: a lanchonete da Dona Marta

Dona Marta tem uma lanchonete de bairro e anota clientes e pedidos no computador.

<div class="grid">
<div class="col-5">

### clientes
| id | nome |
| --- | --- |
| 1 | Ana |
| 2 | Bruno |
| 3 | Carla |
</div>
<div class="col-7">

### pedidos
| id | id_cliente | valor | status |
| --- | --- | --- | --- |
| 1 | 1 | 130 | PAGO |
| 2 | 1 | 100 | PAGO |
| 3 | 2 | 200 | PAGO |
</div>
</div>

A Ana fez dois pedidos, o Bruno fez um, e a Carla ainda não pediu nada. Guarde essa história: ela volta a aula inteira.

---

## Os dados continuam à mão


```interactive
{"type":"reference","title":"Consulte os dados sem sair do código","scope":"deck","code":"SELECT clientes.nome, pedidos.valor\nFROM clientes JOIN pedidos ON clientes.id = pedidos.id_cliente;","tables":[{"term":"clientes","headers":["id","nome"],"rows":[[1,"Ana"],[2,"Bruno"],[3,"Carla"]]},{"term":"pedidos","headers":["id","id_cliente","valor","status"],"rows":[[1,1,130,"PAGO"],[2,1,100,"PAGO"],[3,2,200,"PAGO"]]}]}
```


---

## O problema: uma resposta depende da outra

Dona Marta quer saber quais pedidos ficaram **acima da média**.

Parece uma pergunta só, mas tem duas partes:

1. Qual é a média dos pedidos?
2. Quais pedidos passam dessa média?

A segunda parte **depende da primeira**. Um `SELECT` comum lê uma linha de cada vez, e a média só existe depois de olhar **todas** as linhas. Como ligar as duas partes numa consulta só?

---

## A tentativa que não funciona

A primeira ideia costuma ser esta:

```sql
SELECT id, valor
FROM pedidos
WHERE valor > AVG(valor);
```

O banco recusa, com uma mensagem parecida com *"funções de agregação não são permitidas no WHERE"*.

O `WHERE` testa cada linha isoladamente: "este valor é maior que...?". Mas para responder isso ele precisaria da média, que ainda não foi calculada, porque depende de todas as linhas. Falta uma forma de calcular o valor **antes** de comparar.

---

## Não é só a média

Dona Marta tem outras perguntas, e todas seguem o mesmo padrão:

| Pergunta | Por que um SELECT simples não basta |
| --- | --- |
| "Quem já pagou algum pedido?" | A resposta vem de outra tabela e é uma lista de clientes |
| "Quem nunca pediu nada?" | Cada cliente precisa ser conferido contra os pedidos |
| "Quanto cada cliente gastou?" | Os pedidos precisam ser resumidos antes de virar tabela |

Todas têm uma pergunta **escondida dentro** de outra. Antes de ver a solução, tente você primeiro.

---

## Pare e pense: acima da média

<div class="cols-2">
<div>

Dona Marta pergunta:

> *Quais pedidos ficaram acima do valor médio?*

Antes de clicar, **faça no papel**. Como você descobriria olhando o caderno dela?

Depois, clique e compare com o que você fez.
</div>
<div>



```interactive
{"type":"steps","title":"Calcular antes de comparar","states":[{"label":"Primeiro pedido","text":"Somamos o primeiro valor.","value":130,"rows":[{"label":"Ana","result":"130","match":true},{"label":"Bruno","result":"100","match":true},{"label":"Carla","result":"200","match":false}]},{"label":"Segundo pedido","text":"A soma parcial é 230.","value":230,"rows":[{"label":"Ana","result":"130","match":true},{"label":"Bruno","result":"100","match":true},{"label":"Carla","result":"200","match":false}]},{"label":"Média calculada","text":"A soma é 430; dividindo por 3, a média é 143,33.","value":143.33,"rows":[{"label":"Ana","result":"130","match":true},{"label":"Bruno","result":"100","match":true},{"label":"Carla","result":"200","match":false}]},{"label":"Pedido 1","text":"130 não supera a média.","rows":[{"label":"Pedido 1","result":"Não passa","match":false}]},{"label":"Pedido 2","text":"100 não supera a média.","rows":[{"label":"Pedido 2","result":"Não passa","match":false}]},{"label":"Pedido 3","text":"200 supera a média. A segunda pergunta dependeu da primeira.","rows":[{"label":"Pedido 3","result":"Passa","match":true}]}]}
```


</div>
</div>









---

## O que você acabou de fazer?

<div class="cols-2">
<div>

Você fez **duas perguntas, uma depois da outra**: primeiro a média, depois a comparação. A segunda só existe porque a primeira respondeu.

Como contar isso para o banco? Primeira ideia: digitar o número.

```sql
SELECT id, valor
FROM pedidos
WHERE valor > 143.33;
```

*Pare e pense:* e se chegar um pedido novo amanhã?
</div>
<div>



```interactive
{"type":"bars","title":"A média muda com um novo pedido","values":[130,100,200],"labels":["Pedido 1","Pedido 2","Pedido 3"],"references":["AVG"],"extra":{"label":"Pedido 4","value":300}}
```


</div>
</div>



---

## Dando nome ao que a gente já fazia

<div class="cols-2">
<div>

**Duas consultas, número copiado à mão**

```sql
SELECT AVG(valor) FROM pedidos;
-- resultado: 143.33

SELECT id, valor FROM pedidos
WHERE valor > 143.33;
```
</div>
<div>

**Uma só: a pergunta entra na pergunta**

```sql
SELECT id, valor
FROM pedidos
WHERE valor > (
  SELECT AVG(valor) FROM pedidos
);
```
</div>
</div>

Pôr uma consulta **dentro** de outra tem nome: **subconsulta**. Você já fazia isso no papel, só faltava a palavra. E agora a média está sempre atualizada.

---

## A de fora e a de dentro

<div class="cols-2">
<div>

- **Consulta externa:** faz a pergunta final.
- **Subconsulta (interna):** ajuda a externa e vive entre parênteses.

**Dica: leia de dentro para fora.** Vale para a subconsulta comum; a correlacionada depende da linha de fora, e veremos isso adiante.

1. Ache os parênteses.
2. Entenda o que está dentro.
3. Só então leia a consulta de fora.

</div>
<div>

*Pare e pense:* em `valor < (SELECT MAX(valor) FROM pedidos)`, qual parte roda primeiro?


```interactive
{"type":"steps","title":"Execução de dentro para fora","states":[{"label":"Consulta interna","text":"Primeiro, resolvemos a média.","code":"SELECT id FROM pedidos\nWHERE valor > (SELECT AVG(valor) FROM pedidos);","focus":"SELECT AVG(valor) FROM pedidos"},{"label":"Substituição","text":"O resultado da subconsulta ocupa o seu lugar.","code":"SELECT id FROM pedidos\nWHERE valor > 143.33;","focus":"143.33"},{"label":"Consulta externa","text":"A comparação seleciona apenas o pedido 3.","code":"SELECT id FROM pedidos WHERE valor > 143.33;","rows":[{"label":"Pedido 3","result":"200 > 143,33","match":true}]}]}
```


</div>
</div>



---

## Veja nos nossos dados

<div class="cols-2">
<div>

A média é **143,33**. Olhe as barras e responda:

- Por que só o pedido 3 passa?
- Se a média mudasse, o que mudaria no resultado?

Como a média é calculada na hora, a consulta se ajusta sozinha.
</div>
<div>



```interactive
{"type":"bars","title":"Pedidos acima da média","values":[130,100,200],"labels":["Pedido 1","Pedido 2","Pedido 3"],"references":["AVG"],"operators":[">"]}
```


</div>
</div>



---

## Subconsulta escalar: a resposta é um valor só

<div class="cols-2">
<div>

> Antes de fechar um orçamento em dólar, você consulta a cotação do dia: **um número**. Só depois faz a conta.

A **subconsulta escalar** faz o mesmo: devolve uma linha e uma coluna, e esse valor entra na consulta de fora. Se devolver várias linhas, o banco recusa.
</div>
<div>

| Subconsulta | Devolve | Escalar? |
| --- | --- | --- |
| `SELECT AVG(valor) FROM pedidos` | 1 linha, 1 coluna | **Sim** |
| `SELECT MAX(valor) FROM pedidos` | 1 linha, 1 coluna | **Sim** |
| `SELECT valor FROM pedidos` | 3 linhas, 1 coluna | Não |
| `SELECT id, valor FROM pedidos WHERE id = 3` | 1 linha, 2 colunas | Não |
</div>
</div>

---

## Como resumir várias linhas em um valor?

Funções de resumo transformam muitas linhas em **um número**. Clique e veja qual barra cada uma escolhe.



```interactive
{"type":"bars","title":"Funções de resumo","mode":"aggregate","values":[130,100,200],"labels":["Pedido 1","Pedido 2","Pedido 3"],"references":["AVG","MAX","MIN","SUM","COUNT"]}
```





---

## Laboratório: mude a pergunta e observe

<div class="cols-2">
<div>

```sql
SELECT id, valor
FROM pedidos
WHERE valor > (SELECT AVG(valor) FROM pedidos);
```

- A ideia é a mesma; só a **referência** e o **operador** mudam.
- Escalar combina com qualquer comparação: `=`, `>`, `>=`, `<`, `<=`.
- Com `WHERE id = 1` só uma linha volta, porque `id` não se repete.
</div>
<div>



```interactive
{"type":"bars","title":"Mude a referência e o operador","values":[130,100,200],"labels":["Pedido 1","Pedido 2","Pedido 3"],"references":["AVG","MAX",130],"operators":[">",">=","<","<=","="]}
```


</div>
</div>



---

## E quando a resposta vem demais?

<div class="cols-2">
<div>

Imagine perguntar "o pedido é igual a quanto?" e ouvir "130, 100 e 200". Qual escolher?

```sql
SELECT id, valor
FROM pedidos
WHERE valor = (SELECT valor FROM pedidos);
```

O banco também não sabe, e recusa: "mais de uma linha devolvida pela subconsulta".
</div>
<div>

**Duas saídas**

- **Resumir** em um valor só: `MAX`, `MIN`, `AVG`.
- **Filtrar** até sobrar uma linha, como `WHERE id = 1`.

Quer mesmo comparar com várias linhas? Aí a pergunta muda, e é o assunto da próxima parte.
</div>
</div>

---

## Sua vez: o menor pedido

Escreva uma consulta que mostre o pedido de **menor** valor, usando uma subconsulta escalar.

> Dica: qual função devolve o *menor valor*?

<details class="gab">
<summary> Ver gabarito</summary>

```sql
SELECT id, valor
FROM pedidos
WHERE valor = (SELECT MIN(valor) FROM pedidos);
```

A subconsulta devolve **100**. Resultado: o pedido 2. Seu caminho foi diferente? Vale conversar sobre ele.

</details>

---

## Agora a resposta é uma lista: IN e NOT IN

<div class="cols-2">
<div>

*Pare e pense:* Dona Marta quer saber quais clientes já tiveram algum pedido pago. A resposta cabe em um número só?

Não: são **vários** ids. É como a lista de convidados de uma festa, que o porteiro confere nome por nome.

- A subconsulta **monta a lista**.
- O `IN` **confere** quem está nela.
</div>
<div>

| | Escalar | Lista |
| --- | --- | --- |
| Devolve | 1 valor | 1 coluna, várias linhas |
| Operador | `=`, `>`, `<`... | `IN`, `NOT IN` |
| Pergunta | "É maior que?" | "Está na lista?" |
</div>
</div>

---

## Da lista digitada à lista montada

<div class="cols-2">
<div>

**Lista digitada à mão**

```sql
SELECT nome FROM clientes
WHERE id IN (1, 2);
```

`id IN (1, 2)` quer dizer: o id é 1 **ou** 2. Resultado: Ana e Bruno. Se entrar um pedido novo, a lista fica velha.
</div>
<div>

**Lista montada pela subconsulta**

```sql
SELECT id_cliente FROM pedidos
WHERE status = 'PAGO';
```

| id_cliente |
| --- |
| 1 |
| 1 |
| 2 |

O id 1 aparece duas vezes: a Ana tem dois pedidos pagos.
</div>
</div>

---

## IN: o porteiro confere a lista

<div class="cols-2">
<div>

```sql
SELECT nome
FROM clientes
WHERE id IN (
  SELECT id_cliente FROM pedidos
  WHERE status = 'PAGO'
);
```

| nome |
| --- |
| Ana |
| Bruno |

*Pare e pense:* o id 1 está duas vezes na lista. A Ana aparece duas vezes? Observe: cada cliente é avaliado **uma vez**.
</div>
<div>



```interactive
{"type":"scan","title":"IN confere a lista","chips":[1,1,2],"rows":[{"label":"Ana","result":"Está na lista","match":true,"key":"1"},{"label":"Bruno","result":"Está na lista","match":true,"key":"2"},{"label":"Carla","result":"Não está na lista","match":false,"key":"3"}]}
```


</div>
</div>



---

## NOT IN: quem ficou de fora da lista

<div class="cols-2">
<div>

```sql
SELECT nome
FROM clientes
WHERE id NOT IN (
  SELECT id_cliente FROM pedidos
);
```

É a pergunta inversa: quem **não** está na lista? Resultado: **Carla**, a cliente sem pedidos.
</div>
<div>



```interactive
{"type":"scan","title":"NOT IN inverte a seleção","chips":[1,1,2],"rows":[{"label":"Ana","result":"Está na lista: fora","match":false,"key":"1"},{"label":"Bruno","result":"Está na lista: fora","match":false,"key":"2"},{"label":"Carla","result":"Fora da lista: entra","match":true,"key":"3"}]}
```


</div>
</div>



---

## Cuidado: o nome borrado na lista

<div class="cols-2">
<div>

*Pare e pense:* na lista de convidados há um nome borrado, ilegível. O visitante se chama Carla. O porteiro pode dizer "você não está na lista"?

Não pode: o nome borrado **pode ser** o dela. No banco, esse "desconhecido" é o `NULL`. Entrou um pedido antigo, sem `id_cliente`:

```sql
SELECT nome FROM clientes
WHERE id NOT IN (
  SELECT id_cliente FROM pedidos
);
```
</div>
<div>



```interactive
{"type":"compare","title":"NULL torna a comparação desconhecida","states":[{"label":"Lista sem NULL","text":"3 é diferente de 1 e de 2; Carla entra.","chips":[1,1,2],"rows":[{"label":"Carla","result":"Entra","match":true}]},{"label":"Lista com NULL","text":"3 <> NULL é desconhecido. O WHERE só aceita verdadeiro.","chips":[1,1,2,null],"rows":[{"label":"Carla","result":"Desconhecido: fora","match":false}]}]}
```


</div>
</div>



---

## Como corrigir o NOT IN

Tire o `NULL` da lista, dentro da subconsulta:

```sql
SELECT nome FROM clientes
WHERE id NOT IN (
    SELECT id_cliente
    FROM pedidos
    WHERE id_cliente IS NOT NULL
);
```

A lista volta a ser `1, 1, 2` e a Carla reaparece. `IS NOT NULL` quer dizer "tem valor preenchido". Mais adiante veremos outra saída, ainda mais segura: `NOT EXISTS`.

---

## Teste rápido: quem não pediu coisa grande

Escreva uma consulta que mostre os clientes que **não** fizeram nenhum pedido de valor acima de 150.

> Dica: use `NOT IN` com uma subconsulta que liste os clientes com pedido acima de 150.

<details class="gab">
<summary> Ver gabarito</summary>

```sql
SELECT nome
FROM clientes
WHERE id NOT IN (SELECT id_cliente FROM pedidos WHERE valor > 150);
```

A subconsulta devolve só o id **2**. Resultado: **Ana** e **Carla**.

</details>

---

## Subconsulta correlacionada e EXISTS

<div class="cols-2">
<div>

*Pare e pense:* o vigia precisa ler a lista de pedidos inteira antes de começar?

Não. Ele pergunta a cada cliente, um de cada vez: `você tem algum pedido pago?`. A resposta **depende de quem está na frente dele**.
</div>
<div>

| Pergunta | Operador |
| --- | --- |
| "Quais ids estão **nesta lista**?" | `IN` |
| "**Existe algum** pedido pago para este cliente?" | `EXISTS` |

No `EXISTS`, a pergunta é de **sim ou não**.
</div>
</div>

---

## Basta um: o EXISTS para no primeiro achado

<div class="cols-2">
<div>

*Pare e pense:* para saber **se** a Ana já comprou alguma coisa, precisamos contar todos os pedidos dela?

Basta encontrar **um**. O `EXISTS` faz exatamente isso: achou uma linha, responde "sim" e para. Compare com o `COUNT`, que olha todas.
</div>
<div>



```interactive
{"type":"scan","title":"Encontrar um ou contar todos","rows":[{"label":"Pedido 1","result":"PAGO: encontrado","match":true},{"label":"Pedido 2","result":"PAGO: encontrado","match":true}],"variants":[{"label":"EXISTS","stopAtMatch":true},{"label":"COUNT","stopAtMatch":false}]}
```


</div>
</div>



---

## EXISTS: o vigia em SQL

<div class="cols-2">
<div>

```sql
SELECT cli.nome
FROM clientes cli
WHERE EXISTS (
  SELECT 1
  FROM pedidos ped
  WHERE ped.id_cliente = cli.id
    AND ped.status = 'PAGO'
);
```

Devolve **Ana** e **Bruno**; a Ana aparece uma vez, mesmo com dois pedidos pagos.
</div>
<div>

**Apelidos**

- `cli` é apelido de `clientes`; `ped`, de `pedidos`.
- Deixam claro de onde vem cada coluna: `cli.id`, `ped.id_cliente`.

**O `SELECT 1`** é só um marcador: o `EXISTS` quer saber **se a linha apareceu**, não o que tem nela.
</div>
</div>

---

## Passo a passo: um cliente por vez

<div class="cols-2">
<div>

Conceitualmente, o banco roda a subconsulta para cada cliente. O otimizador pode reescrever a consulta, mas esse modelo mental vale. Para a Ana:

```sql
SELECT 1 FROM pedidos ped
WHERE ped.id_cliente = 1
  AND ped.status = 'PAGO'
```

Achou linha: o `EXISTS` é verdadeiro e a Ana entra. Se não achar nenhuma, o cliente fica de fora.
</div>
<div>



```interactive
{"type":"scan","title":"Conferência correlacionada","rows":[{"label":"Ana","result":"2 pedidos pagos: existe","match":true},{"label":"Bruno","result":"1 pedido pago: existe","match":true},{"label":"Carla","result":"0 pedidos: não existe","match":false}]}
```


</div>
</div>



---

## Por que ela se chama correlacionada?

<div class="cols-2">
<div>

Dentro da subconsulta aparece `cli.id`, uma coluna da consulta de fora.

- Sem ela, o porteiro não sabe quem está na porta.
- A subconsulta **depende da linha de fora**: está **correlacionada** com ela.
- Conceitualmente, ela roda uma vez por linha de fora. O otimizador pode reescrevê-la, então o número real de execuções pode ser menor.

*Pare e pense:* então ela roda quantas vezes? Compare com a escalar.
</div>
<div>



```interactive
{"type":"steps","title":"Modelo conceitual de execução","states":[{"label":"Escalar","text":"Um resultado pode ser reutilizado por todos. O otimizador pode reescrever a execução.","value":1,"rows":[{"label":"Ana","result":"Usa 143,33","match":true},{"label":"Bruno","result":"Usa 143,33","match":true},{"label":"Carla","result":"Usa 143,33","match":true}]},{"label":"Correlacionada: Ana","text":"A pergunta depende da linha externa.","value":1,"rows":[{"label":"Ana","result":"Conferida","match":true}]},{"label":"Correlacionada: Bruno","text":"Agora usamos o id do Bruno.","value":2,"rows":[{"label":"Bruno","result":"Conferido","match":true}]},{"label":"Correlacionada: Carla","text":"Conceitualmente, uma conferência por cliente; não é uma promessa sobre o plano físico.","value":3,"rows":[{"label":"Carla","result":"Conferida","match":false}]}]}
```


</div>
</div>



---

## IN ou EXISTS: o mesmo problema, dois caminhos

*Quais clientes fizeram algum pedido acima de 150?*

<div class="cols-2">
<div>

**Com IN**

```sql
SELECT nome
FROM clientes
WHERE id IN (
  SELECT id_cliente FROM pedidos
  WHERE valor > 150
);
```
</div>
<div>

**Com EXISTS**

```sql
SELECT cli.nome
FROM clientes cli
WHERE EXISTS (
  SELECT 1 FROM pedidos ped
  WHERE ped.id_cliente = cli.id
    AND ped.valor > 150
);
```
</div>
</div>

Os dois devolvem **Bruno**. `IN` lê melhor quando a ideia é "está nesta lista?"; `EXISTS`, quando é "existe algum?" ou quando a conferência depende da linha de fora. Regras práticas: use `IN` para uma lista pequena e fixa de valores; use `EXISTS` quando a condição depende da linha de fora; prefira `NOT EXISTS` a `NOT IN` quando a subconsulta puder devolver NULL.

---

## NOT EXISTS: quem não tem par

<div class="cols-2">
<div>

```sql
SELECT cli.nome
FROM clientes cli
WHERE NOT EXISTS (
  SELECT 1
  FROM pedidos ped
  WHERE ped.id_cliente = cli.id
);
```
</div>
<div>

Devolve **Carla**, a única sem pedido.

*Pare e pense:* e o pedido sem cliente (NULL)? A comparação é linha a linha: ele nunca bate com `cli.id`, simplesmente não conta, e a Carla continua aparecendo.

Por isso `NOT EXISTS` é mais seguro que `NOT IN`.
</div>
</div>

---

## Teste rápido: pedidos pequenos

Escreva uma consulta com `EXISTS` que mostre os clientes que têm algum pedido de valor **menor que 110**.

> Dica: copie a consulta do `EXISTS` e troque a condição.

<details class="gab">
<summary> Ver gabarito</summary>

```sql
SELECT cli.nome
FROM clientes cli
WHERE EXISTS (
    SELECT 1
    FROM pedidos ped
    WHERE ped.id_cliente = cli.id
      AND ped.valor < 110
);
```

Resultado: **Ana**, por causa do pedido 2, de valor 100.

</details>

---

## E se a resposta for uma tabela inteira?

<div class="cols-2">
<div>

Dona Marta agora quer um **relatório**: quanto cada cliente gastou. Isso não é um valor nem uma lista: são linhas **e** colunas.

A mesma lanchonete tem um caixa que separa as notas em montinhos, conta cada um e só então cola o total. No SQL, a ordem entre **resumir** e **juntar** muda o resultado.

Experimente os três formatos ao lado.
</div>
<div>



```interactive
{"type":"compare","title":"Formato do resultado","states":[{"label":"Um valor","text":"Uma linha e uma coluna: escalar.","table":{"headers":["média"],"rows":[[143.33]]}},{"label":"Uma lista","text":"Uma coluna com várias linhas.","table":{"headers":["id_cliente"],"rows":[[1],[1],[2]]}},{"label":"Uma tabela","text":"Linhas e colunas: cabe no FROM com apelido.","table":{"headers":["id_cliente","total_gasto"],"rows":[[1,230],[2,200]]}}]}
```


</div>
</div>



---

## O caixa separa em montinhos

<div class="cols-2">
<div>

Primeiro o resumo, sozinho:

```sql
SELECT id_cliente,
       SUM(valor) AS total_gasto
FROM pedidos
GROUP BY id_cliente;
```

`GROUP BY` forma um montinho por cliente, e o `SUM` soma cada um. Resultado: uma linha por cliente, com o total.
</div>
<div>



```interactive
{"type":"group","title":"Separar pedidos por cliente","items":[{"label":"Pedido 1","group":"Ana","value":130},{"label":"Pedido 2","group":"Ana","value":100},{"label":"Pedido 3","group":"Bruno","value":200}]}
```


</div>
</div>



---

## O resumo vira uma tabela derivada

<div class="cols-2">
<div>

Esse resultado tem linhas e colunas, como qualquer tabela. Então podemos pô-lo no `FROM` e consultá-lo:

```sql
FROM (
  SELECT id_cliente, SUM(valor) AS total_gasto
  FROM pedidos
  GROUP BY id_cliente
) resumo   -- apelido obrigatório
```
</div>
<div>

Subconsulta no `FROM` tem nome: **tabela derivada**.

- Uma tabela precisa de nome para ser chamada: o **apelido** dá nome ao resumo.
- Depois usamos `resumo.total_gasto` e `resumo.id_cliente`.
- Sem apelido, a consulta é recusada na maioria dos casos.

**Por que isso resolve?** Um resumo com uma linha por cliente precisa de colunas para ser ligado a `clientes`. Uma subconsulta escalar devolveria um valor só, e não haveria como associar o total a cada nome.
</div>
</div>

---

## O problema: juntar primeiro e somar depois infla o total

Imagine que cada pedido agora tem **itens** numa tabela `itens_pedido`. O pedido 1 tem dois itens, então ele aparece duas vezes quando juntamos pedidos com itens.

Se somarmos o valor do pedido depois dessa junção, o pedido 1 entra duas vezes e o total da Ana sai inflado.

*Pare e pense:* como fazer para cada pedido contar uma vez só, mesmo que a tabela de itens tenha várias linhas para ele?

---

## Resumir antes de juntar

<div class="cols-2">
<div>

```sql
SELECT cli.nome, resumo.total_gasto
FROM clientes cli
LEFT JOIN (
  SELECT id_cliente,
         SUM(valor) AS total_gasto
  FROM pedidos
  GROUP BY id_cliente
) resumo ON cli.id = resumo.id_cliente;
```

*Pare e pense:* por que `LEFT JOIN` e não `JOIN`? Troque na animação e veja a Carla.
</div>
<div>



```interactive
{"type":"compare","title":"Manter ou excluir linhas sem par","states":[{"label":"JOIN","text":"Somente clientes com par no resumo.","rows":[{"label":"Ana","result":"230","match":true},{"label":"Bruno","result":"200","match":true},{"label":"Carla","result":"Sem par: excluída","match":false,"muted":true}]},{"label":"LEFT JOIN","text":"Todos os clientes continuam no resultado.","rows":[{"label":"Ana","result":"230","match":true},{"label":"Bruno","result":"200","match":true},{"label":"Carla","result":"NULL","match":true}]}]}
```


</div>
</div>



**Por que fazer assim?** O resumo já sai com uma linha por cliente, então a junção com `clientes` não multiplica nada. Se a tabela `itens_pedido` entrasse direto na junção, cada pedido se repetiria a cada item antes da soma.

---

## Por que a ordem importa

<div class="cols-2">
<div>

*Pare e pense:* veja o que acontece com o total da Ana nas duas ordens. O pedido 1 aparece em duas linhas quando juntamos antes de somar:

| pedido | valor |
| --- | --- |
| 1 | 130 |
| 1 | 130 |
| 2 | 100 |

Com a tabela derivada, o resumo já vem pronto: uma linha por cliente, nada se repete.
</div>
<div>



```interactive
{"type":"compare","title":"A ordem muda o total","states":[{"label":"Juntar antes de somar","text":"O pedido 1 entrou duas vezes: 130 + 130 + 100.","value":360,"chips":[130,130,100]},{"label":"Resumir antes de juntar","text":"Cada pedido entra uma vez: 130 + 100.","value":230,"chips":[130,100]}]}
```


</div>
</div>



---

## O problema: NULL não é zero

Dona Marta quer um relatório com quantos pedidos cada cliente fez.

Se a consulta usar `LEFT JOIN` e nada mais, a Carla aparece com `NULL` na coluna de quantidade. Só que `NULL` quer dizer "desconhecido", e a Carla não tem pedido nenhum: o número certo é **zero**.

Pior: qualquer conta feita com `NULL` também vira `NULL`. Se a Dona Marta somar 1 à quantidade para contar um pedido a mais, a Carla continua vazia.

*Pare e pense:* o que a Dona Marta entenderia ao ler "NULL" no lugar da Carla?

---

## Contar pedidos e trocar NULL por zero

<div class="cols-2">
<div>

```sql
SELECT cli.nome,
  COALESCE(resumo.qtd_pedidos, 0)
    AS qtd_pedidos
FROM clientes cli
LEFT JOIN (
  SELECT id_cliente, COUNT(*) AS qtd_pedidos
  FROM pedidos
  GROUP BY id_cliente
) resumo ON cli.id = resumo.id_cliente;
```

`COALESCE` devolve o primeiro valor que **não** é `NULL`.

**Por que trocar?** O relatório mostra `0` no lugar de `NULL`, e o número pode ser somado ou comparado sem surpresa.
</div>
<div>



```interactive
{"type":"compare","title":"NULL não é zero","states":[{"label":"Sem COALESCE","text":"A linha de Carla não tem par no resumo.","rows":[{"label":"Ana","result":"2","match":true},{"label":"Bruno","result":"1","match":true},{"label":"Carla","result":"NULL","match":false}]},{"label":"Com COALESCE","text":"A ausência de pedidos é apresentada como zero.","rows":[{"label":"Ana","result":"2","match":true},{"label":"Bruno","result":"1","match":true},{"label":"Carla","result":"0","match":true}]}]}
```


</div>
</div>



---

## O problema: o WHERE não enxerga a soma

Dona Marta quer só os clientes que gastaram mais de 210 no total.

A primeira tentativa costuma ser esta:

```sql
SELECT id_cliente, SUM(valor) AS total_gasto
FROM pedidos
WHERE SUM(valor) > 210
GROUP BY id_cliente;
```

O banco recusa, pelo mesmo motivo do `AVG` no começo: o `WHERE` filtra linha por linha, e o total de cada cliente só existe depois do agrupamento.

*Pare e pense:* em que parte da consulta o total já existe, pronto para ser comparado?

---

## Filtrar o resumo

<div class="cols-2">
<div>

```sql
SELECT resumo.id_cliente, resumo.total_gasto
FROM (
  SELECT id_cliente, SUM(valor) AS total_gasto
  FROM pedidos
  GROUP BY id_cliente
) resumo
WHERE resumo.total_gasto > 210;
```

**Por que aqui?** O resumo já vira uma tabela com a coluna `total_gasto`. Aí o `WHERE` de fora compara esse valor linha a linha, como faria com qualquer coluna.
</div>
<div>

| id_cliente | total_gasto |
| --- | --- |
| 1 | 230 |

A consulta de fora filtra a tabela derivada como qualquer tabela. Só a Ana gastou mais de 210 no total.
</div>
</div>

---

## Teste rápido: o que falta?

O que falta nesta consulta para ela funcionar?

```sql
SELECT cli.nome, resumo.total_gasto
FROM clientes cli
LEFT JOIN (
    SELECT id_cliente, SUM(valor) AS total_gasto
    FROM pedidos
    GROUP BY id_cliente
) ON cli.id = resumo.id_cliente;
```

<details class="gab">
<summary> Ver gabarito</summary>

Falta o **apelido** `resumo` logo depois do fecha-parênteses:

```sql
) resumo ON cli.id = resumo.id_cliente;
```

Sem o apelido, o banco não sabe o que é `resumo`.

</details>

---

## Voltando à lanchonete: lendo o mundo com SQL

Lá no começo, a gente só tinha perguntas da Dona Marta. Escolha uma e veja que tipo de subconsulta ela pede.



```interactive
{"type":"compare","title":"Da pergunta ao SQL","collapse":true,"states":[{"label":"Acima da média","text":"Subconsulta escalar.","code":"SELECT id, valor FROM pedidos\nWHERE valor > (SELECT AVG(valor) FROM pedidos);"},{"label":"Quem já pagou","text":"Lista com IN.","code":"SELECT nome FROM clientes\nWHERE id IN (SELECT id_cliente FROM pedidos WHERE status = 'PAGO');"},{"label":"Quem nunca pediu","text":"Subconsulta correlacionada com NOT EXISTS.","code":"SELECT cli.nome FROM clientes cli\nWHERE NOT EXISTS (SELECT 1 FROM pedidos ped WHERE ped.id_cliente = cli.id);"},{"label":"Quanto cada um gastou","text":"Tabela derivada no FROM.","code":"SELECT cli.nome, resumo.total_gasto\nFROM clientes cli LEFT JOIN (\n SELECT id_cliente, SUM(valor) AS total_gasto\n FROM pedidos GROUP BY id_cliente\n) resumo ON cli.id = resumo.id_cliente;"}]}
```





---

## Síntese: o que construímos juntos

| Conceito | Em uma frase |
| :--- | :--- |
| **Subconsulta** | Uma consulta entre parênteses dentro de outra, que usa o resultado dela. |
| **Ordem de execução** | A de dentro roda primeiro; só depois a de fora continua. |
| **Subconsulta escalar** | Devolve um valor só e se compara com =, >, <, >= e <=. |
| **IN e NOT IN** | Conferem uma coluna contra uma lista devolvida pela subconsulta. |
| **NULL no NOT IN** | Um desconhecido na lista faz o NOT IN não devolver nenhuma linha. |
| **EXISTS** | Verdadeiro quando a subconsulta acha pelo menos uma linha. |
| **Correlacionada** | Usa uma coluna da consulta de fora; conceitualmente roda uma vez por linha dela. |
| **Tabela derivada** | Subconsulta no FROM: precisa de apelido e resume antes de juntar. |

---

## Mão na massa

Com as tabelas `clientes` e `pedidos` da lanchonete, escreva as consultas:

1. Os pedidos com valor **abaixo ou igual** à média.
2. Os clientes que têm pedido **pago**, usando `IN`.
3. Os clientes **sem nenhum pedido**, usando `NOT EXISTS`.
4. O **total gasto** por cliente, usando tabela derivada.

Tente sozinho antes de abrir os gabaritos. Só um fica aberto por vez.

<details class="gab" name="gab">
<summary> Ver Gabarito 1: pedidos abaixo ou igual à média</summary>

```sql
SELECT id, valor FROM pedidos
WHERE valor <= (SELECT AVG(valor) FROM pedidos);
```

Resultado: pedidos 1 e 2.

</details>

<details class="gab" name="gab">
<summary> Ver Gabarito 2: clientes com pedido pago, usando IN</summary>

```sql
SELECT nome FROM clientes
WHERE id IN (SELECT id_cliente FROM pedidos WHERE status = 'PAGO');
```

Resultado: Ana e Bruno.

</details>

<details class="gab" name="gab">
<summary> Ver Gabarito 3: clientes sem pedido, usando NOT EXISTS</summary>

```sql
SELECT cli.nome FROM clientes cli
WHERE NOT EXISTS (
    SELECT 1 FROM pedidos ped WHERE ped.id_cliente = cli.id
);
```

Resultado: Carla.

</details>

<details class="gab" name="gab">
<summary> Ver Gabarito 4: total gasto por cliente, com tabela derivada</summary>

```sql
SELECT cli.nome, resumo.total_gasto
FROM clientes cli
LEFT JOIN (
    SELECT id_cliente, SUM(valor) AS total_gasto
    FROM pedidos GROUP BY id_cliente
) resumo ON cli.id = resumo.id_cliente;
```

</details>

---

## Saída: três perguntas

1. O que `NOT IN` devolve se a subconsulta trouxer um NULL?
2. Quando o `EXISTS` é preferível ao `IN`?
3. Por que resumir antes de juntar?

<details class="gab">
<summary> Ver Gabarito</summary>

1. Nenhuma linha. O NULL pode ser qualquer valor, então o banco não consegue afirmar que a linha está fora da lista.
2. Quando a condição depende da linha de fora, como `ped.id_cliente = cli.id`.
3. Juntar antes de somar repete linhas e infla o total. Resumir antes garante uma linha por grupo.

</details>

---

## Para continuar a conversa

1. Em que momentos do seu dia a dia você faz uma pergunta que só dá para responder depois de outra?
2. Com suas palavras: o que é uma subconsulta e por que ela fica entre parênteses?
3. Por que `valor > (SELECT valor FROM pedidos)` deixa o banco confuso?
4. IN ou EXISTS: qual parece mais natural para você explicar, e por quê?
5. Por que o NULL faz o NOT IN "mentir"? Que saída é mais segura?
6. Como resumir antes de juntar evita contar um pedido duas vezes?

---

## Material Complementar

- **PostgreSQL — Subquery Expressions** — Documentação oficial sobre EXISTS, IN e comparações com subconsultas. https://www.postgresql.org/docs/current/functions-subquery.html
- **MySQL 8.0 — Subqueries** — Explica os tipos de subconsulta e as regras de uso em cada cláusula. https://dev.mysql.com/doc/refman/8.0/en/subqueries.html
- **W3Schools — SQL Subqueries** — Exemplos curtos e executáveis de subconsultas no WHERE e no FROM. https://www.w3schools.com/sql/sql_subqueries.asp
- **Modern SQL** — Site de referência sobre SQL padrão e diferenças entre os bancos. https://modern-sql.com/