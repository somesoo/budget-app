import { useState } from 'react'
import { UserSwitcher } from './UserSwitcher'
import { CURRENCY_SUFFIX, PERSON_LABELS } from '../config'
import { formatAmount, formatDayLong, roundMoney } from '../lib/calculations'
import type { Category, Expense, NewExpense, Person } from '../types'

interface Props {
  expenses: Expense[]
  categories: Record<string, Category>
  editable?: boolean
  showDate?: boolean
  emptyLabel?: string
  onUpdate?: (id: string, patch: Partial<NewExpense>) => void
  onDelete?: (id: string) => void
}

export function TransactionList({
  expenses,
  categories,
  editable = false,
  showDate = true,
  emptyLabel = 'No expenses',
  onUpdate,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)

  if (expenses.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">{emptyLabel}</p>
  }

  return (
    <ul className="space-y-2">
      {expenses.map((expense) => {
        const category = categories[expense.category_id]
        const isEditing = editingId === expense.id

        if (isEditing && editable) {
          return (
            <li key={expense.id}>
              <ExpenseEditor
                expense={expense}
                categories={categories}
                onCancel={() => setEditingId(null)}
                onSave={(patch) => {
                  onUpdate?.(expense.id, patch)
                  setEditingId(null)
                }}
                onDelete={() => {
                  onDelete?.(expense.id)
                  setEditingId(null)
                }}
              />
            </li>
          )
        }

        return (
          <li key={expense.id}>
            <button
              type="button"
              disabled={!editable}
              onClick={() => setEditingId(expense.id)}
              className="flex w-full items-center gap-3 rounded-2xl bg-white/5 px-3 py-3 text-left ring-1 ring-white/5 transition active:scale-[0.99] disabled:active:scale-100"
            >
              <span
                aria-hidden
                className="h-9 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: category?.color ?? '#64748b' }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-white">
                  {category?.name ?? 'Unknown category'}
                </span>
                <span className="block truncate text-xs text-muted">
                  {PERSON_LABELS[expense.person]}
                  {showDate && ` · ${formatDayLong(expense.expense_date)}`}
                  {expense.note && ` · ${expense.note}`}
                </span>
              </span>
              <span className="shrink-0 text-base font-semibold tabular-nums text-white">
                {formatAmount(expense.amount)} {CURRENCY_SUFFIX}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

interface EditorProps {
  expense: Expense
  categories: Record<string, Category>
  onCancel: () => void
  onSave: (patch: Partial<NewExpense>) => void
  onDelete: () => void
}

function ExpenseEditor({ expense, categories, onCancel, onSave, onDelete }: EditorProps) {
  const [amount, setAmount] = useState(String(expense.amount))
  const [categoryId, setCategoryId] = useState(expense.category_id)
  const [person, setPerson] = useState<Person>(expense.person)
  const [note, setNote] = useState(expense.note ?? '')
  const [date, setDate] = useState(expense.expense_date)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const parsed = roundMoney(Number.parseFloat(amount.replace(',', '.')) || 0)
  const list = Object.values(categories).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="space-y-3 rounded-2xl bg-card p-3 ring-1 ring-white/15">
      <div className="flex gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
          inputMode="decimal"
          aria-label="Amount"
          className="w-28 rounded-xl bg-white/5 px-3 py-2 text-lg font-semibold tabular-nums text-white outline-none ring-1 ring-white/10"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date"
          className="flex-1 rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10"
        />
      </div>

      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        aria-label="Category"
        className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10"
      >
        {list.map((c) => (
          <option key={c.id} value={c.id} className="bg-card">
            {c.name}
          </option>
        ))}
      </select>

      <div className="flex items-center justify-between">
        <UserSwitcher value={person} onChange={setPerson} />
        <button
          type="button"
          onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
          className="rounded-xl px-3 py-2 text-sm font-semibold text-red-400 active:bg-red-500/10"
        >
          {confirmDelete ? 'Sure?' : 'Delete'}
        </button>
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note"
        maxLength={120}
        className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-muted"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl bg-white/5 py-2.5 text-sm font-semibold text-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={parsed <= 0}
          onClick={() =>
            onSave({
              amount: parsed,
              category_id: categoryId,
              person,
              note: note.trim() ? note.trim() : null,
              expense_date: date,
            })
          }
          className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  )
}
