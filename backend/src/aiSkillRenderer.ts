export const SKILL_RECURSOS_RENDER = `SKILL: RECURSOS INTERATIVOS E ILUSTRAÇÃO (Marp Next)

ÍCONES
- Font Awesome 6.5.1 está disponível. Use os atalhos de dois-pontos, que o motor converte em <i> com a classe correta:
  :fas-nome: (solid, o mais usado), :far-nome: (regular), :fab-nome: (marcas) e :fa-nome: (solid).
  Exemplos válidos: :fas-database:, :fas-magnifying-glass:, :far-clock:, :fab-github:.
- Lucide também está disponível: :lucide-nome: (ex.: :lucide-search:, :lucide-arrow-right:).
- NUNCA escreva a classe HTML crua dentro do atalho: ':fa-solid fa-nome:' não é convertido e aparece como texto literal na aula.
- Ícone acompanha uma palavra (antes do rótulo); não substitui texto e não serve de botão.
- Emojis continuam proibidos em qualquer lugar.

GSAP (JÁ DISPONÍVEL - NÃO IMPORTAR)
- O GSAP 3.12.5 já vem carregado pelo motor (no <head> do HTML final e na prévia do editor). NUNCA adicione <script src="...gsap..."> no Markdown; apenas use gsap.
- Estrutura de um interativo, no MESMO slide: primeiro um <div> com id único, depois o <script>. O script roda quando o slide é renderizado, então o markup precisa existir antes dele.
- Abra o script com uma guarda para não duplicar ao re-renderizar:
  var s=document.getElementById('id-unico');if(!s||s.dataset.init)return;s.dataset.init='1';
- Proteja a animação com if (window.gsap) e deixe um estado final estático legível quando o GSAP não carregar (offline): o conteúdo precisa fazer sentido sem animação.
- Sequências: use uma gsap.timeline() encadeando um passo após o outro, em vez de encadear delays; use stagger para animar uma lista.
- As animações de entrada do slide já são do motor. Esta skill serve para interações internas (gráfico que cresce, contador, conferência item a item), nunca para repetir a entrada.

CSS ESCOPADO (só quando o interativo precisar)
- Um <style> pequeno, escopado pela classe raiz do próprio widget (ex.: .meu-grafico), nunca por tag global.
- Use os tokens do tema em vez de cores fixas: var(--accent), var(--accent-dim), var(--border), var(--text-primary), var(--text-muted).
- Estados semânticos: declare variáveis locais e ajuste no tema escuro.
  .meu-grafico{--g-ok:#059669;--g-no:#dc2626;--g-warn:#b45309}
  [data-theme="dark"] .meu-grafico{--g-ok:#34d399;--g-no:#f87171;--g-warn:#fbbf24}
- Respeite o limite vertical: no máximo um bloco interativo por slide.

DEMAIS RECURSOS DO MOTOR
- Colunas do tema (nunca copiar esse CSS): cols-2/cols-3/cols-4, grid com col-1..col-12, grid-auto, gap-sm/gap-lg, items-center/items-end.
- KaTeX ($...$ e $$...$$ em bloco próprio), diagramas Mermaid cercados por \`\`\`mermaid, tabelas (até 4 colunas) e código com linguagem para realce.
- Todo slide separado por --- em linha isolada; no máximo um bloco pesado (código, tabela, diagrama ou interativo) por slide.

EXEMPLO MÍNIMO (barras que crescem), tudo no mesmo slide:
<div class="meu-grafico" id="grafico-1">
<div class="mg-w"><div class="mg-b" style="height:60px"></div><div class="mg-b" style="height:30px"></div></div>
</div>
<style>
.mg-w{display:flex;align-items:flex-end;gap:18px;height:140px;border-bottom:2px solid var(--border)}
.mg-b{width:48px;background:var(--accent);border-radius:6px 6px 0 0}
</style>
<script>
(function(){
  var s=document.getElementById('grafico-1');if(!s||s.dataset.init)return;s.dataset.init='1';
  var bs=s.querySelectorAll('.mg-b');
  if(window.gsap)gsap.from(bs,{scaleY:0,transformOrigin:'50% 100%',stagger:.15,duration:.5});
})();
</script>`;
