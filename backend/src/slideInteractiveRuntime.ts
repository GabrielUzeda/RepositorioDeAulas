import { calculateBarInteractive, parseSlideInteractive, type Aggregate, type Operator } from './slideInteractive';

export function mountSlideInteractives(
  root: ParentNode,
  calculate = calculateBarInteractive,
  parse = parseSlideInteractive,
): () => void {
  const cleanups: (() => void)[] = [];
  const doc = (root as Node).ownerDocument ?? document;
  root.querySelectorAll<HTMLElement>('[data-slide-widget]').forEach(widget => {
    if (widget.dataset.widgetMounted || !widget.dataset.widgetConfig) return;
    let config: ReturnType<typeof parse>;
    try { config = parse(widget.dataset.widgetConfig); } catch { return; }
    const controls = widget.querySelector<HTMLElement>('.slide-widget-controls');
    const progress = widget.querySelector<HTMLElement>('.slide-widget-progress');
    if (!controls || !progress) return;
    widget.dataset.widgetMounted = 'true';
    const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const animations = new Set<Animation>();
    const frames = new Map<HTMLElement, number>();
    let timer: ReturnType<typeof setInterval> | undefined;
    let index = 0;
    const play = controls.querySelector<HTMLButtonElement>('[data-widget-play]');
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
      if (play) { play.textContent = 'Reproduzir'; play.setAttribute('aria-pressed', 'false'); }
    };
    const pulse = (el: HTMLElement | null, delay = 0) => {
      if (!el || reduced() || !el.animate) return;
      const animation = el.animate([{ opacity: 0.5, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300, delay, easing: 'ease-out' });
      animations.add(animation);
      animation.onfinish = () => { animations.delete(animation); };
    };
    const format = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v);
    const count = (el: HTMLElement | null, target: number, animate = true) => {
      if (!el) return;
      const previous = Number(el.dataset.number ?? target);
      const old = frames.get(el);
      if (old !== undefined) cancelAnimationFrame(old);
      el.dataset.target = String(target);
      const set = (v: number) => { el.dataset.number = String(v); el.textContent = format(v); };
      if (!animate || reduced() || previous === target) { set(target); return; }
      set(previous);
      const start = performance.now();
      const tick = (time: number) => {
        const t = Math.min(1, (time - start) / 480);
        set(previous + (target - previous) * (1 - (1 - t) ** 3));
        if (t < 1) frames.set(el, requestAnimationFrame(tick));
        else { set(target); frames.delete(el); }
      };
      frames.set(el, requestAnimationFrame(tick));
    };
    const finishMotion = () => {
      animations.forEach(a => { a.cancel(); });
      animations.clear();
      frames.forEach((id, el) => {
        cancelAnimationFrame(id);
        const target = Number(el.dataset.target);
        el.dataset.number = String(target); el.textContent = format(target);
      });
      frames.clear();
    };
    const message = widget.querySelector<HTMLElement>('.slide-widget-message');
    const say = (text: string, animate = true) => {
      if (message) { message.textContent = text; if (animate) pulse(message); }
    };
    const selected = (selector: string, attribute: string, value: string) => {
      controls.querySelectorAll<HTMLButtonElement>(selector).forEach(button => {
        button.setAttribute('aria-pressed', String(button.getAttribute(attribute) === value));
      });
    };
    let advance = (): boolean => false;
    let reset = () => {};
    let choose = (_button: HTMLButtonElement) => {};

    if (config.type === 'steps' || config.type === 'compare') {
      const panels = Array.from(widget.querySelectorAll<HTMLElement>('.slide-widget-state'));
      const previous = controls.querySelector<HTMLButtonElement>('[data-widget-prev]');
      const next = controls.querySelector<HTMLButtonElement>('[data-widget-next]');
      let lastNumber: number | undefined;
      let collapsed = !!config.collapse;
      const show = (value: number, animate = true) => {
        index = Math.max(0, Math.min(value, panels.length - 1));
        panels.forEach((panel, i) => { panel.hidden = collapsed || i !== index; });
        selected('[data-widget-index]', 'data-widget-index', collapsed ? '' : String(index));
        if (previous) previous.disabled = index === 0;
        if (next) next.disabled = index === panels.length - 1;
        progress.textContent = `${index + 1} / ${panels.length}`;
        const panel = panels[index];
        const counter = panel.querySelector<HTMLElement>('[data-number]');
        if (counter) {
          const target = Number(counter.dataset.target ?? counter.dataset.number);
          counter.dataset.number = String(lastNumber ?? target);
          count(counter, target, animate);
          lastNumber = target;
        }
        if (animate) {
          pulse(panel);
          panel.querySelectorAll<HTMLElement>('.slide-widget-row, td, .slide-widget-chip').forEach((el, i) => { pulse(el, i * 50); });
        }
      };
      reset = () => { stop(); finishMotion(); lastNumber = undefined; collapsed = !!config.collapse; show(0, false); };
      advance = () => {
        if (index >= panels.length - 1) return false;
        show(index + 1);
        return index < panels.length - 1;
      };
      choose = button => {
        if (button.hasAttribute('data-widget-prev')) { stop(); show(index - 1); }
        if (button.dataset.widgetIndex !== undefined) {
          stop(); const value = Number(button.dataset.widgetIndex);
          collapsed = !!config.collapse && value === index && !collapsed;
          show(value);
        }
      };
      show(0, false);
    } else if (config.type === 'bars') {
      const refs: (Aggregate | number)[] = config.references ?? ['AVG', 'MAX', 'MIN', 'SUM', 'COUNT'];
      let reference = refs[0], operator: Operator = config.operators?.[0] ?? '>', extra = false;
      const chart = widget.querySelector<HTMLElement>('.slide-widget-chart')!;
      const counter = widget.querySelector<HTMLElement>('.slide-widget-number');
      const line = chart.querySelector<HTMLElement>('.slide-widget-threshold')!;
      const caption = document.createElement('span'); line.append(caption);
      const baseline = document.createElement('div'); baseline.className = 'slide-widget-baseline'; chart.append(baseline);
      const baselineCaption = document.createElement('span'); baseline.append(baselineCaption);
      const update = (animate = true) => {
        const state = calculate(config, reference, operator, extra);
        const existing = Array.from(chart.querySelectorAll<HTMLElement>('.slide-widget-bar'));
        existing.slice(state.values.length).forEach(el => { el.remove(); });
        state.values.forEach((value, i) => {
          let bar = existing[i];
          if (!bar) {
            bar = document.createElement('div'); bar.className = 'slide-widget-bar';
            bar.append(document.createElement('span'), document.createElement('small'));
            chart.insertBefore(bar, line);
            if (animate) pulse(bar);
          }
          bar.style.height = value / state.maximum * 100 + '%';
          bar.classList.toggle('is-match', state.matches[i]);
          bar.children[0].textContent = format(value); bar.children[1].textContent = state.labels[i];
          bar.setAttribute('aria-label', state.labels[i] + ': ' + format(value) + (state.matches[i] ? ', selecionado' : ''));
        });
        line.style.bottom = state.threshold / state.maximum * 100 + '%';
        caption.textContent = String(reference) + ': ' + format(state.threshold);
        const initial = calculate(config, reference, operator, false).threshold;
        baseline.hidden = !extra;
        baseline.style.bottom = initial / state.maximum * 100 + '%';
        baselineCaption.textContent = 'Antes: ' + format(initial);
        count(counter, state.threshold, animate);
        const result = state.labels.filter((_v, i) => state.matches[i]);
        say(config.mode === 'aggregate' ? String(reference) + ' = ' + format(state.threshold)
          : operator + ' ' + String(reference) + ': ' + (result.join(', ') || 'nenhum item'), animate);
        selected('[data-reference]', 'data-reference', String(refs.indexOf(reference)));
        selected('[data-operator]', 'data-operator', operator);
        const add = controls.querySelector<HTMLButtonElement>('[data-widget-extra]');
        if (add) { add.textContent = extra ? 'Remover ' + config.extra!.label : '+ ' + config.extra!.label; add.setAttribute('aria-pressed', String(extra)); }
        chart.setAttribute('aria-label', config.title + '. Referência: ' + format(state.threshold) + '. Selecionados: ' + (result.join(', ') || 'nenhum'));
      };
      choose = button => {
        if (button.dataset.reference !== undefined) reference = refs[Number(button.dataset.reference)];
        if (button.dataset.operator) operator = button.dataset.operator as Operator;
        if (button.hasAttribute('data-widget-extra')) extra = !extra;
        update();
      };
      reset = () => { finishMotion(); reference = refs[0]; operator = config.operators?.[0] ?? '>'; extra = false; update(false); };
      update(false);
    } else if (config.type === 'scan') {
      const rows = Array.from(widget.querySelectorAll<HTMLElement>('.slide-widget-live [data-row]'));
      const chips = Array.from(widget.querySelectorAll<HTMLElement>('.slide-widget-live .slide-widget-chip'));
      const counter = widget.querySelector<HTMLElement>('.slide-widget-number');
      let variant = 0;
      reset = () => {
        stop(); finishMotion(); index = 0;
        rows.forEach(row => { row.classList.remove('is-scan', 'is-match', 'is-muted'); row.querySelector('strong')!.textContent = 'Aguardando'; });
        chips.forEach(chip => { chip.classList.remove('is-match'); });
        count(counter, 0, false); progress.textContent = '0 / ' + rows.length;
        say('Avance ou reproduza a conferência.', false);
        selected('[data-variant]', 'data-variant', String(variant));
      };
      advance = () => {
        if (index >= rows.length) return false;
        rows.forEach(row => { row.classList.remove('is-scan'); });
        const data = config.rows[index], row = rows[index];
        row.classList.add('is-scan'); row.classList.toggle('is-match', !!data.match);
        row.querySelector('strong')!.textContent = data.result; pulse(row);
        chips.forEach(chip => { chip.classList.toggle('is-match', chip.textContent === data.key); });
        index++; count(counter, index); progress.textContent = index + ' / ' + rows.length;
        if (config.variants?.[variant]?.stopAtMatch && data.match) {
          rows.slice(index).forEach(r => { r.classList.add('is-muted'); r.querySelector('strong')!.textContent = 'Não precisa conferir'; });
          say('Primeiro resultado encontrado; a conferência foi interrompida.'); index = rows.length; return false;
        }
        say(index === rows.length ? 'Conferência concluída.' : 'Conferindo ' + data.label + '.');
        return index < rows.length;
      };
      choose = button => { if (button.dataset.variant !== undefined) { variant = Number(button.dataset.variant); reset(); } };
      reset();
    } else if (config.type === 'group') {
      const pool = widget.querySelector<HTMLElement>('.slide-widget-pool')!;
      const items = Array.from(widget.querySelectorAll<HTMLElement>('[data-item]'));
      const groups = Array.from(widget.querySelectorAll<HTMLElement>('[data-group]'));
      const names = [...new Set(config.items.map(item => item.group))];
      let totals = names.map(() => 0);
      reset = () => {
        stop(); finishMotion(); index = 0; totals = names.map(() => 0);
        items.forEach(item => { pool.append(item); });
        groups.forEach(group => { count(group.querySelector('output'), 0, false); });
        progress.textContent = '0 / ' + items.length; say('Distribua os itens e acompanhe os totais.', false);
      };
      advance = () => {
        if (index >= items.length) return false;
        const data = config.items[index], item = items[index], groupIndex = names.indexOf(data.group), group = groups[groupIndex];
        const before = item.getBoundingClientRect();
        group.querySelector('.slide-widget-items')!.append(item);
        const after = item.getBoundingClientRect();
        const scale = group.getBoundingClientRect().width / group.offsetWidth || 1;
        if (!reduced() && item.animate) {
          const animation = item.animate([{ transform: `translate(${(before.left - after.left) / scale}px, ${(before.top - after.top) / scale}px)` }, { transform: 'translate(0, 0)' }], { duration: 480, easing: 'ease-out' });
          animations.add(animation); animation.onfinish = () => { animations.delete(animation); };
        }
        totals[groupIndex] += data.value; count(group.querySelector('output'), totals[groupIndex]);
        index++; progress.textContent = index + ' / ' + items.length;
        say(data.label + ' foi para ' + data.group + '.');
        return index < items.length;
      };
      reset();
    } else if (config.type === 'reference') {
      const tooltip = widget.querySelector<HTMLElement>('.slide-widget-tooltip')!;
      let current: HTMLElement | null = null;
      const owner = Math.random().toString(36).slice(2);
      const eventRoot = config.scope === 'deck' ? root : widget;
      widget.querySelectorAll<HTMLElement>('[data-term]').forEach(term => { term.dataset.refOwner = owner; });
      const annotated = new Set<HTMLElement>();
      const positions = new Map<HTMLElement, string>();
      const hide = () => {
        tooltip.hidden = true; current?.removeAttribute('aria-describedby'); current = null;
      };
      const show = (target: HTMLElement) => {
        hide(); current = target;
        const table = config.tables[Number(target.dataset.term)];
        if (!table) return;
        const title = document.createElement('strong'); title.textContent = table.term;
        const element = document.createElement('table'), head = element.createTHead().insertRow();
        table.headers.forEach(label => { const th = document.createElement('th'); th.textContent = label; head.append(th); });
        const body = element.createTBody();
        table.rows.forEach(row => { const tr = body.insertRow(); row.forEach(value => { tr.insertCell().textContent = String(value ?? 'NULL'); }); });
        tooltip.replaceChildren(title, element); tooltip.hidden = false;
        tooltip.id ||= 'slide-ref-' + Math.random().toString(36).slice(2);
        target.setAttribute('aria-describedby', tooltip.id);
        const host = target.closest<HTMLElement>('.slide-content') ?? widget;
        if (getComputedStyle(host).position === 'static') { positions.set(host, host.style.position); host.style.position = 'relative'; }
        host.append(tooltip);
        const w = host.getBoundingClientRect(), r = target.getBoundingClientRect(), scale = w.width / host.offsetWidth || 1;
        tooltip.style.left = Math.max(0, Math.min((r.left - w.left) / scale, host.clientWidth - tooltip.offsetWidth)) + 'px';
        tooltip.style.top = (r.bottom - w.top) / scale + 4 + 'px';
        if (tooltip.getBoundingClientRect().bottom > window.innerHeight) tooltip.style.top = Math.max(0, (r.top - w.top) / scale - tooltip.offsetHeight - 4) + 'px';
        pulse(tooltip);
      };
      const over = (e: Event) => {
        const target = (e.target as Element).closest<HTMLElement>('[data-term]');
        if (target?.dataset.refOwner === owner) show(target);
      };
      const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { hide(); e.stopPropagation(); } };
      let pending: number | undefined;
      const wrap = () => {
        pending = undefined;
        if (config.scope !== 'deck') return;
        eventRoot.querySelectorAll<HTMLElement>('.slide-content pre code').forEach(code => {
          const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT), nodes: Text[] = [];
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.parentElement?.closest('[data-term]')) nodes.push(node as Text);
          }
          nodes.forEach(text => {
            const parts = (text.textContent ?? '').split(/([a-zA-Z_][a-zA-Z0-9_]*)/);
            if (!parts.some(part => config.tables.some(t => t.term === part))) return;
            const fragment = document.createDocumentFragment();
            parts.forEach(part => {
              const index = config.tables.findIndex(t => t.term === part);
              if (index < 0) { fragment.append(document.createTextNode(part)); return; }
              const button = document.createElement('button');
              button.type = 'button'; button.className = 'slide-widget-term';
              button.dataset.term = String(index); button.dataset.refOwner = owner; button.textContent = part;
              annotated.add(button); fragment.append(button);
            });
            text.replaceWith(fragment);
          });
        });
      };
      const codeObserver = new MutationObserver(() => { if (pending === undefined) pending = requestAnimationFrame(wrap); });
      if (config.scope === 'deck') {
        eventRoot.querySelectorAll('.slide-content pre code').forEach(code => { codeObserver.observe(code, { childList: true, subtree: true, characterData: true }); });
        wrap();
      }
      const moved = new MutationObserver(() => { if (current?.closest('.slide:not(.active)')) hide(); });
      eventRoot.querySelectorAll('.slide').forEach(slide => { moved.observe(slide, { attributes: true, attributeFilter: ['class'] }); });
      const out = (event: Event) => { if ((event.target as Element).closest('[data-ref-owner="' + owner + '"]')) hide(); };
      eventRoot.addEventListener('pointerover', over); eventRoot.addEventListener('focusin', over);
      eventRoot.addEventListener('pointerout', out); eventRoot.addEventListener('focusout', hide);
      eventRoot.addEventListener('keydown', key as EventListener); window.addEventListener('resize', hide);
      cleanups.push(() => {
        codeObserver.disconnect(); moved.disconnect(); if (pending !== undefined) cancelAnimationFrame(pending);
        eventRoot.removeEventListener('pointerover', over); eventRoot.removeEventListener('focusin', over);
        eventRoot.removeEventListener('pointerout', out); eventRoot.removeEventListener('focusout', hide);
        eventRoot.removeEventListener('keydown', key as EventListener); window.removeEventListener('resize', hide); hide();
        annotated.forEach(button => { button.replaceWith(document.createTextNode(button.textContent ?? '')); });
        positions.forEach((position, host) => { host.style.position = position; }); tooltip.remove();
      });
      reset = hide;
    }
    const next = () => { if (!advance()) stop(); };
    const click = (event: Event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button');
      if (!button || !controls.contains(button)) return;
      if (button.hasAttribute('data-widget-reset')) reset();
      else if (button.hasAttribute('data-widget-next')) { stop(); next(); }
      else if (button.hasAttribute('data-widget-play')) {
        if (timer !== undefined) { stop(); return; }
        reset(); if (!advance()) { stop(); return; }
        if (play) { play.textContent = 'Pausar'; play.setAttribute('aria-pressed', 'true'); }
        timer = setInterval(next, 900);
      } else choose(button);
    };
    controls.hidden = controls.childElementCount === 0;
    controls.addEventListener('click', click);
    const slide = widget.closest('.slide');
    const leave = () => { if (slide && !slide.classList.contains('active')) { stop(); finishMotion(); } };
    const observer = new MutationObserver(leave);
    if (slide) observer.observe(slide, { attributes: true, attributeFilter: ['class'] });
    const visibility = () => { if (doc.hidden) { stop(); finishMotion(); } };
    doc.addEventListener('visibilitychange', visibility);
    window.addEventListener('beforeprint', stop);
    cleanups.push(() => {
      stop(); finishMotion(); observer.disconnect();
      controls.removeEventListener('click', click); doc.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('beforeprint', stop); delete widget.dataset.widgetMounted;
      controls.hidden = true;
      widget.querySelectorAll<HTMLElement>('.slide-widget-state').forEach(panel => { panel.hidden = false; });
      progress.textContent = '';
    });
  });
  const answers = Array.from(root.querySelectorAll<HTMLDetailsElement>('details.gab'));
  const saved = new Map<HTMLDetailsElement, { open: boolean; name: string | null }>();
  const printAnswers = () => {
    if (saved.size) return;
    answers.forEach(answer => { saved.set(answer, { open: answer.open, name: answer.getAttribute('name') }); answer.removeAttribute('name'); answer.open = true; });
  };
  const restoreAnswers = () => {
    saved.forEach((state, answer) => { answer.open = state.open; if (state.name !== null) answer.setAttribute('name', state.name); });
    saved.clear();
  };
  window.addEventListener('beforeprint', printAnswers); window.addEventListener('afterprint', restoreAnswers);
  cleanups.push(() => {
    window.removeEventListener('beforeprint', printAnswers); window.removeEventListener('afterprint', restoreAnswers); restoreAnswers();
  });
  return () => { cleanups.forEach(cleanup => { cleanup(); }); };
}
