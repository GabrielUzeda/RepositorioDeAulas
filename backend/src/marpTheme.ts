export type ThemeKey = 'default' | 'dark' | 'light'

export const THEME_KEYS = ['default', 'dark', 'light'] as const

export const THEME_LABELS: Record<ThemeKey, string> = {
  default: 'Default',
  dark: 'Dark',
  light: 'Light',
}

export const NEXT_THEME: Record<ThemeKey, ThemeKey> = {
  default: 'dark',
  dark: 'light',
  light: 'default',
}

export function normalizeTheme(input: string | undefined | null): ThemeKey {
  if (input === 'high-contrast') return 'default'
  if (input === 'dark' || input === 'light') return input
  return 'default'
}
