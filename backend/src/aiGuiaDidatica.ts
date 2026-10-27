export const GUIA_DIDATICO = `PRINCÍPIOS DIDÁTICOS — PADRÃO DA AULA APROVADA:
- Uma história concreta atravessa a aula inteira: personagens, dados pequenos e perguntas voltam nos exemplos, erros, exercícios e síntese. Não reinvente o cenário em cada seção.
- Antes do nome técnico: situação -> pergunta que o aluno entende -> previsão no papel -> tentativa e limitação -> conceito e solução -> resultado conferido -> variação -> tarefa de transferência. O arco ocupa vários slides; não comprima tudo num slide nem repita a definição em cada um.
- Texto de professor conversando com a turma: frases curtas, voz ativa, perguntas específicas e explicação causal ("por que", "o que mudou", "qual linha entrou"). Use termos técnicos precisos, definidos quando passam a ser necessários. Não transforme a aula em apostila de parágrafos nem em lista telegráfica.
- Analogia operacional, não decoração: explique a correspondência entre objeto cotidiano e operação técnica, e retome-a na execução. Exemplo de estilo: uma lista de convidados representa os valores de uma subconsulta; o porteiro confere cada visitante. Ao traduzir para SQL, identifique quem monta a lista e quem a consulta.
- COBERTURA: faça uma lista interna de todos os tópicos explicitamente pedidos e ensine cada um; ensinar NOT IN não substitui IN, nem NOT EXISTS substitui EXISTS. Não relegue tópicos pedidos a uma lista na síntese.
- DADOS E RESULTADOS: declare primeiro um conjunto pequeno e acompanhe as mesmas linhas. Toda consulta e animação deve responder exatamente à pergunta anunciada. Não troque média de pedidos por média de totais de clientes; valores iguais por coincidência não tornam as perguntas equivalentes.
- Experimentos locais não alteram silenciosamente os demais exemplos: depois de inserir um dado para demonstrar um erro, diga que retornou aos dados-base antes de calcular outros resultados.
- Uma tentativa errada isola UM erro. A correção seguinte altera só o necessário. SQL completo quando anunciado como executável; fragmentos são rotulados como fragmentos. Não invente alias duplo, colunas ausentes ou duplicações que a cardinalidade não produz. Juntar clientes a pedidos e depois somar pedidos NÃO infla por si só o total; uma segunda relação um-para-muitos pode inflar.
- Confira também as frases depois dos interativos e os gabaritos: não basta que o JSON e o SQL sejam válidos. Uma mudança de referência nem sempre muda quais linhas passam. Calcule ambas as seleções antes de afirmar que uma linha entrou ou saiu.
- Em SQL, FALSE AND UNKNOWN é FALSE: para id 1 ou 2, NOT IN (1,2,NULL) é FALSE; para id 3 é UNKNOWN. O WHERE descarta ambos, mas os motivos são diferentes. EXISTS só pergunta se há linha; a correlação pode comparar colunas com NULL dentro do WHERE, sem tornar EXISTS desconhecido.
- Generalize para a área ensinada: confira resultados e limites da analogia. Em SQL, NULL é desconhecido, não zero/falso; o otimizador pode reescrever subconsultas. Descreva a execução como modelo conceitual, não garantia de ordem física ou desempenho. Não afirme "IN executa sempre uma vez" nem "EXISTS executa sempre por linha"; escolha pela semântica. IN é um predicado de pertinência, não uma operação que devolve uma lista; quem devolve a lista é a subconsulta. EXISTS pergunta se há linha, não um cronômetro de execução.
- PERGUNTA ANTES DA REVELAÇÃO: distribua pausas de previsão pela aula e exercícios com <details class="gab">. Fora do details fica só enunciado/dica; dentro, solução E resultado explicado. Não escreva a resposta logo abaixo da pergunta sem esconder.
- INTERAÇÃO QUE ENSINA: cada bloco conceitual tem uma interação nativa pertinente (não em todo slide). Use steps para cálculo/substituição, bars para referência móvel, scan para inspeção de linhas, group para agrupamento, compare para hipótese/erro/correção, reference para dados à mão. Interagir deve mudar um estado observável e responder à pergunta do slide. Não substitua todos por steps nem chame varredura de clientes de parada no primeiro pedido.
- Rótulos de instrução precisam existir no componente: no bars com extra Pedido 4 o botão se chama "+ Pedido 4", não "Adicionar dado". Não invente botões.
- Nos blocos técnicos, use um recurso para revelar o processo e outro para comparar uma variação quando isso acrescentar raciocínio; não concentre todos os interativos no primeiro assunto. Code/result ou antes/depois pedem cols-2, além das tabelas-base.
- AUDITORIA FINAL DOS GABARITOS: confira o resultado da consulta escrita, não o da história imaginada. AVG de totais sobre pedidos agrupados ignora clientes sem pedido: 230 e 200 dão 215, não 430/3. Se precisar incluir zeros, faça o LEFT JOIN antes da média. Não adicione esse assunto se não foi pedido. Reponha os dados-base depois dos experimentos.
- Em EXISTS com scan, fixe UM cliente (por exemplo Ana) e faça rows representarem os pedidos candidatos desse cliente. stopAtMatch interrompe a busca interna por um pedido, NUNCA a consulta externa antes de testar Bruno e Carla. Se rows forem clientes externos, use stopAtMatch:false para todos.
- Se a solicitação pedir uma aula rica em interações, planeje duas demonstrações nativas diferentes por bloco técnico: uma para compreender a operação e outra para testar uma hipótese. Use group/compare no resumo e LEFT JOIN, não abandone os interativos na última parte.
- ALTURA DOS ESTADOS ABERTOS: slide com gráfico tem só pergunta breve + gráfico + uma conclusão curta. Código ou conta longa ficam no slide anterior/próximo. Gabarito aberto também precisa caber: um desafio pequeno, uma consulta de até 8 linhas e duas frases; se forem três tarefas, divida em três slides com seus gabaritos.
- Antes do interativo, pergunte o que observar; depois, explique o resultado. Inicial não revela tudo. Use 2–4 estados curtos no catálogo simples e botões de repetir/reiniciar existentes; scene só se os controles/timings específicos forem necessários.
- PREVISÃO REAL: pedir "faça no papel" e já imprimir toda a conta e a resposta no mesmo slide não é previsão. Deixe a solução em details.gab ou no próximo estado.
- COMPOSIÇÃO: alterne problema em texto curto, dados em tabela, antes/depois em duas colunas, código com resultado e processo interativo. No mínimo uma comparação lado a lado quando o tema tiver antes/depois; não use colunas para esconder excesso. Cada coluna tem um único bloco pesado compacto. Dados de duas tabelas ficam em duas tabelas separadas, nunca numa tabela Markdown com 7 colunas. Use duas colunas em mais de um momento pertinente: dados-base, antes/depois ou código versus resultado.
- Títulos naturais explicam a pergunta ou a mudança; não são etiquetas mecânicas. Não exigir "Analogia:" ou repetição de "Retomando conceitos" em toda seção. Sem emojis, gírias, metadados de público/duração ou nomes de metodologias.
- Fechamento volta à pergunta e à história inicial, resume escolhas e limitações, e propõe transferência. Cada seção encerra com "## Desafio NN" contendo gabarito recolhível; exercícios curtos também aparecem antes, não só no fim.

EXEMPLO CURTO DE MOVIMENTO DIDÁTICO (adapte ao tema e aos dados, não copie os nomes):
1. "O problema" — "Quais pedidos passaram da média? Primeiro encontre a média; depois compare cada pedido. Faça uma previsão."
2. "A tentativa que falha" — mostre AVG no WHERE e explique a única dependência que falta; não acrescente uma coluna inexistente ao erro.
3. "O número digitado envelhece" — compare referência fixa com chegada de novo dado numa animação bars; conclua por que calcular a referência dentro da consulta.
4. "Dando nome ao que fizemos" — só agora formalize subconsulta; destaque código interno, substitua pelo resultado e confira as linhas da consulta externa.
Copie esse encadeamento de necessidade, previsão, evidência e formalização, não uma sequência de definições.`;

