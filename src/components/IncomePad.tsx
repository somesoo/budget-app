import { ArrowLeft } from '@phosphor-icons/react'
import { useState } from 'react'
import { AmountField } from './entry/AmountField'
import { IncomeKind, ONE_OFF_HELP } from './entry/IncomeKind'
import { parseAmount } from './entry/useAmountEntry'
import { DatePicker } from './DatePicker'
import { UserSwitcher } from './UserSwitcher'
import { CURRENCY_SUFFIX } from '../config'
import { useLastIncomes } from '../hooks/useIncomes'
import {
  formatAmount,
  formatMonthName,
  monthKeyOfDate,
  shiftMonth,
  todayKey,
} from '../lib/calculations'

/** From this day of the month on, pay usually covers the month after. */
const PAYS_NEXT_FROM_DAY = 25
import type { Person } from '../types'

interface Props {
  person: Person
  onPersonChange: (person: Person) => void
  onCancel: () => void
  onSave: (input: {
    amount: number
    person: Person
    note: string | null
    date: string
    /** The month it pays for, when not the month of `date`. */
    forMonth: string | null
    oneOff: boolean
  }) => void
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
  const [oneOff, setOneOff] = useState(false)
  // null: follow the date (late in the month, the month after); else what was picked
  const [picked, setPicked] = useState<'same' | 'next' | null>(null)
  const dateMonth = monthKeyOfDate(date)
  const paysFor =
    (picked ?? (Number(date.slice(8, 10)) >= PAYS_NEXT_FROM_DAY ? 'next' : 'same')) === 'next'
      ? shiftMonth(dateMonth, 1)
      : dateMonth
  const { data: recent = [] } = useLastIncomes()

  const amount = parseAmount(amountText)
  // the last pay, not a one-off: that's the amount that comes again
  const last = recent.find((i) => i.person === person && !i.one_off)

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

        {last && !oneOff && (
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
          <span className="text-sm text-muted">Kind</span>
          <IncomeKind oneOff={oneOff} onChange={setOneOff} />
        </div>
        {oneOff && <p className="-mt-3 text-xs leading-snug text-muted">{ONE_OFF_HELP}</p>}

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">Received by</span>
          <UserSwitcher value={person} onChange={onPersonChange} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">Date</span>
          <DatePicker value={date} onChange={setDate} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">Pays for</span>
          <div className="flex rounded-full bg-white/5 p-1 ring-1 ring-white/10">
            {(['same', 'next'] as const).map((which) => {
              const month = which === 'same' ? dateMonth : shiftMonth(dateMonth, 1)
              return (
                <button
                  key={which}
                  type="button"
                  aria-pressed={paysFor === month}
                  onClick={() => setPicked(which)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    paysFor === month ? 'bg-slate-50 text-ink' : 'text-muted'
                  }`}
                >
                  {formatMonthName(month)}
                </button>
              )
            })}
          </div>
        </div>
        {paysFor !== dateMonth && (
          <p className="-mt-3 text-xs leading-snug text-muted">
            Counted as {formatMonthName(paysFor)}’s income: its plan, Safe to spend and what it
            leaves over, not {formatMonthName(dateMonth)}’s.
          </p>
        )}

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={oneOff ? 'Note (e.g. deposit back, sold a chair)' : 'Note (e.g. salary)'}
          maxLength={120}
          className="w-full rounded-2xl bg-white/5 px-4 py-3.5 text-base text-white outline-none ring-1 ring-white/10 placeholder:text-muted focus:ring-white/30"
        />
      </div>

      <div className="sticky bottom-0 border-t border-white/10 bg-ink/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur">
        <button
          type="button"
          disabled={amount <= 0 || saving}
          onClick={() =>
            onSave({
              amount,
              person,
              note: note.trim() || null,
              date,
              forMonth: paysFor === dateMonth ? null : paysFor,
              oneOff,
            })
          }
          className="h-16 w-full rounded-3xl text-xl font-bold text-ink transition active:scale-[0.99] disabled:opacity-40"
          style={{ backgroundColor: INCOME_COLOR }}
        >
          {saving ? 'Saving…' : 'Save income'}
        </button>
      </div>
    </div>
  )
}
