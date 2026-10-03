import { useState } from 'react'
import { useElementWidth } from '../../hooks/useElementWidth'
import { formatMoneyWhole, formatMonth, formatMonthShort } from '../../lib/calculations'
import { compactAmount } from '../../lib/insights'
import type { NetWorthPoint } from '../../lib/wealth'
import { ChartCard } from '../charts/ChartCard'
import { AXIS_FONT, CHART } from '../charts/theme'
import { t } from '../../i18n'

const PLOT_H = 120
/** Room above the plot for the top axis label. */
const TOP = 10
const AXIS_BAND = 20
const LEFT = 40

/**
 * Net worth: everything on the savings accounts minus everything owed, at
 * each month's end. Bars go below the line when the debts are bigger, which
 * with a mortgage is normal for years; what matters is that they climb.
 */
export function NetWorthCard({
  points,
  debtsKnownFrom,
}: {
  points: NetWorthPoint[]
  /** Before this month some debt wasn't logged yet, so it isn't counted there. */
  debtsKnownFrom: string | null
}) {
  const now = points[points.length - 1]
  // compare like with like: from when every debt was known, and there was anything at all
  const first =
    points.find(
      (p) => (p.assets !== 0 || p.debts !== 0) && (!debtsKnownFrom || p.month >= debtsKnownFrom),
    ) ?? now
  const partial = !!debtsKnownFrom && debtsKnownFrom > points[0].month
  const change = now.net - first.net
  const since = formatMonth(first.month)

  return (
    <ChartCard
      title={t('netWorth.title')}
      headline={
        <>
          <span className="block text-3xl font-bold tabular-nums text-white">
            {formatMoneyWhole(now.net)}
          </span>
          <span className="mt-1 block text-sm text-slate-300">
            {t('netWorth.split', {
              assets: formatMoneyWhole(now.assets),
              debts: formatMoneyWhole(now.debts),
            })}
            {first.month !== now.month &&
              ` ${change >= 0 ? t('netWorth.up', { amount: formatMoneyWhole(change), since }) : t('netWorth.down', { amount: formatMoneyWhole(-change), since })}`}
          </span>
        </>
      }
      table={{
        head: [t('netWorth.month'), t('netWorth.assets'), t('netWorth.debts'), t('netWorth.net')],
        rows: points.map((p) => [
          formatMonth(p.month),
          formatMoneyWhole(p.assets),
          formatMoneyWhole(p.debts),
          formatMoneyWhole(p.net),
        ]),
      }}
    >
      <Bars points={points} />
      {partial && <p className="mt-1 text-xs leading-snug text-muted">{t('netWorth.debtsFrom')}</p>}
    </ChartCard>
  )
}

function Bars({ points }: { points: NetWorthPoint[] }) {
  const { ref, width } = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const values = points.map((p) => p.net)
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)
  const span = max - min || 1
  const y = (v: number) => TOP + ((max - v) / span) * PLOT_H
  const plotW = Math.max(0, width - LEFT)
  const slot = plotW / points.length
  const bar = Math.min(22, slot * 0.6)
  const shown = active ?? points.length - 1
  // about six month labels, the last one always, none crowding it
  const step = Math.ceil(points.length / 6)

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg width={width} height={TOP + PLOT_H + AXIS_BAND} role="img" aria-label={t('netWorth.chartLabel')}>
          {[max, 0, min]
            .filter((v, i, a) => a.indexOf(v) === i)
            .map((v) => (
              <g key={v}>
                <line
                  x1={LEFT}
                  x2={width}
                  y1={y(v)}
                  y2={y(v)}
                  stroke={v === 0 ? CHART.baseline : CHART.grid}
                />
                <text
                  x={LEFT - 6}
                  y={y(v) + 4}
                  textAnchor="end"
                  fontSize={AXIS_FONT}
                  fill={CHART.textMuted}
                >
                  {compactAmount(v)}
                </text>
              </g>
            ))}
          {points.map((p, i) => {
            const x = LEFT + slot * i + (slot - bar) / 2
            const top = y(Math.max(0, p.net))
            const h = Math.abs(y(p.net) - y(0))
            const isLast = i === points.length - 1
            return (
              <g key={p.month}>
                <rect
                  x={x}
                  y={top}
                  width={bar}
                  height={Math.max(h, p.net === 0 ? 0 : 1)}
                  rx={3}
                  fill={p.net < 0 ? CHART.more : isLast || i === active ? CHART.accent : CHART.deemphasis}
                  opacity={p.net < 0 && !(isLast || i === active) ? 0.6 : 1}
                />
                {((i % step === 0 && points.length - 1 - i >= step) || isLast) && (
                  <text
                    x={x + bar / 2}
                    y={TOP + PLOT_H + 15}
                    textAnchor="middle"
                    fontSize={AXIS_FONT}
                    fill={CHART.textMuted}
                  >
                    {formatMonthShort(p.month)}
                  </text>
                )}
                <rect
                  x={LEFT + slot * i}
                  y={0}
                  width={slot}
                  height={TOP + PLOT_H + AXIS_BAND}
                  fill="transparent"
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onClick={() => setActive(i)}
                />
              </g>
            )
          })}
        </svg>
      )}
      <p className="mt-1 text-xs tabular-nums text-muted" aria-live="polite">
        {formatMonth(points[shown].month)}: {formatMoneyWhole(points[shown].net)}
      </p>
    </div>
  )
}
