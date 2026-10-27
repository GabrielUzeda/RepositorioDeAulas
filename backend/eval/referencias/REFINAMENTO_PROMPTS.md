# Refinamento de prompts contra a aula aprovada

## Escopo e conclusão

Referência aprovada: `examplo.md` na raiz, renderizado em `backend/eval/output/fiel/aula.html`. Original preservado em `examplo-original.md` neste diretório.

Este trabalho ajusta instruções, exemplos e etapas de geração, não pesos do modelo. Provider/modelo das rodadas: opencode / deepseek-v4.1-flash.

Houve evolução de participação, composição e desenvolvimento conceitual. Não há aprovação de equivalência didática nem confiabilidade semântica: os resultados ainda contêm simplificações incorretas e variam entre rodadas. Contagens e ausência de cortes não são nota de qualidade.

## O que faz a referência funcionar

A referência tem 47 slides, 28 com colunas, 30 slides com perguntas, 9 gabaritos recolhíveis, 32 blocos SQL e 11 tabelas. São 18 cenas visíveis com 129 quadros; o 19º fence é uma referência contextual sem conteúdo visível.

| Característica | Evidência e intenção | Tradução para as duas vias |
|---|---|---|
| Necessidade antes do nome | O aluno resolve uma pergunta antes de conhecer a subconsulta | Situação, previsão, tentativa, limitação, solução, conferência |
| História que continua | Os mesmos clientes e pedidos sustentam os exemplos | Fio condutor e dados canônicos enviados a todas as seções |
| Pergunta com unidade definida | Pedido, cliente e grupo não são intercambiáveis | Fixar população e unidade antes de calcular médias/somas |
| Analogia operacional | Porteiro, lista, caixa e montinhos correspondem a operações | Explicar quem produz dados, quem compara e o que muda |
| Texto causal | Mostra por que a tentativa falha e qual mudança a corrige | Frases curtas com números e linhas concretas, sem slogans |
| Participação distribuída | Previsões e desafios aparecem durante o percurso | Resposta em details.gab ou próximo estado, não revelada junto da pergunta |
| Composição lateral | Dados, código e resultado se comparam lado a lado | Colunas pertinentes ao longo da aula, não só na abertura |
| Transferência | A pergunta muda, mas os dados e ferramentas são reconhecíveis | Exercícios de interpretação, diagnóstico e aplicação, com resultado conferido |
| Fechamento | Retoma a história e as escolhas, não só definições | Síntese curta, prática e referências reais |

### O papel das animações

- Calcular e substituir: soma/contador, destaque da consulta interna e substituição pelo resultado.
- Referência móvel: barras, linha anterior/nova e um dado extra mostram por que um número digitado envelhece.
- Pertinência: linhas e chips mostram a relação entre o id externo e a lista da subconsulta.
- NULL: cenários mostram a diferença entre FALSE e UNKNOWN, ambos descartados pelo WHERE.
- Existência: a busca para no primeiro pedido que casa com UM cliente fixo; isso não interrompe a consulta externa.
- Correlação: o cliente atual muda o filtro da pergunta interna.
- Formato: valor, lista e tabela têm papéis distintos.
- Agrupamento: os itens se movem e os subtotais se formam.
- Junções: ausência de par, preservação da linha e NULL para zero são mudanças diferentes.
- Referências contextuais: dados acessíveis no próprio nome da tabela evitam voltar slides.

Não exigir scene em aulas novas: os componentes simples oferecem movimentos equivalentes para muitas intenções. Scene é útil para controles e sequências específicos. JSON correto, por si só, não prova correspondência entre a explicação e o movimento.

## O que mudou no produto

