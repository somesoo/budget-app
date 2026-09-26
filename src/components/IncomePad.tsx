import { ArrowLeft } from '@phosphor-icons/react'
import { useState } from 'react'
import { AmountField } from './entry/AmountField'
import { parseAmount } from './entry/useAmountEntry'
import { DatePicker } from './DatePicker'
import { UserSwitcher } from './UserSwitcher'
import { CURRENCY_SUFFIX } from '../config'
import { useLastIncomes } from '../hooks/useIncomes'
import { formatAmount, todayKey } from '../lib/calculations'
import type { Person } from '../types'

interface Props {
  person: Person
  onPersonChange: (person: Person) => void
  onCancel: () => void
  onSave: (input: { amount: number; person: Person; note: string | null; date: string }) => void
  saving: boolean
}

/** Income reads apart from any expense category: the app's "positive" color. */
const INCOME_COLOR = '#34d399'

/**
 * Logging a paycheck. Salaries repeat, so the last amount for the selected
 * person is offered as a one-tap chip.
 */
export function IncomePad({ person, onPersonChange, onCancel, onSave, saving }: Props) {
  const [amountText, setAmountText] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayKey())
  const { data: recent = [] } = useLastIncomes()

  const amount = parseAmount(amountText)
  const last = recent.find((i) => i.person === person)

  return (
    <div className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col overflow-y-auto bg-ink">
      <header className="flex items-center gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Back"
          className="-ml-2 rounded-full px-3 py-2 text-2xl leading-none text-muted active:bg-white/10"
        >
          <ArrowLeft />
        </button>
        <span
          className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink"
          style={{ backgroundColor: INCOME_COLOR }}
        >
          Income
        </span>
      </header>

      <div className="flex-1 space-y-5 px-4 pb-6">
        <AmountField
          value={amountText}
          onChange={(v) => setAmountText(v.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/g, '$1'))}
          label="Amount received"
          autoFocus
        />

        {last && (
          <button
            type="button"
            onClick={() => {
              setAmountText(String(last.amount))
              if (last.note && !note) setNote(last.note)
            }}
            className="w-full rounded-2xl bg-white/5 px-4 py-3 text-left text-sm ring-1 ring-white/10 active:bg-white/10"
          >
            <span className="text-muted">Same as last time: </span>
            <span className="font-semibold text-white">
              {formatAmount(last.amount)} {CURRENCY_SUFFIX}
            </span>
            {last.note && <span className="text-muted"> · {last.note}</span>}
          </button>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">Received by</span>
          <UserSwitcher value={person} onChange={onPersonChange} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">Date</span>
          <DatePicker value={date} onChange={setDate} />
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (e.g. salary, bonus)"
          maxLength={120}
          className="w-full rounded-2xl bg-white/5 px-4 py-3.5 text-base text-white outline-none ring-1 ring-white/10 placeholder:text-muted focus:ring-white/30"
        />
      </div>

      <div className="sticky bottom-0 border-t border-white/10 bg-ink/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur">
        <button
          type="button"
          disabled={amount <= 0 || saving}
          onClick={() => onSave({ amount, person, note: note.trim() || null, date })}
          className="h-16 w-full rounded-3xl text-xl font-bold text-ink transition active:scale-[0.99] disabled:opacity-40"
          style={{ backgroundColor: INCOME_COLOR }}
        >
          {saving ? 'Saving…' : 'Save income'}
        </button>
      </div>
    </div>
  )
}
