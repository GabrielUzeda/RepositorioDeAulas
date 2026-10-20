---
name: marp-slides-colunas
description: Monta, revisa ou converte aulas em Markdown Marp Next usando o layout em colunas do motor do RepositorioDeAulas (cols-2, cols-3, cols-4, grid com col-N, grid-auto, gap-sm/gap-lg, items-center/items-end). Use sempre que um slide precisar comparar conteúdo lado a lado (tabelas, código antes/depois, conceito versus exemplo, cartões) ou quando o usuário pedir slides com colunas/grid.
---

# Slides Marp Next com colunas

O motor de MD → slides do projeto (backend `src/marp.ts` + tema `marpTheme.css`, espelhado em `frontend/src/shared/marpTheme.css`) já traz as classes de layout abaixo. Elas funcionam no HTML standalone, na prévia do editor, no apresentar e no export.

**Nunca cole o bloco `<style>` dentro do Markdown.** O CSS é do tema; repetir o estilo no conteúdo duplica regras, escapa do escopo `.slide-content` e polui a aula.

## Quando usar colunas

Use somente quando a comparação lado a lado ensinar melhor que a leitura vertical:

- duas tabelas ou dois conjuntos de dados (ex.: `clientes` × `pedidos`);
- código antes/depois ou errado/correto;
- conceito versus exemplo, prós versus contras, passo A versus passo B;
- cartões curtos de resumo (3 ou 4 itens de uma linha cada).

Não use colunas para texto corrido longo, para esconder excesso de conteúdo ou para contornar o limite vertical. Se não couber, divida em dois slides.

## Classes disponíveis

| Classe | Efeito |
|---|---|
| `cols-2` / `cols-3` / `cols-4` | Colunas iguais (2, 3 ou 4). Use `cols-2` para texto/tabelas; `cols-3`/`cols-4` só para itens curtos. |
| `grid` | Grade de 12 colunas; cada filho declara `col-1` … `col-12`. |
| `grid-auto` | Colunas iguais automáticas, uma por filho direto. |
| `col-1` … `col-12` | Largura do filho dentro de `.grid` (span). |
| `gap-sm` / `gap-lg` | Espaçamento menor (≈0,8rem) ou maior (≈2,4rem). Padrão ≈1,5rem. |
| `items-center` / `items-end` | Alinhamento vertical dos filhos (padrão: topo). |

As classes vivem em `.slide-content`, então valem apenas dentro do slide — não afetam a interface do app.

## Estrutura correta

O `##` do slide fica **fora** do bloco de colunas. Cada coluna é um `<div>`. HTML e Markdown podem se misturar: títulos `###`, listas, tabelas, código e Mermaid dentro de uma coluna continuam sendo renderizados.

```markdown
## Os dados que vamos usar
<div class="grid gap-sm">
<div class="col-5">

### clientes
| id | nome |
| --- | --- |
| 1 | Ana |
| 2 | Bruno |
</div>
<div class="col-7">

### pedidos
| id | id_cliente | valor |
| --- | --- | --- |
| 1 | 1 | 130 |
| 2 | 2 | 200 |
</div>
</div>
```

````markdown
## O mesmo problema, dois caminhos
<div class="cols-2">
<div>

**Com IN**
```sql
SELECT nome FROM clientes
WHERE id IN (SELECT id_cliente FROM pedidos);
```
</div>
<div>

**Com EXISTS**
```sql
SELECT cli.nome FROM clientes cli
WHERE EXISTS (
  SELECT 1 FROM pedidos ped
  WHERE ped.id_cliente = cli.id
);
```
</div>
</div>
````

## Regras de composição

1. **Um bloco de colunas por slide**, no máximo. O resto do slide continua fora dele.
2. **No máximo 2 colunas de texto corrido.** `cols-3`/`cols-4` aceitam apenas cartões, tabelas pequenas e listas de uma linha.
3. **Respeite o limite vertical**: até 8 linhas de texto fora o título, 6 itens de lista, 4 linhas de tabela e 12 linhas de código no total do slide. Em colunas, o orçamento é dividido: cada coluna deve caber sozinha.
4. **Tabelas em colunas ficam compactas** automaticamente (fonte menor). Evite mais de 4 colunas de tabela.
5. **Use colunas curtas e simétricas**: se uma coluna tem 2 linhas e a outra 10, a comparação perde o sentido — divida em dois slides ou reequilibre o conteúdo.
6. **Sempre feche as tags** `<div>` dentro do mesmo slide. Tag aberta engole os slides seguintes na renderização.
7. **Sem CSS embutido, sem emojis, sem front-matter por slide.** Cores vêm dos tokens do tema; não invente estilos inline.
8. **Não coloque o título do slide dentro de uma coluna**: o `##` precisa vir antes de `<div class="...">`.

## Como validar

- Renderize a aula (`POST /marp/render` ou a prévia do editor) e confira que as colunas aparecem lado a lado e que nenhum texto foi cortado na base do slide.
- Confirme que o Markdown gerado mantém cada `<div>` de coluna fechado e que cada slide tem seu `---`.
- No código, o layout é definido em `backend/src/marpTheme.css` e `frontend/src/shared/marpTheme.css`; os dois arquivos devem permanecer **byte a byte idênticos**. As mesmas regras estão descritas no `CONTRATO_RENDERER` de `backend/src/aiGuiaDidatica.ts`, usado pelo gerador de aulas por IA.
