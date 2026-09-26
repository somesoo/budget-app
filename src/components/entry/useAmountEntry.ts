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
 * The amount being typed, or added up from quick amounts. Shared by the phone's amount screen and the laptop's
 * entry panel, so both parse "12,50" the same way.
 */
export function useAmountEntry() {
  const [text, setText] = useState('')
  const amount = parseAmount(text)

  return {
    text,
    amount,
    /** Quick amounts add up: 10 twice is 20, 50 then 20 is 70. */
    add: (value: number) => setText(formatInput(roundMoney(amount + value))),
    setExact: (value: number) => setText(formatInput(value)),
    /** Typed by hand: digits plus a single decimal separator. */
    type: (value: string) => setText(value.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/g, '$1')),
    reset: () => setText(''),
  }
}
