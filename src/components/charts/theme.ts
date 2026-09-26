/**
 * Chart tokens. Series colors are validated (dataviz validate_palette, dark mode,
 * against CHART.surface): Bubs/Meow and the diverging pair each pass the CVD and
 * normal-vision gates. Category colors are deliberately NOT used as the identity
 * channel in charts — they're user-editable and the seeded set fails CVD
 * separation — so category charts label rows by name.
 */
export const CHART = {
  /** Solid card color, so the 2px ring around dots matches what's behind them. */
  surface: '#1b2335',
  grid: 'rgba(255, 255, 255, 0.07)',
  baseline: 'rgba(255, 255, 255, 0.2)',
  textPrimary: '#ffffff',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  /** The one series the chart is about. */
  accent: '#3987e5',
  /** Context marks next to the accent. */
  deemphasis: '#475569',
  deemphasisActive: '#64748b',
  person: { bubs: '#3987e5', meow: '#d95926' },
  /** Diverging: spent more / less than the comparison period. */
  more: '#e66767',
  less: '#3987e5',
  /** Status — always paired with an icon and words, never color alone. */
  warning: '#fab219',
  good: '#34d399',
} as const

export const AXIS_FONT = 11
