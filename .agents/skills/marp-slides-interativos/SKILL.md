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
| Migrar falas, controles e sequência exatos | scene | title, initial, layout, frames |

Use um fence interactive com JSON válido, aspas duplas e `\n` nas quebras internas das strings. Todos os tipos exigem title (1–100 caracteres). Nenhum campo desconhecido é aceito.

## Estados visuais

steps e compare exigem 2–6 states:
- label (1–60) e text (1–400).
- code opcional (até 800 caracteres/12 linhas), focus opcional (trecho exato de code, até 100 caracteres).
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

rows: 1–8 objetos label/result/match, key opcional; chips opcionais. key liga a linha aos chips com o mesmo texto. variants opcional: 1–4 objetos label/stopAtMatch.
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
term: identificador único, até 40 caracteres, começando com letra/underscore e seguido de letras/dígitos/underscore. Tabelas: 1–4 colunas, 1–8 linhas, células string/número/null.
scope: widget (padrão) ou deck. deck também anota os termos nos outros blocos de código da aula, preservando o destaque de sintaxe. Tooltip abre ao apontar/focar; Escape fecha. Não use observer global ou scripts no MD.

```interactive
{"type":"reference","title":"Dados à mão","scope":"deck","code":"SELECT nome FROM clientes;","tables":[{"term":"clientes","headers":["id","nome"],"rows":[[1,"Ana"],[2,"Bruno"]]}]}
```

## Cenas para migração fiel

Prefira os seis componentes simples para aulas novas. Use scene quando precisar manter os rótulos, os estados iniciais e as mensagens exatas de uma interação existente, sem scripts no Markdown.

- type: scene; title acessível (não acrescenta título visível); initial: id de um quadro; align opcional (left/center) alinha controles e mensagens.
- layout: lista sem repetições que ordena intro, rows, value, buttons, text, chart, code, chips, groups e cells. Colunas externas continuam sendo divs com as classes do tema, sem alteração.
- frames: 1–64 quadros, id único de letras/dígitos/underscore/hífen (até 40 caracteres).
- Cada quadro exige buttons: até 8 objetos label/to; selected/disabled booleanos e row (0–3) opcionais. to aponta para um quadro existente; os rótulos não são substituídos por controles genéricos.
- next opcional: {to,delay}, em milissegundos (0–10000). Sem ciclos automáticos e até 30000 ms por cadeia; cliques podem voltar ao início.
- intro, text, value, valuePrefix: strings até 400 caracteres. valueTone opcional (success/danger) colore o valor como certo/errado. textRuns opcional: até 24 trechos {text,strong?,tone?}, tone success/danger; a concatenação deve reproduzir text, sem HTML.
- code: texto puro até 800 caracteres/12 linhas. focus: trecho exato do code (até 100 caracteres) a destacar; codeHidden opcional.
- rows: até 8 objetos label/result, active/muted e tone. label é obrigatório (até 100 caracteres). result é o valor da linha (texto até 100 caracteres, aceita o apelido value; se ambos forem usados devem ser iguais) e é opcional: omita quando a linha for só um item da lista.
- chips: até 12 strings (até 100 caracteres); hits: índices válidos desses chips (exigem chips no mesmo quadro).
- chart: objeto com values e maximum (até 12 valores entre 0 e maximum); lines (até 6 linhas {label,value,previous?}) e matches (mesmo tamanho de values) são opcionais. Não acrescente type nem outros campos. maximum deve estar entre 1 e 1000000; barras e linhas de referência devem ficar entre 0 e maximum. O autor fornece os cálculos.
- groups: até 4 objetos name/items/total (exatamente esses campos), name até 60 caracteres; total e itens são strings até 100 caracteres, até 12 itens por grupo. cells: objeto com columns (1–4) e values (até 32 strings de até 100 caracteres).
- JSON de scene: até 64000 caracteres; os outros tipos continuam limitados a 12000.
- O motor escapa textos, mantém foco do botão após trocar o quadro, anima contadores/linhas/destaques e pausa transições ao navegar, ocultar ou imprimir. Edição descarta listeners e timers.
- Impressão de scene: snapshot do quadro inicial, sem controles. Não imprime automaticamente todos os caminhos de uma cena. PPTX continua textual.
- reference com scope deck pode usar annotationOnly:true para anotar o código da aula sem criar conteúdo visível nem um slide extra.

