import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Workshop / Blueprint palette
        paper: {
          DEFAULT: '#FBF7EE',
          50: '#FEFCF7',
          100: '#F6F0E1',
          200: '#EAE0C9',
        },
        ink: {
          DEFAULT: '#0E1525',
          soft: '#2A3447',
          mute: '#6B7280',
          faint: '#A4ACBE',
        },
        vermillion: {
          DEFAULT: '#E25822',
          50: '#FDEDE3',
          100: '#FBD7C2',
          400: '#EF7A48',
          600: '#C6451A',
        },
        kelp: {
          DEFAULT: '#0F9D8B',
          50: '#E2F5F2',
          100: '#C2EAE3',
          400: '#3FB3A4',
        },
        amber: {
          glow: '#F59E0B',
        },
        // Keep existing tokens for backward compat
        'google-blue': '#4285F4',
        'google-red': '#EA4335',
        'google-yellow': '#FBBC05',
        'google-green': '#34A853',
        'glass': 'rgba(255, 255, 255, 0.1)',
        'glass-border': 'rgba(255, 255, 255, 0.2)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      backdropBlur: {
        'glass': '20px',
      },
      boxShadow: {
        'paper': '0 1px 0 rgba(14,21,37,0.04), 0 8px 24px -12px rgba(14,21,37,0.16)',
        'paper-lg': '0 1px 0 rgba(14,21,37,0.05), 0 24px 48px -16px rgba(14,21,37,0.18)',
        'inset-line': 'inset 0 -1px 0 rgba(14,21,37,0.08)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'drift': 'drift 14s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(226,88,34,0.25)' },
          '100%': { boxShadow: '0 0 40px rgba(226,88,34,0.55)' },
        },
        drift: {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '33%': { transform: 'translate(20px, -12px) rotate(2deg)' },
          '66%': { transform: 'translate(-14px, 16px) rotate(-2deg)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
