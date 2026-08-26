import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-black)',
          dark: 'var(--color-dark)',
          white: 'var(--color-white)',
        },
        surface: {
          DEFAULT: 'var(--color-white)',
          subtle: 'var(--color-gray-50)',
          muted: 'var(--color-gray-100)',
          card: 'var(--color-dark)',
          black: 'var(--color-black)',
          glass: 'var(--glass-bg)',
        },
        border: {
          DEFAULT: 'var(--color-gray-200)',
          subtle: 'var(--color-gray-100)',
          muted: 'var(--color-gray-300)',
          dark: 'var(--color-gray-800)',
          glass: 'var(--glass-border)',
        },
        content: {
          primary: 'var(--color-black)',
          secondary: 'var(--color-gray-700)',
          muted: 'var(--color-gray-400)',
          subtle: 'var(--color-gray-500)',
          inverse: 'var(--color-white)',
          inverseMuted: 'var(--color-gray-300)',
        },
      },
      fontFamily: {
        sans: ['ABCDiatype', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ABCDiatype-Mono', 'monospace'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        glow: 'var(--shadow-glow)',
      },
      spacing: {
        'fluid-sm': 'clamp(1rem, 2vw, 1.5rem)',
        'fluid-md': 'clamp(1.5rem, 3vw, 2.5rem)',
        'fluid-lg': 'clamp(2.5rem, 5vw, 4rem)',
        'fluid-xl': 'clamp(4rem, 8vw, 6rem)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
