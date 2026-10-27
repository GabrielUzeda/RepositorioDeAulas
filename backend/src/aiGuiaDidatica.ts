export const GUIA_DIDATICO = `PRINCÍPIOS DIDÁTICOS:
- Frases curtas, voz ativa, uma ideia por frase. Linguagem simples; defina todo termo técnico na primeira vez que aparecer. Tom formal e acessível, sem gírias.
- Nunca use emojis, rótulos de nível nem títulos com prefixo e dois pontos ("Dica:", "Atenção:", "Armadilha comum:", "Exemplo:"). Títulos são temáticos e naturais. Única exceção: "## Analogia: <Nome do Enredo>".
- Do concreto ao abstrato: comece por uma situação real com dados específicos e personagens contínuos; só depois nomeie e formalize o conceito. Cada conceito responde a uma limitação da etapa anterior (problema, limitação, comando, resultado).
- Um conceito novo por slide. Cada slide só usa o que já foi apresentado.
- Mostre o erro comum e, logo depois, a correção, com títulos naturais (ex.: "## O erro de esquecer o ON").
- Atividades ficam distribuídas: cada seção termina com um slide "## Desafio NN" (apenas o número, sem dois pontos, sem marcas de tempo).`;

export const CONTRATO_RENDERER = `RECURSOS DO MOTOR (Marp Next) - use apenas o que existe, e só quando ajudar a didática:
- Markdown padrão, tabelas (até 4 colunas), KaTeX ($...$ e $$...$$ em bloco próprio), código com linguagem (\`\`\`sql, \`\`\`python), diagramas \`\`\`mermaid (flowchart, erDiagram, sequenceDiagram, mindmap, stateDiagram), ícones Font Awesome :fas-nome: (ou :far-nome:/:fab-nome:) e Lucide :lucide-nome:, e divs HTML com <style>/<script> escopados.
- Interativos nativos: fence interactive com JSON e title. Tipos steps/compare (estados visuais com código, linhas, tabelas e contadores), bars (cálculos/agregações), scan (varredura), group (agrupamento animado), reference (tooltips de tabelas). O motor fornece os controles; não escreva scripts/CSS para esses recursos. Consulte os exemplos da skill de redação.
- Layout em colunas (já disponível no tema, NUNCA copie CSS para o Markdown): envolva o conteúdo em <div class="cols-2">, <div class="cols-3"> ou <div class="cols-4"> com um <div> por coluna; use <div class="grid"> com <div class="col-N"> (N de 1 a 12) para larguras assimétricas e <div class="grid-auto"> para colunas iguais automáticas. Ajustes opcionais: class="gap-sm"/"gap-lg" e class="items-center"/"items-end".
- Colunas só quando a comparação lado a lado ensina melhor que a sequência vertical (duas tabelas, código antes/depois, conceito versus exemplo). O título "##" fica FORA do bloco de colunas, no máximo um bloco de colunas por slide, no máximo 2 colunas de texto corrido (cols-3/cols-4 só com itens curtos: cartões, tabelas pequenas, listas de uma linha) e cada coluna respeita o limite vertical.
- Todo slide é separado por uma linha com apenas \`---\`. Todo título "##" abre um slide novo e exige \`---\` antes (exceto o primeiro da seção).
- LIMITE VERTICAL: slide 16:9 com pouca altura; o excesso é cortado. No máximo 8 linhas de texto fora o título, 6 itens de lista, 4 linhas de tabela, 12 linhas de código e um único bloco pesado (código, tabela, diagrama ou interativo). Se não couber, divida em dois slides.
- Sem emojis, sem imagens, sem front-matter por slide.`;
