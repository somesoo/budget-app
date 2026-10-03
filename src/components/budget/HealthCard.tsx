import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMonthMoney } from '../../hooks/useMonthMoney'
import { useSavingsOverview } from '../../hooks/useSavings'
import { useTypicalSpending } from '../../hooks/useTypicalSpending'
import { useMonthlyExpensesBetween } from '../../hooks/useExpenses'
import { useIncomesBetween } from '../../hooks/useIncomes'
import { ageOfMoney } from '../../lib/wealth'
import { monthsEndingAt, windowRange } from '../../lib/insights'
import { moneyHealth, type Health } from '../../lib/allocations'
import { currentMonthKey, formatAmount, type MonthKey } from '../../lib/calculations'
import type { Category } from '../../types'
import { t } from '../../i18n'

const TONE: Record<Health, string> = {
  good: 'text-positive',
  watch: 'text-amber-200',
  low: 'text-red-300',
}

const percent = (x: number) => `${Math.round(x * 100)}%`

/** Months of income and spending the age of money is worked out over. */
const AGE_MONTHS = 6

/**
 * Four numbers against the usual rules of thumb: the savings rate, fixed
 * costs as a share of income, how many months of spending the emergency
 * fund covers, and how long money waits between coming in and going out.
 * Each says what "good" is, so the colors aren't the only clue.
 */
export function HealthCard({ month, categories }: { month: MonthKey; categories: Category[] }) {
  const money = useMonthMoney(month)
  const savings = useSavingsOverview()
  const typical = useTypicalSpending()

  const income = money.income > 0 ? money.income : (money.plan?.income ?? 0)
  const fixedCosts = categories
    .filter((c) => !c.show_in_chart && !c.archived)
    .reduce((s, c) => s + c.monthly_limit, 0)
  const emergency = savings.goals.find((g) => g.goal.is_emergency && !g.goal.archived)
  const age = useAgeOfMoney(savings.movements)
  const h = moneyHealth({
    income,
    savedAside: money.safe?.savedAside ?? money.plan?.savings ?? 0,
    fixedCosts,
    emergencySaved: emergency ? emergency.saved : null,
    typicalSpending: typical,
  })

  return (
    <section
      data-tour="health"
      aria-labelledby="health"
      className="mb-6 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10"
    >
      <h2 id="health" className="mb-3 text-base font-semibold text-white">
        {t('health.title')}
      </h2>
      <dl className="grid gap-3">
        <Row
          label={t('health.savingsRate')}
          value={h.savingsRate ? percent(h.savingsRate.value) : '–'}
          health={h.savingsRate?.health}
          rule={t('health.savingsRateRule')}
        />
        <Row
          label={t('health.fixedCosts')}
          value={h.fixedShare ? percent(h.fixedShare.value) : '–'}
          health={h.fixedShare?.health}
          rule={
            fixedCosts > 0
              ? t('health.fixedCostsRule')
              : t('health.fixedCostsHint')
          }
        />
        <Row
          label={t('health.emergency')}
          value={
            h.emergencyMonths
              ? t('health.months', {
                  count: Number(h.emergencyMonths.value.toFixed(1)),
                  months: formatAmount(Number(h.emergencyMonths.value.toFixed(1))),
                })
              : '–'
          }
          health={h.emergencyMonths?.health}
          rule={
            emergency
              ? t('health.emergencyRule', { name: emergency.goal.name })
              : undefined
          }
        >
          {!emergency && (
            <Link to="/savings" className="text-xs font-semibold text-accent-soft hover:underline">
              {t('health.markEmergency')}
            </Link>
          )}
        </Row>
        <Row
          label={t('health.ageOfMoney')}
          value={age === null ? '–' : t('health.days', { count: age })}
          health={age === null ? undefined : age >= 30 ? 'good' : age >= 10 ? 'watch' : 'low'}
          rule={age === null ? t('health.ageOfMoneyHint') : t('health.ageOfMoneyRule')}
        />
      </dl>
    </section>
  )
}

/** Age of money over the last AGE_MONTHS, from logged pay, monthly spending and deposits. */
function useAgeOfMoney(movements: { kind: string; amount: number; movement_date: string }[]) {
  const months = monthsEndingAt(currentMonthKey(), AGE_MONTHS)
  const { from, to } = windowRange(months)
  const { data: incomes } = useIncomesBetween(from, to, true)
  const { data: expenses } = useMonthlyExpensesBetween(from, to)
  if (!incomes || !expenses) return null
  return ageOfMoney({
    incomes,
    expenses,
    savedAside: movements
      .filter((m) => m.kind === 'deposit' && m.movement_date >= from && m.movement_date <= to)
      .map((m) => ({ amount: m.amount, date: m.movement_date })),
  })
}

function Row({
  label,
  value,
  health,
  rule,
  children,
}: {
  label: string
  value: string
  health?: Health
  rule?: string
  children?: ReactNode
}) {
  return (
    <div className="flex items-baseline gap-3">
      <div className="min-w-0 flex-1">
        <dt className="text-sm text-white">{label}</dt>
        {rule && <dd className="text-xs leading-snug text-muted">{rule}</dd>}
        {children && <dd>{children}</dd>}
      </div>
      <dd
        className={`shrink-0 text-lg font-bold tabular-nums ${health ? TONE[health] : 'text-muted'}`}
      >
        {value}
      </dd>
    </div>
  )
}
