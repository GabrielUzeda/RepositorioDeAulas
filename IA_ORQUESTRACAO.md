# Orquestração da geração educacional por IA

## Objetivo desta primeira entrega

Aplicar os princípios de `guia_orquestrador_do_zero.md` ao backend educacional, sem instalar Pi na aplicação e sem transformar cada etapa em um agente autônomo.

A mudança preserva as rotas e os campos consumidos pelos editores. Não muda schema do banco, credenciais, provider configurado ou mecanismo de publicação/envio de e-mail. O guia original permanece inalterado.

## Responsabilidades

| Camada | Responsabilidade | Arquivo |
|---|---|---|
| Fluxo de negócio | Contexto autorizado, sequência pedagógica, persistência e resposta HTTP | `backend/src/ai.ts`, `aiAvaliacao.ts`, `aiSintese.ts` |
| Execução compartilhada | Modelo fixo, prazo, cancelamento, limites, reparos e evidência | `backend/src/aiExecucao.ts` |
| Transporte | HTTP, adapters OpenAI/Anthropic, leitura de JSON/SSE e uso informado pelo provider | `backend/src/aiProvider.ts` |
| Instruções especializadas | Prompts específicos de aula, seção, questões, avaliação e síntese | `aiAula.ts`, `aiGuiaDidatica.ts`, `aiQuestoes.ts`, `aiAvaliacao.ts`, `aiSintese.ts` |
| Validação determinística | Estrutura Marp/JSON, notas válidas, IDs do lote e correção de objetivas | Validadores de cada fluxo e `estatisticas.ts` |
| Medição | Métricas por tentativa sem conteúdo dos prompts/respostas | `backend/src/aiTelemetria.ts` |
| Eval | Mesmos serviços e prompts de produção, com fixtures sintéticas | `backend/eval/runEval.ts` |

As instruções são selecionadas pelo fluxo; não são arquivos de skills executáveis nem um catálogo de ferramentas aberto ao modelo. O RAG FTS5 existente continua sendo usado sob demanda. O redator de seções recebe também os documentos usados pelo planejador.

## Execução e limites

Uma instância de `ExecucaoAi` representa uma geração completa:

- Resolve e fixa provider, modelo e configuração no início. Usa `AI_MODEL_AULA`, `AI_MODEL_QUESTOES`, `AI_MODEL_AVALIACAO` ou `AI_MODEL_SINTESE`, quando configurados.
- Compartilha **até dois reparos** entre todas as etapas, inclusive chamadas concorrentes. Não reinicia o orçamento por seção, questão ou aluno.
- Encaminha o conteúdo anterior e os defeitos diagnosticados para o mesmo modelo.
- Não repete falhas de transporte e não troca de modelo/endereço automaticamente. A próxima execução exige ação explícita do operador/professor. Isso não controla fallback interno de um proxy externo.
- Mantém um prazo global de 15 minutos por padrão. Questões usam 9 minutos e a avaliação individual da rota `/evaluate-response`, 90 segundos. O timeout de cada chamada é limitado ao prazo restante e cobre a leitura do corpo/SSE.
- Monitora o cancelamento disponível nos jobs de aula e aborta chamadas em andamento. Os outros fluxos ainda não possuem uma interface de cancelamento na UI.
- Limita cada prompt completo, incluindo histórico de reparo, a 60.000 caracteres. Contexto excedente é rejeitado explicitamente; esse limite não é uma estimativa de tokens.
- Limita as chamadas ao trabalho esperado mais dois reparos: aula até oito; questões até três; avaliação em lote conforme quantidade de discursivas/alunos; síntese conforme lotes de oito mais reduce e reparos.

O adapter `callAi` mantém suas opções legadas para compatibilidade. **Os quatro fluxos de produção e o eval usam a nova execução, sem o fallback/retry legado.** Evite chamar `callAi` diretamente ao adicionar novos fluxos.

## Comportamento por fluxo

### Slides

Planejamento estruturado → seções sequenciais com continuidade → montagem determinística de capa/fechamento → validação final.

O limite de slides por seção entra no diagnóstico dirigido. Não há mais uma segunda camada de tentativas por seção. Os validadores verificam estrutura, não correção factual ou qualidade visual do slide renderizado.

### Perguntas

`aiGeracaoQuestoes.ts` reúne prompt, parser retrocompatível, diagnóstico e normalização. API e eval usam esse mesmo serviço. O modelo recebe os problemas concretos de quantidade, enunciado, alternativas e rubrica.

A fixture de questões objetivas usa `tipo: roleta`, pois o gerador atual trata `normal/prova` como geração discursiva. Essa escolha não altera as modalidades suportadas pelo editor.