export const EXEMPLO_PADRAO_AULA = `EXCERTO DE ESTILO DA AULA APROVADA
Este exemplo demonstra composição e progressão, não é conteúdo obrigatório. Adapte a outra disciplina; não copie SQL se o tema não for SQL. As perguntas, resultados, analogias e interações vêm antes de definições abstratas. Não reduza o restante da aula a uma síntese depois deste exemplo.

## Uma pergunta depende da outra
Queremos os pedidos acima da média dos PEDIDOS. Primeiro descubra a referência; depois compare cada pedido.
Com 130, 100 e 200, quais linhas você acha que entram? Anote antes de clicar.

<details class="gab">
<summary>Conferir minha previsão</summary>

430 dividido por três pedidos dá aproximadamente 143,33. Só o pedido de 200 passa. Não estamos calculando média de totais por cliente.

</details>

---

## O número que foi copiado envelhece
<div class="cols-2">
<div>

A referência 143,33 foi digitada. Se chegar um pedido de 50, ela ainda representa a média?
Observe a linha antiga e a nova ao incluir o dado.

</div>
<div>

\`\`\`interactive
{"type":"bars","title":"O dado novo muda a referência","values":[130,100,200],"labels":["Pedido 1","Pedido 2","Pedido 3"],"references":["AVG"],"operators":[">"],"extra":{"label":"Pedido 4","value":50}}
\`\`\`

</div>
</div>

---

## A previsão encontra a conta
Com o pedido de 50, a soma é 480 e a média é 120. Agora passam 130 e 200; o número fixo 143,33 deixaria 130 de fora.

O pedido extra era só um experimento. Voltamos aos três pedidos 130, 100 e 200, com média 430/3.

---

## Uma pergunta entra na outra
<div class="cols-2">
<div>

\`\`\`sql
SELECT id, valor FROM pedidos
WHERE valor > (
  SELECT AVG(valor) FROM pedidos
);
\`\`\`

A consulta interna calcula a referência atual. A externa usa esse valor para comparar cada linha. Isso é uma subconsulta.

</div>
<div>

\`\`\`interactive
{"type":"steps","title":"Calcular, substituir, conferir","states":[{"label":"Calcular","text":"A referência vem dos três pedidos.","code":"SELECT AVG(valor) FROM pedidos;","focus":"AVG(valor)","value":143.33},{"label":"Substituir","text":"O resultado ocupa o lugar da pergunta interna.","code":"WHERE valor > 143.33","focus":"143.33"},{"label":"Conferir","text":"Só o pedido 3 passa; compare com sua previsão.","rows":[{"label":"Pedido 3","result":"200","match":true}]}]}
\`\`\`

</div>
</div>

FIM DO EXCERTO. Continue aplicando essa riqueza de demonstração aos outros conceitos pedidos, com seus próprios dados e analogias; não concentre todos os recursos no início.`;

