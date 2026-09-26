import { forwardRef, type KeyboardEvent } from 'react'
import { CURRENCY_SUFFIX } from '../../config'

interface Props {
  value: string
  onChange: (text: string) => void
  label: string
  autoFocus?: boolean
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  /** Smaller type for the laptop panel, which sits next to other things. */
  compact?: boolean
}

/** The big amount: tap (or click) anywhere on it to type an exact number. */
export const AmountField = forwardRef<HTMLInputElement, Props>(function AmountField(
  { value, onChange, label, autoFocus, onKeyDown, compact = false },
  ref,
) {
  return (
    <label
      className={`flex w-full cursor-text items-baseline justify-center gap-2 rounded-3xl bg-white/5 ring-1 ring-white/10 transition focus-within:ring-white/30 ${
        compact ? 'py-4' : 'py-6'
      }`}
    >
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={onKeyDown}
        inputMode="decimal"
        placeholder="0"
        aria-label={label}
        autoFocus={autoFocus}
        className={`w-full max-w-[65%] bg-transparent text-right font-bold tabular-nums text-white outline-none placeholder:text-white/25 ${
          compact ? 'text-5xl' : 'text-huge'
        }`}
      />
      <span className={`font-semibold text-muted ${compact ? 'text-2xl' : 'text-3xl'}`}>
        {CURRENCY_SUFFIX}
      </span>
    </label>
  )
})
