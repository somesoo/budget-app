import { useState } from 'react'
import { CURRENCY_SUFFIX } from '../../config'
import { formatAmount } from '../../lib/calculations'
import type { CategoryDelta } from '../../lib/insights'
import { CHART } from './theme'

interface Props {
  deltas: CategoryDelta[]
  currentLabel: string
  previousLabel: string
}

// space kept at each bar's outer end for its value label
const LABEL_ROOM = 46

function signed(n: number): string {
  if (n === 0) return '±0'
  return `${n > 0 ? '+' : '−'}${formatAmount(Math.abs(n))}`
}

/**
 * Change per category vs the previous month, centred on zero: right = spent
 * more (warm), left = spent less (cool). The category is named on every row —
 * never identified by color — and the sign is in the label, so polarity isn't
 * color-alone either. Tap a row for both months' totals.
 */
export function CategoryDeltaBars({ deltas, currentLabel, previousLabel }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const maxAbs = Math.max(...deltas.map((d) => Math.abs(d.delta)), 1)

  return (
    <ul className="space-y-1">
      {deltas.map((d) => {
        const share = Math.abs(d.delta) / maxAbs
        const more = d.delta > 0
        const isOpen = open === d.category.id
        const barWidth = `calc((50% - ${LABEL_ROOM}px) * ${share})`

        return (
          <li key={d.category.id}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : d.category.id)}
              aria-expanded={isOpen}
              className={`flex w-full items-center gap-2 rounded-xl px-1 py-1.5 text-left transition ${
                isOpen ? 'bg-white/5' : 'active:bg-white/5'
              }`}
            >
              <span className="w-24 shrink-0 truncate text-[13px] text-slate-200">
                {d.category.name}
              </span>

              <span className="relative h-5 flex-1">
                {/* zero line */}
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-1/2 w-px"
                  style={{ backgroundColor: CHART.baseline }}
                />
                {d.delta !== 0 && (
                  <span
                    aria-hidden
                    className="absolute top-1/2 h-3.5 -translate-y-1/2"
                    style={{
                      width: barWidth,
                      backgroundColor: more ? CHART.more : CHART.less,
                      // rounded data end, square at the zero line
                      ...(more
                        ? { left: 'calc(50% + 1px)', borderRadius: '0 4px 4px 0' }
                        : { right: 'calc(50% + 1px)', borderRadius: '4px 0 0 4px' }),
                    }}
                  />
                )}
                <span
                  className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-semibold tabular-nums text-white"
                  style={
                    d.delta >= 0
                      ? { left: `calc(50% + 6px + ${barWidth})` }
                      : { right: `calc(50% + 6px + ${barWidth})` }
                  }
                >
                  {signed(d.delta)}
                </span>
              </span>
            </button>

            {isOpen && (
              <p className="px-1 pb-1.5 pl-[6.75rem] text-xs text-muted tabular-nums">
                {currentLabel}{' '}
                <span className="font-semibold text-white">
                  {formatAmount(d.current)} {CURRENCY_SUFFIX}
                </span>{' '}
                · {previousLabel} {formatAmount(d.previous)} {CURRENCY_SUFFIX}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
