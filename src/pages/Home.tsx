import { useEffect, useState } from 'react'
import { CategoryPager } from '../components/CategoryPager'
import { AmountPad } from '../components/AmountPad'
import { ChartCard } from '../components/charts/ChartCard'
import { SpendDonut } from '../components/charts/SpendDonut'
import { IncomePad } from '../components/IncomePad'
import { UserSwitcher } from '../components/UserSwitcher'
import { Screen } from '../components/Screen'
import { useMonthCategories } from '../hooks/useBudgets'
import { useAddExpense, useExpenses } from '../hooks/useExpenses'
import { useDeviceUser } from '../hooks/useDeviceUser'
import { useAddIncome } from '../hooks/useIncomes'
import {
  currentMonthKey,
  formatDayLong,
  formatMoney,
  formatMoneyCompact,
  sumByCategory,
  sumExpenses,
  todayKey,
} from '../lib/calculations'
import { categorySlices } from '../lib/insights'
import type { Category, Person } from '../types'

export function Home() {
  const month = currentMonthKey()
  const { person: devicePerson, setPerson: setDevicePerson } = useDeviceUser()
  // limits come from this month's plan where it has one
  const { data: allCategories = [], isLoading, error } = useMonthCategories(month)
  const categories = allCategories.filter((c) => !c.archived)
  const { data: expenses = [] } = useExpenses(month)
  const addExpense = useAddExpense()
  const addIncome = useAddIncome()
  const [incomeOpen, setIncomeOpen] = useState(false)

  const [selected, setSelected] = useState<Category | null>(null)
  // Person for this one expense — defaults to whoever owns the phone, but can be
  // overridden with one tap (e.g. when someone borrows the phone).
  const [entryPerson, setEntryPerson] = useState<Person>(devicePerson ?? 'bubs')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(id)
  }, [toast])

  const spentByCategory = sumByCategory(expenses)
  const monthTotal = sumExpenses(expenses)
  const monthLimit = categories.reduce((a, c) => a + c.monthly_limit, 0)
  const left = monthLimit - monthTotal
  const slices = categorySlices(expenses, allCategories)
  // switched out of the donut in Settings (rent and the like), but spent on this month
  const leftOut = allCategories.filter((c) => !c.show_in_chart && (spentByCategory[c.id] ?? 0) > 0)

  const openCategory = (category: Category) => {
    setEntryPerson(devicePerson ?? 'bubs')
    setSelected(category)
  }

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
          // a backdated expense may not move the tiles on screen, so say where it went
          setToast(date === todayKey() ? 'Saved' : `Saved · ${formatDayLong(date)}`)
        }}
      />
    )
  }

  return (
    <Screen
      title="What for?"
      action={devicePerson && <UserSwitcher value={devicePerson} onChange={setDevicePerson} />}
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
          className="shrink-0 rounded-full bg-emerald-400/15 px-3 py-1.5 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/30 active:bg-emerald-400/25"
        >
          + Income
        </button>
      </div>

      {error && (
        <p className="mb-3 shrink-0 rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">
          Could not load categories: {(error as Error).message}
        </p>
      )}

      {/* Nothing spent yet means nothing to divide up — the donut only appears
          once it has something to say. */}
      {slices.length > 0 && (
        <div className="mb-3 shrink-0">
          <ChartCard title="Where it goes">
            <SpendDonut slices={slices} />
            {leftOut.length > 0 && (
              <p className="mt-2 truncate text-xs text-muted">
                Not in the chart:{' '}
                {leftOut
                  .map((c) => `${c.name} ${formatMoneyCompact(Math.round(spentByCategory[c.id]))}`)
                  .join(' · ')}
              </p>
            )}
          </ChartCard>
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
        />
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
          <div className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </Screen>
  )
}