Exemplo mínimo:

```interactive
{"type":"scene","title":"Duas perguntas","initial":"inicio","layout":["buttons","text"],"frames":[{"id":"inicio","buttons":[{"label":"Iniciar: calcular a média","to":"resultado"}],"text":"Calcule primeiro."},{"id":"resultado","buttons":[{"label":"Reiniciar","to":"inicio"}],"text":"Agora compare com a média."}]}
```

Exemplo com linhas, gráfico e valor final (repare em result, não value):

```interactive
{"type":"scene","title":"Somar os pedidos","initial":"inicio","layout":["text","rows","chart","value","buttons"],"frames":[{"id":"inicio","text":"Três pedidos, dois clientes.","rows":[{"label":"Pedido 1 - Ana","result":"130"},{"label":"Pedido 2 - Ana","result":"100"},{"label":"Pedido 3 - Bruno","result":"200"}],"chart":{"values":[130,100,200],"matches":[false,false,false],"maximum":250,"lines":[{"label":"Ana","value":230}]},"value":"0","buttons":[{"label":"Somar","to":"total"}]},{"id":"total","text":"Ana: 230. Total geral: 430.","rows":[{"label":"Ana","result":"230","active":true},{"label":"Bruno","result":"200","active":true}],"chart":{"values":[130,100,200],"matches":[true,true,false],"maximum":250,"lines":[{"label":"Ana","value":230}]},"value":"430","valueTone":"success","buttons":[{"label":"Voltar","to":"inicio"}]}]}
```

Não use scene para executar SQL ou simular um motor de consultas: cada resultado é declarado e deve ser revisado. Para migrações, compare também os textos revelados após cada clique com o original.

## Gabaritos

Use details.gab com summary e Markdown separado por linhas em branco. name compartilhado cria acordeão. O motor abre todos ao imprimir e restaura o estado depois.

## Regras e verificação

1. Não gerar style, script, imports, IDs, handlers ou controles HTML para os recursos disponíveis.
2. Um interativo por slide, título ## fora do fence; no máximo duas frases curtas fora do widget. Conferir altura, não só JSON.
3. Texto/code são texto puro; HTML é escapado. SQL/JS não são executados.
4. Não inventar controles: os itens não são arrastáveis pelo aluno; são movidos pela reprodução.
5. steps/compare expõem os estados na impressão; os demais usam snapshots (scene usa o quadro inicial). Não guardar gabaritos secretos no componente. PPTX continua textual e pode omitir estados ocultos.
6. Movimento reduzido desliga animações; navegar, reiniciar ou editar cancela a reprodução anterior.
7. Testar seleção, reprodução/pausa/reinício, cliques rápidos, teclado, impressão e re-render na prévia e standalone.
8. Conferir cada recurso exigido pelo professor no JSON e no layout: não omitir focus ou next explicitamente pedidos, nem substituí-los por texto ou botões manuais.
9. Não declarar sucesso apenas porque renderizou. Conferir aritmética, significado didático e corte de conteúdo.

## Fontes e demonstração

- Contrato/cálculos/render: backend/src/slideInteractive.ts.
- Runtime: backend/src/slideInteractiveRuntime.ts.
- Ambos são espelhados byte a byte em frontend/src/shared; tema também é espelhado.
- Exemplos da aula inteira: backend/eval/referencias/subconsultas-modular.md.
- Migração fiel: examplo.md; fonte preservada em backend/eval/referencias/examplo-original.md; reprodução via backend/eval/migrarExemploFiel.ts.
- Cenas: backend/src/slideScene.ts, espelhado em frontend/src/shared/slideScene.ts.
- Mapa das duas migrações: backend/eval/referencias/COBERTURA_INTERATIVOS.md.
- Skill interna: backend/src/aiSkillRenderer.ts, injetada nas vias direta e decomposta. O backend não lê este SKILL.md automaticamente.

## Avaliação real de cenas

Via Docker, rode em backend/: bun run eval/testarSceneValores.ts --live (direta) ou acrescente --decomposta. Consome tokens; exige DATABASE_PATH com test no nome. Confere valores exatos, associação da soma à Ana, gráfico, foco SQL e sequência temporizada, sem rebaixar requisitos a opcionais. Artefatos e resultado.json ficam em backend/eval/output/scene-valores-<modo>/. Um exemplo válido não prova consistência do modelo.
