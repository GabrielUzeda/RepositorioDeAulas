export const GUIA_DIDATICO = `PRINCÍPIOS DIDÁTICOS (valem para toda a aula):

LINGUAGEM
- Frases curtas e diretas, na voz ativa. Uma ideia por frase.
- Linguagem simples e cotidiana. Explique todo termo técnico na primeira vez que aparecer, com uma definição de uma frase.
- Tom formal e acessível. Não infantilize, não use gírias nem humor forçado.
- Nunca use emojis. Não use rótulos de nível ("iniciante", "intermediário", "avançado") nem chamadas mecânicas ("Dica:", "Atenção:", "Regra de Ouro:").

PROGRESSÃO (do concreto ao abstrato)
- A aula é uma construção linear e acumulativa: cada slide só pode usar o que já foi apresentado antes, nesta aula ou nas aulas de referência.
- Comece pelo concreto: uma situação real, um problema visível, um exemplo que o aluno reconhece. Só depois nomeie e formalize o conceito.
- Um conceito novo por slide. Nunca comprima dois conceitos distintos no mesmo slide; se o texto crescer, divida em dois slides.
- Encadeie: abra a aula retomando em uma frase o pré-requisito das aulas anteriores; cada bloco deve se apoiar explicitamente no anterior.
- Nunca mencione um termo técnico antes de explicá-lo.

DENSIDADE E LIMITE VERTICAL
- O slide é paisagem e tem pouca altura útil. O que passa do rodapé é cortado na apresentação, sem aviso.
- Cada slide tem um único foco visual e no máximo 8 linhas de texto visível (fora o título), 6 itens de lista e 4 linhas de tabela.
- No máximo um bloco pesado por slide: um trecho de código, uma tabela ou um diagrama. Nunca dois deles no mesmo slide.
- Blocos de código com no máximo 12 linhas; tabelas com no máximo 4 colunas.
- Se o slide tem título, parágrafo, lista, código e tabela ao mesmo tempo, ele está cheio demais: divida em dois slides.
- Na dúvida entre um slide denso e dois slides curtos, escolha dois slides curtos.

NARRATIVA E ANALOGIA
- Use uma analogia concreta e memorável como fio condutor de cada bloco (ex.: um formulário, um restaurante, uma biblioteca) e retome-a ao longo da explicação.
- A analogia serve para traduzir o abstrato, não para decorar: depois de usá-la, formalize o conceito com o vocabulário correto.
- Explique por que o conceito existe (qual problema ele resolve) antes de mostrar como se escreve.

EXEMPLOS
- Exemplos mínimos, completos e corretos: o menor código ou caso que demonstra o conceito, pronto para rodar.
- Todo exemplo de código vem com uma frase dizendo o que ele faz e o resultado esperado.
- Um exemplo novo por conceito. Não reutilize o mesmo exemplo para tudo.
- Erros comuns: mostre a armadilha e a correção, sem alarmismo.

CONSISTÊNCIA
- Use sempre o mesmo nome para o mesmo elemento ao longo de toda a aula.
- Não repita explicações já dadas; quando precisar retomar, faça em uma frase e siga adiante.
- Mantenha o mesmo nível de detalhe e o mesmo tom em todas as seções.

INCLUSÃO (TEA/TDAH)
- Instruções diretas, sem ambiguidade, ironia ou linguagem figurada em procedimentos.
- Passo a passo numerado para processos; um foco visual por slide.
- Controle a carga cognitiva: menos texto por slide, mais estrutura (listas, tabelas, diagramas) quando ajudar.
- Antecipe o percurso: diga o que será visto e onde se está ("Agora vamos ver...").

FECHAMENTO
- Toda aula termina conectando o conceito à prática real e sinalizando o que vem a seguir.`;

export const CONTRATO_RENDERER = `RECURSOS DO MOTOR (Marp Next) - use apenas o que existe:
- Markdown padrão: títulos, listas, negrito, itálico, tabelas, citações.
- Matemática com KaTeX: $...$ inline e $$...$$ em bloco próprio.
- Código: blocos com linguagem (ex.: \`\`\`python) e código inline.
- Diagramas Mermaid em blocos \`\`\`mermaid. Tipos permitidos: flowchart, graph, sequenceDiagram, classDiagram, stateDiagram, erDiagram, pie, gantt, mindmap, timeline. O slide é paisagem e tem pouca altura: prefira diagramas largos e baixos (ex.: flowchart LR).
- Ícones Lucide: <i data-lucide="nome-do-icone"></i> (kebab-case), no máximo um por item e sempre acompanhado de texto.
- HTML cru com variáveis de tema: use var(--text-primary), var(--text-secondary), var(--slide-bg), var(--border) para funcionar no claro e no escuro. Feche todas as tags HTML dentro do mesmo slide.
- Separe TODOS os slides com uma linha contendo apenas \`---\` (três hífens). Todo título de nível 1 ou 2 inicia um slide novo e exige o \`---\` na linha anterior. Sem esse separador, dois slides viram um só e o conteúdo estoura a altura do slide.
- NÃO use: imagens de fundo ou redimensionadas (![bg], ![w:...]), listas com aparição item a item, front-matter por slide, bloco de estilo, nem recursos de outras versões do Marp. Não use emojis.`;

export const ESTRUTURA_AULA = `ARCO DA AULA (início, meio e fim):
- INÍCIO: gancho concreto (situação ou problema real), objetivos de aprendizagem e retomada curta do pré-requisito.
- MEIO: blocos conceituais em progressão do concreto ao abstrato, cada bloco com sua analogia/exemplo e um conceito por slide.
- FIM: síntese do percurso, perguntas de fixação e material complementar.

O sistema já gera a capa, a síntese, as perguntas de fixação e o material complementar. O redator de seções NÃO deve criar slides com esses títulos.`;
