import { useState } from 'react'
import { roundMoney } from '../../lib/calculations'

export function parseAmount(text: string): number {
  const normalized = text.replace(',', '.').replace(/[^\d.]/g, '')
  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) ? roundMoney(value) : 0
}

function formatInput(value: number): string {
  return Number.isInteger(value) ? String(value) : String(roundMoney(value))
}

/**
 * The amount being typed, the quick amount it came from (if any) and the
 * fine-tuning steps. Shared by the phone's amount screen and the laptop's
 * entry panel, so both parse "12,50" the same way.
 */
export function useAmountEntry() {
  const [text, setText] = useState('')
  const [quickPick, setQuickPick] = useState<number | null>(null)
  const amount = parseAmount(text)

  return {
    text,
    amount,
    quickPick,
    pickQuick: (value: number) => {
      setQuickPick(value)
      setText(formatInput(value))
    },
    setExact: (value: number) => {
      setQuickPick(null)
      setText(formatInput(value))
    },
    adjust: (delta: number) => {
      const next = Math.max(roundMoney(amount + delta), 0)
      setQuickPick(null)
      setText(next === 0 ? '' : formatInput(next))
    },
    /** Typed by hand: digits plus a single decimal separator. */
    type: (value: string) => {
      setQuickPick(null)
      setText(value.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/g, '$1'))
    },
    reset: () => {
      setQuickPick(null)
      setText('')
    },
  }
}
