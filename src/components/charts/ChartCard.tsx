import { useState, type ReactNode } from 'react'
import { CHART } from './theme'

export interface ChartTable {
  head: string[]
  rows: (string | number)[][]
}

interface Props {
  title: string
  /** The one-sentence takeaway — the chart supports it, not the other way round. */
  headline?: ReactNode
  legend?: ReactNode
  table?: ChartTable
  /** Without its own frame and title, inside another card (the Add widgets). */
  bare?: boolean
  children: ReactNode
}

/**
 * Frame for every chart: title, takeaway, optional legend, the chart itself,
 * and a "Show numbers" table twin so no value is only reachable by hovering.
 */
export function ChartCard({ title, headline, legend, table, bare = false, children }: Props) {
  const [showTable, setShowTable] = useState(false)

  if (bare) {
    return (
      <div>
        {headline && <p className="text-sm leading-snug text-slate-200">{headline}</p>}
        {legend && <div className="mt-2">{legend}</div>}
        <div className="mt-2">{children}</div>
      </div>
    )
  }

  return (
    <section
      className="rounded-3xl p-4 ring-1 ring-white/10"
      style={{ backgroundColor: CHART.surface }}
    >
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {headline && <p className="mt-1 text-[15px] leading-snug text-slate-200">{headline}</p>}
      {legend && <div className="mt-3">{legend}</div>}

      <div className="mt-3">{children}</div>

      {table && table.rows.length > 0 && (
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          className="mt-2 text-xs font-medium text-muted underline-offset-2 active:text-white"
        >
          {showTable ? 'Hide numbers' : 'Show numbers'}
        </button>
      )}

      {table && showTable && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-muted">
                {table.head.map((h, i) => (
                  <th key={h} className={`py-1.5 font-medium ${i > 0 ? 'text-right' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums text-slate-200">
              {table.rows.map((row, r) => (
                <tr key={r} className="border-t border-white/5">
                  {row.map((cell, i) => (
                    <td key={i} className={`py-1.5 ${i > 0 ? 'text-right' : ''}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** Legend entry: a short line for lines, a small rect for bars — mirrors the mark. */
export function LegendItem({
  color,
  label,
  shape,
}: {
  color: string
  label: string
  shape: 'line' | 'rect' | 'dashed'
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
      {shape === 'rect' ? (
        <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      ) : (
        <svg aria-hidden width="16" height="4">
          <line
            x1="1"
            x2="15"
            y1="2"
            y2="2"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={shape === 'dashed' ? '3 3' : undefined}
          />
        </svg>
      )}
      {label}
    </span>
  )
}

/**
 * Tooltip pinned above a point and clamped inside the chart. Values lead,
 * labels follow; content is React text, never injected HTML.
 */
export function ChartTooltip({
  x,
  y,
  width,
  children,
}: {
  x: number
  y: number
  width: number
  children: ReactNode
}) {
  const tipWidth = 156
  const left = Math.min(Math.max(x - tipWidth / 2, 0), Math.max(width - tipWidth, 0))
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 rounded-xl bg-slate-950/95 px-3 py-2 text-xs shadow-lg ring-1 ring-white/10"
      style={{ left, top: Math.max(y - 8, 0), width: tipWidth, transform: 'translateY(-100%)' }}
    >
      {children}
    </div>
  )
}

export function TooltipRow({
  color,
  label,
  value,
  dashed,
}: {
  color?: string
  label: string
  value: string
  dashed?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-slate-400">
        {color && (
          <svg aria-hidden width="12" height="4">
            <line
              x1="1"
              x2="11"
              y1="2"
              y2="2"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={dashed ? '3 2' : undefined}
            />
          </svg>
        )}
        {label}
      </span>
      <span className="font-semibold tabular-nums text-white">{value}</span>
    </div>
  )
}
