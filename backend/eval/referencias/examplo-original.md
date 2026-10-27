---
marp: true
theme: default
title: Subconsultas em Banco de Dados
description: Uma consulta dentro de outra: como calcular um valor, montar uma lista e resumir dados antes de usar no resultado final
---

# Subconsultas em Banco de Dados
## Perguntas dentro de perguntas
*Uma conversa sobre IN, NOT IN, EXISTS e NOT EXISTS*

---

## Exemplo de hoje: a lanchonete da Dona Marta

Dona Marta tem uma lanchonete de bairro e anota clientes e pedidos no computador.

<div class="grid">
<div class="col-5">

### clientes
| id | nome |
| --- | --- |
| 1 | Ana |
| 2 | Bruno |
| 3 | Carla |
</div>
<div class="col-7">

### pedidos
| id | id_cliente | valor | status |
| --- | --- | --- | --- |
| 1 | 1 | 130 | PAGO |
| 2 | 1 | 100 | PAGO |
| 3 | 2 | 200 | PAGO |
</div>
</div>

A Ana fez dois pedidos, o Bruno fez um, e a Carla ainda não pediu nada. Guarde essa história: ela volta a aula inteira.

---

## O problema: uma resposta depende da outra

Dona Marta quer saber quais pedidos ficaram **acima da média**.

Parece uma pergunta só, mas tem duas partes:

1. Qual é a média dos pedidos?
2. Quais pedidos passam dessa média?

A segunda parte **depende da primeira**. Um `SELECT` comum lê uma linha de cada vez, e a média só existe depois de olhar **todas** as linhas. Como ligar as duas partes numa consulta só?

---

## A tentativa que não funciona

A primeira ideia costuma ser esta:

```sql
SELECT id, valor
FROM pedidos
WHERE valor > AVG(valor);
```

O banco recusa, com uma mensagem parecida com *"funções de agregação não são permitidas no WHERE"*.

O `WHERE` testa cada linha isoladamente: "este valor é maior que...?". Mas para responder isso ele precisaria da média, que ainda não foi calculada, porque depende de todas as linhas. Falta uma forma de calcular o valor **antes** de comparar.

---

## Não é só a média

Dona Marta tem outras perguntas, e todas seguem o mesmo padrão:

| Pergunta | Por que um SELECT simples não basta |
| --- | --- |
| "Quem já pagou algum pedido?" | A resposta vem de outra tabela e é uma lista de clientes |
| "Quem nunca pediu nada?" | Cada cliente precisa ser conferido contra os pedidos |
| "Quanto cada cliente gastou?" | Os pedidos precisam ser resumidos antes de virar tabela |

Todas têm uma pergunta **escondida dentro** de outra. Antes de ver a solução, tente você primeiro.

---

## Pare e pense: acima da média

<div class="cols-2">
<div>

Dona Marta pergunta:

> *Quais pedidos ficaram acima do valor médio?*

Antes de clicar, **faça no papel**. Como você descobriria olhando o caderno dela?

Depois, clique e compare com o que você fez.
</div>
<div>

<div class="subq" id="subq-cad">
<div class="subq-cli" data-v="130"><span>Pedido 1 (Ana)</span><span class="subq-res">130</span></div>
<div class="subq-cli" data-v="100"><span>Pedido 2 (Ana)</span><span class="subq-res">100</span></div>
<div class="subq-cli" data-v="200"><span>Pedido 3 (Bruno)</span><span class="subq-res">200</span></div>
<p><b class="subq-big">?</b></p>
<button class="subq-btn" type="button" data-step>Passo 1: calcular a média</button>
<p class="subq-nota subq-msg"></p>
</div>
</div>
</div>

<style>
/* =============================================================
   ESTILO COMPARTILHADO — SEM ALTERAR A MARCAÇÃO DO MARKDOWN.
   Centralização exclusivamente via CSS, com títulos # e ## intactos.
   ============================================================= */
/* A capa usa o alinhamento nativo do tema Marp, sem CSS específico. */

/* Centralizar apenas frases de apresentação curtas. Nenhum elemento HTML é adicionado. */
section:nth-of-type(2) > p:first-of-type,
section:nth-of-type(5) > p:first-of-type,
section:nth-of-type(5) > p:last-of-type,
section:nth-of-type(12) > p:first-of-type,
section:nth-of-type(42) > p:first-of-type {
  max-width:65ch; margin-left:auto; margin-right:auto; text-align:center;
}

