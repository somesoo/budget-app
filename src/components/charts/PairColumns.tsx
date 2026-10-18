import { useState, type ReactNode } from 'react'
import { useElementWidth } from '../../hooks/useElementWidth'
import { compactAmount, niceScale } from '../../lib/insights'
import { ChartTooltip } from './ChartCard'
import { AXIS_FONT, CHART } from './theme'

export interface ColumnPair {
  key: string
  label: string
  /** Drawn first, as context (e.g. what came in). */
  context: number
  /** Drawn second, in the accent: the series the chart is about (e.g. what went out). */
  value: number
  tooltip: ReactNode
}

const PLOT_H = 140
const TOP = 12
const AXIS_BAND = 22
const LEFT = 36
const RIGHT = 8
const MAX_BAR = 14
const GAP = 2
const MIN_LABEL_W = 30

/**
 * Two columns a band: context in gray, the story in the accent, side by side
 * so their heights compare directly. Tap a band for both numbers.
 */
export function PairColumns({ pairs, ariaLabel }: { pairs: ColumnPair[]; ariaLabel: string }) {
  const { ref, width } = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<string | null>(null)

  const peak = Math.max(...pairs.flatMap((p) => [p.context, p.value]), 0)
  const { max, step } = niceScale(peak)
  const plotW = Math.max(width - LEFT - RIGHT, 10)
  const band = plotW / Math.max(pairs.length, 1)
  const barW = Math.min(MAX_BAR, (band * 0.7 - GAP) / 2)
  const labelEvery = Math.max(1, Math.ceil(MIN_LABEL_W / band))
  const height = TOP + PLOT_H + AXIS_BAND

  const y = (v: number) => TOP + PLOT_H - (Math.max(v, 0) / max) * PLOT_H
  const bandX = (i: number) => LEFT + i * band
  const ticks: number[] = []
  for (let v = 0; v <= max + 0.001; v += step) ticks.push(v)

  const activeIndex = pairs.findIndex((p) => p.key === active)
  const activePair = activeIndex >= 0 ? pairs[activeIndex] : null

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
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={LEFT}
                x2={LEFT + plotW}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 0 ? CHART.baseline : CHART.grid}
                strokeWidth={1}
              />
              <text
                x={LEFT - 6}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                fontSize={AXIS_FONT}
                fill={CHART.textMuted}
                className="tabular-nums"
              >
                {compactAmount(tick)}
              </text>
            </g>
          ))}

          {pairs.map((p, i) => {
            const isActive = p.key === active
            const x0 = bandX(i) + (band - (barW * 2 + GAP)) / 2
            return (
              <g
                key={p.key}
                role="button"
                tabIndex={0}
                aria-label={`${p.label}: ${compactAmount(p.context)} / ${compactAmount(p.value)}`}
                className="cursor-pointer outline-none"
                onPointerDown={() => setActive(p.key)}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(p.key)}
                onFocus={() => setActive(p.key)}
                onBlur={() => setActive(null)}
              >
                <rect x={bandX(i)} y={TOP} width={band} height={PLOT_H} fill="transparent" />
                <rect
                  x={x0}
                  y={y(p.context)}
                  width={barW}
                  height={y(0) - y(p.context)}
                  rx={Math.min(3, barW / 2)}
                  fill={isActive ? CHART.deemphasisActive : CHART.deemphasis}
                />
                <rect
                  x={x0 + barW + GAP}
                  y={y(p.value)}
                  width={barW}
                  height={y(0) - y(p.value)}
                  rx={Math.min(3, barW / 2)}
                  fill={CHART.accent}
                  opacity={isActive ? 0.85 : 1}
                />
                {i % labelEvery === 0 && (
                  <text
                    x={bandX(i) + band / 2}
                    y={TOP + PLOT_H + 16}
                    textAnchor="middle"
                    fontSize={AXIS_FONT}
                    fill={CHART.textMuted}
                  >
                    {p.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}

      {activePair && (
        <ChartTooltip
          x={bandX(activeIndex) + band / 2}
          y={y(Math.max(activePair.context, activePair.value))}
          width={width}
        >
          {activePair.tooltip}
        </ChartTooltip>
      )}
    </div>
  )
}
