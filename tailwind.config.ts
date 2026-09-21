import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        surface: '#111827',
        card: '#1b2434',
        muted: '#94a3b8',
      },
      fontSize: {
        huge: ['3.25rem', { lineHeight: '1' }],
      },
    },
  },
  plugins: [],
} satisfies Config