.subq {
  --sq-ok:#059669; --sq-no:#dc2626; --sq-warn:#b45309;
  --sq-focus:var(--accent); --sq-focus-ring:var(--accent-dim);
  --sq-fast:180ms; --sq-normal:300ms; --sq-slow:480ms;
  --sq-ease:cubic-bezier(.22,.65,.25,1);
  margin-top:.5em;
}
[data-theme="dark"] .subq {
  --sq-ok:#34d399; --sq-no:#f87171; --sq-warn:#fbbf24;
}
/* Widget centralizado sem necessidade de classes ou envoltórios extras. */
:is(#subq-cad,#subq-live,#subq-ex1,#subq-fn,#subq-lab,
    #subq-vezes,#subq-forma,#subq-pile,#subq-ord,#subq-traduz) > p {
  text-align:center;
}
:is(#subq-cad,#subq-live,#subq-ex1,#subq-fn,#subq-lab,
    #subq-vezes,#subq-forma,#subq-pile,#subq-ord,#subq-traduz)
:is(.subq-cli,.subq-code,.subq-sql,.subq-pile) {
  text-align:left;
}
#subq-cad > [data-step] {display:block; margin:.5em auto 0}
#subq-cad > p .subq-big {margin:.4em auto .2em}
.subq-w {
  position:relative; height:170px; display:flex; align-items:flex-end;
  justify-content:center; gap:22px; padding:0 24px;
  border-bottom:2px solid var(--border); margin:26px auto 14px;
  width:100%; max-width:540px; box-sizing:border-box;
}
.subq-b {
  width:54px; background:var(--border); border-radius:6px 6px 0 0;
  position:relative; flex:none;
  transition:background-color var(--sq-normal) var(--sq-ease);
}
.subq-b.is-ok {background:var(--sq-ok)}
.subq-b>i {
  position:absolute; top:-22px; left:0; right:0;
  text-align:center; font-style:normal; font-size:.85rem;
  color:var(--text-primary);
}
.subq-ln {position:absolute;left:0;right:0;border-top:2px dashed var(--sq-warn)}
.subq-ln.old {border-top-style:dotted;border-color:var(--text-muted)}
.subq-ln>u {
  position:absolute;right:0;top:-20px;color:var(--sq-warn);
  text-decoration:none;font-size:.8rem;white-space:nowrap;
}
.subq-ln.old>u {color:var(--text-muted);top:3px}
.subq-big {display:inline-block;font-size:1.6rem;font-weight:700;font-variant-numeric:tabular-nums;color:var(--text-primary)}
.subq-btn {
  background:var(--accent-dim);color:var(--text-primary);
  border:1px solid var(--accent);border-radius:8px;
  padding:6px 12px;cursor:pointer;font-size:.9rem;margin:.2em .3em 0 0;
  transition:background-color var(--sq-fast) var(--sq-ease),
             color var(--sq-fast) var(--sq-ease),
             border-color var(--sq-fast) var(--sq-ease);
}
.subq-btn:hover,.subq-btn.is-on {background:var(--accent);color:#fff}
.subq-btn:focus-visible {outline:2px solid var(--accent);outline-offset:2px}
.subq-btn:disabled {opacity:.5;cursor:default}
.subq-nota {color:var(--text-muted);font-size:.9rem}
.subq-sql {display:block;font-family:monospace;font-size:.85rem;white-space:pre-wrap;color:var(--text-primary);margin:.4em 0}
.subq-collapse {overflow:hidden;height:0;transition:height var(--sq-normal) var(--sq-ease)}
.subq-cli {
  display:flex;justify-content:space-between;align-items:center;gap:12px;
  border:1px solid var(--border);border-radius:10px;
  padding:8px 14px;background:var(--accent-dim);margin:6px 0;
  color:var(--text-primary);
  transition:border-color var(--sq-normal) var(--sq-ease),
             box-shadow var(--sq-normal) var(--sq-ease),
             opacity var(--sq-normal) var(--sq-ease);
}
.subq-cli.is-scan {border-color:var(--sq-focus);box-shadow:0 0 0 2px var(--sq-focus-ring)}
.subq-cli.is-gone {opacity:.36;text-decoration:line-through}
.subq-res {font-weight:700;font-variant-numeric:tabular-nums}
.subq-ok {color:var(--sq-ok)}.subq-no {color:var(--sq-no)}
.subq-chip {
  display:inline-block;min-width:2em;text-align:center;border:1px solid var(--border);
  border-radius:8px;padding:2px 10px;margin:0 6px 0 0;
  font-variant-numeric:tabular-nums;color:var(--text-primary);
  transition:background-color var(--sq-normal) var(--sq-ease),
             color var(--sq-normal) var(--sq-ease);
}
.subq-chip.is-hit {background:var(--sq-ok);color:#fff;border-color:var(--sq-ok)}
.subq-chip.is-null {border-style:dashed;border-color:var(--sq-no);color:var(--sq-no)}
.subq-code {
  font-family:monospace;font-size:.9rem;line-height:1.8;
  border:1px solid var(--border);border-radius:10px;
  padding:10px 14px;background:var(--accent-dim);color:var(--text-primary);
  transition:border-color var(--sq-normal) var(--sq-ease),
             box-shadow var(--sq-normal) var(--sq-ease);
}
.subq-code.is-out {border-color:var(--sq-focus);box-shadow:0 0 0 2px var(--sq-focus-ring)}
.subq-slot {border-radius:6px;padding:0 4px;transition:background-color var(--sq-normal) var(--sq-ease),color var(--sq-normal) var(--sq-ease)}
.subq-slot.is-in {background:var(--sq-warn);color:#fff}
.subq-slot.is-done {background:var(--sq-ok);color:#fff}
.subq-grid {display:grid;gap:6px;margin:10px auto;justify-content:center}
.subq-cell {border:1px solid var(--border);border-radius:8px;padding:6px 12px;text-align:center;background:var(--accent-dim);color:var(--text-primary);font-variant-numeric:tabular-nums}
.subq-piles {display:flex;justify-content:center;gap:16px;margin:10px 0}
.subq-pile {flex:1;border:1px dashed var(--border);border-radius:10px;padding:8px;min-height:100px;color:var(--text-primary)}
.subq-items {min-height:34px;margin:6px 0}
.subq-tot {font-weight:700;font-variant-numeric:tabular-nums}
.gab {border:1px solid var(--border);border-radius:10px;padding:6px 14px;margin:.5em 0;background:var(--accent-dim);color:var(--text-primary)}
.gab>summary {cursor:pointer;font-weight:600;list-style:none;color:var(--accent)}
.gab>summary::-webkit-details-marker {display:none}
.gab>summary::before {content:"▸  ";display:inline-block}
.gab[open]>summary::before {content:"▾  "}
.gab[open] {padding-bottom:10px}
.gab pre {font-size:.8rem;margin:.4em 0}
@media (prefers-reduced-motion: reduce) {
  .subq *, .subq *::before, .subq *::after {
    animation:none !important;transition:none !important;
  }
}
</style>

<script>
window.subq = (function () {
  'use strict';

  /* Central de configurações: todo efeito reutiliza estes tempos. */
  var MOTION = Object.freeze({
    fast: .18, normal: .30, slow: .48, stagger: .08,
    step: 650, compare: 800, scanCycle: 1180, scanReveal: 380, scanLeave: 1030
  });
  var HEIGHT_PER_UNIT = .55;
  var OP = {
    '>': function (a,b) {return a>b;}, '>=': function (a,b) {return a>=b;},
    '<': function (a,b) {return a<b;}, '<=': function (a,b) {return a<=b;},
    '=': function (a,b) {return a===b;}
  };

  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function animated() {return !!window.gsap && !reduced();}
  function average(a) {return a.reduce(function(x,y){return x+y;},0)/a.length;}
  function sum(a) {return a.reduce(function(x,y){return x+y;},0);}
  function format(v) {return v.toFixed(2).replace('.',',');}
  function mount(id) {
    var s=document.getElementById(id);
    if(!s || s.dataset.init) return null;
    s.dataset.init='1';
    return s;
  }
  function choose(s,selector,attr,value) {
    s.querySelectorAll(selector).forEach(function(b){
      b.classList.toggle('is-on',b.getAttribute(attr)===String(value));
    });
  }
  function makeSteps() {
    var timers=[];
    return {
      later: function(fn,ms) {
        timers.push(setTimeout(fn,reduced()?Math.round(ms*.45):ms));
      },
      clear: function() {timers.forEach(clearTimeout);timers=[];}
    };
  }
  function barsIn(w,values) {
    return values.map(function(value){
      var bar=document.createElement('div');
      bar.className='subq-b';
      bar.style.height=value*HEIGHT_PER_UNIT+'px';
      var caption=document.createElement('i');
      caption.textContent=value;
      bar.appendChild(caption);
      w.appendChild(bar);
      return bar;
    });
  }
  function threshold(w,extraClass,label,value) {
    var el=document.createElement('div');
    el.className='subq-ln '+(extraClass||'');
    el.style.bottom=value*HEIGHT_PER_UNIT+'px';
    var caption=document.createElement('u');
    caption.textContent=label;
    el.appendChild(caption);
    w.appendChild(el);
    return el;
  }
  function highlight(bar,good) {bar.classList.toggle('is-ok',good);}

  /* Componente de movimento: transição curta, sem bounce/elastic/zoom.
     Funciona mesmo sem GSAP e respeita a preferência por pouco movimento. */
  /* Um único componente de fade para todos os textos explicativos.
     O texto antigo sai, o novo entra; cliques rápidos cancelam a troca anterior.
     Não força animação quando o navegador solicita movimento reduzido. */
  var activeMessages = new WeakMap();
  function changeMessage(el, next, html, immediate) {
    if(!el)return;
    var previous=activeMessages.get(el);
    if(previous){
      if(previous.out)previous.out.cancel();
      if(previous.inn)previous.inn.cancel();
    }
    var state={out:null,inn:null};
    activeMessages.set(el,state);
    function set(){if(html)el.innerHTML=next;else el.textContent=next;}
    var current=html?el.innerHTML:el.textContent;
    if(immediate || reduced() || typeof el.animate!=='function' || current===next){
      set();return;
    }
    var durationOut=140, durationIn=280;
    if(!el.textContent.trim()){
      set();
      state.inn=el.animate([{opacity:0},{opacity:1}],
        {duration:durationIn,easing:'ease-out'});
      return;
    }
    state.out=el.animate([{opacity:1},{opacity:0}],
      {duration:durationOut,easing:'ease-in',fill:'forwards'});
    state.out.onfinish=function(){
      if(activeMessages.get(el)!==state)return;
      set();
      state.inn=el.animate([{opacity:0},{opacity:1}],
        {duration:durationIn,easing:'ease-out',fill:'forwards'});
      state.out.cancel();
      state.inn.onfinish=function(){
        if(activeMessages.get(el)===state)state.inn.cancel();
      };
    };
  }

  var fx = {
    message: changeMessage,
    emphasize: function(el) {
      if(!el || !animated())return;
      gsap.fromTo(el,{opacity:.72,y:5},{opacity:1,y:0,duration:MOTION.normal,
        ease:'power2.out',overwrite:true,clearProps:'opacity,transform'});
    },
    reveal: function(els) {
      if(!animated())return;
      gsap.fromTo(els,{opacity:.75,y:6},{opacity:1,y:0,
        duration:MOTION.normal,stagger:MOTION.stagger,ease:'power2.out',
        overwrite:true,clearProps:'opacity,transform'});
    },
    move: function(el,properties) {
      if(!el)return;
      if(animated()) gsap.to(el,Object.assign({duration:MOTION.slow,ease:'power2.out',overwrite:true},properties));
      else Object.keys(properties).forEach(function(k){el.style[k]=properties[k];});
    },
    count: function(state,next,onUpdate) {
      if(!animated()) {state.v=next;onUpdate(state.v);return;}
      gsap.killTweensOf(state);
      gsap.to(state,{v:next,duration:MOTION.slow,ease:'power2.out',overwrite:true,
        onUpdate:function(){onUpdate(state.v);},onComplete:function(){onUpdate(next);}});
    }
  };

  /* 1. Caderno: evidências passo a passo e reforço discreto do resultado. */
  function caderno(id) {
    var s=mount(id);if(!s)return;
    var rows=[].slice.call(s.querySelectorAll('.subq-cli'));
    var values=rows.map(function(r){return +r.dataset.v;});
    var button=s.querySelector('[data-step]'),big=s.querySelector('.subq-big');
    var msg=s.querySelector('.subq-msg'),state=0,steps=makeSteps(),mean=average(values);
    function reset() {
      steps.clear();state=0;
      rows.forEach(function(r){
        r.classList.remove('is-scan');
        var x=r.querySelector('.subq-res');x.textContent=r.dataset.v;x.className='subq-res';
      });
      big.textContent='?';fx.message(msg,'Faça no papel e depois clique.',false,true);
      button.textContent='Iniciar: calcular a média';button.disabled=false;
    }
    button.onclick=function(){
      if(state===2){reset();return;}
      button.disabled=true;
      if(state===0){
        rows.forEach(function(r,i){steps.later(function(){
          rows.forEach(function(x){x.classList.remove('is-scan');});
          r.classList.add('is-scan');
          big.textContent='soma: '+sum(values.slice(0,i+1));fx.emphasize(big);
        },i*MOTION.step);});
        steps.later(function(){
          rows.forEach(function(r){r.classList.remove('is-scan');});
          big.textContent='média: '+format(mean);fx.emphasize(big);
          fx.message(msg,'Primeira pergunta respondida.');
          button.textContent='Iniciar comparação';button.disabled=false;state=1;
        },values.length*MOTION.step+220);
      } else {
        rows.forEach(function(r,i){steps.later(function(){
          rows.forEach(function(x){x.classList.remove('is-scan');});
          var ok=values[i]>mean,x=r.querySelector('.subq-res');
          r.classList.add('is-scan');
          x.textContent=values[i]+(ok?': passa da média':': não passa');
          x.className='subq-res '+(ok?'subq-ok':'subq-no');
        },i*MOTION.compare);});
        steps.later(function(){
          rows.forEach(function(x){x.classList.remove('is-scan');});
          fx.message(msg,'Conclusão: A segunda pergunta só fez sentido depois da primeira.');
          button.textContent='Reiniciar';button.disabled=false;state=2;
        },values.length*MOTION.compare+220);
      }
    };
    reset();
  }

  /* 2. Novo pedido: a linha de referência desliza, sem efeito elástico. */
  function live(id) {
    var s=mount(id);if(!s)return;
    var w=s.querySelector('.subq-w'),cnt=s.querySelector('.subq-big');
    var msg=s.querySelector('.subq-nota'),button=s.querySelector('[data-add]');
    var values=[130,100,200],state={v:average(values)};
    barsIn(w,values);
    var extra=null,old=threshold(w,'old','143,33 (digitado)',state.v);
    var current=threshold(w,'','AVG ao vivo',state.v);
    function update(t) {fx.count(state,t,function(v){cnt.textContent=format(v);});}
    cnt.textContent=format(state.v);
    fx.message(msg,'Clique no botão para simular a chegada de um pedido.',false,true);
    button.textContent='+ chegou um pedido novo (300)';
    button.onclick=function(){
      if(!extra){
        values.push(300);var mean=average(values);
        extra=barsIn(w,[300])[0];w.insertBefore(extra,old);
        fx.reveal(extra);fx.move(current,{bottom:mean*HEIGHT_PER_UNIT+'px'});
        current.firstChild.textContent='AVG ao vivo '+format(mean);update(mean);
        fx.message(msg,'A média real agora é <b class="subq-ok">'+format(mean)+'</b>, mas a consulta digitada ainda usa <b class="subq-no">143.33</b>.',true);button.textContent='Reiniciar';
      }else{
        w.removeChild(extra);extra=null;values.pop();
        fx.move(current,{bottom:average(values)*HEIGHT_PER_UNIT+'px'});
        current.firstChild.textContent='AVG ao vivo';update(average(values));
        fx.message(msg,'Clique no botão para simular a chegada de um pedido.',false,true);
        button.textContent='+ chegou um pedido novo (300)';
      }
    };
  }

  /* 3. Execução de dentro para fora. */
  function nested(id) {
    var s=mount(id);if(!s)return;
    var code=s.querySelector('.subq-code'),slot=s.querySelector('.subq-slot');
    var msg=s.querySelector('.subq-msg'),button=s.querySelector('[data-run]');
    var original=slot.textContent,steps=makeSteps(),played=false;
    function reset() {
      steps.clear();played=false;slot.textContent=original;slot.className='subq-slot';
      code.classList.remove('is-out');
      fx.message(msg,'Clique para ver em que ordem o banco executa.',false,true);
      button.textContent='Iniciar execução';
    }
    button.onclick=function(){
      if(played){reset();return;}
      played=true;button.textContent='Reiniciar';
      steps.later(function(){slot.classList.add('is-in');fx.message(msg,'1. O banco resolve primeiro o que está dentro dos parênteses.');},180);
      steps.later(function(){slot.textContent='143.33';slot.className='subq-slot is-done';fx.message(msg,'2. O resultado ocupa o lugar da subconsulta.');},1650);
      steps.later(function(){code.classList.add('is-out');fx.message(msg,'3. Agora a consulta de fora roda: só o pedido 3 passa.');},3200);
    };
    reset();
  }

  /* 4. Visualização de referência e comparações: barras reutilizáveis. */
  function bars(id,values,opt) {
    var s=mount(id);if(!s)return;
    var w=s.querySelector('.subq-w'),out=s.querySelector('.subq-opres');
    var button=s.querySelector('[data-replay]');
    var graph=barsIn(w,values),ln=threshold(w,'',opt.label,opt.ref);
    function compare() {
      var ids=[];
      graph.forEach(function(bar,i){
        var ok=OP[opt.op](values[i],opt.ref);highlight(bar,ok);if(ok)ids.push(i+1);
      });
      fx.message(out,'Pedidos que passam: '+(ids.length?ids.join(', '):'nenhum'));
    }
    button.textContent='Iniciar comparação';out.textContent='';
    button.onclick=function(){
      button.textContent='Repetir comparação';
      // Não reintroduza barras já montadas. Evita oscilação de opacidade/posição.
      compare();
    };
  }

  /* 5. Funções de resumo: gráfico e realce compartilhados. */
  function fn(id) {
    var s=mount(id);if(!s)return;
    var values=[130,100,200],graph=barsIn(s.querySelector('.subq-w'),values);
    var res=s.querySelector('.subq-big'),description=s.querySelector('.subq-nota');
    var F={AVG:function(a){return format(average(a));},MAX:function(a){return String(Math.max.apply(null,a));},
      MIN:function(a){return String(Math.min.apply(null,a));},SUM:function(a){return String(sum(a));},
      COUNT:function(a){return String(a.length);}};
    var selected={AVG:[0,1,2],SUM:[0,1,2],COUNT:[0,1,2],MAX:[2],MIN:[1]};
    var names={AVG:'a média de todos os valores',MAX:'o maior valor',MIN:'o menor valor',
      SUM:'a soma de todos os valores',COUNT:'quantas linhas existem'};
    res.textContent='?';description.textContent='Clique em uma função para ver qual barra ela escolhe.';
    s.querySelectorAll('[data-f]').forEach(function(button){button.onclick=function(){
      var f=button.dataset.f;
      res.textContent=F[f](values);fx.message(description,f+': '+names[f]);
      choose(s,'[data-f]','data-f',f);
      graph.forEach(function(bar,i){highlight(bar,selected[f].indexOf(i)>-1);});
      fx.emphasize(res);
    };});
  }

  /* 6. Laboratório: a escolha inicial já aplica o filtro. */
  function lab(id) {
    var s=mount(id);if(!s)return;
    var values=[130,100,200],w=s.querySelector('.subq-w'),graph=barsIn(w,values);
    var refs={AVG:{v:average(values),label:'AVG '+format(average(values)),query:'(SELECT AVG(valor) FROM pedidos)'},
      MAX:{v:200,label:'MAX 200',query:'(SELECT MAX(valor) FROM pedidos)'},
      P1:{v:130,label:'pedido 1 = 130',query:'(SELECT valor FROM pedidos WHERE id = 1)'}};
    var reference='AVG',operator='>',started=false;
    var line=threshold(w,'',refs.AVG.label,refs.AVG.v);
    var sql=s.querySelector('.subq-sql'),res=s.querySelector('.subq-opres');
    function show(move) {
      var r=refs[reference],found=[];
      line.firstChild.textContent=r.label;
      if(move)fx.move(line,{bottom:r.v*HEIGHT_PER_UNIT+'px'});
      else line.style.bottom=r.v*HEIGHT_PER_UNIT+'px';
      graph.forEach(function(bar,i){
        var ok=started&&OP[operator](values[i],r.v);highlight(bar,ok);if(ok)found.push(i+1);
      });
      sql.textContent='WHERE valor '+operator+' '+r.query;
      fx.message(res,started?'Pedidos que passam: '+(found.length?found.join(', '):'nenhum'):
        'Escolha a referência ou o operador para ver a comparação.',false,!started);
      choose(s,'[data-ref]','data-ref',reference);
      choose(s,'[data-op]','data-op',operator);
    }
    s.querySelectorAll('[data-ref]').forEach(function(button){button.onclick=function(){reference=button.dataset.ref;started=true;show(true);};});
    s.querySelectorAll('[data-op]').forEach(function(button){button.onclick=function(){operator=button.dataset.op;started=true;show(true);};});
    show(false);
  }

  /* 7. Um scanner para IN, NOT IN e EXISTS, sempre com o mesmo ritmo. */
  function scan(id) {
    var s=mount(id);if(!s)return;
    var cards=[].slice.call(s.querySelectorAll('.subq-cli'));
    var chips=[].slice.call(s.querySelectorAll('.subq-chip'));
    var button=s.querySelector('[data-replay]'),steps=makeSteps();
    function reset() {
      steps.clear();
      cards.forEach(function(card){
        var result=card.querySelector('.subq-res');
        if(result){fx.message(result,'',false,true);result.className='subq-res';}
        card.classList.remove('is-scan');
      });
      chips.forEach(function(chip){chip.classList.remove('is-hit');});
    }
    function focus(card){
      cards.forEach(function(x){x.classList.remove('is-scan');});
      card.classList.add('is-scan');
      chips.forEach(function(chip){chip.classList.toggle('is-hit',chip.dataset.v===card.dataset.v);});
    }
    function clearFocus(card){
      card.classList.remove('is-scan');
      chips.forEach(function(chip){chip.classList.remove('is-hit');});
    }
    function show(card){
      var result=card.querySelector('.subq-res');
      if(result){fx.message(result,card.dataset.res);
        result.className='subq-res '+(card.dataset.ok==='1'?'subq-ok':'subq-no');
      }
    }
    button.textContent='Iniciar conferência';
    button.onclick=function(){
      reset();button.textContent='Repetir conferência';
      cards.forEach(function(card,i){
        var at=i*MOTION.scanCycle;
        steps.later(function(){focus(card);},at);
        steps.later(function(){show(card);},at+MOTION.scanReveal);
        steps.later(function(){clearFocus(card);},at+MOTION.scanLeave);
      });
    };
  }

  /* 8. NOT IN e NULL: reaproveita as transições de varredura. */
  function nul(id) {
    var s=mount(id);if(!s)return;
    var list=s.querySelector('.subq-list'),button=s.querySelector('[data-nul]');
    var card=s.querySelector('.subq-cli'),res=card.querySelector('.subq-res');
    var msg=s.querySelector('.subq-msg'),hasNull=false,steps=makeSteps();
    function chips(){list.innerHTML=[1,1,2].concat(hasNull?['NULL']:[]).map(function(v){
      return '<span class="subq-chip'+(v==='NULL'?' is-null':'')+'">'+v+'</span>';
    }).join('');}
    function reset(){
      steps.clear();chips();fx.message(res,'',false,true);res.className='subq-res';
      card.classList.remove('is-scan');
      fx.message(msg,'Clique no botão para acrescentar o pedido sem cliente e ver o que acontece.',false,true);
      button.textContent=hasNull?'Tirar o pedido sem cliente':'+ pedido sem cliente (NULL)';
    }
    function run(){
      reset();card.classList.add('is-scan');fx.message(msg,'');
      var checks=['3 ≠ 1? sim','3 ≠ 2? sim'].concat(hasNull?['3 ≠ NULL? desconhecido']:[]);
      checks.forEach(function(check,i){steps.later(function(){fx.message(res,check);},i*MOTION.compare+200);});
      steps.later(function(){
        card.classList.remove('is-scan');
        if(hasNull){fx.message(res,'em dúvida: Carla fica de fora');res.className='subq-res subq-no';
          fx.message(msg,'Resultado: <b class="subq-no">vazio</b>, sem nenhum erro.',true);}
        else{fx.message(res,'todas dão sim: Carla entra');res.className='subq-res subq-ok';
          fx.message(msg,'Resultado: <b class="subq-ok">Carla</b>.',true);}
      },checks.length*MOTION.compare+260);
    }
    button.onclick=function(){hasNull=!hasNull;run();};reset();
  }

  /* 9. EXISTS x COUNT: mesmo componente de sequência. */
  function parou(id) {
    var s=mount(id);if(!s)return;
    var rows=[].slice.call(s.querySelectorAll('.subq-cli'));
    var msg=s.querySelector('.subq-msg'),steps=makeSteps();
    function put(card,t,cls){
      var result=card.querySelector('.subq-res');fx.message(result,t,false,!t);result.className='subq-res '+cls;
    }
    function run(k){
      steps.clear();choose(s,'[data-k]','data-k',k);fx.message(msg,'');
      rows.forEach(function(r){r.classList.remove('is-scan','is-gone');put(r,'','');});
      if(k==='ex'){
        steps.later(function(){rows[0].classList.add('is-scan');},220);
        steps.later(function(){put(rows[0],'PAGO: achei!','subq-ok');},740);
        steps.later(function(){rows[0].classList.remove('is-scan');rows[1].classList.add('is-gone');
          put(rows[1],'nem precisa olhar','');
          fx.message(msg,'O EXISTS parou no primeiro achado: <b class="subq-ok">verdadeiro</b>.',true);},1560);
      }else{
        steps.later(function(){rows[0].classList.add('is-scan');},220);
        steps.later(function(){put(rows[0],'conta 1','subq-ok');rows[0].classList.remove('is-scan');rows[1].classList.add('is-scan');},880);
        steps.later(function(){put(rows[1],'conta 2','subq-ok');rows[1].classList.remove('is-scan');
          fx.message(msg,'O COUNT olhou todos: <b class="subq-ok">2 pedidos</b>. Trabalho extra para saber só se existe.',true);},1560);
      }
    }
    s.querySelectorAll('[data-k]').forEach(function(b){b.onclick=function(){run(b.dataset.k);};});
    msg.textContent='Escolha EXISTS ou COUNT para ver como cada um trabalha.';
  }

  /* 10. Número de execuções: sequências e destaque de contadores. */
  function vezes(id) {
    var s=mount(id);if(!s)return;
    var rows=[].slice.call(s.querySelectorAll('.subq-cli'));
    var big=s.querySelector('.subq-big'),msg=s.querySelector('.subq-msg'),steps=makeSteps();
    function run(k){
      steps.clear();choose(s,'[data-k]','data-k',k);
      rows.forEach(function(r){r.classList.remove('is-scan');fx.message(r.querySelector('.subq-res'),'',false,true);});
      big.textContent='0';fx.message(msg,'');
      if(k==='esc'){
        steps.later(function(){
          big.textContent='1';fx.emphasize(big);
          rows.forEach(function(r){r.classList.add('is-scan');fx.message(r.querySelector('.subq-res'),'usa 143,33');});
          fx.message(msg,'Rodou uma vez, antes de tudo. Todos usam o mesmo resultado.');
        },320);
      }else{
        rows.forEach(function(r,i){steps.later(function(){
          rows.forEach(function(x){x.classList.remove('is-scan');});
          r.classList.add('is-scan');big.textContent=String(i+1);fx.emphasize(big);
          fx.message(r.querySelector('.subq-res'),'roda para '+r.dataset.n);
        },i*MOTION.scanCycle+300);});
        steps.later(function(){
          rows.forEach(function(x){x.classList.remove('is-scan');});
          fx.message(msg,'Rodou uma vez para cada cliente, porque depende de quem está na porta.');
        },rows.length*MOTION.scanCycle+200);
      }
    }
    s.querySelectorAll('[data-k]').forEach(function(b){b.onclick=function(){run(b.dataset.k);};});
    msg.textContent='Escolha uma opção para ver quantas vezes a subconsulta roda.';
  }

  /* 11. Formatos do retorno: montagem dos cartões e fade leve. */
  function forma(id) {
    var s=mount(id);if(!s)return;
    var grid=s.querySelector('.subq-grid'),msg=s.querySelector('.subq-msg');
    var shapes={
      1:{cols:1,data:['143,33'],desc:'Um valor: cabe no WHERE com =, > ou <. É a subconsulta escalar.'},
      2:{cols:1,data:['1','1','2'],desc:'Uma lista: cabe no WHERE com IN ou NOT IN.'},
      3:{cols:2,data:['id_cliente','total_gasto','1','230','2','200'],
        desc:'Uma tabela: cabe no FROM, com apelido. É a tabela derivada.'}
    };
    function show(k){
      var info=shapes[k];
      grid.style.gridTemplateColumns='repeat('+info.cols+',minmax(0,9rem))';
      grid.innerHTML=info.data.map(function(v){return '<div class="subq-cell">'+v+'</div>';}).join('');
      fx.message(msg,info.desc);choose(s,'[data-s]','data-s',k);fx.reveal(grid.children);
    }
    s.querySelectorAll('[data-s]').forEach(function(b){b.onclick=function(){show(+b.dataset.s);};});
    msg.textContent='Escolha um formato para ver o que cabe no WHERE ou no FROM.';
  }

  /* 12. Montinhos do caixa: cartões, chips e mesma sequência compartilhada. */
  function montinhos(id) {
    var s=mount(id);if(!s)return;
    var piles={1:s.querySelector('[data-p="1"]'),2:s.querySelector('[data-p="2"]')};
    var button=s.querySelector('[data-replay]'),orders=[[1,130],[1,100],[2,200]];
    var steps=makeSteps();
    function reset(){
      steps.clear();[1,2].forEach(function(id){
        piles[id].querySelector('.subq-items').innerHTML='';
        piles[id].querySelector('.subq-tot').textContent='total: 0';
      });
      button.textContent='Iniciar: separar em montinhos';
    }
    button.onclick=function(){
      reset();button.textContent='Repetir separação';var total={1:0,2:0};
      orders.forEach(function(order,i){steps.later(function(){
        total[order[0]]+=order[1];
        var pile=piles[order[0]],chip=document.createElement('span');
        chip.className='subq-chip';chip.textContent=order[1];
        pile.querySelector('.subq-items').appendChild(chip);
        pile.querySelector('.subq-tot').textContent='total: '+total[order[0]];
        fx.emphasize(chip);
      },i*MOTION.compare+240);});
    };
    reset();
  }

  /* 13. JOIN / LEFT JOIN: sinal de estado, sem zoom. */
  function join(id) {
    var s=mount(id);if(!s)return;
    var rows=[].slice.call(s.querySelectorAll('.subq-cli'));
    var msg=s.querySelector('.subq-msg');
    function show(k){
      choose(s,'[data-j]','data-j',k);
      rows.forEach(function(r){
        var empty=r.dataset.t==='NULL',res=r.querySelector('.subq-res');
        var excluded=empty&&k==='join';
        r.classList.toggle('is-gone',excluded);
        fx.message(res,excluded?'sem par: some':r.dataset.t);
        res.className='subq-res '+(empty?(excluded?'subq-no':'subq-ok'):'');
        // O texto da linha já possui fade; não aplicar uma segunda animação.
      });
      fx.message(msg,k==='join'?'JOIN só mantém quem tem par no resumo: a Carla some.':
        'LEFT JOIN mantém todos os clientes: a Carla fica com NULL, sem informação.');
    }
    s.querySelectorAll('[data-j]').forEach(function(b){b.onclick=function(){show(b.dataset.j);};});
    rows.forEach(function(r){r.querySelector('.subq-res').textContent=r.dataset.t;});
    msg.textContent='Escolha JOIN ou LEFT JOIN para ver o que acontece com a Carla.';
  }

  /* 14. COALESCE: mesmo componente para troca de valor. */
  function coal(id) {
    var s=mount(id);if(!s)return;
    var value=s.querySelector('[data-carla]');
    function show(k,withMotion){
      value.textContent=k==='yes'?'0':'NULL';
      value.className='subq-res '+(k==='yes'?'subq-ok':'subq-no');
      choose(s,'[data-k]','data-k',k);if(withMotion)fx.emphasize(value);
    }
    s.querySelectorAll('[data-k]').forEach(function(b){b.onclick=function(){show(b.dataset.k,true);};});
    value.className='subq-res';choose(s,'[data-k]','data-k','');
  }

  /* 15. Somar antes/depois: contador numérico suavizado. */
  function ord(id) {
    var s=mount(id);if(!s)return;
    var value=s.querySelector('.subq-big'),msg=s.querySelector('.subq-msg');
    var state={v:230};
    var options={join:{v:360,cls:'subq-no',desc:'O pedido 1 entrou duas vezes: 130 + 130 + 100.'},
      sum:{v:230,cls:'subq-ok',desc:'Cada pedido entrou uma vez: 130 + 100.'}};
    function show(k){
      var option=options[k];fx.message(msg,option.desc);
      value.className='subq-big '+option.cls;choose(s,'[data-m]','data-m',k);
      fx.count(state,option.v,function(v){value.textContent=Math.round(v);});
    }
    s.querySelectorAll('[data-m]').forEach(function(b){b.onclick=function(){show(b.dataset.m);};});
    value.textContent='230';msg.textContent='Escolha uma opção para ver como o total muda.';
  }

  /* 16. Tradução pergunta -> SQL: collapse CSS compartilhado. */
  function traduz(id) {
    var s=mount(id);if(!s)return;
    var panel=s.querySelector('.subq-collapse'),out=s.querySelector('.subq-sql');
    var kind=s.querySelector('.subq-msg'),current=null;
    var questions={
      a:{title:'Subconsulta escalar (um valor)',sql:'SELECT id, valor FROM pedidos\nWHERE valor > (SELECT AVG(valor) FROM pedidos);'},
      b:{title:'Subconsulta de lista (IN)',sql:'SELECT nome FROM clientes\nWHERE id IN (\n  SELECT id_cliente FROM pedidos\n  WHERE status = \'PAGO\'\n);'},
      c:{title:'Subconsulta correlacionada (NOT EXISTS)',sql:'SELECT cli.nome FROM clientes cli\nWHERE NOT EXISTS (\n  SELECT 1 FROM pedidos ped\n  WHERE ped.id_cliente = cli.id\n);'},
      d:{title:'Tabela derivada (no FROM)',sql:'SELECT cli.nome, resumo.total_gasto\nFROM clientes cli\nLEFT JOIN (\n  SELECT id_cliente, SUM(valor) AS total_gasto\n  FROM pedidos GROUP BY id_cliente\n) resumo ON cli.id = resumo.id_cliente;'}
    };
    function open(k){
      out.textContent=questions[k].sql;
      fx.message(kind,'Tipo: '+questions[k].title);
      panel.style.height=panel.scrollHeight+'px';
    }
    function close(){panel.style.height='0px';}
    s.querySelectorAll('[data-q]').forEach(function(b){b.onclick=function(){
      var k=b.dataset.q;
      if(current===k){current=null;choose(s,'[data-q]','data-q','');close();
        fx.message(kind,'Escolha uma pergunta da Dona Marta.');return;}
      current=k;choose(s,'[data-q]','data-q',k);open(k);
    };});
    panel.style.height='0px';kind.textContent='Escolha uma pergunta da Dona Marta.';
  }

  return {avg:average,fmt:format,caderno:caderno,live:live,nested:nested,
    bars:bars,fn:fn,lab:lab,scan:scan,nul:nul,parou:parou,
    vezes:vezes,forma:forma,montinhos:montinhos,join:join,
    coal:coal,ord:ord,traduz:traduz};
})();
subq.caderno('subq-cad');
</script>

<style>
.subq-tip-float{display:block;position:absolute;z-index:50;pointer-events:none;
  width:max-content;max-width:420px;background:#fff;color:#1f2937;
  border:1px solid #d1d5db;border-radius:10px;padding:10px 12px;
  box-shadow:0 8px 24px rgba(0,0,0,.18);font:400 .8rem/1.3 system-ui,sans-serif;
  white-space:normal;text-align:left}
[data-theme="dark"] .subq-tip-float{background:#1f2937;color:#f3f4f6;border-color:#4b5563}
.subq-tip-float b{display:block;margin-bottom:2px}
.subq-tip-float table{border-collapse:collapse;font-size:.75rem;width:100%}
.subq-tip-float th,.subq-tip-float td{padding:1px 8px;text-align:left}
.subq-tbl{border-bottom:1px dotted var(--accent);cursor:help;border-radius:3px}
.subq-tbl:hover,.subq-tbl:focus-visible{background:var(--accent-dim);outline:none}
</style>

<script>
(function(){
  var T={
    clientes:{h:['id','nome'],r:[[1,'Ana'],[2,'Bruno'],[3,'Carla']]},
    pedidos:{h:['id','id_cliente','valor','status'],r:[[1,1,130,'PAGO'],[2,1,100,'PAGO'],[3,2,200,'PAGO']]}
  };
  var SEL='pre code, code.subq-sql, .subq-code', SPLIT=/\b(clientes|pedidos)\b/, tip=null, queued=false;

  function html(n){
    var t=T[n];
    return '<b>'+n+'</b><table><tr>'+t.h.map(function(x){return '<th>'+x+'</th>';}).join('')+'</tr>'+
      t.r.map(function(r){return '<tr>'+r.map(function(x){return '<td>'+x+'</td>';}).join('')+'</tr>';}).join('')+'</table>';
  }

  /* Envolve cada ocorrência de clientes/pedidos em <span class="subq-tbl"> */
  function wrap(){
    queued=false;
    document.querySelectorAll(SEL).forEach(function(code){
      var w=document.createTreeWalker(code,NodeFilter.SHOW_TEXT),nodes=[],n;
      while((n=w.nextNode()))nodes.push(n);
      nodes.forEach(function(t){
        if(!SPLIT.test(t.nodeValue)||(t.parentNode.closest&&t.parentNode.closest('.subq-tbl')))return;
        var f=document.createDocumentFragment();
        t.nodeValue.split(SPLIT).forEach(function(p,i){
          if(i%2){
            var s=document.createElement('span');
            s.className='subq-tbl';s.dataset.t=p;s.tabIndex=0;s.textContent=p;
            f.appendChild(s);
          }else if(p)f.appendChild(document.createTextNode(p));
        });
        t.parentNode.replaceChild(f,t);
      });
    });
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(wrap);}}

  function hide(){if(tip&&tip.parentNode)tip.parentNode.removeChild(tip);tip=null;}
  function show(s){
    hide();
    var sec=s.closest('section')||document.body;
    if(getComputedStyle(sec).position==='static')sec.style.position='relative';
    tip=document.createElement('div');tip.className='subq-tip-float';tip.innerHTML=html(s.dataset.t);
    sec.appendChild(tip);
    var sr=sec.getBoundingClientRect(),sc=(sec.offsetWidth?sr.width/sec.offsetWidth:1)||1,
        W=sr.width/sc,Hh=sr.height/sc,pad=12,r=s.getBoundingClientRect(),
        left=(r.left-sr.left)/sc,top=(r.top-sr.top)/sc,h=r.height/sc,
        bw=tip.offsetWidth,bh=tip.offsetHeight,
        x=Math.max(pad,Math.min(left,W-pad-bw)),y=top+h+6;
    if(y+bh>Hh-pad)y=Math.max(pad,top-bh-6);
    tip.style.left=x+'px';tip.style.top=y+'px';
  }

  document.addEventListener('mouseover',function(e){var s=e.target.closest&&e.target.closest('.subq-tbl');if(s)show(s);});
  document.addEventListener('mouseout',function(e){if(e.target.closest&&e.target.closest('.subq-tbl'))hide();});
  document.addEventListener('focusin',function(e){var s=e.target.closest&&e.target.closest('.subq-tbl');if(s)show(s);});
  document.addEventListener('focusout',hide);
  document.addEventListener('keydown',function(e){
    if(['Escape','ArrowLeft','ArrowRight','PageUp','PageDown'].indexOf(e.key)>-1)hide();
  });
  window.addEventListener('resize',hide);

  /* Reaplica quando o conteúdo muda (animações que reescrevem o SQL, realce de sintaxe) */
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});
  schedule();
})();
</script>

---

## O que você acabou de fazer?

<div class="cols-2">
<div>

Você fez **duas perguntas, uma depois da outra**: primeiro a média, depois a comparação. A segunda só existe porque a primeira respondeu.

Como contar isso para o banco? Primeira ideia: digitar o número.

```sql
SELECT id, valor
FROM pedidos
WHERE valor > 143.33;
```

*Pare e pense:* e se chegar um pedido novo amanhã?
</div>
<div>

<div class="subq" id="subq-live">
<div class="subq-w"></div>
<p><b class="subq-big">0,00</b></p>
<button class="subq-btn" type="button" data-add>+ chegou um pedido novo (300)</button>
<p class="subq-nota"></p>
</div>
</div>
</div>

<script>
subq.live('subq-live');
</script>

---

## Dando nome ao que a gente já fazia

<div class="cols-2">
<div>

**Duas consultas, número copiado à mão**

```sql
SELECT AVG(valor) FROM pedidos;
-- resultado: 143.33

SELECT id, valor FROM pedidos
WHERE valor > 143.33;
```
</div>
<div>

**Uma só: a pergunta entra na pergunta**

```sql
SELECT id, valor
FROM pedidos
WHERE valor > (
  SELECT AVG(valor) FROM pedidos
);
```
</div>
</div>

Pôr uma consulta **dentro** de outra tem nome: **subconsulta**. Você já fazia isso no papel, só faltava a palavra. E agora a média está sempre atualizada.

---

## A de fora e a de dentro

<div class="cols-2">
<div>

- **Consulta externa:** faz a pergunta final.
- **Subconsulta (interna):** ajuda a externa e vive entre parênteses.

**Dica: leia de dentro para fora.** Vale para a subconsulta comum; a correlacionada depende da linha de fora, e veremos isso adiante.

1. Ache os parênteses.
2. Entenda o que está dentro.
3. Só então leia a consulta de fora.

</div>
<div>

*Pare e pense:* em `valor < (SELECT MAX(valor) FROM pedidos)`, qual parte roda primeiro?
<div class="subq" id="subq-nest">
<div class="subq-code">SELECT id, valor FROM pedidos<br>WHERE valor &gt; ( <span class="subq-slot">SELECT AVG(valor) FROM pedidos</span> );</div>
<p><button class="subq-btn" type="button" data-run>Executar de novo</button></p>
<p class="subq-nota subq-msg"></p>
</div>
</div>
</div>

<script>
subq.nested('subq-nest');
</script>

---

## Veja nos nossos dados

<div class="cols-2">
<div>

A média é **143,33**. Olhe as barras e responda:

- Por que só o pedido 3 passa?
- Se a média mudasse, o que mudaria no resultado?

Como a média é calculada na hora, a consulta se ajusta sozinha.
</div>
<div>

<div class="subq" id="subq-ex1">
<div class="subq-w"></div>
<p><button class="subq-btn" type="button" data-replay>Repetir</button> <span class="subq-nota subq-opres"></span></p>
</div>
</div>
</div>

<script>
subq.bars('subq-ex1',[130,100,200],{ref:subq.avg([130,100,200]),op:'>',label:'AVG 143,33'});
</script>

---

## Subconsulta escalar: a resposta é um valor só

<div class="cols-2">
<div>

> Antes de fechar um orçamento em dólar, você consulta a cotação do dia: **um número**. Só depois faz a conta.

A **subconsulta escalar** faz o mesmo: devolve uma linha e uma coluna, e esse valor entra na consulta de fora. Se devolver várias linhas, o banco recusa.
</div>
<div>

| Subconsulta | Devolve | Escalar? |
| --- | --- | --- |
| `SELECT AVG(valor) FROM pedidos` | 1 linha, 1 coluna | **Sim** |
| `SELECT MAX(valor) FROM pedidos` | 1 linha, 1 coluna | **Sim** |
| `SELECT valor FROM pedidos` | 3 linhas, 1 coluna | Não |
| `SELECT id, valor FROM pedidos WHERE id = 3` | 1 linha, 2 colunas | Não |
</div>
</div>

---

## Como resumir várias linhas em um valor?

Funções de resumo transformam muitas linhas em **um número**. Clique e veja qual barra cada uma escolhe.

<div class="subq" id="subq-fn">
<div class="subq-w"></div>
<p>
<button class="subq-btn" type="button" data-f="AVG">AVG</button> <button class="subq-btn" type="button" data-f="MAX">MAX</button> <button class="subq-btn" type="button" data-f="MIN">MIN</button> <button class="subq-btn" type="button" data-f="SUM">SUM</button> <button class="subq-btn" type="button" data-f="COUNT">COUNT</button>
</p>
<p><b class="subq-big">?</b> <span class="subq-nota"></span></p>
</div>

<script>
subq.fn('subq-fn');
</script>

---

## Laboratório: mude a pergunta e observe

<div class="cols-2">
<div>

```sql
SELECT id, valor
FROM pedidos
WHERE valor > (SELECT AVG(valor) FROM pedidos);
```

- A ideia é a mesma; só a **referência** e o **operador** mudam.
- Escalar combina com qualquer comparação: `=`, `>`, `>=`, `<`, `<=`.
- Com `WHERE id = 1` só uma linha volta, porque `id` não se repete.
</div>
<div>

<div class="subq" id="subq-lab">
<div class="subq-w"></div>
<p>
<button class="subq-btn" type="button" data-ref="AVG">AVG</button> <button class="subq-btn" type="button" data-ref="MAX">MAX</button> <button class="subq-btn" type="button" data-ref="P1">pedido 1</button>
</p>
<p>
<button class="subq-btn" type="button" data-op="&gt;">&gt;</button> <button class="subq-btn" type="button" data-op="&gt;=">&gt;=</button> <button class="subq-btn" type="button" data-op="&lt;">&lt;</button> <button class="subq-btn" type="button" data-op="&lt;=">&lt;=</button> <button class="subq-btn" type="button" data-op="=">=</button>
</p>
<code class="subq-sql"></code>
<p class="subq-nota subq-opres"></p>
</div>
</div>
</div>

<script>
subq.lab('subq-lab');
</script>

---

## E quando a resposta vem demais?

<div class="cols-2">
<div>

Imagine perguntar "o pedido é igual a quanto?" e ouvir "130, 100 e 200". Qual escolher?

```sql
SELECT id, valor
FROM pedidos
WHERE valor = (SELECT valor FROM pedidos);
```

O banco também não sabe, e recusa: "mais de uma linha devolvida pela subconsulta".
</div>
<div>

**Duas saídas**

- **Resumir** em um valor só: `MAX`, `MIN`, `AVG`.
- **Filtrar** até sobrar uma linha, como `WHERE id = 1`.

Quer mesmo comparar com várias linhas? Aí a pergunta muda, e é o assunto da próxima parte.
</div>
</div>

---

## Sua vez: o menor pedido

Escreva uma consulta que mostre o pedido de **menor** valor, usando uma subconsulta escalar.

> Dica: qual função devolve o *menor valor*?

<details class="gab">
<summary> Ver gabarito</summary>

```sql
SELECT id, valor
FROM pedidos
WHERE valor = (SELECT MIN(valor) FROM pedidos);
```

A subconsulta devolve **100**. Resultado: o pedido 2. Seu caminho foi diferente? Vale conversar sobre ele.

</details>

---

## Agora a resposta é uma lista: IN e NOT IN

<div class="cols-2">
<div>

*Pare e pense:* Dona Marta quer saber quais clientes já tiveram algum pedido pago. A resposta cabe em um número só?

Não: são **vários** ids. É como a lista de convidados de uma festa, que o porteiro confere nome por nome.

- A subconsulta **monta a lista**.
- O `IN` **confere** quem está nela.
</div>
<div>

| | Escalar | Lista |
| --- | --- | --- |
| Devolve | 1 valor | 1 coluna, várias linhas |
| Operador | `=`, `>`, `<`... | `IN`, `NOT IN` |
| Pergunta | "É maior que?" | "Está na lista?" |
</div>
</div>

---

## Da lista digitada à lista montada

<div class="cols-2">
<div>

**Lista digitada à mão**

```sql
SELECT nome FROM clientes
WHERE id IN (1, 2);
```

`id IN (1, 2)` quer dizer: o id é 1 **ou** 2. Resultado: Ana e Bruno. Se entrar um pedido novo, a lista fica velha.
</div>
<div>

**Lista montada pela subconsulta**

```sql
SELECT id_cliente FROM pedidos
WHERE status = 'PAGO';
```

| id_cliente |
| --- |
| 1 |
| 1 |
| 2 |

O id 1 aparece duas vezes: a Ana tem dois pedidos pagos.
</div>
</div>

---

## IN: o porteiro confere a lista

<div class="cols-2">
<div>

```sql
SELECT nome
FROM clientes
WHERE id IN (
  SELECT id_cliente FROM pedidos
  WHERE status = 'PAGO'
);
```

| nome |
| --- |
| Ana |
| Bruno |

*Pare e pense:* o id 1 está duas vezes na lista. A Ana aparece duas vezes? Observe: cada cliente é avaliado **uma vez**.
</div>
<div>

<div class="subq" id="subq-scan-in">
<p class="subq-nota">Lista devolvida pela subconsulta:</p>
<p><span class="subq-chip" data-v="1">1</span><span class="subq-chip" data-v="1">1</span><span class="subq-chip" data-v="2">2</span></p>
<div class="subq-cli" data-v="1" data-ok="1" data-res="Está na lista? Sim"><span>Ana (1)</span><span class="subq-res"></span></div>
<div class="subq-cli" data-v="2" data-ok="1" data-res="Está na lista? Sim"><span>Bruno (2)</span><span class="subq-res"></span></div>
<div class="subq-cli" data-v="3" data-ok="0" data-res="Está na lista? Não"><span>Carla (3)</span><span class="subq-res"></span></div>
<p><button class="subq-btn" type="button" data-replay>Repetir conferência</button></p>
</div>
</div>
</div>

<script>
subq.scan('subq-scan-in');
</script>

---

## NOT IN: quem ficou de fora da lista

<div class="cols-2">
<div>

```sql
SELECT nome
FROM clientes
WHERE id NOT IN (
  SELECT id_cliente FROM pedidos
);
```

É a pergunta inversa: quem **não** está na lista? Resultado: **Carla**, a cliente sem pedidos.
</div>
<div>

<div class="subq" id="subq-scan-notin">
<p class="subq-nota">Lista devolvida pela subconsulta:</p>
<p><span class="subq-chip" data-v="1">1</span><span class="subq-chip" data-v="1">1</span><span class="subq-chip" data-v="2">2</span></p>
<div class="subq-cli" data-v="1" data-ok="0" data-res="Está na lista: fora"><span>Ana (1)</span><span class="subq-res"></span></div>
<div class="subq-cli" data-v="2" data-ok="0" data-res="Está na lista: fora"><span>Bruno (2)</span><span class="subq-res"></span></div>
<div class="subq-cli" data-v="3" data-ok="1" data-res="Fora da lista: entra"><span>Carla (3)</span><span class="subq-res"></span></div>
<p><button class="subq-btn" type="button" data-replay>Repetir conferência</button></p>
</div>
</div>
</div>

<script>
subq.scan('subq-scan-notin');
</script>

---

## Cuidado: o nome borrado na lista

<div class="cols-2">
<div>

*Pare e pense:* na lista de convidados há um nome borrado, ilegível. O visitante se chama Carla. O porteiro pode dizer "você não está na lista"?

Não pode: o nome borrado **pode ser** o dela. No banco, esse "desconhecido" é o `NULL`. Entrou um pedido antigo, sem `id_cliente`:

```sql
SELECT nome FROM clientes
WHERE id NOT IN (
  SELECT id_cliente FROM pedidos
);
```
</div>
<div>

<div class="subq" id="subq-nul">
<p class="subq-nota">Lista devolvida pela subconsulta:</p>
<p class="subq-list"></p>
<p><button class="subq-btn" type="button" data-nul>+ pedido sem cliente (NULL)</button></p>
<div class="subq-cli"><span>Carla (id 3)</span><span class="subq-res"></span></div>
<p class="subq-nota subq-msg"></p>
</div>
</div>
</div>

<script>
subq.nul('subq-nul');
</script>

---

## Como corrigir o NOT IN

Tire o `NULL` da lista, dentro da subconsulta:

```sql
SELECT nome FROM clientes
WHERE id NOT IN (
    SELECT id_cliente
    FROM pedidos
    WHERE id_cliente IS NOT NULL
);
```

A lista volta a ser `1, 1, 2` e a Carla reaparece. `IS NOT NULL` quer dizer "tem valor preenchido". Mais adiante veremos outra saída, ainda mais segura: `NOT EXISTS`.

---

## Teste rápido: quem não pediu coisa grande

Escreva uma consulta que mostre os clientes que **não** fizeram nenhum pedido de valor acima de 150.

> Dica: use `NOT IN` com uma subconsulta que liste os clientes com pedido acima de 150.

<details class="gab">
<summary> Ver gabarito</summary>

```sql
SELECT nome
FROM clientes
WHERE id NOT IN (SELECT id_cliente FROM pedidos WHERE valor > 150);
```

A subconsulta devolve só o id **2**. Resultado: **Ana** e **Carla**.

</details>

---

## Subconsulta correlacionada e EXISTS

<div class="cols-2">
<div>

*Pare e pense:* o vigia precisa ler a lista de pedidos inteira antes de começar?

Não. Ele pergunta a cada cliente, um de cada vez: `você tem algum pedido pago?`. A resposta **depende de quem está na frente dele**.
</div>
<div>

| Pergunta | Operador |
| --- | --- |
| "Quais ids estão **nesta lista**?" | `IN` |
| "**Existe algum** pedido pago para este cliente?" | `EXISTS` |

No `EXISTS`, a pergunta é de **sim ou não**.
</div>
</div>

---

## Basta um: o EXISTS para no primeiro achado

<div class="cols-2">
<div>

*Pare e pense:* para saber **se** a Ana já comprou alguma coisa, precisamos contar todos os pedidos dela?

Basta encontrar **um**. O `EXISTS` faz exatamente isso: achou uma linha, responde "sim" e para. Compare com o `COUNT`, que olha todas.
</div>
<div>

<div class="subq" id="subq-parou">
<p>
<button class="subq-btn" type="button" data-k="ex">EXISTS</button> <button class="subq-btn" type="button" data-k="ct">COUNT</button>
</p>
<div class="subq-cli"><span>Pedido 1 (Ana, 130)</span><span class="subq-res"></span></div>
<div class="subq-cli"><span>Pedido 2 (Ana, 100)</span><span class="subq-res"></span></div>
<p class="subq-nota subq-msg"></p>
</div>
</div>
</div>

<script>
subq.parou('subq-parou');
</script>

---

## EXISTS: o vigia em SQL

<div class="cols-2">
<div>

```sql
SELECT cli.nome
FROM clientes cli
WHERE EXISTS (
  SELECT 1
  FROM pedidos ped
  WHERE ped.id_cliente = cli.id
    AND ped.status = 'PAGO'
);
```

Devolve **Ana** e **Bruno**; a Ana aparece uma vez, mesmo com dois pedidos pagos.
</div>
<div>

**Apelidos**

- `cli` é apelido de `clientes`; `ped`, de `pedidos`.
- Deixam claro de onde vem cada coluna: `cli.id`, `ped.id_cliente`.

**O `SELECT 1`** é só um marcador: o `EXISTS` quer saber **se a linha apareceu**, não o que tem nela.
</div>
</div>

---

## Passo a passo: um cliente por vez

<div class="cols-2">
<div>

Conceitualmente, o banco roda a subconsulta para cada cliente. O otimizador pode reescrever a consulta, mas esse modelo mental vale. Para a Ana:

```sql
SELECT 1 FROM pedidos ped
WHERE ped.id_cliente = 1
  AND ped.status = 'PAGO'
```

Achou linha: o `EXISTS` é verdadeiro e a Ana entra. Se não achar nenhuma, o cliente fica de fora.
</div>
<div>

<div class="subq" id="subq-scan-ex">
<div class="subq-cli" data-ok="1" data-res="2 pedidos pagos: existe"><span>Ana</span><span class="subq-res"></span></div>
<div class="subq-cli" data-ok="1" data-res="1 pedido pago: existe"><span>Bruno</span><span class="subq-res"></span></div>
<div class="subq-cli" data-ok="0" data-res="0 pedidos: não existe"><span>Carla</span><span class="subq-res"></span></div>
<p><button class="subq-btn" type="button" data-replay>Repetir conferência</button></p>
</div>
</div>
</div>

<script>
subq.scan('subq-scan-ex');
</script>

---

## Por que ela se chama correlacionada?

<div class="cols-2">
<div>

Dentro da subconsulta aparece `cli.id`, uma coluna da consulta de fora.

- Sem ela, o porteiro não sabe quem está na porta.
- A subconsulta **depende da linha de fora**: está **correlacionada** com ela.
- Conceitualmente, ela roda uma vez por linha de fora. O otimizador pode reescrevê-la, então o número real de execuções pode ser menor.

*Pare e pense:* então ela roda quantas vezes? Compare com a escalar.
</div>
<div>

<div class="subq" id="subq-vezes">
<p>
<button class="subq-btn" type="button" data-k="esc">Escalar (AVG)</button> <button class="subq-btn" type="button" data-k="cor">Correlacionada (EXISTS)</button>
</p>
<div class="subq-cli" data-n="Ana"><span>Ana</span><span class="subq-res"></span></div>
<div class="subq-cli" data-n="Bruno"><span>Bruno</span><span class="subq-res"></span></div>
<div class="subq-cli" data-n="Carla"><span>Carla</span><span class="subq-res"></span></div>
<p>Execuções da subconsulta: <b class="subq-big">0</b></p>
<p class="subq-nota subq-msg"></p>
</div>
</div>
</div>

<script>
subq.vezes('subq-vezes');
</script>

---

## IN ou EXISTS: o mesmo problema, dois caminhos

*Quais clientes fizeram algum pedido acima de 150?*

<div class="cols-2">
<div>

**Com IN**

```sql
SELECT nome
FROM clientes
WHERE id IN (
  SELECT id_cliente FROM pedidos
  WHERE valor > 150
);
```
</div>
<div>

**Com EXISTS**

```sql
SELECT cli.nome
FROM clientes cli
WHERE EXISTS (
  SELECT 1 FROM pedidos ped
  WHERE ped.id_cliente = cli.id
    AND ped.valor > 150
);
```
</div>
</div>

Os dois devolvem **Bruno**. `IN` lê melhor quando a ideia é "está nesta lista?"; `EXISTS`, quando é "existe algum?" ou quando a conferência depende da linha de fora. Regras práticas: use `IN` para uma lista pequena e fixa de valores; use `EXISTS` quando a condição depende da linha de fora; prefira `NOT EXISTS` a `NOT IN` quando a subconsulta puder devolver NULL.

---

## NOT EXISTS: quem não tem par

<div class="cols-2">
<div>

```sql
SELECT cli.nome
FROM clientes cli
WHERE NOT EXISTS (
  SELECT 1
  FROM pedidos ped
  WHERE ped.id_cliente = cli.id
);
```
</div>
<div>

Devolve **Carla**, a única sem pedido.

*Pare e pense:* e o pedido sem cliente (NULL)? A comparação é linha a linha: ele nunca bate com `cli.id`, simplesmente não conta, e a Carla continua aparecendo.

Por isso `NOT EXISTS` é mais seguro que `NOT IN`.
</div>
</div>

---

## Teste rápido: pedidos pequenos

Escreva uma consulta com `EXISTS` que mostre os clientes que têm algum pedido de valor **menor que 110**.

> Dica: copie a consulta do `EXISTS` e troque a condição.

<details class="gab">
<summary> Ver gabarito</summary>

```sql
SELECT cli.nome
FROM clientes cli
WHERE EXISTS (
    SELECT 1
    FROM pedidos ped
    WHERE ped.id_cliente = cli.id
      AND ped.valor < 110
);
```

Resultado: **Ana**, por causa do pedido 2, de valor 100.

</details>

---

## E se a resposta for uma tabela inteira?

<div class="cols-2">
<div>

Dona Marta agora quer um **relatório**: quanto cada cliente gastou. Isso não é um valor nem uma lista: são linhas **e** colunas.

A mesma lanchonete tem um caixa que separa as notas em montinhos, conta cada um e só então cola o total. No SQL, a ordem entre **resumir** e **juntar** muda o resultado.

Experimente os três formatos ao lado.
</div>
<div>

<div class="subq" id="subq-forma">
<p>
<button class="subq-btn" type="button" data-s="1">Um valor</button> <button class="subq-btn" type="button" data-s="2">Uma lista</button> <button class="subq-btn" type="button" data-s="3">Uma tabela</button>
</p>
<div class="subq-grid"></div>
<p class="subq-nota subq-msg"></p>
</div>
</div>
</div>

<script>
subq.forma('subq-forma');
</script>

---

## O caixa separa em montinhos

<div class="cols-2">
<div>

Primeiro o resumo, sozinho:

```sql
SELECT id_cliente,
       SUM(valor) AS total_gasto
FROM pedidos
GROUP BY id_cliente;
```

`GROUP BY` forma um montinho por cliente, e o `SUM` soma cada um. Resultado: uma linha por cliente, com o total.
</div>
<div>

<div class="subq" id="subq-pile">
<div class="subq-piles">
<div class="subq-pile" data-p="1"><b>Ana</b><div class="subq-items"></div><span class="subq-tot">total: 0</span></div>
<div class="subq-pile" data-p="2"><b>Bruno</b><div class="subq-items"></div><span class="subq-tot">total: 0</span></div>
</div>
<p><button class="subq-btn" type="button" data-replay>Separar de novo</button></p>
</div>
</div>
</div>

<script>
subq.montinhos('subq-pile');
</script>

---

## O resumo vira uma tabela derivada

<div class="cols-2">
<div>

Esse resultado tem linhas e colunas, como qualquer tabela. Então podemos pô-lo no `FROM` e consultá-lo:

```sql
FROM (
  SELECT id_cliente, SUM(valor) AS total_gasto
  FROM pedidos
  GROUP BY id_cliente
) resumo   -- apelido obrigatório
```
</div>
<div>

Subconsulta no `FROM` tem nome: **tabela derivada**.

- Uma tabela precisa de nome para ser chamada: o **apelido** dá nome ao resumo.
- Depois usamos `resumo.total_gasto` e `resumo.id_cliente`.
- Sem apelido, a consulta é recusada na maioria dos casos.

**Por que isso resolve?** Um resumo com uma linha por cliente precisa de colunas para ser ligado a `clientes`. Uma subconsulta escalar devolveria um valor só, e não haveria como associar o total a cada nome.
</div>
</div>

---

## O problema: juntar primeiro e somar depois infla o total

Imagine que cada pedido agora tem **itens** numa tabela `itens_pedido`. O pedido 1 tem dois itens, então ele aparece duas vezes quando juntamos pedidos com itens.

Se somarmos o valor do pedido depois dessa junção, o pedido 1 entra duas vezes e o total da Ana sai inflado.

*Pare e pense:* como fazer para cada pedido contar uma vez só, mesmo que a tabela de itens tenha várias linhas para ele?

---

## Resumir antes de juntar

<div class="cols-2">
<div>

```sql
SELECT cli.nome, resumo.total_gasto
FROM clientes cli
LEFT JOIN (
  SELECT id_cliente,
         SUM(valor) AS total_gasto
  FROM pedidos
  GROUP BY id_cliente
) resumo ON cli.id = resumo.id_cliente;
```

*Pare e pense:* por que `LEFT JOIN` e não `JOIN`? Troque na animação e veja a Carla.
</div>
<div>

<div class="subq" id="subq-join">
<p>
<button class="subq-btn" type="button" data-j="join">JOIN</button> <button class="subq-btn" type="button" data-j="left">LEFT JOIN</button>
</p>
<div class="subq-cli" data-t="230"><span>Ana</span><span class="subq-res"></span></div>
<div class="subq-cli" data-t="200"><span>Bruno</span><span class="subq-res"></span></div>
<div class="subq-cli" data-t="NULL"><span>Carla</span><span class="subq-res"></span></div>
<p class="subq-nota subq-msg"></p>
</div>
</div>
</div>

<script>
subq.join('subq-join');
</script>

**Por que fazer assim?** O resumo já sai com uma linha por cliente, então a junção com `clientes` não multiplica nada. Se a tabela `itens_pedido` entrasse direto na junção, cada pedido se repetiria a cada item antes da soma.

---

## Por que a ordem importa

<div class="cols-2">
<div>

*Pare e pense:* veja o que acontece com o total da Ana nas duas ordens. O pedido 1 aparece em duas linhas quando juntamos antes de somar:

| pedido | valor |
| --- | --- |
| 1 | 130 |
| 1 | 130 |
| 2 | 100 |

Com a tabela derivada, o resumo já vem pronto: uma linha por cliente, nada se repete.
</div>
<div>

<div class="subq" id="subq-ord">
<p>Total da Ana: <b class="subq-big">230</b></p>
<p><button class="subq-btn" type="button" data-m="join">Juntar antes de somar</button> <button class="subq-btn" type="button" data-m="sum">Resumir antes de juntar</button></p>
<p class="subq-nota subq-msg"></p>
</div>
</div>
</div>

<script>
subq.ord('subq-ord');
</script>

---

## O problema: NULL não é zero

Dona Marta quer um relatório com quantos pedidos cada cliente fez.

Se a consulta usar `LEFT JOIN` e nada mais, a Carla aparece com `NULL` na coluna de quantidade. Só que `NULL` quer dizer "desconhecido", e a Carla não tem pedido nenhum: o número certo é **zero**.

Pior: qualquer conta feita com `NULL` também vira `NULL`. Se a Dona Marta somar 1 à quantidade para contar um pedido a mais, a Carla continua vazia.

*Pare e pense:* o que a Dona Marta entenderia ao ler "NULL" no lugar da Carla?

---

## Contar pedidos e trocar NULL por zero

<div class="cols-2">
<div>

```sql
SELECT cli.nome,
  COALESCE(resumo.qtd_pedidos, 0)
    AS qtd_pedidos
FROM clientes cli
LEFT JOIN (
  SELECT id_cliente, COUNT(*) AS qtd_pedidos
  FROM pedidos
  GROUP BY id_cliente
) resumo ON cli.id = resumo.id_cliente;
```

`COALESCE` devolve o primeiro valor que **não** é `NULL`.

**Por que trocar?** O relatório mostra `0` no lugar de `NULL`, e o número pode ser somado ou comparado sem surpresa.
</div>
<div>

<div class="subq" id="subq-coal">
<p>
<button class="subq-btn" type="button" data-k="no">Sem COALESCE</button> <button class="subq-btn" type="button" data-k="yes">Com COALESCE</button>
</p>
<div class="subq-cli"><span>Ana</span><span class="subq-res">2</span></div>
<div class="subq-cli"><span>Bruno</span><span class="subq-res">1</span></div>
<div class="subq-cli"><span>Carla</span><span class="subq-res" data-carla>NULL</span></div>
<p class="subq-nota">A Carla fez zero pedidos: "NULL" fica estranho num relatório.</p>
</div>
</div>
</div>

<script>
subq.coal('subq-coal');
</script>

---

## O problema: o WHERE não enxerga a soma

Dona Marta quer só os clientes que gastaram mais de 210 no total.

A primeira tentativa costuma ser esta:

```sql
SELECT id_cliente, SUM(valor) AS total_gasto
FROM pedidos
WHERE SUM(valor) > 210
GROUP BY id_cliente;
```

O banco recusa, pelo mesmo motivo do `AVG` no começo: o `WHERE` filtra linha por linha, e o total de cada cliente só existe depois do agrupamento.

*Pare e pense:* em que parte da consulta o total já existe, pronto para ser comparado?

---

## Filtrar o resumo

<div class="cols-2">
<div>

```sql
SELECT resumo.id_cliente, resumo.total_gasto
FROM (
  SELECT id_cliente, SUM(valor) AS total_gasto
  FROM pedidos
  GROUP BY id_cliente
) resumo
WHERE resumo.total_gasto > 210;
```

**Por que aqui?** O resumo já vira uma tabela com a coluna `total_gasto`. Aí o `WHERE` de fora compara esse valor linha a linha, como faria com qualquer coluna.
</div>
<div>

| id_cliente | total_gasto |
| --- | --- |
| 1 | 230 |

A consulta de fora filtra a tabela derivada como qualquer tabela. Só a Ana gastou mais de 210 no total.
</div>
</div>

---

## Teste rápido: o que falta?

O que falta nesta consulta para ela funcionar?

```sql
SELECT cli.nome, resumo.total_gasto
FROM clientes cli
LEFT JOIN (
    SELECT id_cliente, SUM(valor) AS total_gasto
    FROM pedidos
    GROUP BY id_cliente
) ON cli.id = resumo.id_cliente;
```

<details class="gab">
<summary> Ver gabarito</summary>

Falta o **apelido** `resumo` logo depois do fecha-parênteses:

```sql
) resumo ON cli.id = resumo.id_cliente;
```

Sem o apelido, o banco não sabe o que é `resumo`.

</details>

---

## Voltando à lanchonete: lendo o mundo com SQL

Lá no começo, a gente só tinha perguntas da Dona Marta. Escolha uma e veja que tipo de subconsulta ela pede.

<div class="subq" id="subq-traduz">
<p>
<button class="subq-btn" type="button" data-q="a">Quem pediu acima da média?</button> <button class="subq-btn" type="button" data-q="b">Quem já pagou algum pedido?</button> <button class="subq-btn" type="button" data-q="c">Quem nunca pediu?</button> <button class="subq-btn" type="button" data-q="d">Quanto cada um gastou?</button>
</p>
<div class="subq-collapse"><code class="subq-sql"></code></div>
<p class="subq-nota subq-msg"></p>
</div>

<script>
subq.traduz('subq-traduz');
</script>

---

## Síntese: o que construímos juntos

| Conceito | Em uma frase |
| :--- | :--- |
| **Subconsulta** | Uma consulta entre parênteses dentro de outra, que usa o resultado dela. |
| **Ordem de execução** | A de dentro roda primeiro; só depois a de fora continua. |
| **Subconsulta escalar** | Devolve um valor só e se compara com =, >, <, >= e <=. |
| **IN e NOT IN** | Conferem uma coluna contra uma lista devolvida pela subconsulta. |
| **NULL no NOT IN** | Um desconhecido na lista faz o NOT IN não devolver nenhuma linha. |
| **EXISTS** | Verdadeiro quando a subconsulta acha pelo menos uma linha. |
| **Correlacionada** | Usa uma coluna da consulta de fora; conceitualmente roda uma vez por linha dela. |
| **Tabela derivada** | Subconsulta no FROM: precisa de apelido e resume antes de juntar. |

---

## Mão na massa

Com as tabelas `clientes` e `pedidos` da lanchonete, escreva as consultas:

1. Os pedidos com valor **abaixo ou igual** à média.
2. Os clientes que têm pedido **pago**, usando `IN`.
3. Os clientes **sem nenhum pedido**, usando `NOT EXISTS`.
4. O **total gasto** por cliente, usando tabela derivada.

Tente sozinho antes de abrir os gabaritos. Só um fica aberto por vez.

<details class="gab" name="gab">
<summary> Ver Gabarito 1: pedidos abaixo ou igual à média</summary>

```sql
SELECT id, valor FROM pedidos
WHERE valor <= (SELECT AVG(valor) FROM pedidos);
```

Resultado: pedidos 1 e 2.

</details>

<details class="gab" name="gab">
<summary> Ver Gabarito 2: clientes com pedido pago, usando IN</summary>

```sql
SELECT nome FROM clientes
WHERE id IN (SELECT id_cliente FROM pedidos WHERE status = 'PAGO');
```

Resultado: Ana e Bruno.

</details>

<details class="gab" name="gab">
<summary> Ver Gabarito 3: clientes sem pedido, usando NOT EXISTS</summary>

```sql
SELECT cli.nome FROM clientes cli
WHERE NOT EXISTS (
    SELECT 1 FROM pedidos ped WHERE ped.id_cliente = cli.id
);
```

Resultado: Carla.

</details>

<details class="gab" name="gab">
<summary> Ver Gabarito 4: total gasto por cliente, com tabela derivada</summary>

```sql
SELECT cli.nome, resumo.total_gasto
FROM clientes cli
LEFT JOIN (
    SELECT id_cliente, SUM(valor) AS total_gasto
    FROM pedidos GROUP BY id_cliente
) resumo ON cli.id = resumo.id_cliente;
```

</details>

---

## Saída: três perguntas

1. O que `NOT IN` devolve se a subconsulta trouxer um NULL?
2. Quando o `EXISTS` é preferível ao `IN`?
3. Por que resumir antes de juntar?

<details class="gab">
<summary> Ver Gabarito</summary>

1. Nenhuma linha. O NULL pode ser qualquer valor, então o banco não consegue afirmar que a linha está fora da lista.
2. Quando a condição depende da linha de fora, como `ped.id_cliente = cli.id`.
3. Juntar antes de somar repete linhas e infla o total. Resumir antes garante uma linha por grupo.

</details>

---

## Para continuar a conversa

1. Em que momentos do seu dia a dia você faz uma pergunta que só dá para responder depois de outra?
2. Com suas palavras: o que é uma subconsulta e por que ela fica entre parênteses?
3. Por que `valor > (SELECT valor FROM pedidos)` deixa o banco confuso?
4. IN ou EXISTS: qual parece mais natural para você explicar, e por quê?
5. Por que o NULL faz o NOT IN "mentir"? Que saída é mais segura?
6. Como resumir antes de juntar evita contar um pedido duas vezes?

---

## Material Complementar

- **PostgreSQL — Subquery Expressions** — Documentação oficial sobre EXISTS, IN e comparações com subconsultas. https://www.postgresql.org/docs/current/functions-subquery.html
- **MySQL 8.0 — Subqueries** — Explica os tipos de subconsulta e as regras de uso em cada cláusula. https://dev.mysql.com/doc/refman/8.0/en/subqueries.html
- **W3Schools — SQL Subqueries** — Exemplos curtos e executáveis de subconsultas no WHERE e no FROM. https://www.w3schools.com/sql/sql_subqueries.asp
- **Modern SQL** — Site de referência sobre SQL padrão e diferenças entre os bancos. https://modern-sql.com/