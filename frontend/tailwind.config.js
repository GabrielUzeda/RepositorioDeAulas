/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },

      colors: {
        /* Surfaces */
        canvas:       'var(--c-canvas)',
        surface:      'var(--c-surface)',
        'surface-alt':'var(--c-surface-alt)',

        /* Text */
        primary:      'var(--c-primary)',
        secondary:    'var(--c-secondary)',
        muted:        'var(--c-muted)',

        /* Borders */
        line:         'var(--c-line)',
        'line-strong':'var(--c-line-strong)',

        /* Accent / Action */
        accent:       'var(--c-accent)',
        'accent-hover':'var(--c-accent-hover)',
        'accent-light':'var(--c-accent-light)',
        'accent-text': 'var(--c-accent-text)',
        'on-accent':  'var(--c-on-accent)',

        /* Danger */
        danger:         'var(--c-danger)',
        'danger-hover': 'var(--c-danger-hover)',
        'danger-light': 'var(--c-danger-light)',
        'danger-text':  'var(--c-danger-text)',
        'on-danger':    'var(--c-on-danger)',

        /* Success */
        success:         'var(--c-success)',
        'success-light': 'var(--c-success-light)',
        'success-text':  'var(--c-success-text)',
        'on-success':    'var(--c-on-success)',

        /* Warning */
        warning:         'var(--c-warning)',
        'warning-light': 'var(--c-warning-light)',
        'warning-text':  'var(--c-warning-text)',

        /* Activity categories */
        'cat-minigame':    'var(--c-cat-minigame)',
        'cat-minigame-bg': 'var(--c-cat-minigame-bg)',
        'cat-roleta':      'var(--c-cat-roleta)',
        'cat-roleta-bg':   'var(--c-cat-roleta-bg)',
        'cat-reforco':     'var(--c-cat-reforco)',
        'cat-reforco-bg':  'var(--c-cat-reforco-bg)',
        'cat-default':     'var(--c-cat-default)',
        'cat-default-bg':  'var(--c-cat-default-bg)',
      },

      borderRadius: {
        xs:      '0.25rem',   /* 4px  */
        sm:      '0.375rem',  /* 6px  */
        control: '0.375rem',  /* 6px  — alias legado */
        md:      '0.5rem',    /* 8px  */
        card:    '0.5rem',    /* 8px  — alias legado */
        lg:      '0.75rem',   /* 12px */
        xl:      '1rem',      /* 16px */
        '2xl':   '1.5rem',    /* 24px */
        modal:   '1.5rem',    /* 24px — alias legado */
        full:    '9999px',
        pill:    '9999px',    /* alias legado */
      },

      boxShadow: {
        xs:    'var(--shadow-xs)',
        sm:    'var(--shadow-sm)',
        card:  'var(--shadow-card)',
        md:    'var(--shadow-md)',
        lg:    'var(--shadow-lg)',
        xl:    'var(--shadow-xl)',
        modal: 'var(--shadow-modal)',
      },

      fontSize: {
        /* Escala tipográfica intencional (Schoger: use more size variation) */
        display: ['2.25rem', { lineHeight: '2.75rem', fontWeight: '700', letterSpacing: '-0.03em' }],
        h1:      ['1.875rem', { lineHeight: '2.25rem', fontWeight: '700', letterSpacing: '-0.025em' }],
        h2:      ['1.5rem',   { lineHeight: '2rem',   fontWeight: '600', letterSpacing: '-0.02em' }],
        h3:      ['1.25rem',  { lineHeight: '1.75rem',fontWeight: '600', letterSpacing: '-0.015em' }],
        body:    ['1rem',     { lineHeight: '1.625rem' }],
        sm:      ['0.875rem', { lineHeight: '1.375rem' }],
        xs:      ['0.8125rem',{ lineHeight: '1.25rem' }],
        caption: ['0.75rem',  { lineHeight: '1.125rem' }],
      },

      spacing: {
        '4.5': '1.125rem',
        '13':  '3.25rem',
        '18':  '4.5rem',
        '22':  '5.5rem',
      },

      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
      },

      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
