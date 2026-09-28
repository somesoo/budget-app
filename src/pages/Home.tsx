import { useEffect, useState } from 'react'
import { DesktopAdd } from '../components/add/DesktopAdd'
import { GoalPicker, GoalsTile } from '../components/add/GoalPicker'
import { useGoalTrips } from '../hooks/useGoalTrips'
import { CategoryPager } from '../components/CategoryPager'
import { AmountPad } from '../components/AmountPad'
import { IncomePad } from '../components/IncomePad'
import { UserSwitcher } from '../components/UserSwitcher'
import { Screen } from '../components/Screen'
import { SettingsLink } from '../components/SettingsLink'
import { WidgetCarousel } from '../components/add/WidgetCarousel'
import { useAddWidgets } from '../components/add/widgets'
import { useMonthCategories } from '../hooks/useBudgets'
import { useAddExpense, useMonthlyExpenses } from '../hooks/useExpenses'
import { useDeviceUser } from '../hooks/useDeviceUser'
import { useAddIncome } from '../hooks/useIncomes'
import { LAPTOP, useMediaQuery } from '../hooks/useMediaQuery'
import { usePrefs } from '../hooks/usePrefs'
import { useMonthMoney } from '../hooks/useMonthMoney'
import { useSavingsOverview } from '../hooks/useSavings'
import { BottomSheet } from '../components/history/BottomSheet'
import { PaycheckCard } from '../components/budget/PaycheckCard'
import {
  currentMonthKey,
  formatDayLong,
  formatMoney,
  formatMoneyCompact,
  monthKeyOfDate,
  sumByCategory,
  sumExpenses,
  todayKey,
} from '../lib/calculations'
import { crossingNote, limitImpact } from '../lib/alerts'
import type { Category, Person } from '../types'

