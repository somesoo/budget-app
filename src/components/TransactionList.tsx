import { EntryRow } from './history/EntryRow'
import { toEntries } from '../lib/history'
import type { Category, Expense } from '../types'

interface Props {
  expenses: Expense[]
  categories: Record<string, Category>
  emptyLabel?: string
}

/** Read-only list of expenses, drawn with the same rows as History. */
export function TransactionList({ expenses, categories, emptyLabel = 'No expenses' }: Props) {
  if (expenses.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">{emptyLabel}</p>
  }

  return (
    <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/5">
      {toEntries(expenses, []).map((entry) => (
        <li key={entry.id}>
          <EntryRow entry={entry} categories={categories} />
        </li>
      ))}
    </ul>
  )
}
