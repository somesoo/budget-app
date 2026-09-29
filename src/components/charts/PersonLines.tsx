import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useElementWidth } from '../../hooks/useElementWidth'
import { formatMoney } from '../../lib/calculations'
import { compactAmount, niceScale, type PersonMonth } from '../../lib/insights'
import { ChartTooltip, TooltipRow } from './ChartCard'
import { AXIS_FONT, CHART } from './theme'
import { personColor, personIds, personLabel } from '../../lib/people'
import { t } from '../../i18n'

interface Props {
  rows: PersonMonth[]
  monthLabel: (month: string) => string
  /** The last month is still running — its segment is drawn dashed, as not final. */
  partialLast?: boolean
}

const PLOT_H = 140
const TOP = 16
const AXIS_BAND = 22
const LEFT = 36
const RIGHT = 48 // room for the end labels
const MIN_LABEL_GAP = 14

/** Two people, one axis. Scrub for both values at a month. */
export function PersonLines({ rows, monthLabel, partialLast = false }: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const peak = Math.max(...rows.flatMap((r) => personIds().map((p) => (r.by[p] ?? 0))))
  const { max, step } = niceScale(peak)
  const plotW = Math.max(width - LEFT - RIGHT, 10)
  const height = TOP + PLOT_H + AXIS_BAND

  const x = (i: number) => LEFT + (i / Math.max(rows.length - 1, 1)) * plotW
  const y = (v: number) => TOP + PLOT_H - (v / max) * PLOT_H

  const ticks: number[] = []
  for (let v = 0; v <= max + 0.001; v += step) ticks.push(v)

  const lastIndex = rows.length - 1
  const endY = personIds().map((p) => y((rows[lastIndex].by[p] ?? 0)))
  // end labels only when they don't collide — otherwise the legend carries identity
  const endLabelsFit = Math.abs(endY[0] - endY[1]) >= MIN_LABEL_GAP

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left - LEFT) / plotW
    setActive(Math.min(Math.max(Math.round(ratio * lastIndex), 0), lastIndex))
  }

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const from = active ?? lastIndex
    setActive(Math.min(Math.max(from + (e.key === 'ArrowRight' ? 1 : -1), 0), lastIndex))
  }

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={t('charts.personLabel')}
          tabIndex={0}
          className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          onPointerDown={pick}
          onPointerMove={pick}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={LEFT}
                x2={LEFT + plotW}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? CHART.baseline : CHART.grid}
                strokeWidth={1}
              />
              <text
                x={LEFT - 6}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                fontSize={AXIS_FONT}
                fill={CHART.textMuted}
                className="tabular-nums"
              >
                {compactAmount(t)}
              </text>
            </g>
          ))}

          {rows.map((r, i) => (
            <text
              key={r.month}
              x={x(i)}
              y={TOP + PLOT_H + 16}
              textAnchor={i === 0 ? 'start' : i === lastIndex ? 'end' : 'middle'}
              fontSize={AXIS_FONT}
              fill={CHART.textMuted}
            >
              {monthLabel(r.month)}
            </text>
          ))}

          {active !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={TOP}
              y2={TOP + PLOT_H}
              stroke={CHART.textSecondary}
              strokeOpacity={0.5}
              strokeWidth={1}
              pointerEvents="none"
            />
          )}

          {personIds().map((person, p) => {
            const solidUntil = partialLast ? lastIndex - 1 : lastIndex
            const d = rows
              .slice(0, solidUntil + 1)
              .map((r, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y((r.by[person] ?? 0)).toFixed(1)}`)
              .join(' ')
            const dotIndex = active ?? lastIndex
            return (
              <g key={person} pointerEvents="none">
                <path
                  d={d}
                  fill="none"
                  stroke={personColor(person)}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {partialLast && lastIndex > 0 && (
                  <line
                    x1={x(lastIndex - 1)}
                    y1={y((rows[lastIndex - 1].by[person] ?? 0))}
                    x2={x(lastIndex)}
                    y2={y((rows[lastIndex].by[person] ?? 0))}
                    stroke={personColor(person)}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                  />
                )}
                <circle
                  cx={x(dotIndex)}
                  cy={y((rows[dotIndex].by[person] ?? 0))}
                  r={4.5}
                  fill={personColor(person)}
                  stroke={CHART.surface}
                  strokeWidth={2}
                />
                {endLabelsFit && active === null && (
                  <text
                    x={x(lastIndex) + 9}
                    y={endY[p]}
                    dy="0.32em"
                    fontSize={12}
                    fontWeight={600}
                    fill={CHART.textSecondary}
                  >
                    {personLabel(person)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}

      {active !== null && (
        <ChartTooltip
          x={x(active)}
          y={Math.min(...personIds().map((p) => y((rows[active].by[p] ?? 0))))}
          width={width}
        >
          <p className="mb-1 text-slate-400">
            {monthLabel(rows[active].month)}
            {partialLast && active === lastIndex ? ` · ${t('charts.soFar')}` : ''}
          </p>
          {personIds().map((p) => (
            <TooltipRow
              key={p}
              color={personColor(p)}
              label={personLabel(p)}
              value={formatMoney((rows[active].by[p] ?? 0))}
            />
          ))}
        </ChartTooltip>
      )}
    </div>
  )
}