export function Home() {
  const month = currentMonthKey()
  const { person: devicePerson, setPerson: setDevicePerson } = useDeviceUser()
  // limits come from this month's plan where it has one
  const { data: allCategories = [], isLoading, error } = useMonthCategories(month)
  const categories = allCategories.filter((c) => !c.archived)
  const { data: expenses = [] } = useMonthlyExpenses(month)
  const addExpense = useAddExpense()
  const addIncome = useAddIncome()
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [goalsOpen, setGoalsOpen] = useState(false)

  const [selected, setSelected] = useState<Category | null>(null)
  // Person for this one expense — defaults to whoever owns the phone, but can be
  // overridden with one tap (e.g. when someone borrows the phone).
  const [entryPerson, setEntryPerson] = useState<Person>(devicePerson ?? 'bubs')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(id)
  }, [toast])

  const spentByCategory = sumByCategory(expenses)
  const monthTotal = sumExpenses(expenses)
  const monthLimit = categories.reduce((a, c) => a + c.monthly_limit, 0)
  const left = monthLimit - monthTotal
  const money = useMonthMoney(month)
  const safe = money.safe
  const savings = useSavingsOverview()
  /** Right after a paycheck is logged: where the plan sends it. */
  const [payOutOpen, setPayOutOpen] = useState(false)

  const laptop = useMediaQuery(LAPTOP)
  const prefs = usePrefs()

  const goals = useGoalTrips()
  // spending from a goal is measured by all it has cost against its target, not by the month
  const spentOf = (c: Category) =>
    c.kind === 'project'
      ? (goals.all.find((g) => g.trip?.project.id === c.id)?.trip?.spent ?? 0)
      : (spentByCategory[c.id] ?? 0)
  const limitOf = (c: Category) => (c.kind === 'project' ? (c.budget_total ?? 0) : c.monthly_limit)

  const widgets = useAddWidgets({ expenses, categories, allCategories })

  const openCategory = (category: Category) => {
    setEntryPerson(devicePerson ?? 'bubs')
    setSelected(category)
  }

  // a different screen on a laptop, not a stretched phone one
  if (laptop) return <DesktopAdd />

  if (incomeOpen) {
    return (
      <IncomePad
        person={entryPerson}
        onPersonChange={setEntryPerson}
        onCancel={() => setIncomeOpen(false)}
        saving={addIncome.isPending}
        onSave={({ amount, person, note, date }) => {
          addIncome.mutate(
            { amount, person, note, income_date: date },
            { onError: (err) => setToast(`Not saved: ${(err as Error).message}`) },
          )
          setIncomeOpen(false)
          // pay the plan's savings out straight away, while the money is there
          if (
            money.plan &&
            savings.available &&
            (money.plan.allocations.length > 0 || money.plan.carryover.length > 0) &&
            monthKeyOfDate(date) === month
          ) {
            setPayOutOpen(true)
          }
          setToast(date === todayKey() ? 'Income saved' : `Income saved · ${formatDayLong(date)}`)
        }}
      />
    )
  }

  if (selected) {
    return (
      <AmountPad
        category={selected}
        spent={spentOf(selected)}
        person={entryPerson}
        onPersonChange={setEntryPerson}
        onCancel={() => setSelected(null)}
        saving={addExpense.isPending}
        onSave={({ amount, person, note, date }) => {
          addExpense.mutate(
            {
              amount,
              category_id: selected.id,
              person,
              note,
              expense_date: date,
            },
            {
              onError: (err) => setToast(`Not saved: ${(err as Error).message}`),
            },
          )
          setSelected(null)
          // a backdated expense lands in another month, whose limits aren't on screen
          const crossed =
            selected.kind === 'project' || monthKeyOfDate(date) === month
              ? crossingNote(
                  selected,
                  limitImpact(spentOf(selected), amount, limitOf(selected), prefs.nearRatio),
                )
              : null
          setToast(
            crossed
              ? `Saved. ${crossed}`
              : date === todayKey()
                ? 'Saved'
                : `Saved · ${formatDayLong(date)}`,
          )
        }}
      />
    )
  }

  return (
    <Screen
      title="What for?"
      hideTitle
      action={
        <div className="flex items-center gap-1">
          {devicePerson && <UserSwitcher value={devicePerson} onChange={setDevicePerson} />}
          <SettingsLink />
        </div>
      }
      fill
    >
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        {safe ? (
          // income − planned savings − spent: the money that's really free
          <p className="min-w-0 text-sm text-muted">
            Safe to spend:{' '}
            <span className={`font-semibold ${safe.amount < 0 ? 'text-red-300' : 'text-white'}`}>
              {safe.amount < 0 ? '−' : ''}
              {formatMoney(Math.abs(safe.amount))}
            </span>
            <span className="block truncate text-xs">
              {safe.expected ? 'expected ' : ''}income {formatMoneyCompact(safe.income)}
              {safe.savedAside !== 0
                ? ` ${safe.savedAside < 0 ? '+ from savings' : '− savings'} ${formatMoneyCompact(Math.abs(safe.savedAside))}`
                : ''}{' '}
              − spent {formatMoneyCompact(monthTotal)}
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted">
            This month: <span className="font-semibold text-white">{formatMoney(monthTotal)}</span>
            {monthLimit > 0 && (
              <span className={left < 0 ? 'text-red-300' : ''}>
                {' '}
                ·{' '}
                {left < 0 ? `${formatMoneyCompact(-left)} over` : `${formatMoneyCompact(left)} left`}
              </span>
            )}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setEntryPerson(devicePerson ?? 'bubs')
            setIncomeOpen(true)
          }}
          className="shrink-0 rounded-full bg-accent/15 px-3 py-1.5 text-sm font-semibold text-accent-soft ring-1 ring-accent/30 hover:bg-accent/20 active:bg-accent/25"
        >
          + Income
        </button>
      </div>


      {error && (
        <p className="mb-3 shrink-0 rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">
          Could not load categories: {(error as Error).message}
        </p>
      )}

      {/* all switched off in Settings: the tiles get the room */}
      {widgets.length > 0 && (
        <div className="mb-3 shrink-0">
          <WidgetCarousel widgets={widgets} />
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : (
        <CategoryPager
          categories={categories}
          spentByCategory={spentByCategory}
          onSelect={openCategory}
          trailing={
            goals.open.length > 0
              ? (height) => (
                  <GoalsTile goals={goals.open} height={height} onClick={() => setGoalsOpen(true)} />
                )
              : undefined
          }
        />
      )}

      {payOutOpen && money.plan && (
        <BottomSheet title="From the paycheck" onClose={() => setPayOutOpen(false)}>
          <p className="mb-2 text-sm text-slate-300">
            Straight to the goals and IKE, before it gets spent.
          </p>
          <PaycheckCard month={month} plan={money.plan} overview={savings} bare />
        </BottomSheet>
      )}

      {goalsOpen && (
        <GoalPicker
          goals={goals.open}
          onClose={() => setGoalsOpen(false)}
          onPick={async ({ goal }) => {
            const category = await goals.ensureTrip(goal)
            setGoalsOpen(false)
            openCategory(category)
          }}
        />
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-30 flex justify-center px-4 lg:bottom-8 lg:left-60">
          <div className="rounded-full bg-slate-50 px-5 py-2.5 text-sm font-semibold text-ink shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </Screen>
  )
}

