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
{"type":"scene","title":"Pare e pense: acima da média","align":"center","initial":"f0","layout":["rows","value","buttons","text"],"frames":[{"id":"f0","buttons":[{"label":"Iniciar: calcular a média","to":"f1","row":0}],"text":"Faça no papel e depois clique.","value":"?","rows":[{"label":"Pedido 1 (Ana)","result":"130"},{"label":"Pedido 2 (Ana)","result":"100"},{"label":"Pedido 3 (Bruno)","result":"200"}]},{"id":"f1","buttons":[{"label":"Iniciar: calcular a média","to":"f1","row":0,"disabled":true}],"text":"Faça no papel e depois clique.","value":"?","rows":[{"label":"Pedido 1 (Ana)","result":"130"},{"label":"Pedido 2 (Ana)","result":"100"},{"label":"Pedido 3 (Bruno)","result":"200"}],"next":{"to":"f2","delay":0}},{"id":"f2","buttons":[{"label":"Iniciar: calcular a média","to":"f1","row":0,"disabled":true}],"text":"Faça no papel e depois clique.","value":"soma: 130","rows":[{"label":"Pedido 1 (Ana)","result":"130","active":true},{"label":"Pedido 2 (Ana)","result":"100"},{"label":"Pedido 3 (Bruno)","result":"200"}],"next":{"to":"f3","delay":651.1111111111111}},{"id":"f3","buttons":[{"label":"Iniciar: calcular a média","to":"f1","row":0,"disabled":true}],"text":"Faça no papel e depois clique.","value":"soma: 230","rows":[{"label":"Pedido 1 (Ana)","result":"130"},{"label":"Pedido 2 (Ana)","result":"100","active":true},{"label":"Pedido 3 (Bruno)","result":"200"}],"next":{"to":"f4","delay":648.8888888888889}},{"id":"f4","buttons":[{"label":"Iniciar: calcular a média","to":"f1","row":0,"disabled":true}],"text":"Faça no papel e depois clique.","value":"soma: 430","rows":[{"label":"Pedido 1 (Ana)","result":"130"},{"label":"Pedido 2 (Ana)","result":"100"},{"label":"Pedido 3 (Bruno)","result":"200","active":true}],"next":{"to":"f5","delay":871.1111111111111}},{"id":"f5","buttons":[{"label":"Iniciar comparação","to":"f6","row":0}],"text":"Primeira pergunta respondida.","value":"média: 143,33","rows":[{"label":"Pedido 1 (Ana)","result":"130"},{"label":"Pedido 2 (Ana)","result":"100"},{"label":"Pedido 3 (Bruno)","result":"200"}]},{"id":"f6","buttons":[{"label":"Iniciar comparação","to":"f6","row":0,"disabled":true}],"text":"Primeira pergunta respondida.","value":"média: 143,33","rows":[{"label":"Pedido 1 (Ana)","result":"130"},{"label":"Pedido 2 (Ana)","result":"100"},{"label":"Pedido 3 (Bruno)","result":"200"}],"next":{"to":"f7","delay":0}},{"id":"f7","buttons":[{"label":"Iniciar comparação","to":"f6","row":0,"disabled":true}],"text":"Primeira pergunta respondida.","value":"média: 143,33","rows":[{"label":"Pedido 1 (Ana)","result":"130: não passa","active":true,"tone":"danger"},{"label":"Pedido 2 (Ana)","result":"100"},{"label":"Pedido 3 (Bruno)","result":"200"}],"next":{"to":"f8","delay":800}},{"id":"f8","buttons":[{"label":"Iniciar comparação","to":"f6","row":0,"disabled":true}],"text":"Primeira pergunta respondida.","value":"média: 143,33","rows":[{"label":"Pedido 1 (Ana)","result":"130: não passa","tone":"danger"},{"label":"Pedido 2 (Ana)","result":"100: não passa","active":true,"tone":"danger"},{"label":"Pedido 3 (Bruno)","result":"200"}],"next":{"to":"f9","delay":800}},{"id":"f9","buttons":[{"label":"Iniciar comparação","to":"f6","row":0,"disabled":true}],"text":"Primeira pergunta respondida.","value":"média: 143,33","rows":[{"label":"Pedido 1 (Ana)","result":"130: não passa","tone":"danger"},{"label":"Pedido 2 (Ana)","result":"100: não passa","tone":"danger"},{"label":"Pedido 3 (Bruno)","result":"200: passa da média","active":true,"tone":"success"}],"next":{"to":"f10","delay":1020}},{"id":"f10","buttons":[{"label":"Reiniciar","to":"f0","row":0}],"text":"Conclusão: A segunda pergunta só fez sentido depois da primeira.","value":"média: 143,33","rows":[{"label":"Pedido 1 (Ana)","result":"130: não passa","tone":"danger"},{"label":"Pedido 2 (Ana)","result":"100: não passa","tone":"danger"},{"label":"Pedido 3 (Bruno)","result":"200: passa da média","tone":"success"}]}]}
```


</div>
</div>





```interactive
{"type":"reference","title":"Consulte os dados sem sair do código","scope":"deck","code":"SELECT clientes.nome, pedidos.valor\nFROM clientes JOIN pedidos ON clientes.id = pedidos.id_cliente;","tables":[{"term":"clientes","headers":["id","nome"],"rows":[[1,"Ana"],[2,"Bruno"],[3,"Carla"]]},{"term":"pedidos","headers":["id","id_cliente","valor","status"],"rows":[[1,1,130,"PAGO"],[2,1,100,"PAGO"],[3,2,200,"PAGO"]]}],"annotationOnly":true}
```







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
{"type":"scene","title":"O que você acabou de fazer?","align":"left","initial":"f0","layout":["chart","value","buttons","text"],"frames":[{"id":"f0","buttons":[{"label":"+ chegou um pedido novo (300)","to":"f1","row":0}],"text":"Clique no botão para simular a chegada de um pedido.","value":"143,33","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[false,false,false],"lines":[{"label":"143,33 (digitado)","value":143.333273,"previous":true},{"label":"AVG ao vivo","value":143.333273}]}},{"id":"f1","buttons":[{"label":"Reiniciar","to":"f0","row":0}],"text":"A média real agora é 182,50, mas a consulta digitada ainda usa 143.33.","textRuns":[{"text":"A média real agora é "},{"text":"182,50","strong":true,"tone":"success"},{"text":", mas a consulta digitada ainda usa "},{"text":"143.33","strong":true,"tone":"danger"},{"text":"."}],"value":"182,50","chart":{"maximum":305.45454545454544,"values":[130,100,200,300],"matches":[false,false,false,false],"lines":[{"label":"143,33 (digitado)","value":143.333273,"previous":true},{"label":"AVG ao vivo 182,50","value":182.5}]}}]}
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
{"type":"scene","title":"A de fora e a de dentro","align":"left","initial":"f0","layout":["code","buttons","text"],"frames":[{"id":"f0","buttons":[{"label":"Iniciar execução","to":"f1","row":0}],"text":"Clique para ver em que ordem o banco executa.","code":"SELECT id, valor FROM pedidos\nWHERE valor > ( SELECT AVG(valor) FROM pedidos );"},{"id":"f1","buttons":[{"label":"Reiniciar","to":"f0","row":0}],"text":"Clique para ver em que ordem o banco executa.","code":"SELECT id, valor FROM pedidos\nWHERE valor > ( SELECT AVG(valor) FROM pedidos );","next":{"to":"f2","delay":180}},{"id":"f2","buttons":[{"label":"Reiniciar","to":"f0","row":0}],"text":"1. O banco resolve primeiro o que está dentro dos parênteses.","code":"SELECT id, valor FROM pedidos\nWHERE valor > ( SELECT AVG(valor) FROM pedidos );","focus":"SELECT AVG(valor) FROM pedidos","next":{"to":"f3","delay":1471.111111111111}},{"id":"f3","buttons":[{"label":"Reiniciar","to":"f0","row":0}],"text":"2. O resultado ocupa o lugar da subconsulta.","code":"SELECT id, valor FROM pedidos\nWHERE valor > ( 143.33 );","focus":"143.33","next":{"to":"f4","delay":1548.888888888889}},{"id":"f4","buttons":[{"label":"Reiniciar","to":"f0","row":0}],"text":"3. Agora a consulta de fora roda: só o pedido 3 passa.","code":"SELECT id, valor FROM pedidos\nWHERE valor > ( 143.33 );","focus":"143.33"}]}
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
{"type":"scene","title":"Veja nos nossos dados","align":"center","initial":"f0","layout":["chart","buttons","text"],"frames":[{"id":"f0","buttons":[{"label":"Iniciar comparação","to":"f1","row":0}],"text":"","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[false,false,false],"lines":[{"label":"AVG 143,33","value":143.333273}]}},{"id":"f1","buttons":[{"label":"Repetir comparação","to":"f1","row":0}],"text":"Pedidos que passam: 3","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[false,false,true],"lines":[{"label":"AVG 143,33","value":143.333273}]}}]}
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
{"type":"scene","title":"Como resumir várias linhas em um valor?","align":"center","initial":"f0","layout":["chart","buttons","value","text"],"frames":[{"id":"f0","buttons":[{"label":"AVG","to":"f1","row":0,"selected":false},{"label":"MAX","to":"f2","row":0,"selected":false},{"label":"MIN","to":"f3","row":0,"selected":false},{"label":"SUM","to":"f4","row":0,"selected":false},{"label":"COUNT","to":"f5","row":0,"selected":false}],"text":"Clique em uma função para ver qual barra ela escolhe.","value":"?","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[false,false,false],"lines":[]}},{"id":"f1","buttons":[{"label":"AVG","to":"f1","row":0,"selected":true},{"label":"MAX","to":"f2","row":0,"selected":false},{"label":"MIN","to":"f3","row":0,"selected":false},{"label":"SUM","to":"f4","row":0,"selected":false},{"label":"COUNT","to":"f5","row":0,"selected":false}],"text":"AVG: a média de todos os valores","value":"143,33","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[true,true,true],"lines":[]}},{"id":"f2","buttons":[{"label":"AVG","to":"f1","row":0,"selected":false},{"label":"MAX","to":"f2","row":0,"selected":true},{"label":"MIN","to":"f3","row":0,"selected":false},{"label":"SUM","to":"f4","row":0,"selected":false},{"label":"COUNT","to":"f5","row":0,"selected":false}],"text":"MAX: o maior valor","value":"200","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[false,false,true],"lines":[]}},{"id":"f3","buttons":[{"label":"AVG","to":"f1","row":0,"selected":false},{"label":"MAX","to":"f2","row":0,"selected":false},{"label":"MIN","to":"f3","row":0,"selected":true},{"label":"SUM","to":"f4","row":0,"selected":false},{"label":"COUNT","to":"f5","row":0,"selected":false}],"text":"MIN: o menor valor","value":"100","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[false,true,false],"lines":[]}},{"id":"f4","buttons":[{"label":"AVG","to":"f1","row":0,"selected":false},{"label":"MAX","to":"f2","row":0,"selected":false},{"label":"MIN","to":"f3","row":0,"selected":false},{"label":"SUM","to":"f4","row":0,"selected":true},{"label":"COUNT","to":"f5","row":0,"selected":false}],"text":"SUM: a soma de todos os valores","value":"430","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[true,true,true],"lines":[]}},{"id":"f5","buttons":[{"label":"AVG","to":"f1","row":0,"selected":false},{"label":"MAX","to":"f2","row":0,"selected":false},{"label":"MIN","to":"f3","row":0,"selected":false},{"label":"SUM","to":"f4","row":0,"selected":false},{"label":"COUNT","to":"f5","row":0,"selected":true}],"text":"COUNT: quantas linhas existem","value":"3","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[true,true,true],"lines":[]}}]}
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
{"type":"scene","title":"Laboratório: mude a pergunta e observe","align":"center","initial":"f0","layout":["chart","buttons","code","text"],"frames":[{"id":"f0","buttons":[{"label":"AVG","to":"f1","row":0,"selected":true},{"label":"MAX","to":"f7","row":0,"selected":false},{"label":"pedido 1","to":"f12","row":0,"selected":false},{"label":">","to":"f1","row":1,"selected":true},{"label":">=","to":"f2","row":1,"selected":false},{"label":"<","to":"f3","row":1,"selected":false},{"label":"<=","to":"f4","row":1,"selected":false},{"label":"=","to":"f5","row":1,"selected":false}],"text":"Escolha a referência ou o operador para ver a comparação.","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[false,false,false],"lines":[{"label":"AVG 143,33","value":143.333273}]},"code":"WHERE valor > (SELECT AVG(valor) FROM pedidos)"},{"id":"f1","buttons":[{"label":"AVG","to":"f1","row":0,"selected":true},{"label":"MAX","to":"f7","row":0,"selected":false},{"label":"pedido 1","to":"f12","row":0,"selected":false},{"label":">","to":"f1","row":1,"selected":true},{"label":">=","to":"f2","row":1,"selected":false},{"label":"<","to":"f3","row":1,"selected":false},{"label":"<=","to":"f4","row":1,"selected":false},{"label":"=","to":"f5","row":1,"selected":false}],"text":"Pedidos que passam: 3","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[false,false,true],"lines":[{"label":"AVG 143,33","value":143.333273}]},"code":"WHERE valor > (SELECT AVG(valor) FROM pedidos)"},{"id":"f2","buttons":[{"label":"AVG","to":"f2","row":0,"selected":true},{"label":"MAX","to":"f8","row":0,"selected":false},{"label":"pedido 1","to":"f13","row":0,"selected":false},{"label":">","to":"f1","row":1,"selected":false},{"label":">=","to":"f2","row":1,"selected":true},{"label":"<","to":"f3","row":1,"selected":false},{"label":"<=","to":"f4","row":1,"selected":false},{"label":"=","to":"f5","row":1,"selected":false}],"text":"Pedidos que passam: 3","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[false,false,true],"lines":[{"label":"AVG 143,33","value":143.333273}]},"code":"WHERE valor >= (SELECT AVG(valor) FROM pedidos)"},{"id":"f3","buttons":[{"label":"AVG","to":"f3","row":0,"selected":true},{"label":"MAX","to":"f9","row":0,"selected":false},{"label":"pedido 1","to":"f14","row":0,"selected":false},{"label":">","to":"f1","row":1,"selected":false},{"label":">=","to":"f2","row":1,"selected":false},{"label":"<","to":"f3","row":1,"selected":true},{"label":"<=","to":"f4","row":1,"selected":false},{"label":"=","to":"f5","row":1,"selected":false}],"text":"Pedidos que passam: 1, 2","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[true,true,false],"lines":[{"label":"AVG 143,33","value":143.333273}]},"code":"WHERE valor < (SELECT AVG(valor) FROM pedidos)"},{"id":"f4","buttons":[{"label":"AVG","to":"f4","row":0,"selected":true},{"label":"MAX","to":"f10","row":0,"selected":false},{"label":"pedido 1","to":"f15","row":0,"selected":false},{"label":">","to":"f1","row":1,"selected":false},{"label":">=","to":"f2","row":1,"selected":false},{"label":"<","to":"f3","row":1,"selected":false},{"label":"<=","to":"f4","row":1,"selected":true},{"label":"=","to":"f5","row":1,"selected":false}],"text":"Pedidos que passam: 1, 2","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[true,true,false],"lines":[{"label":"AVG 143,33","value":143.333273}]},"code":"WHERE valor <= (SELECT AVG(valor) FROM pedidos)"},{"id":"f5","buttons":[{"label":"AVG","to":"f5","row":0,"selected":true},{"label":"MAX","to":"f6","row":0,"selected":false},{"label":"pedido 1","to":"f11","row":0,"selected":false},{"label":">","to":"f1","row":1,"selected":false},{"label":">=","to":"f2","row":1,"selected":false},{"label":"<","to":"f3","row":1,"selected":false},{"label":"<=","to":"f4","row":1,"selected":false},{"label":"=","to":"f5","row":1,"selected":true}],"text":"Pedidos que passam: nenhum","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[false,false,false],"lines":[{"label":"AVG 143,33","value":143.333273}]},"code":"WHERE valor = (SELECT AVG(valor) FROM pedidos)"},{"id":"f6","buttons":[{"label":"AVG","to":"f5","row":0,"selected":false},{"label":"MAX","to":"f6","row":0,"selected":true},{"label":"pedido 1","to":"f11","row":0,"selected":false},{"label":">","to":"f7","row":1,"selected":false},{"label":">=","to":"f8","row":1,"selected":false},{"label":"<","to":"f9","row":1,"selected":false},{"label":"<=","to":"f10","row":1,"selected":false},{"label":"=","to":"f6","row":1,"selected":true}],"text":"Pedidos que passam: 3","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[false,false,true],"lines":[{"label":"MAX 200","value":200}]},"code":"WHERE valor = (SELECT MAX(valor) FROM pedidos)"},{"id":"f7","buttons":[{"label":"AVG","to":"f1","row":0,"selected":false},{"label":"MAX","to":"f7","row":0,"selected":true},{"label":"pedido 1","to":"f12","row":0,"selected":false},{"label":">","to":"f7","row":1,"selected":true},{"label":">=","to":"f8","row":1,"selected":false},{"label":"<","to":"f9","row":1,"selected":false},{"label":"<=","to":"f10","row":1,"selected":false},{"label":"=","to":"f6","row":1,"selected":false}],"text":"Pedidos que passam: nenhum","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[false,false,false],"lines":[{"label":"MAX 200","value":200}]},"code":"WHERE valor > (SELECT MAX(valor) FROM pedidos)"},{"id":"f8","buttons":[{"label":"AVG","to":"f2","row":0,"selected":false},{"label":"MAX","to":"f8","row":0,"selected":true},{"label":"pedido 1","to":"f13","row":0,"selected":false},{"label":">","to":"f7","row":1,"selected":false},{"label":">=","to":"f8","row":1,"selected":true},{"label":"<","to":"f9","row":1,"selected":false},{"label":"<=","to":"f10","row":1,"selected":false},{"label":"=","to":"f6","row":1,"selected":false}],"text":"Pedidos que passam: 3","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[false,false,true],"lines":[{"label":"MAX 200","value":200}]},"code":"WHERE valor >= (SELECT MAX(valor) FROM pedidos)"},{"id":"f9","buttons":[{"label":"AVG","to":"f3","row":0,"selected":false},{"label":"MAX","to":"f9","row":0,"selected":true},{"label":"pedido 1","to":"f14","row":0,"selected":false},{"label":">","to":"f7","row":1,"selected":false},{"label":">=","to":"f8","row":1,"selected":false},{"label":"<","to":"f9","row":1,"selected":true},{"label":"<=","to":"f10","row":1,"selected":false},{"label":"=","to":"f6","row":1,"selected":false}],"text":"Pedidos que passam: 1, 2","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[true,true,false],"lines":[{"label":"MAX 200","value":200}]},"code":"WHERE valor < (SELECT MAX(valor) FROM pedidos)"},{"id":"f10","buttons":[{"label":"AVG","to":"f4","row":0,"selected":false},{"label":"MAX","to":"f10","row":0,"selected":true},{"label":"pedido 1","to":"f15","row":0,"selected":false},{"label":">","to":"f7","row":1,"selected":false},{"label":">=","to":"f8","row":1,"selected":false},{"label":"<","to":"f9","row":1,"selected":false},{"label":"<=","to":"f10","row":1,"selected":true},{"label":"=","to":"f6","row":1,"selected":false}],"text":"Pedidos que passam: 1, 2, 3","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[true,true,true],"lines":[{"label":"MAX 200","value":200}]},"code":"WHERE valor <= (SELECT MAX(valor) FROM pedidos)"},{"id":"f11","buttons":[{"label":"AVG","to":"f5","row":0,"selected":false},{"label":"MAX","to":"f6","row":0,"selected":false},{"label":"pedido 1","to":"f11","row":0,"selected":true},{"label":">","to":"f12","row":1,"selected":false},{"label":">=","to":"f13","row":1,"selected":false},{"label":"<","to":"f14","row":1,"selected":false},{"label":"<=","to":"f15","row":1,"selected":false},{"label":"=","to":"f11","row":1,"selected":true}],"text":"Pedidos que passam: 1","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[true,false,false],"lines":[{"label":"pedido 1 = 130","value":130}]},"code":"WHERE valor = (SELECT valor FROM pedidos WHERE id = 1)"},{"id":"f12","buttons":[{"label":"AVG","to":"f1","row":0,"selected":false},{"label":"MAX","to":"f7","row":0,"selected":false},{"label":"pedido 1","to":"f12","row":0,"selected":true},{"label":">","to":"f12","row":1,"selected":true},{"label":">=","to":"f13","row":1,"selected":false},{"label":"<","to":"f14","row":1,"selected":false},{"label":"<=","to":"f15","row":1,"selected":false},{"label":"=","to":"f11","row":1,"selected":false}],"text":"Pedidos que passam: 3","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[false,false,true],"lines":[{"label":"pedido 1 = 130","value":130}]},"code":"WHERE valor > (SELECT valor FROM pedidos WHERE id = 1)"},{"id":"f13","buttons":[{"label":"AVG","to":"f2","row":0,"selected":false},{"label":"MAX","to":"f8","row":0,"selected":false},{"label":"pedido 1","to":"f13","row":0,"selected":true},{"label":">","to":"f12","row":1,"selected":false},{"label":">=","to":"f13","row":1,"selected":true},{"label":"<","to":"f14","row":1,"selected":false},{"label":"<=","to":"f15","row":1,"selected":false},{"label":"=","to":"f11","row":1,"selected":false}],"text":"Pedidos que passam: 1, 3","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[true,false,true],"lines":[{"label":"pedido 1 = 130","value":130}]},"code":"WHERE valor >= (SELECT valor FROM pedidos WHERE id = 1)"},{"id":"f14","buttons":[{"label":"AVG","to":"f3","row":0,"selected":false},{"label":"MAX","to":"f9","row":0,"selected":false},{"label":"pedido 1","to":"f14","row":0,"selected":true},{"label":">","to":"f12","row":1,"selected":false},{"label":">=","to":"f13","row":1,"selected":false},{"label":"<","to":"f14","row":1,"selected":true},{"label":"<=","to":"f15","row":1,"selected":false},{"label":"=","to":"f11","row":1,"selected":false}],"text":"Pedidos que passam: 2","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[false,true,false],"lines":[{"label":"pedido 1 = 130","value":130}]},"code":"WHERE valor < (SELECT valor FROM pedidos WHERE id = 1)"},{"id":"f15","buttons":[{"label":"AVG","to":"f4","row":0,"selected":false},{"label":"MAX","to":"f10","row":0,"selected":false},{"label":"pedido 1","to":"f15","row":0,"selected":true},{"label":">","to":"f12","row":1,"selected":false},{"label":">=","to":"f13","row":1,"selected":false},{"label":"<","to":"f14","row":1,"selected":false},{"label":"<=","to":"f15","row":1,"selected":true},{"label":"=","to":"f11","row":1,"selected":false}],"text":"Pedidos que passam: 1, 2","chart":{"maximum":305.45454545454544,"values":[130,100,200],"matches":[true,true,false],"lines":[{"label":"pedido 1 = 130","value":130}]},"code":"WHERE valor <= (SELECT valor FROM pedidos WHERE id = 1)"}]}
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
{"type":"scene","title":"IN: o porteiro confere a lista","align":"left","initial":"f0","layout":["intro","chips","rows","buttons"],"frames":[{"id":"f0","buttons":[{"label":"Iniciar conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":""},{"label":"Bruno (2)","result":""},{"label":"Carla (3)","result":""}],"chips":["1","1","2"],"hits":[]},{"id":"f1","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":""},{"label":"Bruno (2)","result":""},{"label":"Carla (3)","result":""}],"chips":["1","1","2"],"hits":[],"next":{"to":"f2","delay":0}},{"id":"f2","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":"","active":true},{"label":"Bruno (2)","result":""},{"label":"Carla (3)","result":""}],"chips":["1","1","2"],"hits":[0,1],"next":{"to":"f3","delay":380}},{"id":"f3","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":"Está na lista? Sim","active":true,"tone":"success"},{"label":"Bruno (2)","result":""},{"label":"Carla (3)","result":""}],"chips":["1","1","2"],"hits":[0,1],"next":{"to":"f4","delay":651.1111111111111}},{"id":"f4","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":"Está na lista? Sim","tone":"success"},{"label":"Bruno (2)","result":""},{"label":"Carla (3)","result":""}],"chips":["1","1","2"],"hits":[],"next":{"to":"f5","delay":148.88888888888889}},{"id":"f5","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":"Está na lista? Sim","tone":"success"},{"label":"Bruno (2)","result":"","active":true},{"label":"Carla (3)","result":""}],"chips":["1","1","2"],"hits":[2],"next":{"to":"f6","delay":380}},{"id":"f6","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":"Está na lista? Sim","tone":"success"},{"label":"Bruno (2)","result":"Está na lista? Sim","active":true,"tone":"success"},{"label":"Carla (3)","result":""}],"chips":["1","1","2"],"hits":[2],"next":{"to":"f7","delay":651.1111111111111}},{"id":"f7","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":"Está na lista? Sim","tone":"success"},{"label":"Bruno (2)","result":"Está na lista? Sim","tone":"success"},{"label":"Carla (3)","result":""}],"chips":["1","1","2"],"hits":[],"next":{"to":"f8","delay":148.88888888888889}},{"id":"f8","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":"Está na lista? Sim","tone":"success"},{"label":"Bruno (2)","result":"Está na lista? Sim","tone":"success"},{"label":"Carla (3)","result":"","active":true}],"chips":["1","1","2"],"hits":[],"next":{"to":"f9","delay":380}},{"id":"f9","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":"Está na lista? Sim","tone":"success"},{"label":"Bruno (2)","result":"Está na lista? Sim","tone":"success"},{"label":"Carla (3)","result":"Está na lista? Não","active":true,"tone":"danger"}],"chips":["1","1","2"],"hits":[],"next":{"to":"f10","delay":651.1111111111111}},{"id":"f10","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":"Está na lista? Sim","tone":"success"},{"label":"Bruno (2)","result":"Está na lista? Sim","tone":"success"},{"label":"Carla (3)","result":"Está na lista? Não","tone":"danger"}],"chips":["1","1","2"],"hits":[]}]}
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
{"type":"scene","title":"NOT IN: quem ficou de fora da lista","align":"left","initial":"f0","layout":["intro","chips","rows","buttons"],"frames":[{"id":"f0","buttons":[{"label":"Iniciar conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":""},{"label":"Bruno (2)","result":""},{"label":"Carla (3)","result":""}],"chips":["1","1","2"],"hits":[]},{"id":"f1","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":""},{"label":"Bruno (2)","result":""},{"label":"Carla (3)","result":""}],"chips":["1","1","2"],"hits":[],"next":{"to":"f2","delay":0}},{"id":"f2","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":"","active":true},{"label":"Bruno (2)","result":""},{"label":"Carla (3)","result":""}],"chips":["1","1","2"],"hits":[0,1],"next":{"to":"f3","delay":380}},{"id":"f3","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":"Está na lista: fora","active":true,"tone":"danger"},{"label":"Bruno (2)","result":""},{"label":"Carla (3)","result":""}],"chips":["1","1","2"],"hits":[0,1],"next":{"to":"f4","delay":651.1111111111111}},{"id":"f4","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":"Está na lista: fora","tone":"danger"},{"label":"Bruno (2)","result":""},{"label":"Carla (3)","result":""}],"chips":["1","1","2"],"hits":[],"next":{"to":"f5","delay":148.88888888888889}},{"id":"f5","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":"Está na lista: fora","tone":"danger"},{"label":"Bruno (2)","result":"","active":true},{"label":"Carla (3)","result":""}],"chips":["1","1","2"],"hits":[2],"next":{"to":"f6","delay":380}},{"id":"f6","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":"Está na lista: fora","tone":"danger"},{"label":"Bruno (2)","result":"Está na lista: fora","active":true,"tone":"danger"},{"label":"Carla (3)","result":""}],"chips":["1","1","2"],"hits":[2],"next":{"to":"f7","delay":651.1111111111111}},{"id":"f7","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":"Está na lista: fora","tone":"danger"},{"label":"Bruno (2)","result":"Está na lista: fora","tone":"danger"},{"label":"Carla (3)","result":""}],"chips":["1","1","2"],"hits":[],"next":{"to":"f8","delay":148.88888888888889}},{"id":"f8","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":"Está na lista: fora","tone":"danger"},{"label":"Bruno (2)","result":"Está na lista: fora","tone":"danger"},{"label":"Carla (3)","result":"","active":true}],"chips":["1","1","2"],"hits":[],"next":{"to":"f9","delay":380}},{"id":"f9","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":"Está na lista: fora","tone":"danger"},{"label":"Bruno (2)","result":"Está na lista: fora","tone":"danger"},{"label":"Carla (3)","result":"Fora da lista: entra","active":true,"tone":"success"}],"chips":["1","1","2"],"hits":[],"next":{"to":"f10","delay":651.1111111111111}},{"id":"f10","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","rows":[{"label":"Ana (1)","result":"Está na lista: fora","tone":"danger"},{"label":"Bruno (2)","result":"Está na lista: fora","tone":"danger"},{"label":"Carla (3)","result":"Fora da lista: entra","tone":"success"}],"chips":["1","1","2"],"hits":[]}]}
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
{"type":"scene","title":"Cuidado: o nome borrado na lista","align":"left","initial":"f0","layout":["intro","chips","buttons","rows","text"],"frames":[{"id":"f0","buttons":[{"label":"+ pedido sem cliente (NULL)","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","text":"Clique no botão para acrescentar o pedido sem cliente e ver o que acontece.","rows":[{"label":"Carla (id 3)","result":""}],"chips":["1","1","2"],"hits":[]},{"id":"f1","buttons":[{"label":"Tirar o pedido sem cliente","to":"f6","row":0}],"intro":"Lista devolvida pela subconsulta:","text":"","rows":[{"label":"Carla (id 3)","result":"","active":true}],"chips":["1","1","2","NULL"],"hits":[],"next":{"to":"f2","delay":200}},{"id":"f2","buttons":[{"label":"Tirar o pedido sem cliente","to":"f6","row":0}],"intro":"Lista devolvida pela subconsulta:","text":"","rows":[{"label":"Carla (id 3)","result":"3 ≠ 1? sim","active":true}],"chips":["1","1","2","NULL"],"hits":[],"next":{"to":"f3","delay":800}},{"id":"f3","buttons":[{"label":"Tirar o pedido sem cliente","to":"f6","row":0}],"intro":"Lista devolvida pela subconsulta:","text":"","rows":[{"label":"Carla (id 3)","result":"3 ≠ 2? sim","active":true}],"chips":["1","1","2","NULL"],"hits":[],"next":{"to":"f4","delay":800}},{"id":"f4","buttons":[{"label":"Tirar o pedido sem cliente","to":"f6","row":0}],"intro":"Lista devolvida pela subconsulta:","text":"","rows":[{"label":"Carla (id 3)","result":"3 ≠ NULL? desconhecido","active":true}],"chips":["1","1","2","NULL"],"hits":[],"next":{"to":"f5","delay":860}},{"id":"f5","buttons":[{"label":"Tirar o pedido sem cliente","to":"f6","row":0}],"intro":"Lista devolvida pela subconsulta:","text":"Resultado: vazio, sem nenhum erro.","textRuns":[{"text":"Resultado: "},{"text":"vazio","strong":true,"tone":"danger"},{"text":", sem nenhum erro."}],"rows":[{"label":"Carla (id 3)","result":"em dúvida: Carla fica de fora","tone":"danger"}],"chips":["1","1","2","NULL"],"hits":[]},{"id":"f6","buttons":[{"label":"+ pedido sem cliente (NULL)","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","text":"","rows":[{"label":"Carla (id 3)","result":"","active":true}],"chips":["1","1","2"],"hits":[],"next":{"to":"f7","delay":200}},{"id":"f7","buttons":[{"label":"+ pedido sem cliente (NULL)","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","text":"","rows":[{"label":"Carla (id 3)","result":"3 ≠ 1? sim","active":true}],"chips":["1","1","2"],"hits":[],"next":{"to":"f8","delay":800}},{"id":"f8","buttons":[{"label":"+ pedido sem cliente (NULL)","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","text":"","rows":[{"label":"Carla (id 3)","result":"3 ≠ 2? sim","active":true}],"chips":["1","1","2"],"hits":[],"next":{"to":"f9","delay":860}},{"id":"f9","buttons":[{"label":"+ pedido sem cliente (NULL)","to":"f1","row":0}],"intro":"Lista devolvida pela subconsulta:","text":"Resultado: Carla.","textRuns":[{"text":"Resultado: "},{"text":"Carla","strong":true,"tone":"success"},{"text":"."}],"rows":[{"label":"Carla (id 3)","result":"todas dão sim: Carla entra","tone":"success"}],"chips":["1","1","2"],"hits":[]}]}
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
{"type":"scene","title":"Basta um: o EXISTS para no primeiro achado","align":"left","initial":"f0","layout":["buttons","rows","text"],"frames":[{"id":"f0","buttons":[{"label":"EXISTS","to":"f1","row":0,"selected":false},{"label":"COUNT","to":"f5","row":0,"selected":false}],"text":"Escolha EXISTS ou COUNT para ver como cada um trabalha.","rows":[{"label":"Pedido 1 (Ana, 130)","result":""},{"label":"Pedido 2 (Ana, 100)","result":""}]},{"id":"f1","buttons":[{"label":"EXISTS","to":"f1","row":0,"selected":true},{"label":"COUNT","to":"f5","row":0,"selected":false}],"text":"","rows":[{"label":"Pedido 1 (Ana, 130)","result":""},{"label":"Pedido 2 (Ana, 100)","result":""}],"next":{"to":"f2","delay":220}},{"id":"f2","buttons":[{"label":"EXISTS","to":"f1","row":0,"selected":true},{"label":"COUNT","to":"f5","row":0,"selected":false}],"text":"","rows":[{"label":"Pedido 1 (Ana, 130)","result":"","active":true},{"label":"Pedido 2 (Ana, 100)","result":""}],"next":{"to":"f3","delay":520}},{"id":"f3","buttons":[{"label":"EXISTS","to":"f1","row":0,"selected":true},{"label":"COUNT","to":"f5","row":0,"selected":false}],"text":"","rows":[{"label":"Pedido 1 (Ana, 130)","result":"PAGO: achei!","active":true,"tone":"success"},{"label":"Pedido 2 (Ana, 100)","result":""}],"next":{"to":"f4","delay":820}},{"id":"f4","buttons":[{"label":"EXISTS","to":"f1","row":0,"selected":true},{"label":"COUNT","to":"f5","row":0,"selected":false}],"text":"O EXISTS parou no primeiro achado: verdadeiro.","textRuns":[{"text":"O EXISTS parou no primeiro achado: "},{"text":"verdadeiro","strong":true,"tone":"success"},{"text":"."}],"rows":[{"label":"Pedido 1 (Ana, 130)","result":"PAGO: achei!","tone":"success"},{"label":"Pedido 2 (Ana, 100)","result":"nem precisa olhar","muted":true}]},{"id":"f5","buttons":[{"label":"EXISTS","to":"f1","row":0,"selected":false},{"label":"COUNT","to":"f5","row":0,"selected":true}],"text":"","rows":[{"label":"Pedido 1 (Ana, 130)","result":""},{"label":"Pedido 2 (Ana, 100)","result":""}],"next":{"to":"f6","delay":220}},{"id":"f6","buttons":[{"label":"EXISTS","to":"f1","row":0,"selected":false},{"label":"COUNT","to":"f5","row":0,"selected":true}],"text":"","rows":[{"label":"Pedido 1 (Ana, 130)","result":"","active":true},{"label":"Pedido 2 (Ana, 100)","result":""}],"next":{"to":"f7","delay":660}},{"id":"f7","buttons":[{"label":"EXISTS","to":"f1","row":0,"selected":false},{"label":"COUNT","to":"f5","row":0,"selected":true}],"text":"","rows":[{"label":"Pedido 1 (Ana, 130)","result":"conta 1","tone":"success"},{"label":"Pedido 2 (Ana, 100)","result":"","active":true}],"next":{"to":"f8","delay":680}},{"id":"f8","buttons":[{"label":"EXISTS","to":"f1","row":0,"selected":false},{"label":"COUNT","to":"f5","row":0,"selected":true}],"text":"O COUNT olhou todos: 2 pedidos. Trabalho extra para saber só se existe.","textRuns":[{"text":"O COUNT olhou todos: "},{"text":"2 pedidos","strong":true,"tone":"success"},{"text":". Trabalho extra para saber só se existe."}],"rows":[{"label":"Pedido 1 (Ana, 130)","result":"conta 1","tone":"success"},{"label":"Pedido 2 (Ana, 100)","result":"conta 2","tone":"success"}]}]}
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
{"type":"scene","title":"Passo a passo: um cliente por vez","align":"left","initial":"f0","layout":["rows","buttons"],"frames":[{"id":"f0","buttons":[{"label":"Iniciar conferência","to":"f1","row":0}],"rows":[{"label":"Ana","result":""},{"label":"Bruno","result":""},{"label":"Carla","result":""}]},{"id":"f1","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"rows":[{"label":"Ana","result":""},{"label":"Bruno","result":""},{"label":"Carla","result":""}],"next":{"to":"f2","delay":0}},{"id":"f2","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"rows":[{"label":"Ana","result":"","active":true},{"label":"Bruno","result":""},{"label":"Carla","result":""}],"next":{"to":"f3","delay":380}},{"id":"f3","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"rows":[{"label":"Ana","result":"2 pedidos pagos: existe","active":true,"tone":"success"},{"label":"Bruno","result":""},{"label":"Carla","result":""}],"next":{"to":"f4","delay":651.1111111111111}},{"id":"f4","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"rows":[{"label":"Ana","result":"2 pedidos pagos: existe","tone":"success"},{"label":"Bruno","result":""},{"label":"Carla","result":""}],"next":{"to":"f5","delay":148.88888888888889}},{"id":"f5","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"rows":[{"label":"Ana","result":"2 pedidos pagos: existe","tone":"success"},{"label":"Bruno","result":"","active":true},{"label":"Carla","result":""}],"next":{"to":"f6","delay":380}},{"id":"f6","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"rows":[{"label":"Ana","result":"2 pedidos pagos: existe","tone":"success"},{"label":"Bruno","result":"1 pedido pago: existe","active":true,"tone":"success"},{"label":"Carla","result":""}],"next":{"to":"f7","delay":651.1111111111111}},{"id":"f7","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"rows":[{"label":"Ana","result":"2 pedidos pagos: existe","tone":"success"},{"label":"Bruno","result":"1 pedido pago: existe","tone":"success"},{"label":"Carla","result":""}],"next":{"to":"f8","delay":148.88888888888889}},{"id":"f8","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"rows":[{"label":"Ana","result":"2 pedidos pagos: existe","tone":"success"},{"label":"Bruno","result":"1 pedido pago: existe","tone":"success"},{"label":"Carla","result":"","active":true}],"next":{"to":"f9","delay":380}},{"id":"f9","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"rows":[{"label":"Ana","result":"2 pedidos pagos: existe","tone":"success"},{"label":"Bruno","result":"1 pedido pago: existe","tone":"success"},{"label":"Carla","result":"0 pedidos: não existe","active":true,"tone":"danger"}],"next":{"to":"f10","delay":651.1111111111111}},{"id":"f10","buttons":[{"label":"Repetir conferência","to":"f1","row":0}],"rows":[{"label":"Ana","result":"2 pedidos pagos: existe","tone":"success"},{"label":"Bruno","result":"1 pedido pago: existe","tone":"success"},{"label":"Carla","result":"0 pedidos: não existe","tone":"danger"}]}]}
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
{"type":"scene","title":"Por que ela se chama correlacionada?","align":"center","initial":"f0","layout":["buttons","rows","value","text"],"frames":[{"id":"f0","buttons":[{"label":"Escalar (AVG)","to":"f1","row":0,"selected":false},{"label":"Correlacionada (EXISTS)","to":"f3","row":0,"selected":false}],"text":"Escolha uma opção para ver quantas vezes a subconsulta roda.","value":"0","valuePrefix":"Execuções da subconsulta: ","rows":[{"label":"Ana","result":""},{"label":"Bruno","result":""},{"label":"Carla","result":""}]},{"id":"f1","buttons":[{"label":"Escalar (AVG)","to":"f1","row":0,"selected":true},{"label":"Correlacionada (EXISTS)","to":"f3","row":0,"selected":false}],"text":"","value":"0","valuePrefix":"Execuções da subconsulta: ","rows":[{"label":"Ana","result":""},{"label":"Bruno","result":""},{"label":"Carla","result":""}],"next":{"to":"f2","delay":320}},{"id":"f2","buttons":[{"label":"Escalar (AVG)","to":"f1","row":0,"selected":true},{"label":"Correlacionada (EXISTS)","to":"f3","row":0,"selected":false}],"text":"Rodou uma vez, antes de tudo. Todos usam o mesmo resultado.","value":"1","valuePrefix":"Execuções da subconsulta: ","rows":[{"label":"Ana","result":"usa 143,33","active":true},{"label":"Bruno","result":"usa 143,33","active":true},{"label":"Carla","result":"usa 143,33","active":true}]},{"id":"f3","buttons":[{"label":"Escalar (AVG)","to":"f1","row":0,"selected":false},{"label":"Correlacionada (EXISTS)","to":"f3","row":0,"selected":true}],"text":"","value":"0","valuePrefix":"Execuções da subconsulta: ","rows":[{"label":"Ana","result":""},{"label":"Bruno","result":""},{"label":"Carla","result":""}],"next":{"to":"f4","delay":300}},{"id":"f4","buttons":[{"label":"Escalar (AVG)","to":"f1","row":0,"selected":false},{"label":"Correlacionada (EXISTS)","to":"f3","row":0,"selected":true}],"text":"","value":"1","valuePrefix":"Execuções da subconsulta: ","rows":[{"label":"Ana","result":"roda para Ana","active":true},{"label":"Bruno","result":""},{"label":"Carla","result":""}],"next":{"to":"f5","delay":1180}},{"id":"f5","buttons":[{"label":"Escalar (AVG)","to":"f1","row":0,"selected":false},{"label":"Correlacionada (EXISTS)","to":"f3","row":0,"selected":true}],"text":"","value":"2","valuePrefix":"Execuções da subconsulta: ","rows":[{"label":"Ana","result":"roda para Ana"},{"label":"Bruno","result":"roda para Bruno","active":true},{"label":"Carla","result":""}],"next":{"to":"f6","delay":1180}},{"id":"f6","buttons":[{"label":"Escalar (AVG)","to":"f1","row":0,"selected":false},{"label":"Correlacionada (EXISTS)","to":"f3","row":0,"selected":true}],"text":"","value":"3","valuePrefix":"Execuções da subconsulta: ","rows":[{"label":"Ana","result":"roda para Ana"},{"label":"Bruno","result":"roda para Bruno"},{"label":"Carla","result":"roda para Carla","active":true}],"next":{"to":"f7","delay":1080}},{"id":"f7","buttons":[{"label":"Escalar (AVG)","to":"f1","row":0,"selected":false},{"label":"Correlacionada (EXISTS)","to":"f3","row":0,"selected":true}],"text":"Rodou uma vez para cada cliente, porque depende de quem está na porta.","value":"3","valuePrefix":"Execuções da subconsulta: ","rows":[{"label":"Ana","result":"roda para Ana"},{"label":"Bruno","result":"roda para Bruno"},{"label":"Carla","result":"roda para Carla"}]}]}
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
{"type":"scene","title":"E se a resposta for uma tabela inteira?","align":"center","initial":"f0","layout":["buttons","cells","text"],"frames":[{"id":"f0","buttons":[{"label":"Um valor","to":"f1","row":0,"selected":false},{"label":"Uma lista","to":"f2","row":0,"selected":false},{"label":"Uma tabela","to":"f3","row":0,"selected":false}],"text":"Escolha um formato para ver o que cabe no WHERE ou no FROM.","cells":{"columns":1,"values":[]}},{"id":"f1","buttons":[{"label":"Um valor","to":"f1","row":0,"selected":true},{"label":"Uma lista","to":"f2","row":0,"selected":false},{"label":"Uma tabela","to":"f3","row":0,"selected":false}],"text":"Um valor: cabe no WHERE com =, > ou <. É a subconsulta escalar.","cells":{"columns":1,"values":["143,33"]}},{"id":"f2","buttons":[{"label":"Um valor","to":"f1","row":0,"selected":false},{"label":"Uma lista","to":"f2","row":0,"selected":true},{"label":"Uma tabela","to":"f3","row":0,"selected":false}],"text":"Uma lista: cabe no WHERE com IN ou NOT IN.","cells":{"columns":1,"values":["1","1","2"]}},{"id":"f3","buttons":[{"label":"Um valor","to":"f1","row":0,"selected":false},{"label":"Uma lista","to":"f2","row":0,"selected":false},{"label":"Uma tabela","to":"f3","row":0,"selected":true}],"text":"Uma tabela: cabe no FROM, com apelido. É a tabela derivada.","cells":{"columns":2,"values":["id_cliente","total_gasto","1","230","2","200"]}}]}
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
{"type":"scene","title":"O caixa separa em montinhos","align":"center","initial":"f0","layout":["groups","buttons"],"frames":[{"id":"f0","buttons":[{"label":"Iniciar: separar em montinhos","to":"f1","row":0}],"groups":[{"name":"Ana","items":[],"total":"total: 0"},{"name":"Bruno","items":[],"total":"total: 0"}]},{"id":"f1","buttons":[{"label":"Repetir separação","to":"f1","row":0}],"groups":[{"name":"Ana","items":[],"total":"total: 0"},{"name":"Bruno","items":[],"total":"total: 0"}],"next":{"to":"f2","delay":240}},{"id":"f2","buttons":[{"label":"Repetir separação","to":"f1","row":0}],"groups":[{"name":"Ana","items":["130"],"total":"total: 130"},{"name":"Bruno","items":[],"total":"total: 0"}],"next":{"to":"f3","delay":800}},{"id":"f3","buttons":[{"label":"Repetir separação","to":"f1","row":0}],"groups":[{"name":"Ana","items":["130","100"],"total":"total: 230"},{"name":"Bruno","items":[],"total":"total: 0"}],"next":{"to":"f4","delay":800}},{"id":"f4","buttons":[{"label":"Repetir separação","to":"f1","row":0}],"groups":[{"name":"Ana","items":["130","100"],"total":"total: 230"},{"name":"Bruno","items":["200"],"total":"total: 200"}]}]}
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
{"type":"scene","title":"Resumir antes de juntar","align":"left","initial":"f0","layout":["buttons","rows","text"],"frames":[{"id":"f0","buttons":[{"label":"JOIN","to":"f1","row":0,"selected":false},{"label":"LEFT JOIN","to":"f2","row":0,"selected":false}],"text":"Escolha JOIN ou LEFT JOIN para ver o que acontece com a Carla.","rows":[{"label":"Ana","result":"230"},{"label":"Bruno","result":"200"},{"label":"Carla","result":"NULL"}]},{"id":"f1","buttons":[{"label":"JOIN","to":"f1","row":0,"selected":true},{"label":"LEFT JOIN","to":"f2","row":0,"selected":false}],"text":"JOIN só mantém quem tem par no resumo: a Carla some.","rows":[{"label":"Ana","result":"230"},{"label":"Bruno","result":"200"},{"label":"Carla","result":"sem par: some","muted":true,"tone":"danger"}]},{"id":"f2","buttons":[{"label":"JOIN","to":"f1","row":0,"selected":false},{"label":"LEFT JOIN","to":"f2","row":0,"selected":true}],"text":"LEFT JOIN mantém todos os clientes: a Carla fica com NULL, sem informação.","rows":[{"label":"Ana","result":"230"},{"label":"Bruno","result":"200"},{"label":"Carla","result":"NULL","tone":"success"}]}]}
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
{"type":"scene","title":"Por que a ordem importa","align":"center","initial":"f0","layout":["value","buttons","text"],"frames":[{"id":"f0","buttons":[{"label":"Juntar antes de somar","to":"f1","row":0,"selected":false},{"label":"Resumir antes de juntar","to":"f2","row":0,"selected":false}],"text":"Escolha uma opção para ver como o total muda.","value":"230","valuePrefix":"Total da Ana: "},{"id":"f1","buttons":[{"label":"Juntar antes de somar","to":"f1","row":0,"selected":true},{"label":"Resumir antes de juntar","to":"f2","row":0,"selected":false}],"text":"O pedido 1 entrou duas vezes: 130 + 130 + 100.","value":"360","valuePrefix":"Total da Ana: ","valueTone":"danger"},{"id":"f2","buttons":[{"label":"Juntar antes de somar","to":"f1","row":0,"selected":false},{"label":"Resumir antes de juntar","to":"f2","row":0,"selected":true}],"text":"Cada pedido entrou uma vez: 130 + 100.","value":"230","valuePrefix":"Total da Ana: ","valueTone":"success"}]}
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
{"type":"scene","title":"Contar pedidos e trocar NULL por zero","align":"left","initial":"f0","layout":["buttons","rows","text"],"frames":[{"id":"f0","buttons":[{"label":"Sem COALESCE","to":"f1","row":0,"selected":false},{"label":"Com COALESCE","to":"f2","row":0,"selected":false}],"text":"A Carla fez zero pedidos: \"NULL\" fica estranho num relatório.","rows":[{"label":"Ana","result":"2"},{"label":"Bruno","result":"1"},{"label":"Carla","result":"NULL"}]},{"id":"f1","buttons":[{"label":"Sem COALESCE","to":"f1","row":0,"selected":true},{"label":"Com COALESCE","to":"f2","row":0,"selected":false}],"text":"A Carla fez zero pedidos: \"NULL\" fica estranho num relatório.","rows":[{"label":"Ana","result":"2"},{"label":"Bruno","result":"1"},{"label":"Carla","result":"NULL","tone":"danger"}]},{"id":"f2","buttons":[{"label":"Sem COALESCE","to":"f1","row":0,"selected":false},{"label":"Com COALESCE","to":"f2","row":0,"selected":true}],"text":"A Carla fez zero pedidos: \"NULL\" fica estranho num relatório.","rows":[{"label":"Ana","result":"2"},{"label":"Bruno","result":"1"},{"label":"Carla","result":"0","tone":"success"}]}]}
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
{"type":"scene","title":"Voltando à lanchonete: lendo o mundo com SQL","align":"center","initial":"f0","layout":["buttons","code","text"],"frames":[{"id":"f0","buttons":[{"label":"Quem pediu acima da média?","to":"f1","row":0,"selected":false},{"label":"Quem já pagou algum pedido?","to":"f3","row":0,"selected":false},{"label":"Quem nunca pediu?","to":"f5","row":0,"selected":false},{"label":"Quanto cada um gastou?","to":"f7","row":0,"selected":false}],"text":"Escolha uma pergunta da Dona Marta.","code":"","codeHidden":true},{"id":"f1","buttons":[{"label":"Quem pediu acima da média?","to":"f2","row":0,"selected":true},{"label":"Quem já pagou algum pedido?","to":"f3","row":0,"selected":false},{"label":"Quem nunca pediu?","to":"f5","row":0,"selected":false},{"label":"Quanto cada um gastou?","to":"f7","row":0,"selected":false}],"text":"Tipo: Subconsulta escalar (um valor)","code":"SELECT id, valor FROM pedidos\nWHERE valor > (SELECT AVG(valor) FROM pedidos);"},{"id":"f2","buttons":[{"label":"Quem pediu acima da média?","to":"f1","row":0,"selected":false},{"label":"Quem já pagou algum pedido?","to":"f3","row":0,"selected":false},{"label":"Quem nunca pediu?","to":"f5","row":0,"selected":false},{"label":"Quanto cada um gastou?","to":"f7","row":0,"selected":false}],"text":"Escolha uma pergunta da Dona Marta.","code":"SELECT id, valor FROM pedidos\nWHERE valor > (SELECT AVG(valor) FROM pedidos);","codeHidden":true},{"id":"f3","buttons":[{"label":"Quem pediu acima da média?","to":"f1","row":0,"selected":false},{"label":"Quem já pagou algum pedido?","to":"f4","row":0,"selected":true},{"label":"Quem nunca pediu?","to":"f5","row":0,"selected":false},{"label":"Quanto cada um gastou?","to":"f7","row":0,"selected":false}],"text":"Tipo: Subconsulta de lista (IN)","code":"SELECT nome FROM clientes\nWHERE id IN (\n  SELECT id_cliente FROM pedidos\n  WHERE status = 'PAGO'\n);"},{"id":"f4","buttons":[{"label":"Quem pediu acima da média?","to":"f1","row":0,"selected":false},{"label":"Quem já pagou algum pedido?","to":"f3","row":0,"selected":false},{"label":"Quem nunca pediu?","to":"f5","row":0,"selected":false},{"label":"Quanto cada um gastou?","to":"f7","row":0,"selected":false}],"text":"Escolha uma pergunta da Dona Marta.","code":"SELECT nome FROM clientes\nWHERE id IN (\n  SELECT id_cliente FROM pedidos\n  WHERE status = 'PAGO'\n);","codeHidden":true},{"id":"f5","buttons":[{"label":"Quem pediu acima da média?","to":"f1","row":0,"selected":false},{"label":"Quem já pagou algum pedido?","to":"f3","row":0,"selected":false},{"label":"Quem nunca pediu?","to":"f6","row":0,"selected":true},{"label":"Quanto cada um gastou?","to":"f7","row":0,"selected":false}],"text":"Tipo: Subconsulta correlacionada (NOT EXISTS)","code":"SELECT cli.nome FROM clientes cli\nWHERE NOT EXISTS (\n  SELECT 1 FROM pedidos ped\n  WHERE ped.id_cliente = cli.id\n);"},{"id":"f6","buttons":[{"label":"Quem pediu acima da média?","to":"f1","row":0,"selected":false},{"label":"Quem já pagou algum pedido?","to":"f3","row":0,"selected":false},{"label":"Quem nunca pediu?","to":"f5","row":0,"selected":false},{"label":"Quanto cada um gastou?","to":"f7","row":0,"selected":false}],"text":"Escolha uma pergunta da Dona Marta.","code":"SELECT cli.nome FROM clientes cli\nWHERE NOT EXISTS (\n  SELECT 1 FROM pedidos ped\n  WHERE ped.id_cliente = cli.id\n);","codeHidden":true},{"id":"f7","buttons":[{"label":"Quem pediu acima da média?","to":"f1","row":0,"selected":false},{"label":"Quem já pagou algum pedido?","to":"f3","row":0,"selected":false},{"label":"Quem nunca pediu?","to":"f5","row":0,"selected":false},{"label":"Quanto cada um gastou?","to":"f8","row":0,"selected":true}],"text":"Tipo: Tabela derivada (no FROM)","code":"SELECT cli.nome, resumo.total_gasto\nFROM clientes cli\nLEFT JOIN (\n  SELECT id_cliente, SUM(valor) AS total_gasto\n  FROM pedidos GROUP BY id_cliente\n) resumo ON cli.id = resumo.id_cliente;"},{"id":"f8","buttons":[{"label":"Quem pediu acima da média?","to":"f1","row":0,"selected":false},{"label":"Quem já pagou algum pedido?","to":"f3","row":0,"selected":false},{"label":"Quem nunca pediu?","to":"f5","row":0,"selected":false},{"label":"Quanto cada um gastou?","to":"f7","row":0,"selected":false}],"text":"Escolha uma pergunta da Dona Marta.","code":"SELECT cli.nome, resumo.total_gasto\nFROM clientes cli\nLEFT JOIN (\n  SELECT id_cliente, SUM(valor) AS total_gasto\n  FROM pedidos GROUP BY id_cliente\n) resumo ON cli.id = resumo.id_cliente;","codeHidden":true}]}
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