import { useState, type ReactNode } from 'react'
import { useElementWidth } from '../../hooks/useElementWidth'
import { compactAmount, niceScale } from '../../lib/insights'
import { ChartTooltip } from './ChartCard'
import { AXIS_FONT, CHART } from './theme'

export interface Column {
  key: string
  label: string
  value: number
  tooltip: ReactNode
}

interface Props {
  columns: Column[]
  /** The column the story is about — drawn in the accent, the rest recede. */
  emphasize?: string
  /** Optional threshold (e.g. the monthly limit), drawn dashed. */
  reference?: { value: number; label: string }
  ariaLabel: string
  /** Height of the plot itself, in px; smaller where it shares the screen. */
  plotHeight?: number
}

const PLOT_H = 140
const TOP = 22 // room for the cap label
const AXIS_BAND = 22
const LEFT = 36
const RIGHT = 8
const MAX_BAR = 24
const RADIUS = 4
/** Room an axis label needs before its neighbour's. */
const MIN_LABEL_W = 30

/** Column with a rounded data end and a square foot on the baseline. */
function columnPath(x: number, top: number, w: number, bottom: number): string {
  const h = bottom - top
  if (h <= 0.5) return ''
  const r = Math.min(RADIUS, w / 2, h)
  return [
    `M${x},${bottom}`,
    `L${x},${top + r}`,
    `Q${x},${top} ${x + r},${top}`,
    `L${x + w - r},${top}`,
    `Q${x + w},${top} ${x + w},${top + r}`,
    `L${x + w},${bottom}`,
    'Z',
  ].join(' ')
}

/**
 * Emphasis columns: one highlighted column carries the story and its value;
 * the others are context in gray. Tap (or focus) any column for its tooltip.
 */
export function ColumnChart({
  columns,
  emphasize,
  reference,
  ariaLabel,
  plotHeight = PLOT_H,
}: Props) {
  const plotH = plotHeight
  const { ref, width } = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<string | null>(null)

  const peak = Math.max(...columns.map((c) => c.value), reference?.value ?? 0)
  const { max, step } = niceScale(peak)
  const plotW = Math.max(width - LEFT - RIGHT, 10)
  const band = plotW / columns.length
  const barW = Math.min(MAX_BAR, band * 0.6)
  // narrow columns (years of months) share their labels: every n-th one is named
  const labelEvery = Math.max(1, Math.ceil(MIN_LABEL_W / band))
  const height = TOP + plotH + AXIS_BAND

  const y = (v: number) => TOP + plotH - (v / max) * plotH
  const bandX = (i: number) => LEFT + i * band

  const ticks: number[] = []
  for (let v = 0; v <= max + 0.001; v += step) ticks.push(v)

  const activeIndex = columns.findIndex((c) => c.key === active)
  const activeColumn = activeIndex >= 0 ? columns[activeIndex] : null

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="group"
          aria-label={ariaLabel}
          className="block"
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
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

          {reference && reference.value > 0 && (
            <g pointerEvents="none">
              <line
                x1={LEFT}
                x2={LEFT + plotW}
                y1={y(reference.value)}
                y2={y(reference.value)}
                stroke={CHART.textMuted}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                strokeLinecap="round"
              />
            </g>
          )}

          {columns.map((c, i) => {
            const emphasized = c.key === emphasize
            const isActive = c.key === active
            const x = bandX(i) + (band - barW) / 2
            const fill = emphasized
              ? CHART.accent
              : isActive
                ? CHART.deemphasisActive
                : CHART.deemphasis
            return (
              <g
                key={c.key}
                role="button"
                tabIndex={0}
                aria-label={`${c.label}: ${compactAmount(c.value)}`}
                className="cursor-pointer outline-none"
                onPointerDown={() => setActive(c.key)}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(c.key)}
                onFocus={() => setActive(c.key)}
                onBlur={() => setActive(null)}
              >
                {/* hit target: the whole band, not just the painted bar */}
                <rect x={bandX(i)} y={TOP} width={band} height={plotH} fill="transparent" />
                <path
                  d={columnPath(x, y(c.value), barW, y(0))}
                  fill={fill}
                  opacity={isActive && emphasized ? 0.85 : 1}
                />
                {(i % labelEvery === 0 || emphasized) && (
                  <text
                    x={bandX(i) + band / 2}
                    y={TOP + plotH + 16}
                    textAnchor="middle"
                    fontSize={AXIS_FONT}
                    fontWeight={emphasized ? 600 : 400}
                    fill={emphasized ? CHART.textSecondary : CHART.textMuted}
                  >
                    {c.label}
                  </text>
                )}
                {/* selective direct label: only the emphasized column's cap */}
                {emphasized && c.value > 0 && !activeColumn && (
                  <text
                    x={bandX(i) + band / 2}
                    y={y(c.value) - 7}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={600}
                    fill={CHART.textPrimary}
                  >
                    {compactAmount(c.value)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}

      {activeColumn && (
        <ChartTooltip
          x={bandX(activeIndex) + band / 2}
          y={y(activeColumn.value)}
          width={width}
        >
          {activeColumn.tooltip}
        </ChartTooltip>
      )}
    </div>
  )
}