### Avaliação

Objetivas continuam determinísticas e questões não respondidas continuam valendo zero. **Indisponibilidade, truncamento ou saída inválida da IA nunca viram nota zero.** Se uma discursiva falhar, a avaliação daquele aluno não é persistida, evitando uma média artificialmente reduzida.

Rubricas são serializadas como JSON, não como `[object Object]`. Respostas são delimitadas como dados não confiáveis tanto no caminho estruturado quanto no legado. Essa instrução não é uma garantia contra toda injeção semântica.

O lote compartilha prazo e reparos. Erros entram em `falhas`; notas anteriores/pedentes são preservadas. O update usa comparação otimista de respostas, nota e feedback, para não sobrescrever mudanças feitas enquanto a IA trabalhava. `escopo: todas` continua permitindo reavaliar notas anteriores por escolha explícita do professor; não foi introduzida uma política nova de autoria da nota.

### Síntese/feedback

Pseudonimização → lotes individuais → parecer agregado → remapeamento local.

O diagnóstico exige exatamente uma síntese por ID recebido, sem IDs estranhos/duplicados ou feedback vazio. Os pontos do parecer devem ser arrays de texto. Falha do reduce aparece em `falhas` com `id: turma`, preservando as sínteses individuais já válidas; falha total continua sendo erro HTTP.

## Evidência e contratos

Respostas bem-sucedidas de geração de aula/perguntas, avaliação individual e respostas dos lotes podem incluir o campo adicional `execucao`, com ID, tarefa, estado, chamadas, reparos, duração e tokens conhecidos. Os campos anteriores permanecem.

Estados internos: `running`, `completed`, `provider_failed`, `repair_exhausted`, `timeout`, `cancelled`, `call_limit`, `context_limit`.

`completed` significa que o ciclo de execução terminou, não aprovação pedagógica. Nos lotes, examine também `falhas`/`falhas_count`: conflitos de persistência podem existir sem falha de transporte. Para notas e conteúdo, mantenha o aceite humano previsto no fluxo atual.

Cada tentativa HTTP do orquestrador registra se a saída passou pelo diagnóstico, inclusive tentativas inválidas e erros. Dados de uso ausentes são `null`; zero informado pelo provider é preservado. Não se presume custo, cache de prompt ou processamento local por haver um proxy.

## Verificação

Gate offline, com Docker e banco descartável:

```bash
docker run --rm --network none \
  -e DATABASE_PATH=/tmp/ia-redesign-test.db \
  -v "$PWD/backend:/app" -w /app oven/bun:1 bun test
./node_modules/.bin/biome lint backend/src backend/eval
git diff --check
```

Os testes usam providers HTTP simulados. Cobrem orçamento compartilhado, concorrência, ausência de fallback/retry, cancelamento em andamento, timeout do corpo, tokens desconhecidos, diagnóstico dirigido, preservação de notas e contratos da API. Não comprovam qualidade pedagógica do modelo real nem segurança de uma rota de dados externa.

`bun run eval:ai` continua sendo **online e potencialmente pago**, separado de `bun test`. Agora usa os serviços reais dos quatro fluxos e cinco casos sintéticos. Uma falha de provider/timeout interrompe os próximos casos com `not_run`, sem trocar modelo. Fixtures inválidas e ausência de casos falham, em vez de gerar aprovação vazia. Não execute esse comando com dados reais de alunos, sem autorização da rota de dados e do custo.

## Limites e próximos passos

- Não foi acrescentado reviewer pedagógico automático; correção factual, distratores, alinhamento e justiça da rubrica ainda exigem avaliação humana/casos de referência.
- Os contadores da execução vivem em memória. Jobs existentes persistem progresso/resultado de aula, mas **não** há retomada durável com orçamento preservado após reiniciar o processo. Uma nova solicitação é uma nova geração; o ID não é uma chave de idempotência.
- Atividade, avaliação em lote e síntese continuam síncronas; os tipos declarados em `aiJobs.ts` ainda não possuem novos processors nesta entrega.
- Não houve mudanças no gate preventivo de salvar/renderizar aulas manuais, nem novos workers paralelos de redação.
- Pseudonimização não é anonimização garantida: respostas/feedbacks podem conter identificadores escritos no próprio texto. A configuração de destino, retenção e treinamento do provider continua sendo uma decisão operacional de privacidade, não algo autorizado por esta refatoração.
- Próxima etapa: medir a qualidade dos modelos em casos representativos, calibrar contexto/prazos e só então avaliar revisão pedagógica seletiva, ajustes dos prompts e retomada durável.
