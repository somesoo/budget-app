import { CalendarPlus, CaretRight, NotePencil } from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BudgetPlanner } from '../components/budget/BudgetPlanner'
import { GoalProgress } from '../components/GoalProgress'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { Screen } from '../components/Screen'
import { SummaryBars } from '../components/SummaryBars'
import { AlertList } from '../components/alerts/AlertList'
import { useBudget, useMonthCategories } from '../hooks/useBudgets'
import { useBudgetAlerts } from '../hooks/useBudgetAlerts'
import { useExpenses } from '../hooks/useExpenses'
import { useAddToGoal, useGoal } from '../hooks/useGoal'
import { useIncomesBetween } from '../hooks/useIncomes'
import { CURRENCY_SUFFIX, PLAN_AHEAD_MONTHS } from '../config'
import {
  currentMonthKey,
  daysInMonth,
  formatAmount,
  formatMoney,
  formatMoneyCompact,
  formatMonthName,
  monthRange,
  roundMoney,
  shiftMonth,
  sumByCategory,
  sumExpenses,
  type MonthKey,
} from '../lib/calculations'
import { elapsedDays } from '../lib/insights'
import type { BudgetPlan, Category } from '../types'

/**
 * The month against its plan — or, for a month still to come, the plan
 * itself. Months differ, so each can have its own; one without a plan is
 * measured against the categories' default limits.
 */
export function Budget() {
  const current = currentMonthKey()
  const [month, setMonth] = useState(current)
  const [planning, setPlanning] = useState<MonthKey | null>(null)

  const { data: categories = [], plan, planLoading } = useMonthCategories(month)
  const next = shiftMonth(current, 1)
  const { data: nextPlan } = useBudget(next)
  const { data: goal } = useGoal()
  const addToGoal = useAddToGoal()

  if (planning) return <BudgetPlanner month={planning} onClose={() => setPlanning(null)} />

  const isFuture = month > current

  const goalSection = goal && (
    <section>
      <SectionTitle>Goal: {goal.name}</SectionTitle>
      <GoalProgress
        goal={goal}
        pending={addToGoal.isPending}
        onAdd={(delta) => addToGoal.mutate({ goalId: goal.id, delta })}
      />
    </section>
  )

  return (
    <Screen
      title="Budget"
      wide
      action={
        <MonthSwitcher
          month={month}
          onChange={setMonth}
          max={shiftMonth(current, PLAN_AHEAD_MONTHS)}
        />
      }
    >
      {isFuture ? (
        <FuturePlan
          month={month}
          plan={plan}
          categories={categories}
          loading={planLoading}
          onPlan={() => setPlanning(month)}
          aside={goalSection}
        />
      ) : (
        <MonthStatus
          month={month}
          plan={plan}
          categories={categories}
          onPlan={() => setPlanning(month)}
          aside={goalSection}
        >
          {month === current && (
            <button
              type="button"
              onClick={() => setPlanning(next)}
              className="mb-6 flex w-full items-center gap-3 rounded-3xl bg-accent/10 p-4 text-left ring-1 ring-accent/25 transition hover:ring-accent/45 active:scale-[0.99]"
            >
              <CalendarPlus aria-hidden className="shrink-0 text-2xl text-accent-soft" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-white">
                  {nextPlan
                    ? `${formatMonthName(next)} is planned`
                    : `Plan ${formatMonthName(next)}`}
                </span>
                <span className="block text-sm text-slate-300">
                  {nextPlan
                    ? `${formatMoneyCompact(sumLimits(nextPlan))} of spending · ${formatMoneyCompact(nextPlan.savings)} to savings`
                    : 'Set next month’s limits from your history, with an AI draft if you like.'}
                </span>
              </span>
              <CaretRight aria-hidden className="shrink-0 text-xl text-muted" />
            </button>
          )}
        </MonthStatus>
      )}
    </Screen>
  )
}

const sumLimits = (plan: BudgetPlan) =>
  roundMoney(Object.values(plan.limits).reduce((a, b) => a + b, 0))

/* ---------- a month that has started (or ended) ---------- */

