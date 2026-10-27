# Cobertura de examplo.md pelo motor

A fonte original foi preservada em `examplo-original.md` neste diretório. O `examplo.md` da raiz agora é a migração fiel com cenas nativas (ver seção abaixo). A versão `subconsultas-modular.md` conserva a aula e substitui os 18 widgets por componentes declarativos; adiciona uma referência contextual de tabelas (19 componentes). Não contém style/script do conteúdo nem dependência window.subq.

Não é uma reprodução pixel a pixel. A aparência usa o tema nativo e os tempos de animação são padronizados. A migração preserva as intenções pedagógicas, não toda implementação particular do exemplo.

## Migração fiel com cenas nativas

`examplo.md` na raiz preserva frases, exemplos, SQL, ordem dos 47 slides e classes de colunas. Substitui somente os 18 widgets por `scene` e a referência contextual por `reference` com `annotationOnly:true`, sem slide adicional. Não contém scripts ou estilos da aula. Os 129 quadros de referência foram capturados do original em Chromium e estão em `examplo-cenas.json`, com textos visíveis, rótulos e destinos dos botões.

- `backend/eval/migrarExemploFiel.ts` aplica apenas os tons visuais de `valueTone` (por id do widget original) antes de reconstruir `examplo.md` e gera `backend/eval/output/fiel/aula.html`; `--check` valida que o arquivo continua idêntico à migração reproduzível.
- `e2e/capturar-exemplo-fiel.mjs`: lê `original.html` da pasta de saída, captura os 18 widgets e salva `cenas-capturadas.json`. A captura é offline e usa movimento reduzido para isolar quadros didáticos de interpolações de animação.
- `e2e/verificar-exemplo-fiel.mjs`: compara o original renderizado com o resultado, incluindo texto estático, SQL, títulos, ordem e colunas; mede 129 quadros e exercita 117 ações, sem cortes nos widgets em 1280×720.
- `e2e/tests/aula-exemplo-fiel.spec.ts`: verifica a aula inteira na prévia e no standalone, descarte ao editar, teclado/foco, contador e pausa/retomada ao navegar. O Compose monta `examplo.md` somente para leitura.
- A aparência e as animações são do tema/runtime nativo; não há promessa de equivalência pixel a pixel nem de cada interpolação da biblioteca antiga. Resultados e falas são preservados, não recalculados por SQL.
- Movimento das cenas: ao trocar de quadro, barras crescem da linha de base anterior (e do zero na primeira pintura ou ao repetir o mesmo quadro), chips destacados trocam de cor em transição, chips que mudam de montinho voam da posição antiga, itens novos entram com escala e linhas de comparação ganham fundo de resultado.
- Referência visual: superfície neutra, barras preenchidas com destaque, chips de destaque com contraste forte, montinhos tracejados e controles separados por margem própria (o botão não invade a caixa).
- Varredura usa fundo âmbar e borda âmbar, sem contorno extra que dispute com a animação; resultado positivo/negativo aparece em verde/vermelho tanto no texto da linha quanto na mensagem.
- `valueTone` (opcional) colore o contador: no slide 36 o total inflado fica vermelho e o correto verde, sem alterar as frases.
- Tabela (`cells`) entra com as células aparecendo em sequência; repetir o mesmo quadro reanima.
- Impressão de scene usa o quadro inicial, não todos os caminhos; PPTX permanece textual.

A versão `subconsultas-modular.md` abaixo é a primeira conversão didática: seus rótulos genéricos e seu slide extra não são a migração fiel.

## Mapa completo

