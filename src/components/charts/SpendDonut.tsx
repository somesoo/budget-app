import { useState } from 'react'
import { CURRENCY_SUFFIX } from '../../config'
import { formatAmount } from '../../lib/calculations'
import type { CategorySlice } from '../../lib/insights'
import { CHART } from './theme'
import { t } from '../../i18n'

interface Props {
  /** Biggest first — see categorySlices(). */
  slices: CategorySlice[]
}

const SIZE = 128
const THICKNESS = 14
const RADIUS = (SIZE - THICKNESS) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** What separates neighbouring arcs is a gap in the surface, never a stroke. */
const GAP = 2
/** The painted ring is too thin to aim a thumb at, so the hit area is wider. */
const HIT_THICKNESS = THICKNESS + 18

/** The folded tail isn't one category, so it gets the chart's neutral instead of a hue. */
const REST_COLOR = CHART.deemphasisActive

function sharePercent(share: number): string {
  const percent = share * 100
  return percent < 1 ? '<1%' : `${Math.round(percent)}%`
}

/**
 * Where the month's money went, as a donut with a ranked legend.
 *
 * Category colors are the app's identity channel on this screen — the tiles
 * underneath carry the same ones — but they're user-editable and don't survive
 * the colorblind check (see theme.ts), so nothing here is identified by color
 * alone: every slice is named in the legend and in the middle of the ring.
 * The biggest category is shown by default, which is the question the chart is
 * here to answer; tapping a slice or a legend row switches to that one.
 */
export function SpendDonut({ slices }: Props) {
  const [active, setActive] = useState<string | null>(null)
  const shown = slices.find((s) => s.id === active) ?? slices[0]

  let travelled = 0
  const arcs = slices.map((slice) => {
    const length = slice.share * CIRCUMFERENCE
    const arc = {
      slice,
      color: slice.color ?? REST_COLOR,
      // a slice thinner than the gap would otherwise vanish entirely
      dash: Math.max(length - GAP, 1),
      offset: travelled,
    }
    travelled += length
    return arc
  })

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden className="block">
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {arcs.map(({ slice, color, dash, offset }) => (
              <g
                key={slice.id}
                className="cursor-pointer"
                onPointerDown={() => setActive(active === slice.id ? null : slice.id)}
              >
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={color}
                  strokeWidth={THICKNESS}
                  strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                  strokeDashoffset={-offset}
                  className="transition-opacity duration-200"
                  opacity={active && active !== slice.id ? 0.35 : 1}
                />
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={HIT_THICKNESS}
                  strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                  strokeDashoffset={-offset}
                />
              </g>
            ))}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
          <span className="w-full truncate text-[11px] leading-tight text-muted">{shown.name}</span>
          <span className="text-xl font-bold leading-tight tabular-nums text-white">
            {sharePercent(shown.share)}
          </span>
          <span className="w-full truncate text-[11px] leading-tight tabular-nums text-slate-300">
            {formatAmount(shown.amount)} {CURRENCY_SUFFIX}
          </span>
        </div>
      </div>

      <ul className="min-w-0 flex-1" aria-label={t('charts.donutList')}>
        {arcs.map(({ slice, color }) => (
          <li key={slice.id}>
            <button
              type="button"
              onClick={() => setActive(active === slice.id ? null : slice.id)}
              aria-pressed={active === slice.id}
              className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-[5px] text-left transition ${
                slice.id === shown.id ? 'bg-white/5' : 'active:bg-white/5'
              }`}
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className="min-w-0 flex-1 truncate text-[13px] text-slate-200">
                {slice.name}
              </span>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums text-white">
                {formatAmount(slice.amount)}{' '}
                <span className="font-normal text-muted">{CURRENCY_SUFFIX}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
