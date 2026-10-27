export const SKILL_RECURSOS_RENDER = `SKILL: RECURSOS INTERATIVOS E ILUSTRAÇÃO (Marp Next)

INTERATIVOS NATIVOS — PRIORIDADE
- Use fence interactive com JSON. O motor fornece controles, movimentos, teclado e impressão. NÃO gere HTML/CSS/scripts/imports para reproduzir estes recursos.
- Catálogo: steps, compare, bars, scan, group, reference. Se não ajudar a ensinar, use Markdown comum.
- Todos exigem title (1–100 caracteres). Nenhum campo fora do contrato é aceito. Texto é puro, HTML é escapado. JSON usa aspas duplas e \\n nas quebras internas de strings.
- Antes de entregar, confira as observações do professor: cada recurso explicitamente solicitado deve aparecer no JSON e no layout do componente. Não substitua foco de código por texto explicativo nem sequência automática por botões manuais. Preserve trechos exatos de código quando pedidos. Não trate exigências como opcionais.
- No máximo um bloco interativo por slide. Título ## fora do fence. Nunca inventar SQL executável: o motor não executa SQL nem JavaScript da aula.

SEQUÊNCIAS E CENÁRIOS
- steps: states com 2–6 estados, controles Anterior/Próximo/Reproduzir/Pausar/Reiniciar. compare: botões de cenários; collapse:true permite abrir/fechar clicando novamente.
- Estado: label (1–60), text (1–400); code opcional (até 800 caracteres/12 linhas), focus opcional (trecho exato de code a destacar, até 100 caracteres), value opcional (número, contador animado).
- Estado também aceita rows (1–8 objetos label/result, match e muted booleanos opcionais), chips (até 12 strings/números/null), table (headers com 1–4 colunas, rows com 1–8 linhas).
- O motor faz fade, entrada escalonada e contador. Não programe timelines próprias.

\`\`\`interactive
{"type":"steps","title":"Resolver de dentro para fora","states":[{"label":"Consulta interna","text":"Calcule a média primeiro.","code":"SELECT AVG(valor) FROM pedidos;","focus":"AVG(valor)","value":143.33},{"label":"Comparação externa","text":"Apenas o pedido de 200 supera a média.","rows":[{"label":"Pedido 3","result":"200 > 143,33","match":true}]}]}
\`\`\`

\`\`\`interactive
{"type":"compare","title":"O total depende da ordem","states":[{"label":"Juntar antes","text":"O pedido repetido infla a soma.","value":360,"chips":[130,130,100]},{"label":"Resumir antes","text":"Cada pedido conta uma vez.","value":230,"chips":[130,100]}]}
\`\`\`

BARRAS COM CÁLCULO REAL
- bars: values (1–12 números não negativos até 1000000), labels correspondentes. mode:"filter" (padrão) ou "aggregate".
- references: até 6 referências, cada uma AVG/MAX/MIN/SUM/COUNT ou número não negativo. operators: subconjunto de >, >=, <, <=, =.
- extra opcional: {label,value}, para incluir/remover um novo dado. O motor recalcula referências, move a linha, destaca barras e anima o contador; a linha pontilhada mostra a referência anterior.
- Não calcule alturas em pixels nem copie médias arredondadas como referência numérica: use AVG.

\`\`\`interactive
{"type":"bars","title":"A média acompanha os dados","values":[130,100,200],"labels":["Pedido 1","Pedido 2","Pedido 3"],"references":["AVG","MAX",130],"operators":[">",">=","="],"extra":{"label":"Pedido 4","value":300}}
\`\`\`

VARREDURA
- scan: rows (1–8 objetos label/result/match, key opcional) e chips opcionais. key liga uma linha aos chips com o mesmo texto.
- variants opcional (1–4 objetos label/stopAtMatch). stopAtMatch:true interrompe a varredura no primeiro match; false visita todas as linhas. O contador mostra linhas visitadas, não resultados positivos.
- match/result são fornecidos pela aula, não calculados por um executor SQL. A reprodução é um modelo didático, não uma medição do otimizador.

\`\`\`interactive
{"type":"scan","title":"Encontrar um ou contar todos","rows":[{"label":"Pedido 1","result":"Pago","match":true},{"label":"Pedido 2","result":"Pago","match":true}],"variants":[{"label":"EXISTS","stopAtMatch":true},{"label":"COUNT","stopAtMatch":false}]}
\`\`\`

AGRUPAMENTO
- group: items (1–12 objetos label/group/value, até 4 grupos). O motor move os itens, soma valores por grupo e anima os totais. Não forneça totais pré-calculados.

\`\`\`interactive
{"type":"group","title":"Separar antes de somar","items":[{"label":"Pedido 1","group":"Ana","value":130},{"label":"Pedido 2","group":"Ana","value":100},{"label":"Pedido 3","group":"Bruno","value":200}]}
\`\`\`

REFERÊNCIAS CONTEXTUAIS
- reference: code (até 800 caracteres/12 linhas), tables (1–4 objetos term/headers/rows). term é identificador simples único (começa com letra/underscore; depois letras/dígitos/underscore, até 40 caracteres).
- Ao apontar ou focar o termo no código, o motor mostra a tabela. Escape fecha. scope:"deck" também anota ocorrências em outros blocos de código da aula; padrão é apenas o widget.
- Tabelas: 1–4 headers, 1–8 rows, cada linha com a mesma quantidade de células. Células são strings, números ou null.

\`\`\`interactive
{"type":"reference","title":"Dados à mão","scope":"deck","code":"SELECT nome FROM clientes;","tables":[{"term":"clientes","headers":["id","nome"],"rows":[[1,"Ana"],[2,"Bruno"]]}]}
\`\`\`

MIGRAÇÃO FIEL, SOMENTE QUANDO NECESSÁRIA
- scene permite preservar falas e controles existentes, sem scripts: title, initial (id), align (left/center), layout (ordem dos campos) e frames (1–64 quadros). Prefira o catálogo simples para aulas novas.
- Cada quadro tem id e buttons (até 8 objetos label/to, selected/disabled/row opcionais) e conteúdo opcional: intro/text (textRuns {text,strong?,tone?}), value (valuePrefix e valueTone success/danger), code (até 800 caracteres/12 linhas) com focus (trecho exato até 100 caracteres)/codeHidden, rows (label/result opcional, active/muted/tone), chips/hits, chart {values,matches,maximum,lines} (sem campo type), groups {name,items,total} e cells {columns,values}; next:{to,delay} permite sequência automática limitada a 30 segundos, sem ciclos. Destinos devem existir. JSON até 64000 caracteres. Resultados são declarados pelo autor, não calculados por SQL.
\`\`\`interactive
{"type":"scene","title":"Comparar as duas ordens","initial":"juntar","layout":["value","buttons","text"],"frames":[{"id":"juntar","value":"360","valueTone":"danger","text":"Juntar antes de somar: o pedido 1 entrou duas vezes.","buttons":[{"label":"Resumir antes de juntar","to":"resumir"}]},{"id":"resumir","value":"230","valueTone":"success","text":"Cada pedido entrou uma vez.","buttons":[{"label":"Repetir comparação","to":"juntar"}]}]}
\`\`\`

- Limites de scene: id único com letras/dígitos/underscore/hífen (1–40); layout sem repetições, apenas intro/rows/value/buttons/text/chart/code/chips/groups/cells. Campos fora do layout não aparecem: inclua cada conteúdo e os buttons que devem ficar visíveis.
- Buttons: label (1–100), to existente, selected/disabled booleanos, row inteiro 0–3. Todo quadro exige buttons (pode ser []). next.delay entre 0 e 10000 ms, soma por cadeia até 30000 ms.
- intro/text/value/valuePrefix são strings até 400 caracteres; value não é número. textRuns (até 24) deve concatenar para text. valueTone e tone: success/danger.
- rows: até 8 objetos com label obrigatório (até 100), result opcional (string até 100; apelido value aceito, mas sem conflito com result), active/muted booleanos e tone success/danger.
- chart: values (até 12 números entre 0 e maximum), maximum (1–1000000); matches opcional (booleanos, mesmo tamanho de values); lines opcional (até 6 objetos label/value/previous, valor entre 0 e maximum). Não use type dentro do chart.
- chips: até 12 strings de até 100 caracteres; hits são índices válidos dos chips do mesmo quadro. groups: até 4 objetos name (até 60), items (até 12 strings até 100) e total (string até 100). cells: columns inteiro 1–4, values até 32 strings até 100.
- Exemplo de linhas e gráfico (result é texto; linhas de referência nunca ultrapassam maximum):
\`\`\`interactive
{"type":"scene","title":"Somar pedidos","initial":"dados","layout":["rows","chart","value","buttons"],"frames":[{"id":"dados","rows":[{"label":"Ana","result":"230"},{"label":"Bruno","result":"200"}],"chart":{"values":[130,100,200],"maximum":250,"lines":[{"label":"Subtotal Ana","value":230}]},"value":"430","valueTone":"success","buttons":[]}]}
\`\`\`

- reference com scope deck aceita annotationOnly:true para anotar código sem acrescentar conteúdo visível ou slide.

GABARITOS E COMPATIBILIDADE
- Gabaritos: HTML nativo <details class="gab"><summary>Ver gabarito</summary> ... </details>, com linhas em branco ao redor do Markdown interno. name compartilhado cria um acordeão. Não copie CSS/JS.
- steps/compare expõem estados na impressão; os demais usam snapshots de dados. scene imprime o quadro inicial, não todos os caminhos. Manter curtos. PPTX é textual, não interativo.
- Os controles são botões: não instrua o aluno a arrastar itens, digitar SQL ou editar dados quando esses controles não existem. Não repita cálculos no texto sem conferi-los com os dados do componente.
- Movimento reduzido desliga animações; navegação/reinício/edição cancelam reprodução e efeitos anteriores.
- Font Awesome :fas-nome:/:far-nome:/:fab-nome: e Lucide :lucide-nome: acompanham texto. Sem emojis.
- Colunas já disponíveis: cols-2/cols-3/cols-4, grid com col-1..col-12, grid-auto, gap-sm/gap-lg, items-center/items-end. KaTeX, Mermaid e código com linguagem continuam disponíveis.
- GSAP 3.12.5 já vem carregado (NÃO IMPORTAR). O catálogo nativo não depende dele. Scripts legados seguem suportados, mas não devem reproduzir componentes já disponíveis.
`;