| Função original | Instâncias | Recurso nativo | Comportamento |
|---|---|---|---|
| caderno | subq-cad | steps + value/rows | Soma parcial, média, comparação e reprodução guiada |
| live | subq-live | bars + extra | Novo dado, recálculo, linha móvel e referência anterior |
| nested | subq-nest | steps + code/focus | Destaque da interna, substituição e resultado externo |
| bars | subq-ex1 | bars | Comparação com média e destaque das barras |
| fn | subq-fn | bars, mode aggregate | AVG/MAX/MIN/SUM/COUNT e contador |
| lab | subq-lab | bars + references/operators | Referência selecionável, operadores e atualização visual |
| scan | subq-scan-in/notin/ex | scan + rows/chips | Varredura, vínculo de chips, resultado e visitas |
| nul | subq-nul | compare + chips/rows | Cenários sem/com NULL e destaque de resultado |
| parou | subq-parou | scan + variants | Parada no primeiro match versus visita de todas as linhas |
| vezes | subq-vezes | steps + value/rows | Contador do modelo conceitual e linhas correspondentes |
| forma | subq-forma | compare + table | Valor, lista e tabela |
| montinhos | subq-pile | group | Movimento de chips, soma por grupo, reprodução/pausa/reset |
| join | subq-join | compare + rows/muted | Inclusão e exclusão da linha sem par |
| coal | subq-coal | compare + rows | Troca do NULL por zero |
| ord | subq-ord | compare + value/chips | Contador animado e evidência da duplicação |
| traduz | subq-traduz | compare + collapse/code | Pergunta, SQL correspondente, abrir/fechar |
| Tooltip global | clientes/pedidos no código | reference, scope deck | Foco/hover, Escape, posição relativa ao slide e reanotação escopada |
| Gabaritos | details.gab | Tema + HTML nativo | Acordeão por name, teclado e abertura/restauração na impressão |

## Infraestrutura de movimento

- Web Animations API: fade, deslocamento curto, entrada escalonada e movimento dos itens entre grupos.
- requestAnimationFrame: contadores com cancelamento da atualização anterior.
- CSS: alturas das barras, linha de referência móvel e estados semânticos.
- Reprodução com pausa, próximo e reset; cancelamento ao navegar, ocultar aba, editar ou desmontar.
- prefers-reduced-motion elimina movimento sem eliminar controles.
- Não depende de GSAP/CDNs. A dependência legada continua disponível para aulas antigas.
- Tooltip observa apenas blocos de código, não document.body; observadores/listeners são descartados.

## Testes reproduzíveis

Executar Bun, builds e Playwright via Docker.

1. `bun run eval/modularizarExemplo.ts`, em backend: lê a fonte preservada em referencias/examplo-original.md; valida e gera a versão modular e HTML em eval/output/subconsultas-modular.
2. `bun test`: valida os 19 contratos, cálculos, operadores, limites, escape e paridade de fontes.
3. `e2e/tests/aula-catalogo-completo.spec.ts`: interage com os 19 componentes na prévia e standalone; testa animação, movimento reduzido, impressão, tooltip fora do widget e descarte.
4. `node verificar-catalogo.mjs /artifacts/subconsultas-modular/aula.html`, no container Playwright (workdir e2e): interage, mede estados em 1280×720 e salva screenshots/relatório.
5. `bun run eval/testarCatalogo.ts --live`: custa tokens; banco de teste, via direta, seis tipos, sem salvar aulas. O resultado estrutural é separado da verificação de navegador. O verificador também aceita o HTML gerado em output/catalogo-direta.

## Resultado da verificação real

- Versão modular: 19 componentes, interação e estados medidos sem corte em 1280×720.
- Primeiro teste da via direta: seis tipos válidos após dois reparos, mas texto externo excessivo cortou alguns slides.
- Corrigida a contradição do prompt direto (exigência de 10–25 linhas contra o limite vertical do motor).
- Segundo teste: seis componentes válidos em uma chamada, sem reparos; interação e layout medidos passaram. Porém gerou uma capa extra: o teste estrito de exatamente seis slides permaneceu reprovado. Não ocultar esse resultado.
- A validação de contrato não valida a verdade do texto. A geração real ainda trouxe inconsistências conceituais/dados (por exemplo, citar SUM no texto de um AVG). Exige revisão pedagógica; não está liberada como aula pronta.

## Limites conhecidos

- Barras aceitam apenas valores não negativos. Agrupamento e contadores aceitam negativos.
- Scan apresenta matches/resultados fornecidos pelo autor; não executa SQL ou mede plano físico.
- Agrupamento é acionado pelos botões, não drag-and-drop do aluno.
- Impressão usa estados/snapshots estáticos; slides muito longos ainda podem estourar uma página.
- PPTX permanece textual e pode omitir estados ocultos; não foi convertido em apresentação interativa.
- A validação do save para Markdown/JS legado continua pendente; os componentes novos não tornam scripts antigos seguros.
