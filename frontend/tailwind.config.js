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
      },
    },
  },
  plugins: [],
}
