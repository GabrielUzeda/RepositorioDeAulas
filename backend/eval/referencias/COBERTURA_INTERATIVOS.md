# Cobertura de examplo.md pelo motor

O arquivo original permanece intacto. A versão `subconsultas-modular.md` conserva a aula e substitui os 18 widgets por componentes declarativos; adiciona uma referência contextual de tabelas (19 componentes). Não contém style/script do conteúdo nem dependência window.subq.

Não é uma reprodução pixel a pixel. A aparência usa o tema nativo e os tempos de animação são padronizados. A migração preserva as intenções pedagógicas, não toda implementação particular do exemplo.

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

1. `bun run eval/modularizarExemplo.ts`, em backend: exige o examplo.md fornecido pelo usuário na raiz; valida e gera a versão modular e HTML em eval/output/subconsultas-modular.
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
