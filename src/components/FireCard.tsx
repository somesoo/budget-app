import { FIRE_MULTIPLE, FIRE_REAL_RETURN } from '../config'
import { useSavingsOverview } from '../hooks/useSavings'
import { useTypicalSpending } from '../hooks/useTypicalSpending'
import { currentMonthKey, formatAmount, formatMoneyWhole, shiftMonth } from '../lib/calculations'
import { monthsEndingAt } from '../lib/insights'
import { averageSaving, independence } from '../lib/wealth'
import { CHART } from './charts/theme'
import { t } from '../i18n'

/** Complete months the pace of saving is averaged over. */
const PACE_MONTHS = 6

/**
 * Financial independence: how much would let you live off your savings
 * (FIRE_MULTIPLE years of today's spending, the "4% rule"), how far along
 * you are, and when you'd get there at the pace you've been saving.
 */
export function FireCard() {
  const savings = useSavingsOverview()
  const typical = useTypicalSpending()
  if (!savings.available || typical === null) return null

  const months = monthsEndingAt(shiftMonth(currentMonthKey(), -1), PACE_MONTHS)
  const monthly = averageSaving(savings.movements, months)
  const fi = independence({
    monthlySpending: typical,
    have: savings.total,
    monthlySaving: Math.max(0, monthly),
    multiple: FIRE_MULTIPLE,
    realReturn: FIRE_REAL_RETURN,
  })
  if (!fi) return null
  const pct = Math.min(100, Math.round(fi.progress * 1000) / 10)

  return (
    <section
      aria-labelledby="fire"
      data-tour="fire"
      className="rounded-3xl p-4 ring-1 ring-white/10"
      style={{ backgroundColor: CHART.surface }}
    >
      <h2 id="fire" className="text-base font-semibold text-white">
        {t('fire.title')}
      </h2>
      <p className="mt-1 text-[15px] leading-snug text-slate-200">
        {t('fire.target', {
          amount: formatMoneyWhole(fi.target),
          multiple: FIRE_MULTIPLE,
          spending: formatMoneyWhole(typical * 12),
        })}
      </p>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold tabular-nums text-white">{formatMoneyWhole(fi.have)}</span>
          <span className="tabular-nums text-muted">{pct}%</span>
        </div>
        <div
          className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('fire.progress')}
        >
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART.accent }} />
        </div>
      </div>

      <p className="mt-3 text-sm leading-snug text-slate-300">
        {fi.years === 0
          ? t('fire.reached')
          : fi.years === null
            ? t('fire.notAtThisPace')
            : t('fire.years', {
                years: formatAmount(fi.years),
                monthly: formatMoneyWhole(Math.max(0, monthly)),
              })}
      </p>
      <p className="mt-2 text-xs leading-snug text-muted">
        {t('fire.note', { rate: Math.round(FIRE_REAL_RETURN * 100) })}
      </p>
    </section>
  )
}
