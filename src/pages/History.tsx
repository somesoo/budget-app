import { useState } from 'react'
import { TransactionList } from '../components/TransactionList'
import { IncomeList } from '../components/IncomeList'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { Screen } from '../components/Screen'
import { useCategories } from '../hooks/useCategories'
import { useDeleteExpense, useExpenses, useUpdateExpense } from '../hooks/useExpenses'
import { useDeleteIncome, useIncomesBetween, useUpdateIncome } from '../hooks/useIncomes'
import { PERSON_LABELS } from '../config'
import {
  categoryById,
  currentMonthKey,
  formatMoney,
  monthRange,
  pluralize,
  sumExpenses,
} from '../lib/calculations'
import { PERSONS, type Person } from '../types'

type Kind = 'expenses' | 'income'

export function History() {
  const [month, setMonth] = useState(currentMonthKey())
  const [kind, setKind] = useState<Kind>('expenses')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [personFilter, setPersonFilter] = useState<Person | 'all'>('all')

  const { from, to } = monthRange(month)
  const { data: categories = [] } = useCategories()
  const { data: expenses = [], isLoading } = useExpenses(month)
  const { data: incomes = [], isLoading: incomesLoading } = useIncomesBetween(from, to)
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()
  const updateIncome = useUpdateIncome()
  const deleteIncome = useDeleteIncome()

  const filtered = expenses.filter(
    (e) =>
      (categoryFilter === 'all' || e.category_id === categoryFilter) &&
      (personFilter === 'all' || e.person === personFilter),
  )
  const filteredIncomes = incomes.filter(
    (i) => personFilter === 'all' || i.person === personFilter,
  )

  const tab = (value: Kind, label: string) => (
    <button
      type="button"
      onClick={() => setKind(value)}
      aria-pressed={kind === value}
      className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
        kind === value ? 'bg-white text-ink shadow' : 'text-muted active:bg-white/10'
      }`}
    >
      {label}
    </button>
  )

  return (
    <Screen title="History" action={<MonthSwitcher month={month} onChange={setMonth} />}>
      <div className="mb-3 flex rounded-full bg-white/5 p-1 ring-1 ring-white/10">
        {tab('expenses', 'Expenses')}
        {tab('income', 'Income')}
      </div>

      <div className="mb-3 flex gap-2">
        {kind === 'expenses' && (
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
        )}
        <select
          value={personFilter}
          onChange={(e) => setPersonFilter(e.target.value as Person | 'all')}
          aria-label="Filter by person"
          className={`rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 ${
            kind === 'income' ? 'flex-1' : ''
          }`}
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

      {kind === 'expenses' ? (
        <>
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
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {filteredIncomes.length} {pluralize(filteredIncomes.length, 'payment', 'payments')} ·{' '}
            <span className="font-semibold text-emerald-300">
              {formatMoney(filteredIncomes.reduce((a, i) => a + i.amount, 0))}
            </span>
          </p>

          {incomesLoading ? (
            <p className="py-6 text-center text-sm text-muted">Loading…</p>
          ) : (
            <IncomeList
              incomes={filteredIncomes}
              onUpdate={(id, patch) => updateIncome.mutate({ id, ...patch })}
              onDelete={(id) => deleteIncome.mutate(id)}
            />
          )}
        </>
      )}
    </Screen>
  )
}
