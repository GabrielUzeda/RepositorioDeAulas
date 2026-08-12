import { ref } from 'vue';

const STORAGE_KEY = 'theme';

const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
const initialTheme = stored === 'light' || stored === 'dark' ? stored : 'dark';

const theme = ref<'light' | 'dark'>(initialTheme);

function applyTheme(value: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (value === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

applyTheme(initialTheme);

export function useTheme() {
  function toggle() {
    const next: 'light' | 'dark' = theme.value === 'dark' ? 'light' : 'dark';
    theme.value = next;
    applyTheme(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next);
    }
  }

  return { theme, toggle };
}
