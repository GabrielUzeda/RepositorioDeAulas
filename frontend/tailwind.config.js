/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: 'var(--c-surface)',
        'surface-alt': 'var(--c-surface-alt)',
        primary: 'var(--c-primary)',
        secondary: 'var(--c-secondary)',
        line: 'var(--c-line)',
        accent: 'var(--c-accent)',
        danger: 'var(--c-danger)',
        success: 'var(--c-success)',
        'on-success': 'var(--c-on-success)',
        'on-danger': 'var(--c-on-danger)',
        'danger-text': 'var(--c-danger-text)',
        'cat-minigame': 'var(--c-cat-minigame)',
        'cat-minigame-bg': 'var(--c-cat-minigame-bg)',
        'cat-roleta': 'var(--c-cat-roleta)',
        'cat-roleta-bg': 'var(--c-cat-roleta-bg)',
        'cat-reforco': 'var(--c-cat-reforco)',
        'cat-reforco-bg': 'var(--c-cat-reforco-bg)',
        'cat-default': 'var(--c-cat-default)',
        'cat-default-bg': 'var(--c-cat-default-bg)',
      },
      borderRadius: {
        control: '0.375rem',
        card: '0.5rem',
        modal: '1.5rem',
        pill: '9999px',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        modal: '0 20px 25px -5px rgb(0 0 0 / 0.15), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      },
      fontSize: {
        display: ['2rem', { lineHeight: '2.5rem' }],
        h1: ['1.5rem', { lineHeight: '2rem' }],
        h2: ['1.25rem', { lineHeight: '1.75rem' }],
        caption: ['0.75rem', { lineHeight: '1rem' }],
      },
    },
  },
  plugins: [],
}