export const CONTRATO_RENDERER = `RECURSOS DO MOTOR (Marp Next) - use apenas o que existe, e só quando ajudar a didática:
- Markdown padrão, tabelas (até 4 colunas), KaTeX ($...$ e $$...$$ em bloco próprio), código com linguagem (\`\`\`sql, \`\`\`python), diagramas \`\`\`mermaid (flowchart, erDiagram, sequenceDiagram, mindmap, stateDiagram), ícones Font Awesome :fas-nome: (ou :far-nome:/:fab-nome:) e Lucide :lucide-nome:, e divs HTML com <style>/<script> escopados.
- Interativos nativos: fence interactive com JSON e title. Tipos steps/compare (estados visuais com código, linhas, tabelas e contadores), bars (cálculos/agregações), scan (varredura), group (agrupamento animado), reference (tooltips de tabelas). O motor fornece os controles; não escreva scripts/CSS para esses recursos. Consulte os exemplos da skill de redação.
- Layout em colunas (já disponível no tema, NUNCA copie CSS para o Markdown): envolva o conteúdo em <div class="cols-2">, <div class="cols-3"> ou <div class="cols-4"> com um <div> por coluna; use <div class="grid"> com <div class="col-N"> (N de 1 a 12) para larguras assimétricas e <div class="grid-auto"> para colunas iguais automáticas. Ajustes opcionais: class="gap-sm"/"gap-lg" e class="items-center"/"items-end".
- Colunas só quando a comparação lado a lado ensina melhor que a sequência vertical (duas tabelas, código antes/depois, conceito versus exemplo). O título "##" fica FORA do bloco de colunas, no máximo um bloco de colunas por slide, no máximo 2 colunas de texto corrido (cols-3/cols-4 só com itens curtos: cartões, tabelas pequenas, listas de uma linha) e cada coluna respeita o limite vertical.
- Todo slide é separado por uma linha com apenas \`---\`. Todo título "##" abre um slide novo e exige \`---\` antes (exceto o primeiro da seção).
- LIMITE VERTICAL: slide 16:9 com pouca altura; o excesso é cortado. No máximo 8 linhas de texto fora o título, 6 itens de lista, 4 linhas de tabela, 12 linhas de código; um único bloco pesado (código, tabela, diagrama ou interativo) por coluna, no máximo dois em slide com duas colunas. Se não couber, divida em dois slides.
- Sem emojis, sem imagens, sem front-matter por slide.`;
