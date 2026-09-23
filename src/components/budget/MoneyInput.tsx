import { useEffect, useState } from 'react'
import { CURRENCY_SUFFIX } from '../../config'
import { roundMoney } from '../../lib/calculations'

interface Props {
  value: number
  onChange: (value: number) => void
  label: string
  size?: 'md' | 'lg'
}

const parse = (text: string) => roundMoney(Number.parseFloat(text.replace(',', '.')) || 0)

/**
 * A złoty amount typed as text (so "12," can be on its way to "12,50") but
 * reported as a number. Follows `value` when it's changed from outside, e.g.
 * by a "use typical" chip.
 */
export function MoneyInput({ value, onChange, label, size = 'md' }: Props) {
  const [text, setText] = useState(String(value))

  useEffect(() => {
    setText((current) => (parse(current) === value ? current : String(value)))
  }, [value])

  const big = size === 'lg'
  return (
    <label
      className={`flex items-baseline gap-1 rounded-xl bg-white/5 ring-1 ring-white/10 focus-within:ring-white/40 ${
        big ? 'px-3 py-2' : 'px-2.5 py-1.5'
      }`}
    >
      <span className="sr-only">{label}</span>
      <input
        value={text}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/g, '$1')
          setText(next)
          onChange(parse(next))
        }}
        onFocus={(e) => e.currentTarget.select()}
        inputMode="decimal"
        className={`w-full min-w-0 bg-transparent text-right font-semibold tabular-nums text-white outline-none ${
          big ? 'text-xl' : 'text-[15px]'
        }`}
      />
      <span className="shrink-0 text-xs text-muted">{CURRENCY_SUFFIX}</span>
    </label>
  )
}
