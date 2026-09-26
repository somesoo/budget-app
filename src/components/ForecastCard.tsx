import { ChartCard, LegendItem } from './charts/ChartCard'
import { CHART } from './charts/theme'
import { PERSON_LABELS } from '../config'
import { formatAmount, formatMoney, formatMoneyWhole } from '../lib/calculations'
import type { MonthForecast } from '../lib/forecast'
import type { Goal } from '../types'

const INCOME = '#34d399' // the app's income color: money that stays

interface Props {
  forecast: MonthForecast
  isCurrent: boolean
  goal: Goal | null | undefined
}

/**
 * Income against projected spending, all computed in code. The bar is the
 * month's income split into spent so far, still to be spent (projected), and
 * what's left over.
 */
export function ForecastCard({ forecast: f, isCurrent, goal }: Props) {
  if (f.income <= 0) {
    return (
      <ChartCard title="Forecast">
        <p className="text-sm text-muted">
          {isCurrent
            ? 'Log your paychecks with “+ Income” on the Add tab and this turns into a forecast of what you’ll have left at the end of the month.'
            : 'No income was logged for this month.'}
        </p>
      </ChartCard>
    )
  }

  const saving = f.projectedSavings >= 0
  const scale = Math.max(f.income, f.projectedSpend)
  const pct = (v: number) => `${(Math.max(v, 0) / scale) * 100}%`
  const rest = Math.max(f.projectedSpend - f.spentSoFar, 0)
  const incomeMarker = f.projectedSpend > f.income ? (f.income / scale) * 100 : null

  const basis = f.incomeByPerson
    .filter((p) => p.expected > 0)
    .map((p) =>
      p.basis === 'typical'
        ? `${PERSON_LABELS[p.person]} ~${formatAmount(Math.round(p.expected))} expected`
        : `${PERSON_LABELS[p.person]} ${formatAmount(p.expected)}`,
    )
    .join(' · ')

  const estimate = isCurrent ? formatMoneyWhole : formatMoney

  return (
    <ChartCard
      title="Forecast"
      headline={
        isCurrent ? (
          saving ? (
            <>
              On course to save <strong>{formatMoneyWhole(f.projectedSavings)}</strong> this month
              {f.savingsRate !== null && <>, {Math.round(f.savingsRate * 100)}% of income</>}.
            </>
          ) : (
            <>
              On course to spend <strong>{formatMoneyWhole(-f.projectedSavings)} more</strong> than
              you earn this month.
            </>
          )
        ) : saving ? (
          <>
            Saved <strong>{formatMoney(f.projectedSavings)}</strong>
            {f.savingsRate !== null && <>, {Math.round(f.savingsRate * 100)}% of income</>}.
          </>
        ) : (
          <>
            Spent <strong>{formatMoney(-f.projectedSavings)} more</strong> than you earned.
          </>
        )
      }
      legend={
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <LegendItem color={CHART.accent} label="Spent" shape="rect" />
          {isCurrent && rest > 0 && (
            <LegendItem color="rgba(57,135,229,0.4)" label="Still to spend (projected)" shape="rect" />
          )}
          {saving && <LegendItem color={INCOME} label="Left over" shape="rect" />}
        </div>
      }
      table={{
        head: ['', 'Amount'],
        rows: [
          ['Income', formatAmount(f.income)],
          ['Spent so far', formatAmount(f.spentSoFar)],
          ...(isCurrent ? [['Projected spending', formatAmount(Math.round(f.projectedSpend))]] : []),
          [saving ? 'Left over' : 'Shortfall', formatAmount(Math.round(Math.abs(f.projectedSavings)))],
        ],
      }}
    >
      {/* part-to-whole of the income; 2px surface gaps between segments */}
      <div className="relative">
        <div className="flex h-4 w-full gap-0.5">
          <span
            className="h-full rounded-l"
            style={{ width: pct(f.spentSoFar), backgroundColor: CHART.accent }}
          />
          {isCurrent && rest > 0 && (
            <span
              className="h-full"
              style={{ width: pct(rest), backgroundColor: 'rgba(57,135,229,0.4)' }}
            />
          )}
          {saving && (
            <span
              className="h-full rounded-r"
              style={{ width: pct(f.projectedSavings), backgroundColor: INCOME }}
            />
          )}
        </div>
        {incomeMarker !== null && (
          <span
            aria-hidden
            className="absolute -top-1 h-6 w-0.5 bg-slate-50"
            style={{ left: `${incomeMarker}%` }}
            title="Income"
          />
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Income</dt>
          <dd className="font-semibold text-white">{formatMoney(f.income)}</dd>
          <dd className="text-xs text-muted">{basis}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{isCurrent ? 'Projected spending' : 'Spent'}</dt>
          <dd className="font-semibold text-white">{estimate(f.projectedSpend)}</dd>
          {isCurrent && (
            <dd className="text-xs text-muted">{formatMoney(f.spentSoFar)} so far</dd>
          )}
        </div>

        {f.perDayToBreakEven !== null && (
          <div className="col-span-2">
            <dt className="text-xs text-muted">To break even</dt>
            <dd className="text-white">
              up to <span className="font-semibold">{formatMoneyWhole(f.perDayToBreakEven)}</span>{' '}
              a day for the remaining {f.daysLeft} {f.daysLeft === 1 ? 'day' : 'days'}
            </dd>
          </div>
        )}

        {goal && f.monthsToGoal !== null && (
          <div className="col-span-2">
            <dt className="text-xs text-muted">Goal: {goal.name}</dt>
            <dd className="text-white">
              about{' '}
              <span className="font-semibold">
                {f.monthsToGoal} {f.monthsToGoal === 1 ? 'month' : 'months'}
              </span>{' '}
              if a surplus like this one went to it every month
            </dd>
          </div>
        )}
      </dl>

      {f.incomeByPerson.some((p) => p.basis === 'typical') && (
        <p className="mt-3 text-xs text-muted">
          “Expected” is that person’s typical month, used until this month’s paycheck is logged.
        </p>
      )}
    </ChartCard>
  )
}
