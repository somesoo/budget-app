import { useEffect, useState } from 'react'
import { DesktopAdd } from '../components/add/DesktopAdd'
import { GoalPicker, GoalsTile } from '../components/add/GoalPicker'
import { useGoalTrips } from '../hooks/useGoalTrips'
import { CategoryPager } from '../components/CategoryPager'
import { AmountPad } from '../components/AmountPad'
import { SpendDonut } from '../components/charts/SpendDonut'
import { IncomePad } from '../components/IncomePad'
import { UserSwitcher } from '../components/UserSwitcher'
import { Screen } from '../components/Screen'
import { SettingsLink } from '../components/SettingsLink'
import { AlertList } from '../components/alerts/AlertList'
import { WidgetCarousel, type Widget } from '../components/add/WidgetCarousel'
import { PaceChart } from '../components/charts/PaceChart'
import { useMonthCategories } from '../hooks/useBudgets'
import { useBudgetAlerts } from '../hooks/useBudgetAlerts'
import { useAddExpense, useMonthlyExpenses } from '../hooks/useExpenses'
import { useDeviceUser } from '../hooks/useDeviceUser'
import { useAddIncome } from '../hooks/useIncomes'
import { LAPTOP, useMediaQuery } from '../hooks/useMediaQuery'
import { usePrefs } from '../hooks/usePrefs'
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
import { categorySlices, pacePoints, projectMonthEnd } from '../lib/insights'
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
  const slices = categorySlices(expenses, allCategories)
  // switched out of the donut in Settings (rent and the like), but spent on this month
  const leftOut = allCategories.filter((c) => !c.show_in_chart && (spentByCategory[c.id] ?? 0) > 0)

  const laptop = useMediaQuery(LAPTOP)
  const prefs = usePrefs()
  const { alerts, dismiss } = useBudgetAlerts()

  const goals = useGoalTrips()
  // spending from a goal is measured by all it has cost against its target, not by the month
  const spentOf = (c: Category) =>
    c.kind === 'project'
      ? (goals.all.find((g) => g.trip?.project.id === c.id)?.trip?.spent ?? 0)
      : (spentByCategory[c.id] ?? 0)
  const limitOf = (c: Category) => (c.kind === 'project' ? (c.budget_total ?? 0) : c.monthly_limit)

  const projected = projectMonthEnd(monthTotal, month)
  const widgets: Widget[] = [
    {
      id: 'donut',
      label: 'Where it goes',
      content:
        slices.length > 0 ? (
          <>
            <SpendDonut slices={slices} />
            {leftOut.length > 0 && (
              <p className="mt-2 truncate text-xs text-muted">
                Not in the chart:{' '}
                {leftOut
                  .map((c) => `${c.name} ${formatMoneyCompact(Math.round(spentByCategory[c.id]))}`)
                  .join(' · ')}
              </p>
            )}
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted">Nothing spent yet this month.</p>
        ),
    },
    {
      id: 'pace',
      label: 'Pace',
      content: (
        <>
          <p className="text-sm leading-snug text-slate-200">
            {paceLine(monthTotal, projected, monthLimit)}
          </p>
          <PaceChart
            month={month}
            points={pacePoints(expenses, month, monthLimit)}
            showPace={monthLimit > 0}
            plotHeight={96}
          />
        </>
      ),
    },
    {
      id: 'alerts',
      label: 'Warnings',
      badge: alerts.length,
      content:
        alerts.length > 0 ? (
          <div className="max-h-48 overflow-y-auto">
            <AlertList alerts={alerts} onDismiss={dismiss} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted">
            All good: nothing close to a limit.
          </p>
        ),
    },
  ]

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
      action={
        <div className="flex items-center gap-1">
          {devicePerson && <UserSwitcher value={devicePerson} onChange={setDevicePerson} />}
          <SettingsLink />
        </div>
      }
      fill
    >
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
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

      {/* nothing spent and nothing to warn about: the tiles get the room */}
      {(slices.length > 0 || alerts.length > 0) && (
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

/** The month's pace in a sentence: where the total is heading against the limits. */
function paceLine(spent: number, projected: number | null, limit: number): string {
  if (projected === null || limit <= 0) return `Spent ${formatMoneyCompact(spent)} so far.`
  const diff = projected - limit
  return diff > 0
    ? `At this rate about ${formatMoneyCompact(diff)} over the limits by the end of the month.`
    : `On course for ${formatMoneyCompact(projected)}, ${formatMoneyCompact(-diff)} under the limits.`
}