function MonthStatus({
  month,
  plan,
  categories,
  onPlan,
  aside,
  children,
}: {
  month: MonthKey
  plan: BudgetPlan | null
  categories: Category[]
  onPlan: () => void
  /** Under everything on a phone, under the month's numbers on a laptop. */
  aside?: ReactNode
  /** Goes between the month's numbers and its categories. */
  children?: ReactNode
}) {
  const { from, to } = monthRange(month)
  const { data: expenses = [] } = useExpenses(month)
  const { data: incomes = [] } = useIncomesBetween(from, to)

  const spent = sumExpenses(expenses)
  const byCategory = sumByCategory(expenses)
  const income = roundMoney(incomes.reduce((a, i) => a + i.amount, 0))
  // a hidden category still shows while it has spending this month
  const shown = categories.filter((c) => !c.archived || (byCategory[c.id] ?? 0) > 0)
  const limit = roundMoney(shown.reduce((a, c) => a + c.monthly_limit, 0))
  const left = roundMoney(limit - spent)
  const isCurrent = month === currentMonthKey()
  const { alerts, all: allAlerts, dismiss } = useBudgetAlerts()
  const alertsByCategory = isCurrent
    ? Object.fromEntries(allAlerts.filter((a) => a.category).map((a) => [a.category!.id, a]))
    : {}
  const daysLeft = isCurrent ? daysInMonth(month) - elapsedDays(month) + 1 : 0
  const saved = roundMoney(income - spent)
  const ratio = limit > 0 ? Math.min(spent / limit, 1) : 0

  return (
    <TwoColumns
      side={
        <>
          <section className="mb-6 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-muted">Spent</p>
              <PlanBadge plan={plan} onPlan={onPlan} />
            </div>
            <p className="text-4xl font-bold tabular-nums text-white">{formatMoney(spent)}</p>
            {limit > 0 && (
              <>
                <p className="mt-1 text-sm text-muted">
                  of {formatMoneyCompact(limit)} {plan ? 'planned' : 'in default limits'} ·{' '}
                  {Math.round((spent / limit) * 100)}%
                </p>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${left < 0 ? 'bg-red-500' : 'bg-slate-50'}`}
                    style={{ width: `${ratio * 100}%` }}
                  />
                </div>
                <p
                  className={`mt-2 text-sm font-medium ${left < 0 ? 'text-red-300' : 'text-white'}`}
                >
                  {left < 0
                    ? `${formatMoneyCompact(-left)} over the plan`
                    : isCurrent && daysLeft > 0
                      ? `${formatMoneyCompact(left)} left · about ${formatAmount(Math.floor(left / daysLeft))} ${CURRENCY_SUFFIX} a day for ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`
                      : `${formatMoneyCompact(left)} under the plan`}
                </p>
              </>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
              <Figure
                label="Income"
                value={formatMoneyCompact(income)}
                tone="positive"
                sub={
                  plan && plan.income > 0 ? `planned ${formatMoneyCompact(plan.income)}` : undefined
                }
              />
              <Figure
                label={isCurrent ? 'Left over so far' : 'Left over'}
                value={`${saved < 0 ? '−' : ''}${formatMoneyCompact(Math.abs(saved))}`}
                tone={saved < 0 ? 'negative' : undefined}
                sub={
                  plan && plan.savings > 0
                    ? `to save ${formatMoneyCompact(plan.savings)}`
                    : undefined
                }
              />
            </div>

            {plan?.note && (
              <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">
                <NotePencil
                  aria-hidden
                  className="mr-1.5 inline-block align-[-0.15em] text-muted"
                />
                {plan.note}
              </p>
            )}
          </section>

          {isCurrent && alerts.length > 0 && (
            <section className="mb-6" aria-label="Warnings">
              <SectionTitle>Heads-up</SectionTitle>
              <AlertList alerts={alerts} onDismiss={dismiss} />
            </section>
          )}

          {children}
        </>
      }
      main={
        <section className="mb-6">
          <SectionTitle>Categories</SectionTitle>
          <SummaryBars
            categories={shown}
            spentByCategory={byCategory}
            linkTo={(c) => `/category/${c.id}?month=${month}`}
            alerts={alertsByCategory}
          />
        </section>
      }
      aside={aside}
    />
  )
}

/**
 * Phone: one column. Laptop: the month's numbers (and whatever goes with them)
 * on the left, the categories on the right.
 */
function TwoColumns({
  side,
  main,
  aside,
}: {
  side: ReactNode
  main: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-8">
      <div className="lg:sticky lg:top-8">
        {side}
        <div className="hidden lg:block">{aside}</div>
      </div>
      <div>{main}</div>
      <div className="lg:hidden">{aside}</div>
    </div>
  )
}

/* ---------- a month still to come ---------- */

function FuturePlan({
  month,
  plan,
  categories,
  loading,
  onPlan,
  aside,
}: {
  month: MonthKey
  plan: BudgetPlan | null
  categories: Category[]
  loading: boolean
  onPlan: () => void
  aside?: ReactNode
}) {
  if (loading) return <div className="mb-6 h-40 animate-pulse rounded-3xl bg-white/5" />

  if (!plan) {
    return (
      <div className="lg:max-w-xl">
        <section className="mb-6 rounded-3xl bg-white/5 p-6 text-center ring-1 ring-white/10">
          <p className="text-lg font-semibold text-white">
            {formatMonthName(month)} isn’t planned yet
          </p>
          <p className="mt-1 text-sm text-muted">
            Until it is, it’ll use the default limits from Settings. Planning takes a minute: start
            from last month or your typical spending, tell it what’s different, adjust.
          </p>
          <button
            type="button"
            onClick={onPlan}
            className="mt-4 w-full rounded-2xl bg-slate-50 py-3 text-sm font-bold text-ink active:scale-[0.99]"
          >
            Plan {formatMonthName(month)}
          </button>
        </section>
        {aside}
      </div>
    )
  }

  const spending = sumLimits(plan)
  const unassigned = roundMoney(plan.income - plan.savings - spending)
  const active = categories.filter((c) => !c.archived)

  return (
    <TwoColumns
      aside={aside}
      side={
        <section className="mb-6 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="grid grid-cols-3 gap-2">
            <Figure label="Income" value={formatMoneyCompact(plan.income)} tone="positive" />
            <Figure label="Spending" value={formatMoneyCompact(spending)} />
            <Figure label="Savings" value={formatMoneyCompact(plan.savings)} />
          </div>
          {plan.income > 0 && Math.abs(unassigned) >= 1 && (
            <p className={`mt-3 text-sm ${unassigned < 0 ? 'text-red-300' : 'text-amber-200'}`}>
              {unassigned < 0
                ? `Plans ${formatMoneyCompact(-unassigned)} more than the expected income.`
                : `${formatMoneyCompact(unassigned)} of income has no job yet.`}
            </p>
          )}
          {plan.note && (
            <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">
              <NotePencil aria-hidden className="mr-1.5 inline-block align-[-0.15em] text-muted" />
              {plan.note}
            </p>
          )}
          <button
            type="button"
            onClick={onPlan}
            className="mt-4 w-full rounded-2xl bg-slate-50 py-3 text-sm font-bold text-ink active:scale-[0.99]"
          >
            Edit plan
          </button>
        </section>
      }
      main={
        <section className="mb-6">
          <SectionTitle>Limits</SectionTitle>
          <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/5">
            {active.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/category/${c.id}?month=${month}`}
                  className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-white/5 active:bg-white/10"
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="flex-1 text-[15px] text-white">{c.name}</span>
                  <span className="text-[15px] font-semibold tabular-nums text-white">
                    {formatMoneyCompact(c.monthly_limit)}
                  </span>
                  <CaretRight aria-hidden className="shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      }
    />
  )
}

/* ---------- bits ---------- */

function PlanBadge({ plan, onPlan }: { plan: BudgetPlan | null; onPlan: () => void }) {
  return (
    <button
      type="button"
      onClick={onPlan}
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 active:opacity-70 ${
        plan ? 'text-accent-soft ring-accent/35' : 'text-amber-200 ring-amber-300/30'
      }`}
    >
      {plan ? 'Planned · edit' : 'No plan · set one'}
    </button>
  )
}

function Figure({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'positive' | 'negative'
}) {
  const color =
    tone === 'positive' ? 'text-positive' : tone === 'negative' ? 'text-red-300' : 'text-white'
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <p className={`truncate text-lg font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="truncate text-xs text-muted">{sub}</p>}
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-base font-semibold text-white">{children}</h2>
}
