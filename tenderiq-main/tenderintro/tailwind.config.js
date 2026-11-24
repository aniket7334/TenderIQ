/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Geist"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // "The Broadsheet" palette
        paper: {
          DEFAULT: '#F4EFE5',   // warm cream paper
          deep: '#EBE3D2',      // sub-section / slightly tinted
          card: '#FBF7EE',      // raised card on paper
        },
        ink: {
          DEFAULT: '#15130F',   // body text / dominant
          soft: '#3F3B33',      // muted body
          mute: '#7A736A',      // captions / legends
          fade: '#B0A89C',      // borders, dim labels
        },
        signal: {
          DEFAULT: '#E0531B',   // signal orange — used sparingly
          deep: '#B23E0E',
          glow: '#F2884D',
        },
        navy: {
          DEFAULT: '#0D1B33',   // dark sections
          soft: '#172A4A',
          line: '#23365C',
        },
      },
      letterSpacing: {
        crisp: '-0.025em',
        crisper: '-0.035em',
        dateline: '0.18em',
      },
      animation: {
        ticker: 'ticker 60s linear infinite',
        'ticker-slow': 'ticker 110s linear infinite',
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
        'shimmer-rule': 'shimmer-rule 4s ease-in-out infinite',
      },
      keyframes: {
        ticker: {
          from: { transform: 'translate3d(0,0,0)' },
          to: { transform: 'translate3d(-50%,0,0)' },
        },
        'pulse-dot': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.6)', opacity: '0.45' },
        },
        'shimmer-rule': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
      },
      boxShadow: {
        'cut': '0 1px 0 0 var(--ink-line, rgba(21,19,15,0.12)), 0 0 0 1px rgba(21,19,15,0.06)',
        'cut-lg': '0 2px 0 0 rgba(21,19,15,0.16), 0 0 0 1px rgba(21,19,15,0.08)',
      },
    },
  },
  plugins: [],
};