- `aiGuiaDidatica.ts`: guia compartilhado e excerto concreto de previsão, barras, foco SQL e resultado.
- `aiAula.ts`: planejamento com fio_condutor/pergunta/interacao; mesmos princípios nas duas vias; retirada das quotas rígidas de slides; síntese em páginas de quatro linhas.
- `ai.ts`: capa preservada no expresso, planner compacto com até 6144 tokens e sem raciocínio adicional; seções com reasoningEffort low. Expresso permanece none, após truncamento na experiência com low.
- `slideInteractive.ts` e espelho: erros específicos em steps/compare para orientar reparos, sem afrouxar o contrato.
- `aiExecucao.ts`: cada reparo mantém pedido original, última versão e diagnóstico atual, sem acumular versões descartadas. Limites globais de chamadas, reparos, prazo e contexto continuam iguais.
- Testes conferem o repasse dos prompts, formato, capa, síntese e cálculos do excerto usando o renderer e SQLite em memória.

O excerto agora demonstra um pedido extra de 50: a média cai de 430/3 para 120, e 130 passa a entrar. Ele anuncia a volta aos três pedidos antes de reutilizar 430/3. O exemplo anterior usava 300 e não explicitava a restauração, introduzindo ambiguidade no próprio few-shot.

## Rodadas preservadas

Tema fixo próximo: subconsultas no relatório de uma cafeteria, com Dona Lúcia, Ana, Bruno e Carla e pedidos de 130, 100 e 200. Todas as saídas ficam em `backend/eval/output/aula-aprovada/<rodada>/<modo>/`, sem sobrescrever diretórios.

As observações do experimento também foram refinadas: pergunta inicial explicitada, profundidade próxima de 40 slides/9–12 demonstrações a partir de r6/r7, e escopo dos exercícios restringido em r9. Portanto isto é desenvolvimento iterativo com entrada e parâmetros evoluindo, não um A/B controlado nem prova de generalização.

| Rodada | Via | Slides | Interativos | Slides com colunas | Gabaritos | Cortes encontrados |
|---|---|---:|---:|---:|---:|---|
| baseline | direta | 33 | 0 | 2 | 2 | não medido |
| baseline | decomposta | 32 | 5 | 0 | 5 | não medido |
| r1 | direta | 28 | 5 | 1 | 6 | nenhum |
| r1 | decomposta | falhou | — | — | — | ver falha.txt |
| r2 | direta | 27 | 5 | 1 | 8 | 7 |
| r2 | decomposta | falhou | — | — | — | ver falha.txt |
| r3 | direta | 31 | 4 | 1 | 6 | nenhum |
| r3 | decomposta | 49 | 8 | 6 | 14 | 10, 26 |
| r4 | direta | 26 | 4 | 2 | 4 | nenhum |
| r4 | decomposta | 41 | 8 | 4 | 9 | 11, 23, 32, 35 |
| r5 | direta | 28 | 5 | 8 | 7 | nenhum |
| r5 | decomposta | falhou | — | — | — | ver falha.txt |
| r6 | decomposta | 35 | 8 | 11 | 10 | 28 |
| r7 | direta | falhou | — | — | — | ver falha.txt |
| r7 | decomposta | 54 | 13 | 8 | 12 | nenhum |
| r8 | direta | 40 | 6 | 6 | 13 | nenhum |
| r9 | direta | 56 | 8 | 10 | 9 | nenhum |
| r9 | decomposta | 56 | 14 | 16 | 15 | nenhum |
| r10 | direta | falhou | — | — | — | ver falha.txt |
| r10 | decomposta | 61 | 15 | 14 | 13 | nenhum |
| r11 | direta | 55 | 6 | 9 | 10 | nenhum |
| r11 | decomposta | 59 | 11 | 9 | 16 | nenhum |

Falhas preservadas:
- r1/r2 detalhado: timeout do planejamento.
- r5 detalhado: orçamento de reparos esgotado em estado inválido.
- r7 expresso: resposta truncada na experiência com reasoningEffort low.
- r10 expresso: contexto excedido após acumular versões completas nos reparos; regressão do reparo agora coberta por teste.

