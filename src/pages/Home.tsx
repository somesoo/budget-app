import { useEffect, useState } from 'react'
import { CategoryGrid } from '../components/CategoryGrid'
import { AmountPad } from '../components/AmountPad'
import { UserSwitcher } from '../components/UserSwitcher'
import { Screen } from '../components/Screen'
import { useCategories } from '../hooks/useCategories'
import { useAddExpense, useExpenses } from '../hooks/useExpenses'
import { useDeviceUser } from '../hooks/useDeviceUser'
import {
  currentMonthKey,
  formatDayLong,
  formatMoney,
  sumByCategory,
  sumExpenses,
  todayKey,
} from '../lib/calculations'
import type { Category, Person } from '../types'

export function Home() {
  const month = currentMonthKey()
  const { person: devicePerson, setPerson: setDevicePerson } = useDeviceUser()
  const { data: categories = [], isLoading, error } = useCategories()
  const { data: expenses = [] } = useExpenses(month)
  const addExpense = useAddExpense()

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

  const openCategory = (category: Category) => {
    setEntryPerson(devicePerson ?? 'bubs')
    setSelected(category)
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
    >
      <p className="mb-4 text-sm text-muted">
        This month: <span className="font-semibold text-white">{formatMoney(monthTotal)}</span>
      </p>

      {error && (
        <p className="mb-4 rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">
          Could not load categories: {(error as Error).message}
        </p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-3xl bg-white/5" />
          ))}
        </div>
      ) : (
        <CategoryGrid
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
