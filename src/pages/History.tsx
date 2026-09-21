import { useState } from 'react'
import { TransactionList } from '../components/TransactionList'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { Screen } from '../components/Screen'
import { useCategories } from '../hooks/useCategories'
import { useDeleteExpense, useExpenses, useUpdateExpense } from '../hooks/useExpenses'
import { PERSON_LABELS } from '../config'
import {
  categoryById,
  currentMonthKey,
  formatMoney,
  pluralize,
  sumExpenses,
} from '../lib/calculations'
import { PERSONS, type Person } from '../types'

export function History() {
  const [month, setMonth] = useState(currentMonthKey())
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [personFilter, setPersonFilter] = useState<Person | 'all'>('all')

  const { data: categories = [] } = useCategories()
  const { data: expenses = [], isLoading } = useExpenses(month)
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()

  const filtered = expenses.filter(
    (e) =>
      (categoryFilter === 'all' || e.category_id === categoryFilter) &&
      (personFilter === 'all' || e.person === personFilter),
  )

  return (
    <Screen title="History" action={<MonthSwitcher month={month} onChange={setMonth} />}>
      <div className="mb-3 flex gap-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
          className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10"
        >
          <option value="all" className="bg-card">
            All categories
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id} className="bg-card">
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={personFilter}
          onChange={(e) => setPersonFilter(e.target.value as Person | 'all')}
          aria-label="Filter by person"
          className="rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10"
        >
          <option value="all" className="bg-card">
            Both
          </option>
          {PERSONS.map((p) => (
            <option key={p} value={p} className="bg-card">
              {PERSON_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <p className="mb-3 text-sm text-muted">
        {filtered.length} {pluralize(filtered.length, 'expense', 'expenses')} ·{' '}
        <span className="font-semibold text-white">{formatMoney(sumExpenses(filtered))}</span>
      </p>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted">Loading…</p>
      ) : (
        <TransactionList
          expenses={filtered}
          categories={categoryById(categories)}
          editable
          emptyLabel="No expenses match these filters"
          onUpdate={(id, patch) => updateExpense.mutate({ id, ...patch })}
          onDelete={(id) => deleteExpense.mutate(id)}
        />
      )}
    </Screen>
  )
}
