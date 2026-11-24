import type { Config } from 'tailwindcss';

/**
 * Admiralty Modern — Tailwind palette & tokens.
 * Values pull from CSS variables defined in globals.css so we can
 * ship a dark variant later without changing component code.
 */
const admiralty = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* Admiralty palette */
        paper: admiralty('paper'),
        'paper-tint': admiralty('paper-tint'),
        canvas: admiralty('canvas'),
        'canvas-tint': admiralty('canvas-tint'),
        ink: admiralty('ink'),
        'ink-soft': admiralty('ink-soft'),
        'ink-muted': admiralty('ink-muted'),
        navy: admiralty('navy'),
        'navy-hover': admiralty('navy-hover'),
        'navy-ink': admiralty('navy-ink'),
        brass: admiralty('brass'),
        'brass-hover': admiralty('brass-hover'),
        signal: admiralty('signal'),
        moss: admiralty('moss'),
        amber: admiralty('amber'),

        /* Legacy `brand.*` kept so unmigrated components still compile.
           Mapped onto the admiralty navy ramp. Delete once every page
           has been moved onto the admiralty tokens. */
        brand: {
          50:  '#EEF3F8',
          100: '#D7E2EE',
          200: '#A9BFD6',
          300: '#7B9CBE',
          400: '#4D79A6',
          500: '#0B2E4F',
          600: '#0A2644',
          700: '#071C30',
          800: '#051525',
          900: '#040F1C',
          950: '#020A12',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans:    ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        'nav':   '0.14em',
        'label': '0.08em',
      },
      width: {
        sidebar: '248px',
        'sidebar-collapsed': '72px',
      },
      minWidth: {
        sidebar: '248px',
      },
      borderColor: {
        rule:        'rgb(var(--ink) / 0.10)',
        'rule-soft': 'rgb(var(--ink) / 0.06)',
        'rule-strong': 'rgb(var(--ink) / 0.18)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn:  'fadeIn 0.3s ease-in-out',
        slideUp: 'slideUp 0.3s ease-out',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};

export default config;
