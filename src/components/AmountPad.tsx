import { useRef, useState } from 'react'
import { QuickAmountButtons } from './QuickAmountButtons'
import { FineTuneButtons } from './FineTuneButtons'
import { UserSwitcher } from './UserSwitcher'
import { CURRENCY_SUFFIX } from '../config'
import { readableTextColor, roundMoney } from '../lib/calculations'
import type { Category, Person } from '../types'

interface Props {
  category: Category
  person: Person
  onPersonChange: (person: Person) => void
  onCancel: () => void
  onSave: (input: { amount: number; person: Person; note: string | null }) => void
  saving: boolean
}

function parseAmount(text: string): number {
  const normalized = text.replace(',', '.').replace(/[^\d.]/g, '')
  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) ? roundMoney(value) : 0
}

function formatInput(value: number): string {
  return Number.isInteger(value) ? String(value) : String(roundMoney(value))
}

/**
 * Amount screen: quick amounts → fine-tuning → save.
 * Date is always today (no picker in V1), the person comes from this phone's
 * cache, the note is optional.
 */
export function AmountPad({
  category,
  person,
  onPersonChange,
  onCancel,
  onSave,
  saving,
}: Props) {
  const [amountText, setAmountText] = useState('')
  const [note, setNote] = useState('')
  const [quickPick, setQuickPick] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const amount = parseAmount(amountText)
  const canSave = amount > 0 && !saving

  const pickQuick = (value: number) => {
    setQuickPick(value)
    setAmountText(formatInput(value))
  }

  const adjust = (delta: number) => {
    const next = Math.max(roundMoney(amount + delta), 0)
    setQuickPick(null)
    setAmountText(next === 0 ? '' : formatInput(next))
  }

  const handleManual = (value: string) => {
    setQuickPick(null)
    // digits plus a single decimal separator
    const cleaned = value.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/g, '$1')
    setAmountText(cleaned)
  }

  return (
    // full-screen overlay — covers the bottom navigation too
    <div className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col overflow-y-auto bg-ink">
      <header className="flex items-center gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <button
          type="button"
          onClick={onCancel}
          className="-ml-2 rounded-full px-3 py-2 text-2xl leading-none text-muted active:bg-white/10"
          aria-label="Back to categories"
        >
          ←
        </button>
        <span
          className="rounded-full px-3 py-1.5 text-sm font-semibold"
          style={{ backgroundColor: category.color, color: readableTextColor(category.color) }}
        >
          {category.name}
        </span>
      </header>

      <div className="flex-1 space-y-5 px-4 pb-6">
        {/* tap the number to type an exact amount */}
        <div
          onClick={() => inputRef.current?.focus()}
          className="flex w-full items-baseline justify-center gap-2 rounded-3xl bg-white/5 py-6 ring-1 ring-white/10"
        >
          <input
            ref={inputRef}
            value={amountText}
            onChange={(e) => handleManual(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            inputMode="decimal"
            placeholder="0"
            aria-label="Amount"
            className="w-full max-w-[65%] bg-transparent text-right text-huge font-bold tabular-nums text-white outline-none placeholder:text-white/25"
          />
          <span className="text-3xl font-semibold text-muted">{CURRENCY_SUFFIX}</span>
        </div>

        <QuickAmountButtons onPick={pickQuick} selected={quickPick} accent={category.color} />

        {amount > 0 && <FineTuneButtons onAdjust={adjust} />}

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">Paid by</span>
          <UserSwitcher value={person} onChange={onPersonChange} />
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          maxLength={120}
          className="w-full rounded-2xl bg-white/5 px-4 py-3.5 text-base text-white outline-none ring-1 ring-white/10 placeholder:text-muted focus:ring-white/30"
        />
      </div>

      <div className="sticky bottom-0 border-t border-white/10 bg-ink/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => onSave({ amount, person, note: note.trim() ? note.trim() : null })}
          className="h-16 w-full rounded-3xl text-xl font-bold transition active:scale-[0.99] disabled:opacity-40"
          style={{ backgroundColor: category.color, color: readableTextColor(category.color) }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
