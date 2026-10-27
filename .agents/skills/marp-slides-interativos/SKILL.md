---
name: marp-slides-interativos
description: Cria ou converte slides Marp Next com animações nativas, barras e referências móveis, agregações, varredura, agrupamento, contadores, destaque de código, cenários e tooltips de tabelas, sem gerar CSS ou JavaScript.
---

# Interativos nativos do Marp Next

O Markdown descreve dados e intenção. O motor fornece interface e movimento. Use apenas quando a interação ajudar a ensinar, não para decorar.

## Escolha do componente

| Intenção | type | Campos |
|---|---|---|
| Processo, código interno/externo, contador | steps | title, states |
| Antes/depois, JOIN, NULL, formatos, hipóteses | compare | title, states, collapse opcional |
| Barras, agregação, linha móvel, novo dado | bars | title, values, labels, references, operators, mode, extra |
| IN/NOT IN/EXISTS, visita linha a linha | scan | title, rows, chips, variants |
| Distribuir itens e somar por grupo | group | title, items |
| Consultar tabelas apontando nomes no código | reference | title, code, tables, scope |

Use um fence interactive com JSON válido, aspas duplas e `\n` nas quebras internas das strings. Todos os tipos exigem title (1–100 caracteres). Nenhum campo desconhecido é aceito.

## Estados visuais

steps e compare exigem 2–6 states:
- label (1–60) e text (1–400).
- code opcional (até 800 caracteres/12 linhas), focus opcional (trecho exato de code).
- value opcional: número para contador animado.
- rows opcionais: 1–8 objetos label/result, match/muted booleanos opcionais e key opcional.
- chips opcionais: até 12 strings/números/null.
- table opcional: headers (1–4), rows (1–8 linhas com o mesmo número de células).

steps tem Anterior/Próximo/Reproduzir/Pausar/Reiniciar; compare tem botões de cenário. collapse:true em compare permite abrir/fechar o painel. O motor faz fade, destaque e entrada escalonada.

````markdown
## A ordem muda o total

```interactive
{"type":"compare","title":"Cada pedido deve contar uma vez","states":[{"label":"Juntar antes","text":"O pedido 1 aparece duplicado.","value":360,"chips":[130,130,100]},{"label":"Resumir antes","text":"Cada pedido entra uma vez.","value":230,"chips":[130,100]}]}
```
````

## Barras e cálculos

values: 1–12 números não negativos até 1000000; labels: mesmo número de rótulos curtos.
- mode: filter (padrão) ou aggregate.
- references: até 6 entradas AVG/MAX/MIN/SUM/COUNT ou número não negativo.
- operators: subconjunto de >, >=, <, <=, =.
- extra: {label,value} opcional; botão inclui/remove esse dado.

O motor calcula referências e seleção, move a linha e anima o contador. Com extra, uma linha pontilhada marca o valor anterior. Use AVG, não uma média arredondada manualmente.

```interactive
{"type":"bars","title":"A média acompanha os pedidos","values":[130,100,200],"labels":["Pedido 1","Pedido 2","Pedido 3"],"references":["AVG","MAX",130],"operators":[">",">=","="],"extra":{"label":"Pedido 4","value":300}}
```

## Varredura

rows: 1–8 objetos label/result/match, key opcional; chips opcionais. key liga a linha aos chips com o mesmo texto. variants: 1–4 objetos label/stopAtMatch.
- true: para no primeiro match e esmaece linhas não visitadas.
- false: visita todas.
O contador mostra visitas, não a quantidade de matches. match/result são fornecidos pelo autor; o motor não executa SQL.

```interactive
{"type":"scan","title":"Encontrar um ou contar todos","rows":[{"label":"Pedido 1","result":"Pago","match":true},{"label":"Pedido 2","result":"Pago","match":true}],"variants":[{"label":"EXISTS","stopAtMatch":true},{"label":"COUNT","stopAtMatch":false}]}
```

## Agrupamento

items: 1–12 objetos label/group/value (até 4 grupos). O motor move os chips e calcula os totais, inclusive valores negativos. Não forneça totais manualmente.

```interactive
{"type":"group","title":"Pedidos por cliente","items":[{"label":"Pedido 1","group":"Ana","value":130},{"label":"Pedido 2","group":"Ana","value":100},{"label":"Pedido 3","group":"Bruno","value":200}]}
```

## Referências contextuais

code: até 800 caracteres/12 linhas. tables: 1–4 objetos term/headers/rows.
term: identificador único, até 40 caracteres, letras/dígitos/underscore. Tabelas: 1–4 colunas, 1–8 linhas, células string/número/null.
scope: widget (padrão) ou deck. deck também anota os termos nos outros blocos de código da aula, preservando o destaque de sintaxe. Tooltip abre ao apontar/focar; Escape fecha. Não use observer global ou scripts no MD.

```interactive
{"type":"reference","title":"Dados à mão","scope":"deck","code":"SELECT nome FROM clientes;","tables":[{"term":"clientes","headers":["id","nome"],"rows":[[1,"Ana"],[2,"Bruno"]]}]}
```

## Gabaritos

Use details.gab com summary e Markdown separado por linhas em branco. name compartilhado cria acordeão. O motor abre todos ao imprimir e restaura o estado depois.

## Regras e verificação

1. Não gerar style, script, imports, IDs, handlers ou controles HTML para os recursos disponíveis.
2. Um interativo por slide, título ## fora do fence; no máximo duas frases curtas fora do widget. Conferir altura, não só JSON.
3. Texto/code são texto puro; HTML é escapado. SQL/JS não são executados.
4. Não inventar controles: os itens não são arrastáveis pelo aluno; são movidos pela reprodução.
5. Todos os estados ou snapshots ficam expostos na impressão. Não guardar gabaritos secretos no componente. PPTX continua textual e pode omitir estados ocultos.
6. Movimento reduzido desliga animações; navegar, reiniciar ou editar cancela a reprodução anterior.
7. Testar seleção, reprodução/pausa/reinício, cliques rápidos, teclado, impressão e re-render na prévia e standalone.
8. Não declarar sucesso apenas porque renderizou. Conferir aritmética, significado didático e corte de conteúdo.

## Fontes e demonstração

- Contrato/cálculos/render: backend/src/slideInteractive.ts.
- Runtime: backend/src/slideInteractiveRuntime.ts.
- Ambos são espelhados byte a byte em frontend/src/shared; tema também é espelhado.
- Exemplos da aula inteira: backend/eval/referencias/subconsultas-modular.md.
- Mapa da migração: backend/eval/referencias/COBERTURA_INTERATIVOS.md.
- Skill interna: backend/src/aiSkillRenderer.ts, injetada nas vias direta e decomposta. O backend não lê este SKILL.md automaticamente.
