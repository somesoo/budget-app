import { useState } from 'react'
import { UserSwitcher } from './UserSwitcher'
import { CURRENCY_SUFFIX, PERSON_LABELS } from '../config'
import { formatAmount, formatDayLong, roundMoney } from '../lib/calculations'
import type { Income, NewIncome, Person } from '../types'

interface Props {
  incomes: Income[]
  onUpdate: (id: string, patch: Partial<NewIncome>) => void
  onDelete: (id: string) => void
}

/** Paychecks for the month; tap one to correct or delete it. */
export function IncomeList({ incomes, onUpdate, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)

  if (incomes.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        No income logged this month — add a paycheck with “+ Income” on the Add tab.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {incomes.map((income) =>
        editingId === income.id ? (
          <li key={income.id}>
            <IncomeEditor
              income={income}
              onCancel={() => setEditingId(null)}
              onSave={(patch) => {
                onUpdate(income.id, patch)
                setEditingId(null)
              }}
              onDelete={() => {
                onDelete(income.id)
                setEditingId(null)
              }}
            />
          </li>
        ) : (
          <li key={income.id}>
            <button
              type="button"
              onClick={() => setEditingId(income.id)}
              className="flex w-full items-center gap-3 rounded-2xl bg-white/5 px-3 py-3 text-left ring-1 ring-white/5 transition active:scale-[0.99]"
            >
              <span aria-hidden className="h-9 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-white">
                  {income.note ?? 'Income'}
                </span>
                <span className="block truncate text-xs text-muted">
                  {PERSON_LABELS[income.person]} · {formatDayLong(income.income_date)}
                </span>
              </span>
              <span className="shrink-0 text-base font-semibold tabular-nums text-emerald-300">
                +{formatAmount(income.amount)} {CURRENCY_SUFFIX}
              </span>
            </button>
          </li>
        ),
      )}
    </ul>
  )
}

function IncomeEditor({
  income,
  onCancel,
  onSave,
  onDelete,
}: {
  income: Income
  onCancel: () => void
  onSave: (patch: Partial<NewIncome>) => void
  onDelete: () => void
}) {
  const [amount, setAmount] = useState(String(income.amount))
  const [person, setPerson] = useState<Person>(income.person)
  const [note, setNote] = useState(income.note ?? '')
  const [date, setDate] = useState(income.income_date)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const parsed = roundMoney(Number.parseFloat(amount.replace(',', '.')) || 0)

  return (
    <div className="space-y-3 rounded-2xl bg-card p-3 ring-1 ring-white/15">
      <div className="flex gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
          inputMode="decimal"
          aria-label="Amount"
          className="w-32 rounded-xl bg-white/5 px-3 py-2 text-lg font-semibold tabular-nums text-white outline-none ring-1 ring-white/10"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date"
          className="flex-1 rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10"
        />
      </div>

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
            onSave({ amount: parsed, person, note: note.trim() || null, income_date: date })
          }
          className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  )
}
