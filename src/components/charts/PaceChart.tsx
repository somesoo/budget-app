import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useElementWidth } from '../../hooks/useElementWidth'
import { formatDayShort, formatMoney, type MonthKey } from '../../lib/calculations'
import { compactAmount, niceScale, type PacePoint } from '../../lib/insights'
import { ChartTooltip, TooltipRow } from './ChartCard'
import { AXIS_FONT, CHART } from './theme'
import { t } from '../../i18n'

interface Props {
  month: MonthKey
  points: PacePoint[]
  showPace: boolean
  /** Height of the plot itself, in px; smaller where it shares the screen. */
  plotHeight?: number
}

const PLOT_H = 150
const TOP = 24 // room for the end label
const AXIS_BAND = 22
const LEFT = 36
const RIGHT = 14

/**
 * Cumulative spending through the month (the series that matters, in the
 * accent) against the limit: fixed costs from day 1, the rest spread evenly
 * (dashed — it's a threshold, not data). Scrub with a finger or the arrow keys.
 */
export function PaceChart({ month, points, showPace, plotHeight = PLOT_H }: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>()
  const plotH = plotHeight
  const [active, setActive] = useState<number | null>(null)

  const days = points.length
  const elapsed = points.filter((p) => p.cumulative !== null)
  const last = elapsed[elapsed.length - 1]

  const peak = Math.max(
    last?.cumulative ?? 0,
    showPace ? points[days - 1]?.pace ?? 0 : 0,
  )
  const { max, step } = niceScale(peak)
  const plotW = Math.max(width - LEFT - RIGHT, 10)
  const height = TOP + plotH + AXIS_BAND

  const x = (day: number) => LEFT + ((day - 1) / Math.max(days - 1, 1)) * plotW
  const y = (value: number) => TOP + plotH - (value / max) * plotH

  const linePath = elapsed
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.day).toFixed(1)},${y(p.cumulative!).toFixed(1)}`)
    .join(' ')
  const areaPath = last
    ? `${linePath} L${x(last.day).toFixed(1)},${y(0)} L${x(1).toFixed(1)},${y(0)} Z`
    : ''

  const ticks: number[] = []
  for (let v = 0; v <= max + 0.001; v += step) ticks.push(v)
  const dayTicks = [1, 8, 15, 22].filter((d) => d < days - 3).concat(days)

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left - LEFT) / plotW
    setActive(Math.min(Math.max(Math.round(ratio * (days - 1)) + 1, 1), days))
  }

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const from = active ?? last?.day ?? 1
    setActive(Math.min(Math.max(from + (e.key === 'ArrowRight' ? 1 : -1), 1), days))
  }

  const activePoint = active ? points[active - 1] : null
  const [yy, mm] = month.split('-')

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={t('charts.paceLabel')}
          tabIndex={0}
          className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          onPointerDown={pick}
          onPointerMove={pick}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          {/* gridlines + y ticks: hairline, solid, recessive */}
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

          {dayTicks.map((d) => (
            <text
              key={d}
              x={x(d)}
              y={TOP + plotH + 16}
              textAnchor={d === 1 ? 'start' : d === days ? 'end' : 'middle'}
              fontSize={AXIS_FONT}
              fill={CHART.textMuted}
              className="tabular-nums"
            >
              {d}
            </text>
          ))}

          {showPace && (
            <line
              x1={x(1)}
              y1={y(points[0].pace)}
              x2={x(days)}
              y2={y(points[days - 1].pace)}
              stroke={CHART.textMuted}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              strokeLinecap="round"
            />
          )}

          {last && (
            <>
              <path d={areaPath} fill={CHART.accent} fillOpacity={0.12} />
              <path
                d={linePath}
                fill="none"
                stroke={CHART.accent}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </>
          )}

          {/* crosshair */}
          {activePoint && (
            <g pointerEvents="none">
              <line
                x1={x(activePoint.day)}
                x2={x(activePoint.day)}
                y1={TOP}
                y2={TOP + plotH}
                stroke={CHART.textSecondary}
                strokeOpacity={0.5}
                strokeWidth={1}
              />
              {showPace && (
                <circle
                  cx={x(activePoint.day)}
                  cy={y(activePoint.pace)}
                  r={4}
                  fill={CHART.textMuted}
                  stroke={CHART.surface}
                  strokeWidth={2}
                />
              )}
              {activePoint.cumulative !== null && (
                <circle
                  cx={x(activePoint.day)}
                  cy={y(activePoint.cumulative)}
                  r={4.5}
                  fill={CHART.accent}
                  stroke={CHART.surface}
                  strokeWidth={2}
                />
              )}
            </g>
          )}

          {/* end dot + the one direct label: where we are today */}
          {last && !activePoint && (
            <g pointerEvents="none">
              <circle
                cx={x(last.day)}
                cy={y(last.cumulative!)}
                r={4.5}
                fill={CHART.accent}
                stroke={CHART.surface}
                strokeWidth={2}
              />
              <text
                x={x(last.day)}
                y={y(last.cumulative!) - 10}
                textAnchor={x(last.day) > LEFT + plotW - 40 ? 'end' : 'middle'}
                fontSize={12}
                fontWeight={600}
                fill={CHART.textPrimary}
              >
                {compactAmount(last.cumulative!)}
              </text>
            </g>
          )}
        </svg>
      )}

      {activePoint && (
        <ChartTooltip
          x={x(activePoint.day)}
          y={Math.min(
            activePoint.cumulative !== null ? y(activePoint.cumulative) : Infinity,
            showPace ? y(activePoint.pace) : Infinity,
            TOP + plotH,
          )}
          width={width}
        >
          <p className="mb-1 text-slate-400">
            {formatDayShort(`${yy}-${mm}-${String(activePoint.day).padStart(2, '0')}`)}
          </p>
          <TooltipRow
            color={CHART.accent}
            label={t('common.spent')}
            value={
              activePoint.cumulative !== null
                ? formatMoney(activePoint.cumulative)
                : t('charts.notYet')
            }
          />
          {showPace && (
            <TooltipRow
              color={CHART.textMuted}
              dashed
              label={t('charts.pace')}
              value={formatMoney(activePoint.pace)}
            />
          )}
        </ChartTooltip>
      )}
    </div>
  )
}
