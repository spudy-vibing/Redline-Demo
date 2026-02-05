/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Redline dark command center palette
        neutral: {
          950: '#09090b',
          900: '#0c0c0f',
          850: '#111114',
          800: '#18181b',
          700: '#27272a',
          600: '#3f3f46',
          500: '#52525b',
          400: '#71717a',
          300: '#a1a1aa',
          200: '#d4d4d8',
          100: '#f4f4f5',
        },
        // Primary: Redline crimson
        redline: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        // Secondary: Amber/Gold for warnings
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        // Accent: Cool steel blue for info
        steel: {
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
        },
        // Success: Emerald
        emerald: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'Consolas', 'monospace'],
        display: ['Geist', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'glow-red': 'glow-red 2s ease-in-out infinite alternate',
        'scan': 'scan 3s linear infinite',
        'redline': 'redline 4s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(220, 38, 38, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(220, 38, 38, 0.5)' },
        },
        'glow-red': {
          '0%': { boxShadow: '0 0 5px rgba(220, 38, 38, 0.2), inset 0 0 5px rgba(220, 38, 38, 0.1)' },
          '100%': { boxShadow: '0 0 15px rgba(220, 38, 38, 0.4), inset 0 0 10px rgba(220, 38, 38, 0.1)' },
        },
        scan: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        redline: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.8' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(220, 38, 38, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(220, 38, 38, 0.03) 1px, transparent 1px)',
        'gradient-radial': 'radial-gradient(ellipse at center, var(--tw-gradient-stops))',
        'redline-gradient': 'linear-gradient(90deg, transparent, rgba(220, 38, 38, 0.5), transparent)',
      },
      backgroundSize: {
        'grid': '32px 32px',
      },
      boxShadow: {
        'redline': '0 0 0 1px rgba(220, 38, 38, 0.2), 0 4px 20px rgba(220, 38, 38, 0.1)',
        'redline-lg': '0 0 0 1px rgba(220, 38, 38, 0.3), 0 8px 40px rgba(220, 38, 38, 0.15)',
        'inner-glow': 'inset 0 0 20px rgba(220, 38, 38, 0.1)',
      },
    },
  },
  plugins: [],
}
