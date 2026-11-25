const NAVY = {
  50: '#f3f6fb',
  100: '#e4eaf4',
  200: '#c9d4e7',
  300: '#a0b2d2',
  400: '#6d86b3',
  500: '#4a6593',
  600: '#2d4a7c',
  700: '#243d66',
  800: '#1c3052',
  900: '#15243e',
  950: '#0d1628',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
      colors: {
        // Classic premium palette: one deep navy replaces the bright blue/indigo
        // used across the app and warm neutrals.
        brand: NAVY,
        blue: NAVY,
        indigo: NAVY,
        gray: {
          50: '#faf9f7',
          100: '#f3f2ef',
          200: '#e6e4df',
          300: '#d3d0c9',
          400: '#a7a39a',
          500: '#7b776e',
          600: '#5c5952',
          700: '#45433e',
          800: '#2d2c28',
          900: '#1d1c19',
          950: '#11100e',
        },
      },
      width: {
        sidebar: '280px',
        'sidebar-collapsed': '80px',
      },
      minWidth: {
        sidebar: '280px',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)' },
          '100%': { transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in-out',
        slideUp: 'slideUp 0.3s ease-out',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
