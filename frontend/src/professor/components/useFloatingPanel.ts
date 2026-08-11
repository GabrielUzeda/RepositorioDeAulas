import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue';

export function useFloatingPanel() {
  const triggerRef = ref<HTMLElement | null>(null);
  const panelRef = ref<HTMLElement | null>(null);
  const isOpen = ref(false);
  const panelStyle = ref({ left: '-9999px', top: '-9999px' });

  const GAP = 8;

  function position() {
    const trigger = triggerRef.value;
    const panel = panelRef.value;
    if (!trigger || !panel) return;

    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = triggerRect.bottom + GAP;
    const spaceBelow = vh - triggerRect.bottom - GAP;
    const spaceAbove = triggerRect.top - GAP;

    if (spaceBelow < panelRect.height + GAP && spaceAbove > spaceBelow) {
      top = Math.max(GAP, triggerRect.top - panelRect.height - GAP);
    }
    top = Math.max(GAP, Math.min(top, vh - panelRect.height - GAP));

    let left = triggerRect.left;
    if (left + panelRect.width > vw - GAP) {
      left = Math.max(GAP, vw - panelRect.width - GAP);
    }

    panelStyle.value = { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` };
  }

  function open() {
    isOpen.value = true;
    nextTick(position);
  }

  function close() {
    isOpen.value = false;
  }

  function toggle() {
    if (isOpen.value) close();
    else open();
  }

  function handleGlobalClick(event: MouseEvent) {
    const target = event.target as Node;
    if (triggerRef.value?.contains(target)) return;
    if (panelRef.value?.contains(target)) return;
    close();
  }

  function handleViewportChange() {
    if (isOpen.value) position();
  }

  onMounted(() => {
    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleGlobalClick);
    document.removeEventListener('scroll', handleViewportChange, true);
    window.removeEventListener('resize', handleViewportChange);
  });

  return { triggerRef, panelRef, isOpen, panelStyle, open, close, toggle };
}