import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        surface: '#111827',
        /** Raised panels, and the chart cards (CHART.surface is the same color). */
        card: '#1b2335',
        muted: '#94a3b8',
        /**
         * The one accent: actions, selection, the series a chart is about.
         * `soft` is for text and icons on the dark background, `strong` for text on white.
         */
        accent: { DEFAULT: '#3987e5', soft: '#8ab8f2', strong: '#2563c9' },
        /** Status, not accent: money in, a plan that balances, "less than last month". */
        positive: '#34d399',
      },
      screens: {
        /** A laptop screen that's short on height, like 1366×768 once the browser's bars are drawn. */
        short: { raw: '(max-height: 820px)' },
      },
      fontSize: {
        huge: ['3.25rem', { lineHeight: '1' }],
      },
      keyframes: {
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'tile-in': {
          from: { opacity: '0', transform: 'scale(0.6)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'tile-in': 'tile-in 420ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'rise-in': 'rise-in 420ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'sheet-up': 'sheet-up 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        'fade-in': 'fade-in 180ms ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config
