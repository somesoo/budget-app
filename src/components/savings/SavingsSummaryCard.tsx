import { CaretRight } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import type { SavingsOverview } from '../../hooks/useSavings'
import { formatMoneyWhole, formatMonthName, currentMonthKey } from '../../lib/calculations'
import { t } from '../../i18n'
import { Trans } from '../../i18n/Trans'

const GOALS_SHOWN = 3

/** Savings at a glance on the Budget tab: this month's saving against the plan, and the goals. */
export function SavingsSummaryCard({ overview }: { overview: SavingsOverview }) {
  const goals = overview.goals.filter((g) => !g.goal.archived).slice(0, GOALS_SHOWN)
  const planned = overview.plannedThisMonth
  return (
    <section aria-labelledby="savings-summary">
      <Link
        to="/savings"
        className="group mb-3 flex items-center gap-1 text-base font-semibold text-white"
        id="savings-summary"
      >
        {t('nav.savings')}
        <CaretRight aria-hidden className="text-muted transition group-hover:translate-x-0.5" />
      </Link>
      <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
        <p className="text-sm text-slate-300">
          <Trans
            k={planned !== null && planned > 0 ? 'savingsSummary.putAsidePlanned' : 'savingsSummary.putAside'}
            values={{
              month: formatMonthName(currentMonthKey()),
              amount: formatMoneyWhole(overview.savedThisMonth),
              planned: formatMoneyWhole(planned ?? 0),
            }}
            tags={{ b: (s) => <span className="font-semibold text-white">{s}</span> }}
          />
          <span className="text-muted">
            {' '}
            · {t('savingsSummary.inAll', { amount: formatMoneyWhole(overview.total) })}
          </span>
        </p>
        {goals.length > 0 && (
          <ul className="mt-3 grid gap-2.5">
            {goals.map((g) => (
              <li key={g.goal.id}>
                <Link
                  to={`/savings/goal/${g.goal.id}`}
                  className="block rounded-lg hover:bg-white/5"
                >
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate text-white">{g.goal.name}</span>
                    <span className="shrink-0 tabular-nums text-slate-300">
                      {formatMoneyWhole(g.saved)}
                      {g.goal.target_amount > 0 && ` / ${formatMoneyWhole(g.goal.target_amount)}`}
                    </span>
                  </div>
                  {g.progress !== null && (
                    <div
                      className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"
                      aria-hidden
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${g.progress * 100}%`, backgroundColor: g.goal.color }}
                      />
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