Marcos:
- Baseline: expresso sem interativos; detalhado sem colunas. Ambos tinham erros de SQL ou de população da média.
- r3/r4: mais interações, mas cortes em gráficos e gabaritos; houve regressões, não melhoria monotônica.
- r7 detalhado: 13 interativos e nenhum corte nos estados então medidos.
- r8 expresso: layout limpo, mas a prática final calculava uma média diferente da anunciada.
- r9: 8/14 interativos, sem cortes nas medições antigas, mas texto ainda incorreto sobre média e NULL.
- r10 detalhado: 15 interativos; verificação ampliada passou em 156 estados. Ainda houve ampliação desnecessária do conteúdo.
- r11, mesma entrada nas duas vias: 55/59 slides, 6/11 interativos, 9/9 slides com colunas, 10/16 gabaritos. Verificação ampliada passou em 89/122 estados, sem cortes ou erros de JavaScript.

Não selecionar apenas a rodada com mais componentes. O expresso ainda usa bem menos interações e colunas que a referência. O detalhado se aproxima mais da riqueza, mas gera mais slides e ainda pode repetir explicações.

## Revisão semântica: pendências reais

A r11 NÃO é uma aula aprovada. Exemplos para a próxima revisão:
- Expresso, “Por que Carla desapareceu”: generaliza que qualquer comparação com NULL torna todo NOT IN desconhecido. Ana e Bruno são FALSE; só Carla é UNKNOWN neste conjunto, como outro slide da própria aula já informa.
- Expresso, “Comparando IN e EXISTS”: volta a atribuir a montagem da lista ao IN, embora o responsável seja a subconsulta.
- Detalhado: a explicação de correlação ainda pode soar como garantia de execução física por linha; deve ser qualificada como modelo conceitual, sem contradizer o otimizador.
- Algumas saídas ainda geram referências vagas, exercícios redundantes ou conteúdo não pedido.
- Nenhuma rodada estabelece a mesma riqueza de referências contextuais e sequências da aula manual.

Acrescentar regras indefinidamente ao prompt tem retorno decrescente e pode criar contradições. A próxima etapa com maior valor é revisão semântica independente, incluindo execução dos SQLs válidos sobre os dados de cada cenário e confronto com as afirmações dos slides. Isso não está implementado como aprovação automática.

## Reprodução

Execute a partir da raiz; chamadas live consomem tokens e exigem provider configurado no ambiente do projeto.

```bash
docker run --rm -v "$PWD:/repo" -v "$PWD/.env:/.env:ro"   -w /repo/backend -e DATABASE_PATH=/tmp/aula-comparacao-test.db   oven/bun:1 bun run eval/compararAulaAprovada.ts --live --rodada=nova
```

Acrescente `--decomposta` para a via detalhada. Não reutilize o nome de uma rodada existente.

```bash
docker run --rm -v "$PWD/e2e:/app"   -v "$PWD/backend/eval/output/aula-aprovada:/out" -w /app   mcr.microsoft.com/playwright:v1.50.0-noble   node comparar-aula-aprovada.mjs /out/nova/direta/aula.html
```

Artefatos: entrada.json, prompts.json, aula.md/html, outline.json, comparacao.json ou falha.txt; browser.json e screenshots após a verificação visual. Templates de prompts de seção são reconstruídos para inspeção, não captura literal de chamadas com histórico/RAG.

O verificador de navegador usa Chromium offline, viewport 1280×720 e movimento reduzido. Percorre estados simples, referências/operadores/dado extra das barras, variantes das varreduras e gabaritos. Retorna falha por cortes, erros ou cenas cuja sequência não percorreu. Não valida semântica, toda temporização de animação, impressão, outros navegadores ou todos os pares de acordeões abertos. As cenas têm suíte E2E própria.

## Regressão final

- 367 testes de backend, com checkout completo para exemplos externos e espelhos.
- 110 testes de frontend, typecheck e build via Docker.
- Lint do gate e dos novos scripts sem erros.
- 10 E2E Chromium: migração fiel, catálogo e interativos nativos.
- Exercício do few-shot confere média, seleção e consulta SQL em teste determinístico.
