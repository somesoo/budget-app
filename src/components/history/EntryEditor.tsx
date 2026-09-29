import { useState, type FormEvent, type ReactNode } from 'react'
import { BottomSheet } from './BottomSheet'
import { UserSwitcher } from '../UserSwitcher'
import { IncomeKind, ONE_OFF_HELP } from '../entry/IncomeKind'
import { CURRENCY_SUFFIX } from '../../config'
import { roundMoney, todayKey, withAlpha } from '../../lib/calculations'
import { formatLogged, type Entry } from '../../lib/history'
import type { Category, NewExpense, NewIncome, Person } from '../../types'
import { useDeviceUser } from '../../hooks/useDeviceUser'
import { isOthersAllowance } from '../../lib/allowance'
import { personIds } from '../../lib/people'

interface Props {
  entry: Entry
  categories: Category[]
  onClose: () => void
  onSaveExpense: (id: string, patch: Partial<NewExpense>) => void
  onSaveIncome: (id: string, patch: Partial<NewIncome>) => void
  onDelete: (entry: Entry) => void
}

/** Edit sheet for one transaction — the same form for an expense and a paycheck, minus the category. */
export function EntryEditor({
  entry,
  categories,
  onClose,
  onSaveExpense,
  onSaveIncome,
  onDelete,
}: Props) {
  const isExpense = entry.kind === 'expense'
  const initialCategory = entry.kind === 'expense' ? entry.item.category_id : ''

  const [amount, setAmount] = useState(String(entry.item.amount))
  const [note, setNote] = useState(entry.item.note ?? '')
  const [categoryId, setCategoryId] = useState(initialCategory)
  const goals = categories.filter(
    (c) => c.kind === 'project' && (!c.archived || c.id === initialCategory),
  )
  const [person, setPerson] = useState<Person>(entry.item.person)
  const { person: me } = useDeviceUser()
  const [date, setDate] = useState(entry.date)
  const initialOneOff = entry.kind === 'income' && entry.item.one_off
  const [oneOff, setOneOff] = useState(initialOneOff)

  const parsed = roundMoney(Number.parseFloat(amount.replace(',', '.')) || 0)
  const trimmedNote = note.trim() || null
  const changed =
    parsed !== entry.item.amount ||
    trimmedNote !== entry.item.note ||
    categoryId !== initialCategory ||
    person !== entry.item.person ||
    date !== entry.date ||
    oneOff !== initialOneOff
  const valid = parsed > 0 && date !== ''

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid || !changed) return
    if (entry.kind === 'expense') {
      onSaveExpense(entry.id, {
        amount: parsed,
        note: trimmedNote,
        category_id: categoryId,
        person,
        expense_date: date,
      })
    } else {
      onSaveIncome(entry.id, {
        amount: parsed,
        note: trimmedNote,
        person,
        income_date: date,
        // sent only when changed: a database before migration 0014 has no such column
        ...(oneOff !== initialOneOff && { one_off: oneOff }),
      })
    }
    onClose()
  }

  return (
    <BottomSheet title={isExpense ? 'Edit expense' : 'Edit income'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <label className="flex items-baseline justify-center gap-2 rounded-2xl bg-white/5 px-4 py-4 ring-1 ring-white/10 focus-within:ring-white/40">
          <span className="sr-only">Amount</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            className={`w-full min-w-0 bg-transparent text-right text-4xl font-bold tabular-nums outline-none ${
              isExpense ? 'text-white' : 'text-positive'
            }`}
          />
          <span className="shrink-0 text-xl font-semibold text-muted">{CURRENCY_SUFFIX}</span>
        </label>

        <Field label="Title">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isExpense ? 'e.g. Biedronka, cinema' : 'e.g. Salary'}
            maxLength={120}
            className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-white outline-none ring-1 ring-white/10 placeholder:text-muted/60 focus:ring-white/40"
          />
        </Field>

        {isExpense && (
          <Field label="Category">
            <Chips
              list={categories.filter(
                (c) =>
                  c.id === initialCategory ||
                  (c.kind !== 'project' && !c.archived && !isOthersAllowance(c, me)),
              )}
              value={categoryId}
              onChange={setCategoryId}
            />
          </Field>
        )}
        {isExpense && goals.length > 0 && (
          <Field label="Or spent from a goal">
            <Chips list={goals} value={categoryId} onChange={setCategoryId} />
          </Field>
        )}

        {!isExpense && (
          <Field label="Kind">
            <IncomeKind oneOff={oneOff} onChange={setOneOff} />
            {oneOff && <p className="mt-1.5 text-xs leading-snug text-muted">{ONE_OFF_HELP}</p>}
          </Field>
        )}

        {/* with three or four people the names need a row of their own */}
        <div
          className={`flex gap-3 ${personIds().length > 2 ? 'flex-col' : 'items-end'}`}
        >
          {personIds().length > 1 && (
            <Field label={isExpense ? 'Paid by' : 'Received by'}>
              <UserSwitcher value={person} onChange={setPerson} />
            </Field>
          )}
          <Field label="Date" grow>
            <input
              type="date"
              value={date}
              max={todayKey()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl bg-white/5 px-3 py-2 text-white outline-none ring-1 ring-white/10 focus:ring-white/40 [color-scheme:dark]"
            />
          </Field>
        </div>

        <p className="text-xs text-muted">Logged {formatLogged(entry.createdAt)}</p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              onDelete(entry)
              onClose()
            }}
            className="rounded-xl px-4 py-3 text-sm font-semibold text-red-400 ring-1 ring-red-400/30 active:bg-red-500/10"
          >
            Delete
          </button>
          <button
            type="submit"
            disabled={!valid || !changed}
            className="flex-1 rounded-xl bg-slate-50 py-3 text-sm font-bold text-ink disabled:opacity-40"
          >
            {changed ? 'Save changes' : 'No changes'}
          </button>
        </div>
      </form>
    </BottomSheet>
  )
}

function Field({ label, grow, children }: { label: string; grow?: boolean; children: ReactNode }) {
  return (
    <div className={grow ? 'min-w-0 flex-1' : ''}>
      <p className="mb-1.5 text-sm text-muted">{label}</p>
      {children}
    </div>
  )
}

function Chips({
  list,
  value,
  onChange,
}: {
  list: Category[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((c) => {
        const active = c.id === value
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            aria-pressed={active}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-white/10 transition"
            style={
              active
                ? {
                    backgroundColor: withAlpha(c.color, 0.28),
                    color: '#fff',
                    boxShadow: `inset 0 0 0 2px ${c.color}`,
                  }
                : { backgroundColor: 'rgba(255,255,255,0.04)', color: '#cbd5e1' }
            }
          >
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
            {c.name}
          </button>
        )
      })}
    </div>
  )
}
