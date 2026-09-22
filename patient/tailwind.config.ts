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
        canvas: {
          DEFAULT: 'var(--color-canvas)',
          subtle: 'var(--color-canvas-subtle)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          container: 'var(--color-surface-container)',
          'container-high': 'var(--color-surface-container-high)',
          'container-highest': 'var(--color-surface-container-highest)',
          dark: 'var(--color-surface-dark)',
          'dark-card': 'var(--color-surface-dark-card)',
          glass: 'var(--glass-bg)',
        },
        outline: {
          DEFAULT: 'var(--color-outline)',
          variant: 'var(--color-outline-variant)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          container: 'var(--color-primary-container)',
        },
        'on-primary': {
          DEFAULT: 'var(--color-on-primary)',
          container: 'var(--color-on-primary-container)',
        },
        teal: {
          DEFAULT: 'var(--color-teal)',
          container: 'var(--color-teal-container)',
          'on-container': 'var(--color-on-teal-container)',
        },
        content: {
          primary: 'var(--color-on-surface)',
          secondary: 'var(--color-on-surface-variant)',
          muted: 'var(--color-on-surface-muted)',
          inverse: 'var(--color-surface)',
        },
      },
      fontFamily: {
        sans: ['Google Sans Flex', 'Google Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['Google Sans Code', 'monospace'],
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
